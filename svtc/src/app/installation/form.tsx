'use client';

import { ActionForm, SubmitButton } from '@/components/client/forms';
import { installAction } from '@/app/actions/auth';

export function InstallForm() {
  return (
    <ActionForm action={installAction} reset={false} className="space-y-4">
      <label className="block"><span className="label">Nom complet</span><input name="fullName" className="input" required placeholder="Ex. : M. NGONO Paul" /></label>
      <label className="block"><span className="label">Identifiant de connexion</span><input name="username" className="input" required defaultValue="admin" autoCapitalize="none" /></label>
      <label className="block"><span className="label">Mot de passe</span><input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
        <span className="hint block">8 caractères minimum, avec au moins une lettre et un chiffre.</span></label>
      <label className="block"><span className="label">Confirmation</span><input name="confirm" type="password" className="input" required autoComplete="new-password" /></label>
      <SubmitButton className="btn btn-gold w-full">Créer le compte et commencer</SubmitButton>
    </ActionForm>
  );
}
