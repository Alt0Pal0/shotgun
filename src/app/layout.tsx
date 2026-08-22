import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: { default: "Learner Driver Platform", template: "%s · Learner Driver Platform" },
  description: "Safety-first supervised practice tracker for California learner drivers and their supervising adults.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Learner Driver" },
};
export const viewport: Viewport = { themeColor: "#0b1120", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">Skip to content</a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
