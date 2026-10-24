/** A donut showing `done` of `total`; the label carries the meaning for screen readers. */
export function ProgressRing({
  done,
  total,
  label,
  size = 88,
}: {
  done: number;
  total: number;
  label: string;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total === 0 ? 0 : Math.min(1, done / total);
  return (
    <div
      role="img"
      aria-label={label}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--glass)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums"
      >
        {done}/{total}
      </span>
    </div>
  );
}
