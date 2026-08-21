import { AlertIcon } from "./icons";
import { toneClasses } from "./theme";

/** D12's input-quality warning, ported from TONE's low-bitrate note to PRESENCE's own causes. */
export function QualityWarning({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  const tone = toneClasses.amber;

  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 ${tone.bg}`}>
      <AlertIcon className={`mt-0.5 ${tone.text}`} size={15} />
      <ul className={`space-y-1 text-sm leading-relaxed ${tone.text}`}>
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
