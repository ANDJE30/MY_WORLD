import { and, count, eq } from 'drizzle-orm';
import { Plus, Pencil, Trash2, School } from 'lucide-react';
import { db } from '@/db';
import { students, classes } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { refData } from '@/lib/queries';
import { money, num } from '@/lib/format';
import { Badge, Card, Dot, Empty, PageHeader, TableWrap } from '@/components/ui';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { saveClass, deleteClass } from '@/app/actions/structure';

export const metadata = { title: 'Classes' };

type C = typeof classes.$inferSelect;

function ClassForm({ c }: { c?: C }) {
  return (
    <ActionForm action={saveClass} className="grid gap-4 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <label><span className="label">Code</span><input name="code" className="input uppercase" defaultValue={c?.code} placeholder="PTI" required maxLength={10} /></label>
      <label><span className="label">Nom</span><input name="name" className="input" defaultValue={c?.name} placeholder="Première TI" required /></label>
      <label><span className="label">Cycle</span>
        <select name="cycle" className="input" defaultValue={c?.cycle ?? 'SECOND'}><option value="PREMIER">Premier cycle (6e – 3e)</option><option value="SECOND">Second cycle (2nde – Tle)</option></select>
      </label>
      <label><span className="label">Effectif maximum</span><input name="capacity" type="number" min={1} className="input" defaultValue={c?.capacity ?? 30} /></label>
      <label><span className="label">Frais d&apos;inscription (FCFA)</span><input name="registrationFee" type="number" min={0} className="input" defaultValue={c?.registrationFee ?? 5000} /></label>
      <label><span className="label">Mensualité (FCFA)</span><input name="monthlyFee" type="number" min={0} className="input" defaultValue={c?.monthlyFee ?? 7500} /></label>
      <label><span className="label">Ordre d&apos;affichage</span><input name="sortOrder" type="number" min={0} className="input" defaultValue={c?.sortOrder ?? 10} /></label>
      <label><span className="label">Couleur</span><input name="color" type="color" className="input h-[46px] p-1" defaultValue={c?.color ?? '#2453d6'} /></label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isActive" className="check" defaultChecked={c?.isActive ?? true} /> Classe active</label>
      <div className="sm:col-span-2"><SubmitButton>{c ? 'Enregistrer' : 'Ajouter la classe'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function ClassesPage() {
  const [ref, year] = await Promise.all([refData(), getCurrentYear()]);
  const counts = await db.select({ classId: students.classId, n: count() }).from(students).where(and(eq(students.academicYearId, year.id), eq(students.status, 'ACTIF'))).groupBy(students.classId);
  const n = new Map(counts.map((c) => [c.classId, Number(c.n)]));
  return (
    <div className="space-y-6">
      <PageHeader kicker="Structure" title="Classes" subtitle="Niveaux suivis par le centre et frais de répétition associés. Ajoutez autant de classes que nécessaire."
        actions={<Modal title="Nouvelle classe" trigger={<button className="btn btn-primary"><Plus size={17} /> Ajouter une classe</button>}><ClassForm /></Modal>} />
      <Card pad={false}>
        {ref.classes.length === 0 ? <Empty icon={<School />} title="Aucune classe" /> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Classe</th><th>Cycle</th><th className="text-right">Inscription</th><th className="text-right">Mensualité</th><th className="text-right">Élèves</th><th>Statut</th><th className="w-24" /></tr></thead>
              <tbody>
                {ref.classes.map((c) => (
                  <tr key={c.id}>
                    <td><div className="flex items-center gap-2.5"><Dot color={c.color} /><div><p className="font-medium">{c.name}</p><p className="text-xs text-slate-500">{c.code}</p></div></div></td>
                    <td className="text-slate-600">{c.cycle === 'PREMIER' ? 'Premier cycle' : 'Second cycle'}</td>
                    <td className="text-right">{money(c.registrationFee)}</td>
                    <td className="text-right font-medium">{money(c.monthlyFee)}</td>
                    <td className="text-right">{num(n.get(c.id) ?? 0)} / {c.capacity}</td>
                    <td>{c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Modal title={`Modifier ${c.name}`} trigger={<button className="btn-icon" aria-label="Modifier"><Pencil size={16} /></button>}><ClassForm c={c} /></Modal>
                        <ActionButton action={deleteClass.bind(null, c.id)} confirm={`Supprimer la classe ${c.name} ? (Elle sera seulement désactivée si elle contient des élèves.)`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
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
