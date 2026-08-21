import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
