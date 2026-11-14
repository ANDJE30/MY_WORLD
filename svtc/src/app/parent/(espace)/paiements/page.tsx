import { desc, eq } from 'drizzle-orm';
import { Printer, Smartphone } from 'lucide-react';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { selectedKid } from '@/lib/parent';
import { balances } from '@/lib/queries';
import { dateTimeFr, money, periodLabel, phoneFr } from '@/lib/format';
import { PAYMENT_METHODS, PAYMENT_TYPES } from '@/lib/constants';
import { Badge, Card, Empty, PageHeader, Stat } from '@/components/ui';

export const metadata = { title: 'Paiements' };

export default async function ParentPayments({ searchParams }: { searchParams: Promise<{ enfant?: string }> }) {
  const me = await requireRole('PARENT');
  const { kid } = await selectedKid(me.parentId!, (await searchParams).enfant);
  if (!kid) return <Empty title="Aucun enfant" />;
  const [year, s] = await Promise.all([getCurrentYear(), getSettings()]);
  const [[b], list] = await Promise.all([balances(year.id, [kid.id]), db.select().from(payments).where(eq(payments.studentId, kid.id)).orderBy(desc(payments.paidAt))]);
  return (
    <div className="space-y-5">
      <PageHeader title={`Paiements — ${kid.firstName}`} subtitle={`Mensualité : ${money(b?.monthlyNet ?? 0)} · inscription : ${money(b?.registrationFee ?? 0)}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total payé" value={money(b?.paid ?? 0)} tone="green" />
        <Stat label="Reste à payer à ce jour" value={b && b.balance > 0 ? money(b.balance) : 'À jour'} tone={b && b.balance > 0 ? 'red' : 'green'} />
        <Stat label="Total de l'année" value={money(b?.dueTotal ?? 0)} hint={`Reste sur l'année : ${money(Math.max(0, b?.remainingYear ?? 0))}`} tone="gold" />
      </div>
      {b && (
        <Card title="Mois réglés">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-xl px-3 py-2 text-xs font-medium ${b.alloc.registration.paid >= b.alloc.registration.due ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>Inscription</span>
            {b.alloc.months.map((m) => <span key={m.period} className={`rounded-xl px-3 py-2 text-xs font-medium first-up ${m.state === 'PAYE' ? 'bg-emerald-50 text-emerald-700' : m.state === 'PARTIEL' ? 'bg-amber-50 text-amber-800' : b.dueMonths.includes(m.period) ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{periodLabel(m.period)}</span>)}
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-gold-50 p-3 text-sm text-navy-900"><Smartphone size={17} className="mt-0.5 shrink-0 text-gold-600" /> Paiement en espèces au centre ou par Mobile Money : contactez le {s.identity.phones.map((p) => phoneFr(p)).join(' / ')} pour obtenir les coordonnées, puis communiquez l&apos;identifiant de la transaction. Votre reçu apparaîtra ici.</p>
        </Card>
      )}
      <Card title="Historique et reçus" pad={false}>
        {list.length === 0 ? <Empty title="Aucun paiement enregistré" /> : (
          <ul className="divide-y divide-gold-100">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1"><p className="font-medium text-navy-950">{money(p.amount)} <span className="text-sm font-normal text-slate-500">· {PAYMENT_TYPES[p.type as keyof typeof PAYMENT_TYPES]}</span></p><p className="text-xs text-slate-500">{dateTimeFr(p.paidAt)} · {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]} · {p.receiptNo}</p></div>
                {p.cancelled ? <Badge tone="red">Annulé</Badge> : <a href={`/api/pdf/recu/${p.id}`} target="_blank" className="btn btn-ghost btn-sm"><Printer size={15} /> Reçu</a>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
