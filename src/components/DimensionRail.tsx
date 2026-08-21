"use client";

import { useEffect, useState } from "react";

export function DimensionRail({ ids }: { ids: string[] }) {
  const [activeId, setActiveId] = useState(ids[0]);

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
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav aria-label="Dimensions" className="sticky top-8 hidden flex-col items-center gap-2.5 lg:flex">
      {ids.map((id, i) => (
        <a
          key={id}
          href={`#${id}`}
          aria-label={`Jump to dimension ${i + 1}`}
          aria-current={id === activeId ? "true" : undefined}
          className={`h-2 w-2 rounded-full transition-colors ${
            id === activeId ? "bg-ink" : "bg-border hover:bg-muted"
          }`}
        />
      ))}
    </nav>
  );
}
