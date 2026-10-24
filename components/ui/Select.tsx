import { useId, type SelectHTMLAttributes } from 'react';

export function Select({
  label,
  options,
  inline = false,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** Compact: the label sits inside the field, above the value. */
  inline?: boolean;
}) {
  const id = useId();
  const field = (
    <select
      id={id}
      className={
        inline
          ? 'min-h-14 w-full cursor-pointer rounded-2xl bg-transparent px-3.5 pt-5 pb-1 text-base text-ink outline-none'
          : 'min-h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 pr-8 text-base text-ink transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-brand/20 focus:outline-none aria-invalid:border-danger'
      }
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (inline)
    return (
      // The label floats over the field; the field itself is the full 56 px target.
      <div
        className={`relative rounded-2xl border border-line-strong bg-surface transition focus-within:border-accent focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand ${className}`}
      >
        <label
          htmlFor={id}
          className="pointer-events-none absolute top-1.5 left-4 text-xs font-semibold text-muted"
        >
          {label}
        </label>
        {field}
      </div>
    );
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {field}
    </div>
  );
}
