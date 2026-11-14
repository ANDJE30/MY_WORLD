import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings, academicYears } from '@/db/schema';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from './settings-types';
import { ensureBootstrap } from './bootstrap';

export const getSettings = cache(async (): Promise<Settings> => {
  await ensureBootstrap();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return mergeSettings(DEFAULT_SETTINGS, row?.data ?? {});
});

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  const next = mergeSettings(current, patch);
  await db
    .insert(settings)
    .values({ id: 1, data: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.id, set: { data: next, updatedAt: new Date() } });
  return next;
}

export const getCurrentYear = cache(async () => {
  await ensureBootstrap();
  const [y] = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1);
  if (y) return y;
  const [any] = await db.select().from(academicYears).orderBy(academicYears.startDate).limit(1);
  if (!any) throw new Error('Aucune année scolaire configurée.');
  return any;
});
