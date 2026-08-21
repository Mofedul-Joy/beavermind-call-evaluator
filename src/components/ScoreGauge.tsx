"use client";

import { useRef, useState } from "react";
import { bandTone } from "@/lib/format";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

const TONE_STROKE: Record<string, string> = {
  green: "#1e7d34",
  amber: "#b3690a",
  red: "#c22b2b",
  neutral: "#111111",
};

const SWEEP_MS = 1100;

/** Exponential ease-out. The arc covers two thirds of its travel in the first
 *  quarter of the time and then settles, the way a needle does when it hits the
 *  reading and stops. Linear would read as a loading bar; a spring would read as
 *  a toy, and this number is somebody's job. */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * The headline number.
 *
 * A semicircular arc rather than a full ring: the scale runs 0 to 100 in one direction,
 * and a half-circle says that where a closed ring implies a cycle. The track is the same
 * hairline grey as every border on the page, so the coloured arc is the only thing in the
 * component carrying meaning.
 *
 * It sweeps from zero on arrival. This is the one authored moment in the product — it is
 * the number the whole app exists to produce, and watching it travel tells you where it
 * landed on the scale, which a number printed in place does not. The numeral counts off
 * the same eased value as the arc, so the two can never disagree by a frame.
 *
 * The animation is an enhancement layered onto a finished render, never a way of getting
 * to one: `progress` starts at 1, so the server, the PDF and a browser with no JS all
 * paint the true score. The sweep only exists because a layout effect winds it back to 0
 * before the first paint.
 */
export function ScoreGauge({
  score,
  band,
  size = 232,
  animate = true,
}: {
  score: number;
  band: string;
  size?: number;
  animate?: boolean;
}) {
  const [progress, setProgress] = useState(1);
  const [waiting, setWaiting] = useState(true);
  const frame = useRef<number | undefined>(undefined);

  useIsomorphicLayoutEffect(() => {
    setWaiting(false);
    if (!animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setProgress(0);
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / SWEEP_MS);
      setProgress(easeOutExpo(t));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      setProgress(1);
    };
  }, [animate, score]);

  /* Between the server's paint and hydration the arc and numeral must not show the
     answer they are about to travel to. The stylesheet holds them at zero, but only
     when the flag in <head> says a script is coming to release them. */
  const prestart = animate && waiting;

  const r = 80;
  const cx = 100;
  const cy = 100;
  const circumference = Math.PI * r;
  const pct = (Math.max(0, Math.min(100, score)) / 100) * progress;
  const stroke = TONE_STROKE[bandTone(band)];
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg
      viewBox="0 0 200 116"
      width={size}
      height={(size * 116) / 200}
      role="img"
      aria-label={`Scored ${score} out of 100, band ${band}`}
      style={{ ["--gauge-full" as string]: circumference }}
    >
      <path d={arc} fill="none" stroke="#EAE8E3" strokeWidth="14" strokeLinecap="round" />
      <path
        d={arc}
        fill="none"
        stroke={stroke}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        data-gauge-arc={prestart ? "prestart" : undefined}
      />
      {/* aria-hidden because the counting numeral is the same fact as the label on
          the <svg>, and a live region here would read every intermediate value. */}
      <text
        x="100"
        y="94"
        textAnchor="middle"
        fontSize="46"
        fontWeight="600"
        letterSpacing="-2"
        fill="#111111"
        aria-hidden="true"
        data-prestart={prestart ? "" : undefined}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {Math.round(score * progress)}
      </text>
      <text x="100" y="112" textAnchor="middle" fontSize="12" letterSpacing="0.5" fill="#73706B">
        /100
      </text>
    </svg>
  );
}
