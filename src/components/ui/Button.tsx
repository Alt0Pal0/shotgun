"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const styles: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 disabled:opacity-50",
  secondary: "bg-surface-2 text-ink border border-border hover:bg-[#223054] disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-surface-2 disabled:opacity-50",
  danger: "bg-rose text-white hover:brightness-110 disabled:opacity-50",
  success: "bg-success text-[#04301d] hover:brightness-110 disabled:opacity-50",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: "md" | "lg" | "xl"; loading?: boolean; block?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, block, className = "", children, disabled, ...rest }, ref) {
  const sizes = { md: "px-4 py-2.5 text-sm", lg: "px-5 py-3.5 text-base", xl: "px-6 py-5 text-lg" }[size];
  return (
    <button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`tap inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ${styles[variant]} ${sizes} ${block ? "w-full" : ""} ${className}`} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});
