"use client";

import { useEffect, useState } from "react";

export type RailItem = { id: string; n: number; title: string };

/**
 * Scroll-spy for the twelve dimensions.
 *
 * Twelve identical grey dots read as decoration, so the active one is not merely
 * a different colour: it grows into a short bar. Height rather than a scale on a
 * circle, because a scaled circle is an ellipse and a pill is what says "you are
 * here, and this is a range". The number above it counts as you scroll, which is
 * the cheapest possible way to make the rail look like it is tracking something.
 *
 * The dots were already anchors; what they were missing is a reason to be noticed
 * and a name. Hovering one now says which dimension it is, so the rail is a way
 * to navigate rather than only a progress read-out.
 */
export function DimensionRail({ items }: { items: RailItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  const activeIndex = items.findIndex((i) => i.id === activeId);

  return (
    <nav
      aria-label="Dimensions"
      className="sticky top-24 hidden h-fit flex-col items-center gap-3 lg:flex"
    >
      <span className="micro-label tabular-nums leading-none">
        {String(activeIndex < 0 ? 1 : activeIndex + 1).padStart(2, "0")}
      </span>
      <span className="flex flex-col items-center gap-2">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              title={`${item.n}. ${item.title}`}
              aria-label={`Jump to dimension ${item.n}, ${item.title}`}
              aria-current={active ? "true" : undefined}
              className="group flex h-3 w-4 items-center justify-center"
            >
              <span
                className={`w-[3px] rounded-full transition-[height,background-color] duration-[var(--dur-state)] ease-[var(--ease-out-expo)] ${
                  active ? "h-5 bg-ink" : "h-[3px] bg-black/20 group-hover:h-2 group-hover:bg-muted"
                }`}
              />
            </a>
          );
        })}
      </span>
    </nav>
  );
}
