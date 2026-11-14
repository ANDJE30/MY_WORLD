'use server';

import { revalidatePath } from 'next/cache';
import { count, eq, ne, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { academicYears, classes, subjects, rooms, students } from '@/db/schema';
import { assertRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { getSettings, saveSettings } from '@/lib/settings';
import { storeUpload, deleteFile } from '@/lib/files';
import { normalizePhone } from '@/lib/format';
import { toMinutes } from '@/lib/time';
import { DAYS } from '@/lib/constants';
import type { SessionDay } from '@/lib/settings-types';

const done = (message: string, ...paths: string[]): ActionResult => {
  for (const p of paths) revalidatePath(p);
  return { ok: true, message };
};

// ---------------------------------------------------------------- Paramètres
export async function saveIdentity(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const identity = z.object({
      name: zs.text('Nom de la structure', 120),
      shortName: zs.text('Sigle', 20),
      tagline: zs.optText(120),
      motto: zs.optText(300),
      slogan: zs.optText(200),
      description: zs.optText(600),
      host: zs.optText(120),
      address: zs.optText(160),
      city: zs.optText(80),
      country: zs.optText(80),
      whatsapp: zs.optText(20),
      email: z.union([z.literal(''), z.email('Adresse e-mail invalide.')]).optional(),
      website: zs.optText(120),
      directorName: zs.optText(100),
      directorTitle: zs.optText(80),
    }).parse(f);
    const phones = [f.phone1, f.phone2, f.phone3].map((p) => normalizePhone(p)).filter((p) => p.length >= 8);
    const current = await getSettings();
    await saveSettings({
      identity: {
        ...current.identity,
        ...Object.fromEntries(Object.entries(identity).map(([k, v]) => [k, v ?? ''])),
        whatsapp: normalizePhone(identity.whatsapp),
        phones,
      },
    });
    await audit(me, 'PARAMETRES_IDENTITE');
    return done('Identité du centre enregistrée.', '/', '/admin/parametres');
  });
}

export async function uploadLogo(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const which = fd.get('which') === 'banner' ? 'bannerFileId' : 'logoFileId';
    const id = await storeUpload(fd.get('file'), 'image', me.id);
    const s = await getSettings();
    const old = s.identity[which];
    await saveSettings({ identity: { ...s.identity, [which]: id } });
    await deleteFile(old);
    await audit(me, which === 'logoFileId' ? 'LOGO_MODIFIE' : 'BANDEAU_MODIFIE');
    return done(which === 'logoFileId' ? 'Logo mis à jour.' : 'Bandeau des documents PDF mis à jour.', '/', '/admin/parametres', '/admin');
  });
}

export async function resetLogo(which: 'logo' | 'banner') {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const key = which === 'banner' ? 'bannerFileId' : 'logoFileId';
    const s = await getSettings();
    await deleteFile(s.identity[key]);
    await saveSettings({ identity: { ...s.identity, [key]: null } });
    await audit(me, 'LOGO_REINITIALISE', { details: { which } });
    return done('Image d’origine SVTC rétablie.', '/', '/admin/parametres');
  });
}

function parseSlots(raw: string | undefined, start: string, end: string) {
  const parts = (raw ?? '').split(/[;,\n]+/).map((p) => p.trim()).filter(Boolean);
  const slots = parts.map((p) => {
    const m = p.match(/^(\d{1,2})[:h](\d{2})\s*[-–à]+\s*(\d{1,2})[:h](\d{2})$/);
    if (!m) throw new UserError(`Créneau invalide : « ${p} » (format attendu 15:30-16:45).`);
    const s = `${m[1].padStart(2, '0')}:${m[2]}`;
    const e = `${m[3].padStart(2, '0')}:${m[4]}`;
    if (toMinutes(e) <= toMinutes(s)) throw new UserError(`Créneau « ${p} » : l’heure de fin doit suivre l’heure de début.`);
    if (toMinutes(s) < toMinutes(start) || toMinutes(e) > toMinutes(end)) throw new UserError(`Le créneau « ${p} » dépasse les horaires de la séance (${start}–${end}).`);
    return { start: s, end: e };
  });
  slots.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < slots.length; i++) if (toMinutes(slots[i].start) < toMinutes(slots[i - 1].end)) throw new UserError('Deux créneaux se chevauchent.');
  return slots.length ? slots : [{ start, end }];
}

export async function saveSessions(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const days: SessionDay[] = [];
    for (let d = 0; d < 7; d++) {
      if (f[`on_${d}`] !== 'on') continue;
      const start = zs.time(`${DAYS[d]} — début`).parse(f[`start_${d}`]);
      const end = zs.time(`${DAYS[d]} — fin`).parse(f[`end_${d}`]);
      if (toMinutes(end) <= toMinutes(start)) throw new UserError(`${DAYS[d]} : l’heure de fin doit suivre l’heure de début.`);
      days.push({ day: d, label: DAYS[d], start, end, slots: parseSlots(f[`slots_${d}`], start, end) });
    }
    if (days.length === 0) throw new UserError('Activez au moins un jour de séance.');
    // Mercredi d'abord puis dimanche : ordre de la semaine scolaire (lundi → dimanche)
    days.sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
    await saveSettings({ sessions: { days } });
    await audit(me, 'PARAMETRES_SEANCES', { details: { days: days.map((d) => `${d.label} ${d.start}-${d.end}`) } });
    return done('Jours et horaires des séances enregistrés.', '/admin/parametres', '/admin/planning', '/');
  });
}

export async function saveFinanceSettings(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const months = fd.getAll('billingMonths').map(String).filter((m) => /^(0[1-9]|1[0-2])$/.test(m));
    if (months.length === 0) throw new UserError('Sélectionnez au moins un mois facturable.');
    const s = await getSettings();
    await saveSettings({
      billing: {
        receiptPrefix: (f.receiptPrefix ?? 'SVTC').replace(/[^A-Za-z0-9-]/g, '').slice(0, 10) || 'SVTC',
        billingMonths: months,
        rentBasis: z.enum(['PLANNED', 'ACTUAL', 'WINDOW']).parse(f.rentBasis ?? 'PLANNED'),
      },
      salary: {
        mode: z.enum(['PRORATA', 'HORAIRE']).parse(f.salaryMode ?? 'PRORATA'),
        capAt100: f.capAt100 === 'on',
        countBasis: z.enum(['ACTUAL_CAPPED', 'ACTUAL', 'PLANNED']).parse(f.countBasis ?? 'ACTUAL_CAPPED'),
      },
      sms: { senderName: (f.senderName ?? s.sms.senderName).slice(0, 11), signature: (f.signature ?? '').slice(0, 60) },
      security: { forcePasswordChange: f.forcePasswordChange === 'on' },
    });
    await audit(me, 'PARAMETRES_FINANCES');
    return done('Paramètres enregistrés.', '/admin/parametres');
  });
}

// ---------------------------------------------------------------- Années scolaires
export async function createYear(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const label = z.string().regex(/^\d{4}-\d{4}$/, 'Format attendu : 2027-2028').parse(fd.get('label'));
    const a = Number(label.slice(0, 4));
    if (Number(label.slice(5)) !== a + 1) throw new UserError('Les deux années doivent se suivre (ex. 2027-2028).');
    await db.insert(academicYears).values({ label, startDate: `${a}-09-01`, endDate: `${a + 1}-08-31`, isCurrent: false });
    await audit(me, 'ANNEE_CREEE', { details: { label } });
    return done(`Année ${label} créée.`, '/admin/parametres');
  });
}

export async function setCurrentYear(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    await db.transaction(async (tx) => {
      await tx.update(academicYears).set({ isCurrent: false }).where(ne(academicYears.id, id));
      await tx.update(academicYears).set({ isCurrent: true }).where(eq(academicYears.id, id));
    });
    await audit(me, 'ANNEE_ACTIVE', { entityId: id });
    return done('Année scolaire active modifiée.', '/admin');
  });
}

// ---------------------------------------------------------------- Classes
const classSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/, 'Code : 1 à 10 lettres ou chiffres (ex. PTI).'),
  name: zs.text('Nom de la classe', 60),
  cycle: z.enum(['PREMIER', 'SECOND']),
  registrationFee: zs.int("Frais d'inscription", 0, 1_000_000),
  monthlyFee: zs.int('Mensualité', 0, 1_000_000),
  capacity: zs.int('Effectif maximum', 1, 500),
  sortOrder: zs.int('Ordre', 0, 999),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2453d6'),
  isActive: zs.bool(),
});

export async function saveClass(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const data = classSchema.parse({ ...f, isActive: f.isActive ?? 'off' });
    const id = f.id ? Number(f.id) : null;
    if (id) await db.update(classes).set(data).where(eq(classes.id, id));
    else await db.insert(classes).values(data);
    await audit(me, id ? 'CLASSE_MODIFIEE' : 'CLASSE_CREEE', { entity: 'classe', entityId: id ?? data.code, details: { code: data.code } });
    return done(id ? 'Classe modifiée.' : `Classe ${data.name} ajoutée.`, '/admin/classes');
  });
}

export async function deleteClass(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [{ n }] = await db.select({ n: count() }).from(students).where(eq(students.classId, id));
    if (Number(n) > 0) {
      await db.update(classes).set({ isActive: false }).where(eq(classes.id, id));
      await audit(me, 'CLASSE_DESACTIVEE', { entity: 'classe', entityId: id });
      return done('Cette classe contient des élèves : elle a été désactivée (et non supprimée).', '/admin/classes');
    }
    await db.delete(classes).where(eq(classes.id, id));
    await audit(me, 'CLASSE_SUPPRIMEE', { entity: 'classe', entityId: id });
    return done('Classe supprimée.', '/admin/classes');
  });
}

// ---------------------------------------------------------------- Matières
const subjectSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/, 'Code : 1 à 10 lettres ou chiffres.'),
  name: zs.text('Nom de la matière', 100),
  description: zs.optText(300),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2453d6'),
  sortOrder: zs.int('Ordre', 0, 999),
  isActive: zs.bool(),
});

export async function saveSubject(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const data = subjectSchema.parse({ ...f, isActive: f.isActive ?? 'off' });
    const id = f.id ? Number(f.id) : null;
    if (id) await db.update(subjects).set(data).where(eq(subjects.id, id));
    else await db.insert(subjects).values(data);
    await audit(me, id ? 'MATIERE_MODIFIEE' : 'MATIERE_CREEE', { entity: 'matiere', entityId: id ?? data.code });
    return done(id ? 'Matière modifiée.' : `Matière ${data.name} ajoutée.`, '/admin/matieres');
  });
}

export async function deleteSubject(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    try {
      await db.delete(subjects).where(eq(subjects.id, id));
    } catch {
      await db.update(subjects).set({ isActive: false }).where(eq(subjects.id, id));
      return done('Matière utilisée : elle a été désactivée.', '/admin/matieres');
    }
    await audit(me, 'MATIERE_SUPPRIMEE', { entity: 'matiere', entityId: id });
    return done('Matière supprimée (attributions, créneaux et séances associés supprimés).', '/admin/matieres');
  });
}

// ---------------------------------------------------------------- Salles
export async function saveRoom(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const data = z.object({
      name: zs.text('Nom de la salle', 40),
      capacity: zs.int('Capacité', 1, 500),
      notes: zs.optText(300),
      isActive: zs.bool(),
    }).parse({ ...f, isActive: f.isActive ?? 'off' });
    const rates: Record<string, number> = {};
    for (let d = 0; d < 7; d++) {
      const v = f[`rate_${d}`];
      if (v !== undefined) rates[String(d)] = zs.int(`Tarif du ${DAYS[d].toLowerCase()}`, 0, 1_000_000).parse(v);
    }
    const id = f.id ? Number(f.id) : null;
    if (id) await db.update(rooms).set({ ...data, rates }).where(eq(rooms.id, id));
    else await db.insert(rooms).values({ ...data, rates });
    await audit(me, id ? 'SALLE_MODIFIEE' : 'SALLE_CREEE', { entity: 'salle', entityId: id ?? data.name, details: { rates } });
    return done(id ? 'Salle modifiée.' : `${data.name} ajoutée.`, '/admin/salles');
  });
}

export async function deleteRoom(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    await db.update(rooms).set({ isActive: false }).where(and(eq(rooms.id, id)));
    await audit(me, 'SALLE_DESACTIVEE', { entity: 'salle', entityId: id });
    return done('Salle désactivée (l’historique de location est conservé).', '/admin/salles');
  });
}

