import { ImageResponse } from "next/og";

/** The same mark at home-screen size, with the breathing room iOS crops for. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "#F6F5F1",
        }}
      >
        {[1, 1, 0.35].map((opacity, i) => (
          <div
            key={i}
            style={{
              width: 24,
              height: 104,
              borderRadius: 4,
              background: "#111111",
              opacity,
              transform: "skewX(-13deg)",
            }}
          />
        ))}
      </div>
    ),
    { ...size }
  );
}
