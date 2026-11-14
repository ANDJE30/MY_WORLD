import Link from 'next/link';
import { and, asc, eq, gte, lte, lt, inArray } from 'drizzle-orm';
import { Play, Square, ClipboardCheck, Clock, Wallet, TrendingUp, Users, AlertTriangle, ArrowRight, CalendarDays, FileWarning } from 'lucide-react';
import { db } from '@/db';
import { seances, documents, attendances } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { seancesWithNames } from '@/lib/queries';
import { myAssignments, myProfile } from '@/lib/tutor';
import { computeSalary, doneMinutes, plannedMinutes, attendanceStats } from '@/lib/calc';
import { addDays, currentPeriod, periodBounds, todayISO } from '@/lib/time';
import { dateLong, hm, hours, money, pct, periodLabel } from '@/lib/format';
import { SEANCE_STATUS } from '@/lib/constants';
import { Badge, Dot, Progress, rateTone } from '@/components/ui';
import { ActionButton } from '@/components/client/forms';
import { LiveTimer } from '@/components/client/timer';
import { startSeance, endSeance } from '@/app/actions/tutor';

export const metadata = { title: 'Espace encadreur' };

export default async function TutorHome({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const me = await requireRole('ENCADREUR');
  const sp = await searchParams;
  const tutorId = me.tutorId!;
  const today = todayISO();
  const period = currentPeriod();
  const { start, end } = periodBounds(period);
  const [s, profile, asg, todayList, monthList, upcoming, late, docs] = await Promise.all([
    getSettings(), myProfile(tutorId), myAssignments(tutorId),
    seancesWithNames(and(eq(seances.tutorId, tutorId), eq(seances.date, today))!),
    db.select().from(seances).where(and(eq(seances.tutorId, tutorId), gte(seances.date, start), lte(seances.date, end))),
    seancesWithNames(and(eq(seances.tutorId, tutorId), gte(seances.date, addDays(today, 1)), eq(seances.status, 'PLANIFIEE'))!),
    seancesWithNames(and(eq(seances.tutorId, tutorId), lt(seances.date, today), gte(seances.date, addDays(today, -7)), inArray(seances.status, ['PLANIFIEE', 'EN_COURS']))!),
    db.select().from(documents).where(and(eq(documents.tutorId, tutorId), eq(documents.status, 'A_REVOIR'))),
  ]);
  const planned = monthList.filter((x) => x.status !== 'ANNULEE').reduce((a, x) => a + plannedMinutes(x), 0);
  const done = monthList.reduce((a, x) => a + doneMinutes(x, s.salary.countBasis), 0);
  const pay = computeSalary({ mode: s.salary.mode, baseSalary: profile.baseSalary, hourlyRate: profile.hourlyRate, plannedMin: planned, doneMin: done, capAt100: s.salary.capAt100 });
  const att = asg.classIds.length
    ? await db.select({ status: attendances.status }).from(attendances).innerJoin(seances, eq(seances.id, attendances.seanceId)).where(and(eq(seances.tutorId, tutorId), gte(seances.date, addDays(today, -30))))
    : [];
  const attRate = attendanceStats(att.map((a) => a.status)).rate;
  const next = upcoming.slice(0, 4);
  const hour = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', hour: 'numeric' }).format(new Date()));

  return (
    <div className="space-y-6">
      {sp.refus && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Vous êtes connecté(e) avec un compte encadreur : cet espace est le vôtre.</p>}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-royal-600 via-royal-700 to-navy-900 p-5 text-white shadow-[var(--shadow-lift)] sm:p-7">
        <div className="absolute inset-0 circuit-bg opacity-40" />
        <div className="relative">
          <p className="text-sm first-up text-royal-100">{dateLong(today)}</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'}, {profile.firstName} 👋</h1>
          <p className="mt-1 text-sm text-royal-100">{todayList.length ? `Vous avez ${todayList.length} séance(s) aujourd'hui.` : next[0] ? `Prochaine séance : ${dateLong(next[0].s.date)} à ${hm(next[0].s.startTime)}.` : 'Aucune séance planifiée.'}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {asg.rows.map((a) => <span key={`${a.classId}-${a.subjectId}`} className="rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/20">{a.classCode} · {a.subjectName}</span>)}
          </div>
        </div>
      </section>

      {todayList.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-navy-950">Séances du jour</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {todayList.map((r) => (
              <div key={r.s.id} className={`card overflow-hidden ${r.s.status === 'EN_COURS' ? 'ring-2 ring-sky-400' : ''}`}>
                <div className="flex items-start gap-3 p-4">
                  <span className="mt-1 h-12 w-1.5 rounded-full" style={{ background: r.subjectColor }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-navy-950">{r.className}</p>
                    <p className="text-sm text-slate-600">{r.subjectName}</p>
                    <p className="mt-1 text-sm text-slate-500">{hm(r.s.startTime)} – {hm(r.s.endTime)} · {r.roomName ?? 'Salle ?'}</p>
                  </div>
                  <Badge tone={SEANCE_STATUS[r.s.status].tone}>{SEANCE_STATUS[r.s.status].label}</Badge>
                </div>
                {r.s.status === 'EN_COURS' && r.s.actualStart && (
                  <div className="flex items-center justify-between bg-sky-50 px-4 py-2 text-sm text-sky-800"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse-ring rounded-full bg-sky-500" /> En cours depuis</span><span className="text-lg font-semibold"><LiveTimer since={r.s.actualStart.toISOString()} /></span></div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-navy-50 p-3">
                  {r.s.status === 'PLANIFIEE' && <ActionButton action={startSeance.bind(null, r.s.id)} className="btn btn-success flex-1 py-3"><Play size={18} /> Démarrer la séance</ActionButton>}
                  {r.s.status === 'EN_COURS' && <>
                    <Link href={`/encadreur/seances/${r.s.id}#appel`} className="btn btn-primary flex-1 py-3"><ClipboardCheck size={18} /> Faire l&apos;appel</Link>
                    <ActionButton action={endSeance.bind(null, r.s.id)} confirm="Terminer la séance maintenant ?" className="btn btn-danger flex-1 py-3"><Square size={16} /> Terminer</ActionButton>
                  </>}
                  {(r.s.status === 'TERMINEE' || r.s.status === 'ANNULEE') && <Link href={`/encadreur/seances/${r.s.id}`} className="btn btn-ghost flex-1">Voir la séance</Link>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(late.length > 0 || docs.length > 0) && (
        <section className="space-y-2">
          {late.map((r) => (
            <Link key={r.s.id} href={`/encadreur/seances/${r.s.id}`} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle size={18} className="shrink-0" />
              <span className="flex-1">Séance du {dateLong(r.s.date)} ({r.className}) non clôturée : saisissez vos heures et l&apos;appel.</span>
              <ArrowRight size={16} />
            </Link>
          ))}
          {docs.map((d) => (
            <Link key={d.id} href="/encadreur/documents" className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <FileWarning size={18} className="shrink-0" /><span className="flex-1">« {d.title} » est à revoir : {d.adminComment ?? 'voir le commentaire'}</span><ArrowRight size={16} />
            </Link>
          ))}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Clock, label: `Heures — ${periodLabel(period)}`, value: hours(done), hint: `sur ${hours(planned)} prévues` },
          { icon: TrendingUp, label: 'Taux d’heures effectuées', value: pct(pay.ratePct, 0), hint: <Progress value={pay.ratePct} tone={pay.ratePct >= 90 ? 'green' : 'amber'} /> },
          { icon: Wallet, label: 'Estimation de salaire', value: money(pay.gross), hint: s.salary.mode === 'PRORATA' ? 'au prorata des heures' : 'taux horaire' },
          { icon: Users, label: 'Présence de mes élèves', value: pct(attRate), hint: <Progress value={attRate} tone={rateTone(attRate) === 'blue' ? 'blue' : rateTone(attRate)} /> },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <k.icon size={20} className="text-royal-600" />
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className="text-xl font-semibold text-navy-950">{k.value}</p>
            <div className="mt-1 text-xs text-slate-500">{k.hint}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="flex items-center justify-between border-b border-navy-50 px-4 py-3"><h2 className="font-semibold text-navy-950">Prochaines séances</h2><Link href="/encadreur/seances" className="text-sm text-royal-700">Tout voir</Link></div>
        {next.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Aucune séance à venir.</p> : (
          <ul className="divide-y divide-navy-50">
            {next.map((r) => (
              <li key={r.s.id}>
                <Link href={`/encadreur/seances/${r.s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-royal-50/40">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-navy-950 text-white"><CalendarDays size={14} className="text-gold-400" /><span className="text-xs font-semibold">{r.s.date.slice(8)}/{r.s.date.slice(5, 7)}</span></span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-navy-950"><Dot color={r.subjectColor} /> {r.className} · {r.subjectName}</p><p className="text-sm first-up text-slate-500">{dateLong(r.s.date)} · {hm(r.s.startTime)}–{hm(r.s.endTime)} · {r.roomName}</p></div>
                  <ArrowRight size={16} className="text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
