'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, like } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { payments, students, expenses, salarySlips, rentSettlements, tutors, verifications } from '@/db/schema';
import { assertRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { computePayroll, computeRentReport } from '@/lib/payroll';
import { localToDate, nowHM, periodBounds, todayISO } from '@/lib/time';
import { periodLabel, money } from '@/lib/format';
import { randomCode } from '@/lib/passwords';
import { PAYMENT_METHODS } from '@/lib/constants';

const paths = ['/admin/paiements', '/admin/impayes', '/admin/caisse', '/admin', '/admin/eleves'];
const refresh = (extra: string[] = []) => [...paths, ...extra].forEach((p) => revalidatePath(p));

async function nextReceiptNo(prefix: string, yearLabel: string) {
  const base = `${prefix}-R${yearLabel.slice(2, 4)}${yearLabel.slice(7, 9)}`;
  const [last] = await db.select({ n: payments.receiptNo }).from(payments).where(like(payments.receiptNo, `${base}-%`)).orderBy(desc(payments.receiptNo)).limit(1);
  const n = last ? Number(last.n.split('-').pop()) + 1 : 1;
  return `${base}-${String(n).padStart(5, '0')}`;
}

const paymentSchema = z.object({
  studentId: zs.id('Élève'),
  amount: zs.int('Montant', 1, 10_000_000),
  type: z.enum(['INSCRIPTION', 'MENSUALITE', 'AUTRE']),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]]),
  reference: zs.optText(80),
  paidOn: zs.date('Date du paiement'),
  notes: zs.optText(300),
});

export async function recordPayment(fd: FormData): Promise<ActionResult<{ id: number; receiptNo: string }>> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const d = paymentSchema.parse({ paidOn: todayISO(), ...formObject(fd) });
    if (d.paidOn > todayISO()) throw new UserError('La date du paiement ne peut pas être dans le futur.');
    if ((d.method === 'MTN_MOMO' || d.method === 'ORANGE_MONEY') && !d.reference) throw new UserError('Indiquez la référence de la transaction Mobile Money.');
    const [st] = await db.select().from(students).where(eq(students.id, d.studentId));
    if (!st) throw new UserError('Élève introuvable.');
    const [year, s] = await Promise.all([getCurrentYear(), getSettings()]);
    const paidAt = d.paidOn === todayISO() ? new Date() : localToDate(d.paidOn, '12:00');
    let row: { id: number; receiptNo: string } | undefined;
    for (let attempt = 0; attempt < 4 && !row; attempt++) {
      try {
        const receiptNo = await nextReceiptNo(s.billing.receiptPrefix, year.label);
        [row] = await db.insert(payments).values({
          receiptNo, academicYearId: st.academicYearId, studentId: st.id, amount: d.amount, type: d.type, method: d.method,
          reference: d.reference ?? null, paidAt, receivedBy: me.id, notes: d.notes ?? null,
        }).returning({ id: payments.id, receiptNo: payments.receiptNo });
      } catch (e) {
        if ((e as { code?: string }).code !== '23505' || attempt === 3) throw e;
      }
    }
    const code = randomCode(10);
    await db.insert(verifications).values({
      code, kind: 'RECU', refId: String(row!.id),
      summary: { 'Reçu n°': row!.receiptNo, Élève: `${st.lastName} ${st.firstName}`, Montant: money(d.amount), Date: `${d.paidOn.split('-').reverse().join('/')} ${d.paidOn === todayISO() ? nowHM() : ''}`.trim() },
    }).onConflictDoNothing();
    await audit(me, 'PAIEMENT_ENREGISTRE', { entity: 'paiement', entityId: row!.id, details: { receiptNo: row!.receiptNo, amount: d.amount, studentId: st.id } });
    refresh([`/admin/eleves/${st.id}`]);
    return { ok: true, message: `Paiement enregistré — reçu ${row!.receiptNo}.`, data: row! };
  });
}

export async function cancelPayment(id: number, fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const reason = zs.text('Motif de l’annulation', 200).parse(fd.get('reason'));
    const [p] = await db.select().from(payments).where(eq(payments.id, id));
    if (!p) throw new UserError('Paiement introuvable.');
    if (p.cancelled) throw new UserError('Ce paiement est déjà annulé.');
    await db.update(payments).set({ cancelled: true, cancelReason: reason, cancelledAt: new Date(), cancelledBy: me.id }).where(eq(payments.id, id));
    await audit(me, 'PAIEMENT_ANNULE', { entity: 'paiement', entityId: id, details: { receiptNo: p.receiptNo, amount: p.amount, reason } });
    refresh([`/admin/eleves/${p.studentId}`]);
    return { ok: true, message: `Reçu ${p.receiptNo} annulé (conservé dans l’historique).` };
  });
}

// ---------------------------------------------------------------- Dépenses
const expenseSchema = z.object({
  date: zs.date('Date'),
  category: z.enum(['LOCATION_SALLE', 'SALAIRE', 'FOURNITURES', 'COMMUNICATION', 'TRANSPORT', 'ENTRETIEN', 'AUTRE']),
  label: zs.text('Libellé', 160),
  amount: zs.int('Montant', 1, 100_000_000),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]]),
  beneficiary: zs.optText(120),
  reference: zs.optText(80),
});

export async function recordExpense(fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const d = expenseSchema.parse({ date: todayISO(), method: 'ESPECES', ...formObject(fd) });
    const year = await getCurrentYear();
    const [row] = await db.insert(expenses).values({ ...d, academicYearId: year.id, createdBy: me.id }).returning({ id: expenses.id });
    await audit(me, 'DEPENSE_ENREGISTREE', { entity: 'depense', entityId: row.id, details: { amount: d.amount, label: d.label } });
    refresh(['/admin/depenses']);
    return { ok: true, message: 'Dépense enregistrée.' };
  });
}

export async function deleteExpense(id: number) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const [e] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!e) throw new UserError('Dépense introuvable.');
    await db.transaction(async (tx) => {
      if (e.sourceType === 'SALAIRE') await tx.update(salarySlips).set({ status: 'CALCULE', paidAt: null, expenseId: null }).where(eq(salarySlips.expenseId, id));
      if (e.sourceType === 'LOCATION') await tx.delete(rentSettlements).where(eq(rentSettlements.expenseId, id));
      await tx.delete(expenses).where(eq(expenses.id, id));
    });
    await audit(me, 'DEPENSE_SUPPRIMEE', { entity: 'depense', entityId: id, details: { amount: e.amount, label: e.label } });
    refresh(['/admin/depenses', '/admin/salaires', '/admin/location']);
    return { ok: true, message: 'Dépense supprimée.' };
  });
}

// ---------------------------------------------------------------- Salaires
export async function saveSalaryAdjustments(period: string, fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const payroll = await computePayroll(period);
    for (const r of payroll.rows) {
      if (r.slip?.status === 'PAYE') continue;
      const bonus = Math.max(0, Number(fd.get(`bonus_${r.tutor.id}`) ?? r.bonus) || 0);
      const deduction = Math.max(0, Number(fd.get(`deduction_${r.tutor.id}`) ?? r.deduction) || 0);
      const net = Math.max(0, r.gross + bonus - deduction);
      const values = {
        tutorId: r.tutor.id, period, mode: payroll.mode, plannedMinutes: r.planned, doneMinutes: r.done, ratePct: r.ratePct,
        baseSalary: r.tutor.baseSalary, hourlyRate: r.tutor.hourlyRate, grossAmount: r.gross, bonus, deduction, netAmount: net,
      };
      await db.insert(salarySlips).values(values).onConflictDoUpdate({ target: [salarySlips.tutorId, salarySlips.period], set: values });
    }
    await audit(me, 'SALAIRES_CALCULES', { details: { period } });
    revalidatePath('/admin/salaires');
    return { ok: true, message: `État des salaires de ${periodLabel(period)} enregistré.` };
  });
}

export async function paySalary(period: string, tutorId: number, fd?: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const payroll = await computePayroll(period);
    const r = payroll.rows.find((x) => x.tutor.id === tutorId);
    if (!r) throw new UserError('Encadreur introuvable pour cette période.');
    if (r.slip?.status === 'PAYE') throw new UserError('Ce salaire est déjà payé.');
    if (r.net <= 0) throw new UserError('Montant nul : aucun paiement à enregistrer.');
    const method = String(fd?.get('method') ?? 'ESPECES');
    const year = await getCurrentYear();
    await db.transaction(async (tx) => {
      const [e] = await tx.insert(expenses).values({
        academicYearId: year.id, date: todayISO(), category: 'SALAIRE', label: `Salaire ${periodLabel(period)} — ${r.tutor.firstName} ${r.tutor.lastName}`,
        amount: r.net, method: method in PAYMENT_METHODS ? method : 'ESPECES', beneficiary: `${r.tutor.firstName} ${r.tutor.lastName}`, sourceType: 'SALAIRE', sourceRef: `${period}:${tutorId}`, createdBy: me.id,
      }).returning({ id: expenses.id });
      const values = {
        tutorId, period, mode: payroll.mode, plannedMinutes: r.planned, doneMinutes: r.done, ratePct: r.ratePct, baseSalary: r.tutor.baseSalary, hourlyRate: r.tutor.hourlyRate,
        grossAmount: r.gross, bonus: r.bonus, deduction: r.deduction, netAmount: r.net, status: 'PAYE', paidAt: new Date(), expenseId: e.id,
      };
      await tx.insert(salarySlips).values(values).onConflictDoUpdate({ target: [salarySlips.tutorId, salarySlips.period], set: values });
    });
    await audit(me, 'SALAIRE_PAYE', { entity: 'encadreur', entityId: tutorId, details: { period, amount: r.net } });
    refresh(['/admin/salaires', '/admin/depenses']);
    return { ok: true, message: `Salaire de ${r.tutor.firstName} ${r.tutor.lastName} payé (${money(r.net)}) et inscrit en dépense.` };
  });
}

export async function payAllSalaries(period: string) {
  return safe(async () => {
    await assertRole('ADMIN');
    const payroll = await computePayroll(period);
    let n = 0;
    for (const r of payroll.rows) {
      if (r.slip?.status === 'PAYE' || r.net <= 0) continue;
      const res = await paySalary(period, r.tutor.id);
      if (res.ok) n++;
    }
    if (n === 0) throw new UserError('Aucun salaire à payer pour cette période.');
    return { ok: true, message: `${n} salaire(s) payé(s) pour ${periodLabel(period)}.` };
  });
}

// ---------------------------------------------------------------- Location des salles
export async function payRent(period: string) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    zs.period().parse(period);
    const [existing] = await db.select().from(rentSettlements).where(eq(rentSettlements.period, period));
    if (existing) throw new UserError('La location de ce mois est déjà réglée.');
    const { start, end } = periodBounds(period);
    const rep = await computeRentReport(start, end);
    if (rep.total <= 0) throw new UserError('Aucune heure de location pour ce mois.');
    const year = await getCurrentYear();
    const s = await getSettings();
    await db.transaction(async (tx) => {
      const [e] = await tx.insert(expenses).values({
        academicYearId: year.id, date: todayISO(), category: 'LOCATION_SALLE', label: `Location des salles — ${periodLabel(period)}`,
        amount: rep.total, method: 'ESPECES', beneficiary: s.identity.host, sourceType: 'LOCATION', sourceRef: period, createdBy: me.id,
      }).returning({ id: expenses.id });
      await tx.insert(rentSettlements).values({ period, amount: rep.total, paidAt: new Date(), expenseId: e.id });
    });
    await audit(me, 'LOCATION_PAYEE', { details: { period, amount: rep.total } });
    refresh(['/admin/location', '/admin/depenses']);
    return { ok: true, message: `Location de ${periodLabel(period)} réglée : ${money(rep.total)}.` };
  });
}

export async function updateTutorPay(tutorId: number, fd: FormData) {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const baseSalary = zs.int('Salaire mensuel', 0, 10_000_000).parse(fd.get('baseSalary'));
    const hourlyRate = zs.int('Taux horaire', 0, 1_000_000).parse(fd.get('hourlyRate'));
    await db.update(tutors).set({ baseSalary, hourlyRate }).where(and(eq(tutors.id, tutorId)));
    await audit(me, 'REMUNERATION_MODIFIEE', { entity: 'encadreur', entityId: tutorId, details: { baseSalary, hourlyRate } });
    revalidatePath('/admin/salaires');
    return { ok: true, message: 'Rémunération mise à jour.' };
  });
}
