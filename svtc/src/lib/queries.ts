import 'server-only';
import { cache } from 'react';
import { and, asc, eq, gte, inArray, lte, sql, desc, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  classes, subjects, rooms, tutors, students, parents, payments, seances, attendances, grades, evaluations, academicYears, documents,
} from '@/db/schema';
import { getCurrentYear, getSettings } from './settings';
import { allocate, attendanceStats, studentDue, weightedAverage } from './calc';
import { currentPeriod } from './time';

export const refData = cache(async () => {
  const [cls, subj, rms, tts] = await Promise.all([
    db.select().from(classes).orderBy(asc(classes.sortOrder), asc(classes.name)),
    db.select().from(subjects).orderBy(asc(subjects.sortOrder), asc(subjects.name)),
    db.select().from(rooms).orderBy(asc(rooms.name)),
    db.select().from(tutors).orderBy(asc(tutors.lastName), asc(tutors.firstName)),
  ]);
  return {
    classes: cls,
    subjects: subj,
    rooms: rms,
    tutors: tts,
    classById: new Map(cls.map((c) => [c.id, c])),
    subjectById: new Map(subj.map((s) => [s.id, s])),
    roomById: new Map(rms.map((r) => [r.id, r])),
    tutorById: new Map(tts.map((t) => [t.id, t])),
  };
});

export const tutorName = (t?: { firstName: string; lastName: string } | null) => (t ? `${t.firstName} ${t.lastName.toUpperCase()}` : 'Non attribué');

export type StudentRow = Awaited<ReturnType<typeof studentsOfYear>>[number];

export async function studentsOfYear(yearId: number, where?: SQL) {
  return db
    .select({
      id: students.id,
      matricule: students.matricule,
      firstName: students.firstName,
      lastName: students.lastName,
      gender: students.gender,
      birthDate: students.birthDate,
      school: students.school,
      phone: students.phone,
      classId: students.classId,
      parentId: students.parentId,
      discountPct: students.discountPct,
      status: students.status,
      enrolledAt: students.enrolledAt,
      notes: students.notes,
      className: classes.name,
      classCode: classes.code,
      classColor: classes.color,
      registrationFee: classes.registrationFee,
      monthlyFee: classes.monthlyFee,
      parentName: parents.fullName,
      parentPhone: parents.phone,
      parentUserId: parents.userId,
    })
    .from(students)
    .innerJoin(classes, eq(classes.id, students.classId))
    .leftJoin(parents, eq(parents.id, students.parentId))
    .where(where ? and(eq(students.academicYearId, yearId), where) : eq(students.academicYearId, yearId))
    .orderBy(asc(classes.sortOrder), asc(students.lastName), asc(students.firstName));
}

/** Situation financière de chaque élève de l'année (dû à ce jour, payé, solde). */
export async function balances(yearId: number, studentIds?: number[]) {
  const [s, year] = await Promise.all([getSettings(), db.select().from(academicYears).where(eq(academicYears.id, yearId)).then((r) => r[0])]);
  const list = await studentsOfYear(yearId, studentIds ? inArray(students.id, studentIds.length ? studentIds : [-1]) : undefined);
  const paidRows = await db
    .select({ studentId: payments.studentId, total: sql<number>`coalesce(sum(${payments.amount}),0)::int` })
    .from(payments)
    .where(and(eq(payments.academicYearId, yearId), eq(payments.cancelled, false)))
    .groupBy(payments.studentId);
  const paid = new Map(paidRows.map((r) => [r.studentId, Number(r.total)]));
  const asOf = currentPeriod();
  return list.map((st) => {
    const due = studentDue({
      registrationFee: st.registrationFee,
      monthlyFee: st.monthlyFee,
      discountPct: st.discountPct,
      enrolledAt: st.enrolledAt,
      billingMonths: s.billing.billingMonths,
      yearLabel: year.label,
      asOfPeriod: asOf,
    });
    const p = paid.get(st.id) ?? 0;
    const alloc = allocate(p, st.registrationFee, due.monthlyNet, due.allMonths);
    return { ...st, ...due, paid: p, balance: due.dueToDate - p, remainingYear: due.dueTotal - p, alloc };
  });
}

export async function seancesWithNames(where: SQL, order: 'asc' | 'desc' = 'asc') {
  return db
    .select({
      s: seances,
      className: classes.name,
      classCode: classes.code,
      classColor: classes.color,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      subjectColor: subjects.color,
      roomName: rooms.name,
      tutorFirst: tutors.firstName,
      tutorLast: tutors.lastName,
      tutorPhone: tutors.phone,
    })
    .from(seances)
    .innerJoin(classes, eq(classes.id, seances.classId))
    .innerJoin(subjects, eq(subjects.id, seances.subjectId))
    .leftJoin(rooms, eq(rooms.id, seances.roomId))
    .leftJoin(tutors, eq(tutors.id, seances.tutorId))
    .where(where)
    .orderBy(order === 'asc' ? asc(seances.date) : desc(seances.date), asc(seances.startTime), asc(classes.sortOrder));
}

/** Indicateurs de suivi d'un élève : assiduité, notes, moyenne générale et par matière. */
export async function studentProgress(studentId: number, range?: { start?: string; end?: string }) {
  const conds: SQL[] = [eq(attendances.studentId, studentId)];
  if (range?.start) conds.push(gte(seances.date, range.start));
  if (range?.end) conds.push(lte(seances.date, range.end));
  const att = await db
    .select({ status: attendances.status, date: seances.date, subjectName: subjects.name, comment: attendances.comment, startTime: seances.startTime })
    .from(attendances)
    .innerJoin(seances, eq(seances.id, attendances.seanceId))
    .innerJoin(subjects, eq(subjects.id, seances.subjectId))
    .where(and(...conds))
    .orderBy(asc(seances.date));
  const gconds: SQL[] = [eq(grades.studentId, studentId)];
  if (range?.start) gconds.push(gte(evaluations.date, range.start));
  if (range?.end) gconds.push(lte(evaluations.date, range.end));
  const gr = await db
    .select({
      score: grades.score, absent: grades.absent, comment: grades.comment,
      title: evaluations.title, type: evaluations.type, date: evaluations.date, maxScore: evaluations.maxScore, coefficient: evaluations.coefficient,
      subjectId: evaluations.subjectId, subjectName: subjects.name, subjectColor: subjects.color,
    })
    .from(grades)
    .innerJoin(evaluations, eq(evaluations.id, grades.evaluationId))
    .innerJoin(subjects, eq(subjects.id, evaluations.subjectId))
    .where(and(...gconds))
    .orderBy(asc(evaluations.date));
  const stats = attendanceStats(att.map((a) => a.status));
  const average = weightedAverage(gr);
  const bySubject = new Map<string, { name: string; color: string; list: typeof gr }>();
  for (const g of gr) {
    const k = String(g.subjectId);
    if (!bySubject.has(k)) bySubject.set(k, { name: g.subjectName, color: g.subjectColor, list: [] });
    bySubject.get(k)!.list.push(g);
  }
  const subjectsAvg = [...bySubject.values()].map((b) => ({ name: b.name, color: b.color, average: weightedAverage(b.list), count: b.list.length }));
  return { attendance: att, stats, grades: gr, average, subjectsAvg };
}

export async function currentYearId() {
  return (await getCurrentYear()).id;
}

/** Détail d'une séance : informations, élèves de la classe avec leur présence, documents rattachés. */
export async function seanceDetail(id: number) {
  const [row] = await seancesWithNames(eq(seances.id, id));
  if (!row) return null;
  const [roster, att, docs] = await Promise.all([
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, gender: students.gender, matricule: students.matricule })
      .from(students).where(and(eq(students.classId, row.s.classId), eq(students.academicYearId, row.s.academicYearId), eq(students.status, 'ACTIF')))
      .orderBy(asc(students.lastName), asc(students.firstName)),
    db.select().from(attendances).where(eq(attendances.seanceId, id)),
    db.select().from(documents).where(eq(documents.seanceId, id)),
  ]);
  const attBy = new Map(att.map((a) => [a.studentId, a]));
  // Élèves inactifs déjà pointés : on les garde dans la liste
  const missing = att.filter((a) => !roster.some((r) => r.id === a.studentId)).map((a) => a.studentId);
  const extra = missing.length
    ? await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, gender: students.gender, matricule: students.matricule }).from(students).where(inArray(students.id, missing))
    : [];
  const list = [...roster, ...extra].map((st) => ({ ...st, attendance: attBy.get(st.id) ?? null }));
  return { ...row, roster: list, attendanceCount: att.length, stats: attendanceStats(att.map((a) => a.status)), docs };
}
