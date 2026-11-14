'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { ActionForm, SubmitButton } from '@/components/client/forms';
import { recordPayment } from '@/app/actions/finance';

type Opt = { id: number; label: string; balance: number; monthlyNet: number };

const fmt = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());

export function PaymentForm({ students, defaultStudentId }: { students: Opt[]; defaultStudentId?: number }) {
  const [q, setQ] = useState('');
  const [sid, setSid] = useState<number | ''>(defaultStudentId ?? '');
  const [method, setMethod] = useState('ESPECES');
  const [receipt, setReceipt] = useState<{ id: number; receiptNo: string } | null>(null);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? students.filter((s) => s.label.toLowerCase().includes(n)) : students;
  }, [q, students]);
  const cur = students.find((s) => s.id === sid);

  if (receipt) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
        <p className="mt-3 text-lg font-semibold text-navy-950">Paiement enregistré</p>
        <p className="text-sm text-slate-500">Reçu n° {receipt.receiptNo}</p>
        <div className="mt-5 flex justify-center gap-2">
          <a href={`/api/pdf/recu/${receipt.id}`} target="_blank" className="btn btn-gold"><Printer size={16} /> Imprimer le reçu</a>
          <button className="btn btn-ghost" onClick={() => setReceipt(null)}>Nouveau paiement</button>
        </div>
      </div>
    );
  }

  return (
    <ActionForm action={recordPayment} closeOnSuccess={false} onSuccess={(r) => setReceipt(r?.data as { id: number; receiptNo: string })} className="grid gap-4 sm:grid-cols-2">
      {!defaultStudentId && (
        <label className="sm:col-span-2"><span className="label">Rechercher l&apos;élève</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Tapez un nom ou une classe…" />
        </label>
      )}
      <label className="sm:col-span-2"><span className="label">Élève</span>
        <select name="studentId" className="input" value={sid} onChange={(e) => setSid(e.target.value ? Number(e.target.value) : '')} required>
          <option value="">— Choisir —</option>
          {filtered.slice(0, 300).map((s) => <option key={s.id} value={s.id}>{s.label}{s.balance > 0 ? ` · doit ${fmt(s.balance)}` : ''}</option>)}
        </select>
      </label>
      {cur && (
        <div className="rounded-xl bg-navy-50/60 p-3 text-sm sm:col-span-2">
          Solde à ce jour : <strong className={cur.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}>{cur.balance > 0 ? fmt(cur.balance) : 'à jour'}</strong> · Mensualité : <strong>{fmt(cur.monthlyNet)}</strong>
        </div>
      )}
      <label><span className="label">Montant (FCFA)</span><input name="amount" type="number" min={1} className="input text-lg font-semibold" required defaultValue={cur && cur.balance > 0 ? cur.balance : undefined} key={sid} /></label>
      <label><span className="label">Nature</span>
        <select name="type" className="input" defaultValue="MENSUALITE"><option value="MENSUALITE">Mensualité</option><option value="INSCRIPTION">Frais d&apos;inscription</option><option value="AUTRE">Autre frais</option></select>
      </label>
      <label><span className="label">Mode de paiement</span>
        <select name="method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="ESPECES">Espèces</option><option value="MTN_MOMO">MTN Mobile Money</option><option value="ORANGE_MONEY">Orange Money</option><option value="VIREMENT">Virement bancaire</option><option value="AUTRE">Autre</option>
        </select>
      </label>
      <label><span className="label">Date</span><input name="paidOn" type="date" className="input" defaultValue={today()} max={today()} /></label>
      <label className="sm:col-span-2"><span className="label">Référence {method === 'MTN_MOMO' || method === 'ORANGE_MONEY' ? '(ID de transaction obligatoire)' : '(facultatif)'}</span>
        <input name="reference" className="input" required={method === 'MTN_MOMO' || method === 'ORANGE_MONEY'} placeholder="Ex. : MP231114.1532.A12345" /></label>
      <label className="sm:col-span-2"><span className="label">Observation</span><input name="notes" className="input" placeholder="Ex. : mensualités d'octobre et novembre" /></label>
      <div className="sm:col-span-2"><SubmitButton className="btn btn-gold w-full">Enregistrer le paiement</SubmitButton></div>
    </ActionForm>
  );
}
