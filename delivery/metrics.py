"""
The measurement logic. Pure functions, standard library only.

Everything expensive — decoding, diarization, ASR, pitch tracking — lives in
`pipeline.py` and exists only to produce the four plain inputs this module consumes:

    turns      [(speaker, start, end)]        who was speaking when
    words      [(text, start, end)]           what was said when
    loudness   [(time, lufs)]                 short-term loudness after R128 normalisation
    pitch      [(time, hz, voiced)]           F0 track

That split is deliberate. The ML stages are thin adapters that can only be verified by
running them; this file holds every decision that actually shapes the report, and it is
tested locally in `test_metrics.py` with no models, no GPU and no network.
"""

from __future__ import annotations

import math
import re
import statistics
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence

from contract import (
    BENCHMARKS,
    Benchmark,
    Metric,
    Moment,
    RoleAssignment,
    SpeakerSummary,
    Turn,
    Utterance,
)


@dataclass
class Word:
    text: str
    start: float
    end: float


@dataclass
class PitchFrame:
    time: float
    hz: float
    voiced: bool


@dataclass
class LoudnessFrame:
    time: float
    lufs: float


# ── timeline arithmetic ──────────────────────────────────────────────────────


def speaking_seconds(turns: Sequence[Turn]) -> dict[str, float]:
    out: dict[str, float] = {}
    for t in turns:
        out[t.speaker] = out.get(t.speaker, 0.0) + max(0.0, t.end - t.start)
    return out


def talk_ratio(turns: Sequence[Turn]) -> dict[str, float]:
    """Share of total *speaking* time, not of call duration.

    Silence belongs to neither party, so dividing by wall clock would make both speakers
    look quieter on a call with long pauses. Percentages here sum to 100.
    """
    secs = speaking_seconds(turns)
    total = sum(secs.values())
    if total <= 0:
        return {}
    return {k: round(v / total * 100, 1) for k, v in secs.items()}


def longest_monologue(
    turns: Sequence[Turn], speaker: str, interjection_tolerance: float = 1.5
) -> Optional[tuple[float, float, float]]:
    """Longest continuous stretch this speaker held the floor.

    Short interjections from the other party ("mm", "right", "yeah") do not end a
    monologue — anything up to `interjection_tolerance` seconds is treated as
    backchannel. Returns (duration, start, end) measured in wall clock from the first
    word to the last, which is what "you talked for six minutes straight" means to the
    person hearing it.
    """
    ordered = sorted(turns, key=lambda t: t.start)
    best: Optional[tuple[float, float, float]] = None
    run_start: Optional[float] = None
    run_end = 0.0

    def close_run() -> None:
        nonlocal best, run_start
        if run_start is not None:
            span = (run_end - run_start, run_start, run_end)
            if best is None or span[0] > best[0]:
                best = span
        run_start = None

    for t in ordered:
        if t.speaker == speaker:
            if run_start is None:
                run_start = t.start
            run_end = max(run_end, t.end)
        else:
            # Another voice. Backchannel keeps the run alive; a real turn ends it.
            if (t.end - t.start) > interjection_tolerance:
                close_run()
    close_run()
    return best


def interruptions(
    turns: Sequence[Turn], min_overlap: float = 0.3, yield_within: float = 1.0
) -> tuple[dict[str, list[Moment]], bool]:
    """Count who cut across whom.

    An interruption is: B starts while A is still speaking, they overlap by at least
    `min_overlap`, and A gives up within `yield_within` seconds of B starting. B talking
    over A while A carries on regardless is a collision, not an interruption, and is not
    counted.

    Also returns whether the diarization produced any overlapping segments at all. On
    single-channel audio a segmenter that never emits overlap makes a zero here
    meaningless, and the caller says so rather than reporting a clean sheet.
    """
    ordered = sorted(turns, key=lambda t: t.start)
    by_interrupter: dict[str, list[Moment]] = {}
    saw_overlap = False

    for i, a in enumerate(ordered):
        for b in ordered[i + 1 :]:
            if b.start >= a.end:
                break  # ordered by start: nothing further can overlap a
            if b.speaker == a.speaker:
                continue
            overlap = min(a.end, b.end) - b.start
            if overlap <= 0:
                continue
            saw_overlap = True
            if overlap >= min_overlap and (a.end - b.start) <= yield_within:
                by_interrupter.setdefault(b.speaker, []).append(
                    Moment(
                        start_sec=round(b.start, 2),
                        end_sec=round(a.end, 2),
                        note=f"cut across speaker {a.speaker}",
                    )
                )
    return by_interrupter, saw_overlap


# ── words ────────────────────────────────────────────────────────────────────


def assign_words(words: Sequence[Word], turns: Sequence[Turn]) -> dict[str, list[Word]]:
    """Attribute each word to the turn containing its midpoint.

    Midpoint rather than onset: word and turn boundaries come from two different models
    and disagree by tens of milliseconds, which flips a word to the wrong speaker at
    every turn change if you key off the start alone.
    """
    ordered = sorted(turns, key=lambda t: t.start)
    out: dict[str, list[Word]] = {}
    for w in words:
        mid = (w.start + w.end) / 2
        for t in ordered:
            if t.start <= mid <= t.end:
                out.setdefault(t.speaker, []).append(w)
                break
    return out


def words_per_minute(words: Sequence[Word], speaking_sec: float) -> Optional[float]:
    """Divide by speaking time, never by call duration.

    Dividing by wall clock measures how much of the call was talking, which is the talk
    ratio again wearing a different unit. This measures pace.
    """
    if speaking_sec <= 0 or not words:
        return None
    return round(len(words) / speaking_sec * 60, 1)


_SENTENCE_END = re.compile(r"[.!?]")
_INTERROGATIVE = re.compile(
    r"^(what|why|how|when|where|who|whom|whose|which|do|does|did|can|could|would|will|"
    r"shall|should|are|is|am|was|were|have|has|had|may|might)\b",
    re.IGNORECASE,
)


@dataclass
class Sentence:
    text: str
    start: float
    end: float
    is_question: bool


def sentences(words: Sequence[Word]) -> list[Sentence]:
    """Split a word stream into sentences and mark the questions.

    Two detectors, unioned, because recall is the binding constraint: the ASR's own `?`,
    and a leading interrogative on a sentence the ASR punctuated as a statement. Question
    detection from punctuation alone runs at roughly 0.70–0.78 F1, so this is a floor.
    Prosodic detection was measured at about +0.2 F1 and is not worth the second model.
    """
    out: list[Sentence] = []
    buf: list[Word] = []
    for w in words:
        buf.append(w)
        if _SENTENCE_END.search(w.text):
            out.append(_make_sentence(buf))
            buf = []
    if buf:
        out.append(_make_sentence(buf))
    return out


def _make_sentence(buf: Sequence[Word]) -> Sentence:
    text = " ".join(w.text for w in buf).strip()
    stripped = text.lstrip("\"'([ ")
    is_q = "?" in text or bool(_INTERROGATIVE.match(stripped))
    return Sentence(text=text, start=buf[0].start, end=buf[-1].end, is_question=is_q)


def pauses(words: Sequence[Word], threshold: float = 1.0) -> list[tuple[float, float]]:
    """Gaps between consecutive words from one speaker. Returns (gap, start_of_gap)."""
    out: list[tuple[float, float]] = []
    for a, b in zip(words, words[1:]):
        gap = b.start - a.end
        if gap >= threshold:
            out.append((round(gap, 2), round(a.end, 2)))
    return out


def question_response_gaps(
    questions: Sequence[Sentence], turns: Sequence[Turn], asker: str
) -> tuple[list[tuple[float, float]], list[Sentence]]:
    """How long the asker stayed quiet after each question, and which they answered themselves.

    For every question, find the next speech onset after it ends. If that onset belongs to
    the asker, they filled their own silence — the single most coachable event this whole
    pipeline can surface. Those are returned separately and excluded from the gap median,
    because a self-answered question has a gap near zero and would drag the median toward
    a number that describes a different behaviour.
    """
    ordered = sorted(turns, key=lambda t: t.start)
    gaps: list[tuple[float, float]] = []
    self_answered: list[Sentence] = []

    for q in questions:
        nxt = next((t for t in ordered if t.start > q.end + 1e-6), None)
        if nxt is None:
            continue
        if nxt.speaker == asker:
            self_answered.append(q)
        else:
            gaps.append((round(nxt.start - q.end, 2), round(q.end, 2)))
    return gaps, self_answered


# ── acoustics ────────────────────────────────────────────────────────────────


def _in_turns(time: float, turns: Sequence[Turn], speaker: str) -> bool:
    return any(t.speaker == speaker and t.start <= time <= t.end for t in turns)


def _median_filter(values: Sequence[float], width: int = 5) -> list[float]:
    """Kills the octave doubling and halving that every F0 tracker produces."""
    if width < 3 or len(values) < width:
        return list(values)
    half = width // 2
    return [
        statistics.median(values[max(0, i - half) : i + half + 1])
        for i in range(len(values))
    ]


def pitch_variation_semitones(
    frames: Sequence[PitchFrame], turns: Sequence[Turn], speaker: str
) -> Optional[float]:
    """SD of F0 in semitones relative to this speaker's OWN median.

    Raw Hz is not comparable between people: male and female medians differ by roughly an
    octave, so a Hz threshold would encode sex rather than delivery. Normalising to the
    speaker's own median makes the number mean 'how much this person moved around their
    own baseline', which is the only thing it can honestly mean.

    Unvoiced frames are dropped, the track is median-filtered, and anything more than an
    octave from the speaker's median is discarded as a tracking error rather than
    inflating the SD.
    """
    hz = [f.hz for f in frames if f.voiced and f.hz > 0 and _in_turns(f.time, turns, speaker)]
    if len(hz) < 20:
        return None

    smoothed = _median_filter(hz)
    median = statistics.median(smoothed)
    if median <= 0:
        return None

    semis = [12 * math.log2(v / median) for v in smoothed]
    kept = [s for s in semis if abs(s) <= 12]
    if len(kept) < 20:
        return None
    return round(statistics.pstdev(kept), 2)


def energy_variation(
    frames: Sequence[LoudnessFrame],
    turns: Sequence[Turn],
    speaker: str,
    silence_gate: float = -60.0,
) -> Optional[float]:
    """SD of short-term loudness in LU, over this speaker's speech only.

    The audio is EBU R128 normalised before this runs, so a quietly-recorded coach does
    not read as a flat one. Frames below the gate are silence inside a turn and would
    otherwise turn 'left a long pause' into 'varied their energy'.
    """
    vals = [
        f.lufs
        for f in frames
        if f.lufs > silence_gate
        and math.isfinite(f.lufs)
        and _in_turns(f.time, turns, speaker)
    ]
    if len(vals) < 10:
        return None
    return round(statistics.pstdev(vals), 2)


# ── role assignment ──────────────────────────────────────────────────────────


def assign_roles(
    turns: Sequence[Turn], words_by_speaker: dict[str, list[Word]]
) -> RoleAssignment:
    """Decide which anonymous cluster is the coach.

    Diarization returns speaker 0 and speaker 1. Nothing in the audio says which is which.
    The coach asks the questions, so question count decides it, with speaking time as a
    tie-break. The margin is returned and the UI lets the operator flip it, because a
    heuristic presented as a fact is worse than a heuristic presented as a heuristic.
    """
    ids = sorted(set(t.speaker for t in turns))
    if len(ids) < 2:
        return RoleAssignment(
            coach_speaker_id=ids[0] if ids else None,
            method="single speaker detected",
            margin=0.0,
            confident=False,
        )

    q = {
        s: sum(1 for sent in sentences(words_by_speaker.get(s, [])) if sent.is_question)
        for s in ids
    }
    ranked = sorted(ids, key=lambda s: q[s], reverse=True)
    top, second = ranked[0], ranked[1]
    total_q = sum(q.values())

    if q[top] > q[second]:
        margin = (q[top] - q[second]) / total_q if total_q else 0.0
        return RoleAssignment(
            coach_speaker_id=top,
            method=f"asked the most questions ({q[top]} vs {q[second]})",
            margin=round(margin, 3),
            confident=margin >= 0.2,
        )

    secs = speaking_seconds(turns)
    by_time = sorted(ids, key=lambda s: secs.get(s, 0.0), reverse=True)
    total = sum(secs.values()) or 1.0
    margin = (secs.get(by_time[0], 0) - secs.get(by_time[1], 0)) / total
    return RoleAssignment(
        coach_speaker_id=by_time[0],
        method="tied on questions; fell back to who spoke longest",
        margin=round(margin, 3),
        confident=False,
    )


def utterances(words: Sequence[Word], turns: Sequence[Turn]) -> list[Utterance]:
    """One line of text per turn, so the UI can caption a timestamp with what was said.

    Diarized turns overlap — the segmentation model emits overlapping speech regions, and
    on a recording with one dominant voice it will occasionally hallucinate a fragment of
    the other speaker on top of it. A naive "every word whose midpoint lands inside this
    turn" would then print those words under BOTH speakers. Each word is claimed by
    exactly one turn, the same way `assign_words` does it, so the transcript adds up.
    """
    ordered = sorted(turns, key=lambda t: t.start)
    claimed: dict[int, list[Word]] = {}
    for w in words:
        mid = (w.start + w.end) / 2
        for i, t in enumerate(ordered):
            if t.start <= mid <= t.end:
                claimed.setdefault(i, []).append(w)
                break

    return [
        Utterance(
            speaker=t.speaker,
            start=round(t.start, 2),
            end=round(t.end, 2),
            text=" ".join(w.text for w in claimed[i]),
        )
        for i, t in enumerate(ordered)
        if claimed.get(i)
    ]


# ── assembly ─────────────────────────────────────────────────────────────────


def build_report_body(
    turns: Sequence[Turn],
    words: Sequence[Word],
    pitch: Sequence[PitchFrame],
    loudness: Sequence[LoudnessFrame],
    duration_sec: float,
) -> tuple[list[SpeakerSummary], RoleAssignment, list[Metric], list[str]]:
    notes: list[str] = []
    by_speaker = assign_words(words, turns)
    secs = speaking_seconds(turns)
    roles = assign_roles(turns, by_speaker)
    coach = roles.coach_speaker_id
    others = [s for s in sorted(secs) if s != coach]
    client = others[0] if others else None

    if not roles.confident:
        notes.append(
            "Speaker roles were assigned by heuristic and the margin was thin. Check the "
            "labels before trusting the per-speaker numbers."
        )

    speakers = [
        SpeakerSummary(
            id=s,
            role="coach" if s == coach else ("client" if s == client else "unknown"),
            speaking_sec=round(secs.get(s, 0.0), 1),
            turn_count=sum(1 for t in turns if t.speaker == s),
            word_count=len(by_speaker.get(s, [])),
        )
        for s in sorted(secs)
    ]

    ratios = talk_ratio(turns)
    metrics: list[Metric] = [
        Metric(
            key="talk_ratio",
            label="Talk / listen ratio",
            unit="% of speaking time",
            value=ratios.get(coach) if coach else None,
            interpretation="band",
            benchmark=BENCHMARKS["talk_ratio"],
            per_speaker=ratios,
            method="Sum of diarized speech per speaker over total speech. Silence excluded.",
        )
    ]

    mono = longest_monologue(turns, coach) if coach else None
    metrics.append(
        Metric(
            key="longest_monologue",
            label="Longest unbroken stretch",
            unit="seconds",
            value=round(mono[0], 1) if mono else None,
            interpretation="lower_is_better",
            benchmark=BENCHMARKS["longest_monologue"],
            evidence=(
                [Moment(round(mono[1], 1), round(mono[2], 1), "longest stretch")]
                if mono
                else []
            ),
            unavailable_reason=None if mono else "no coach speech was detected",
            method="Backchannel under 1.5s does not break the run.",
        )
    )

    wpm_all = {
        s: w
        for s in secs
        if (w := words_per_minute(by_speaker.get(s, []), secs.get(s, 0.0))) is not None
    }
    metrics.append(
        Metric(
            key="wpm",
            label="Speaking pace",
            unit="words per minute",
            value=wpm_all.get(coach) if coach else None,
            interpretation="band",
            benchmark=BENCHMARKS["wpm"],
            per_speaker=wpm_all,
            method="Words divided by that speaker's speaking seconds, not by call length.",
        )
    )

    coach_words = by_speaker.get(coach, []) if coach else []
    coach_sentences = sentences(coach_words)
    questions = [s for s in coach_sentences if s.is_question]
    gaps, self_answered = question_response_gaps(questions, turns, coach) if coach else ([], [])

    metrics.append(
        Metric(
            key="question_rate",
            label="Questions asked",
            unit="count",
            value=float(len(questions)),
            interpretation="context_only",
            benchmark=BENCHMARKS["question_rate"],
            evidence=[
                Moment(round(q.start, 1), round(q.end, 1), q.text[:120]) for q in questions[:12]
            ],
            method="ASR punctuation unioned with a leading-interrogative check. A floor, not exact.",
        )
    )

    metrics.append(
        Metric(
            key="pause_after_question",
            label="Silence left after a question",
            unit="seconds (median)",
            value=round(statistics.median(g for g, _ in gaps), 2) if gaps else None,
            interpretation="higher_is_better",
            benchmark=BENCHMARKS["pause_after_question"],
            evidence=(
                [Moment(t, None, f"{g}s of silence") for g, t in sorted(gaps)[:5]]
                + [
                    Moment(round(q.start, 1), round(q.end, 1), f"answered own question: {q.text[:100]}")
                    for q in self_answered[:5]
                ]
            ),
            unavailable_reason=None if gaps else "no questions were followed by the other speaker",
            method=(
                f"{len(self_answered)} of {len(questions)} questions were followed by the coach "
                "speaking again rather than the client. Those are listed separately and excluded "
                "from the median."
            ),
        )
    )

    long_pauses = pauses(coach_words, threshold=1.0)
    metrics.append(
        Metric(
            key="long_pause_count",
            label="Pauses over one second",
            unit="count",
            value=float(len(long_pauses)),
            interpretation="context_only",
            benchmark=BENCHMARKS["long_pause_count"],
            evidence=[Moment(t, None, f"{g}s") for g, t in sorted(long_pauses, reverse=True)[:5]],
            method="Gaps between consecutive words from the same speaker.",
        )
    )

    by_interrupter, saw_overlap = interruptions(turns)
    if not saw_overlap:
        notes.append(
            "The diarizer produced no overlapping speech anywhere in this recording, so the "
            "interruption count is a lower bound. Separate per-participant audio would make "
            "it exact."
        )
    coach_cuts = by_interrupter.get(coach, []) if coach else []
    metrics.append(
        Metric(
            key="interruptions",
            label="Times the coach cut in",
            unit="count",
            value=float(len(coach_cuts)),
            interpretation="lower_is_better",
            benchmark=BENCHMARKS["interruptions"],
            per_speaker={k: float(len(v)) for k, v in by_interrupter.items()},
            evidence=coach_cuts[:5],
            method="Overlap of 0.3s or more where the other speaker stops within a second.",
        )
    )

    energy = {
        s: e for s in secs if (e := energy_variation(loudness, turns, s)) is not None
    }
    metrics.append(
        Metric(
            key="energy_variance",
            label="Loudness variation",
            unit="LU (standard deviation)",
            value=energy.get(coach) if coach else None,
            interpretation="context_only",
            benchmark=BENCHMARKS["energy_variance"],
            per_speaker=energy,
            unavailable_reason=None if energy else "not enough voiced audio to measure",
            method="Momentary EBU R128 loudness (400 ms window) over this speaker's turns, after 2-pass normalisation.",
        )
    )

    pitch_sd = {
        s: p
        for s in secs
        if (p := pitch_variation_semitones(pitch, turns, s)) is not None
    }
    metrics.append(
        Metric(
            key="pitch_variance",
            label="Pitch variation",
            unit="semitones (SD around own median)",
            value=pitch_sd.get(coach) if coach else None,
            interpretation="context_only",
            benchmark=BENCHMARKS["pitch_variance"],
            per_speaker=pitch_sd,
            unavailable_reason=None if pitch_sd else "not enough voiced audio to measure",
            method=(
                "Voiced frames only, median-filtered, converted to semitones against this "
                "speaker's own median. Comparable within a person, never between two."
            ),
        )
    )

    return speakers, roles, metrics, notes
