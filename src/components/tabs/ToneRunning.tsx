import "./tone-tab.css";

export function ToneRunning() {
  return (
    <div className="tone-tab tone-card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--tone-border)", borderTopColor: "var(--tone-ink)" }}
        aria-hidden="true"
      />
      <p className="font-medium" style={{ color: "var(--tone-ink)" }}>
        Measuring vocal delivery…
      </p>
      <p className="max-w-sm text-sm" style={{ color: "var(--tone-body)" }}>
        Diarizing speakers, transcribing, and measuring pitch and energy from the recording. This runs
        independently of scoring and usually takes five to seven minutes.
      </p>
    </div>
  );
}
