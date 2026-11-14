import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { Plus, Pencil, Trash2, Users, KeyRound, Search, Phone, MessageCircle } from 'lucide-react';
import { db } from '@/db';
import { parents, users, students } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { phoneFr, phoneIntl, dateTimeFr } from '@/lib/format';
import { Badge, Card, Empty, PageHeader, TableWrap } from '@/components/ui';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { CredentialsButton } from '@/components/client/credentials';
import { saveParent, deleteParent, generateParentAccount, generateAllParentAccounts } from '@/app/actions/people';

export const metadata = { title: 'Parents' };

type P = typeof parents.$inferSelect;

function ParentForm({ p }: { p?: P }) {
  return (
    <ActionForm action={saveParent} className="grid gap-4 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="sm:col-span-2"><span className="label">Nom complet</span><input name="fullName" className="input" defaultValue={p?.fullName} required /></label>
      <label><span className="label">Téléphone principal (identifiant)</span><input name="phone" inputMode="tel" className="input" defaultValue={phoneFr(p?.phone)} required /></label>
      <label><span className="label">Lien avec l&apos;élève</span><select name="relation" className="input" defaultValue={p?.relation ?? 'Parent'}><option>Mère</option><option>Père</option><option>Tuteur</option><option>Tutrice</option><option>Parent</option></select></label>
      <label><span className="label">Second téléphone</span><input name="phone2" inputMode="tel" className="input" defaultValue={phoneFr(p?.phone2)} /></label>
      <label><span className="label">Numéro WhatsApp (si différent)</span><input name="whatsapp" inputMode="tel" className="input" defaultValue={phoneFr(p?.whatsapp)} /></label>
      <label><span className="label">E-mail</span><input name="email" type="email" className="input" defaultValue={p?.email ?? ''} /></label>
      <label><span className="label">Profession</span><input name="profession" className="input" defaultValue={p?.profession ?? ''} /></label>
      <label className="sm:col-span-2"><span className="label">Adresse</span><input name="address" className="input" defaultValue={p?.address ?? ''} /></label>
      <div className="sm:col-span-2"><SubmitButton>{p ? 'Enregistrer' : 'Ajouter le parent'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function ParentsPage({ searchParams }: { searchParams: Promise<{ q?: string; sanscompte?: string }> }) {
  const sp = await searchParams;
  const year = await getCurrentYear();
  const [list, kids] = await Promise.all([
    db.select({ p: parents, lastLogin: users.lastLoginAt, active: users.isActive }).from(parents).leftJoin(users, eq(users.id, parents.userId)).orderBy(asc(parents.fullName)),
    db.select({ parentId: students.parentId, first: students.firstName, last: students.lastName }).from(students).where(eq(students.academicYearId, year.id)),
  ]);
  const byParent = new Map<number, string[]>();
  for (const k of kids) if (k.parentId) byParent.set(k.parentId, [...(byParent.get(k.parentId) ?? []), `${k.first} ${k.last}`]);
  const q = (sp.q ?? '').toLowerCase().trim();
  const rows = list.filter((r) => (!sp.sanscompte || !r.p.userId) && (!q || `${r.p.fullName} ${r.p.phone} ${(byParent.get(r.p.id) ?? []).join(' ')}`.toLowerCase().includes(q)));
  const without = list.filter((r) => !r.p.userId).length;
  return (
    <div className="space-y-6">
      <PageHeader kicker="Personnes" title="Parents" subtitle={`${list.length} parent(s) · ${without} sans compte d'accès. L'identifiant d'un parent est son numéro de téléphone.`}
        actions={<>
          {without > 0 && <CredentialsButton action={generateAllParentAccounts} className="btn btn-gold" confirm={`Créer les comptes d'accès des ${without} parent(s) qui n'en ont pas ?`}><KeyRound size={17} /> Générer tous les comptes</CredentialsButton>}
          <Modal title="Nouveau parent" size="lg" trigger={<button className="btn btn-primary"><Plus size={17} /> Ajouter un parent</button>}><ParentForm /></Modal>
        </>} />
      <Card pad={false}>
        <form method="get" className="flex flex-wrap gap-2 border-b border-navy-50 p-3 sm:p-4">
          <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={sp.q} className="input pl-9" placeholder="Nom, téléphone, enfant…" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sanscompte" value="1" defaultChecked={!!sp.sanscompte} className="check" /> Sans compte</label>
          <button className="btn btn-navy">Filtrer</button>
          {(sp.q || sp.sanscompte) && <Link href="/admin/parents" className="btn btn-ghost">Réinitialiser</Link>}
        </form>
        {rows.length === 0 ? <Empty icon={<Users />} title="Aucun parent" text="Les parents sont créés automatiquement lors de l’inscription ou de l’import des élèves." /> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Parent</th><th>Contact</th><th className="hidden lg:table-cell">Enfant(s)</th><th>Compte</th><th className="w-40" /></tr></thead>
              <tbody>
                {rows.map(({ p, lastLogin, active }) => (
                  <tr key={p.id}>
                    <td><p className="font-medium">{p.fullName}</p><p className="text-xs text-slate-500">{p.relation}{p.profession ? ` · ${p.profession}` : ''}</p></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{phoneFr(p.phone)}</span>
                        <a href={`tel:${phoneIntl(p.phone)}`} className="btn-icon h-7 w-7" title="Appeler"><Phone size={14} /></a>
                        <a href={`https://wa.me/${phoneIntl(p.whatsapp || p.phone).replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-icon h-7 w-7 text-emerald-600" title="WhatsApp"><MessageCircle size={14} /></a>
                      </div>
                    </td>
                    <td className="hidden max-w-xs lg:table-cell"><p className="truncate text-sm text-slate-600">{(byParent.get(p.id) ?? []).join(', ') || '—'}</p></td>
                    <td>{p.userId ? <div><Badge tone={active ? 'green' : 'slate'}>{active ? 'Actif' : 'Désactivé'}</Badge><p className="mt-0.5 text-[11px] text-slate-500">{lastLogin ? `Vu le ${dateTimeFr(lastLogin)}` : 'Jamais connecté'}</p></div> : <Badge tone="amber">Aucun</Badge>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <CredentialsButton action={generateParentAccount.bind(null, p.id)} className="btn btn-soft btn-sm" confirm={p.userId ? `Générer un nouveau mot de passe pour ${p.fullName} ? L'ancien ne fonctionnera plus.` : undefined}>
                          <KeyRound size={14} /> {p.userId ? 'Réinitialiser' : 'Créer l’accès'}
                        </CredentialsButton>
                        <Modal title={`Modifier ${p.fullName}`} size="lg" trigger={<button className="btn-icon" aria-label="Modifier"><Pencil size={16} /></button>}><ParentForm p={p} /></Modal>
                        <ActionButton action={deleteParent.bind(null, p.id)} confirm={`Supprimer ${p.fullName} et son compte ?`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
