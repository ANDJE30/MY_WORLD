'use client';

import { useMemo, useState } from 'react';
import { MessageCircle, Smartphone, Send, Users, CheckCircle2 } from 'lucide-react';
import { ActionForm, SubmitButton } from '@/components/client/forms';
import { sendMessage } from '@/app/actions/messaging';
import { MESSAGE_CATEGORIES, MESSAGE_TEMPLATES } from '@/lib/constants';

type Result = { count: number; sent: number; simulated: number; failed: number; wa: { name: string; phone: string; link: string }[]; phones: string[]; sample: string };

export function MessageComposer({ classes, parents, smsReady, defaultParentId }: {
  classes: { id: number; name: string }[];
  parents: { id: number; fullName: string; phone: string; kids: string }[];
  smsReady: boolean;
  defaultParentId?: number;
}) {
  const [audience, setAudience] = useState(defaultParentId ? 'PARENTS' : 'ALL');
  const [tpl, setTpl] = useState(MESSAGE_TEMPLATES[0]);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [category, setCategory] = useState<string>(tpl.category);
  const [q, setQ] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const filtered = useMemo(() => {
    const n = q.toLowerCase().trim();
    return n ? parents.filter((p) => `${p.fullName} ${p.phone} ${p.kids}`.toLowerCase().includes(n)) : parents;
  }, [q, parents]);

  if (result) {
    const smsLink = `sms:${result.phones.map((p) => `+237${p.replace(/\D/g, '').slice(-9)}`).join(',')}?body=${encodeURIComponent(result.sample)}`;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Message déposé dans l’espace de {result.count} destinataire(s).</p>
            {(result.sent + result.failed + result.simulated) > 0 && <p>SMS : {result.sent} envoyé(s), {result.failed} échec(s){result.simulated ? `, ${result.simulated} simulé(s) (passerelle non configurée)` : ''}.</p>}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-navy-900">Envoi gratuit depuis votre téléphone</p>
          <div className="flex flex-wrap gap-2">
            <a href={smsLink} className="btn btn-ghost btn-sm"><Smartphone size={15} /> SMS groupé (message type)</a>
          </div>
          <p className="hint">Chaque lien WhatsApp ci-dessous ouvre la conversation avec le message personnalisé déjà rédigé.</p>
          <ul className="mt-2 max-h-72 divide-y divide-navy-50 overflow-y-auto rounded-xl border border-navy-100">
            {result.wa.map((w) => (
              <li key={w.phone + w.name} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{w.name}</span>
                <a href={w.link} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"><MessageCircle size={14} /> WhatsApp</a>
              </li>
            ))}
          </ul>
        </div>
        <button className="btn btn-primary" onClick={() => setResult(null)}>Nouveau message</button>
      </div>
    );
  }

  return (
    <ActionForm action={sendMessage} reset={false} closeOnSuccess={false} onSuccess={(r) => setResult(r?.data as Result)} className="space-y-4">
      <div>
        <span className="label">Modèle</span>
        <div className="flex flex-wrap gap-2">
          {MESSAGE_TEMPLATES.map((t) => (
            <button type="button" key={t.key} onClick={() => { setTpl(t); setSubject(t.subject); setBody(t.body); setCategory(t.category); }} className={`chip ${tpl.key === t.key ? 'chip-on' : ''}`}>{t.subject}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Objet</span><input name="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required /></label>
        <label><span className="label">Catégorie</span>
          <select name="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(MESSAGE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
      </div>
      <label className="block"><span className="label">Message</span><textarea name="body" className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1000} />
        <span className="hint flex justify-between"><span>Variables : {'{parent} {eleve} {classe} {solde} {centre} {telephone}'}</span><span>{body.length} car. · {Math.max(1, Math.ceil(body.length / 153))} SMS</span></span></label>
      <div>
        <span className="label">Destinataires</span>
        <div className="grid gap-2 sm:grid-cols-5">
          {[['ALL', 'Tous les parents'], ['CLASSES', 'Par classe'], ['PARENTS', 'Parents choisis'], ['ARREARS', 'Parents en retard de paiement'], ['TUTORS', 'Encadreurs']].map(([k, v]) => (
            <label key={k} className={`chip cursor-pointer justify-center text-center ${audience === k ? 'chip-on' : ''}`}><input type="radio" name="audience" value={k} checked={audience === k} onChange={() => setAudience(k)} className="sr-only" />{v}</label>
          ))}
        </div>
      </div>
      {audience === 'CLASSES' && (
        <div className="flex flex-wrap gap-2 rounded-xl bg-navy-50/50 p-3">
          {classes.map((c) => <label key={c.id} className="chip cursor-pointer has-[:checked]:border-royal-600 has-[:checked]:bg-royal-600 has-[:checked]:text-white"><input type="checkbox" name="classIds" value={c.id} className="sr-only" />{c.name}</label>)}
        </div>
      )}
      {audience === 'PARENTS' && (
        <div className="rounded-xl border border-navy-100 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input mb-2" placeholder="Rechercher un parent ou un enfant…" />
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-navy-50">
                <input type="checkbox" name="parentIds" value={p.id} className="check" defaultChecked={p.id === defaultParentId} />
                <span className="flex-1 truncate">{p.fullName} <span className="text-xs text-slate-500">· {p.kids || 'aucun enfant actif'}</span></span>
              </label>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 rounded-xl bg-gold-50 p-3 text-sm text-navy-900">
        <input type="checkbox" name="sms" className="check" defaultChecked={smsReady} />
        Envoyer aussi par SMS {smsReady ? '(passerelle active)' : '(mode simulation : configurez une passerelle, ou utilisez WhatsApp après l’envoi)'}
      </label>
      <SubmitButton className="btn btn-gold w-full" pendingText="Envoi en cours…"><Send size={16} /> Envoyer le message</SubmitButton>
      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Users size={13} /> Le message apparaît dans l’espace de chaque destinataire, avec ses informations personnalisées.</p>
    </ActionForm>
  );
}
