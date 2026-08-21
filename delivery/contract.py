"""
The delivery-analytics contract.

This is the ONLY thing the Next.js app and the Modal worker agree on, and it mirrors
`src/delivery/types.ts` field for field. Change one, change the other.

Three rules are baked into these shapes rather than left to a prompt:

  1. **No composite score.** There is no `overall` field and there never will be. A
     single number invites the reader to treat vocal delivery as graded the way the
     rubric grades a transcript. It is not. The rubric is the client's document with
     defined bands; this is measurement.

  2. **No emotion label is representable.** Every metric is a physical quantity with a
     unit. There is no `emotion`, `sentiment`, `confidence` or `engagement` field, so a
     model downstream cannot smuggle one in through this contract. EU AI Act Art. 5(1)(f)
     bans emotion inference in workplace contexts; Recital 18 explicitly excludes "mere
     detection of readily apparent expressions, gestures or movements". This contract
     sits on the legal side of that line by construction, not by policy.

  3. **Every metric carries its own evidence and its own provenance.** `evidence` is a
     list of timestamps the UI turns into clickable seeks. `benchmark.source` says where
     the comparison number came from — and where there is no published benchmark, it
     says that in as many words instead of inventing one.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Literal, Optional

CONTRACT_VERSION = 1

Interpretation = Literal[
    "higher_is_better",
    "lower_is_better",
    "band",          # there is a healthy middle; both tails are worth a note
    "context_only",  # reported so the coach can see it; no direction is claimed
]

BenchmarkKind = Literal["range", "target", "none"]


@dataclass
class Benchmark:
    """Where the comparison number comes from.

    `kind == "none"` means no published benchmark was found. That is a real and common
    answer and it is reported honestly rather than filled with a plausible-looking figure.
    """
    kind: BenchmarkKind
    source: str
    source_url: Optional[str] = None
    low: Optional[float] = None
    high: Optional[float] = None
    target: Optional[float] = None


@dataclass
class Moment:
    """A clickable point or span in the recording."""
    start_sec: float
    end_sec: Optional[float] = None
    note: str = ""


@dataclass
class Metric:
    key: str
    label: str
    unit: str
    value: Optional[float]
    interpretation: Interpretation
    benchmark: Benchmark
    per_speaker: dict[str, float] = field(default_factory=dict)
    evidence: list[Moment] = field(default_factory=list)
    # Set when the measurement could not be made. `value` is then None and the UI must
    # say so rather than render a zero.
    unavailable_reason: Optional[str] = None
    method: str = ""


@dataclass
class SpeakerSummary:
    id: str
    role: Literal["coach", "client", "unknown"]
    speaking_sec: float
    turn_count: int
    word_count: int


@dataclass
class RoleAssignment:
    """How the worker decided which diarized cluster is the coach.

    Diarization returns anonymous clusters. Nothing in the audio says which one is the
    coach, so this is a stated heuristic with a stated margin — surfaced to the operator
    so they can flip it, not hidden behind a confident-looking label.
    """
    coach_speaker_id: Optional[str]
    method: str
    margin: float
    confident: bool


@dataclass
class Turn:
    speaker: str
    start: float
    end: float


@dataclass
class Utterance:
    """What was said in one turn, so a timestamp in the report can quote itself.

    Present only when a recording was uploaded. The TRANSCRIPT tab still scores the
    operator's own pasted transcript — this one exists to caption the tone evidence, not
    to replace it.
    """
    speaker: str
    start: float
    end: float
    text: str


@dataclass
class DeliveryReport:
    version: int
    media: dict[str, Any]
    speakers: list[SpeakerSummary]
    role_assignment: RoleAssignment
    metrics: list[Metric]
    turns: list[Turn]
    utterances: list[Utterance]
    notes: list[str]
    compute: dict[str, Any]

    def to_json(self) -> dict[str, Any]:
        """Emit camelCase.

        Python writes snake_case and the TypeScript app reads camelCase. Converting here
        rather than in the app means there is exactly one place the two conventions meet,
        and `src/delivery/types.ts` can mirror this file field for field.
        """
        return _camel(asdict(self))


def _camel(value: Any) -> Any:
    if isinstance(value, dict):
        return {_camel_key(k): _camel(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_camel(v) for v in value]
    return value


def _camel_key(key: str) -> str:
    head, *rest = key.split("_")
    return head + "".join(w[:1].upper() + w[1:] for w in rest)


# ── Benchmarks ───────────────────────────────────────────────────────────────
#
# Each entry was traced to a primary source during research, or is explicitly marked as
# having none. The widely-quoted Gong line about top reps using "38% more confident tonal
# inflections" is deliberately absent: no primary methodology page defines the term.

BENCHMARKS: dict[str, Benchmark] = {
    "talk_ratio": Benchmark(
        kind="range",
        low=40.0,
        high=60.0,
        source=(
            "Gong analysis of 326,000 B2B sales calls of 10 minutes or more: winning "
            "deals averaged 57% rep talk time against 62% for lost deals, on a 60/40 "
            "population average. Sales, not coaching, so treat the band as a prompt to "
            "look rather than a pass mark."
        ),
        source_url="https://www.gong.io/blog/talk-to-listen-conversion-ratio",
    ),
    "longest_monologue": Benchmark(
        kind="none",
        source=(
            "No published benchmark exists for coaching calls. Reported because it is "
            "concrete and memorable — 'you spoke for 6m40s straight from 14:02' is "
            "actionable in a way an average is not."
        ),
    ),
    "wpm": Benchmark(
        kind="range",
        low=130.0,
        high=170.0,
        source=(
            "Conventional English conversational range. The evidence base establishes "
            "that speech rate shifts perceived competence, credibility and "
            "trustworthiness (effort code; Rosenberg & Hirschberg on charisma) but does "
            "not fix a target number, so these bounds are a convention, not a finding."
        ),
        source_url="https://pmc.ncbi.nlm.nih.gov/articles/PMC11931160/",
    ),
    "pause_after_question": Benchmark(
        kind="target",
        target=2.0,
        source=(
            "Coaching convention, not a research finding: leave the client roughly two "
            "seconds after asking before filling the silence. Pause use is an "
            "established charisma and persuasion cue, but no study fixes two seconds."
        ),
        source_url="https://www.cs.columbia.edu/speech/PaperFiles/2008/science.pdf",
    ),
    "long_pause_count": Benchmark(
        kind="none",
        source="No benchmark. Reported alongside pause_after_question for context.",
    ),
    "question_rate": Benchmark(
        kind="none",
        source=(
            "No published rate exists. Detection is recall-bound at roughly 0.70–0.78 F1 "
            "from punctuation alone, so treat the count as a floor, not an exact figure."
        ),
    ),
    "interruptions": Benchmark(
        kind="none",
        source=(
            "No benchmark. Counted as: the other speaker starts while this speaker is "
            "still going and this speaker stops shortly after. Single-channel audio "
            "makes overlap detection approximate — separate per-participant streams "
            "would make it exact."
        ),
    ),
    "energy_variance": Benchmark(
        kind="none",
        source=(
            "No benchmark. Measured after EBU R128 loudness normalisation so recording "
            "level cannot masquerade as delivery. Compare a coach against their own "
            "other calls, never against another person."
        ),
        source_url="https://tech.ebu.ch/docs/r/r128.pdf",
    ),
    "pitch_variance": Benchmark(
        kind="none",
        source=(
            "No cross-speaker benchmark is legitimate: male and female median F0 differ "
            "by roughly an octave, so a raw-Hz threshold would encode sex rather than "
            "delivery. Reported in semitones against each speaker's OWN median, which "
            "makes it comparable only within one person. Van Zant & Berger found pitch "
            "variability both displayed under deliberate paralinguistic effort and "
            "linked to persuasion."
        ),
    ),
}
