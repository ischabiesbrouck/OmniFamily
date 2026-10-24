'use client';

import {
  CalendarDays,
  ChevronDown,
  FileUp,
  HelpCircle,
  Home,
  ListChecks,
  MonitorSmartphone,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { BUTTON_BASE, BUTTON_VARIANTS } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';

const SECTIONS = [
  { key: 'start', Icon: Sparkles },
  { key: 'today', Icon: Home },
  { key: 'calendar', Icon: CalendarDays },
  { key: 'tasks', Icon: ListChecks },
  { key: 'groceries', Icon: ShoppingBasket },
  { key: 'imports', Icon: FileUp },
  { key: 'family', Icon: Users },
  { key: 'wall', Icon: MonitorSmartphone },
  { key: 'privacy', Icon: ShieldCheck },
  { key: 'install', Icon: Smartphone },
] as const satisfies ReadonlyArray<{ key: string; Icon: LucideIcon }>;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function qa(value: unknown): Array<{ q: string; a: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is { q: string; a: string } =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as { q?: unknown }).q === 'string' &&
      typeof (v as { a?: unknown }).a === 'string',
  );
}

/** "How it works": the whole app in short numbered steps, plus common questions (D-13.1). */
export function HelpGuide() {
  const t = useTranslations('help');

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('intro')}
        visual={
          <span className="flex size-20 items-center justify-center rounded-full bg-glass shadow-card">
            <HelpCircle aria-hidden="true" className="size-9" />
          </span>
        }
      />

      <nav aria-label={t('topics')} className="mb-5">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {SECTIONS.map(({ key, Icon }) => (
            <li key={key}>
              <a
                href={`#${key}`}
                className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold whitespace-nowrap shadow-card hover:bg-surface-2"
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(`sections.${key}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {SECTIONS.map(({ key, Icon }) => (
          <Card
            key={key}
            id={key}
            title={t(`sections.${key}.title`)}
            icon={<Icon aria-hidden="true" className="size-5" />}
            className="scroll-mt-24"
          >
            <p className="mb-4 text-muted">{t(`sections.${key}.intro`)}</p>
            <ol className="flex flex-col gap-3">
              {strings(t.raw(`sections.${key}.steps`)).map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      <section aria-labelledby="faq-heading" className="mt-6">
        <h2 id="faq-heading" className="mb-3 text-2xl font-semibold tracking-tight">
          {t('faq.title')}
        </h2>
        <div className="flex flex-col gap-2">
          {qa(t.raw('faq.items')).map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-tile border border-line bg-surface shadow-card"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{q}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 transition group-open:rotate-180"
                />
              </summary>
              <p className="px-4 pb-4">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <Link href="/" className={`${BUTTON_BASE} ${BUTTON_VARIANTS.primary} mt-6`}>
        {t('back')}
      </Link>
    </div>
  );
}
