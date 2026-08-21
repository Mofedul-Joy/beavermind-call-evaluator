import { bandTone } from "@/lib/format";

const TONE_STROKE: Record<string, string> = {
  green: "#1e7d34",
  amber: "#b3690a",
  red: "#c22b2b",
  neutral: "#111111",
};

export function ScoreGauge({ score, band }: { score: number; band: string }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const circumference = Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - pct);
  const stroke = TONE_STROKE[bandTone(band)];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" width="220" height="124" role="img" aria-label={`Score ${score} out of 100`}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#EAE8E3"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={stroke}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <text x="100" y="92" textAnchor="middle" fontSize="40" fontWeight="600" fill="#111111">
          {score}
        </text>
        <text x="100" y="110" textAnchor="middle" fontSize="13" fill="#8A8680">
          /100
        </text>
      </svg>
    </div>
  );
}
