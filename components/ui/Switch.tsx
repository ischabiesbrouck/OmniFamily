'use client';

import { useId } from 'react';

/** An on/off switch with its label and hint; the whole row is a 48 px target (SPEC §6). */
export function Switch({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        {...(hint ? { 'aria-describedby': `${id}-hint` } : {})}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="group inline-flex min-h-12 shrink-0 items-center disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={`flex h-7 w-12 items-center rounded-full border-2 p-0.5 transition ${
            checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-2'
          }`}
        >
          <span
            className={`size-5 rounded-full shadow-card transition-transform ${
              checked ? 'translate-x-5 bg-on-accent' : 'bg-ink'
            }`}
          />
        </span>
      </button>
      <span className="flex flex-col pt-2.5">
        <span id={`${id}-label`} className="font-semibold">
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className="text-sm text-muted">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}
