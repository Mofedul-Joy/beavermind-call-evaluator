import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Ship the headless Chromium binaries with the PDF route.
   *
   * `@sparticuz/chromium` is already on Next's auto-externalized list, so it is not
   * bundled — but it resolves its own `bin/` directory at runtime with a computed path,
   * which file tracing cannot follow. The 67 MB of brotli archives in there were being
   * left out of the deployment, and the route failed with "The input directory
   * /var/task/node_modules/@sparticuz/chromium/bin does not exist" — which reads like a
   * bundling problem and is actually a tracing one.
   *
   * Only reproducible in production: locally `launchBrowser()` finds the system Chrome
   * and never touches this package at all.
   */
  outputFileTracingIncludes: {
    "/api/pdf/\\[id\\]": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    /**
     * The print page base64-embeds the typefaces into its own <style> so the headless
     * browser has them synchronously. It reads them off disk at request time from
     * `src/assets/fonts`, which is source, not a bundled asset — nothing about
     * next/font/local puts them in the serverless output, and a font missing there
     * fails the way everything about this route fails: a 200 and a PDF set in
     * Chromium's default face, with no error anywhere.
     */
    "/print/\\[id\\]": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
