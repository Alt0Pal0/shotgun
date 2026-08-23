import Link from "next/link";
import { BRAND_HORNS } from "@/lib/brand";

/** Compact top bar: brand + About. Kept off the locked-drive and live screens. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-lg items-center justify-between px-4">
        <Link href="/" className="tap inline-flex items-center text-sm font-bold tracking-wide text-accent">
          {BRAND_HORNS}
        </Link>
        <Link href="/about" className="tap inline-flex items-center px-2 text-sm text-muted">
          About
        </Link>
      </div>
    </header>
  );
}
