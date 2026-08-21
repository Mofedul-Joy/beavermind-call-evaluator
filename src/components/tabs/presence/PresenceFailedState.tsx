import { card, ink, body, muted, toneClasses } from "./theme";
import { MicroLabel } from "./MicroLabel";

/** Mirrors `RunFailed`'s layout — same failure vocabulary, this tab's own causes (decode/WASM, not the model). */
export function PresenceFailedState({ error }: { error: string }) {
  const tone = toneClasses.amber;
  return (
    <div className={`space-y-3 rounded-xl px-6 py-8 ${card}`}>
      <div>
        <MicroLabel className={tone.text}>Presence analysis failed</MicroLabel>
        <p className={`mt-1.5 text-lg font-medium ${ink}`}>{error}</p>
      </div>
      <p className={`text-sm ${body}`}>
        The rest of this report is unaffected — TRANSCRIPT and TONE were scored independently.
      </p>
      <p className={`text-xs ${muted}`}>
        Common cause: the browser blocked WebAssembly or ran out of memory on a long video. Try a shorter recording
        or a different browser.
      </p>
    </div>
  );
}
