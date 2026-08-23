import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND, BRAND_SHORT, DESCRIPTION, TAGLINE } from "@/lib/brand";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://www.shotgun.rocks"),
  title: { default: `${BRAND} 🤘`, template: `%s · ${BRAND}` },
  description: DESCRIPTION,
  applicationName: BRAND,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: BRAND_SHORT },
  openGraph: {
    type: "website",
    siteName: BRAND,
    title: `${BRAND} 🤘 — ${TAGLINE}`,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: `${BRAND} 🤘 — ${TAGLINE}`, description: DESCRIPTION },
};
// Every page depends on the signed-in user (cookies); nothing is statically prerendered.
export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  themeColor: "#0b1120",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
        >
          Skip to content
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
