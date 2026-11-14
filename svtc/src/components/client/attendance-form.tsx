'use client';

import { useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { ActionForm, SubmitButton, type Result } from './forms';

type Row = { id: number; name: string; status: string | null; comment: string | null };
const OPTS = [
  { v: 'PRESENT', l: 'P', title: 'Présent', on: 'bg-emerald-600 text-white border-emerald-600' },
  { v: 'RETARD', l: 'R', title: 'En retard', on: 'bg-amber-500 text-white border-amber-500' },
  { v: 'ABSENT', l: 'A', title: 'Absent', on: 'bg-rose-600 text-white border-rose-600' },
  { v: 'EXCUSE', l: 'J', title: 'Absence justifiée', on: 'bg-slate-600 text-white border-slate-600' },
];

export function AttendanceForm({ action, rows, disabled }: { action: (fd: FormData) => Promise<Result>; rows: Row[]; disabled?: boolean }) {
  const [state, setState] = useState<Record<number, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.status ?? 'PRESENT'])));
  const counts = useMemo(() => {
    const c: Record<string, number> = { PRESENT: 0, RETARD: 0, ABSENT: 0, EXCUSE: 0 };
    for (const v of Object.values(state)) c[v]++;
    return c;
  }, [state]);
  return (
    <ActionForm action={action} reset={false} closeOnSuccess={false}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="badge badge-green">{counts.PRESENT} présent(s)</span>
        <span className="badge badge-amber">{counts.RETARD} retard(s)</span>
        <span className="badge badge-red">{counts.ABSENT} absent(s)</span>
        <span className="badge badge-slate">{counts.EXCUSE} justifié(s)</span>
        {!disabled && <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setState(Object.fromEntries(rows.map((r) => [r.id, 'PRESENT'])))}><CheckCheck size={15} /> Tous présents</button>}
      </div>
      <ul className="divide-y divide-navy-50 rounded-2xl border border-navy-100 bg-white">
        {rows.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
            <span className="w-6 text-xs text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-navy-950">{r.name}</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label={`Présence de ${r.name}`}>
              {OPTS.map((o) => (
                <label key={o.v} title={o.title} className={`flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-xl border text-sm font-bold transition ${state[r.id] === o.v ? o.on : 'border-navy-100 bg-white text-slate-500 hover:border-royal-300'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
                  <input type="radio" name={`st_${r.id}`} value={o.v} checked={state[r.id] === o.v} onChange={() => setState((s) => ({ ...s, [r.id]: o.v }))} className="sr-only" disabled={disabled} />
                  {o.l}
                </label>
              ))}
            </div>
            {(state[r.id] === 'EXCUSE' || state[r.id] === 'RETARD' || r.comment) && (
              <input name={`c_${r.id}`} defaultValue={r.comment ?? ''} placeholder="Motif / commentaire" className="input mt-1 w-full py-1.5 text-sm" disabled={disabled} />
            )}
          </li>
        ))}
      </ul>
      {!disabled && <div className="sticky bottom-20 z-10 mt-4 lg:bottom-4"><SubmitButton className="btn btn-primary w-full py-3 shadow-lg">Enregistrer l&apos;appel</SubmitButton></div>}
    </ActionForm>
  );
}
