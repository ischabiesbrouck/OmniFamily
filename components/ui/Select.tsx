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
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        className="border-ink/40 bg-surface focus-visible:outline-focus min-h-12 rounded-lg border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1"
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
