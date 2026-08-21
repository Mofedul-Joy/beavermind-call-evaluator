/**
 * The PRESENCE metric contract, browser side.
 *
 * There is no worker and no wire format for this tab — see `delivery/README.md`
 * ("PRESENCE is not here"): MediaPipe Tasks runs under WASM in the coach's own browser,
 * so the recording never uploads and Modal never sees it. `src/delivery/types.ts` (the
 * TONE contract, mirrored from `delivery/contract.py`) is still the shape this reuses:
 * `Interpretation`, `Benchmark` and `Moment` are imported unchanged rather than
 * reinvented, because the envelope a metric ships in is the committed contract, not the
 * specific keys inside it. Only the key set and the report shell are new here.
 *
 * The same three rules the TONE contract states apply verbatim:
 *   1. No composite score — a set of instruments, not a grade.
 *   2. No emotion, sentiment, confidence or engagement field. `smile_pct` is a landmark
 *      geometry measurement (corner-of-mouth elevation), reported the way the EU AI Act
 *      Art. 5(1)(f) / Recital 18 carve-out allows: "mere detection of readily apparent
 *      expressions, gestures or movements" — never a feeling attributed to the person.
 *   3. Every metric carries its own evidence and its own provenance. `benchmark.source`
 *      is always populated; `kind: 'none'` says honestly that no published number exists
 *      rather than inventing one.
 */

import type { Benchmark, Interpretation, Moment } from "@/delivery/types";

export const PRESENCE_CONTRACT_VERSION = 1;

export type PresenceMetricKey =
  | "facing_camera_pct"
  | "yaw_sd"
  | "framing_eyeline_pct"
  | "framing_headroom_pct"
  | "gesture_rate"
  | "posture_shoulder_tilt"
  | "posture_forward_lean"
  | "smile_pct";

export type PresenceMetric = {
  key: PresenceMetricKey;
  label: string;
  unit: string;
  /** null when the measurement could not be made. Render `unavailableReason`, not a zero. */
  value: number | null;
  interpretation: Interpretation;
  benchmark: Benchmark;
  /** Clickable moments in the recording that this number rests on. */
  evidence: Moment[];
  unavailableReason: string | null;
  /** How this number was arrived at — the MediaPipe task and the exact computation. */
  method: string;
};

/**
 * One of 6-8 real frames pulled from the recording, sanctioned for scene observations
 * only — lighting, backlight, camera height, background clutter, visibly reading
 * off-screen. Never generated, never a caption about the person's expression or manner.
 */
export type SceneFrame = {
  atSec: number;
  src: string;
  caption: string;
};

export type PresenceReport = {
  version: number;
  media: {
    durationSec: number;
    filename: string;
    /** width/height of the source frames MediaPipe actually ran on. */
    width: number;
    height: number;
  };
  metrics: PresenceMetric[];
  sceneFrames: SceneFrame[];
  /** Caveats that apply to the whole report — e.g. low-resolution input. Always surface these. */
  notes: string[];
  compute: {
    wallClockSec: number;
    stack: string;
  };
};

/**
 * Mirrors `DeliveryJob` in shape, adapted for a client-side analysis run: `'empty'` is a
 * state TONE has no equivalent for, because a recording that exists always has audio, but
 * a coach can decline to have their video analysed even after uploading one.
 */
export type PresenceJob =
  | { status: "empty" }
  | { status: "running" }
  | { status: "failed"; error: string }
  | { status: "done"; report: PresenceReport };

export const presenceMetricsByKey = (r: PresenceReport): Record<string, PresenceMetric> =>
  Object.fromEntries(r.metrics.map((m) => [m.key, m]));

/**
 * Whether a value sits outside its benchmark. Returns null when there is nothing to
 * compare against, which is the common case and must not render as "fine".
 */
export const outsidePresenceBenchmark = (m: PresenceMetric): boolean | null => {
  if (m.value === null) return null;
  const { kind, low, high, target } = m.benchmark;
  if (kind === "range" && low !== null && high !== null) return m.value < low || m.value > high;
  if (kind === "target" && target !== null) {
    return m.interpretation === "lower_is_better" ? m.value > target : m.value < target;
  }
  return null;
};
