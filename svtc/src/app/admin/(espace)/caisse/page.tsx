import { FileDown, ArrowDownLeft, ArrowUpRight, Landmark, Scale } from 'lucide-react';
import { cashJournal } from '@/lib/payroll';
import { dateFr, dateTimeFr, money } from '@/lib/format';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants';
import { currentPeriod, periodBounds, todayISO } from '@/lib/time';
import { Card, PageHeader, Stat, TableWrap, Empty } from '@/components/ui';
import { HBar } from '@/components/charts';

export const metadata = { title: 'État de caisse' };

export default async function CashPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const sp = await searchParams;
  const { start } = periodBounds(currentPeriod());
  const from = sp.du ?? start;
  const to = sp.au ?? todayISO();
  const j = await cashJournal(from, to);
  type Line = { date: Date; label: string; sub: string; in: number; out: number };
  const lines: Line[] = [
    ...j.ins.map((r) => ({ date: r.p.paidAt, label: `${r.p.receiptNo} — ${r.last} ${r.first} (${r.classCode})`, sub: PAYMENT_METHODS[r.p.method as keyof typeof PAYMENT_METHODS], in: r.p.amount, out: 0 })),
    ...j.outs.map((e) => ({ date: new Date(`${e.date}T12:00:00+01:00`), label: e.label, sub: EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES], in: 0, out: e.amount })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let run = j.opening;
  return (
    <div className="space-y-6">
      <PageHeader kicker="Finances" title="État de caisse" subtitle="Journal chronologique des recettes et des dépenses, avec soldes d'ouverture et de clôture."
        actions={<a href={`/api/pdf/caisse?du=${from}&au=${to}`} target="_blank" className="btn btn-gold"><FileDown size={17} /> Exporter l&apos;état de caisse (PDF)</a>} />
      <form method="get" className="card flex flex-wrap items-end gap-2 p-3 sm:p-4">
        <label><span className="label">Du</span><input type="date" name="du" className="input" defaultValue={from} /></label>
        <label><span className="label">Au</span><input type="date" name="au" className="input" defaultValue={to} /></label>
        <button className="btn btn-navy">Afficher</button>
      </form>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Solde d'ouverture" value={money(j.opening)} hint={`au ${dateFr(from)}`} tone="navy" icon={<Landmark size={20} />} />
        <Stat label="Recettes" value={money(j.totalIn)} hint={`${j.ins.length} encaissement(s)`} tone="green" icon={<ArrowDownLeft size={20} />} />
        <Stat label="Dépenses" value={money(j.totalOut)} hint={`${j.outs.length} sortie(s)`} tone="red" icon={<ArrowUpRight size={20} />} />
        <Stat label="Solde de clôture" value={money(j.closing)} hint={`au ${dateFr(to)}`} tone="gold" icon={<Scale size={20} />} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Recettes par mode de paiement"><HBar items={[...j.byMethod].map(([k, v]) => ({ label: PAYMENT_METHODS[k as keyof typeof PAYMENT_METHODS] ?? k, value: v, color: '#10b981' }))} format={money} /></Card>
          <Card title="Dépenses par catégorie"><HBar items={[...j.byCategory].map(([k, v]) => ({ label: EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES] ?? k, value: v, color: '#e11d48' }))} format={money} /></Card>
        </div>
        <Card className="lg:col-span-2" title="Journal de caisse" pad={false}>
          {lines.length === 0 ? <Empty title="Aucune opération sur la période" /> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Opération</th><th className="text-right">Entrée</th><th className="text-right">Sortie</th><th className="text-right">Solde</th></tr></thead>
                <tbody>
                  <tr className="bg-navy-50/60"><td colSpan={4} className="font-medium">Solde d&apos;ouverture</td><td className="text-right font-semibold">{money(j.opening)}</td></tr>
                  {lines.map((l, i) => {
                    run += l.in - l.out;
                    return (
                      <tr key={i}>
                        <td className="whitespace-nowrap text-xs">{dateTimeFr(l.date).replace(' à 12:00', '')}</td>
                        <td><p className="text-sm">{l.label}</p><p className="text-xs text-slate-500">{l.sub}</p></td>
                        <td className="text-right text-emerald-700">{l.in ? money(l.in) : ''}</td>
                        <td className="text-right text-rose-600">{l.out ? money(l.out) : ''}</td>
                        <td className="text-right font-medium">{money(run)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gold-50"><td colSpan={2} className="font-semibold">Totaux et solde de clôture</td><td className="text-right font-semibold text-emerald-700">{money(j.totalIn)}</td><td className="text-right font-semibold text-rose-600">{money(j.totalOut)}</td><td className="text-right font-bold">{money(j.closing)}</td></tr>
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
