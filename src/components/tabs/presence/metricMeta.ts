import type { ComponentType } from "react";
import type { PresenceMetricKey } from "./types";
import { CameraIcon, CompassIcon, FrameIcon, HandIcon, PostureIcon, SmileIcon } from "./icons";

/** Groups the 8 keys into the 6 named categories from the brief, for the summary strip. */
export const METRIC_ICON: Record<PresenceMetricKey, ComponentType<{ size?: number; className?: string }>> = {
  facing_camera_pct: CameraIcon,
  yaw_sd: CompassIcon,
  framing_eyeline_pct: FrameIcon,
  framing_headroom_pct: FrameIcon,
  gesture_rate: HandIcon,
  posture_shoulder_tilt: PostureIcon,
  posture_forward_lean: PostureIcon,
  smile_pct: SmileIcon,
};

export const METRIC_ORDER: PresenceMetricKey[] = [
  "facing_camera_pct",
  "yaw_sd",
  "framing_eyeline_pct",
  "framing_headroom_pct",
  "gesture_rate",
  "posture_shoulder_tilt",
  "posture_forward_lean",
  "smile_pct",
];
