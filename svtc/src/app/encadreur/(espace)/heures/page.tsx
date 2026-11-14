import Link from 'next/link';
import { and, eq, gte, lte } from 'drizzle-orm';
import { seances, salarySlips } from '@/db/schema';
import { db } from '@/db';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { seancesWithNames } from '@/lib/queries';
import { myProfile } from '@/lib/tutor';
import { computeSalary, doneMinutes, plannedMinutes } from '@/lib/calc';
import { addMonths, currentPeriod, periodBounds } from '@/lib/time';
import { dateFr, duration, hours, money, pct, periodLabel, timeOf, hm } from '@/lib/format';
import { SALARY_MODES, SEANCE_STATUS } from '@/lib/constants';
import { Badge, Card, PageHeader, Progress, Stat, TableWrap } from '@/components/ui';

export const metadata = { title: 'Mes heures' };

export default async function TutorHours({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const me = await requireRole('ENCADREUR');
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.mois ?? '') ? sp.mois! : currentPeriod();
  const { start, end } = periodBounds(period);
  const [s, profile, rows, [slip]] = await Promise.all([
    getSettings(), myProfile(me.tutorId!),
    seancesWithNames(and(eq(seances.tutorId, me.tutorId!), gte(seances.date, start), lte(seances.date, end))!),
    db.select().from(salarySlips).where(and(eq(salarySlips.tutorId, me.tutorId!), eq(salarySlips.period, period))),
  ]);
  const planned = rows.filter((r) => r.s.status !== 'ANNULEE').reduce((a, r) => a + plannedMinutes(r.s), 0);
  const done = rows.reduce((a, r) => a + doneMinutes(r.s, s.salary.countBasis), 0);
  const pay = computeSalary({ mode: s.salary.mode, baseSalary: profile.baseSalary, hourlyRate: profile.hourlyRate, plannedMin: planned, doneMin: done, capAt100: s.salary.capAt100, bonus: slip?.bonus, deduction: slip?.deduction });
  return (
    <div className="space-y-5">
      <PageHeader title="Mes heures et ma rémunération" subtitle={`${SALARY_MODES[s.salary.mode]} — ${periodLabel(period)}`}
        actions={<div className="flex gap-2"><Link href={`?mois=${addMonths(period, -1)}`} className="btn btn-ghost btn-sm">← Mois précédent</Link><Link href={`?mois=${addMonths(period, 1)}`} className="btn btn-ghost btn-sm">Mois suivant →</Link></div>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Heures prévues" value={hours(planned)} tone="navy" />
        <Stat label="Heures effectuées" value={hours(done)} tone="cyan" />
        <Stat label="Pourcentage" value={pct(pay.ratePct, 1)} hint={<Progress value={pay.ratePct} tone={pay.ratePct >= 90 ? 'green' : 'amber'} />} tone="green" />
        <Stat label={slip?.status === 'PAYE' ? 'Salaire payé' : 'Estimation'} value={money(slip?.status === 'PAYE' ? slip.netAmount : pay.net)} hint={slip?.status === 'PAYE' ? `le ${dateFr(slip.paidAt?.toISOString().slice(0, 10))}` : s.salary.mode === 'PRORATA' ? `${money(profile.baseSalary)} × ${pct(pay.ratePct, 1)}` : `${money(profile.hourlyRate)} / heure`} tone="gold" />
      </div>
      <Card title="Détail des séances" pad={false}>
        <TableWrap>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Classe · matière</th><th className="text-right">Prévu</th><th className="text-right">Réalisé</th><th className="text-right">Retenu</th><th>Statut</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.id}>
                  <td className="whitespace-nowrap">{dateFr(r.s.date)}<p className="text-xs text-slate-500">{hm(r.s.startTime)}–{hm(r.s.endTime)}</p></td>
                  <td>{r.className}<p className="text-xs text-slate-500">{r.subjectName}</p></td>
                  <td className="text-right">{duration(plannedMinutes(r.s))}</td>
                  <td className="text-right text-sm">{r.s.actualStart ? `${timeOf(r.s.actualStart)}–${r.s.actualEnd ? timeOf(r.s.actualEnd) : '…'}` : '—'}</td>
                  <td className="text-right font-medium">{duration(doneMinutes(r.s, s.salary.countBasis))}</td>
                  <td><Badge tone={SEANCE_STATUS[r.s.status].tone}>{SEANCE_STATUS[r.s.status].label}</Badge>{r.s.validated && <Badge tone="green" className="ml-1">Validée</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
