import 'server-only';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { View, Text, Image } from '@react-pdf/renderer';
import { db } from '@/db';
import { timeslots, payments, students, classes, users, seances, verifications, attendances } from '@/db/schema';
import { getCurrentYear, getSettings } from '../settings';
import { balances, refData, seancesWithNames, studentProgress, studentsOfYear, tutorName } from '../queries';
import { computePayroll, computeRentReport, cashJournal } from '../payroll';
import { appreciation, attendanceStats } from '../calc';
import { dateFr, dateLong, dateTimeFr, duration, hm, hours, money, num, pct, periodLabel, phoneFr, score, timeOf } from '../format';
import { DAYS, EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_TYPES, SALARY_MODES, SEANCE_STATUS, ATTENDANCE_STATUS, EVALUATION_TYPES } from '../constants';
import { addDays, periodBounds, todayISO, toMinutes } from '../time';
import { readFile } from '../files';
import { randomCode } from '../passwords';
import { amountInWords } from '../words';
import { C, KeyValues, Signatures, SvtcDoc, Table, qrDataUrl, s, toPdf } from './base';
import type { Settings } from '../settings-types';

async function banner(st: Settings): Promise<{ data: Buffer; format: 'png' | 'jpg' } | null> {
  if (!st.identity.bannerFileId) return null;
  const f = await readFile(st.identity.bannerFileId);
  if (!f) return null;
  if (f.mime === 'image/jpeg') return { data: f.data, format: 'jpg' };
  if (f.mime === 'image/png') return { data: f.data, format: 'png' };
  return null; // WebP non pris en charge par le moteur PDF : bandeau SVTC par défaut
}

function signer(st: Settings) {
  return st.identity.directorName ? `${st.identity.directorTitle}\n${st.identity.directorName}` : st.identity.directorTitle || 'La Direction';
}

const place = (st: Settings) => `Fait à ${st.identity.city}, le ${dateFr(todayISO())}`;

export function appUrl(req: Request) {
  const env = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return env || new URL(req.url).origin;
}

// ---------------------------------------------------------------- Planning
export async function planningPdf(classId: number | null) {
  const [st, year, ref] = await Promise.all([getSettings(), getCurrentYear(), refData()]);
  const list = await db.select().from(timeslots).where(eq(timeslots.academicYearId, year.id)).orderBy(asc(timeslots.dayOfWeek), asc(timeslots.startTime));
  const cls = classId ? ref.classById.get(classId) : null;
  const rooms = ref.rooms.filter((r) => r.isActive || list.some((t) => t.roomId === r.id));
  const label = (t: typeof list[number]) => `${ref.subjectById.get(t.subjectId)?.name ?? ''}\n${t.tutorId ? tutorName(ref.tutorById.get(t.tutorId)) : '—'}`;

  let body;
  if (cls) {
    const mine = list.filter((t) => t.classId === cls.id);
    const upcoming = await seancesWithNames(and(eq(seances.classId, cls.id), gte(seances.date, todayISO()), lte(seances.date, addDays(todayISO(), 35)))!);
    body = (
      <>
        <KeyValues items={[['Classe', cls.name], ['Année scolaire', year.label], ['Lieu', `${st.identity.host}, ${st.identity.address}`], ['Séances', st.sessions.days.map((d) => `${d.label} ${hm(d.start)}–${hm(d.end)}`).join(' · ')]]} />
        <Text style={s.h2}>Planning hebdomadaire</Text>
        <Table cols={[{ label: 'Jour', width: 14 }, { label: 'Horaire', width: 16 }, { label: 'Matière', width: 32 }, { label: 'Encadreur', width: 24 }, { label: 'Salle', width: 14 }]}
          rows={mine.map((t) => [DAYS[t.dayOfWeek], `${hm(t.startTime)} – ${hm(t.endTime)}`, ref.subjectById.get(t.subjectId)?.name ?? '', t.tutorId ? tutorName(ref.tutorById.get(t.tutorId)) : '—', ref.roomById.get(t.roomId ?? 0)?.name ?? '—'])} />
        {upcoming.length > 0 && (
          <>
            <Text style={s.h2}>Séances des cinq prochaines semaines</Text>
            <Table cols={[{ label: 'Date', width: 24 }, { label: 'Horaire', width: 14 }, { label: 'Matière', width: 28 }, { label: 'Encadreur', width: 22 }, { label: 'Salle', width: 12 }]}
              rows={upcoming.map((r) => [dateLong(r.s.date), `${hm(r.s.startTime)}–${hm(r.s.endTime)}`, r.subjectName + (r.s.status === 'ANNULEE' ? ' (annulée)' : ''), r.tutorFirst ? `${r.tutorFirst} ${r.tutorLast}` : '—', r.roomName ?? '—'])} />
          </>
        )}
      </>
    );
  } else {
    body = (
      <>
        {st.sessions.days.map((d) => {
          const daySlots = list.filter((t) => t.dayOfWeek === d.day);
          const keys = [...new Set([...d.slots.map((x) => `${x.start}|${x.end}`), ...daySlots.map((t) => `${t.startTime}|${t.endTime}`)])].sort((a, b) => toMinutes(a) - toMinutes(b));
          const w = 84 / Math.max(1, rooms.length);
          return (
            <View key={d.day} wrap={false} style={{ marginBottom: 10 }}>
              <Text style={s.h2}>{`${DAYS[d.day].toUpperCase()} — ${hm(d.start)} à ${hm(d.end)}`}</Text>
              <Table cols={[{ label: 'Horaire', width: 16 }, ...rooms.map((r) => ({ label: r.name, width: w }))]}
                rows={keys.map((k) => {
                  const [a, b] = k.split('|');
                  return [`${hm(a)} – ${hm(b)}`, ...rooms.map((r) => daySlots.filter((t) => t.startTime === a && t.endTime === b && t.roomId === r.id).map((t) => `${ref.classById.get(t.classId)?.name} — ${label(t).replace('\n', ' — ')}`).join('\n') || '—')];
                })} />
            </View>
          );
        })}
        <Text style={s.h2} break>Planning par classe</Text>
        <Table cols={[{ label: 'Classe', width: 16 }, ...st.sessions.days.map((d) => ({ label: d.label, width: 84 / st.sessions.days.length }))]}
          rows={ref.classes.filter((c) => c.isActive).map((c) => [c.name, ...st.sessions.days.map((d) => list.filter((t) => t.classId === c.id && t.dayOfWeek === d.day).map((t) => `${hm(t.startTime)}–${hm(t.endTime)} ${ref.subjectById.get(t.subjectId)?.code} (${t.tutorId ? tutorName(ref.tutorById.get(t.tutorId)) : '—'}, ${ref.roomById.get(t.roomId ?? 0)?.name ?? '—'})`).join('\n') || '—')])} fontSize={7.6} />
      </>
    );
  }
  return toPdf(
    <SvtcDoc settings={st} landscape title={cls ? `Planning de travail — ${cls.name}` : 'Planning général des séances de répétition'} subtitle={`Année scolaire ${year.label}`}>
      {body}
      <Signatures place={place(st)} right={signer(st)} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- Séances d'un mois
export async function seancesPdf(period: string, classId?: number | null) {
  const st = await getSettings();
  const { start, end } = periodBounds(period);
  const conds = [gte(seances.date, start), lte(seances.date, end)];
  if (classId) conds.push(eq(seances.classId, classId));
  const rows = await seancesWithNames(and(...conds)!);
  return toPdf(
    <SvtcDoc settings={st} landscape title={`Planning des séances — ${periodLabel(period)}`} subtitle={`${rows.length} séance(s) · ${st.sessions.days.map((d) => `${d.label} ${hm(d.start)}–${hm(d.end)}`).join(' · ')}`}>
      <Table cols={[{ label: 'Date', width: 17 }, { label: 'Horaire', width: 10 }, { label: 'Classe', width: 12 }, { label: 'Matière', width: 22 }, { label: 'Encadreur', width: 16 }, { label: 'Salle', width: 8 }, { label: 'Statut', width: 15, align: 'center' }]}
        rows={rows.map((r) => [dateLong(r.s.date), `${hm(r.s.startTime)}–${hm(r.s.endTime)}`, r.className, r.subjectName, r.tutorFirst ? `${r.tutorFirst} ${r.tutorLast}` : '—', r.roomName ?? '—',
          r.s.status === 'TERMINEE' && r.s.actualStart ? `Faite (${timeOf(r.s.actualStart)}–${timeOf(r.s.actualEnd)})` : SEANCE_STATUS[r.s.status].label])} fontSize={7.6} />
      <Signatures place={place(st)} right={signer(st)} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- Salaires
export async function salairesPdf(period: string) {
  const st = await getSettings();
  const p = await computePayroll(period);
  const rows = p.rows.map((r, i) => [
    i + 1, `${r.tutor.lastName} ${r.tutor.firstName}`, `${r.doneCount}/${r.seances}`, hours(r.planned), hours(r.done), pct(r.ratePct, 1),
    money(p.mode === 'PRORATA' ? r.tutor.baseSalary : r.tutor.hourlyRate), money(r.gross), r.bonus ? money(r.bonus) : '—', r.deduction ? money(r.deduction) : '—', money(r.net), r.slip?.status === 'PAYE' ? `Payé ${r.slip.paidAt ? dateFr(r.slip.paidAt.toISOString()) : ''}` : '',
  ]);
  return toPdf(
    <SvtcDoc settings={st} landscape title={`État de paiement des salaires — ${periodLabel(period)}`} subtitle={`${SALARY_MODES[p.mode]}`}>
      <Table cols={[{ label: 'N°', width: 4, align: 'center' }, { label: 'Encadreur', width: 17 }, { label: 'Séances', width: 6, align: 'center' }, { label: 'H. prévues', width: 7, align: 'right' }, { label: 'H. faites', width: 7, align: 'right' }, { label: '% heures', width: 7, align: 'right' },
        { label: p.mode === 'PRORATA' ? 'Salaire réf.' : 'Taux / h', width: 9, align: 'right' }, { label: 'Montant dû', width: 9, align: 'right' }, { label: 'Prime', width: 7, align: 'right' }, { label: 'Retenue', width: 7, align: 'right' }, { label: 'Net à payer', width: 9, align: 'right' }, { label: 'Émargement', width: 11, align: 'center' }]}
        rows={rows} total={['', 'TOTAL', '', hours(p.totals.planned), hours(p.totals.done), pct(p.totals.planned ? (p.totals.done / p.totals.planned) * 100 : null, 1), '', money(p.totals.gross), '', '', money(p.totals.net), '']} fontSize={7.8} />
      <Text style={[s.small, { marginTop: 6 }]}>
        {p.mode === 'PRORATA'
          ? 'Calcul : montant dû = salaire mensuel de référence × (heures effectuées ÷ heures prévues). '
          : 'Calcul : montant dû = taux horaire × heures effectuées. '}
        Heures effectuées : {p.basis === 'ACTUAL_CAPPED' ? 'durée réelle pointée par l’encadreur, plafonnée à la durée prévue de chaque séance' : p.basis === 'ACTUAL' ? 'durée réelle pointée' : 'durée prévue des séances terminées'}. Les séances annulées ne sont pas dues.
      </Text>
      <Text style={{ marginTop: 6, fontWeight: 600 }}>Arrêté le présent état à la somme de : {amountInWords(p.totals.net)} ({money(p.totals.net)}).</Text>
      <Signatures place={place(st)} left="Le Comptable" right={signer(st)} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- Location
export async function locationPdf(period: string) {
  const st = await getSettings();
  const { start, end } = periodBounds(period);
  const rep = await computeRentReport(start, end);
  const basis = { PLANNED: 'durée prévue des séances tenues', ACTUAL: 'durée réelle des séances', WINDOW: 'plage complète de chaque journée de séance' }[rep.basis];
  return toPdf(
    <SvtcDoc settings={st} bannerOverride={await banner(st)} title={`État de location des salles — ${periodLabel(period)}`} subtitle={`Salles du ${st.identity.host} · base de calcul : ${basis}`}>
      <KeyValues items={[
        ['Période', `du ${dateFr(start)} au ${dateFr(end)}`], ['Heures', hours(rep.minutes)],
        ...st.sessions.days.map((d) => [`Tarif ${d.label.toLowerCase()}`, rep.byRoom.map((r) => `${r.room.name} : ${money(r.room.rates?.[String(d.day)] ?? 0)}/h`).join(' · ')] as [string, string]),
      ]} columns={1} />
      {rep.byRoom.map((r) => (
        <View key={r.room.id} wrap={false}>
          <Text style={s.h2}>{r.room.name}</Text>
          <Table cols={[{ label: 'Jour', width: 18 }, { label: 'Date', width: 18 }, { label: 'Séances', width: 12, align: 'center' }, { label: 'Durée', width: 16, align: 'right' }, { label: 'Tarif / heure', width: 18, align: 'right' }, { label: 'Montant', width: 18, align: 'right' }]}
            rows={r.lines.map((l) => [DAYS[l.dayOfWeek], dateFr(l.date), l.seances, duration(l.minutes), money(l.rate), money(l.amount)])}
            total={['Sous-total', '', String(r.lines.reduce((a, l) => a + l.seances, 0)), duration(r.minutes), '', money(r.amount)]} />
        </View>
      ))}
      <View wrap={false} style={{ marginTop: 12 }}>
        <Table cols={[{ label: 'Récapitulatif', width: 50 }, { label: 'Heures', width: 25, align: 'right' }, { label: 'Montant', width: 25, align: 'right' }]}
          rows={[...rep.byDay].map(([d, v]) => [`${DAYS[d]}s`, hours(v.minutes), money(v.amount)])} total={['TOTAL À PAYER', hours(rep.minutes), money(rep.total)]} />
        <Text style={{ marginTop: 6, fontWeight: 600 }}>Arrêté le présent état à la somme de : {amountInWords(rep.total)}.</Text>
      </View>
      <Signatures place={place(st)} left={`Pour le ${st.identity.host}`} right={signer(st)} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- Caisse
export async function caissePdf(from: string, to: string) {
  const st = await getSettings();
  const j = await cashJournal(from, to);
  type L = { d: Date; piece: string; label: string; in: number; out: number };
  const lines: L[] = [
    ...j.ins.map((r) => ({ d: r.p.paidAt, piece: r.p.receiptNo, label: `${PAYMENT_TYPES[r.p.type as keyof typeof PAYMENT_TYPES]} — ${r.last} ${r.first} (${r.classCode}) · ${PAYMENT_METHODS[r.p.method as keyof typeof PAYMENT_METHODS]}`, in: r.p.amount, out: 0 })),
    ...j.outs.map((e) => ({ d: new Date(`${e.date}T12:00:00+01:00`), piece: `DEP-${e.id}`, label: `${e.label} (${EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES]})`, in: 0, out: e.amount })),
  ].sort((a, b) => a.d.getTime() - b.d.getTime());
  let run = j.opening;
  const rows = lines.map((l) => {
    run += l.in - l.out;
    return [dateFr(l.d.toISOString().slice(0, 10)), l.piece, l.label, l.in ? money(l.in) : '', l.out ? money(l.out) : '', money(run)];
  });
  return toPdf(
    <SvtcDoc settings={st} bannerOverride={await banner(st)} title="État de caisse" subtitle={`Du ${dateFr(from)} au ${dateFr(to)}`}>
      <KeyValues items={[['Solde d’ouverture', money(j.opening)], ['Total recettes', money(j.totalIn)], ['Total dépenses', money(j.totalOut)], ['Solde de clôture', money(j.closing)]]} />
      <Text style={s.h2}>Journal de caisse</Text>
      <Table cols={[{ label: 'Date', width: 11 }, { label: 'Pièce', width: 15 }, { label: 'Libellé', width: 38 }, { label: 'Entrée', width: 12, align: 'right' }, { label: 'Sortie', width: 12, align: 'right' }, { label: 'Solde', width: 12, align: 'right' }]}
        rows={[[dateFr(from), '', 'Solde d’ouverture', '', '', money(j.opening)], ...rows]} total={['', '', 'TOTAUX — SOLDE DE CLÔTURE', money(j.totalIn), money(j.totalOut), money(j.closing)]} fontSize={7.6} />
      <View wrap={false} style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Recettes par mode</Text>
          <Table cols={[{ label: 'Mode', width: 60 }, { label: 'Montant', width: 40, align: 'right' }]} rows={[...j.byMethod].map(([k, v]) => [PAYMENT_METHODS[k as keyof typeof PAYMENT_METHODS] ?? k, money(v)])} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Dépenses par catégorie</Text>
          <Table cols={[{ label: 'Catégorie', width: 60 }, { label: 'Montant', width: 40, align: 'right' }]} rows={[...j.byCategory].map(([k, v]) => [EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES] ?? k, money(v)])} />
        </View>
      </View>
      <Text style={{ marginTop: 8, fontWeight: 600 }}>Solde de caisse arrêté à : {amountInWords(Math.max(0, j.closing))}{j.closing < 0 ? ' (solde négatif)' : ''}.</Text>
      <Signatures place={place(st)} left="Le Caissier / Comptable" right={signer(st)} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- Reçu
export async function recuPdf(paymentId: number, base: string) {
  const st = await getSettings();
  const [row] = await db.select({ p: payments, st: students, className: classes.name, by: users.fullName }).from(payments)
    .innerJoin(students, eq(students.id, payments.studentId)).innerJoin(classes, eq(classes.id, students.classId)).leftJoin(users, eq(users.id, payments.receivedBy))
    .where(eq(payments.id, paymentId));
  if (!row) return null;
  const [b] = await balances(row.p.academicYearId, [row.st.id]);
  let [v] = await db.select().from(verifications).where(and(eq(verifications.kind, 'RECU'), eq(verifications.refId, String(paymentId))));
  if (!v) {
    [v] = await db.insert(verifications).values({ code: randomCode(10), kind: 'RECU', refId: String(paymentId), summary: { 'Reçu n°': row.p.receiptNo, Élève: `${row.st.lastName} ${row.st.firstName}`, Montant: money(row.p.amount), Date: dateTimeFr(row.p.paidAt) } }).returning();
  }
  const url = `${base}/verifier/${v.code}`;
  const qr = await qrDataUrl(url);
  return toPdf(
    <SvtcDoc settings={st} size="A5" title="Reçu de paiement" subtitle={`N° ${row.p.receiptNo}`} verifyCode={v.code} verifyUrl={`${base}/verifier`} qr={qr} bannerOverride={await banner(st)}>
      {row.p.cancelled && <Text style={{ color: C.red, fontWeight: 700, textAlign: 'center', fontSize: 14, marginBottom: 6 }}>REÇU ANNULÉ — {row.p.cancelReason}</Text>}
      <KeyValues columns={1} items={[
        ['Date', dateTimeFr(row.p.paidAt)], ['Élève', `${row.st.lastName} ${row.st.firstName}`], ['Matricule', row.st.matricule], ['Classe', row.className],
        ['Nature', PAYMENT_TYPES[row.p.type as keyof typeof PAYMENT_TYPES]], ['Mode', `${PAYMENT_METHODS[row.p.method as keyof typeof PAYMENT_METHODS]}${row.p.reference ? ` — réf. ${row.p.reference}` : ''}`],
        ...(row.p.notes ? [['Observation', row.p.notes] as [string, string]] : []),
      ]} />
      <View style={{ marginTop: 10, backgroundColor: C.navy, borderRadius: 4, padding: 9 }}>
        <Text style={{ color: '#f2c318', fontSize: 8, fontWeight: 600 }}>MONTANT REÇU</Text>
        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 700 }}>{money(row.p.amount)}</Text>
        <Text style={{ color: '#dbe3f6', fontSize: 8, fontStyle: 'italic' }}>{amountInWords(row.p.amount)}</Text>
      </View>
      {b && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text>Total payé (année) : <Text style={{ fontWeight: 600 }}>{money(b.paid)}</Text></Text>
          <Text>{b.balance > 0 ? 'Reste dû à ce jour : ' : 'Situation : '}<Text style={{ fontWeight: 700, color: b.balance > 0 ? C.red : C.green }}>{b.balance > 0 ? money(b.balance) : 'à jour'}</Text></Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <Text style={s.small}>Reçu par : {row.by ?? '—'}</Text>
        <Text style={{ fontWeight: 600, textDecoration: 'underline' }}>Signature et cachet</Text>
      </View>
      <View style={{ height: 34 }} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- État de suivi
export async function suiviPdf(studentId: number, base: string) {
  const st = await getSettings();
  const year = await getCurrentYear();
  const [b] = await studentsOfYear(year.id, eq(students.id, studentId));
  const stu = b ?? (await db.select({ s: students }).from(students).where(eq(students.id, studentId)))[0]?.s;
  if (!stu) return null;
  const info = b ?? null;
  const p = await studentProgress(studentId);
  const refId = `${studentId}:${todayISO()}`;
  await db.insert(verifications).values({ code: randomCode(10), kind: 'SUIVI', refId, summary: { Document: 'État de suivi', Élève: `${stu.lastName} ${stu.firstName}`, 'Assiduité': pct(p.stats.rate), Moyenne: p.average === null ? '—' : `${score(p.average)}/20`, 'Établi le': dateFr(todayISO()) } }).onConflictDoNothing();
  const [v] = await db.select().from(verifications).where(and(eq(verifications.kind, 'SUIVI'), eq(verifications.refId, refId)));
  const qr = await qrDataUrl(`${base}/verifier/${v.code}`);
  const absences = p.attendance.filter((a) => a.status !== 'PRESENT');
  return toPdf(
    <SvtcDoc settings={st} title="État de suivi de l'apprenant" subtitle={`Assiduité et performances — année ${year.label}`} verifyCode={v.code} verifyUrl={`${base}/verifier`} qr={qr} bannerOverride={await banner(st)}>
      <KeyValues items={[
        ['Élève', `${stu.lastName} ${stu.firstName}`], ['Matricule', stu.matricule], ['Classe', info?.className ?? ''], ['Établissement', stu.school ?? '—'],
        ['Parent', info?.parentName ?? '—'], ['Téléphone', phoneFr(info?.parentPhone) || '—'], ['Inscrit(e) le', dateFr(stu.enrolledAt)], ['Édité le', dateFr(todayISO())],
      ]} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }} wrap={false}>
        {[
          ['ASSIDUITÉ', pct(p.stats.rate), `${p.stats.PRESENT + p.stats.RETARD} présence(s) · ${p.stats.ABSENT} absence(s)`],
          ['MOYENNE GÉNÉRALE', p.average === null ? '—' : `${score(p.average)} / 20`, appreciation(p.average)],
          ['ÉVALUATIONS', num(p.grades.length), `${p.stats.RETARD} retard(s) · ${p.stats.EXCUSE} absence(s) justifiée(s)`],
        ].map(([k, v1, h]) => (
          <View key={k} style={{ flex: 1, backgroundColor: C.navy, borderRadius: 4, padding: 8 }}>
            <Text style={{ color: '#f2c318', fontSize: 7.5, fontWeight: 600 }}>{k}</Text>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{v1}</Text>
            <Text style={{ color: '#dbe3f6', fontSize: 7 }}>{h}</Text>
          </View>
        ))}
      </View>
      <Text style={s.h2}>Résultats par matière</Text>
      <Table cols={[{ label: 'Matière', width: 50 }, { label: 'Nombre de notes', width: 20, align: 'center' }, { label: 'Moyenne /20', width: 15, align: 'center' }, { label: 'Niveau', width: 15, align: 'center' }]}
        rows={p.subjectsAvg.map((x) => [x.name, x.count, x.average === null ? '—' : score(x.average), x.average === null ? '—' : x.average >= 14 ? 'Très bon' : x.average >= 10 ? 'Satisfaisant' : 'À renforcer'])}
        total={['Moyenne générale', p.grades.length, p.average === null ? '—' : score(p.average), '']} />
      {p.grades.length > 0 && (
        <>
          <Text style={s.h2}>Détail des évaluations</Text>
          <Table cols={[{ label: 'Date', width: 13 }, { label: 'Évaluation', width: 37 }, { label: 'Type', width: 18 }, { label: 'Matière', width: 20 }, { label: 'Note', width: 12, align: 'center' }]}
            rows={p.grades.map((g) => [dateFr(g.date), g.title, EVALUATION_TYPES[g.type as keyof typeof EVALUATION_TYPES] ?? g.type, g.subjectName, g.absent ? 'Absent' : `${score(g.score)}/${num(g.maxScore)}`])} fontSize={7.8} />
          <View wrap={false} style={{ marginTop: 8 }}>
            <Text style={[s.small, { marginBottom: 3 }]}>Évolution des notes (ramenées sur 20)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, borderBottomWidth: 0.6, borderBottomColor: C.line, gap: 3 }}>
              {p.grades.filter((g) => !g.absent && g.score !== null).slice(-24).map((g, i) => {
                const v20 = ((g.score as number) / g.maxScore) * 20;
                return <View key={i} style={{ flex: 1, height: Math.max(2, (v20 / 20) * 58), backgroundColor: v20 < 10 ? '#e11d48' : C.royal, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />;
              })}
            </View>
          </View>
        </>
      )}
      <Text style={s.h2}>Assiduité — absences et retards</Text>
      {absences.length === 0 ? <Text>Aucune absence ni retard enregistré. Félicitations !</Text> : (
        <Table cols={[{ label: 'Date', width: 20 }, { label: 'Matière', width: 45 }, { label: 'Statut', width: 35 }]}
          rows={absences.map((a) => [dateFr(a.date), a.subjectName, ATTENDANCE_STATUS[a.status].label])} fontSize={7.8} />
      )}
      <View wrap={false} style={{ marginTop: 10, borderWidth: 0.8, borderColor: C.gold, borderRadius: 3, padding: 8, backgroundColor: '#fffdf4' }}>
        <Text style={{ fontWeight: 600, color: C.navy }}>Appréciation générale</Text>
        <Text style={{ marginTop: 2 }}>{appreciation(p.average)}{p.stats.rate !== null && p.stats.rate < 80 ? ' — L’assiduité doit être améliorée.' : p.stats.rate !== null ? ' — Bonne assiduité.' : ''}</Text>
      </View>
      <Signatures place={place(st)} right={signer(st)} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- Listes
export async function elevesPdf(classId: number | null) {
  const [st, year, ref] = await Promise.all([getSettings(), getCurrentYear(), refData()]);
  const list = (await studentsOfYear(year.id, classId ? and(eq(students.classId, classId), eq(students.status, 'ACTIF')) : eq(students.status, 'ACTIF')));
  const groups = ref.classes.filter((c) => list.some((x) => x.classId === c.id));
  return toPdf(
    <SvtcDoc settings={st} bannerOverride={await banner(st)} title={classId ? `Liste des élèves — ${ref.classById.get(classId)?.name}` : 'Liste des élèves par classe'} subtitle={`Année scolaire ${year.label} · ${list.length} élève(s)`}>
      {groups.map((c, gi) => {
        const rows = list.filter((x) => x.classId === c.id);
        return (
          <View key={c.id} break={gi > 0 && !classId}>
            <Text style={s.h2}>{c.name} ({rows.length})</Text>
            <Table cols={[{ label: 'N°', width: 5, align: 'center' }, { label: 'Matricule', width: 14 }, { label: 'Nom et prénoms', width: 28 }, { label: 'Sexe', width: 6, align: 'center' }, { label: 'Établissement', width: 20 }, { label: 'Parent', width: 15 }, { label: 'Téléphone', width: 12 }]}
              rows={rows.map((x, i) => [i + 1, x.matricule, `${x.lastName} ${x.firstName}`, x.gender, x.school ?? '', x.parentName ?? '', phoneFr(x.parentPhone)])} fontSize={7.6} />
          </View>
        );
      })}
    </SvtcDoc>,
  );
}

export async function impayesPdf(classId: number | null) {
  const [st, year] = await Promise.all([getSettings(), getCurrentYear()]);
  const list = (await balances(year.id)).filter((b) => b.status === 'ACTIF' && b.balance > 0 && (!classId || b.classId === classId)).sort((a, b) => a.className.localeCompare(b.className) || b.balance - a.balance);
  const total = list.reduce((a, b) => a + b.balance, 0);
  return toPdf(
    <SvtcDoc settings={st} bannerOverride={await banner(st)} title="État des impayés" subtitle={`Situation au ${dateFr(todayISO())} · ${list.length} élève(s)`}>
      <Table cols={[{ label: 'N°', width: 5, align: 'center' }, { label: 'Élève', width: 27 }, { label: 'Classe', width: 12 }, { label: 'Parent / téléphone', width: 24 }, { label: 'Dû à ce jour', width: 11, align: 'right' }, { label: 'Payé', width: 10, align: 'right' }, { label: 'Reste', width: 11, align: 'right' }]}
        rows={list.map((b, i) => [i + 1, `${b.lastName} ${b.firstName}`, b.classCode, `${b.parentName ?? '—'}\n${phoneFr(b.parentPhone)}`, money(b.dueToDate), money(b.paid), money(b.balance)])}
        total={['', 'TOTAL', '', '', '', '', money(total)]} fontSize={7.8} />
      <Signatures place={place(st)} right={signer(st)} />
    </SvtcDoc>,
  );
}

export async function presencesPdf(classId: number, from: string, to: string) {
  const [st, year, ref] = await Promise.all([getSettings(), getCurrentYear(), refData()]);
  const rows = await db.select({ status: attendances.status, studentId: attendances.studentId }).from(attendances).innerJoin(seances, eq(seances.id, attendances.seanceId))
    .where(and(eq(seances.classId, classId), gte(seances.date, from), lte(seances.date, to)));
  const roster = await studentsOfYear(year.id, and(eq(students.classId, classId), eq(students.status, 'ACTIF')));
  const data = roster.map((r) => ({ r, s: attendanceStats(rows.filter((x) => x.studentId === r.id).map((x) => x.status)) }));
  const g = attendanceStats(rows.map((x) => x.status));
  return toPdf(
    <SvtcDoc settings={st} bannerOverride={await banner(st)} title={`État de présence — ${ref.classById.get(classId)?.name ?? ''}`} subtitle={`Du ${dateFr(from)} au ${dateFr(to)} · taux de présence de la classe : ${pct(g.rate)}`}>
      <Table cols={[{ label: 'N°', width: 6, align: 'center' }, { label: 'Élève', width: 38 }, { label: 'Présent', width: 11, align: 'center' }, { label: 'Retard', width: 11, align: 'center' }, { label: 'Absent', width: 11, align: 'center' }, { label: 'Justifié', width: 11, align: 'center' }, { label: 'Taux', width: 12, align: 'center' }]}
        rows={data.map(({ r, s: x }, i) => [i + 1, `${r.lastName} ${r.firstName}`, x.PRESENT, x.RETARD, x.ABSENT, x.EXCUSE, pct(x.rate)])}
        total={['', 'CLASSE', g.PRESENT, g.RETARD, g.ABSENT, g.EXCUSE, pct(g.rate)]} />
      <Signatures place={place(st)} right={signer(st)} />
    </SvtcDoc>,
  );
}

// ---------------------------------------------------------------- Fiches d'accès
export type CredIn = { name: string; role: 'ADMIN' | 'ENCADREUR' | 'PARENT'; username: string; password: string };

export async function accesPdf(creds: CredIn[], base: string) {
  const st = await getSettings();
  const portal = { ADMIN: '/admin/connexion', ENCADREUR: '/encadreur/connexion', PARENT: '/parent/connexion' };
  const label = { ADMIN: 'Administration', ENCADREUR: 'Espace encadreur', PARENT: 'Espace parents' };
  const qrs = await Promise.all(creds.map((c) => qrDataUrl(`${base}${portal[c.role]}`)));
  return toPdf(
    <SvtcDoc settings={st} bannerOverride={await banner(st)} title="Fiches d'accès personnelles" subtitle="Document confidentiel — découpez et remettez chaque fiche à son destinataire">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {creds.map((c, i) => (
          <View key={i} wrap={false} style={{ width: '48.5%', borderWidth: 1, borderColor: C.navy, borderStyle: 'dashed', borderRadius: 6, padding: 9, marginBottom: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: C.gold, fontWeight: 700, letterSpacing: 0.8 }}>{`SVTC RÉPÉTITIONS — ${label[c.role].toUpperCase()}`}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: 700, color: C.navy, marginTop: 2 }}>{c.name}</Text>
              </View>
              <Image src={qrs[i]} style={{ width: 46, height: 46 }} />
            </View>
            <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 4 }}>Adresse : {base}{portal[c.role]}</Text>
            <View style={{ flexDirection: 'row', marginTop: 5, gap: 6 }}>
              <View style={{ flex: 1, backgroundColor: C.zebra, borderRadius: 3, padding: 5 }}><Text style={{ fontSize: 6.8, color: C.muted }}>IDENTIFIANT</Text><Text style={{ fontSize: 10, fontWeight: 700 }}>{c.username}</Text></View>
              <View style={{ flex: 1, backgroundColor: C.goldLight, borderRadius: 3, padding: 5 }}><Text style={{ fontSize: 6.8, color: C.muted }}>MOT DE PASSE</Text><Text style={{ fontSize: 10, fontWeight: 700 }}>{c.password}</Text></View>
            </View>
            <Text style={{ fontSize: 6.8, color: C.muted, marginTop: 4 }}>Gardez ces informations secrètes. Vous pouvez changer votre mot de passe dans « Mon compte ».</Text>
          </View>
        ))}
      </View>
    </SvtcDoc>,
  );
}

