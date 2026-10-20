import type { InputHTMLAttributes } from 'react';

/** The whole 48 × 48 px label toggles the checkbox (SPEC §6 target size). */
export function Checkbox({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={`inline-flex size-12 shrink-0 cursor-pointer items-center justify-center ${className}`}
    >
      <input type="checkbox" className="size-6 cursor-pointer accent-ink" {...props} />
    </label>
  );
}
