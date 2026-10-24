import type { HTMLAttributes, ReactNode } from 'react';

/** Surface container. With `title`, it becomes a labelled region. */
export function Card({
  title,
  icon,
  action,
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string; icon?: ReactNode; action?: ReactNode }) {
  const id = title ? `card-${title.replace(/\W+/g, '-').toLowerCase()}` : undefined;
  return (
    <section
      aria-labelledby={id}
      className={`rounded-card border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}
      {...props}
    >
      {title && (
        <div className="mb-4 flex items-center gap-3">
          {icon && (
            <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink">
              {icon}
            </span>
          )}
          <h2 id={id} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Page title on the gradient hero card, with an optional visual (ring, icon) and actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
  visual,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <div className="hero mb-5 flex items-center gap-4 rounded-card p-5 shadow-card sm:p-7">
      <div className="mr-auto min-w-0 flex-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-base sm:text-lg">{subtitle}</p>}
        {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {visual && <div className="shrink-0">{visual}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}
