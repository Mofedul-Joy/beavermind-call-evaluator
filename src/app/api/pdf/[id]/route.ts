import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
import { headers } from "next/headers";
import { getRun } from "@/lib/client-data";
import { pdfFilename } from "@/lib/format";

export const maxDuration = 60;

const LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { existsSync } = await import("node:fs");
  const local = LOCAL_CHROME_PATHS.find((p) => existsSync(p));
  if (!local) {
    throw new Error("No local Chrome found for PDF generation outside Vercel. Set up @sparticuz/chromium's path or install Chrome.");
  }
  return puppeteer.launch({ executablePath: local, headless: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) return NextResponse.json({ message: "Run not found." }, { status: 404 });
  if (run.status !== "done" || !run.report) {
    return NextResponse.json({ message: "This run has no finished report yet." }, { status: 409 });
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const printUrl = `${proto}://${host}/print/${id}`;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    /* `attachment`, not `inline`. This endpoint exists to hand somebody a file, and
       `inline` makes the browser navigate to its own PDF viewer instead — the reader
       loses the report they were reading to look at a picture of it. The button that
       calls this fetches the body and saves the blob, so in practice nothing navigates
       either way; the header is what makes a pasted URL behave the same. */
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFilename(run.clientName)}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
