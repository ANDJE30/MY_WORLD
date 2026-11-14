import Link from 'next/link';
import { and, count, desc, eq, gte, lt, lte, sql, isNull } from 'drizzle-orm';
import {
  GraduationCap, UserCog, CalendarCheck, ClipboardCheck, Wallet, AlertCircle, Landmark, FileText, ArrowRight, Sparkles, Clock, PlayCircle,
} from 'lucide-react';
import { db } from '@/db';
import { students, tutors, seances, attendances, payments, expenses, documents, parents } from '@/db/schema';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { balances, refData, seancesWithNames } from '@/lib/queries';
import { addDays, addMonths, currentPeriod, periodBounds, todayISO, weekStart, dayOfWeek } from '@/lib/time';
import { money, num, periodLabel, hm, dateLong, pct } from '@/lib/format';
import { MONTHS, SEANCE_STATUS } from '@/lib/constants';
import { attendanceStats } from '@/lib/calc';
import { Badge, Card, PageHeader, Stat, Empty, Progress, rateTone } from '@/components/ui';
import { BarChart, Donut, HBar } from '@/components/charts';

export const metadata = { title: 'Tableau de bord' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ bienvenue?: string; refus?: string }> }) {
  const sp = await searchParams;
  const [year, s, ref] = await Promise.all([getCurrentYear(), getSettings(), refData()]);
  const today = todayISO();
  const wStart = weekStart(today);
  const wEnd = addDays(wStart, 6);
  const period = currentPeriod();
  const { start: mStart, end: mEnd } = periodBounds(period);
  const prev = addMonths(period, -1);
  const pb = periodBounds(prev);
  const sixAgo = addMonths(period, -5);

  const [
    activeByClass, [tutorCount], weekSeances, att30, [monthIn], [prevIn], bal, [yearIn], [yearOut], incomeByMonth, expenseByMonth,
    [docsPending], [notValidated], [notStarted], [noParent], [parentsNoAccount], lastPayments,
  ] = await Promise.all([
    db.select({ classId: students.classId, n: count() }).from(students).where(and(eq(students.academicYearId, year.id), eq(students.status, 'ACTIF'))).groupBy(students.classId),
    db.select({ n: count() }).from(tutors).where(eq(tutors.isActive, true)),
    db.select({ status: seances.status, n: count() }).from(seances).where(and(gte(seances.date, wStart), lte(seances.date, wEnd))).groupBy(seances.status),
    db.select({ status: attendances.status }).from(attendances).innerJoin(seances, eq(seances.id, attendances.seanceId)).where(gte(seances.date, addDays(today, -30))),
    db.select({ t: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(and(eq(payments.cancelled, false), gte(payments.paidAt, new Date(`${mStart}T00:00:00+01:00`)), lte(payments.paidAt, new Date(`${mEnd}T23:59:59+01:00`)))),
    db.select({ t: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(and(eq(payments.cancelled, false), gte(payments.paidAt, new Date(`${pb.start}T00:00:00+01:00`)), lte(payments.paidAt, new Date(`${pb.end}T23:59:59+01:00`)))),
    balances(year.id),
    db.select({ t: sql<number>`coalesce(sum(${payments.amount}),0)::int` }).from(payments).where(and(eq(payments.cancelled, false), eq(payments.academicYearId, year.id))),
    db.select({ t: sql<number>`coalesce(sum(${expenses.amount}),0)::int` }).from(expenses).where(eq(expenses.academicYearId, year.id)),
    db.select({ p: sql<string>`to_char(${payments.paidAt} at time zone 'Africa/Douala', 'YYYY-MM')`, t: sql<number>`sum(${payments.amount})::int` }).from(payments)
      .where(and(eq(payments.cancelled, false), gte(payments.paidAt, new Date(`${sixAgo}-01T00:00:00+01:00`)))).groupBy(sql`1`),
    db.select({ p: sql<string>`to_char(${expenses.date}, 'YYYY-MM')`, t: sql<number>`sum(${expenses.amount})::int` }).from(expenses)
      .where(gte(expenses.date, `${sixAgo}-01`)).groupBy(sql`1`),
    db.select({ n: count() }).from(documents).where(eq(documents.status, 'SOUMIS')),
    db.select({ n: count() }).from(seances).where(and(eq(seances.status, 'TERMINEE'), eq(seances.validated, false))),
    db.select({ n: count() }).from(seances).where(and(eq(seances.status, 'PLANIFIEE'), lt(seances.date, today))),
    db.select({ n: count() }).from(students).where(and(eq(students.academicYearId, year.id), isNull(students.parentId))),
    db.select({ n: count() }).from(parents).where(isNull(parents.userId)),
    db.select({ id: payments.id, amount: payments.amount, paidAt: payments.paidAt, receiptNo: payments.receiptNo, first: students.firstName, last: students.lastName })
      .from(payments).innerJoin(students, eq(students.id, payments.studentId)).where(eq(payments.cancelled, false)).orderBy(desc(payments.paidAt)).limit(5),
  ]);

  const activeStudents = activeByClass.reduce((a, r) => a + Number(r.n), 0);
  const ws = Object.fromEntries(weekSeances.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
  const weekTotal = Object.values(ws).reduce((a, b) => a + b, 0) - (ws.ANNULEE ?? 0);
  const att = attendanceStats(att30.map((a) => a.status));
  const arrears = bal.filter((b) => b.status === 'ACTIF' && b.balance > 0);
  const arrearsSum = arrears.reduce((a, b) => a + b.balance, 0);
  const cash = Number(yearIn.t) - Number(yearOut.t);
  const inc = new Map(incomeByMonth.map((r) => [r.p, Number(r.t)]));
  const exp = new Map(expenseByMonth.map((r) => [r.p, Number(r.t)]));
  const months = Array.from({ length: 6 }, (_, i) => addMonths(sixAgo, i));

  // Prochaine journée de séances (aujourd'hui si c'est un jour de séance)
  const sessionDays = s.sessions.days.map((d) => d.day);
  let next = today;
  for (let i = 0; i < 8 && !sessionDays.includes(dayOfWeek(next)); i++) next = addDays(next, 1);
  const nextList = await seancesWithNames(eq(seances.date, next));
  const monthDelta = Number(prevIn.t) > 0 ? ((Number(monthIn.t) - Number(prevIn.t)) / Number(prevIn.t)) * 100 : null;

  const alerts = [
    Number(docsPending.n) > 0 && { href: '/admin/documents', text: `${num(Number(docsPending.n))} document(s) pédagogique(s) à examiner`, tone: 'amber' },
    Number(notValidated.n) > 0 && { href: '/admin/seances?statut=AVALIDER', text: `${num(Number(notValidated.n))} séance(s) terminée(s) à valider (heures des encadreurs)`, tone: 'blue' },
    Number(notStarted.n) > 0 && { href: '/admin/seances?statut=NONPOINTEE', text: `${num(Number(notStarted.n))} séance(s) passée(s) non pointée(s)`, tone: 'red' },
    arrears.length > 0 && { href: '/admin/impayes', text: `${num(arrears.length)} élève(s) en retard de paiement (${money(arrearsSum)})`, tone: 'red' },
    Number(noParent.n) > 0 && { href: '/admin/eleves?sansparent=1', text: `${num(Number(noParent.n))} élève(s) sans parent rattaché`, tone: 'amber' },
    Number(parentsNoAccount.n) > 0 && { href: '/admin/parents?sanscompte=1', text: `${num(Number(parentsNoAccount.n))} parent(s) sans compte d'accès`, tone: 'slate' },
  ].filter(Boolean) as { href: string; text: string; tone: string }[];

  return (
    <div className="space-y-6">
      {sp.bienvenue && (
        <div className="card flex items-start gap-3 border-gold-200 bg-gradient-to-r from-gold-50 to-white p-4">
          <Sparkles className="mt-0.5 shrink-0 text-gold-500" />
          <div className="text-sm text-navy-900">
            <p className="font-semibold">Bienvenue dans SVTC Répétitions !</p>
            <p className="mt-1 text-slate-600">Étapes conseillées : 1) vérifiez les <Link className="text-royal-700 underline" href="/admin/parametres">paramètres</Link> ; 2) ajoutez les <Link className="text-royal-700 underline" href="/admin/encadreurs">encadreurs</Link> et leurs <Link className="text-royal-700 underline" href="/admin/attributions">attributions</Link> ; 3) importez les <Link className="text-royal-700 underline" href="/admin/eleves">élèves et parents</Link> ; 4) générez le <Link className="text-royal-700 underline" href="/admin/planning">planning</Link>.</p>
          </div>
        </div>
      )}
      {sp.refus && <p className="card border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Vous êtes connecté en tant qu’administrateur : déconnectez-vous pour ouvrir un autre espace.</p>}

      <PageHeader
        kicker={dateLong(today)}
        title={`Tableau de bord — ${s.identity.shortName}`}
        subtitle={`Année ${year.label} · ${s.sessions.days.map((d) => `${d.label} ${hm(d.start)}–${hm(d.end)}`).join(' · ')}`}
        actions={<><Link href="/admin/paiements?nouveau=1" className="btn btn-gold"><Wallet size={17} /> Encaisser</Link><Link href="/admin/messages" className="btn btn-ghost">Message aux parents</Link></>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Élèves actifs" value={num(activeStudents)} hint={`${ref.classes.filter((c) => c.isActive).length} classes`} icon={<GraduationCap size={20} />} tone="blue" />
        <Stat label="Encadreurs" value={num(Number(tutorCount.n))} hint={`${ref.subjects.filter((x) => x.isActive).length} matières`} icon={<UserCog size={20} />} tone="navy" />
        <Stat label="Séances de la semaine" value={`${num(ws.TERMINEE ?? 0)} / ${num(weekTotal)}`} hint={`${ws.EN_COURS ?? 0} en cours · ${ws.ANNULEE ?? 0} annulée(s)`} icon={<CalendarCheck size={20} />} tone="cyan" />
        <Stat label="Présence (30 jours)" value={pct(att.rate)} hint={`${num(att.ABSENT)} absence(s)`} icon={<ClipboardCheck size={20} />} tone="green" />
        <Stat label={`Encaissé en ${MONTHS[Number(period.slice(5)) - 1]}`} value={money(Number(monthIn.t))} hint={monthDelta === null ? 'Premier mois' : `${monthDelta >= 0 ? '+' : ''}${num(monthDelta, 0)} % vs mois précédent`} icon={<Wallet size={20} />} tone="gold" />
        <Stat label="Impayés à ce jour" value={money(arrearsSum)} hint={`${arrears.length} élève(s)`} icon={<AlertCircle size={20} />} tone="red" />
        <Stat label="Solde de caisse" value={money(cash)} hint={`Recettes ${money(Number(yearIn.t))}`} icon={<Landmark size={20} />} tone="violet" />
        <Stat label="Documents à examiner" value={num(Number(docsPending.n))} hint="Fiches de TD déposées" icon={<FileText size={20} />} tone="navy" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Recettes et dépenses (6 derniers mois)" actions={<Link href="/admin/caisse" className="btn btn-ghost btn-sm">État de caisse <ArrowRight size={14} /></Link>}>
          <BarChart
            data={months.map((m) => ({ label: periodLabel(m).slice(0, 4) + '.', values: [inc.get(m) ?? 0, exp.get(m) ?? 0] }))}
            series={[{ name: 'Recettes (paiements des élèves)', color: '#2453d6' }, { name: 'Dépenses (salaires, salles…)', color: '#f2c318' }]}
            format={(v) => (v >= 1000 ? `${num(Math.round(v / 1000))}k` : num(v))}
          />
        </Card>
        <Card title="À traiter" subtitle="Alertes de pilotage">
          {alerts.length === 0 ? (
            <Empty icon={<Sparkles />} title="Tout est à jour" text="Aucune action en attente." />
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-xl border border-navy-50 p-3 text-sm transition hover:border-royal-200 hover:bg-royal-50/40">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.tone === 'red' ? 'bg-rose-500' : a.tone === 'amber' ? 'bg-amber-500' : a.tone === 'blue' ? 'bg-royal-500' : 'bg-slate-400'}`} />
                    <span className="flex-1 text-navy-900">{a.text}</span>
                    <ArrowRight size={15} className="text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={next === today ? "Séances d'aujourd'hui" : `Prochaine journée de séances : ${dateLong(next)}`} actions={<Link href="/admin/seances" className="btn btn-ghost btn-sm">Toutes les séances</Link>} pad={false}>
          {nextList.length === 0 ? (
            <Empty icon={<Clock />} title="Aucune séance générée pour cette date" text="Générez les séances depuis le planning." action={<Link href="/admin/planning" className="btn btn-primary btn-sm">Ouvrir le planning</Link>} />
          ) : (
            <ul className="divide-y divide-navy-50">
              {nextList.map((r) => {
                const st = SEANCE_STATUS[r.s.status];
                return (
                  <li key={r.s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="w-24 shrink-0 text-sm font-semibold text-navy-900">{hm(r.s.startTime)} – {hm(r.s.endTime)}</div>
                    <span className="h-9 w-1 rounded-full" style={{ background: r.subjectColor }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-950">{r.className} · {r.subjectName}</p>
                      <p className="truncate text-xs text-slate-500">{r.tutorFirst ? `${r.tutorFirst} ${r.tutorLast}` : 'Encadreur non attribué'} · {r.roomName ?? 'Salle ?'}</p>
                    </div>
                    {r.s.status === 'EN_COURS' && <PlayCircle size={18} className="animate-pulse text-sky-500" />}
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Effectifs par classe">
          <HBar items={ref.classes.filter((c) => c.isActive).map((c) => ({ label: c.name, value: Number(activeByClass.find((r) => r.classId === c.id)?.n ?? 0), color: c.color }))} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Assiduité globale (30 jours)">
          <div className="flex items-center gap-5">
            <Donut value={att.rate} label="présence" color="#10b981" />
            <ul className="space-y-1.5 text-sm">
              <li>Présents : <strong>{num(att.PRESENT)}</strong></li>
              <li>Retards : <strong>{num(att.RETARD)}</strong></li>
              <li>Absents : <strong className="text-rose-600">{num(att.ABSENT)}</strong></li>
              <li>Justifiés : <strong>{num(att.EXCUSE)}</strong></li>
            </ul>
          </div>
        </Card>
        <Card title="Recouvrement de l'année">
          {(() => {
            const due = bal.reduce((a, b) => a + b.dueToDate, 0);
            const paid = bal.reduce((a, b) => a + Math.min(b.paid, b.dueToDate), 0);
            const rate = due > 0 ? (paid / due) * 100 : null;
            return (
              <div className="space-y-3">
                <div className="flex items-end justify-between"><span className="text-3xl font-semibold text-navy-950">{pct(rate)}</span><span className="text-xs text-slate-500">des sommes dues à ce jour</span></div>
                <Progress value={rate} tone={rateTone(rate) === 'blue' ? 'blue' : rateTone(rate)} />
                <p className="text-sm text-slate-600">Dû à ce jour : <strong>{money(due)}</strong><br />Encaissé (année) : <strong>{money(Number(yearIn.t))}</strong></p>
              </div>
            );
          })()}
        </Card>
        <Card title="Derniers encaissements" actions={<Link href="/admin/paiements" className="btn btn-ghost btn-sm">Voir tout</Link>} pad={false}>
          {lastPayments.length === 0 ? <Empty title="Aucun paiement enregistré" /> : (
            <ul className="divide-y divide-navy-50">
              {lastPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
                  <span className="truncate"><span className="font-medium text-navy-900">{p.last.toUpperCase()} {p.first}</span><span className="block text-xs text-slate-500">{p.receiptNo}</span></span>
                  <span className="shrink-0 font-semibold text-emerald-700">+{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-center text-xs text-slate-400">Astuce : appuyez sur <kbd className="rounded border px-1">Ctrl</kbd> + <kbd className="rounded border px-1">K</kbd> pour atteindre n’importe quelle page.</p>
    </div>
  );
}
