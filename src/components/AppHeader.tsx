import Link from "next/link";

/**
 * The mark: three slanted bars, cut from one path.
 *
 * Drawn rather than set in type or borrowed from an emoji, so it holds its weight beside
 * the wordmark at any size and prints cleanly into the PDF.
 */
function Mark({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className={className}>
      <g fill="currentColor">
        <path d="M6.4 2h2.7L5.3 16H2.6z" />
        <path d="M11.1 2h2.7L10 16H7.3z" />
        <path d="M15.3 2h2.7L14.2 16h-2.7z" opacity="0.35" />
      </g>
    </svg>
  );
}

export function AppHeader() {
  return (
    <header // print:hidden — /print/[id] is what puppeteer renders into the PDF, and a sticky
      // app bar would print onto page one of every report.
      className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2.5 px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-ink transition-opacity hover:opacity-70"
        >
          <Mark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">QC Evaluator</span>
        </Link>
        <span className="ml-auto hidden text-xs text-muted sm:block">Coaching &amp; kick-off calls</span>
      </div>
    </header>
  );
}
