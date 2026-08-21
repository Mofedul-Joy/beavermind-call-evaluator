/**
 * Dark-mode pairs for PRESENCE's own surfaces. `globals.css`'s `--color-*` tokens are
 * fixed light values with no dark counterpart (the rest of the app is light-mode only),
 * so this tab carries its own literal dark values rather than depending on tokens that
 * don't flip. Tailwind's `dark:` variant here follows `prefers-color-scheme` — there is
 * no `.dark` class toggle in this app yet.
 */
import type { MetricTone } from "./format";

export const card = "bg-white dark:bg-[#1b1a17] border border-[#eae8e3] dark:border-[#332f28]";
export const ink = "text-[#111111] dark:text-[#f3f1ea]";
export const body = "text-[#57534e] dark:text-[#b7b2a6]";
export const muted = "text-[#73706b] dark:text-[#928d81]";
export const hairline = "border-[#eae8e3] dark:border-[#332f28]";
export const subtleFill = "bg-black/[.03] dark:bg-white/[.05]";

export const toneClasses: Record<MetricTone, { bg: string; text: string; dot: string }> = {
  green: {
    bg: "bg-[#eef6ee] dark:bg-[#132417]",
    text: "text-[#1e7d34] dark:text-[#6fcf8c]",
    dot: "bg-[#1e7d34] dark:bg-[#6fcf8c]",
  },
  amber: {
    bg: "bg-[#fbf1e2] dark:bg-[#2a2013]",
    text: "text-[#a15e09] dark:text-[#e2a355]",
    dot: "bg-[#a15e09] dark:bg-[#e2a355]",
  },
  neutral: {
    bg: "bg-black/5 dark:bg-white/[.06]",
    text: "text-[#73706b] dark:text-[#928d81]",
    dot: "bg-[#928d81]",
  },
};
