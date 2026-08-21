/**
 * PRESENCE's own icon set, same hand as `src/components/Icons.tsx` (1.4px stroke, round
 * caps, 16px grid) but declared locally — that file is owned elsewhere.
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

export const CameraIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h1.2l.6-1.1A1 1 0 0 1 6.2 2.4h3.6a1 1 0 0 1 .9.5l.6 1.1h1.2A1.5 1.5 0 0 1 14 5.5v6A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5Z" />
    <circle cx="8" cy="8.2" r="2.4" />
  </Icon>
);

export const CompassIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.8" />
    <path d="M10.2 5.8 6.7 7.3 5.4 10.5l3.4-1.5 1.4-3.2Z" />
  </Icon>
);

export const FrameIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <rect x="2.5" y="3" width="11" height="10" rx="1" />
    <path d="M2.5 6h11M5.3 3v10" opacity="0.55" />
  </Icon>
);

export const HandIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M6.2 8.6V3.4a.9.9 0 0 1 1.8 0v3.9M8 7.2V2.7a.9.9 0 0 1 1.8 0v4.6M9.8 7.4V3.8a.9.9 0 0 1 1.8 0v5.4" />
    <path d="M4.4 9.2 4.3 7a.9.9 0 0 1 1.8-.1l.3 2.5v.4c0 2.4 1.6 4.2 4 4.2 2.1 0 3.5-1.5 3.5-3.6V6.6" />
  </Icon>
);

export const PostureIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <circle cx="8.6" cy="3.4" r="1.4" />
    <path d="M8.6 4.8v3.6l-2.8 4.6M8.6 8.4l2.6 1.4M5 13h2.4" />
  </Icon>
);

export const SmileIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.8" />
    <path d="M5.6 9.2c.5.9 1.4 1.5 2.4 1.5s1.9-.6 2.4-1.5" />
    <path d="M5.9 6.4h.01M10.1 6.4h.01" strokeWidth="2" />
  </Icon>
);

export const AlertIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <path d="M8 2.6 1.8 12.8a.8.8 0 0 0 .7 1.2h11a.8.8 0 0 0 .7-1.2L8 2.6Z" />
    <path d="M8 6.3v3.1M8 11.4h.01" strokeWidth="1.8" />
  </Icon>
);

export const LockIcon = (p: { size?: number; className?: string }) => (
  <Icon {...p}>
    <rect x="3.2" y="7.2" width="9.6" height="6.4" rx="1.2" />
    <path d="M5.2 7.2V5a2.8 2.8 0 0 1 5.6 0v2.2" />
  </Icon>
);

export const ChevronDown = ({ open, ...p }: { open?: boolean; size?: number; className?: string }) => (
  <Icon {...p} className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${p.className ?? ""}`}>
    <path d="M4 6.25 8 10.25l4-4" />
  </Icon>
);
