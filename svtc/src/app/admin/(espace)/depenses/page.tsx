import { and, desc, gte, lte } from 'drizzle-orm';
import { Plus, Trash2, ReceiptText } from 'lucide-react';
import { db } from '@/db';
import { expenses } from '@/db/schema';
import { dateFr, money } from '@/lib/format';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants';
import { currentPeriod, periodBounds, todayISO } from '@/lib/time';
import { Badge, Card, Empty, PageHeader, Stat, TableWrap } from '@/components/ui';
import { HBar } from '@/components/charts';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { recordExpense, deleteExpense } from '@/app/actions/finance';

export const metadata = { title: 'Dépenses' };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const sp = await searchParams;
  const { start } = periodBounds(currentPeriod());
  const from = sp.du ?? start;
  const to = sp.au ?? todayISO();
  const list = await db.select().from(expenses).where(and(gte(expenses.date, from), lte(expenses.date, to))).orderBy(desc(expenses.date), desc(expenses.id));
  const total = list.reduce((a, e) => a + e.amount, 0);
  const byCat = Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => ({ label: v, value: list.filter((e) => e.category === k).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.value > 0);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Finances" title="Dépenses" subtitle="Sorties de caisse. Les salaires et la location des salles réglés depuis leurs modules y sont inscrits automatiquement."
        actions={
          <Modal title="Nouvelle dépense" trigger={<button className="btn btn-primary"><Plus size={17} /> Ajouter une dépense</button>}>
            <ActionForm action={recordExpense} className="grid gap-4 sm:grid-cols-2">
              <label><span className="label">Date</span><input type="date" name="date" className="input" defaultValue={todayISO()} max={todayISO()} required /></label>
              <label><span className="label">Catégorie</span><select name="category" className="input" defaultValue="FOURNITURES">{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="sm:col-span-2"><span className="label">Libellé</span><input name="label" className="input" required placeholder="Ex. : Impression des fiches de TD" /></label>
              <label><span className="label">Montant (FCFA)</span><input name="amount" type="number" min={1} className="input" required /></label>
              <label><span className="label">Mode</span><select name="method" className="input">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label><span className="label">Bénéficiaire</span><input name="beneficiary" className="input" /></label>
              <label><span className="label">Référence / pièce</span><input name="reference" className="input" /></label>
              <div className="sm:col-span-2"><SubmitButton>Enregistrer</SubmitButton></div>
            </ActionForm>
          </Modal>
        } />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Stat label="Total des dépenses (période)" value={money(total)} hint={`${list.length} opération(s)`} tone="red" icon={<ReceiptText size={20} />} />
          <Card title="Par catégorie">{byCat.length ? <HBar items={byCat} format={(v) => money(v)} /> : <p className="text-sm text-slate-500">—</p>}</Card>
        </div>
        <Card className="lg:col-span-2" pad={false}>
          <form method="get" className="flex flex-wrap items-end gap-2 border-b border-navy-50 p-3 sm:p-4">
            <label><span className="label">Du</span><input type="date" name="du" className="input" defaultValue={from} /></label>
            <label><span className="label">Au</span><input type="date" name="au" className="input" defaultValue={to} /></label>
            <button className="btn btn-navy">Afficher</button>
          </form>
          {list.length === 0 ? <Empty title="Aucune dépense sur cette période" /> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Libellé</th><th className="hidden md:table-cell">Catégorie</th><th className="text-right">Montant</th><th /></tr></thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap">{dateFr(e.date)}</td>
                      <td><p className="font-medium">{e.label}</p><p className="text-xs text-slate-500">{[e.beneficiary, PAYMENT_METHODS[e.method as keyof typeof PAYMENT_METHODS], e.reference].filter(Boolean).join(' · ')}</p></td>
                      <td className="hidden md:table-cell"><Badge tone={e.category === 'SALAIRE' ? 'blue' : e.category === 'LOCATION_SALLE' ? 'violet' : 'slate'}>{EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES]}</Badge></td>
                      <td className="text-right font-semibold text-rose-600">−{money(e.amount)}</td>
                      <td><ActionButton action={deleteExpense.bind(null, e.id)} confirm={`Supprimer « ${e.label} » ?${e.sourceType ? ' Le règlement associé (salaire ou location) repassera « non payé ».' : ''}`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
