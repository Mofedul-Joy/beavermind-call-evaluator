import type { ReactNode } from "react";
import { muted } from "./theme";

/**
 * Same typography as the app-wide `.micro-label` (globals.css), reproduced locally.
 * That class's color is a fixed light-mode token with no dark counterpart, which reads
 * under 4.5:1 on this tab's dark card — so PRESENCE carries its own dark-aware muted color.
 */
export function MicroLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] leading-tight font-semibold tracking-[0.08em] uppercase ${muted} ${className}`}>
      {children}
    </p>
  );
}
