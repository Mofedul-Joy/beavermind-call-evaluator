import "./tone-tab.css";

export function ToneQualityWarning({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="tone-chip-amber tone-fill flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm" style={{ background: "var(--tone-amber-bg)", color: "var(--tone-amber-ink)" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
        <path d="M8 1.5 15 14.5H1L8 1.5ZM8 6.5v3.25M8 12v.01" />
      </svg>
      <div className="space-y-1">
        {notes.map((note, i) => (
          <p key={i}>{note}</p>
        ))}
      </div>
    </div>
  );
}
