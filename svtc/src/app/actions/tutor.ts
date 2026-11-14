'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { seances, attendances, students, assignments, documents, evaluations, grades } from '@/db/schema';
import { assertRole, type SessionUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { getCurrentYear } from '@/lib/settings';
import { storeUpload } from '@/lib/files';
import { addDays, localToDate, todayISO, toMinutes } from '@/lib/time';
import { DOCUMENT_TYPES, EVALUATION_TYPES } from '@/lib/constants';

const EDIT_WINDOW_DAYS = 7;

async function ownSeance(me: SessionUser, id: number) {
  const [s] = await db.select().from(seances).where(eq(seances.id, id));
  if (!s || s.tutorId !== me.tutorId) throw new UserError('Cette séance ne vous est pas attribuée.');
  return s;
}

function editable(s: typeof seances.$inferSelect) {
  if (s.status === 'ANNULEE') throw new UserError('Cette séance a été annulée par l’administration.');
  if (s.validated) throw new UserError('Les heures de cette séance ont déjà été validées : contactez l’administration pour toute correction.');
  if (s.date > todayISO()) throw new UserError('Cette séance n’a pas encore eu lieu.');
  if (s.date < addDays(todayISO(), -EDIT_WINDOW_DAYS)) throw new UserError(`Délai de saisie dépassé (${EDIT_WINDOW_DAYS} jours) : contactez l’administration.`);
}

const refresh = (id?: number) => {
  revalidatePath('/encadreur');
  revalidatePath('/encadreur/seances');
  if (id) revalidatePath(`/encadreur/seances/${id}`);
  revalidatePath('/admin/seances');
};

export async function startSeance(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    const s = await ownSeance(me, id);
    if (s.date !== todayISO()) throw new UserError('Vous ne pouvez démarrer qu’une séance du jour. Pour une autre date, saisissez les heures manuellement.');
    if (s.status !== 'PLANIFIEE') throw new UserError('Cette séance est déjà démarrée ou terminée.');
    await db.update(seances).set({ status: 'EN_COURS', actualStart: new Date(), updatedAt: new Date() }).where(eq(seances.id, id));
    await audit(me, 'SEANCE_DEMARREE', { entity: 'seance', entityId: id });
    refresh(id);
    return { ok: true, message: 'Séance démarrée. Bon cours ! Pensez à faire l’appel.' };
  });
}

export async function endSeance(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    const s = await ownSeance(me, id);
    if (s.status !== 'EN_COURS') throw new UserError('Cette séance n’est pas en cours.');
    const [kids, att] = await Promise.all([
      db.select({ id: students.id }).from(students).where(and(eq(students.classId, s.classId), eq(students.academicYearId, s.academicYearId), eq(students.status, 'ACTIF'))),
      db.select({ id: attendances.id }).from(attendances).where(eq(attendances.seanceId, id)),
    ]);
    if (kids.length > 0 && att.length === 0) throw new UserError('Faites l’appel avant de terminer la séance.');
    await db.update(seances).set({ status: 'TERMINEE', actualEnd: new Date(), updatedAt: new Date() }).where(eq(seances.id, id));
    await audit(me, 'SEANCE_TERMINEE', { entity: 'seance', entityId: id });
    refresh(id);
    return { ok: true, message: 'Séance terminée. Vos heures sont enregistrées.' };
  });
}

export async function setSeanceTimes(id: number, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    const s = await ownSeance(me, id);
    editable(s);
    const start = zs.time('Heure de début').parse(fd.get('start'));
    const endRaw = String(fd.get('end') ?? '');
    const end = endRaw ? zs.time('Heure de fin').parse(endRaw) : null;
    if (end && toMinutes(end) <= toMinutes(start)) throw new UserError('L’heure de fin doit suivre l’heure de début.');
    const actualStart = localToDate(s.date, start);
    const actualEnd = end ? localToDate(s.date, end) : null;
    if (actualEnd && actualEnd.getTime() > Date.now() + 5 * 60_000) throw new UserError('L’heure de fin ne peut pas être dans le futur.');
    await db.update(seances).set({ actualStart, actualEnd, status: actualEnd ? 'TERMINEE' : 'EN_COURS', updatedAt: new Date() }).where(eq(seances.id, id));
    await audit(me, 'SEANCE_HEURES_SAISIES', { entity: 'seance', entityId: id, details: { start, end } });
    refresh(id);
    return { ok: true, message: 'Heures de la séance enregistrées.' };
  });
}

export async function saveAttendance(id: number, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    const s = await ownSeance(me, id);
    editable(s);
    const kids = await db.select({ id: students.id }).from(students).where(and(eq(students.classId, s.classId), eq(students.academicYearId, s.academicYearId)));
    const allowed = new Set(kids.map((k) => k.id));
    const entries: { studentId: number; status: 'PRESENT' | 'ABSENT' | 'RETARD' | 'EXCUSE'; comment: string | null }[] = [];
    for (const [k, v] of fd.entries()) {
      const m = k.match(/^st_(\d+)$/);
      if (!m) continue;
      const sid = Number(m[1]);
      if (!allowed.has(sid)) continue;
      const status = z.enum(['PRESENT', 'ABSENT', 'RETARD', 'EXCUSE']).parse(v);
      const comment = String(fd.get(`c_${sid}`) ?? '').trim().slice(0, 200) || null;
      entries.push({ studentId: sid, status, comment });
    }
    if (entries.length === 0) throw new UserError('Aucun élève pointé.');
    for (const e of entries) {
      await db.insert(attendances).values({ seanceId: id, ...e, recordedBy: me.id })
        .onConflictDoUpdate({ target: [attendances.seanceId, attendances.studentId], set: { status: e.status, comment: e.comment, recordedBy: me.id, recordedAt: new Date() } });
    }
    await audit(me, 'APPEL_ENREGISTRE', { entity: 'seance', entityId: id, details: { n: entries.length, absents: entries.filter((e) => e.status === 'ABSENT').length } });
    refresh(id);
    const abs = entries.filter((e) => e.status === 'ABSENT').length;
    return { ok: true, message: `Appel enregistré : ${entries.length - abs} présent(s), ${abs} absent(s).` };
  });
}

export async function saveSeanceContent(id: number, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    const s = await ownSeance(me, id);
    if (s.validated) throw new UserError('Séance validée : contenu verrouillé.');
    const d = z.object({ topic: zs.optText(200), summary: zs.optText(2000), homework: zs.optText(1000) }).parse(formObject(fd));
    await db.update(seances).set({ topic: d.topic ?? null, summary: d.summary ?? null, homework: d.homework ?? null, updatedAt: new Date() }).where(eq(seances.id, id));
    refresh(id);
    return { ok: true, message: 'Contenu de la séance enregistré.' };
  });
}

async function assertAssigned(me: SessionUser, classId: number, subjectId?: number) {
  const year = await getCurrentYear();
  const conds = [eq(assignments.tutorId, me.tutorId!), eq(assignments.classId, classId), eq(assignments.academicYearId, year.id)];
  if (subjectId) conds.push(eq(assignments.subjectId, subjectId));
  const [a] = await db.select({ id: assignments.id }).from(assignments).where(and(...conds)).limit(1);
  if (!a) throw new UserError(subjectId ? 'Cette matière ne vous est pas attribuée dans cette classe.' : 'Cette classe ne vous est pas attribuée.');
  return year;
}

export async function uploadDocument(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    const f = formObject(fd);
    if (f.pair) [f.classId, f.subjectId] = f.pair.split('_');
    const d = z.object({
      title: zs.text('Titre', 160),
      type: z.enum(Object.keys(DOCUMENT_TYPES) as [string, ...string[]]),
      classId: zs.id('Classe'),
      subjectId: zs.id('Matière'),
      description: zs.optText(500),
      seanceId: z.coerce.number().int().positive().optional(),
    }).parse(f);
    const year = await assertAssigned(me, d.classId, d.subjectId);
    if (d.seanceId) await ownSeance(me, d.seanceId);
    const fileId = await storeUpload(fd.get('file'), 'pdf', me.id);
    const [doc] = await db.insert(documents).values({ ...d, description: d.description ?? null, seanceId: d.seanceId ?? null, tutorId: me.tutorId, uploadedBy: me.id, fileId, academicYearId: year.id }).returning({ id: documents.id });
    await audit(me, 'DOCUMENT_DEPOSE', { entity: 'document', entityId: doc.id, details: { title: d.title } });
    revalidatePath('/encadreur/documents');
    revalidatePath('/admin/documents');
    if (d.seanceId) revalidatePath(`/encadreur/seances/${d.seanceId}`);
    return { ok: true, message: 'Document déposé. L’administration en est informée.' };
  });
}

export async function createEvaluation(fd: FormData): Promise<ActionResult> {
  const r = await safe(async () => {
    const me = await assertRole('ENCADREUR');
    const d = z.object({
      classId: zs.id('Classe'), subjectId: zs.id('Matière'), title: zs.text('Intitulé', 160),
      type: z.enum(Object.keys(EVALUATION_TYPES) as [string, ...string[]]), date: zs.date('Date'),
      maxScore: z.coerce.number().min(1, 'Barème invalide').max(100), coefficient: z.coerce.number().min(0.5).max(10),
      seanceId: z.coerce.number().int().positive().optional(),
    }).parse((() => {
      const f: Record<string, string | undefined> = { maxScore: '20', coefficient: '1', ...formObject(fd) };
      if (f.pair) [f.classId, f.subjectId] = f.pair.split('_');
      return f;
    })());
    if (d.date > todayISO()) throw new UserError('La date de l’évaluation ne peut pas être dans le futur.');
    const year = await assertAssigned(me, d.classId, d.subjectId);
    const [ev] = await db.insert(evaluations).values({ ...d, seanceId: d.seanceId ?? null, tutorId: me.tutorId, academicYearId: year.id }).returning({ id: evaluations.id });
    await audit(me, 'EVALUATION_CREEE', { entity: 'evaluation', entityId: ev.id });
    return { ok: true, data: ev.id };
  });
  if (r.ok) redirect(`/encadreur/notes/${r.data}`);
  return r;
}

async function ownEvaluation(me: SessionUser, id: number) {
  const [ev] = await db.select().from(evaluations).where(eq(evaluations.id, id));
  if (!ev || ev.tutorId !== me.tutorId) throw new UserError('Évaluation introuvable.');
  return ev;
}

export async function saveGrades(id: number, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    const ev = await ownEvaluation(me, id);
    const kids = await db.select({ id: students.id }).from(students).where(and(eq(students.classId, ev.classId), eq(students.academicYearId, ev.academicYearId)));
    const allowed = new Set(kids.map((k) => k.id));
    let n = 0;
    for (const [k, raw] of fd.entries()) {
      const m = k.match(/^g_(\d+)$/);
      if (!m || !allowed.has(Number(m[1]))) continue;
      const v = String(raw).trim().replace(',', '.').toLowerCase();
      const sid = Number(m[1]);
      if (v === '') {
        await db.delete(grades).where(and(eq(grades.evaluationId, id), eq(grades.studentId, sid)));
        continue;
      }
      const absent = v === 'abs' || v === 'a';
      const score = absent ? null : Number(v);
      if (!absent && (!Number.isFinite(score) || score! < 0 || score! > ev.maxScore)) throw new UserError(`Note invalide « ${raw} » : saisissez un nombre entre 0 et ${ev.maxScore}, ou « abs ».`);
      const comment = String(fd.get(`c_${sid}`) ?? '').trim().slice(0, 200) || null;
      await db.insert(grades).values({ evaluationId: id, studentId: sid, score, absent, comment })
        .onConflictDoUpdate({ target: [grades.evaluationId, grades.studentId], set: { score, absent, comment, updatedAt: new Date() } });
      n++;
    }
    await audit(me, 'NOTES_SAISIES', { entity: 'evaluation', entityId: id, details: { n } });
    revalidatePath(`/encadreur/notes/${id}`);
    revalidatePath('/encadreur/notes');
    return { ok: true, message: `${n} note(s) enregistrée(s).` };
  });
}

export async function deleteEvaluation(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ENCADREUR');
    await ownEvaluation(me, id);
    await db.delete(evaluations).where(eq(evaluations.id, id));
    await audit(me, 'EVALUATION_SUPPRIMEE', { entity: 'evaluation', entityId: id });
    revalidatePath('/encadreur/notes');
    return { ok: true, message: 'Évaluation supprimée.' };
  });
}

