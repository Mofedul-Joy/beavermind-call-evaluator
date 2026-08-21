import { ImageResponse } from "next/og";

/**
 * What a pasted report link looks like in Slack, which is where these links get
 * pasted. Same bone ground, same mark, same half-circle the score lands on, so the
 * preview and the page it opens are recognisably one thing.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "QC Evaluator — coaching and kick-off calls scored against their rubric";

export default function OpengraphImage() {
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
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 660 }}>
            <div style={{ fontSize: 62, fontWeight: 600, letterSpacing: -2, lineHeight: 1.08 }}>
              Every score held to a line in the transcript.
            </div>
            <div style={{ marginTop: 24, fontSize: 26, color: "#57534E", lineHeight: 1.45 }}>
              Coaching and kick-off calls, scored against their twelve-dimension rubric.
            </div>
          </div>

          <svg width="300" height="174" viewBox="0 0 200 116">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#EAE8E3"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1e7d34"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${Math.PI * 80 * 0.82} ${Math.PI * 80}`}
            />
          </svg>
        </div>
      </div>
    ),
    { ...size }
  );
}
