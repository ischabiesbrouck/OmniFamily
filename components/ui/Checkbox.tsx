import type { InputHTMLAttributes } from 'react';

/** A 48 × 48 px hit area around a large native checkbox (SPEC §6). */
export function Checkbox({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={`inline-flex size-12 shrink-0 items-center justify-center ${className}`}>
      <input type="checkbox" className="size-6 cursor-pointer accent-ink" {...props} />
    </span>
  );
}
