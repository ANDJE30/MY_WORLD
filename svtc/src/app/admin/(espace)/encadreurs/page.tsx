import { and, eq } from 'drizzle-orm';
import { Plus, Pencil, Trash2, UserCog, KeyRound, Phone, MessageCircle } from 'lucide-react';
import { db } from '@/db';
import { tutors, users, assignments, classes, subjects } from '@/db/schema';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { refData } from '@/lib/queries';
import { money, phoneFr, phoneIntl, dateTimeFr } from '@/lib/format';
import { Avatar, Badge, Empty, PageHeader } from '@/components/ui';
import { ActionButton, Modal, SubmitButton } from '@/components/client/forms';
import { CredentialsButton, CredentialsForm } from '@/components/client/credentials';
import { saveTutor, deleteTutor, generateTutorAccount, generateAllTutorAccounts } from '@/app/actions/people';

export const metadata = { title: 'Encadreurs' };

type T = typeof tutors.$inferSelect;

function TutorForm({ t, mode }: { t?: T; mode: string }) {
  return (
    <CredentialsForm action={saveTutor} className="grid gap-4 sm:grid-cols-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <label><span className="label">Nom</span><input name="lastName" className="input uppercase" defaultValue={t?.lastName} required /></label>
      <label><span className="label">Prénom(s)</span><input name="firstName" className="input" defaultValue={t?.firstName} required /></label>
      <label><span className="label">Sexe</span><select name="gender" className="input" defaultValue={t?.gender ?? 'M'}><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
      <label><span className="label">Téléphone</span><input name="phone" inputMode="tel" className="input" defaultValue={phoneFr(t?.phone)} required /></label>
      <label><span className="label">E-mail</span><input name="email" type="email" className="input" defaultValue={t?.email ?? ''} /></label>
      <label><span className="label">Spécialité</span><input name="specialty" className="input" defaultValue={t?.specialty ?? ''} placeholder="Ex. : Génie logiciel" /></label>
      <label><span className="label">Diplôme</span><input name="diploma" className="input" defaultValue={t?.diploma ?? ''} placeholder="Ex. : Master en informatique" /></label>
      <label><span className="label">Prise de service</span><input name="hireDate" type="date" className="input" defaultValue={t?.hireDate ?? ''} /></label>
      <label><span className="label">Salaire mensuel de référence (FCFA)</span><input name="baseSalary" type="number" min={0} className="input" defaultValue={t?.baseSalary ?? 0} />
        <span className="hint block">{mode === 'PRORATA' ? 'Payé au prorata des heures effectuées (mode actif).' : 'Utilisé en mode prorata.'}</span></label>
      <label><span className="label">Taux horaire (FCFA)</span><input name="hourlyRate" type="number" min={0} className="input" defaultValue={t?.hourlyRate ?? 0} />
        <span className="hint block">{mode === 'HORAIRE' ? 'Mode actif : taux × heures effectuées.' : 'Utilisé en mode horaire.'}</span></label>
      <label className="sm:col-span-2"><span className="label">Adresse</span><input name="address" className="input" defaultValue={t?.address ?? ''} /></label>
      <label><span className="label">Couleur</span><input name="color" type="color" className="input h-[46px] p-1" defaultValue={t?.color ?? '#2453d6'} /></label>
      <div className="space-y-2 self-end pb-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" className="check" defaultChecked={t?.isActive ?? true} /> Encadreur actif</label>
        {!t && <label className="flex items-center gap-2"><input type="checkbox" name="createAccount" className="check" defaultChecked /> Créer son compte d&apos;accès maintenant</label>}
      </div>
      <div className="sm:col-span-2"><SubmitButton>{t ? 'Enregistrer' : "Ajouter l'encadreur"}</SubmitButton></div>
    </CredentialsForm>
  );
}

export default async function TutorsPage() {
  const [ref, year, s] = await Promise.all([refData(), getCurrentYear(), getSettings()]);
  const [accounts, asg] = await Promise.all([
    db.select({ id: users.id, username: users.username, isActive: users.isActive, lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.role, 'ENCADREUR')),
    db.select({ tutorId: assignments.tutorId, className: classes.code, subjectName: subjects.code }).from(assignments).innerJoin(classes, eq(classes.id, assignments.classId)).innerJoin(subjects, eq(subjects.id, assignments.subjectId)).where(and(eq(assignments.academicYearId, year.id))),
  ]);
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const without = ref.tutors.filter((t) => t.isActive && !t.userId).length;
  return (
    <div className="space-y-6">
      <PageHeader kicker="Personnes" title="Encadreurs" subtitle="Équipe pédagogique, comptes d'accès (identifiant prénom.nom, mot de passe facile à retenir) et rémunération."
        actions={<>
          {without > 0 && <CredentialsButton action={generateAllTutorAccounts} className="btn btn-gold"><KeyRound size={17} /> Générer les comptes manquants ({without})</CredentialsButton>}
          <Modal title="Nouvel encadreur" size="lg" trigger={<button className="btn btn-primary"><Plus size={17} /> Ajouter un encadreur</button>}><TutorForm mode={s.salary.mode} /></Modal>
        </>} />
      {ref.tutors.length === 0 ? <div className="card"><Empty icon={<UserCog />} title="Aucun encadreur" text="Ajoutez les encadreurs puis attribuez-leur des classes et des matières." /></div> : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {ref.tutors.map((t) => {
            const a = t.userId ? acc.get(t.userId) : undefined;
            const mine = asg.filter((x) => x.tutorId === t.id);
            return (
              <div key={t.id} className={`card p-5 animate-fade-up ${t.isActive ? '' : 'opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={`${t.firstName} ${t.lastName}`} color={t.color} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy-950">{t.firstName} {t.lastName}</p>
                    <p className="truncate text-sm text-slate-500">{t.specialty || 'Encadreur'}{t.diploma ? ` · ${t.diploma}` : ''}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-sm">
                      {phoneFr(t.phone)}
                      <a href={`tel:${phoneIntl(t.phone)}`} className="btn-icon h-7 w-7" title="Appeler"><Phone size={14} /></a>
                      <a href={`https://wa.me/${phoneIntl(t.phone).replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-icon h-7 w-7 text-emerald-600" title="WhatsApp"><MessageCircle size={14} /></a>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <Modal title={`Modifier ${t.firstName} ${t.lastName}`} size="lg" trigger={<button className="btn-icon" aria-label="Modifier"><Pencil size={16} /></button>}><TutorForm t={t} mode={s.salary.mode} /></Modal>
                    <ActionButton action={deleteTutor.bind(null, t.id)} confirm={`Supprimer ${t.firstName} ${t.lastName} et son compte ? (Désactivation seulement s'il a déjà assuré des séances.)`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {mine.length === 0 ? <Badge tone="amber">Aucune attribution</Badge> : mine.map((m, i) => <Badge key={i} tone="blue">{m.className} · {m.subjectName}</Badge>)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-navy-50/50 p-3 text-sm">
                  <div><p className="text-xs text-slate-500">Salaire de référence</p><p className="font-semibold">{money(t.baseSalary)}</p></div>
                  <div><p className="text-xs text-slate-500">Taux horaire</p><p className="font-semibold">{money(t.hourlyRate)}</p></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-navy-50 pt-3">
                  {a ? (
                    <div className="min-w-0 text-sm"><p className="truncate font-mono text-navy-800">@{a.username}</p><p className="text-[11px] text-slate-500">{a.lastLoginAt ? `Dernière connexion : ${dateTimeFr(a.lastLoginAt)}` : 'Jamais connecté'}</p></div>
                  ) : <Badge tone="amber">Pas de compte</Badge>}
                  <CredentialsButton action={generateTutorAccount.bind(null, t.id)} className="btn btn-soft btn-sm" confirm={a ? `Générer un nouveau mot de passe pour ${t.firstName} ? L'ancien ne fonctionnera plus.` : undefined}>
                    <KeyRound size={14} /> {a ? 'Nouveau mot de passe' : 'Créer le compte'}
                  </CredentialsButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
