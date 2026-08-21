/**
 * The icon set. Authored SVG, one family, 1.4px stroke on a 16px box, round caps and
 * joins — so a download arrow and a chevron read as the same hand.
 *
 * Unicode arrows and emoji were standing in for these. They inherit the text font rather
 * than the icon grid, so their weight and baseline drift against everything beside them.
 */
function Icon({
  children,
  size = 16,
  className,
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

export const ArrowLeft = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M12.5 8H3.5M7 4.5 3.5 8 7 11.5" />
  </Icon>
);

export const Download = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M8 2.5v7.5M5 7.5 8 10.5l3-3M3 12.5h10" />
  </Icon>
);

export const Chevron = ({ open, ...p }: { open?: boolean; size?: number; className?: string }) => (
  <Icon {...p} className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${p.className ?? ""}`}>
    <path d="M4 6.25 8 10.25l4-4" />
  </Icon>
);

export const Flag = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M3.25 2v12M3.25 2.5h8.2c.6 0 .9.7.5 1.1L9.75 6l2.2 2.4c.4.4.1 1.1-.5 1.1h-8.2" />
  </Icon>
);
