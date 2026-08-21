import { bandTone } from "@/lib/format";

const TONE_STROKE: Record<string, string> = {
  green: "#1e7d34",
  amber: "#b3690a",
  red: "#c22b2b",
  neutral: "#111111",
};

/**
 * The headline number.
 *
 * A semicircular arc rather than a full ring: the scale runs 0 to 100 in one direction,
 * and a half-circle says that where a closed ring implies a cycle. The track is the same
 * hairline grey as every border on the page, so the coloured arc is the only thing in the
 * component carrying meaning.
 */
export function ScoreGauge({ score, band, size = 232 }: { score: number; band: string; size?: number }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const circumference = Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const stroke = TONE_STROKE[bandTone(band)];
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg
      viewBox="0 0 200 116"
      width={size}
      height={(size * 116) / 200}
      role="img"
      aria-label={`Scored ${score} out of 100, band ${band}`}
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
      />
      <text
        x="100"
        y="94"
        textAnchor="middle"
        fontSize="46"
        fontWeight="600"
        letterSpacing="-2"
        fill="#111111"
      >
        {score}
      </text>
      <text x="100" y="112" textAnchor="middle" fontSize="12" letterSpacing="0.5" fill="#73706B">
        /100
      </text>
    </svg>
  );
}
