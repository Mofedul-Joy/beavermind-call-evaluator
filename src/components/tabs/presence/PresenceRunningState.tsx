import { card, ink, body } from "./theme";

/** Mirrors `RunRunning`'s copy convention, adapted: this runs client-side, not on a worker. */
export function PresenceRunningState() {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-xl px-6 py-16 text-center ${card}`}>
      <span
        className={`h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-current dark:border-white/10 ${ink}`}
        aria-hidden="true"
      />
      <p className={`font-medium ${ink}`}>Reading body language in your browser…</p>
      <p className={`max-w-sm text-sm ${body}`}>
        This runs locally under WebAssembly, so it needs this tab open and takes a minute or two on a full call. The
        video is never uploaded — nothing leaves this device.
      </p>
    </div>
  );
}
