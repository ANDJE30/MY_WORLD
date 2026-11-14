import { FileDown, HandCoins, CheckCircle2, Info } from 'lucide-react';
import { computePayroll } from '@/lib/payroll';
import { hours, money, pct, periodLabel, dateTimeFr } from '@/lib/format';
import { SALARY_MODES } from '@/lib/constants';
import { currentPeriod } from '@/lib/time';
import { Avatar, Badge, Card, PageHeader, Progress, Stat, TableWrap, Empty } from '@/components/ui';
import { ActionButton, ActionForm, SubmitButton } from '@/components/client/forms';
import { saveSalaryAdjustments, paySalary, payAllSalaries } from '@/app/actions/finance';

export const metadata = { title: 'Salaires des encadreurs' };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.mois ?? '') ? sp.mois! : currentPeriod();
  const p = await computePayroll(period);
  const toPay = p.rows.filter((r) => r.slip?.status !== 'PAYE' && r.net > 0);
  const pending = p.rows.reduce((a, r) => a + r.pending, 0);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Finances" title="Salaires des encadreurs" subtitle={`${SALARY_MODES[p.mode]} — ${periodLabel(period)}`}
        actions={<>
          <a href={`/api/pdf/salaires?mois=${period}`} target="_blank" className="btn btn-gold"><FileDown size={17} /> État de paiement (PDF)</a>
          {toPay.length > 0 && <ActionButton action={payAllSalaries.bind(null, period)} className="btn btn-success" confirm={`Payer les ${toPay.length} salaire(s) de ${periodLabel(period)} ? Chaque paiement sera inscrit en dépense.`}>Tout payer</ActionButton>}
        </>} />
      <form method="get" className="card flex flex-wrap items-end gap-2 p-3 sm:p-4">
        <label><span className="label">Mois</span><input type="month" name="mois" className="input" defaultValue={period} /></label>
        <button className="btn btn-navy">Afficher</button>
      </form>
      {pending > 0 && <div className="card flex items-start gap-2 border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><Info size={17} className="mt-0.5 shrink-0" /> {pending} séance(s) terminée(s) ne sont pas encore validées. Elles sont comptées, mais vérifiez-les dans « Séances » avant de payer.</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Heures prévues" value={hours(p.totals.planned)} tone="navy" />
        <Stat label="Heures effectuées" value={hours(p.totals.done)} hint={pct(p.totals.planned ? (p.totals.done / p.totals.planned) * 100 : null)} tone="cyan" />
        <Stat label="Masse salariale" value={money(p.totals.net)} tone="gold" icon={<HandCoins size={20} />} />
        <Stat label="Reste à payer" value={money(toPay.reduce((a, r) => a + r.net, 0))} hint={`${toPay.length} encadreur(s)`} tone="red" />
      </div>
      <Card title="État des salaires" subtitle="Primes et retenues modifiables avant paiement. Formule : salaire de référence × (heures effectuées ÷ heures prévues)." pad={false}>
        {p.rows.length === 0 ? <Empty title="Aucun encadreur" /> : (
          <ActionForm action={saveSalaryAdjustments.bind(null, period)} reset={false}>
            <TableWrap>
              <table className="tbl min-w-[900px]">
                <thead><tr><th>Encadreur</th><th className="text-right">Prévues</th><th className="text-right">Effectuées</th><th className="w-40">% des heures</th><th className="text-right">{p.mode === 'PRORATA' ? 'Salaire de référence' : 'Taux horaire'}</th><th className="text-right">Montant dû</th><th className="text-right">Prime</th><th className="text-right">Retenue</th><th className="text-right">Net à payer</th><th /></tr></thead>
                <tbody>
                  {p.rows.map((r) => {
                    const paid = r.slip?.status === 'PAYE';
                    return (
                      <tr key={r.tutor.id}>
                        <td><div className="flex items-center gap-2"><Avatar name={`${r.tutor.firstName} ${r.tutor.lastName}`} color={r.tutor.color} size={32} /><div><p className="font-medium">{r.tutor.firstName} {r.tutor.lastName}</p><p className="text-xs text-slate-500">{r.doneCount}/{r.seances} séance(s)</p></div></div></td>
                        <td className="text-right">{hours(r.planned)}</td>
                        <td className="text-right">{hours(r.done)}</td>
                        <td><div className="flex items-center gap-2"><Progress value={r.ratePct} tone={r.ratePct >= 90 ? 'green' : r.ratePct >= 70 ? 'amber' : 'red'} /><span className="w-14 text-right text-sm font-medium">{pct(r.ratePct, 1)}</span></div></td>
                        <td className="text-right">{money(p.mode === 'PRORATA' ? r.tutor.baseSalary : r.tutor.hourlyRate)}</td>
                        <td className="text-right">{money(r.gross)}</td>
                        <td className="text-right"><input type="number" min={0} name={`bonus_${r.tutor.id}`} defaultValue={r.bonus} disabled={paid} className="input w-24 px-2 py-1.5 text-right" /></td>
                        <td className="text-right"><input type="number" min={0} name={`deduction_${r.tutor.id}`} defaultValue={r.deduction} disabled={paid} className="input w-24 px-2 py-1.5 text-right" /></td>
                        <td className="text-right font-semibold">{money(r.net)}</td>
                        <td>{paid ? <Badge tone="green"><CheckCircle2 size={12} /> Payé {r.slip?.paidAt ? dateTimeFr(r.slip.paidAt).slice(0, 10) : ''}</Badge> : r.net > 0 && <ActionButton action={paySalary.bind(null, period, r.tutor.id, undefined)} className="btn btn-soft btn-sm" confirm={`Payer ${money(r.net)} à ${r.tutor.firstName} ${r.tutor.lastName} ?`}>Payer</ActionButton>}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gold-50 font-semibold"><td>Total</td><td className="text-right">{hours(p.totals.planned)}</td><td className="text-right">{hours(p.totals.done)}</td><td /><td /><td className="text-right">{money(p.totals.gross)}</td><td /><td /><td className="text-right">{money(p.totals.net)}</td><td /></tr>
                </tbody>
              </table>
            </TableWrap>
            <div className="flex justify-end border-t border-navy-50 p-3"><SubmitButton className="btn btn-primary">Enregistrer primes et retenues</SubmitButton></div>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
