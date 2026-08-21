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
  },
};

export default nextConfig;
