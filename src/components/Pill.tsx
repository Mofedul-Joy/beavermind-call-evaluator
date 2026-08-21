import type { ReactNode } from "react";

export function PrimaryPill({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={`pill-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85 disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryPill({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={`pill-secondary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.03] disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function FilterPill({
  active,
  children,
  ...rest
}: { active: boolean; children: ReactNode } & React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-ink text-white"
          : "bg-white text-body border border-border hover:border-ink/30"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
