export function RunRunning() {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" aria-hidden="true" />
      <p className="font-medium text-ink">Scoring this call against its rubric…</p>
      <p className="max-w-sm text-sm text-body">
        This takes a minute or two. You can close this tab — the run keeps going, and this page will
        pick up exactly where it left off when you come back to this URL.
      </p>
    </div>
  );
}
