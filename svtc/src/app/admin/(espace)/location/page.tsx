import { FileDown, Building2, CheckCircle2 } from 'lucide-react';
import { computeRentReport, rentSettlement } from '@/lib/payroll';
import { getSettings } from '@/lib/settings';
import { dateFr, dateTimeFr, duration, hours, money, periodLabel } from '@/lib/format';
import { DAYS } from '@/lib/constants';
import { currentPeriod, periodBounds } from '@/lib/time';
import { Badge, Card, PageHeader, Stat, TableWrap, Empty } from '@/components/ui';
import { ActionButton } from '@/components/client/forms';
import { payRent } from '@/app/actions/finance';

export const metadata = { title: 'Location des salles' };

const BASIS = { PLANNED: 'durée prévue des séances tenues', ACTUAL: 'durée réelle pointée', WINDOW: 'plage complète de chaque journée de séance' };

export default async function RentPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.mois ?? '') ? sp.mois! : currentPeriod();
  const { start, end } = periodBounds(period);
  const [rep, paid, s] = await Promise.all([computeRentReport(start, end), rentSettlement(period), getSettings()]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Finances" title="Location des salles" subtitle={`Calcul selon la ${BASIS[rep.basis]} · tarifs : ${s.sessions.days.map((d) => `${d.label.toLowerCase()}`).join(' / ')} définis dans Salles.`}
        actions={<>
          <a href={`/api/pdf/location?mois=${period}`} target="_blank" className="btn btn-gold"><FileDown size={17} /> État de location (PDF)</a>
          {!paid && rep.total > 0 && <ActionButton action={payRent.bind(null, period)} className="btn btn-success" confirm={`Enregistrer le règlement de ${money(rep.total)} pour ${periodLabel(period)} ? Une dépense sera créée.`}>Marquer comme réglé</ActionButton>}
        </>} />
      <form method="get" className="card flex flex-wrap items-end gap-2 p-3 sm:p-4">
        <label><span className="label">Mois</span><input type="month" name="mois" className="input" defaultValue={period} /></label>
        <button className="btn btn-navy">Afficher</button>
        {paid && <Badge tone="green"><CheckCircle2 size={13} /> Réglé le {dateTimeFr(paid.paidAt)} ({money(paid.amount)})</Badge>}
      </form>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Total ${periodLabel(period)}`} value={money(rep.total)} tone="gold" icon={<Building2 size={20} />} />
        <Stat label="Heures de location" value={hours(rep.minutes)} tone="navy" />
        {[...rep.byDay].map(([d, v]) => <Stat key={d} label={`${DAYS[d]}s`} value={money(v.amount)} hint={hours(v.minutes)} tone={d === 0 ? 'violet' : 'blue'} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {rep.byRoom.map((r) => (
          <Card key={r.room.id} title={r.room.name} subtitle={`${hours(r.minutes)} · ${money(r.amount)}`} pad={false}>
            {r.lines.length === 0 ? <Empty title="Aucune utilisation ce mois-ci" /> : (
              <TableWrap>
                <table className="tbl">
                  <thead><tr><th>Date</th><th className="text-center">Séances</th><th className="text-right">Durée</th><th className="text-right">Tarif / h</th><th className="text-right">Montant</th></tr></thead>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={l.date}>
                        <td>{DAYS[l.dayOfWeek]} {dateFr(l.date)}</td><td className="text-center">{l.seances}</td><td className="text-right">{duration(l.minutes)}</td><td className="text-right">{money(l.rate)}</td><td className="text-right font-semibold">{money(l.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gold-50"><td colSpan={2} className="font-semibold">Total {r.room.name}</td><td className="text-right font-semibold">{duration(r.minutes)}</td><td /><td className="text-right font-bold">{money(r.amount)}</td></tr>
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
