import Link from 'next/link';
import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { Wallet, Printer, Ban, Search, FileDown } from 'lucide-react';
import { db } from '@/db';
import { payments, students, classes, users } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { balances } from '@/lib/queries';
import { dateTimeFr, money, num } from '@/lib/format';
import { PAYMENT_METHODS, PAYMENT_TYPES } from '@/lib/constants';
import { currentPeriod, periodBounds, todayISO } from '@/lib/time';
import { Badge, Card, Empty, PageHeader, Stat, TableWrap } from '@/components/ui';
import { ActionForm, AutoSubmitSelect, Modal, SubmitButton } from '@/components/client/forms';
import { PaymentForm } from '@/components/admin/payment-form';
import { cancelPayment } from '@/app/actions/finance';

export const metadata = { title: 'Paiements des élèves' };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string; mode?: string; q?: string; nouveau?: string }> }) {
  const sp = await searchParams;
  const { start } = periodBounds(currentPeriod());
  const from = sp.du ?? start;
  const to = sp.au ?? todayISO();
  const year = await getCurrentYear();
  const conds: SQL[] = [gte(payments.paidAt, new Date(`${from}T00:00:00+01:00`)), lte(payments.paidAt, new Date(`${to}T23:59:59+01:00`))];
  if (sp.mode) conds.push(eq(payments.method, sp.mode));
  const [rows, bal] = await Promise.all([
    db.select({ p: payments, first: students.firstName, last: students.lastName, classCode: classes.code, by: users.fullName })
      .from(payments).innerJoin(students, eq(students.id, payments.studentId)).innerJoin(classes, eq(classes.id, students.classId)).leftJoin(users, eq(users.id, payments.receivedBy))
      .where(and(...conds)).orderBy(desc(payments.paidAt)).limit(500),
    balances(year.id),
  ]);
  const q = (sp.q ?? '').toLowerCase();
  const list = rows.filter((r) => !q || `${r.last} ${r.first} ${r.p.receiptNo} ${r.p.reference ?? ''}`.toLowerCase().includes(q));
  const valid = list.filter((r) => !r.p.cancelled);
  const total = valid.reduce((a, r) => a + r.p.amount, 0);
  const byMethod = Object.keys(PAYMENT_METHODS).map((m) => ({ m, t: valid.filter((r) => r.p.method === m).reduce((a, r) => a + r.p.amount, 0) })).filter((x) => x.t > 0);
  const opts = bal.filter((b) => b.status !== 'ABANDON').map((b) => ({ id: b.id, label: `${b.lastName} ${b.firstName} (${b.classCode})`, balance: b.balance, monthlyNet: b.monthlyNet }));
  return (
    <div className="space-y-6">
      <PageHeader kicker="Finances" title="Paiements des élèves" subtitle="Encaissements, reçus numérotés avec QR code de vérification, annulations tracées."
        actions={<>
          <a href={`/api/pdf/caisse?du=${from}&au=${to}`} target="_blank" className="btn btn-ghost"><FileDown size={17} /> État de caisse</a>
          <Modal title="Encaisser un paiement" defaultOpen={!!sp.nouveau} trigger={<button className="btn btn-gold"><Wallet size={17} /> Encaisser</button>}><PaymentForm students={opts} /></Modal>
        </>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total encaissé (période)" value={money(total)} hint={`${valid.length} paiement(s)`} tone="gold" />
        {byMethod.slice(0, 3).map((x) => <Stat key={x.m} label={PAYMENT_METHODS[x.m as keyof typeof PAYMENT_METHODS]} value={money(x.t)} tone={x.m === 'ESPECES' ? 'green' : x.m === 'MTN_MOMO' ? 'gold' : 'blue'} />)}
      </div>
      <Card pad={false}>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-navy-50 p-3 sm:p-4">
          <label><span className="label">Du</span><input type="date" name="du" className="input" defaultValue={from} /></label>
          <label><span className="label">Au</span><input type="date" name="au" className="input" defaultValue={to} /></label>
          <AutoSubmitSelect name="mode" defaultValue={sp.mode ?? ''} className="input w-auto"><option value="">Tous les modes</option>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSubmitSelect>
          <div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={sp.q} className="input pl-9" placeholder="Élève, n° de reçu, référence…" /></div>
          <button className="btn btn-navy">Afficher</button>
        </form>
        {list.length === 0 ? <Empty icon={<Wallet />} title="Aucun paiement sur cette période" /> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Reçu</th><th>Élève</th><th className="hidden md:table-cell">Nature</th><th className="hidden lg:table-cell">Mode</th><th className="text-right">Montant</th><th className="w-24" /></tr></thead>
              <tbody>
                {list.map(({ p, first, last, classCode, by }) => (
                  <tr key={p.id} className={p.cancelled ? 'opacity-55' : ''}>
                    <td><p className="font-mono text-xs font-semibold">{p.receiptNo}</p><p className="text-xs text-slate-500">{dateTimeFr(p.paidAt)}</p></td>
                    <td><Link href={`/admin/eleves/${p.studentId}`} className="font-medium hover:text-royal-700">{last} {first}</Link><p className="text-xs text-slate-500">{classCode}{by ? ` · reçu par ${by}` : ''}</p></td>
                    <td className="hidden md:table-cell">{PAYMENT_TYPES[p.type as keyof typeof PAYMENT_TYPES]}</td>
                    <td className="hidden lg:table-cell">{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]}{p.reference && <p className="text-xs text-slate-500">{p.reference}</p>}</td>
                    <td className="text-right font-semibold">{p.cancelled ? <><s>{money(p.amount)}</s><br /><Badge tone="red">Annulé</Badge></> : money(p.amount)}</td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        {!p.cancelled && <a href={`/api/pdf/recu/${p.id}`} target="_blank" className="btn-icon" title="Imprimer le reçu"><Printer size={16} /></a>}
                        {!p.cancelled && (
                          <Modal title={`Annuler le reçu ${p.receiptNo}`} size="sm" trigger={<button className="btn-icon hover:text-rose-600" aria-label="Annuler"><Ban size={16} /></button>}>
                            <ActionForm action={cancelPayment.bind(null, p.id)} className="space-y-3">
                              <p className="text-sm text-slate-600">Le paiement de {money(p.amount)} sera annulé (il reste visible et tracé dans le journal d&apos;audit).</p>
                              <label className="block"><span className="label">Motif</span><input name="reason" className="input" required placeholder="Erreur de saisie, chèque rejeté…" /></label>
                              <SubmitButton className="btn btn-danger">Confirmer l&apos;annulation</SubmitButton>
                            </ActionForm>
                          </Modal>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <p className="border-t border-navy-50 px-4 py-2 text-right text-xs text-slate-500">{num(list.length)} ligne(s)</p>
      </Card>
    </div>
  );
}
