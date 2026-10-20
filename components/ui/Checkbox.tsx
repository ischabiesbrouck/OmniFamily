import type { InputHTMLAttributes } from 'react';

/**
 * Round "done" tick. The whole 48 × 48 px label toggles it (SPEC §6); the native input
 * stays in place (visually restyled) so keyboard, screen readers and forms work unchanged.
 */
export function Checkbox({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={`relative inline-flex size-12 shrink-0 cursor-pointer items-center justify-center ${className}`}
    >
      <input
        type="checkbox"
        className="peer size-6 cursor-pointer appearance-none rounded-full border-2 border-line-strong bg-surface transition checked:border-success checked:bg-success"
        {...props}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute size-4 text-surface opacity-0 peer-checked:opacity-100"
      >
        <path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
  );
}
