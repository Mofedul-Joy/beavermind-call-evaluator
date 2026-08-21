import "./tone-tab.css";

export function ToneFailed({ error }: { error: string }) {
  return (
    <div className="tone-tab tone-card space-y-3 px-6 py-8">
      <div>
        <p className="tone-micro-label" style={{ color: "var(--tone-red-ink)" }}>
          Delivery analysis failed
        </p>
        <p className="mt-1.5 text-lg font-medium" style={{ color: "var(--tone-ink)" }}>
          {error}
        </p>
      </div>
      <p className="text-sm" style={{ color: "var(--tone-body)" }}>
        The transcript score above is unaffected — this only covers the vocal-delivery worker. Try
        re-uploading the recording, or continue without delivery metrics.
      </p>
    </div>
  );
}
