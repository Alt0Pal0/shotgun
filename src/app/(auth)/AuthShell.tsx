import type { ReactNode } from "react";
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-accent">Learner Driver Platform</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </main>
  );
}
