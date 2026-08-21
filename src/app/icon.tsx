import { ImageResponse } from "next/og";

/**
 * The mark, as the browser-tab icon: three slanted bars, the third held back.
 *
 * Drawn here rather than shipped as a file so it stays one definition with the header
 * wordmark. It replaced the untouched create-next-app favicon, which is the single
 * loudest tell that nobody finished a project.
 *
 * Built as skewed rectangles rather than an inline path because satori renders CSS
 * boxes reliably and SVG paths only partly.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          background: "#F6F5F1",
        }}
      >
        {[1, 1, 0.35].map((opacity, i) => (
          <div
            key={i}
            style={{
              width: 5,
              height: 22,
              borderRadius: 1,
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
