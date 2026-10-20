/** A compact single-choice control (a group of toggle buttons). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="min-h-12 rounded-lg px-3 text-sm font-semibold text-muted transition duration-150 aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-card sm:px-4"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
