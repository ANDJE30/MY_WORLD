'use server';

import { revalidatePath } from 'next/cache';
import { and, count, eq, inArray, isNull, sql, like, desc } from 'drizzle-orm';
import Papa from 'papaparse';
import { z } from 'zod';
import { db } from '@/db';
import { students, parents, tutors, users, classes, payments, assignments, seances, authSessions } from '@/db/schema';
import { assertRole, revokeUserSessions } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { easyPassword, hashPassword, slugUsername } from '@/lib/passwords';
import { isValidCmPhone, normalizePhone } from '@/lib/format';
import { todayISO } from '@/lib/time';

export type Credential = { name: string; role: 'ENCADREUR' | 'PARENT' | 'ADMIN'; username: string; password: string; phone: string | null };

const ok = (message: string, paths: string[], data?: unknown): ActionResult => {
  for (const p of paths) revalidatePath(p);
  return { ok: true, message, data };
};

const phoneField = (label: string) =>
  z.string({ error: `${label} : obligatoire.` }).transform((v) => normalizePhone(v)).refine((v) => isValidCmPhone(v), `${label} : numéro camerounais à 9 chiffres attendu (6XX XX XX XX).`);

async function nextMatricule(tx: typeof db, yearLabel: string, prefix: string) {
  const base = `${prefix}-${yearLabel.slice(2, 4)}`;
  const [last] = await tx.select({ m: students.matricule }).from(students).where(like(students.matricule, `${base}-%`)).orderBy(desc(students.matricule)).limit(1);
  const n = last ? Number(last.m.split('-').pop()) + 1 : 1;
  return `${base}-${String(n).padStart(4, '0')}`;
}

/** Trouve ou crée la fiche parent à partir du numéro de téléphone (identifiant unique). */
async function upsertParent(tx: typeof db, p: { fullName?: string; phone?: string; relation?: string }) {
  if (!p.phone) return null;
  const phone = normalizePhone(p.phone);
  if (!isValidCmPhone(phone)) throw new UserError(`Téléphone du parent invalide : ${p.phone}`);
  const [existing] = await tx.select().from(parents).where(eq(parents.phone, phone)).limit(1);
  if (existing) return existing.id;
  if (!p.fullName) throw new UserError('Nom du parent obligatoire pour un nouveau numéro.');
  const [row] = await tx.insert(parents).values({ fullName: p.fullName.trim(), phone, relation: p.relation || 'Parent' }).returning({ id: parents.id });
  return row.id;
}

// ---------------------------------------------------------------- Élèves
const studentSchema = z.object({
  lastName: zs.text('Nom', 60),
  firstName: zs.text('Prénom(s)', 80),
  gender: z.enum(['M', 'F']),
  birthDate: zs.date('Date de naissance').optional(),
  school: zs.optText(120),
  phone: zs.optText(20),
  classId: zs.id('Classe'),
  discountPct: zs.int('Réduction', 0, 100),
  status: z.enum(['ACTIF', 'SUSPENDU', 'ABANDON']),
  enrolledAt: zs.date("Date d'inscription"),
  notes: zs.optText(500),
});

export async function saveStudent(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const d = studentSchema.parse({ discountPct: '0', status: 'ACTIF', enrolledAt: todayISO(), ...f });
    const year = await getCurrentYear();
    const s = await getSettings();
    const id = f.id ? Number(f.id) : null;
    const result = await db.transaction(async (tx) => {
      let parentId: number | null = f.parentId ? Number(f.parentId) : null;
      if (!parentId && f.parentPhone) parentId = await upsertParent(tx as unknown as typeof db, { fullName: f.parentName, phone: f.parentPhone, relation: f.relation });
      const values = { ...d, phone: d.phone ? normalizePhone(d.phone) : null, parentId, lastName: d.lastName.toUpperCase() };
      if (id) {
        await tx.update(students).set(values).where(eq(students.id, id));
        return id;
      }
      const matricule = await nextMatricule(tx as unknown as typeof db, year.label, s.billing.receiptPrefix);
      const [row] = await tx.insert(students).values({ ...values, matricule, academicYearId: year.id }).returning({ id: students.id });
      return row.id;
    });
    await audit(me, id ? 'ELEVE_MODIFIE' : 'ELEVE_INSCRIT', { entity: 'eleve', entityId: result, details: { nom: `${d.lastName} ${d.firstName}` } });
    return ok(id ? 'Fiche élève enregistrée.' : `${d.firstName} ${d.lastName.toUpperCase()} est inscrit(e).`, ['/admin/eleves', '/admin'], result);
  });
}

export async function deleteStudent(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [{ n }] = await db.select({ n: count() }).from(payments).where(eq(payments.studentId, id));
    if (Number(n) > 0) {
      await db.update(students).set({ status: 'ABANDON' }).where(eq(students.id, id));
      await audit(me, 'ELEVE_SORTI', { entity: 'eleve', entityId: id });
      return ok('Cet élève a des paiements enregistrés : il a été marqué « a quitté le centre » (historique conservé).', ['/admin/eleves']);
    }
    await db.delete(students).where(eq(students.id, id));
    await audit(me, 'ELEVE_SUPPRIME', { entity: 'eleve', entityId: id });
    return ok('Élève supprimé.', ['/admin/eleves']);
  });
}

const HEADERS: Record<string, string> = {
  nom: 'lastName', noms: 'lastName', prenom: 'firstName', prenoms: 'firstName', sexe: 'gender', genre: 'gender', classe: 'classe',
  date_naissance: 'birthDate', naissance: 'birthDate', etablissement: 'school', ecole: 'school', telephone_eleve: 'phone',
  parent: 'parentName', nom_parent: 'parentName', telephone_parent: 'parentPhone', telephone: 'parentPhone', contact_parent: 'parentPhone', lien: 'relation', relation: 'relation',
};

function normHeader(h: string) {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseDate(v?: string): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
}

/** Import CSV (ou copier-coller depuis Excel) des élèves et de leurs parents. */
export async function importStudents(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    let text = String(fd.get('text') ?? '');
    const file = fd.get('file');
    if (file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) throw new UserError('Fichier trop volumineux (2 Mo maximum).');
      text = await file.text();
    }
    text = text.replace(/^﻿/, '').trim();
    if (!text) throw new UserError('Collez la liste ou choisissez un fichier CSV.');
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, delimiter: '', transformHeader: (h) => HEADERS[normHeader(h)] ?? normHeader(h) });
    const rows = parsed.data.slice(0, 2000);
    if (rows.length === 0) throw new UserError('Aucune ligne trouvée. Vérifiez la ligne d’en-tête (nom;prenom;sexe;classe;…).');
    const year = await getCurrentYear();
    const s = await getSettings();
    const cls = await db.select().from(classes);
    const byCode = new Map(cls.flatMap((c) => [[c.code.toUpperCase(), c.id], [c.name.toUpperCase(), c.id]] as [string, number][]));
    const defaultClass = fd.get('classId') ? Number(fd.get('classId')) : null;
    let created = 0;
    const errors: string[] = [];
    await db.transaction(async (tx) => {
      for (const [i, r] of rows.entries()) {
        const line = i + 2;
        const lastName = r.lastName?.trim();
        const firstName = r.firstName?.trim();
        if (!lastName || !firstName) { errors.push(`Ligne ${line} : nom ou prénom manquant.`); continue; }
        const classId = r.classe ? byCode.get(r.classe.trim().toUpperCase()) : defaultClass;
        if (!classId) { errors.push(`Ligne ${line} : classe « ${r.classe ?? ''} » inconnue.`); continue; }
        let parentId: number | null = null;
        try {
          if (r.parentPhone) parentId = await upsertParent(tx as unknown as typeof db, { fullName: r.parentName || `Parent de ${firstName} ${lastName}`, phone: r.parentPhone, relation: r.relation });
        } catch (e) {
          errors.push(`Ligne ${line} : ${(e as Error).message}`);
          continue;
        }
        const g = (r.gender ?? 'M').trim().toUpperCase().startsWith('F') ? 'F' : 'M';
        const matricule = await nextMatricule(tx as unknown as typeof db, year.label, s.billing.receiptPrefix);
        await tx.insert(students).values({
          matricule, lastName: lastName.toUpperCase(), firstName, gender: g, birthDate: parseDate(r.birthDate) ?? null, school: r.school?.trim() || null,
          phone: r.phone ? normalizePhone(r.phone) : null, classId, academicYearId: year.id, parentId, enrolledAt: todayISO(),
        });
        created++;
      }
    });
    await audit(me, 'ELEVES_IMPORTES', { details: { created, errors: errors.length } });
    revalidatePath('/admin/eleves');
    revalidatePath('/admin/parents');
    return {
      ok: true,
      message: `${created} élève(s) importé(s)${errors.length ? ` — ${errors.length} ligne(s) ignorée(s)` : ''}.`,
      data: errors.slice(0, 30),
    };
  });
}

// ---------------------------------------------------------------- Parents
const parentSchema = z.object({
  fullName: zs.text('Nom du parent', 100),
  phone: phoneField('Téléphone'),
  phone2: zs.optText(20),
  whatsapp: zs.optText(20),
  email: z.union([z.literal(''), z.email('E-mail invalide.')]).optional(),
  profession: zs.optText(80),
  address: zs.optText(160),
  relation: zs.text('Lien avec l’élève', 30),
});

export async function saveParent(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const d = parentSchema.parse({ relation: 'Parent', ...f });
    const values = { ...d, phone2: d.phone2 ? normalizePhone(d.phone2) : null, whatsapp: d.whatsapp ? normalizePhone(d.whatsapp) : null, email: d.email || null };
    const id = f.id ? Number(f.id) : null;
    if (id) {
      await db.update(parents).set(values).where(eq(parents.id, id));
      const [p] = await db.select().from(parents).where(eq(parents.id, id));
      if (p?.userId) await db.update(users).set({ username: d.phone, fullName: d.fullName, phone: d.phone }).where(eq(users.id, p.userId));
    } else await db.insert(parents).values(values);
    await audit(me, id ? 'PARENT_MODIFIE' : 'PARENT_CREE', { entity: 'parent', entityId: id ?? d.phone });
    return ok(id ? 'Fiche parent enregistrée.' : 'Parent ajouté.', ['/admin/parents']);
  });
}

export async function deleteParent(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [p] = await db.select().from(parents).where(eq(parents.id, id));
    if (!p) throw new UserError('Parent introuvable.');
    await db.transaction(async (tx) => {
      await tx.update(students).set({ parentId: null }).where(eq(students.parentId, id));
      await tx.delete(parents).where(eq(parents.id, id));
      if (p.userId) await tx.delete(users).where(eq(users.id, p.userId));
    });
    await audit(me, 'PARENT_SUPPRIME', { entity: 'parent', entityId: id });
    return ok('Parent supprimé (ses enfants restent inscrits).', ['/admin/parents', '/admin/eleves']);
  });
}

async function createParentAccount(parentId: number): Promise<Credential> {
  const [p] = await db.select().from(parents).where(eq(parents.id, parentId));
  if (!p) throw new UserError('Parent introuvable.');
  const s = await getSettings();
  const password = easyPassword();
  const passwordHash = await hashPassword(password);
  if (p.userId) {
    await db.update(users).set({ passwordHash, username: p.phone, fullName: p.fullName, isActive: true, failedAttempts: 0, lockedUntil: null, mustChangePassword: s.security.forcePasswordChange }).where(eq(users.id, p.userId));
    await revokeUserSessions(p.userId);
  } else {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, p.phone));
    if (taken) throw new UserError(`L’identifiant ${p.phone} est déjà utilisé par un autre compte.`);
    const [u] = await db.insert(users).values({ role: 'PARENT', username: p.phone, passwordHash, fullName: p.fullName, phone: p.phone, mustChangePassword: s.security.forcePasswordChange }).returning({ id: users.id });
    await db.update(parents).set({ userId: u.id }).where(eq(parents.id, p.id));
  }
  return { name: p.fullName, role: 'PARENT', username: p.phone, password, phone: p.phone };
}

export async function generateParentAccount(parentId: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const c = await createParentAccount(parentId);
    await audit(me, 'COMPTE_PARENT_GENERE', { entity: 'parent', entityId: parentId });
    return ok('Accès générés. Transmettez-les au parent.', ['/admin/parents', '/admin/comptes'], [c]);
  });
}

export async function generateAllParentAccounts() {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const list = await db.select({ id: parents.id }).from(parents).where(isNull(parents.userId));
    const creds: Credential[] = [];
    const errors: string[] = [];
    for (const p of list) {
      try {
        creds.push(await createParentAccount(p.id));
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    await audit(me, 'COMPTES_PARENTS_GENERES', { details: { n: creds.length } });
    if (creds.length === 0) throw new UserError(errors[0] ?? 'Tous les parents ont déjà un compte.');
    return ok(`${creds.length} compte(s) parent créé(s).`, ['/admin/parents', '/admin/comptes'], creds);
  });
}

// ---------------------------------------------------------------- Encadreurs
const tutorSchema = z.object({
  lastName: zs.text('Nom', 60),
  firstName: zs.text('Prénom(s)', 80),
  gender: z.enum(['M', 'F']),
  phone: phoneField('Téléphone'),
  email: z.union([z.literal(''), z.email('E-mail invalide.')]).optional(),
  specialty: zs.optText(120),
  diploma: zs.optText(120),
  address: zs.optText(160),
  baseSalary: zs.int('Salaire mensuel', 0, 10_000_000),
  hourlyRate: zs.int('Taux horaire', 0, 1_000_000),
  hireDate: zs.date('Date de prise de service').optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2453d6'),
  isActive: zs.bool(),
});

export async function saveTutor(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const d = tutorSchema.parse({ baseSalary: '0', hourlyRate: '0', isActive: f.isActive ?? 'off', ...f });
    const values = { ...d, lastName: d.lastName.toUpperCase(), email: d.email || null, hireDate: d.hireDate ?? null };
    const id = f.id ? Number(f.id) : null;
    let creds: Credential[] | undefined;
    if (id) {
      await db.update(tutors).set(values).where(eq(tutors.id, id));
      const [t] = await db.select().from(tutors).where(eq(tutors.id, id));
      if (t?.userId) {
        await db.update(users).set({ fullName: `${t.firstName} ${t.lastName}`, phone: t.phone, isActive: t.isActive }).where(eq(users.id, t.userId));
        if (!t.isActive) await revokeUserSessions(t.userId);
      }
    } else {
      const [row] = await db.insert(tutors).values(values).returning({ id: tutors.id });
      if (f.createAccount === 'on') creds = [await createTutorAccount(row.id)];
    }
    await audit(me, id ? 'ENCADREUR_MODIFIE' : 'ENCADREUR_CREE', { entity: 'encadreur', entityId: id ?? `${d.lastName} ${d.firstName}` });
    return ok(id ? 'Fiche encadreur enregistrée.' : `Encadreur ajouté${creds ? ' avec son compte d’accès' : ''}.`, ['/admin/encadreurs'], creds);
  });
}

async function createTutorAccount(tutorId: number): Promise<Credential> {
  const [t] = await db.select().from(tutors).where(eq(tutors.id, tutorId));
  if (!t) throw new UserError('Encadreur introuvable.');
  const s = await getSettings();
  const password = easyPassword();
  const passwordHash = await hashPassword(password);
  if (t.userId) {
    const [u] = await db.update(users).set({ passwordHash, isActive: true, failedAttempts: 0, lockedUntil: null, mustChangePassword: s.security.forcePasswordChange }).where(eq(users.id, t.userId)).returning();
    await revokeUserSessions(t.userId);
    return { name: `${t.firstName} ${t.lastName}`, role: 'ENCADREUR', username: u.username, password, phone: t.phone };
  }
  const base = slugUsername(t.firstName, t.lastName);
  let username = base;
  for (let i = 2; i < 100; i++) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
    if (!taken) break;
    username = `${base}${i}`;
  }
  const [u] = await db.insert(users).values({ role: 'ENCADREUR', username, passwordHash, fullName: `${t.firstName} ${t.lastName}`, phone: t.phone, mustChangePassword: s.security.forcePasswordChange }).returning({ id: users.id });
  await db.update(tutors).set({ userId: u.id }).where(eq(tutors.id, t.id));
  return { name: `${t.firstName} ${t.lastName}`, role: 'ENCADREUR', username, password, phone: t.phone };
}

export async function generateTutorAccount(tutorId: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const c = await createTutorAccount(tutorId);
    await audit(me, 'COMPTE_ENCADREUR_GENERE', { entity: 'encadreur', entityId: tutorId });
    return ok('Identifiants générés. Transmettez-les à l’encadreur.', ['/admin/encadreurs', '/admin/comptes'], [c]);
  });
}

export async function generateAllTutorAccounts() {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const list = await db.select({ id: tutors.id }).from(tutors).where(and(isNull(tutors.userId), eq(tutors.isActive, true)));
    const creds: Credential[] = [];
    for (const t of list) creds.push(await createTutorAccount(t.id));
    if (creds.length === 0) throw new UserError('Tous les encadreurs actifs ont déjà un compte.');
    await audit(me, 'COMPTES_ENCADREURS_GENERES', { details: { n: creds.length } });
    return ok(`${creds.length} compte(s) encadreur créé(s).`, ['/admin/encadreurs', '/admin/comptes'], creds);
  });
}

export async function deleteTutor(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [t] = await db.select().from(tutors).where(eq(tutors.id, id));
    if (!t) throw new UserError('Encadreur introuvable.');
    const [{ n }] = await db.select({ n: count() }).from(seances).where(and(eq(seances.tutorId, id), inArray(seances.status, ['TERMINEE', 'EN_COURS'])));
    if (Number(n) > 0) {
      await db.update(tutors).set({ isActive: false }).where(eq(tutors.id, id));
      if (t.userId) {
        await db.update(users).set({ isActive: false }).where(eq(users.id, t.userId));
        await revokeUserSessions(t.userId);
      }
      await db.delete(assignments).where(eq(assignments.tutorId, id));
      await audit(me, 'ENCADREUR_DESACTIVE', { entity: 'encadreur', entityId: id });
      return ok('Encadreur désactivé : ses séances effectuées sont conservées pour la paie, son compte est bloqué.', ['/admin/encadreurs']);
    }
    await db.transaction(async (tx) => {
      await tx.delete(tutors).where(eq(tutors.id, id));
      if (t.userId) await tx.delete(users).where(eq(users.id, t.userId));
    });
    await audit(me, 'ENCADREUR_SUPPRIME', { entity: 'encadreur', entityId: id });
    return ok('Encadreur et compte supprimés.', ['/admin/encadreurs']);
  });
}

// ---------------------------------------------------------------- Comptes
export async function resetUserPassword(userId: string) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) throw new UserError('Compte introuvable.');
    const s = await getSettings();
    const password = easyPassword();
    await db.update(users).set({ passwordHash: await hashPassword(password), failedAttempts: 0, lockedUntil: null, mustChangePassword: u.id === me.id ? false : s.security.forcePasswordChange }).where(eq(users.id, userId));
    await revokeUserSessions(userId, u.id === me.id ? me.sessionId : undefined);
    await audit(me, 'MOT_DE_PASSE_REINITIALISE', { entity: 'compte', entityId: u.username });
    const c: Credential = { name: u.fullName, role: u.role, username: u.username, password, phone: u.phone };
    return ok('Nouveau mot de passe généré.', ['/admin/comptes'], [c]);
  });
}

export async function toggleUser(userId: string) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    if (userId === me.id) throw new UserError('Vous ne pouvez pas désactiver votre propre compte.');
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) throw new UserError('Compte introuvable.');
    await db.update(users).set({ isActive: !u.isActive, failedAttempts: 0, lockedUntil: null }).where(eq(users.id, userId));
    if (u.isActive) await db.delete(authSessions).where(eq(authSessions.userId, userId));
    await audit(me, u.isActive ? 'COMPTE_DESACTIVE' : 'COMPTE_ACTIVE', { entity: 'compte', entityId: u.username });
    return ok(u.isActive ? 'Compte désactivé et sessions fermées.' : 'Compte réactivé.', ['/admin/comptes']);
  });
}

export async function deleteUserAccount(userId: string) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    if (userId === me.id) throw new UserError('Vous ne pouvez pas supprimer votre propre compte.');
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) throw new UserError('Compte introuvable.');
    if (u.role === 'ADMIN') {
      const [{ n }] = await db.select({ n: count() }).from(users).where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)));
      if (Number(n) <= 1) throw new UserError('Impossible de supprimer le dernier administrateur.');
    }
    await db.delete(users).where(eq(users.id, userId));
    await audit(me, 'COMPTE_SUPPRIME', { entity: 'compte', entityId: u.username });
    return ok('Compte supprimé (la fiche encadreur ou parent est conservée).', ['/admin/comptes', '/admin/encadreurs', '/admin/parents']);
  });
}

export async function createAdmin(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const d = z.object({
      fullName: zs.text('Nom complet', 80),
      username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, 'Identifiant : 3 à 32 caractères (lettres, chiffres, point, tiret).'),
      phone: zs.optText(20),
    }).parse(f);
    const password = easyPassword();
    await db.insert(users).values({ role: 'ADMIN', username: d.username, fullName: d.fullName, phone: d.phone ? normalizePhone(d.phone) : null, passwordHash: await hashPassword(password), mustChangePassword: true });
    await audit(me, 'ADMIN_CREE', { entity: 'compte', entityId: d.username });
    const c: Credential = { name: d.fullName, role: 'ADMIN', username: d.username, password, phone: d.phone ?? null };
    return ok('Administrateur créé (changement du mot de passe exigé à la première connexion).', ['/admin/comptes'], [c]);
  });
}

// ---------------------------------------------------------------- Attributions
export async function saveAssignments(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const year = await getCurrentYear();
    const entries: { classId: number; subjectId: number; tutorId: number; sessionsPerWeek: number }[] = [];
    for (const [k, v] of fd.entries()) {
      const m = k.match(/^t_(\d+)_(\d+)$/);
      if (!m || !v) continue;
      const n = Number(fd.get(`n_${m[1]}_${m[2]}`) ?? 1);
      entries.push({ classId: Number(m[1]), subjectId: Number(m[2]), tutorId: Number(v), sessionsPerWeek: Math.min(6, Math.max(1, Number.isFinite(n) ? n : 1)) });
    }
    const scope = String(fd.get('scope') ?? '').split(',').filter(Boolean).map(Number);
    await db.transaction(async (tx) => {
      const where = scope.length ? and(eq(assignments.academicYearId, year.id), inArray(assignments.classId, scope)) : eq(assignments.academicYearId, year.id);
      await tx.delete(assignments).where(where);
      if (entries.length) await tx.insert(assignments).values(entries.map((e) => ({ ...e, academicYearId: year.id })));
    });
    await audit(me, 'ATTRIBUTIONS_ENREGISTREES', { details: { n: entries.length } });
    return ok(`${entries.length} attribution(s) enregistrée(s).`, ['/admin/attributions', '/admin/planning']);
  });
}

export async function linkStudentsToParent(fd: FormData) {
  return safe(async () => {
    await assertRole('ADMIN');
    const parentId = Number(fd.get('parentId'));
    const ids = fd.getAll('studentIds').map(Number).filter(Boolean);
    if (!parentId || ids.length === 0) throw new UserError('Sélectionnez au moins un élève.');
    await db.update(students).set({ parentId }).where(inArray(students.id, ids));
    return ok('Enfant(s) rattaché(s) au parent.', ['/admin/parents', '/admin/eleves']);
  });
}

