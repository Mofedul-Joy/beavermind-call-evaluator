import { ImageResponse } from "next/og";
import { getRun } from "@/lib/client-data";
import { bandTone, callTypeLabel } from "@/lib/format";

/**
 * A report link is the deliverable, and it gets pasted into Slack. This makes the
 * preview carry the two facts the reader wants before they click: whose call, and
 * how it went. The arc is the same geometry as the gauge on the page, filled to the
 * same fraction, so the card is a small true picture of what it opens.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Call evaluation report";

const TONE_STROKE: Record<string, string> = {
  green: "#1e7d34",
  amber: "#b3690a",
  red: "#c22b2b",
  neutral: "#111111",
};

export default async function ReportOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  const report = run?.status === "done" ? run.report : null;
  const score = report?.trace.normalised ?? null;
  const band = report?.trace.band.name ?? null;
  const stroke = TONE_STROKE[bandTone(band)];
  const circumference = Math.PI * 80;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: 72,
          background: "#F6F5F1",
          color: "#111111",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {[1, 1, 0.35].map((opacity, i) => (
            <div
              key={i}
              style={{
                width: 11,
                height: 44,
                borderRadius: 2,
                background: "#111111",
                opacity,
                transform: "skewX(-13deg)",
              }}
            />
          ))}
          <div style={{ marginLeft: 14, fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            QC Evaluator
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "space-between",
            gap: 48,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
            {/* Every text node here is a single interpolated string on purpose: satori
                treats "text {expr} text" as three children and refuses to lay a div out
                without an explicit display, which fails the whole route at request time. */}
            <div style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: "#73706B" }}>
              {`Full analysis · ${run ? callTypeLabel(run.callType) : "Coaching"} call`}
            </div>
            <div style={{ marginTop: 20, fontSize: 66, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>
              {run?.clientName ?? "Untitled call"}
            </div>
            {run?.coachName && (
              <div style={{ marginTop: 16, fontSize: 26, color: "#57534E" }}>{`Coached by ${run.coachName}`}</div>
            )}
          </div>

          {/* Paths only. Satori renders SVG paths but refuses <text>, so the numeral is
              HTML laid over the arc rather than typeset inside it. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", position: "relative", width: 300, height: 174 }}>
              <svg width="300" height="174" viewBox="0 0 200 116">
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#EAE8E3"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                {score !== null && (
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference * (score / 100)} ${circumference}`}
                  />
                )}
              </svg>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "absolute",
                  top: 78,
                  left: 0,
                  width: 300,
                }}
              >
                <div style={{ fontSize: 68, fontWeight: 600, letterSpacing: -3, lineHeight: 1 }}>
                  {score === null ? "\u2014" : String(score)}
                </div>
                <div style={{ marginTop: 4, fontSize: 20, color: "#73706B" }}>/100</div>
              </div>
            </div>
            {band && (
              <div style={{ marginTop: 22, fontSize: 24, letterSpacing: 2, fontWeight: 600, color: stroke }}>
                {band.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
