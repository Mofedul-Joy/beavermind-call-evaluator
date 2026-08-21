"""
The delivery worker on Modal.

    modal run     delivery/modal_app.py --media /path/to/call.mp4     # one-off, local file
    modal deploy  delivery/modal_app.py                               # the web endpoints

Why Modal and not a Vercel function: this is 5-7 minutes of CPU on a 1.4 GB image with
four ONNX models in it. Vercel's ceiling is 300 seconds and its bundle limit is 250 MB.
Modal bills per second of actual compute and scales to zero, so a call costs about $0.03
and an idle week costs nothing.

Workspace is pinned to `leisuretimemovie` (Mofedul's own). This machine has five Modal
profiles on it and the token in `ICM/.env` resolves to a different one, so inheriting the
ambient profile would silently bill the wrong workspace.
"""

# NOTE: deliberately no `from __future__ import annotations` here.
#
# Modal serializes this module with cloudpickle, which captures the globals a function
# actually references. With PEP 563 in force, `request: Request` is only ever the STRING
# "Request", so `Request` is never referenced, never captured, and FastAPI's
# `get_type_hints` cannot resolve it in the container — the parameter silently degrades to
# a query string and every POST 422s on a missing `request` query param. Real annotation
# objects are captured. Everything here is valid on Python 3.9 without the future import.

import os
import time
from pathlib import Path
from typing import Any, Optional

import modal
from fastapi import FastAPI, Header, HTTPException, Request

os.environ.setdefault("MODAL_PROFILE", "leisuretimemovie")

APP_NAME = "beavermind-delivery"

SEGMENTATION_URL = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/"
    "sherpa-onnx-pyannote-segmentation-3-0.tar.bz2"
)
EMBEDDING_URL = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/"
    "3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx"
)

# Models are baked into the image rather than pulled at runtime. A cold start that has to
# fetch 400 MB first would dominate the wall clock, and a release asset that moves would
# then break production instead of breaking the build.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "curl", "bzip2")
    .pip_install(
        "numpy==2.2.6",
        "onnxruntime==1.22.0",
        "sherpa-onnx==1.13.6",
        "onnx-asr[cpu,hub]==0.12.0",
        "swift-f0==0.1.2",
        "huggingface-hub==0.34.4",
        "fastapi[standard]==0.115.12",
    )
    .run_commands(
        "mkdir -p /models",
        f"curl -sSL {SEGMENTATION_URL} -o /tmp/seg.tar.bz2",
        "tar xjf /tmp/seg.tar.bz2 -C /models && rm /tmp/seg.tar.bz2",
        f"curl -sSL {EMBEDDING_URL} -o /models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx",
        # Pre-fetch the ASR weights into the image's HF cache for the same reason.
        "python -c \"import onnx_asr; onnx_asr.load_model('nemo-parakeet-tdt-0.6b-v3')\"",
    )
    .env({"HF_HUB_OFFLINE": "1"})
    .add_local_python_source("contract", "metrics", "pipeline")
)

app = modal.App(APP_NAME, image=image)

# Optional. Set `WORKER_TOKEN` so the web endpoints are not open to the internet, and
# `MODAL_PROXY_TOKEN` is not a thing — this is our own shared secret.
#   modal secret create beavermind-delivery WORKER_TOKEN=...
secret = modal.Secret.from_name("beavermind-delivery", required_keys=[])

# Modal's CPU seconds are cheap; wall clock is what costs. 4 cores roughly halves a
# 30-minute call versus 2 and the per-second rate is per-core, so the bill barely moves.
COMPUTE = dict(cpu=4.0, memory=8192, timeout=60 * 20)


@app.function(**COMPUTE, secrets=[secret])
def analyse(media: bytes, filename: str = "call.mp4", callback_url: Optional[str] = None) -> dict[str, Any]:
    """Measure one recording. Returns a DeliveryReport as plain JSON.

    Everything this returns is a physical quantity with a unit and a timestamp. It writes
    no prose and no labels: the language model that turns these numbers into coaching
    notes runs later, in the Next.js app, and never receives the audio. It cannot
    hallucinate a talk ratio it was handed.
    """
    import json
    import tempfile
    import urllib.request

    from contract import CONTRACT_VERSION, DeliveryReport
    from metrics import build_report_body, utterances
    from pipeline import (
        chunk_turns,
        decode_and_normalise,
        diarize,
        loudness_track,
        quality_warnings,
        read_wav,
        track_pitch,
        transcribe,
    )

    began = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / filename
        src.write_bytes(media)
        wav = Path(tmp) / "norm.wav"

        wav, duration, has_video, source = decode_and_normalise(src, wav)
        samples = read_wav(wav)

        turns = diarize(samples)
        loud = loudness_track(wav)
        words = transcribe(samples, chunk_turns(turns))
        pitch = track_pitch(samples)

    speakers, roles, metrics, notes = build_report_body(turns, words, pitch, loud, duration)
    notes = quality_warnings(source) + notes
    wall = time.time() - began

    if has_video:
        notes.append(
            "This recording has a video track. Nothing in it was analysed here — PRESENCE "
            "is measured in the browser so the video never leaves the coach's machine."
        )

    report = DeliveryReport(
        version=CONTRACT_VERSION,
        media={
            "duration_sec": round(duration, 1),
            "has_video": has_video,
            "sample_rate": 16_000,
            "filename": filename,
            "source": source,
        },
        speakers=speakers,
        role_assignment=roles,
        metrics=metrics,
        turns=turns,
        utterances=utterances(words, turns),
        notes=notes,
        compute={
            "wall_clock_sec": round(wall, 1),
            # Modal list price for the pinned shape. Recorded so the cost shown in the UI
            # is derived from something, not guessed.
            "usd_estimate": round(wall * (4 * 0.0000131 + 8 * 0.00000222), 4),
            "realtime_factor": round(wall / duration, 3) if duration else None,
            "stack": "ffmpeg loudnorm/ebur128 + sherpa-onnx + parakeet-tdt-0.6b-v3 + swift-f0",
        },
    ).to_json()

    if callback_url:
        req = urllib.request.Request(
            callback_url,
            data=json.dumps(report).encode(),
            headers={
                "content-type": "application/json",
                "x-worker-token": os.environ.get("WORKER_TOKEN", ""),
            },
        )
        try:
            urllib.request.urlopen(req, timeout=30).read()
        except Exception as e:  # a failed callback must not lose the result
            report["notes"].append(f"callback to the app failed: {e}")

    return report


# ── web endpoints ────────────────────────────────────────────────────────────
#
# The worker outlives a Vercel function — 5-7 minutes against a 300-second ceiling — so
# the job cannot be awaited over HTTP. POST starts it and returns an id; GET polls it.
# Pass `callback_url` instead if the app would rather be told than ask.
#
# Media arrives one of two ways. `media_url` is the production path: the browser uploads
# straight to Supabase Storage and the worker fetches a signed URL, so a 200 MB recording
# never passes through Vercel or through Modal's web layer. Raw bytes in the request body
# is the simple path, for small files and for testing.


def _fetch(url: str) -> bytes:
    import urllib.request

    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


@app.function(image=image, secrets=[secret], min_containers=0)
@modal.asgi_app()
def api():
    web = FastAPI(title="beavermind delivery worker", docs_url=None, redoc_url=None)

    def check(token: Optional[str]) -> None:
        expected = os.environ.get("WORKER_TOKEN")
        if expected and token != expected:
            raise HTTPException(status_code=401, detail="bad or missing x-worker-token")

    @web.post("/start")
    async def start(  # noqa: ANN202
        request: Request,
        filename: str = "call.mp4",
        media_url: Optional[str] = None,
        callback_url: Optional[str] = None,
        x_worker_token: Optional[str] = Header(default=None),
    ):
        check(x_worker_token)

        media = _fetch(media_url) if media_url else await request.body()
        if not media:
            raise HTTPException(
                status_code=400,
                detail="send the media as the request body, or pass ?media_url= to a signed URL",
            )

        call = analyse.spawn(media, filename=filename, callback_url=callback_url)
        return {"call_id": call.object_id, "bytes": len(media)}

    @web.get("/health")
    def health():  # noqa: ANN202
        import fastapi

        return {
            "ok": True,
            "contract": 1,
            "fastapi": fastapi.__version__,
            "request_param": [
                r.dependant.request_param_name
                for r in web.routes
                if getattr(r, "path", None) == "/start"
            ],
        }

    @web.get("/result")
    def result(call_id: str, x_worker_token: Optional[str] = Header(default=None)):  # noqa: ANN202
        check(x_worker_token)
        try:
            return {"status": "done", "report": modal.FunctionCall.from_id(call_id).get(timeout=0)}
        except TimeoutError:
            return {"status": "running", "report": None}
        except Exception as e:
            return {"status": "failed", "report": None, "error": str(e)}

    return web


@app.local_entrypoint()
def main(media: str, out: str = "delivery-report.json"):
    """One-off run against a local file, for verification."""
    import json

    path = Path(media)
    report = analyse.remote(path.read_bytes(), filename=path.name)
    Path(out).write_text(json.dumps(report, indent=2))

    m = {x["key"]: x for x in report["metrics"]}
    role = report["roleAssignment"]
    print(f"\n  {report['media']['durationSec']}s · {len(report['turns'])} turns · "
          f"coach = speaker {role['coachSpeakerId']} ({role['method']}"
          f"{'' if role['confident'] else ', NOT confident'})")
    print(f"  {report['compute']['wallClockSec']}s wall · "
          f"{report['compute']['realtimeFactor']}x realtime · "
          f"${report['compute']['usdEstimate']}\n")
    for k, v in m.items():
        val = v["value"]
        print(f"  {k:24} {'—' if val is None else val:>8}  {v['unit']}"
              + (f"   ({v['unavailableReason']})" if v["unavailableReason"] else ""))
    for n in report["notes"]:
        print(f"\n  note: {n}")
    print(f"\n  written to {out}")
