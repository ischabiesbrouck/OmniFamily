import { useId, type InputHTMLAttributes } from 'react';

export function TextField({
  label,
  hint,
  error,
  inline = false,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | undefined;
  /** Compact: the label sits inside the field, above the value. */
  inline?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  const field = (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
      className={
        inline
          ? 'min-h-14 w-full rounded-2xl bg-transparent px-4 pt-5 pb-1 text-base text-ink outline-none placeholder:text-muted'
          : 'min-h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-base text-ink transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-brand/20 focus:outline-none aria-invalid:border-danger'
      }
      {...props}
    />
  );
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {inline ? (
        <div className="relative rounded-2xl border border-line-strong bg-surface transition focus-within:border-accent focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand has-[[aria-invalid=true]]:border-danger">
          <label
            htmlFor={id}
            className="pointer-events-none absolute top-1.5 left-4 text-xs font-semibold text-muted"
          >
            {label}
          </label>
          {field}
        </div>
      ) : (
        <>
          <label htmlFor={id} className="text-sm font-semibold">
            {label}
          </label>
          {field}
        </>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
