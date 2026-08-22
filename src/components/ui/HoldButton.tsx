"use client";
import { useEffect, useRef, useState } from "react";

/** Press-and-hold control (2 s by default). Keyboard: hold Space/Enter. Reduced motion respected via CSS. */
export function HoldButton({ label, holdMs = 2000, onComplete, disabled, className = "" }: { label: string; holdMs?: number; onComplete: () => void; disabled?: boolean; className?: string }) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!holding) return;
    const startedAt = performance.now();
    let raf = 0, done = false;
    const tick = () => {
      const p = Math.min(1, (performance.now() - startedAt) / holdMs);
      setProgress(p);
      if (p >= 1) { if (!done) { done = true; setHolding(false); onCompleteRef.current(); } return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [holding, holdMs]);

  const begin = () => { if (!disabled) setHolding(true); };
  const end = () => { setHolding(false); setProgress(0); };

  return (
    <button type="button" disabled={disabled} aria-label={`${label} (press and hold)`} aria-disabled={disabled}
      onPointerDown={begin} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") end(); }}
      className={`tap relative w-full overflow-hidden rounded-2xl border-2 px-6 py-5 text-lg font-bold select-none touch-none ${disabled ? "border-border bg-surface-2 text-muted" : "border-accent bg-surface text-ink"} ${className}`}>
      <span className="absolute inset-y-0 left-0 bg-accent/30" style={{ width: `${progress * 100}%` }} aria-hidden />
      <span className="relative">{label}</span>
      <span className="sr-only" aria-live="polite">{holding && progress < 1 ? "Keep holding" : ""}</span>
    </button>
  );
}
