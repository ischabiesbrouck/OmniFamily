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
      className={`rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`}
      {...props}
    >
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {icon && <span className="text-accent">{icon}</span>}
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

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="mr-auto min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
