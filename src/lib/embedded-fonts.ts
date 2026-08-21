import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Serverless Chromium ships no system fonts. next/font's self-hosted files rely on a
 * network round-trip that puppeteer's page.pdf() does not reliably wait for, so the PDF
 * silently falls back to Chromium's default (Open Sans) with no error. Base64-embedding
 * the typeface directly in the print page's own <style> makes it available synchronously,
 * with no request at all.
 */
let cached: { sans: string; mono: string } | null = null;

export function embeddedFontFaces(): string {
  if (!cached) {
    const dir = path.join(process.cwd(), "src/assets/fonts");
    cached = {
      sans: readFileSync(path.join(dir, "geist-sans.woff2")).toString("base64"),
      mono: readFileSync(path.join(dir, "geist-mono.woff2")).toString("base64"),
    };
  }
  return `
    @font-face {
      font-family: 'GeistPDF';
      src: url(data:font/woff2;base64,${cached.sans}) format('woff2');
      font-weight: 100 900;
      font-display: block;
    }
    @font-face {
      font-family: 'GeistMonoPDF';
      src: url(data:font/woff2;base64,${cached.mono}) format('woff2');
      font-weight: 100 900;
      font-display: block;
    }
  `;
}
