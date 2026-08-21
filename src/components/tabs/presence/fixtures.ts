/**
 * Two fixture reports so both a strong and a weak reading render: `PRESENCE_STRONG` and
 * `PRESENCE_WEAK`. `PRESENCE_WEAK` also exercises the `value: null` /
 * `unavailableReason` path and an out-of-benchmark reading on every interpretation kind.
 *
 * No real recording exists in this build (that pipeline is `wt-capture`'s). The scene
 * frames below point at hand-authored SVG placeholders under `public/presence-fixtures/`,
 * each watermarked "FIXTURE PLACEHOLDER — not a real frame" so nothing here is mistaken
 * for a real photo standing in for one. See `NOTES-presence.md`.
 */

import type { PresenceReport } from "./types";

const EVEN = "/presence-fixtures/frame-even.svg";
const BACKLIT = "/presence-fixtures/frame-backlit.svg";
const LOW_ANGLE = "/presence-fixtures/frame-low-angle.svg";
const CLUTTERED = "/presence-fixtures/frame-cluttered.svg";

export const PRESENCE_STRONG: PresenceReport = {
  version: 1,
  media: { durationSec: 1842, filename: "sample-strong-presence.mp4", width: 1920, height: 1080 },
  notes: [],
  compute: { wallClockSec: 6.4, stack: "MediaPipe Tasks (Face/Pose/Hand Landmarker), WASM, in-browser" },
  sceneFrames: [
    { atSec: 40, src: EVEN, caption: "Camera at eye height, even front-fill light, plain wall behind." },
    { atSec: 310, src: EVEN, caption: "Same framing held through the first ten minutes." },
    { atSec: 660, src: EVEN, caption: "Desk clear of clutter; light source unchanged." },
    { atSec: 980, src: EVEN, caption: "No off-screen reading — eyes stay in the frame plane." },
    { atSec: 1200, src: EVEN, caption: "Consistent headroom, no reframing during the call." },
    { atSec: 1560, src: EVEN, caption: "Background unchanged into the close." },
  ],
  metrics: [
    {
      key: "facing_camera_pct",
      label: "Facing camera",
      unit: "%",
      value: 92,
      interpretation: "higher_is_better",
      benchmark: {
        kind: "target",
        target: 80,
        low: null,
        high: null,
        source:
          "Practical target for a remote coaching call, not a clinical threshold — no published study fixes a number for camera-facing time specifically.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "MediaPipe Face Landmarker: yaw within ±20° of the camera axis on the 478-point mesh, sampled at 5 fps. Percentage of sampled frames a face was detected facing the camera.",
    },
    {
      key: "yaw_sd",
      label: "Head yaw, spread",
      unit: "deg",
      value: 6.4,
      interpretation: "band",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source:
          "No published benchmark for head-yaw variability on a coaching call. Reported as context: near-zero suggests a locked frame or notes reading; very high suggests restlessness.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "Standard deviation of per-frame head yaw (degrees), across all sampled frames with a detected face.",
    },
    {
      key: "framing_eyeline_pct",
      label: "Eye line height",
      unit: "%",
      value: 37,
      interpretation: "band",
      benchmark: {
        kind: "range",
        low: 33,
        high: 45,
        target: null,
        source: "Rule-of-thirds framing convention used in video-presenting guides, not a study finding.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "Vertical position of the midpoint between the two eye landmarks, as a percentage of frame height from the top, averaged across sampled frames.",
    },
    {
      key: "framing_headroom_pct",
      label: "Headroom",
      unit: "%",
      value: 9,
      interpretation: "band",
      benchmark: {
        kind: "range",
        low: 5,
        high: 15,
        target: null,
        source: "Standard headroom convention from video-presenting guides.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "Vertical gap between the top of the detected face bounding box and the top of the frame, as a percentage of frame height, averaged across sampled frames.",
    },
    {
      key: "gesture_rate",
      label: "Gesture rate",
      unit: "/min",
      value: 14,
      interpretation: "band",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source: "No published benchmark for gesture rate on a coaching call.",
        sourceUrl: null,
      },
      evidence: [{ startSec: 612, endSec: 640, note: "A run of hand movement while explaining the plan" }],
      unavailableReason: null,
      method:
        "MediaPipe Hand Landmarker: a gesture is counted when a wrist landmark's frame-to-frame displacement exceeds 6% of frame width within a half-second window. Counted per minute of camera-on time.",
    },
    {
      key: "posture_shoulder_tilt",
      label: "Shoulder tilt",
      unit: "deg",
      value: 1.8,
      interpretation: "lower_is_better",
      benchmark: {
        kind: "target",
        target: 5,
        low: null,
        high: null,
        source: "Postural-symmetry convention: a level shoulder line, not a study finding.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "MediaPipe Pose Landmarker: angle of the line between the two shoulder landmarks from horizontal, averaged across sampled frames with a detected pose.",
    },
    {
      key: "posture_forward_lean",
      label: "Forward lean",
      unit: "deg",
      value: 4,
      interpretation: "context_only",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source: "No benchmark — both a rigid and a looming posture are worth a note, so no direction is claimed.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "MediaPipe Pose Landmarker: angle of the shoulder-to-hip line from vertical in the camera's depth axis, averaged across sampled frames.",
    },
    {
      key: "smile_pct",
      label: "Smile",
      unit: "%",
      value: 41,
      interpretation: "context_only",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source:
          "Reported as a landmark geometry measurement (corner-of-mouth elevation), not an emotion or engagement score — EU AI Act Art. 5(1)(f) prohibits that inference in a workplace context.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "MediaPipe Face Landmarker blendshape score `mouthSmile`, averaged across both corners. Percentage of sampled frames above 0.4.",
    },
  ],
};

export const PRESENCE_WEAK: PresenceReport = {
  version: 1,
  media: { durationSec: 1605, filename: "sample-weak-presence.mp4", width: 854, height: 480 },
  notes: [
    "Source video is 480p at 15fps — landmark confidence is reduced across every metric below. Treat framing and posture numbers as indicative only.",
    "A window behind the subject backlit most of the call, which is also why forward lean could not be measured for a majority of frames.",
  ],
  compute: { wallClockSec: 5.1, stack: "MediaPipe Tasks (Face/Pose/Hand Landmarker), WASM, in-browser" },
  sceneFrames: [
    { atSec: 20, src: BACKLIT, caption: "Bright window directly behind the subject silhouettes the face." },
    { atSec: 240, src: LOW_ANGLE, caption: "Camera sits below eye level — looking up at the subject." },
    { atSec: 480, src: CLUTTERED, caption: "Shelving and loose items visible behind the subject." },
    { atSec: 690, src: BACKLIT, caption: "Backlighting unchanged through the middle of the call." },
    { atSec: 900, src: LOW_ANGLE, caption: "Same low camera angle held for the rest of the call." },
    { atSec: 1140, src: CLUTTERED, caption: "Papers added to the desk mid-call." },
    { atSec: 1400, src: BACKLIT, caption: "Subject leans out of frame toward a second screen." },
  ],
  metrics: [
    {
      key: "facing_camera_pct",
      label: "Facing camera",
      unit: "%",
      value: 54,
      interpretation: "higher_is_better",
      benchmark: {
        kind: "target",
        target: 80,
        low: null,
        high: null,
        source:
          "Practical target for a remote coaching call, not a clinical threshold — no published study fixes a number for camera-facing time specifically.",
        sourceUrl: null,
      },
      evidence: [{ startSec: 1400, endSec: 1540, note: "Longest off-camera stretch — turned toward a second screen" }],
      unavailableReason: null,
      method:
        "MediaPipe Face Landmarker: yaw within ±20° of the camera axis on the 478-point mesh, sampled at 5 fps. Percentage of sampled frames a face was detected facing the camera.",
    },
    {
      key: "yaw_sd",
      label: "Head yaw, spread",
      unit: "deg",
      value: 18.9,
      interpretation: "band",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source:
          "No published benchmark for head-yaw variability on a coaching call. Reported as context: near-zero suggests a locked frame or notes reading; very high suggests restlessness.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "Standard deviation of per-frame head yaw (degrees), across all sampled frames with a detected face.",
    },
    {
      key: "framing_eyeline_pct",
      label: "Eye line height",
      unit: "%",
      value: 61,
      interpretation: "band",
      benchmark: {
        kind: "range",
        low: 33,
        high: 45,
        target: null,
        source: "Rule-of-thirds framing convention used in video-presenting guides, not a study finding.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "Vertical position of the midpoint between the two eye landmarks, as a percentage of frame height from the top, averaged across sampled frames.",
    },
    {
      key: "framing_headroom_pct",
      label: "Headroom",
      unit: "%",
      value: 24,
      interpretation: "band",
      benchmark: {
        kind: "range",
        low: 5,
        high: 15,
        target: null,
        source: "Standard headroom convention from video-presenting guides.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "Vertical gap between the top of the detected face bounding box and the top of the frame, as a percentage of frame height, averaged across sampled frames.",
    },
    {
      key: "gesture_rate",
      label: "Gesture rate",
      unit: "/min",
      value: 2,
      interpretation: "band",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source: "No published benchmark for gesture rate on a coaching call.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "MediaPipe Hand Landmarker: a gesture is counted when a wrist landmark's frame-to-frame displacement exceeds 6% of frame width within a half-second window. Counted per minute of camera-on time.",
    },
    {
      key: "posture_shoulder_tilt",
      label: "Shoulder tilt",
      unit: "deg",
      value: 9.4,
      interpretation: "lower_is_better",
      benchmark: {
        kind: "target",
        target: 5,
        low: null,
        high: null,
        source: "Postural-symmetry convention: a level shoulder line, not a study finding.",
        sourceUrl: null,
      },
      evidence: [{ startSec: 900, endSec: null, note: "Leaning toward the low camera for most of the second half" }],
      unavailableReason: null,
      method:
        "MediaPipe Pose Landmarker: angle of the line between the two shoulder landmarks from horizontal, averaged across sampled frames with a detected pose.",
    },
    {
      key: "posture_forward_lean",
      label: "Forward lean",
      unit: "deg",
      value: null,
      interpretation: "context_only",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source: "No benchmark — both a rigid and a looming posture are worth a note, so no direction is claimed.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason:
        "Pose landmarker confidence stayed below threshold for 61% of sampled frames — the window backlight silhouettes the torso. No forward-lean estimate is reported rather than guessed.",
      method:
        "MediaPipe Pose Landmarker: angle of the shoulder-to-hip line from vertical in the camera's depth axis, averaged across sampled frames.",
    },
    {
      key: "smile_pct",
      label: "Smile",
      unit: "%",
      value: 6,
      interpretation: "context_only",
      benchmark: {
        kind: "none",
        low: null,
        high: null,
        target: null,
        source:
          "Reported as a landmark geometry measurement (corner-of-mouth elevation), not an emotion or engagement score — EU AI Act Art. 5(1)(f) prohibits that inference in a workplace context.",
        sourceUrl: null,
      },
      evidence: [],
      unavailableReason: null,
      method:
        "MediaPipe Face Landmarker blendshape score `mouthSmile`, averaged across both corners. Percentage of sampled frames above 0.4.",
    },
  ],
};
