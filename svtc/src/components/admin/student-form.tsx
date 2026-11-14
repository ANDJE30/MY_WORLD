import { ActionForm, SubmitButton } from '@/components/client/forms';
import { saveStudent } from '@/app/actions/people';
import { todayISO } from '@/lib/time';
import { phoneFr } from '@/lib/format';

type Opt = { id: number; name: string };
type ParentOpt = { id: number; fullName: string; phone: string };
export type StudentValues = {
  id: number; firstName: string; lastName: string; gender: string; birthDate: string | null; school: string | null; phone: string | null;
  classId: number; parentId: number | null; discountPct: number; status: string; enrolledAt: string; notes: string | null;
};

export function StudentForm({ s, classes, parents, defaultClassId }: { s?: StudentValues; classes: Opt[]; parents: ParentOpt[]; defaultClassId?: number }) {
  return (
    <ActionForm action={saveStudent} className="grid gap-4 sm:grid-cols-2">
      {s && <input type="hidden" name="id" value={s.id} />}
      <label><span className="label">Nom</span><input name="lastName" className="input uppercase" defaultValue={s?.lastName} required /></label>
      <label><span className="label">Prénom(s)</span><input name="firstName" className="input" defaultValue={s?.firstName} required /></label>
      <label><span className="label">Sexe</span><select name="gender" className="input" defaultValue={s?.gender ?? 'M'}><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
      <label><span className="label">Date de naissance</span><input name="birthDate" type="date" className="input" defaultValue={s?.birthDate ?? ''} /></label>
      <label><span className="label">Classe</span>
        <select name="classId" className="input" defaultValue={s?.classId ?? defaultClassId ?? ''} required>
          <option value="" disabled>Choisir…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label><span className="label">Établissement fréquenté</span><input name="school" className="input" defaultValue={s?.school ?? ''} placeholder="Ex. : Lycée Technique de Nkolbisson" /></label>
      <label><span className="label">Téléphone de l&apos;élève (facultatif)</span><input name="phone" inputMode="tel" className="input" defaultValue={phoneFr(s?.phone)} /></label>
      <label><span className="label">Date d&apos;inscription</span><input name="enrolledAt" type="date" className="input" defaultValue={s?.enrolledAt ?? todayISO()} required /></label>
      <label><span className="label">Réduction sur la mensualité (%)</span><input name="discountPct" type="number" min={0} max={100} className="input" defaultValue={s?.discountPct ?? 0} /></label>
      <label><span className="label">Statut</span><select name="status" className="input" defaultValue={s?.status ?? 'ACTIF'}><option value="ACTIF">Actif</option><option value="SUSPENDU">Suspendu</option><option value="ABANDON">A quitté le centre</option></select></label>

      <fieldset className="rounded-xl border border-navy-100 p-4 sm:col-span-2">
        <legend className="px-1 text-sm font-semibold text-navy-800">Parent / tuteur</legend>
        <label className="block"><span className="label">Parent déjà enregistré</span>
          <select name="parentId" className="input" defaultValue={s?.parentId ?? ''}>
            <option value="">— Nouveau parent (remplir ci-dessous) —</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.fullName} · {phoneFr(p.phone)}</option>)}
          </select>
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label><span className="label">Nom du parent</span><input name="parentName" className="input" placeholder="Mme ATANGANA Marie" /></label>
          <label><span className="label">Téléphone</span><input name="parentPhone" inputMode="tel" className="input" placeholder="6XX XX XX XX" /></label>
          <label><span className="label">Lien</span><select name="relation" className="input"><option>Mère</option><option>Père</option><option>Tuteur</option><option>Tutrice</option><option>Parent</option></select></label>
        </div>
        <p className="hint">Si le numéro existe déjà, l&apos;élève est rattaché au parent existant (fratrie).</p>
      </fieldset>
      <label className="sm:col-span-2"><span className="label">Observations</span><textarea name="notes" className="input" defaultValue={s?.notes ?? ''} /></label>
      <div className="sm:col-span-2"><SubmitButton>{s ? 'Enregistrer' : "Inscrire l'élève"}</SubmitButton></div>
    </ActionForm>
  );
}
