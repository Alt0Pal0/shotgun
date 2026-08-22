import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return <main id="main" className="mx-auto w-full max-w-lg px-4 pb-28 pt-5">{children}</main>;
}

export function BottomNav({ items, active }: { items: { href: string; label: string; icon: string }[]; active: string }) {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {items.map((it) => {
          const on = active === it.href;
          return (
            <li key={it.href} className="flex-1">
              <Link href={it.href} aria-current={on ? "page" : undefined} className={`tap flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${on ? "text-accent" : "text-muted"}`}>
                <span aria-hidden className="text-lg leading-none">{it.icon}</span>{it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Card({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {title && <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>}
      {children}
    </section>
  );
}
