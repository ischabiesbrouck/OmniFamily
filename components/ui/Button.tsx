import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:bg-ink/90',
  secondary: 'border border-ink/30 bg-surface text-ink hover:bg-ink/5',
  danger: 'bg-danger text-surface hover:bg-danger/90',
  ghost: 'text-ink hover:bg-ink/5',
};

/** ≥ 48 × 48 CSS px touch target (SPEC §6). */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`focus-visible:outline-focus inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-lg px-4 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
