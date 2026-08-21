"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { SceneFrame } from "./types";
import { formatMmSs } from "./format";
import { card, hairline, ink, body, muted } from "./theme";
import { MicroLabel } from "./MicroLabel";

/**
 * The one sanctioned use of raw frames (D11 / DECISIONS.md): 6-8 real stills, captioned
 * for the scene only — lighting, backlight, camera height, clutter, off-screen reading.
 * Never a caption about the person's expression, mood or manner; the copy here says so
 * out loud rather than leaving it as an internal rule nobody reading the UI can see.
 *
 * No real recording exists in this fixture build, so every frame below is a hand-drawn
 * SVG placeholder, watermarked as such — never AI-generated, never presented as real.
 */
export function SceneFramesStrip({ frames }: { frames: SceneFrame[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (frames.length === 0) return null;

  return (
    <div className={`rounded-xl px-4 py-4 ${card}`}>
      <div className="flex items-baseline justify-between gap-2">
        <MicroLabel>Scene frames</MicroLabel>
        <span className={`text-xs ${muted}`}>{frames.length} frames · scene only, never the person</span>
      </div>
      <p className={`mt-1.5 text-sm leading-relaxed ${body}`}>
        Pulled straight from the recording — lighting, camera height, background, whether the coach appears to be
        reading off-screen. Never used to judge how the person looks or acts.
      </p>

      <div className="scroll-x mt-3 flex gap-2.5">
        {frames.map((f, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
            aria-label={`${formatMmSs(f.atSec)} — ${f.caption}`}
            className={`group relative w-28 shrink-0 overflow-hidden rounded-lg border ${hairline}`}
          >
            <img src={f.src} alt="" className="aspect-video w-full object-cover" />
            <span className={`absolute right-1 bottom-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white tabular-nums`}>
              {formatMmSs(f.atSec)}
            </span>
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div className={`mt-3 rounded-lg px-4 py-3 text-sm leading-relaxed ${body}`}>
          <span className={`mr-1.5 font-medium tabular-nums ${ink}`}>{formatMmSs(frames[openIndex].atSec)}</span>
          {frames[openIndex].caption}
        </div>
      )}
    </div>
  );
}
