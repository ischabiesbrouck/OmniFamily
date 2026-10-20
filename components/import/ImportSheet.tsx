'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { Camera, FileSpreadsheet, ImageUp, MessageSquareText } from 'lucide-react';
import { useLocale, useTimeZone, useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { getRepositories } from '@/lib/db/repositories';
import { createEvent } from '@/lib/db/repositories/events';
import { useMembers } from '@/lib/db/repositories/hooks';
import {
  readTable,
  rowsToCandidates,
  SPREADSHEET_ACCEPT,
  UnsupportedFileError,
} from '@/lib/extract/spreadsheet';
import { extractFromText } from '@/lib/extract/text';
import { candidateToDraft } from '@/lib/extract/toDraft';
import type { Candidate, ExtractOptions } from '@/lib/extract/types';
import { useDeviceStore } from '@/stores/deviceStore';
import { useUiStore } from '@/stores/uiStore';
import { CandidateList, type Reviewed } from './CandidateList';

type Source = 'text' | 'photo' | 'file';

const TAB =
  'flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-card';

/** Import dates from a pasted message, a photo (on-device OCR) or a spreadsheet (D-9.1). */
export function ImportSheet() {
  const t = useTranslations('import');
  const tToast = useTranslations('toast');
  const tCal = useTranslations('calendar.form');
  const locale = useLocale();
  const zone = useTimeZone() ?? 'UTC';
  const members = useMembers() ?? [];
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const [source, setSource] = useState<Source>('text');
  const [text, setText] = useState('');
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const options: ExtractOptions = {
    locale,
    now: new Date(),
    timeZone: zone,
    members,
    fallbackTitle: tCal('newTitle'),
  };
  const creator = activeMemberId ?? members.find((m) => m.role === 'parent')?.id ?? '';

  const findIn = (value: string) => {
    setError(null);
    setCandidates(extractFromText(value, options));
  };

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setCandidates(null);
    setProgress(0);
    try {
      const { recognizeImage } = await import('@/lib/extract/ocr');
      const recognised = await recognizeImage(file, locale, (p) => setProgress(p));
      setOcrText(recognised);
      findIn(recognised);
    } catch {
      setError(t('ocrFailed'));
    } finally {
      setProgress(null);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      setCandidates(rowsToCandidates(await readTable(file), options));
    } catch (e) {
      setCandidates(null);
      setError(e instanceof UnsupportedFileError ? t('unsupported') : t('fileError'));
    }
  }

  async function addAll(selected: Reviewed[]) {
    setSaving(true);
    const core = getRepositories().core;
    for (const c of selected) await createEvent(core, candidateToDraft(c, zone, creator));
    setSaving(false);
    openSheet(null);
    toast(tToast('imported', { count: selected.length }));
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && openSheet(null)}
      title={t('title')}
      description={t('intro')}
      wide
    >
      <Tabs.Root
        value={source}
        onValueChange={(v) => {
          setSource(v as Source);
          setCandidates(null);
          setError(null);
        }}
      >
        <Tabs.List
          aria-label={t('tabs.label')}
          className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1"
        >
          <Tabs.Trigger value="text" className={TAB}>
            <MessageSquareText aria-hidden="true" className="size-4" />
            {t('tabs.text')}
          </Tabs.Trigger>
          <Tabs.Trigger value="photo" className={TAB}>
            <Camera aria-hidden="true" className="size-4" />
            {t('tabs.photo')}
          </Tabs.Trigger>
          <Tabs.Trigger value="file" className={TAB}>
            <FileSpreadsheet aria-hidden="true" className="size-4" />
            {t('tabs.file')}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="text" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('textLabel')}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={t('textPlaceholder')}
              className="rounded-xl border border-line-strong bg-surface p-3 text-base font-normal placeholder:text-muted"
            />
          </label>
          <Button className="self-start" disabled={text.trim() === ''} onClick={() => findIn(text)}>
            {t('find')}
          </Button>
        </Tabs.Content>

        <Tabs.Content value="photo" className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('photoHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => camera.current?.click()} disabled={progress !== null}>
              <Camera aria-hidden="true" className="size-5" />
              {t('takePhoto')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => gallery.current?.click()}
              disabled={progress !== null}
            >
              <ImageUp aria-hidden="true" className="size-5" />
              {t('choosePhoto')}
            </Button>
          </div>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPhoto(e)}
          />
          <input
            ref={gallery}
            type="file"
            accept="image/*"
            aria-label={t('choosePhoto')}
            className="hidden"
            onChange={(e) => void onPhoto(e)}
          />
          {progress !== null && (
            <div role="status" className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {t('reading', { percent: Math.round(progress * 100) })}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <span
                  className="block h-full bg-accent transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </span>
            </div>
          )}
          {ocrText !== null && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {t('recognised')}
                <textarea
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  rows={5}
                  className="rounded-xl border border-line-strong bg-surface p-3 font-mono text-sm font-normal"
                />
              </label>
              <Button variant="secondary" className="self-start" onClick={() => findIn(ocrText)}>
                {t('find')}
              </Button>
            </div>
          )}
        </Tabs.Content>

        <Tabs.Content value="file" className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('fileHint')}</p>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-xl bg-accent px-4 font-semibold text-on-accent">
            <FileSpreadsheet aria-hidden="true" className="size-5" />
            {t('chooseFile')}
            <input
              type="file"
              accept={SPREADSHEET_ACCEPT}
              className="sr-only"
              onChange={(e) => void onFile(e)}
            />
          </label>
        </Tabs.Content>
      </Tabs.Root>

      {error && (
        <p role="alert" className="mt-4 font-semibold text-danger">
          {error}
        </p>
      )}
      {candidates && (
        <div className="mt-5">
          <CandidateList
            key={candidates.map((c) => c.key).join()}
            candidates={candidates}
            members={members}
            saving={saving}
            onAdd={(s) => void addAll(s)}
          />
        </div>
      )}
    </Sheet>
  );
}
