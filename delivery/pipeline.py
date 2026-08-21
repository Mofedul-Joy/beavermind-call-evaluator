"""
The expensive half: media in, four plain arrays out.

Nothing in this file decides what the report says. Its only job is to produce the inputs
`metrics.py` consumes, so that every judgement call sits in a module that can be tested
without a GPU, a model download or a network.

Stage order and why:

    ffmpeg 2-pass loudnorm     EBU R128. Runs FIRST so a quietly-recorded coach does not
                               read as a flat one, and so loudness numbers from two
                               different calls can be compared at all.
    ffmpeg ebur128             Momentary loudness track, 400 ms window.
    sherpa-onnx diarization    num_clusters=2. These calls have exactly two people in
                               them, so the hard part of diarization — not knowing how
                               many speakers there are — does not apply. Full pyannote
                               would be more model for no more answer, and it is gated
                               behind a Hugging Face token and a terms acceptance.
    onnx-asr / parakeet        Word timestamps and punctuation. Chunked on the diarized
                               segments, which bounds memory and hands each chunk to ASR
                               already labelled with who is speaking.
    swift-f0                   F0 track. 96k parameters, ONNX, MIT.

Every dependency here is permissively licensed and ungated. Praat/parselmouth (GPL-3.0),
Essentia (AGPL-3.0), openSMILE (research licence that extends to extracted features),
pyannote (gated), and every CC-BY-NC aligner were all ruled out on licence, not on
quality — see `stages/01-research/output/research-audio-stack.md`.
"""

from __future__ import annotations

import json
import re
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence

from contract import Turn
from metrics import LoudnessFrame, PitchFrame, Word

SAMPLE_RATE = 16_000
MODEL_DIR = Path("/models")

SEGMENTATION_MODEL = MODEL_DIR / "sherpa-onnx-pyannote-segmentation-3-0" / "model.onnx"
EMBEDDING_MODEL = MODEL_DIR / "3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx"


def _run(cmd: Sequence[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=False)


# ── 1 + 2. decode, normalise, loudness ───────────────────────────────────────


def decode_and_normalise(src: Path, dst: Path) -> tuple[Path, float, bool, dict]:
    """Two-pass EBU R128 loudnorm to 16 kHz mono WAV.

    One pass would apply a dynamic gain that flattens exactly the loudness variation the
    energy metric is trying to measure. The measure-then-apply form is linear, so it
    changes the level and leaves the dynamics alone.

    Returns (wav path, duration, whether there was a video stream, what the source was).

    The source description is not cosmetic. Running this pipeline over the same 350
    seconds at 24 kbps Opus and losslessly showed the lossy version fragmenting
    diarization badly enough to change every downstream number — 33 turns against 37, a
    24-second longest monologue against 77, and two interruptions reported on a recording
    with no conversation in it. Speaker embeddings degrade before speech recognition
    audibly does, so the caller warns rather than silently reporting worse numbers.
    """
    probe = _run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,bit_rate,sample_rate:format=duration,bit_rate",
         "-of", "json", str(src)]
    )
    info = json.loads(probe.stdout or "{}")
    duration = float(info.get("format", {}).get("duration", 0.0) or 0.0)
    streams = info.get("streams", [])
    has_video = any(s.get("codec_type") == "video" for s in streams)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), {})
    source = {
        "codec": audio.get("codec_name"),
        "bitrate": int(audio.get("bit_rate") or info.get("format", {}).get("bit_rate") or 0) or None,
        "sample_rate": int(audio.get("sample_rate") or 0) or None,
    }

    measure = _run(
        ["ffmpeg", "-nostdin", "-i", str(src), "-map", "0:a:0",
         "-af", "loudnorm=I=-23:TP=-2:LRA=7:print_format=json",
         "-f", "null", "-"]
    )
    stats = _parse_trailing_json(measure.stderr)

    af = "loudnorm=I=-23:TP=-2:LRA=7:linear=true"
    if stats:
        af += (
            f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
            f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
            f":offset={stats.get('target_offset', '0.0')}"
        )

    apply_ = _run(
        ["ffmpeg", "-nostdin", "-y", "-i", str(src), "-map", "0:a:0", "-af", af,
         "-ar", str(SAMPLE_RATE), "-ac", "1", "-c:a", "pcm_s16le", str(dst)]
    )
    if not dst.exists():
        raise RuntimeError(f"ffmpeg produced no audio: {apply_.stderr[-2000:]}")

    if duration <= 0:
        with wave.open(str(dst)) as f:
            duration = f.getnframes() / f.getframerate()
    return dst, duration, has_video, source


# Below this, speaker embeddings degrade enough to fragment diarization. Measured, not
# assumed — see the docstring above.
LOSSY_BITRATE_FLOOR = 48_000


def quality_warnings(source: dict) -> list[str]:
    warnings: list[str] = []
    bitrate, rate = source.get("bitrate"), source.get("sample_rate")
    if bitrate and bitrate < LOSSY_BITRATE_FLOOR:
        warnings.append(
            f"This recording is {bitrate // 1000} kbps {source.get('codec') or 'audio'}. Below "
            f"{LOSSY_BITRATE_FLOOR // 1000} kbps the speaker separation fragments, which shortens "
            "monologues and invents interruptions. Treat the per-speaker numbers as indicative and "
            "re-upload a higher-quality file if you can."
        )
    if rate and rate < 16_000:
        warnings.append(
            f"The audio was recorded at {rate} Hz. Pitch and loudness figures still hold, but the "
            "transcript and therefore the pace and question counts will be weaker than usual."
        )
    return warnings


def _parse_trailing_json(stderr: str) -> Optional[dict]:
    """loudnorm prints its JSON block last, after all the usual ffmpeg noise."""
    start = stderr.rfind("{")
    end = stderr.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(stderr[start : end + 1])
    except json.JSONDecodeError:
        return None


# ffmpeg's ebur128 filter no longer prints its per-frame lines to stderr, so the values
# are pulled out of frame metadata instead. `ametadata` writes them to stdout, which is
# machine-readable and does not depend on a log level.
_PTS = re.compile(r"pts_time:([\d.]+)")
_R128 = re.compile(r"lavfi\.r128\.M=(-?[\d.]+|-?inf)")


def loudness_track(wav: Path) -> list[LoudnessFrame]:
    """Momentary loudness, 400 ms window, sampled at 10 Hz.

    Momentary rather than short-term: the 3-second short-term window straddles turn
    boundaries on a conversational call, which would attribute one speaker's loudness to
    the other.
    """
    out = _run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", str(wav),
         "-af", "ebur128=metadata=1,ametadata=mode=print:key=lavfi.r128.M:file=-",
         "-f", "null", "-"]
    )
    frames: list[LoudnessFrame] = []
    time: Optional[float] = None
    for line in out.stdout.splitlines():
        if (m := _PTS.search(line)) is not None:
            time = float(m.group(1))
        elif (m := _R128.search(line)) is not None and time is not None:
            try:
                frames.append(LoudnessFrame(time=time, lufs=float(m.group(1))))
            except ValueError:
                continue  # '-inf' on digital silence
    return frames


# ── 3. diarization ───────────────────────────────────────────────────────────


def read_wav(wav: Path):
    import numpy as np

    with wave.open(str(wav)) as f:
        if f.getframerate() != SAMPLE_RATE or f.getnchannels() != 1:
            raise ValueError("expected 16 kHz mono; decode_and_normalise guarantees it")
        raw = f.readframes(f.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def diarize(samples, num_speakers: int = 2) -> list[Turn]:
    """Who spoke when.

    `num_clusters` is pinned rather than inferred. A coaching call has two people on it;
    letting the clusterer guess only creates the chance of a third phantom speaker from a
    door slam or a stretch of laughter.
    """
    import sherpa_onnx

    config = sherpa_onnx.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=str(SEGMENTATION_MODEL)
            ),
        ),
        embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=str(EMBEDDING_MODEL)),
        clustering=sherpa_onnx.FastClusteringConfig(num_clusters=num_speakers),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not config.validate():
        raise RuntimeError("sherpa-onnx rejected the diarization config; check model paths")

    sd = sherpa_onnx.OfflineSpeakerDiarization(config)
    result = sd.process(samples).sort_by_start_time()
    return [Turn(speaker=str(s.speaker), start=float(s.start), end=float(s.end)) for s in result]


# ── 4. ASR ───────────────────────────────────────────────────────────────────


@dataclass
class Chunk:
    speaker: str
    start: float
    end: float


def chunk_turns(turns: Sequence[Turn], max_span: float = 25.0, join_gap: float = 0.5) -> list[Chunk]:
    """Merge consecutive same-speaker turns into ASR-sized chunks.

    Transcribing per diarized chunk rather than transcribing the whole file and then
    guessing who said what does three things at once: it bounds memory on a 45-minute
    call, it gives every word a speaker without a boundary heuristic, and it keeps each
    ASR call inside the length the ONNX export is happy with.
    """
    out: list[Chunk] = []
    for t in sorted(turns, key=lambda x: x.start):
        if (
            out
            and out[-1].speaker == t.speaker
            and t.start - out[-1].end <= join_gap
            and t.end - out[-1].start <= max_span
        ):
            out[-1].end = t.end
        else:
            out.append(Chunk(speaker=t.speaker, start=t.start, end=t.end))
    return out


def transcribe(samples, chunks: Sequence[Chunk], model_name: str = "nemo-parakeet-tdt-0.6b-v3", batch: int = 8) -> list[Word]:
    """Word-level transcript with punctuation, offset back onto the call's timeline.

    Batched, because onnx-asr pads every waveform in a batch to the longest one in it.
    Eight chunks of at most 25 seconds is a bounded 200 seconds of padded audio per pass
    regardless of how long the call is; handing it all 200 chunks of a 45-minute call at
    once would not be.
    """
    import numpy as np
    import onnx_asr

    model = onnx_asr.load_model(model_name).with_timestamps()
    clips: list = []
    starts: list[float] = []

    for c in chunks:
        a, b = int(c.start * SAMPLE_RATE), int(c.end * SAMPLE_RATE)
        clip = samples[max(0, a) : min(len(samples), b)]
        if len(clip) < SAMPLE_RATE // 4:
            continue  # under 250 ms is backchannel, not language
        clips.append(np.asarray(clip, dtype=np.float32))
        starts.append(c.start)

    words: list[Word] = []
    for i in range(0, len(clips), batch):
        window = clips[i : i + batch]
        results = model.recognize(window, sample_rate=SAMPLE_RATE)
        for result, offset in zip(results, starts[i : i + batch]):
            words.extend(_words_from_result(result, offset=offset))

    return sorted(words, key=lambda w: w.start)


def _words_from_result(result, offset: float) -> list[Word]:
    """Rebuild whole words from the model's sub-word tokens.

    onnx-asr already turns SentencePiece's U+2581 into a leading space, so a token that
    starts with a space starts a word. Both markers are accepted in case that changes.

    Falling back to a plain split when timestamps are missing keeps the transcript usable
    even though the pause and question-gap metrics then cannot be computed, which beats
    failing the whole run over one bad chunk.
    """
    tokens = getattr(result, "tokens", None)
    stamps = getattr(result, "timestamps", None)

    if not tokens or not stamps:
        text = getattr(result, "text", None) or str(result)
        return [Word(text=t, start=offset, end=offset) for t in text.split()] if text.strip() else []

    words: list[Word] = []
    for tok, ts in zip(tokens, stamps):
        at = offset + float(ts)
        if tok.startswith((" ", "\u2581")) or not words:
            words.append(Word(text=tok.strip(), start=at, end=at))
        else:
            words[-1].text += tok
            words[-1].end = at

    # A token timestamp marks where the token STARTS, so a word's end is only known from
    # the next word. Cap the inferred tail at one second so a pause is not swallowed into
    # the word before it and lost to the pause metric.
    for a, b in zip(words, words[1:]):
        a.end = max(a.end, min(b.start, a.end + 1.0))
    return [w for w in words if w.text]


# ── 5. pitch ─────────────────────────────────────────────────────────────────


def track_pitch(samples) -> list[PitchFrame]:
    """F0 track from swift-f0.

    Chosen over librosa.pyin (slower and less accurate) and over Praat via parselmouth,
    which is the accuracy leader and is GPL-3.0-or-later — unusable in a hosted service
    that is not itself GPL. The maintainer has said publicly that a dual licence is not
    possible because most of it is Praat code he cannot relicense.
    """
    import numpy as np
    from swift_f0 import SwiftF0

    # 60-500 Hz rather than the 65-400 the docs suggest for speech. A ceiling of 400
    # marks an expressive high voice's peaks as unvoiced, which would drop exactly the
    # frames that carry her pitch variation and systematically report women as flatter.
    detector = SwiftF0(fmin=60.0, fmax=500.0, confidence_threshold=0.9)
    r = detector.detect_from_array(np.asarray(samples, dtype=np.float32), SAMPLE_RATE)

    voicing = getattr(r, "voicing", None)
    if voicing is None:
        voicing = [c >= 0.9 for c in r.confidence]

    return [
        PitchFrame(time=float(t), hz=float(hz), voiced=bool(v))
        for t, hz, v in zip(r.timestamps, r.pitch_hz, voicing)
    ]
