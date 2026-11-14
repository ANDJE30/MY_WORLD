'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { timeslots, assignments, rooms, seances, documents, attendances } from '@/db/schema';
import { assertRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { findConflicts, generatePlanning } from '@/lib/calc';
import { datesBetween, dayOfWeek, toMinutes, localToDate } from '@/lib/time';
import { refData, tutorName } from '@/lib/queries';
import { deleteFile } from '@/lib/files';

const refresh = (...p: string[]) => ['/admin/planning', '/admin/seances', '/admin', ...p].forEach((x) => revalidatePath(x));

export async function autoGeneratePlanning(): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [year, s, ref] = await Promise.all([getCurrentYear(), getSettings(), refData()]);
    const asg = await db.select().from(assignments).where(eq(assignments.academicYearId, year.id));
    if (asg.length === 0) throw new UserError('Aucune attribution : indiquez d’abord quel encadreur enseigne quelle matière dans chaque classe.');
    const activeRooms = (await db.select().from(rooms).where(eq(rooms.isActive, true))).map((r) => r.id);
    if (activeRooms.length === 0) throw new UserError('Aucune salle disponible.');
    const slots = s.sessions.days.flatMap((d) => d.slots.map((x) => ({ day: d.day, start: x.start, end: x.end })));
    const activeClass = new Set(ref.classes.filter((c) => c.isActive).map((c) => c.id));
    const activeTutor = new Set(ref.tutors.filter((t) => t.isActive).map((t) => t.id));
    const demands = asg.filter((a) => activeClass.has(a.classId) && activeTutor.has(a.tutorId)).map((a) => ({ classId: a.classId, subjectId: a.subjectId, tutorId: a.tutorId, count: a.sessionsPerWeek }));
    const { placements, unplaced } = generatePlanning(slots, activeRooms, demands);
    await db.transaction(async (tx) => {
      await tx.delete(timeslots).where(eq(timeslots.academicYearId, year.id));
      if (placements.length) {
        await tx.insert(timeslots).values(placements.map((p) => ({
          academicYearId: year.id, dayOfWeek: p.day, startTime: p.start, endTime: p.end, classId: p.classId, subjectId: p.subjectId, tutorId: p.tutorId, roomId: p.roomId,
        })));
      }
    });
    await audit(me, 'PLANNING_GENERE', { details: { placed: placements.length, unplaced: unplaced.length } });
    refresh();
    const missing = unplaced.map((u) => `${ref.classById.get(u.classId)?.code} · ${ref.subjectById.get(u.subjectId)?.code} (${tutorName(ref.tutorById.get(u.tutorId))}) : ${u.count} créneau(x)`);
    return {
      ok: true,
      message: unplaced.length
        ? `${placements.length} créneau(x) placé(s). ${unplaced.length} demande(s) non placée(s) faute de place : ajoutez une salle, un créneau ou réduisez les créneaux hebdomadaires.`
        : `Planning généré : ${placements.length} créneau(x) placé(s) sans aucun conflit.`,
      data: missing,
    };
  });
}

const slotSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: zs.time('Début'),
  endTime: zs.time('Fin'),
  classId: zs.id('Classe'),
  subjectId: zs.id('Matière'),
  tutorId: z.coerce.number().int().positive().optional(),
  roomId: z.coerce.number().int().positive().optional(),
});

export async function saveTimeslot(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const d = slotSchema.parse(f);
    if (toMinutes(d.endTime) <= toMinutes(d.startTime)) throw new UserError('L’heure de fin doit suivre l’heure de début.');
    const year = await getCurrentYear();
    const id = f.id ? Number(f.id) : 0;
    const others = await db.select().from(timeslots).where(and(eq(timeslots.academicYearId, year.id), eq(timeslots.dayOfWeek, d.dayOfWeek), id ? ne(timeslots.id, id) : sql`true`));
    const conflicts = findConflicts([...others, { id: -1, ...d, tutorId: d.tutorId ?? null, roomId: d.roomId ?? null }]).filter((c) => c.a === -1 || c.b === -1);
    if (conflicts.length) {
      const ref = await refData();
      const msg = conflicts.map((c) => {
        const o = others.find((x) => x.id === (c.a === -1 ? c.b : c.a))!;
        const what = c.kind === 'CLASSE' ? `la classe a déjà cours` : c.kind === 'ENCADREUR' ? `${tutorName(ref.tutorById.get(o.tutorId!))} est déjà occupé(e)` : `${ref.roomById.get(o.roomId!)?.name} est déjà occupée`;
        return `${what} (${o.startTime}–${o.endTime})`;
      });
      throw new UserError(`Conflit : ${[...new Set(msg)].join(' ; ')}.`);
    }
    const values = { ...d, tutorId: d.tutorId ?? null, roomId: d.roomId ?? null, academicYearId: year.id };
    if (id) await db.update(timeslots).set(values).where(eq(timeslots.id, id));
    else await db.insert(timeslots).values(values);
    await audit(me, id ? 'CRENEAU_MODIFIE' : 'CRENEAU_AJOUTE', { entity: 'creneau', entityId: id || undefined });
    refresh();
    return { ok: true, message: 'Créneau enregistré.' };
  });
}

export async function deleteTimeslot(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    await db.delete(timeslots).where(eq(timeslots.id, id));
    await audit(me, 'CRENEAU_SUPPRIME', { entity: 'creneau', entityId: id });
    refresh();
    return { ok: true, message: 'Créneau supprimé (les séances déjà générées sont conservées).' };
  });
}

export async function generateSeances(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const start = zs.date('Début').parse(f.start);
    const end = zs.date('Fin').parse(f.end);
    if (end < start) throw new UserError('La date de fin doit suivre la date de début.');
    const dates = datesBetween(start, end);
    if (dates.length > 400) throw new UserError('Période trop longue (400 jours maximum).');
    const year = await getCurrentYear();
    const slots = await db.select().from(timeslots).where(eq(timeslots.academicYearId, year.id));
    if (slots.length === 0) throw new UserError('Le planning hebdomadaire est vide : générez-le ou ajoutez des créneaux.');
    const rows = dates.flatMap((date) => slots.filter((t) => t.dayOfWeek === dayOfWeek(date)).map((t) => ({
      academicYearId: year.id, timeslotId: t.id, date, dayOfWeek: t.dayOfWeek, startTime: t.startTime, endTime: t.endTime, classId: t.classId, subjectId: t.subjectId, tutorId: t.tutorId, roomId: t.roomId,
    })));
    let created = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const r = await db.insert(seances).values(rows.slice(i, i + 200)).onConflictDoNothing().returning({ id: seances.id });
      created += r.length;
    }
    await audit(me, 'SEANCES_GENEREES', { details: { start, end, created } });
    refresh();
    return { ok: true, message: created ? `${created} séance(s) créée(s) du ${start.split('-').reverse().join('/')} au ${end.split('-').reverse().join('/')}.` : 'Aucune nouvelle séance : elles existent déjà pour cette période.' };
  });
}

/** Met à jour les séances futures non commencées après une modification du planning. */
export async function syncFutureSeances(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const from = zs.date('À partir du').parse(fd.get('from'));
    const year = await getCurrentYear();
    const removed = await db.delete(seances).where(and(eq(seances.academicYearId, year.id), gte(seances.date, from), eq(seances.status, 'PLANIFIEE'),
      sql`not exists (select 1 from ${attendances} where ${attendances.seanceId} = ${seances.id})`)).returning({ id: seances.id });
    const last = await db.select({ d: sql<string>`max(${seances.date})` }).from(seances).where(eq(seances.academicYearId, year.id));
    const end = last[0]?.d && last[0].d >= from ? last[0].d : from;
    const fd2 = new FormData();
    fd2.set('start', from);
    fd2.set('end', end);
    const r = await generateSeances(fd2);
    await audit(me, 'SEANCES_SYNCHRONISEES', { details: { from, removed: removed.length } });
    return r.ok ? { ok: true, message: `Séances futures recalculées depuis le ${from.split('-').reverse().join('/')} (${removed.length} remplacée(s)). ${r.message ?? ''}` } : r;
  });
}

export async function addSeance(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const d = slotSchema.omit({ dayOfWeek: true }).extend({ date: zs.date('Date'), topic: zs.optText(200) }).parse(f);
    if (toMinutes(d.endTime) <= toMinutes(d.startTime)) throw new UserError('L’heure de fin doit suivre l’heure de début.');
    const year = await getCurrentYear();
    await db.insert(seances).values({ ...d, tutorId: d.tutorId ?? null, roomId: d.roomId ?? null, academicYearId: year.id, dayOfWeek: dayOfWeek(d.date), topic: d.topic ?? 'Séance de rattrapage' });
    await audit(me, 'SEANCE_AJOUTEE', { details: { date: d.date } });
    refresh();
    return { ok: true, message: 'Séance ajoutée.' };
  });
}

export async function updateSeance(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const f = formObject(fd);
    const id = zs.id('Séance').parse(f.id);
    const [cur] = await db.select().from(seances).where(eq(seances.id, id));
    if (!cur) throw new UserError('Séance introuvable.');
    const d = z.object({
      date: zs.date('Date'), startTime: zs.time('Début prévu'), endTime: zs.time('Fin prévue'),
      tutorId: z.coerce.number().int().positive().optional(), roomId: z.coerce.number().int().positive().optional(),
      actualStartHM: zs.time('Début réel').optional(), actualEndHM: zs.time('Fin réelle').optional(), topic: zs.optText(200),
    }).parse(f);
    if (toMinutes(d.endTime) <= toMinutes(d.startTime)) throw new UserError('L’heure de fin prévue doit suivre l’heure de début.');
    const actualStart = d.actualStartHM ? localToDate(d.date, d.actualStartHM) : cur.actualStart;
    const actualEnd = d.actualEndHM ? localToDate(d.date, d.actualEndHM) : cur.actualEnd;
    if (actualStart && actualEnd && actualEnd <= actualStart) throw new UserError('L’heure de fin réelle doit suivre l’heure de début réelle.');
    const status = actualStart && actualEnd ? 'TERMINEE' : actualStart ? 'EN_COURS' : cur.status === 'ANNULEE' ? 'ANNULEE' : 'PLANIFIEE';
    await db.update(seances).set({
      date: d.date, dayOfWeek: dayOfWeek(d.date), startTime: d.startTime, endTime: d.endTime, tutorId: d.tutorId ?? null, roomId: d.roomId ?? null,
      actualStart, actualEnd, status, topic: d.topic ?? cur.topic, updatedAt: new Date(),
    }).where(eq(seances.id, id));
    await audit(me, 'SEANCE_CORRIGEE', { entity: 'seance', entityId: id, details: { actualStart: d.actualStartHM, actualEnd: d.actualEndHM } });
    refresh(`/admin/seances/${id}`);
    return { ok: true, message: 'Séance mise à jour.' };
  });
}

export async function cancelSeance(id: number, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const reason = zs.text('Motif', 200).parse(fd.get('reason'));
    await db.update(seances).set({ status: 'ANNULEE', cancelReason: reason, updatedAt: new Date() }).where(eq(seances.id, id));
    await audit(me, 'SEANCE_ANNULEE', { entity: 'seance', entityId: id, details: { reason } });
    refresh();
    return { ok: true, message: 'Séance annulée (non comptée dans les heures ni dans la location).' };
  });
}

export async function cancelDay(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const date = zs.date('Date').parse(fd.get('date'));
    const reason = zs.text('Motif', 200).parse(fd.get('reason'));
    const r = await db.update(seances).set({ status: 'ANNULEE', cancelReason: reason, updatedAt: new Date() }).where(and(eq(seances.date, date), eq(seances.status, 'PLANIFIEE'))).returning({ id: seances.id });
    await audit(me, 'JOURNEE_ANNULEE', { details: { date, reason, n: r.length } });
    refresh();
    return { ok: true, message: `${r.length} séance(s) annulée(s) le ${date.split('-').reverse().join('/')}.` };
  });
}

export async function restoreSeance(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [s] = await db.select().from(seances).where(eq(seances.id, id));
    if (!s) throw new UserError('Séance introuvable.');
    await db.update(seances).set({ status: s.actualEnd ? 'TERMINEE' : s.actualStart ? 'EN_COURS' : 'PLANIFIEE', cancelReason: null, updatedAt: new Date() }).where(eq(seances.id, id));
    await audit(me, 'SEANCE_RETABLIE', { entity: 'seance', entityId: id });
    refresh();
    return { ok: true, message: 'Séance rétablie.' };
  });
}

export async function validateSeances(ids: number[]): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    if (!ids.length) throw new UserError('Aucune séance à valider.');
    const r = await db.update(seances).set({ validated: true, validatedBy: me.id, validatedAt: new Date() }).where(and(inArray(seances.id, ids), eq(seances.status, 'TERMINEE'))).returning({ id: seances.id });
    await audit(me, 'SEANCES_VALIDEES', { details: { n: r.length } });
    refresh('/admin/salaires');
    return { ok: true, message: `${r.length} séance(s) validée(s).` };
  });
}

export async function deleteSeance(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [s] = await db.select().from(seances).where(eq(seances.id, id));
    if (!s) throw new UserError('Séance introuvable.');
    if (s.status === 'TERMINEE' || s.status === 'EN_COURS') throw new UserError('Une séance commencée ou terminée ne peut pas être supprimée : annulez-la si nécessaire.');
    await db.delete(seances).where(eq(seances.id, id));
    await audit(me, 'SEANCE_SUPPRIMEE', { entity: 'seance', entityId: id });
    refresh();
    return { ok: true, message: 'Séance supprimée.' };
  });
}

export async function deleteFutureSeances(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const start = zs.date('Début').parse(fd.get('start'));
    const end = zs.date('Fin').parse(fd.get('end'));
    const r = await db.delete(seances).where(and(gte(seances.date, start), lte(seances.date, end), eq(seances.status, 'PLANIFIEE'),
      sql`not exists (select 1 from ${attendances} where ${attendances.seanceId} = ${seances.id})`)).returning({ id: seances.id });
    await audit(me, 'SEANCES_PURGEES', { details: { start, end, n: r.length } });
    refresh();
    return { ok: true, message: `${r.length} séance(s) planifiée(s) supprimée(s).` };
  });
}

// ---------------------------------------------------------------- Documents pédagogiques
export async function reviewDocument(id: number, fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const status = z.enum(['APPROUVE', 'A_REVOIR', 'SOUMIS']).parse(fd.get('status'));
    const comment = zs.optText(500).parse(fd.get('comment') || undefined);
    const visible = fd.get('visibleToParents') === 'on';
    await db.update(documents).set({ status, adminComment: comment ?? null, visibleToParents: status === 'APPROUVE' && visible, reviewedBy: me.id, reviewedAt: new Date() }).where(eq(documents.id, id));
    await audit(me, 'DOCUMENT_EXAMINE', { entity: 'document', entityId: id, details: { status } });
    revalidatePath('/admin/documents');
    return { ok: true, message: status === 'APPROUVE' ? 'Document approuvé.' : status === 'A_REVOIR' ? 'Document renvoyé à l’encadreur pour correction.' : 'Statut mis à jour.' };
  });
}

export async function deleteDocument(id: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN', 'ENCADREUR');
    const [d] = await db.select().from(documents).where(eq(documents.id, id));
    if (!d) throw new UserError('Document introuvable.');
    if (me.role === 'ENCADREUR' && (d.tutorId !== me.tutorId || d.status === 'APPROUVE')) throw new UserError('Vous ne pouvez supprimer que vos documents non encore approuvés.');
    await db.delete(documents).where(eq(documents.id, id));
    await deleteFile(d.fileId);
    await audit(me, 'DOCUMENT_SUPPRIME', { entity: 'document', entityId: id });
    revalidatePath('/admin/documents');
    revalidatePath('/encadreur/documents');
    return { ok: true, message: 'Document supprimé.' };
  });
}
