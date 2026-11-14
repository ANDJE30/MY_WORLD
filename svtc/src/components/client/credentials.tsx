'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useModal } from './forms';
import { toast } from 'sonner';
import { KeyRound, Loader2, Printer, MessageCircle, Copy, X, ShieldAlert, Smartphone } from 'lucide-react';

export type Cred = { name: string; role: 'ENCADREUR' | 'PARENT' | 'ADMIN'; username: string; password: string; phone: string | null };
type R = { ok: boolean; message?: string; data?: unknown } | null;

const PORTAL: Record<Cred['role'], string> = { ADMIN: '/admin/connexion', ENCADREUR: '/encadreur/connexion', PARENT: '/parent/connexion' };

export function messageFor(c: Cred, origin: string) {
  const who = c.role === 'PARENT' ? 'Espace parents' : c.role === 'ENCADREUR' ? 'Espace encadreur' : 'Administration';
  return `Bonjour ${c.name}, voici vos accès à SVTC Répétitions (${who}).\nLien : ${origin}${PORTAL[c.role]}\nIdentifiant : ${c.username}\nMot de passe : ${c.password}\nGardez-les confidentiels. — Silicon Valley Training Center`;
}

function intl(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.length === 9 ? `237${d}` : d;
}

export async function printCredentials(creds: Cred[]) {
  const r = await fetch('/api/pdf/acces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creds, origin: window.location.origin }) });
  if (!r.ok) {
    toast.error('Impossible de générer le PDF.');
    return;
  }
  const url = URL.createObjectURL(await r.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function CredentialsList({ creds, onClose }: { creds: Cred[]; onClose: () => void }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [printing, setPrinting] = useState(false);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/60 p-3 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-up">
        <div className="flex items-start justify-between gap-3 bg-navy-950 px-5 py-4 text-white">
          <div>
            <p className="flex items-center gap-2 font-semibold"><KeyRound size={18} className="text-gold-400" /> Identifiants générés ({creds.length})</p>
            <p className="mt-0.5 text-xs text-navy-200">Les mots de passe ne sont affichés qu’une seule fois : imprimez ou transmettez-les maintenant.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-navy-50 px-5 py-3">
          <button className="btn btn-gold btn-sm" disabled={printing} onClick={async () => { setPrinting(true); await printCredentials(creds); setPrinting(false); }}>
            {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Fiches d’accès (PDF)
          </button>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            await navigator.clipboard.writeText(creds.map((c) => `${c.name} — ${c.username} / ${c.password}`).join('\n'));
            toast.success('Liste copiée');
          }}><Copy size={15} /> Copier la liste</button>
        </div>
        <ul className="max-h-[60dvh] divide-y divide-navy-50 overflow-y-auto">
          {creds.map((c) => {
            const msg = messageFor(c, origin);
            return (
              <li key={c.username} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-950">{c.name}</p>
                  <p className="mt-0.5 font-mono text-sm text-navy-700">{c.username} · <span className="rounded bg-gold-50 px-1.5 py-0.5 font-semibold text-gold-700">{c.password}</span></p>
                </div>
                {c.phone && (
                  <>
                    <a className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${intl(c.phone)}?text=${encodeURIComponent(msg)}`}><MessageCircle size={15} /> WhatsApp</a>
                    <a className="btn btn-ghost btn-sm" href={`sms:+${intl(c.phone)}?body=${encodeURIComponent(msg)}`}><Smartphone size={15} /> SMS</a>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-2 bg-amber-50 px-5 py-2.5 text-xs text-amber-800"><ShieldAlert size={14} /> Par sécurité, l’application ne conserve que l’empreinte chiffrée des mots de passe.</p>
      </div>
    </div>
  );
}

/** Bouton qui génère des identifiants via une action serveur puis les affiche. */
export function CredentialsButton({ action, children, className = 'btn btn-soft btn-sm', confirm: confirmText, title }: { action: () => Promise<R>; children: ReactNode; className?: string; confirm?: string; title?: string }) {
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className={className} disabled={pending} title={title} aria-label={title}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => {
            const r = await action();
            if (r?.ok) {
              if (r.message) toast.success(r.message);
              if (Array.isArray(r.data) && r.data.length) showCredentials(r.data as Cred[]);
            } else toast.error(r?.message ?? 'Échec.');
          });
        }}>
        {pending ? <Loader2 size={15} className="animate-spin" /> : null}
        {children}
      </button>
    </>
  );
}

/** Formulaire (création d'encadreur ou d'administrateur) qui peut renvoyer des identifiants à afficher. */
export function CredentialsForm({ action, children, className }: { action: (fd: FormData) => Promise<R>; children: ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  const modal = useModal();
  return (
    <>
      <form className={className} onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await action(fd);
          if (r?.ok) {
            toast.success(r.message ?? 'Enregistré');
            if (Array.isArray(r.data) && r.data.length) showCredentials(r.data as Cred[]);
            form.reset();
            modal?.close();
          } else toast.error(r?.message ?? 'Échec.');
        });
      }}>
        <fieldset disabled={pending} className="contents">{children}</fieldset>
      </form>
    </>
  );
}

const EVT = 'svtc:credentials';

export function showCredentials(creds: Cred[]) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: creds }));
}

/** Affiche les identifiants générés au-dessus de toute fenêtre (monté une fois dans l'espace administrateur). */
export function CredentialsHost() {
  const [creds, setCreds] = useState<Cred[] | null>(null);
  useEffect(() => {
    const on = (e: Event) => setCreds((e as CustomEvent<Cred[]>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return creds ? <CredentialsList creds={creds} onClose={() => setCreds(null)} /> : null;
}
