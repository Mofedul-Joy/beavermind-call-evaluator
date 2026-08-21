"""
Tests for the measurement logic. No models, no network, no Modal.

    python3 delivery/test_metrics.py

The ML stages can only be checked by running them against real audio. Everything that
decides what the report SAYS lives in `metrics.py` and is checked here, so a change to
the pipeline cannot quietly change a number without one of these failing.
"""

from __future__ import annotations

import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contract import Turn  # noqa: E402
from metrics import (  # noqa: E402
    LoudnessFrame,
    PitchFrame,
    Word,
    assign_roles,
    assign_words,
    build_report_body,
    energy_variation,
    interruptions,
    longest_monologue,
    pitch_variation_semitones,
    question_response_gaps,
    sentences,
    speaking_seconds,
    talk_ratio,
    words_per_minute,
)

COACH, CLIENT = "0", "1"


def w(text: str, start: float, end: float) -> Word:
    return Word(text=text, start=start, end=end)


class TestTimeline(unittest.TestCase):
    def test_talk_ratio_ignores_silence(self):
        # 30s of speech inside a 100s call: the ratio describes the speech, not the call.
        turns = [Turn(COACH, 0, 20), Turn(CLIENT, 50, 60)]
        self.assertEqual(talk_ratio(turns), {COACH: 66.7, CLIENT: 33.3})
        self.assertEqual(sum(talk_ratio(turns).values()), 100.0)

    def test_speaking_seconds_accumulates_across_turns(self):
        turns = [Turn(COACH, 0, 5), Turn(CLIENT, 5, 6), Turn(COACH, 6, 10)]
        self.assertEqual(speaking_seconds(turns)[COACH], 9.0)

    def test_backchannel_does_not_break_a_monologue(self):
        turns = [
            Turn(COACH, 0, 30),
            Turn(CLIENT, 30, 31),  # "mm-hm"
            Turn(COACH, 31, 60),
        ]
        dur, start, end = longest_monologue(turns, COACH)
        self.assertEqual((round(dur), start, end), (60, 0, 60))

    def test_a_real_turn_does_break_a_monologue(self):
        turns = [
            Turn(COACH, 0, 30),
            Turn(CLIENT, 30, 40),  # ten seconds is not backchannel
            Turn(COACH, 40, 55),
        ]
        dur, _, _ = longest_monologue(turns, COACH)
        self.assertEqual(round(dur), 30)

    def test_interruption_counted_only_when_the_other_speaker_yields(self):
        # Coach starts at 9.0 while client runs to 9.6 and the client stops. Interruption.
        yields = [Turn(CLIENT, 0, 9.6), Turn(COACH, 9.0, 20)]
        cuts, saw = interruptions(yields)
        self.assertEqual(len(cuts[COACH]), 1)
        self.assertTrue(saw)

        # Same overlap, but the client keeps going for another ten seconds. A collision.
        holds = [Turn(CLIENT, 0, 20), Turn(COACH, 9.0, 9.6)]
        cuts, saw = interruptions(holds)
        self.assertEqual(cuts, {})
        self.assertTrue(saw, "overlap existed even though nobody yielded")

    def test_no_overlap_anywhere_is_reported_as_such(self):
        clean = [Turn(COACH, 0, 10), Turn(CLIENT, 10, 20)]
        cuts, saw = interruptions(clean)
        self.assertEqual(cuts, {})
        self.assertFalse(saw, "a zero here is a lower bound, and the caller must know")


class TestWords(unittest.TestCase):
    def test_words_attach_by_midpoint_not_onset(self):
        # This word starts a hair before the turn boundary, as two models always disagree.
        turns = [Turn(COACH, 0, 5), Turn(CLIENT, 5, 10)]
        got = assign_words([w("right.", 4.95, 5.6)], turns)
        self.assertIn(CLIENT, got)
        self.assertNotIn(COACH, got)

    def test_wpm_uses_speaking_time_not_call_length(self):
        words = [w("x", i * 0.4, i * 0.4 + 0.3) for i in range(60)]
        self.assertEqual(words_per_minute(words, speaking_sec=30.0), 120.0)
        self.assertEqual(words_per_minute(words, speaking_sec=60.0), 60.0)

    def test_question_detected_from_punctuation(self):
        s = sentences([w("What", 0, 0.3), w("brings", 0.3, 0.6), w("you", 0.6, 0.8), w("here?", 0.8, 1.2)])
        self.assertTrue(s[0].is_question)

    def test_question_detected_when_asr_punctuated_it_as_a_statement(self):
        s = sentences([w("How", 0, 0.3), w("did", 0.3, 0.5), w("that", 0.5, 0.8), w("go.", 0.8, 1.2)])
        self.assertTrue(s[0].is_question, "recall is the binding constraint, so both detectors run")

    def test_statement_is_not_a_question(self):
        s = sentences([w("We", 0, 0.3), w("start", 0.3, 0.6), w("Monday.", 0.6, 1.0)])
        self.assertFalse(s[0].is_question)

    def test_a_self_answered_question_is_separated_from_the_gaps(self):
        turns = [Turn(COACH, 0, 5), Turn(COACH, 5.4, 9), Turn(CLIENT, 9, 12)]
        qs = sentences([w("Why", 0, 0.4), w("now?", 0.4, 5.0)])
        gaps, self_answered = question_response_gaps(qs, turns, COACH)
        self.assertEqual(gaps, [], "the coach spoke next, so this is not a response gap")
        self.assertEqual(len(self_answered), 1)

    def test_a_real_response_gap_is_measured(self):
        turns = [Turn(COACH, 0, 5), Turn(CLIENT, 7.5, 12)]
        qs = sentences([w("Why", 0, 0.4), w("now?", 0.4, 5.0)])
        gaps, self_answered = question_response_gaps(qs, turns, COACH)
        self.assertEqual(gaps, [(2.5, 5.0)])
        self.assertEqual(self_answered, [])


class TestAcoustics(unittest.TestCase):
    def _sine_pitch(self, base_hz: float, speaker_turn: Turn, n: int = 120):
        """An F0 track that swings half an octave either side of `base_hz`."""
        return [
            PitchFrame(
                time=speaker_turn.start + i * 0.05,
                hz=base_hz * (2 ** (0.5 * math.sin(i * math.pi / 10))),
                voiced=True,
            )
            for i in range(n)
        ]

    def test_pitch_variation_is_identical_for_voices_an_octave_apart(self):
        """The discrimination test.

        Two speakers with the same relative pitch movement, one an octave below the
        other, must score the same. If this ever fails, the metric has started encoding
        the speaker's sex instead of their delivery.
        """
        low_turn, high_turn = Turn(COACH, 0, 10), Turn(CLIENT, 20, 30)
        low = pitch_variation_semitones(self._sine_pitch(100.0, low_turn), [low_turn], COACH)
        high = pitch_variation_semitones(self._sine_pitch(200.0, high_turn), [high_turn], CLIENT)
        self.assertIsNotNone(low)
        self.assertEqual(low, high)

    def test_unvoiced_frames_are_ignored(self):
        turn = Turn(COACH, 0, 10)
        frames = self._sine_pitch(100.0, turn)
        frames += [PitchFrame(time=turn.start + i * 0.05, hz=0.0, voiced=False) for i in range(200)]
        self.assertIsNotNone(pitch_variation_semitones(frames, [turn], COACH))

    def test_pitch_is_none_when_there_is_not_enough_voiced_audio(self):
        turn = Turn(COACH, 0, 10)
        frames = [PitchFrame(time=0.1 * i, hz=110.0, voiced=True) for i in range(5)]
        self.assertIsNone(pitch_variation_semitones(frames, [turn], COACH))

    def test_energy_variation_gates_silence_inside_a_turn(self):
        turn = Turn(COACH, 0, 10)
        speech = [LoudnessFrame(i * 0.1, -23.0 + (i % 3)) for i in range(50)]
        silence = [LoudnessFrame(5 + i * 0.1, -70.0) for i in range(50)]
        with_silence = energy_variation(speech + silence, [turn], COACH)
        without = energy_variation(speech, [turn], COACH)
        self.assertEqual(with_silence, without, "a long pause is not energy variation")


class TestRoles(unittest.TestCase):
    def test_the_question_asker_is_the_coach_even_when_they_talk_less(self):
        turns = [Turn(COACH, 0, 5), Turn(CLIENT, 5, 100)]
        by_speaker = {
            COACH: [w("What", 0, 0.3), w("changed?", 0.3, 1.0), w("Why", 1.2, 1.5), w("now?", 1.5, 2.0)],
            CLIENT: [w("Well", 5, 5.4), w("it", 5.4, 5.6), w("started.", 5.6, 6.2)],
        }
        roles = assign_roles(turns, by_speaker)
        self.assertEqual(roles.coach_speaker_id, COACH)

    def test_a_tie_falls_back_to_talk_time_and_says_it_is_not_confident(self):
        turns = [Turn(COACH, 0, 90), Turn(CLIENT, 90, 100)]
        by_speaker = {COACH: [w("Okay.", 0, 0.5)], CLIENT: [w("Sure.", 90, 90.5)]}
        roles = assign_roles(turns, by_speaker)
        self.assertEqual(roles.coach_speaker_id, COACH)
        self.assertFalse(roles.confident)


class TestReportBody(unittest.TestCase):
    def _fixture(self):
        turns = [Turn(COACH, 0, 20), Turn(CLIENT, 22, 40), Turn(COACH, 40, 50)]
        words = (
            [w("What", 0, 0.4), w("do", 0.4, 0.6), w("you", 0.6, 0.9), w("want?", 0.9, 20.0)]
            + [w("I", 22, 22.3), w("want", 22.3, 22.8), w("to", 22.8, 23.0), w("run.", 23.0, 40.0)]
            + [w("Good.", 40, 41.0)]
        )
        pitch = [
            PitchFrame(t * 0.05, 110 * (2 ** (0.2 * math.sin(t))), True) for t in range(400)
        ]
        loud = [LoudnessFrame(t * 0.1, -23.0 + (t % 5) * 0.5) for t in range(500)]
        return build_report_body(turns, words, pitch, loud, duration_sec=60.0)

    def test_produces_every_metric_with_a_sourced_benchmark(self):
        _, _, metrics, _ = self._fixture()
        keys = {m.key for m in metrics}
        self.assertEqual(
            keys,
            {
                "talk_ratio",
                "longest_monologue",
                "wpm",
                "question_rate",
                "pause_after_question",
                "long_pause_count",
                "interruptions",
                "energy_variance",
                "pitch_variance",
            },
        )
        for m in metrics:
            self.assertTrue(m.benchmark.source, f"{m.key} has no provenance")
            self.assertTrue(m.method, f"{m.key} does not say how it was measured")

    def test_no_metric_is_an_emotion_label(self):
        """EU AI Act Art. 5(1)(f). The contract must make this unrepresentable."""
        _, _, metrics, _ = self._fixture()
        banned = ("emotion", "sentiment", "mood", "confiden", "engage", "anxious", "stress")
        for m in metrics:
            blob = f"{m.key} {m.label} {m.unit}".lower()
            for word in banned:
                self.assertNotIn(word, blob, f"{m.key} reads as an inferred inner state")

    def test_there_is_no_composite_score(self):
        _, _, metrics, _ = self._fixture()
        self.assertNotIn("score", {m.key for m in metrics})
        self.assertNotIn("overall", {m.key for m in metrics})

    def test_an_unmeasurable_metric_reports_a_reason_instead_of_a_zero(self):
        turns = [Turn(COACH, 0, 20)]
        _, _, metrics, _ = build_report_body(turns, [], [], [], duration_sec=20.0)
        pitch = next(m for m in metrics if m.key == "pitch_variance")
        self.assertIsNone(pitch.value)
        self.assertTrue(pitch.unavailable_reason)

    def test_speakers_are_labelled_and_counted(self):
        speakers, roles, _, _ = self._fixture()
        self.assertEqual({s.role for s in speakers}, {"coach", "client"})
        self.assertEqual(roles.coach_speaker_id, COACH)



class TestWireFormat(unittest.TestCase):
    """The report crosses a language boundary, so the shape is tested, not assumed."""

    def _report(self):
        from contract import CONTRACT_VERSION, DeliveryReport
        from metrics import utterances

        turns = [Turn(COACH, 0, 20), Turn(CLIENT, 22, 40)]
        words = [w("What", 0, 0.4), w("now?", 0.4, 20.0), w("Running.", 22, 23)]
        speakers, roles, metrics, notes = build_report_body(turns, words, [], [], 60.0)
        return DeliveryReport(
            version=CONTRACT_VERSION,
            media={"duration_sec": 60.0, "has_video": False},
            speakers=speakers,
            role_assignment=roles,
            metrics=metrics,
            turns=turns,
            utterances=utterances(words, turns),
            notes=notes,
            compute={"wall_clock_sec": 1.0},
        ).to_json()

    def test_every_key_is_camel_case(self):
        def walk(node, path=""):
            if isinstance(node, dict):
                for k, v in node.items():
                    self.assertNotIn("_", k, f"{path}.{k} reached the wire as snake_case")
                    walk(v, f"{path}.{k}")
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    walk(v, f"{path}[{i}]")

        walk(self._report())

    def test_it_survives_a_json_round_trip(self):
        import json

        r = self._report()
        self.assertEqual(json.loads(json.dumps(r)), r)
        self.assertEqual(r["roleAssignment"]["coachSpeakerId"], COACH)
        self.assertIn("sourceUrl", r["metrics"][0]["benchmark"])
        self.assertIn("unavailableReason", r["metrics"][0])
        self.assertEqual(r["utterances"][0], {"speaker": COACH, "start": 0, "end": 20, "text": "What now?"})

    def test_the_typescript_mirror_declares_every_key_we_emit(self):
        """Guards the language boundary.

        The app reads `src/delivery/types.ts` by hand-written type, not by codegen, so
        this walks a real report and fails if the worker emits a field TypeScript has
        never heard of. Cheaper than a generator and it catches the same drift.
        """
        ts = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "delivery", "types.ts")
        if not os.path.exists(ts):
            self.skipTest("the app's type mirror is not present in this worktree")
        declared = open(ts, encoding="utf-8").read()

        seen: set[str] = set()
        # `perSpeaker` is keyed by diarization cluster id, so its keys are data, not fields.
        FREE_FORM = {"perSpeaker"}

        def walk(node, parent=""):
            if isinstance(node, dict):
                for k, v in node.items():
                    if parent not in FREE_FORM:
                        seen.add(k)
                    walk(v, k)
            elif isinstance(node, list):
                for v in node:
                    walk(v, parent)

        walk(self._report())
        missing = sorted(k for k in seen if k not in declared)
        self.assertEqual(missing, [], "these fields reach the app with no TypeScript type")

    def test_the_typescript_mirror_lists_every_metric_key(self):
        ts = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "delivery", "types.ts")
        if not os.path.exists(ts):
            self.skipTest("the app's type mirror is not present in this worktree")
        declared = open(ts, encoding="utf-8").read()
        for m in self._report()["metrics"]:
            self.assertIn(f"'{m['key']}'", declared, f"{m['key']} is not in DeliveryMetricKey")


class TestUtterances(unittest.TestCase):
    def test_a_word_is_never_printed_under_two_speakers(self):
        """Diarized turns overlap, so this is not hypothetical.

        On a recording with one dominant voice the segmenter emits short phantom
        fragments of the other speaker on top of the real one. Without single-claim
        attribution the same words appear in both transcript lines.
        """
        from metrics import utterances

        turns = [Turn(COACH, 0, 10), Turn(CLIENT, 4, 5)]  # the phantom sits inside the real turn
        words = [w("we", 4.2, 4.4), w("start", 4.4, 4.7), w("Monday.", 4.7, 4.9)]
        lines = utterances(words, turns)
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0].speaker, COACH)
        self.assertEqual(lines[0].text, "we start Monday.")

    def test_turns_with_no_words_are_dropped(self):
        from metrics import utterances

        turns = [Turn(COACH, 0, 10), Turn(CLIENT, 20, 30)]
        self.assertEqual(len(utterances([w("hello.", 1, 2)], turns)), 1)

if __name__ == "__main__":
    unittest.main(verbosity=2)
