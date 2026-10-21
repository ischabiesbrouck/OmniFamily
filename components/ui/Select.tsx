import { useId, type SelectHTMLAttributes } from 'react';

export function Select({
  label,
  options,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        className="min-h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 pr-8 text-base text-ink transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-brand/20 focus:outline-none aria-invalid:border-danger"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
