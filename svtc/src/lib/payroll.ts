import 'server-only';
import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { seances, tutors, salarySlips, rooms, rentSettlements, payments, expenses, students, classes } from '@/db/schema';
import { getSettings } from './settings';
import { computeRent, computeSalary, doneMinutes, plannedMinutes } from './calc';
import { periodBounds } from './time';

/** État des salaires d'un mois : heures prévues, heures effectuées, pourcentage, montant. */
export async function computePayroll(period: string) {
  const s = await getSettings();
  const { start, end } = periodBounds(period);
  const [list, tts, slips] = await Promise.all([
    db.select().from(seances).where(and(gte(seances.date, start), lte(seances.date, end))),
    db.select().from(tutors).orderBy(asc(tutors.lastName)),
    db.select().from(salarySlips).where(eq(salarySlips.period, period)),
  ]);
  const slipBy = new Map(slips.map((x) => [x.tutorId, x]));
  const rows = tts
    .map((t) => {
      const mine = list.filter((x) => x.tutorId === t.id);
      const planned = mine.filter((x) => x.status !== 'ANNULEE').reduce((a, x) => a + plannedMinutes(x), 0);
      const done = mine.reduce((a, x) => a + doneMinutes(x, s.salary.countBasis), 0);
      const doneCount = mine.filter((x) => x.status === 'TERMINEE').length;
      const pending = mine.filter((x) => x.status === 'TERMINEE' && !x.validated).length;
      const slip = slipBy.get(t.id);
      const calc = computeSalary({
        mode: s.salary.mode, baseSalary: t.baseSalary, hourlyRate: t.hourlyRate, plannedMin: planned, doneMin: done, capAt100: s.salary.capAt100,
        bonus: slip?.bonus ?? 0, deduction: slip?.deduction ?? 0,
      });
      return { tutor: t, planned, done, seances: mine.filter((x) => x.status !== 'ANNULEE').length, doneCount, pending, ...calc, bonus: slip?.bonus ?? 0, deduction: slip?.deduction ?? 0, slip };
    })
    .filter((r) => r.tutor.isActive || r.planned > 0 || r.slip);
  const totals = rows.reduce((a, r) => ({ planned: a.planned + r.planned, done: a.done + r.done, net: a.net + r.net, gross: a.gross + r.gross }), { planned: 0, done: 0, net: 0, gross: 0 });
  return { rows, totals, mode: s.salary.mode, basis: s.salary.countBasis };
}

/** État de location des salles d'un mois (ou d'une période). */
export async function computeRentReport(start: string, end: string) {
  const s = await getSettings();
  const [list, rms] = await Promise.all([
    db.select().from(seances).where(and(gte(seances.date, start), lte(seances.date, end))),
    db.select().from(rooms).orderBy(asc(rooms.name)),
  ]);
  const rates = Object.fromEntries(rms.map((r) => [r.id, r.rates ?? {}]));
  const windows = Object.fromEntries(s.sessions.days.map((d) => [d.day, { start: d.start, end: d.end }]));
  const lines = computeRent(list, rates, s.billing.rentBasis, windows);
  const byRoom = rms
    .map((r) => {
      const l = lines.filter((x) => x.roomId === r.id);
      return { room: r, lines: l, minutes: l.reduce((a, x) => a + x.minutes, 0), amount: l.reduce((a, x) => a + x.amount, 0) };
    })
    .filter((r) => r.lines.length > 0 || r.room.isActive);
  const byDay = new Map<number, { minutes: number; amount: number }>();
  for (const l of lines) {
    const v = byDay.get(l.dayOfWeek) ?? { minutes: 0, amount: 0 };
    v.minutes += l.minutes;
    v.amount += l.amount;
    byDay.set(l.dayOfWeek, v);
  }
  const total = lines.reduce((a, x) => a + x.amount, 0);
  const minutes = lines.reduce((a, x) => a + x.minutes, 0);
  return { lines, byRoom, byDay, total, minutes, basis: s.billing.rentBasis };
}

export async function rentSettlement(period: string) {
  const [r] = await db.select().from(rentSettlements).where(eq(rentSettlements.period, period));
  return r ?? null;
}

/** Journal de caisse d'une période : solde d'ouverture, recettes, dépenses, solde de clôture. */
export async function cashJournal(start: string, end: string) {
  const startTs = new Date(`${start}T00:00:00+01:00`);
  const endTs = new Date(`${end}T23:59:59.999+01:00`);
  const [[inBefore], [outBefore], ins, outs] = await Promise.all([
    db.select({ t: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(and(eq(payments.cancelled, false), lt(payments.paidAt, startTs))),
    db.select({ t: sql<number>`coalesce(sum(${expenses.amount}),0)::int` }).from(expenses).where(lt(expenses.date, start)),
    db.select({ p: payments, first: students.firstName, last: students.lastName, classCode: classes.code })
      .from(payments).innerJoin(students, eq(students.id, payments.studentId)).innerJoin(classes, eq(classes.id, students.classId))
      .where(and(eq(payments.cancelled, false), gte(payments.paidAt, startTs), lte(payments.paidAt, endTs))).orderBy(asc(payments.paidAt)),
    db.select().from(expenses).where(and(gte(expenses.date, start), lte(expenses.date, end))).orderBy(asc(expenses.date), asc(expenses.id)),
  ]);
  const opening = Number(inBefore.t) - Number(outBefore.t);
  const totalIn = ins.reduce((a, r) => a + r.p.amount, 0);
  const totalOut = outs.reduce((a, r) => a + r.amount, 0);
  const byMethod = new Map<string, number>();
  for (const r of ins) byMethod.set(r.p.method, (byMethod.get(r.p.method) ?? 0) + r.p.amount);
  const byCategory = new Map<string, number>();
  for (const r of outs) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount);
  return { opening, ins, outs, totalIn, totalOut, closing: opening + totalIn - totalOut, byMethod, byCategory };
}
