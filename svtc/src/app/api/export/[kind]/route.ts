import { NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { getSessionUser } from '@/lib/auth';
import { getCurrentYear } from '@/lib/settings';
import { balances } from '@/lib/queries';
import { audit } from '@/lib/audit';
import { todayISO } from '@/lib/time';

function csv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '﻿';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Neutralise les formules (injection CSV dans Excel)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\r\n');
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const u = await getSessionUser();
  if (!u || u.role !== 'ADMIN') return new NextResponse('Accès refusé', { status: 403 });
  const { kind } = await params;
  const year = await getCurrentYear();
  let rows: Record<string, unknown>[] = [];
  if (kind === 'sauvegarde') {
    const data = {
      version: 1, exportedAt: new Date().toISOString(),
      settings: await db.select().from(t.settings), academicYears: await db.select().from(t.academicYears), classes: await db.select().from(t.classes),
      subjects: await db.select().from(t.subjects), rooms: await db.select().from(t.rooms), tutors: await db.select().from(t.tutors), parents: await db.select().from(t.parents),
      students: await db.select().from(t.students), assignments: await db.select().from(t.assignments), timeslots: await db.select().from(t.timeslots),
      seances: await db.select().from(t.seances), attendances: await db.select().from(t.attendances), evaluations: await db.select().from(t.evaluations),
      grades: await db.select().from(t.grades), payments: await db.select().from(t.payments), expenses: await db.select().from(t.expenses),
      salarySlips: await db.select().from(t.salarySlips), rentSettlements: await db.select().from(t.rentSettlements),
      documents: await db.select({ id: t.documents.id, title: t.documents.title, type: t.documents.type, classId: t.documents.classId, subjectId: t.documents.subjectId, tutorId: t.documents.tutorId, status: t.documents.status, createdAt: t.documents.createdAt }).from(t.documents),
      messages: await db.select().from(t.messages),
      users: await db.select({ id: t.users.id, role: t.users.role, username: t.users.username, fullName: t.users.fullName, phone: t.users.phone, isActive: t.users.isActive }).from(t.users),
    };
    await audit(u, 'SAUVEGARDE_EXPORTEE');
    return new NextResponse(JSON.stringify(data, null, 1), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="svtc-sauvegarde-${todayISO()}.json"`, 'Cache-Control': 'no-store' },
    });
  }
  if (kind === 'eleves') {
    rows = (await balances(year.id)).map((b) => ({ matricule: b.matricule, nom: b.lastName, prenom: b.firstName, sexe: b.gender, classe: b.className, etablissement: b.school, statut: b.status, inscription: b.enrolledAt, parent: b.parentName, telephone_parent: b.parentPhone, du_a_ce_jour: b.dueToDate, paye: b.paid, solde: b.balance }));
  } else if (kind === 'paiements') {
    rows = (await db.select({ p: t.payments, nom: t.students.lastName, prenom: t.students.firstName }).from(t.payments).innerJoin(t.students, eq(t.students.id, t.payments.studentId)).orderBy(desc(t.payments.paidAt)))
      .map(({ p, nom, prenom }) => ({ recu: p.receiptNo, date: p.paidAt, eleve: `${nom} ${prenom}`, montant: p.amount, nature: p.type, mode: p.method, reference: p.reference, annule: p.cancelled ? 'oui' : 'non', motif_annulation: p.cancelReason }));
  } else if (kind === 'depenses') {
    rows = (await db.select().from(t.expenses).orderBy(desc(t.expenses.date))).map((e) => ({ date: e.date, categorie: e.category, libelle: e.label, montant: e.amount, mode: e.method, beneficiaire: e.beneficiary, reference: e.reference }));
  } else if (kind === 'seances') {
    rows = (await db.select({ s: t.seances, classe: t.classes.name, matiere: t.subjects.name, nom: t.tutors.lastName, prenom: t.tutors.firstName, salle: t.rooms.name }).from(t.seances)
      .innerJoin(t.classes, eq(t.classes.id, t.seances.classId)).innerJoin(t.subjects, eq(t.subjects.id, t.seances.subjectId)).leftJoin(t.tutors, eq(t.tutors.id, t.seances.tutorId)).leftJoin(t.rooms, eq(t.rooms.id, t.seances.roomId))
      .orderBy(asc(t.seances.date), asc(t.seances.startTime))).map(({ s, ...r }) => ({ date: s.date, debut_prevu: s.startTime, fin_prevue: s.endTime, classe: r.classe, matiere: r.matiere, encadreur: r.nom ? `${r.prenom} ${r.nom}` : '', salle: r.salle, statut: s.status, debut_reel: s.actualStart, fin_reelle: s.actualEnd, valide: s.validated ? 'oui' : 'non', theme: s.topic }));
  } else if (kind === 'presences') {
    rows = (await db.select({ a: t.attendances, date: t.seances.date, nom: t.students.lastName, prenom: t.students.firstName, classe: t.classes.name, matiere: t.subjects.name }).from(t.attendances)
      .innerJoin(t.seances, eq(t.seances.id, t.attendances.seanceId)).innerJoin(t.students, eq(t.students.id, t.attendances.studentId)).innerJoin(t.classes, eq(t.classes.id, t.seances.classId)).innerJoin(t.subjects, eq(t.subjects.id, t.seances.subjectId))
      .orderBy(asc(t.seances.date))).map((r) => ({ date: r.date, classe: r.classe, matiere: r.matiere, eleve: `${r.nom} ${r.prenom}`, statut: r.a.status, commentaire: r.a.comment }));
  } else if (kind === 'notes') {
    rows = (await db.select({ g: t.grades, e: t.evaluations, nom: t.students.lastName, prenom: t.students.firstName, matiere: t.subjects.name }).from(t.grades)
      .innerJoin(t.evaluations, eq(t.evaluations.id, t.grades.evaluationId)).innerJoin(t.students, eq(t.students.id, t.grades.studentId)).innerJoin(t.subjects, eq(t.subjects.id, t.evaluations.subjectId))
      .orderBy(asc(t.evaluations.date))).map((r) => ({ date: r.e.date, evaluation: r.e.title, matiere: r.matiere, eleve: `${r.nom} ${r.prenom}`, note: r.g.score, sur: r.e.maxScore, absent: r.g.absent ? 'oui' : 'non' }));
  } else if (kind === 'encadreurs') {
    rows = (await db.select().from(t.tutors).orderBy(asc(t.tutors.lastName))).map((x) => ({ nom: x.lastName, prenom: x.firstName, telephone: x.phone, email: x.email, specialite: x.specialty, diplome: x.diploma, salaire_reference: x.baseSalary, taux_horaire: x.hourlyRate, actif: x.isActive ? 'oui' : 'non' }));
  } else if (kind === 'salaires') {
    rows = (await db.select({ s: t.salarySlips, nom: t.tutors.lastName, prenom: t.tutors.firstName }).from(t.salarySlips).innerJoin(t.tutors, eq(t.tutors.id, t.salarySlips.tutorId)).orderBy(desc(t.salarySlips.period)))
      .map(({ s, nom, prenom }) => ({ periode: s.period, encadreur: `${prenom} ${nom}`, minutes_prevues: s.plannedMinutes, minutes_effectuees: s.doneMinutes, pourcentage: s.ratePct, brut: s.grossAmount, prime: s.bonus, retenue: s.deduction, net: s.netAmount, statut: s.status }));
  } else return new NextResponse('Export inconnu', { status: 404 });
  await audit(u, 'EXPORT_CSV', { details: { kind } });
  return new NextResponse(csv(rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="svtc-${kind}-${todayISO()}.csv"`, 'Cache-Control': 'no-store' },
  });
}
