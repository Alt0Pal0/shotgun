"use client";
export function Rating({
  value,
  onChange,
  label,
  name,
  readOnly,
}: {
  value: number | null;
  onChange?: (v: number) => void;
  label: string;
  name?: string;
  readOnly?: boolean;
}) {
  return (
    <fieldset className="text-sm">
      <legend className="mb-2 font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n} of 5`}
              name={name}
              disabled={readOnly}
              onClick={() => onChange?.(n)}
              className={`tap h-12 w-12 rounded-full text-base font-bold transition ${on ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink border border-border"} ${readOnly ? "cursor-default" : ""}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
