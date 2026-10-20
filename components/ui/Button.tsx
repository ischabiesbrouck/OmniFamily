import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent shadow-card hover:brightness-110 active:brightness-95',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
  soft: 'bg-accent-soft text-accent-soft-ink hover:brightness-95',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-danger text-on-danger hover:brightness-110',
};

export const BUTTON_BASE =
  'inline-flex min-h-12 min-w-12 select-none items-center justify-center gap-2 rounded-xl px-4 text-[0.95rem] font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-60';

/** ≥ 48 × 48 CSS px touch target (SPEC §6). */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Square icon-only button; `aria-label` is required because there is no visible text. */
export function IconButton({
  label,
  variant = 'ghost',
  className = '',
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string;
  variant?: ButtonVariant;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl transition duration-150 disabled:opacity-60 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
