import { CameraIcon, LockIcon } from "./icons";
import { card, ink, body, muted } from "./theme";

/** No recording was uploaded for this run — a paste-only run never reaches this tab at all (D11). */
export function PresenceEmptyState() {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-xl px-6 py-16 text-center ${card}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${muted}`}>
        <CameraIcon size={20} />
      </span>
      <p className={`font-medium ${ink}`}>No recording for this run</p>
      <p className={`max-w-sm text-sm ${body}`}>
        PRESENCE reads body-language numbers from the call video. Upload a recording when starting a run to see it
        here.
      </p>
      <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
        <LockIcon size={13} />
        Analysis runs in your browser — the video never leaves this device.
      </p>
    </div>
  );
}
