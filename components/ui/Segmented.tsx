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
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-full border border-line bg-surface p-1 shadow-card"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="min-h-12 rounded-full px-4 text-sm font-semibold text-muted transition duration-200 aria-pressed:bg-accent aria-pressed:text-on-accent sm:px-5"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
