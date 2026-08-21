import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `@sparticuz/chromium` ships a brotli-compressed Chromium under its own `bin/`
   * directory and resolves that path at runtime. Bundling it relocates the package and
   * the lookup fails with "The input directory /var/task/node_modules/@sparticuz/chromium/bin
   * does not exist" — only in production, because a local run uses the system Chrome
   * instead and never touches that code path.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
