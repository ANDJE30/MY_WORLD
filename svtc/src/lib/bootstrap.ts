import 'server-only';
import { sql, eq, count } from 'drizzle-orm';
import { db } from '@/db';
import { settings, academicYears, subjects, classes, rooms, users } from '@/db/schema';
import { DEFAULT_SETTINGS } from './settings-types';
import { hashPassword, passwordPolicyError } from './passwords';
import { todayISO } from './time';

declare global {
  // eslint-disable-next-line no-var
  var __svtcBoot: Promise<void> | undefined;
}

export const DEFAULT_SUBJECTS = [
  { code: 'INFO', name: 'Informatique', color: '#2453d6', description: 'Maîtrisez les bases et outils essentiels.' },
  { code: 'ALGO', name: 'Algorithmique et programmation', color: '#7c3aed', description: 'Apprenez à résoudre des problèmes et à créer des solutions.' },
  { code: 'PROG', name: 'Programmation', color: '#0891b2', description: 'Langages et projets de programmation.' },
  { code: 'SI', name: "Système d'information", color: '#059669', description: "Conception et gestion des systèmes d'information." },
  { code: 'MRCN', name: 'Maintenance - Réseau - Création numérique', color: '#d97706', description: 'Compétences pratiques et techniques.' },
  { code: 'RISI', name: 'Réseau - Internet - Sécurité informatique', color: '#dc2626', description: 'Réseaux, Internet et cybersécurité.' },
];

export const DEFAULT_CLASSES = [
  { code: '6E', name: 'Sixième', cycle: 'PREMIER', registrationFee: 5000, monthlyFee: 5000, color: '#0ea5e9' },
  { code: '5E', name: 'Cinquième', cycle: 'PREMIER', registrationFee: 5000, monthlyFee: 5000, color: '#06b6d4' },
  { code: '4E', name: 'Quatrième', cycle: 'PREMIER', registrationFee: 5000, monthlyFee: 5000, color: '#14b8a6' },
  { code: '3E', name: 'Troisième', cycle: 'PREMIER', registrationFee: 5000, monthlyFee: 6000, color: '#10b981' },
  { code: '2NDE', name: 'Seconde', cycle: 'SECOND', registrationFee: 5000, monthlyFee: 7500, color: '#6366f1' },
  { code: '1ERE', name: 'Première', cycle: 'SECOND', registrationFee: 5000, monthlyFee: 7500, color: '#8b5cf6' },
  { code: 'TLE', name: 'Terminale', cycle: 'SECOND', registrationFee: 5000, monthlyFee: 8000, color: '#a855f7' },
  { code: 'PTI', name: 'Première TI', cycle: 'SECOND', registrationFee: 5000, monthlyFee: 10000, color: '#e11d48' },
  { code: 'TTI', name: 'Terminale TI', cycle: 'SECOND', registrationFee: 5000, monthlyFee: 10000, color: '#f59e0b' },
];

export function yearLabelFor(iso: string) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const start = m >= 8 ? y : y - 1;
  return { label: `${start}-${start + 1}`, startDate: `${start}-09-01`, endDate: `${start + 1}-08-31` };
}

async function run() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7272026)`);

    await tx.insert(settings).values({ id: 1, data: DEFAULT_SETTINGS }).onConflictDoNothing();

    const [{ n: years }] = await tx.select({ n: count() }).from(academicYears);
    if (Number(years) === 0) {
      const y = yearLabelFor(todayISO());
      await tx.insert(academicYears).values({ ...y, isCurrent: true });
    }

    const [{ n: subj }] = await tx.select({ n: count() }).from(subjects);
    if (Number(subj) === 0) {
      await tx.insert(subjects).values(DEFAULT_SUBJECTS.map((s, i) => ({ ...s, sortOrder: i + 1 })));
    }

    const [{ n: cls }] = await tx.select({ n: count() }).from(classes);
    if (Number(cls) === 0) {
      await tx.insert(classes).values(DEFAULT_CLASSES.map((c, i) => ({ ...c, sortOrder: i + 1 })));
    }

    const [{ n: rm }] = await tx.select({ n: count() }).from(rooms);
    if (Number(rm) === 0) {
      await tx.insert(rooms).values([
        { name: 'Salle A', capacity: 30, rates: { '3': 500, '0': 1000 } },
        { name: 'Salle B', capacity: 30, rates: { '3': 500, '0': 1000 } },
      ]);
    }

    const [{ n: admins }] = await tx.select({ n: count() }).from(users).where(eq(users.role, 'ADMIN'));
    const initial = process.env.ADMIN_PASSWORD?.trim();
    if (Number(admins) === 0 && initial && !passwordPolicyError(initial)) {
      await tx.insert(users).values({
        role: 'ADMIN',
        username: 'admin',
        passwordHash: await hashPassword(initial),
        fullName: 'Administrateur SVTC',
        mustChangePassword: false,
      }).onConflictDoNothing();
    }
  });
}

/** Crée les données de référence au premier démarrage (idempotent, protégé par un verrou consultatif). */
export function ensureBootstrap(): Promise<void> {
  if (!globalThis.__svtcBoot) {
    globalThis.__svtcBoot = run().catch((e) => {
      globalThis.__svtcBoot = undefined;
      throw e;
    });
  }
  return globalThis.__svtcBoot;
}

export async function adminExists(): Promise<boolean> {
  await ensureBootstrap();
  const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, 'ADMIN'));
  return Number(n) > 0;
}
