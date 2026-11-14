import { KeyRound, ShieldCheck, LogOut } from 'lucide-react';
import { ActionForm, SubmitButton } from '@/components/client/forms';
import { changePasswordAction, logoutAction } from '@/app/actions/auth';
import { dateTimeFr, phoneFr } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/constants';
import type { SessionUser } from '@/lib/auth';

export function AccountPanel({ user, first, lastLogin }: { user: SessionUser; first?: boolean; lastLogin?: Date | null }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(first || user.mustChangePassword) && (
        <div className="rounded-2xl border border-gold-300 bg-gold-50 p-4 text-sm text-navy-900 lg:col-span-2">
          <p className="font-semibold">Bienvenue ! Pour votre sécurité, choisissez un mot de passe personnel.</p>
          <p className="mt-1 text-slate-600">Le mot de passe remis par le centre ne doit plus être utilisé après votre première connexion.</p>
        </div>
      )}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-navy-950"><ShieldCheck size={18} className="text-royal-600" /> Mon profil</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Nom</dt><dd className="font-medium">{user.fullName}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Profil</dt><dd>{ROLE_LABELS[user.role]}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Identifiant</dt><dd className="font-mono">{user.username}</dd></div>
          {user.phone && <div className="flex justify-between gap-4"><dt className="text-slate-500">Téléphone</dt><dd>{phoneFr(user.phone)}</dd></div>}
          {lastLogin && <div className="flex justify-between gap-4"><dt className="text-slate-500">Dernière connexion</dt><dd>{dateTimeFr(lastLogin)}</dd></div>}
        </dl>
        <form action={logoutAction} className="mt-6"><button className="btn btn-danger-soft w-full"><LogOut size={16} /> Se déconnecter</button></form>
      </section>
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold text-navy-950"><KeyRound size={18} className="text-royal-600" /> Changer mon mot de passe</h2>
        <ActionForm action={changePasswordAction} className="mt-4 space-y-3" closeOnSuccess={false}>
          <label className="block"><span className="label">Mot de passe actuel</span><input type="password" name="current" className="input" required autoComplete="current-password" /></label>
          <label className="block"><span className="label">Nouveau mot de passe</span><input type="password" name="next" className="input" required minLength={8} autoComplete="new-password" />
            <span className="hint block">8 caractères minimum, au moins une lettre et un chiffre. Astuce : une phrase courte facile à retenir.</span></label>
          <label className="block"><span className="label">Confirmation</span><input type="password" name="confirm" className="input" required autoComplete="new-password" /></label>
          <SubmitButton>Mettre à jour</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
