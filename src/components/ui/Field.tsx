import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface BaseProps { label: string; hint?: string; error?: string; children?: ReactNode }

const inputCls = "tap w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-ink placeholder:text-muted focus:border-accent";

export function Input({ label, hint, error, className = "", ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input id={id} aria-invalid={!!error} aria-describedby={hint || error ? `${id}-d` : undefined} className={`${inputCls} ${className}`} {...rest} />
      {(hint || error) && <span id={`${id}-d`} className={`mt-1 block text-xs ${error ? "text-rose" : "text-muted"}`}>{error ?? hint}</span>}
    </label>
  );
}

export function Textarea({ label, hint, error, maxLength, value, className = "", ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const len = typeof value === "string" ? value.length : 0;
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 flex items-center justify-between font-medium"><span>{label}</span>{maxLength && <span className="text-xs text-muted numeral" aria-live="polite">{len}/{maxLength}</span>}</span>
      <textarea id={id} maxLength={maxLength} value={value} aria-invalid={!!error} className={`${inputCls} min-h-24 ${className}`} {...rest} />
      {(hint || error) && <span className={`mt-1 block text-xs ${error ? "text-rose" : "text-muted"}`}>{error ?? hint}</span>}
    </label>
  );
}

export function Select({ label, hint, error, children, className = "", ...rest }: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select id={id} aria-invalid={!!error} className={`${inputCls} ${className}`} {...rest}>{children}</select>
      {(hint || error) && <span className={`mt-1 block text-xs ${error ? "text-rose" : "text-muted"}`}>{error ?? hint}</span>}
    </label>
  );
}

export function Checkbox({ label, hint, className = "", ...rest }: { label: ReactNode; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm ${className}`}>
      <input id={id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]" {...rest} />
      <span><span className="font-medium">{label}</span>{hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}
