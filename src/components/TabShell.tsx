"use client";

import { useRef } from "react";

/**
 * The tab chrome around TRANSCRIPT / TONE / PRESENCE (D11).
 *
 * Contract, not content: this file owns the tab bar and the panel wrapper only. The three
 * sibling builds (report page, TONE metrics, PRESENCE metrics) each work in their own
 * worktree off the same base commit and never see this file's history — `TabKey` and
 * `TabShellProps` are the entire interface they code against, so both are documented as if
 * this comment were the only context they get.
 *
 * Single swapped child, not three named slots. The caller already owns `activeTab` state
 * (it has to, to drive `tabsAvailable` and persist the choice) and therefore already knows
 * which panel's content to pass down. A three-slot API would make the caller build all
 * three panels' content up front on every render just to hand them over; the one-child API
 * lets the caller render only the active panel's content, which is also the simpler thing
 * to type and the simpler thing to read.
 *
 * `tabsAvailable` is presence, not permission. TRANSCRIPT is always in it. A paste-only run
 * (no recording uploaded) never includes 'tone' or 'presence' at all — that is what keeps a
 * paste-only run pixel-identical to the briefed report, per D11: when the caller passes an
 * array of length <= 1, this component renders no tab bar, just the panel. There is no
 * "disabled tab" state anywhere in this contract; if a tab isn't ready to show, it isn't in
 * the array yet.
 */

export type TabKey = "transcript" | "tone" | "presence";

export type TabShellProps = {
  /** The tab whose panel is currently showing. Must be a member of `tabsAvailable`. */
  activeTab: TabKey;
  /**
   * Which tabs have something to show, in any order — this component always renders them
   * TRANSCRIPT, TONE, PRESENCE regardless of array order. TRANSCRIPT is always present; a
   * paste-only run (no recording) omits 'tone' and 'presence' entirely rather than listing
   * them as disabled, so the shell renders no tab bar at all for that run (D11: "Tabs
   * appear only when a recording was uploaded").
   */
  tabsAvailable: TabKey[];
  /** Called with the tab the user picked, by click or arrow-key navigation. Does not fire
   *  for the already-active tab. The caller owns the state; this component is uncontrolled
   *  only over which button currently has DOM focus. */
  onChange: (tab: TabKey) => void;
  /** The active panel's content. Swap this yourself when `activeTab` changes — this
   *  component does not know how to render TRANSCRIPT, TONE, or PRESENCE content. */
  children: React.ReactNode;
};

const TAB_ORDER: TabKey[] = ["transcript", "tone", "presence"];
const TAB_LABEL: Record<TabKey, string> = {
  transcript: "Transcript",
  tone: "Tone",
  presence: "Presence",
};

export function TabShell({ activeTab, tabsAvailable, onChange, children }: TabShellProps) {
  const buttonRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  const tabs = TAB_ORDER.filter((t) => tabsAvailable.includes(t));

  // A single available tab isn't a choice, so a bar with one button in it is pure noise —
  // render just the panel.
  if (tabs.length <= 1) {
    return <div id={`panel-${activeTab}`}>{children}</div>;
  }

  function activate(tab: TabKey) {
    if (tab !== activeTab) onChange(tab);
    buttonRefs.current[tab]?.focus();
  }

  // Roving-tabindex arrow navigation per the WAI-ARIA tabs pattern: only the active tab is
  // in the tab order, Left/Right (and Home/End) move focus and activate in one step.
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      activate(tabs[next]);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Report sections" className="flex gap-1.5 border-b border-border pb-4">
        {tabs.map((tab, i) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              ref={(el) => {
                buttonRefs.current[tab] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab}`}
              aria-selected={active}
              aria-controls={`panel-${tab}`}
              tabIndex={active ? 0 : -1}
              onClick={() => activate(tab)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`micro-label rounded-full px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 ${
                active ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {TAB_LABEL[tab]}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="pt-6">
        {children}
      </div>
    </div>
  );
}
