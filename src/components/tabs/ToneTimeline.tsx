"use client";

/**
 * The call's turn-boundary strip: one segment per `DeliveryTurn`, positioned by time and
 * colored by who's talking (coach vs. the other party — never the red/amber/green scale,
 * that's reserved for benchmark status elsewhere in this tab).
 *
 * Clicking a segment reveals who spoke, when, and what was said (from `utterances`), plus
 * the same honest "no player exists yet" stub as `ToneMoments` — there is nothing to
 * actually seek to yet.
 */

import { useMemo, useState, type ReactElement } from "react";
import type { DeliveryTurn, Utterance } from "@/delivery/types";
import "./tone-tab.css";

function formatSec(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clampPct(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

type SpeakerInfo = { label: string; tone: "a" | "b" };

const SPEAKER_LETTERS = "ABCDEFGH";

function buildSpeakerInfo(turns: DeliveryTurn[], coachSpeakerId: string | null): Map<string, SpeakerInfo> {
  const map = new Map<string, SpeakerInfo>();
  if (coachSpeakerId !== null) {
    for (const turn of turns) {
      if (map.has(turn.speaker)) continue;
      map.set(
        turn.speaker,
        turn.speaker === coachSpeakerId ? { label: "Coach", tone: "a" } : { label: "Client", tone: "b" }
      );
    }
    return map;
  }
  let idx = 0;
  for (const turn of turns) {
    if (map.has(turn.speaker)) continue;
    map.set(turn.speaker, {
      label: `Speaker ${SPEAKER_LETTERS[idx % SPEAKER_LETTERS.length]}`,
      tone: idx % 2 === 0 ? "a" : "b",
    });
    idx++;
  }
  return map;
}

function toneBackground(tone: "a" | "b"): string {
  return tone === "a"
    ? "color-mix(in srgb, var(--tone-ink) 22%, transparent)"
    : "color-mix(in srgb, var(--tone-muted) 32%, transparent)";
}

function findUtteranceText(turn: DeliveryTurn, utterances: Utterance[]): string | null {
  const match = utterances.find(
    (u) => u.speaker === turn.speaker && u.start === turn.start && u.end === turn.end
  );
  return match ? match.text : null;
}

export function ToneTimeline({
  turns,
  utterances,
  durationSec,
  coachSpeakerId,
}: {
  turns: DeliveryTurn[];
  utterances: Utterance[];
  durationSec: number;
  coachSpeakerId: string | null;
}): ReactElement {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const speakerInfo = useMemo(
    () => buildSpeakerInfo(turns, coachSpeakerId),
    [turns, coachSpeakerId]
  );

  if (turns.length === 0 || durationSec <= 0) {
    return (
      <div className="tone-tab">
        <p className="text-sm" style={{ color: "var(--tone-muted)" }}>
          No turn data
        </p>
      </div>
    );
  }

  const toggle = (i: number) => {
    setSelectedIndex((prev) => (prev === i ? null : i));
  };

  const selectedTurn = selectedIndex !== null ? turns[selectedIndex] : null;
  const selectedInfo = selectedTurn ? speakerInfo.get(selectedTurn.speaker) : null;
  const selectedText = selectedTurn ? findUtteranceText(selectedTurn, utterances) : null;

  return (
    <div className="tone-tab space-y-2">
      <p className="tone-micro-label">Turn timeline</p>
      <div
        className="relative h-8 w-full overflow-hidden rounded-md"
        style={{ background: "var(--tone-bg)", border: "1px solid var(--tone-border)" }}
        role="group"
        aria-label="Call turn timeline"
      >
        {turns.map((turn, i) => {
          const info = speakerInfo.get(turn.speaker);
          const label = info?.label ?? turn.speaker;
          const leftPct = clampPct((turn.start / durationSec) * 100);
          const widthPct = Math.max(clampPct(((turn.end - turn.start) / durationSec) * 100), 0.5);
          const isSelected = selectedIndex === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isSelected}
              aria-label={`${label} turn, ${formatSec(turn.start)} to ${formatSec(turn.end)}`}
              className="absolute inset-y-0 border-r focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                background: toneBackground(info?.tone ?? "a"),
                borderColor: "var(--tone-bg)",
                opacity: selectedIndex === null || isSelected ? 1 : 0.55,
              }}
            />
          );
        })}
      </div>

      {selectedTurn && selectedInfo && (
        <div className="tone-card space-y-2 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tone-chip tone-chip-neutral">{selectedInfo.label}</span>
            <span className="font-mono text-[13px] tabular-nums" style={{ color: "var(--tone-ink)" }}>
              {formatSec(selectedTurn.start)}–{formatSec(selectedTurn.end)}
            </span>
          </div>
          {selectedText ? (
            <p style={{ color: "var(--tone-body)" }}>{selectedText}</p>
          ) : (
            <p className="text-xs" style={{ color: "var(--tone-muted)" }}>
              No transcript text available for this turn.
            </p>
          )}
          <p className="text-xs" style={{ color: "var(--tone-muted)" }}>
            {"↳"} Jumps to {formatSec(selectedTurn.start)} once playback is wired up {"—"} no recording player
            exists yet.
          </p>
        </div>
      )}
    </div>
  );
}
