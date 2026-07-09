import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getAppUrl } from "@/lib/appUrl";

// Self-hosted, not next/font/google: a build-time fetch to Google Fonts isn't something to
// depend on at build time (see ROADMAP.md — the whole point is zero network calls during
// `next build`). These are the exact same subsetted .woff2 files Google was already serving for
// this app (same URLs, byte-for-byte), just vendored into the repo instead of fetched at build
// time — so this is a delivery-mechanism change only, not a font change.
//
// Heebo ships as two subset files (hebrew, latin) with no shared file covering both scripts —
// that's how Google itself subsets it. `next/font/local` has no per-file `unicode-range` option
// (unlike a hand-written @font-face), so instead of merging them into one `localFont()` call
// (which would have no way to pick the right file per glyph), each subset gets its own
// `localFont()` call, and globals.css's `--font-heebo` combines both into one font-family stack
// — the browser already falls through per-glyph across a font-family list, so this reaches the
// exact same rendering result. `--font-heebo`/`--font-inter` stay the same public CSS variables
// tailwind.config.ts already reads; only how they're assembled changed.
const heeboHebrew = localFont({
  src: "./fonts/heebo-hebrew.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-heebo-hebrew",
  display: "swap",
});

const heeboLatin = localFont({
  src: "./fonts/heebo-latin.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-heebo-latin",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

const SITE_TITLE = "מנתח טווחי פוקר";
const SITE_DESCRIPTION =
  "ניתוח ידיים וטווחים בפוקר אחרי המשחק — תבין איפה היד שלך עמדה מול הטווח של היריב, ומה היה נכון לעשות.";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_TITLE,
  },
  // "?v=3" is the cache-buster for these static (non build-hashed) PNGs — keep this in sync
  // with public/manifest.webmanifest and ICON_VERSION in public/sw.js if the icon files change.
  icons: {
    icon: "/icons/icon-192.png?v=3",
    apple: "/icons/icon-192.png?v=3",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "he_IL",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heeboHebrew.variable} ${heeboLatin.variable} ${inter.variable}`}
    >
      <head>
        {/* Sets the theme attribute before first paint so switching to dark mode in Settings
            doesn't flash the light theme on the next page load. Light stays the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pra:theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
