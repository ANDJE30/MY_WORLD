'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn, User, Lock } from 'lucide-react';
import { loginAction } from '@/app/actions/auth';

type Variant = 'admin' | 'encadreur' | 'parent';

const STYLES: Record<Variant, { button: string; ring: string; input: string; label: string }> = {
  admin: {
    button: 'bg-gold-400 text-navy-950 hover:bg-gold-300',
    ring: 'focus-within:ring-gold-400/40 focus-within:border-gold-400',
    input: 'bg-navy-900/60 border-white/15 text-white placeholder:text-navy-300',
    label: 'text-navy-100',
  },
  encadreur: {
    button: 'bg-royal-600 text-white hover:bg-royal-700',
    ring: 'focus-within:ring-royal-200 focus-within:border-royal-500',
    input: 'bg-white border-navy-100 text-navy-950 placeholder:text-slate-400',
    label: 'text-navy-800',
  },
  parent: {
    button: 'bg-navy-900 text-white hover:bg-navy-800',
    ring: 'focus-within:ring-gold-200 focus-within:border-gold-500',
    input: 'bg-white border-gold-200 text-navy-950 placeholder:text-slate-400',
    label: 'text-navy-800',
  },
};

export function LoginForm({ portal, variant, userLabel, userPlaceholder, userHint }: {
  portal: 'ADMIN' | 'ENCADREUR' | 'PARENT'; variant: Variant; userLabel: string; userPlaceholder: string; userHint?: string;
}) {
  const [show, setShow] = useState(false);
  const [user, setUser] = useState('');
  const [state, action, pending] = useActionState(async (_p: { message?: string } | null, fd: FormData) => {
    const r = await loginAction(fd);
    return r.ok ? null : { message: r.message };
  }, null);
  const s = STYLES[variant];
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="portal" value={portal} />
      <div>
        <label htmlFor="username" className={`mb-1.5 block text-sm font-medium ${s.label}`}>{userLabel}</label>
        <div className={`flex items-center gap-2 rounded-xl border px-3.5 ring-4 ring-transparent transition ${s.input} ${s.ring}`}>
          <User size={18} className="shrink-0 opacity-60" />
          <input id="username" name="username" value={user} onChange={(e) => setUser(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder={userPlaceholder} className="w-full bg-transparent py-3 text-base outline-none sm:text-[15px]" />
        </div>
        {userHint && <p className={`mt-1 text-xs opacity-70 ${s.label}`}>{userHint}</p>}
      </div>
      <div>
        <label htmlFor="password" className={`mb-1.5 block text-sm font-medium ${s.label}`}>Mot de passe</label>
        <div className={`flex items-center gap-2 rounded-xl border px-3.5 ring-4 ring-transparent transition ${s.input} ${s.ring}`}>
          <Lock size={18} className="shrink-0 opacity-60" />
          <input id="password" name="password" type={show ? 'text' : 'password'} required autoComplete="current-password"
            placeholder="••••••••" className="w-full bg-transparent py-3 text-base outline-none sm:text-[15px]" />
          <button type="button" onClick={() => setShow((v) => !v)} className="opacity-60 hover:opacity-100" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {state?.message && (
        <p role="alert" id="login-error" className="rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{state.message}</p>
      )}
      <button type="submit" disabled={pending} className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold shadow-lg transition active:translate-y-px disabled:opacity-60 ${s.button}`}>
        {pending ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
