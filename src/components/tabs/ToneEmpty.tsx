import "./tone-tab.css";

export function ToneEmpty() {
  return (
    <div className="tone-tab tone-card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" style={{ color: "var(--tone-muted)" }}>
        <path d="M2 9v-2M5 12v-8M8 13.5v-11M11 12v-8M14 9v-2" />
      </svg>
      <p className="font-medium" style={{ color: "var(--tone-ink)" }}>
        No recording for this call
      </p>
      <p className="max-w-sm text-sm" style={{ color: "var(--tone-body)" }}>
        Vocal delivery metrics only exist for calls uploaded as a recording. This run was scored from a pasted
        transcript, so there is no audio to measure.
      </p>
    </div>
  );
}
