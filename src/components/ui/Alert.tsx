import type { ReactNode } from "react";
export function Alert({ tone = "info", title, children }: { tone?: "info" | "warn" | "error" | "success"; title?: string; children: ReactNode }) {
  const cls = { info: "border-violet/50 bg-violet/10", warn: "border-amber/50 bg-amber/10", error: "border-rose/50 bg-rose/10", success: "border-success/50 bg-success/10" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${cls}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="text-ink/90">{children}</div>
    </div>
  );
}
