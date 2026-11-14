import { asc, gt, sql } from 'drizzle-orm';
import { KeyRound, Power, Trash2, UserPlus, ShieldCheck } from 'lucide-react';
import { db } from '@/db';
import { users, authSessions } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { dateTimeFr, phoneFr } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/constants';
import { Badge, Card, PageHeader, TableWrap } from '@/components/ui';
import { ActionButton, AutoSubmitSelect, Modal, SubmitButton } from '@/components/client/forms';
import { CredentialsButton, CredentialsForm } from '@/components/client/credentials';
import { resetUserPassword, toggleUser, deleteUserAccount, createAdmin } from '@/app/actions/people';

export const metadata = { title: 'Comptes utilisateurs' };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const me = await requireRole('ADMIN');
  const sp = await searchParams;
  const [list, sessions] = await Promise.all([
    db.select().from(users).orderBy(asc(users.role), asc(users.fullName)),
    db.select({ userId: authSessions.userId, n: sql<number>`count(*)::int`, last: sql<Date>`max(${authSessions.lastSeenAt})` }).from(authSessions).where(gt(authSessions.expiresAt, new Date())).groupBy(authSessions.userId),
  ]);
  const sess = new Map(sessions.map((s) => [s.userId, s]));
  const rows = list.filter((u) => !sp.role || u.role === sp.role);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Sécurité" title="Comptes utilisateurs" subtitle="Tous les accès à l'application. Les mots de passe sont stockés sous forme d'empreinte chiffrée (scrypt) : réinitialisez-les en cas d'oubli."
        actions={
          <Modal title="Nouvel administrateur" trigger={<button className="btn btn-primary"><UserPlus size={17} /> Ajouter un administrateur</button>}>
            <CredentialsForm action={createAdmin} className="grid gap-4">
              <label><span className="label">Nom complet</span><input name="fullName" className="input" required /></label>
              <label><span className="label">Identifiant</span><input name="username" className="input" required placeholder="secretariat" autoCapitalize="none" /></label>
              <label><span className="label">Téléphone</span><input name="phone" className="input" inputMode="tel" /></label>
              <SubmitButton>Créer le compte</SubmitButton>
            </CredentialsForm>
          </Modal>
        } />
      <Card pad={false}>
        <form method="get" className="flex flex-wrap gap-2 border-b border-navy-50 p-3 sm:p-4">
          <AutoSubmitSelect name="role" defaultValue={sp.role ?? ''} className="input w-auto">
            <option value="">Tous les profils ({list.length})</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}s ({list.filter((u) => u.role === k).length})</option>)}
          </AutoSubmitSelect>
        </form>
        <TableWrap>
          <table className="tbl">
            <thead><tr><th>Utilisateur</th><th>Profil</th><th>Identifiant</th><th className="hidden md:table-cell">Dernière connexion</th><th>État</th><th className="w-36" /></tr></thead>
            <tbody>
              {rows.map((u) => {
                const s = sess.get(u.id);
                const locked = u.lockedUntil && u.lockedUntil.getTime() > Date.now();
                return (
                  <tr key={u.id}>
                    <td><p className="font-medium">{u.fullName}{u.id === me.id && <span className="ml-1 text-xs text-gold-600">(vous)</span>}</p>{u.phone && <p className="text-xs text-slate-500">{phoneFr(u.phone)}</p>}</td>
                    <td><Badge tone={u.role === 'ADMIN' ? 'violet' : u.role === 'ENCADREUR' ? 'blue' : 'gold'}>{ROLE_LABELS[u.role]}</Badge></td>
                    <td className="font-mono text-sm">{u.username}</td>
                    <td className="hidden text-sm md:table-cell">{u.lastLoginAt ? dateTimeFr(u.lastLoginAt) : <span className="text-slate-400">Jamais</span>}{s && <p className="text-[11px] text-emerald-600">{s.n} session(s) ouverte(s)</p>}</td>
                    <td className="space-x-1">{u.isActive ? <Badge tone="green">Actif</Badge> : <Badge>Désactivé</Badge>}{locked && <Badge tone="red">Verrouillé</Badge>}{u.mustChangePassword && <Badge tone="amber">Mot de passe à changer</Badge>}</td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        {u.id !== me.id && <CredentialsButton action={resetUserPassword.bind(null, u.id)} className="btn-icon" title="Réinitialiser le mot de passe" confirm={`Générer un nouveau mot de passe pour ${u.fullName} ?`}><KeyRound size={16} /></CredentialsButton>}
                        {u.id !== me.id && <ActionButton action={toggleUser.bind(null, u.id)} className="btn-icon" title={u.isActive ? 'Désactiver' : 'Réactiver'}><Power size={16} /></ActionButton>}
                        {u.id !== me.id && <ActionButton action={deleteUserAccount.bind(null, u.id)} confirm={`Supprimer le compte ${u.username} ?`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} /> 5 échecs de connexion verrouillent un compte 15 minutes. Désactiver un compte ferme immédiatement toutes ses sessions.</p>
    </div>
  );
}
