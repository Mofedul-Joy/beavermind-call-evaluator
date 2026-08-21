import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Serverless Chromium ships no system fonts. next/font's self-hosted files rely on a
 * network round-trip that puppeteer's page.pdf() does not reliably wait for, so the PDF
 * silently falls back to Chromium's default (Open Sans) with no error. Base64-embedding
 * the typefaces directly in the print page's own <style> makes it available synchronously,
 * with no request at all.
 */
let cached: { sans: string; sansItalic: string; mono: string } | null = null;

export function embeddedFontFaces(): string {
  if (!cached) {
    const dir = path.join(process.cwd(), "src/assets/fonts");
    /* Each filename is a literal inside its own readFileSync call, not passed through a
       helper. Next's file tracer follows `readFileSync(path.join(dir, "literal"))` and
       copies the file into the serverless bundle; route it through a `(f: string) =>`
       and the tracer sees a variable, ships nothing, and the PDF route throws ENOENT in
       production only. The tracing entry in next.config.ts is the second line of defence
       for the same failure. */
    cached = {
      sans: readFileSync(path.join(dir, "switzer-variable.woff2")).toString("base64"),
      sansItalic: readFileSync(path.join(dir, "switzer-variable-italic.woff2")).toString("base64"),
      mono: readFileSync(path.join(dir, "geist-mono.woff2")).toString("base64"),
    };
  }
  /* The italic is embedded as its own face rather than left to Chromium. Every evidence
     quote in the report is italic, and a synthesised oblique of the roman is the single
     most obvious tell that a PDF was rendered by a headless browser. */
  return `
    @font-face {
      font-family: 'SwitzerPDF';
      src: url(data:font/woff2;base64,${cached.sans}) format('woff2');
      font-weight: 100 900;
      font-style: normal;
      font-display: block;
    }
    @font-face {
      font-family: 'SwitzerPDF';
      src: url(data:font/woff2;base64,${cached.sansItalic}) format('woff2');
      font-weight: 100 900;
      font-style: italic;
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
