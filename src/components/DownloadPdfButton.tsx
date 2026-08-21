"use client";

import { useEffect, useRef, useState } from "react";
import { pdfFilename } from "@/lib/format";
import { Download } from "./Icons";

type State = "idle" | "working" | "failed";

/**
 * Downloads the report without leaving it.
 *
 * A plain `<a href>` to the API route navigated the whole tab: the reader lost the page
 * they were reading, waited on a blank screen for eight seconds while puppeteer rendered,
 * and landed in the browser's PDF viewer rather than with a file. Fetching the body here
 * and saving the blob keeps the reader exactly where they were.
 *
 * The wait is the real design problem — the route boots Chromium, loads /print/[id] and
 * waits on network idle, so several seconds pass with nothing to look at. The button says
 * so rather than pretending: it names the work ("Rendering…"), holds a spinner that is the
 * same arc as the wait screen's, and is disabled while it runs so a second click cannot
 * queue a second Chromium.
 */
export function DownloadPdfButton({ runId, clientName }: { runId: string; clientName: string | null }) {
  const [state, setState] = useState<State>("idle");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function download() {
    if (state === "working") return;
    setState("working");
    try {
      const res = await fetch(`/api/pdf/${runId}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfFilename(clientName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* Revoked on the next tick, not immediately: Safari reads the object URL after the
         click returns, and revoking synchronously loses the file. */
      setTimeout(() => URL.revokeObjectURL(url), 0);

      if (alive.current) setState("idle");
    } catch {
      if (alive.current) setState("failed");
    }
  }

  const working = state === "working";

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={download}
        disabled={working}
        aria-busy={working}
        className="pill-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-[opacity,transform] duration-[var(--dur-feedback)] ease-[var(--ease-out-expo)] hover:opacity-85 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 disabled:active:scale-100"
      >
        {working ? <Spinner /> : <Download size={15} />}
        {working ? "Rendering…" : "Download PDF"}
      </button>

      {/* Announced, because the only other signal that the render failed is a button that
          went back to looking ready. */}
      <p role="status" aria-live="polite" className="text-xs text-muted empty:hidden">
        {working ? "Rendering the PDF, this takes a few seconds." : ""}
        {state === "failed" ? <span className="text-red-ink">Could not render the PDF. Try again.</span> : null}
      </p>
    </div>
  );
}

/** The wait screen's arc, at button scale, so the product has one shape for "working". */
function Spinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.8" />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="origin-center motion-safe:animate-spin"
      />
    </svg>
  );
}
