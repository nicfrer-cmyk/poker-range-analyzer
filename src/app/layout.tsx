import type { Metadata, Viewport } from "next";
import { Inter, Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "מנתח טווחי פוקר",
  description:
    "ניתוח ידיים וטווחים בפוקר אחרי המשחק — תבין איפה היד שלך עמדה מול הטווח של היריב, ומה היה נכון לעשות.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "מנתח טווחי פוקר",
  },
  // "?v=3" is the cache-buster for these static (non build-hashed) PNGs — keep this in sync
  // with public/manifest.webmanifest and ICON_VERSION in public/sw.js if the icon files change.
  icons: {
    icon: "/icons/icon-192.png?v=3",
    apple: "/icons/icon-192.png?v=3",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${inter.variable}`}>
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
