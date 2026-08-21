import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

/* Switzer, self-hosted from src/assets/fonts. The reference build's face reads as
   Suisse Int'l and Geist was the closest thing already installed, which is exactly the
   substitution the craft floor calls a failure. Switzer is the free face actually drawn
   against that model: closed apertures, flat terminals, and a narrow-ish set width that
   buys a line or two back in the dimension rows.

   Local rather than next/font/google because the PDF needs the same bytes: the print page
   base64-embeds these two files (src/lib/embedded-fonts.ts), so the woff2 on disk is the
   single source of truth for the screen and the print. A Google-hosted face would mean
   two copies that can drift.

   The italic is a real cut, not a synthesised slant — every evidence quote in the product
   is italic, and Chromium's oblique of a variable roman is visibly wrong at 14px. */
const switzer = localFont({
  variable: "--font-switzer",
  display: "swap",
  src: [
    { path: "../assets/fonts/switzer-variable.woff2", weight: "100 900", style: "normal" },
    { path: "../assets/fonts/switzer-variable-italic.woff2", weight: "100 900", style: "italic" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Report URLs are meant to be pasted to whoever needs to read them, so they have to
   preview as something. Without metadataBase, Next resolves the OG image relative to
   localhost and the card renders blank everywhere it matters. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "QC Evaluator",
    template: "%s · QC Evaluator",
  },
  description:
    "Coaching and kick-off calls scored against their twelve-dimension rubric, with the transcript line behind every number.",
  openGraph: {
    siteName: "QC Evaluator",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${switzer.variable} ${geistMono.variable} h-full antialiased`}
      /* The script below stamps data-js on this element before React hydrates, so the
         server's HTML and the client's DOM disagree on exactly one attribute, by design.
         Suppressed here rather than worked around: the alternative is rendering the flag
         server-side, which defeats the point of it (it means "a script is coming"). */
      suppressHydrationWarning
    >
      <head>
        {/* Runs before the body is parsed, so the stylesheet knows whether a script
            will be along to animate the gauge. Without it the server's finished score
            paints, and then hydration winds it back to zero a quarter of a second
            later: the one moment the product has, opening with a stutter. With no JS
            the flag is never set and every start state below stays inert. */}
        <script dangerouslySetInnerHTML={{ __html: 'document.documentElement.dataset.js="on"' }} />
      </head>
      <body className="min-h-full bg-bg font-sans text-ink">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
