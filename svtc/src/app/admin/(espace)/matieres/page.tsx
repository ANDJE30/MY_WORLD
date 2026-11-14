import { count } from 'drizzle-orm';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { assignments, subjects } from '@/db/schema';
import { refData } from '@/lib/queries';
import { Badge, Card, Dot, PageHeader, TableWrap } from '@/components/ui';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { saveSubject, deleteSubject } from '@/app/actions/structure';

export const metadata = { title: 'Matières' };

type S = typeof subjects.$inferSelect;

function SubjectForm({ s }: { s?: S }) {
  return (
    <ActionForm action={saveSubject} className="grid gap-4 sm:grid-cols-2">
      {s && <input type="hidden" name="id" value={s.id} />}
      <label><span className="label">Code</span><input name="code" className="input uppercase" defaultValue={s?.code} required maxLength={10} placeholder="ALGO" /></label>
      <label><span className="label">Ordre</span><input name="sortOrder" type="number" className="input" defaultValue={s?.sortOrder ?? 10} /></label>
      <label className="sm:col-span-2"><span className="label">Intitulé</span><input name="name" className="input" defaultValue={s?.name} required placeholder="Algorithmique et programmation" /></label>
      <label className="sm:col-span-2"><span className="label">Description</span><textarea name="description" className="input" defaultValue={s?.description ?? ''} /></label>
      <label><span className="label">Couleur</span><input name="color" type="color" className="input h-[46px] p-1" defaultValue={s?.color ?? '#2453d6'} /></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="isActive" className="check" defaultChecked={s?.isActive ?? true} /> Matière active</label>
      <div className="sm:col-span-2"><SubmitButton>{s ? 'Enregistrer' : 'Ajouter la matière'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function SubjectsPage() {
  const ref = await refData();
  const used = await db.select({ subjectId: assignments.subjectId, n: count() }).from(assignments).groupBy(assignments.subjectId);
  const n = new Map(used.map((u) => [u.subjectId, Number(u.n)]));
  return (
    <div className="space-y-6">
      <PageHeader kicker="Structure" title="Matières" subtitle="Domaines de formation enseignés par les encadreurs."
        actions={<Modal title="Nouvelle matière" trigger={<button className="btn btn-primary"><Plus size={17} /> Ajouter une matière</button>}><SubjectForm /></Modal>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ref.subjects.map((s) => (
          <div key={s.id} className="card relative overflow-hidden p-5 animate-fade-up">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2"><Dot color={s.color} /><span className="text-xs font-semibold tracking-wider text-slate-500">{s.code}</span></div>
              <div className="flex gap-1">
                <Modal title={`Modifier ${s.name}`} trigger={<button className="btn-icon" aria-label="Modifier"><Pencil size={16} /></button>}><SubjectForm s={s} /></Modal>
                <ActionButton action={deleteSubject.bind(null, s.id)} confirm={`Supprimer « ${s.name} » ? Les attributions, créneaux et séances de cette matière seront supprimés.`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
              </div>
            </div>
            <h3 className="mt-2 font-semibold text-navy-950">{s.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-slate-500">{s.description}</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge tone="blue">{n.get(s.id) ?? 0} classe(s) attribuée(s)</Badge>
              {!s.isActive && <Badge>Inactive</Badge>}
            </div>
          </div>
        ))}
      </div>
      <Card><TableWrap><p className="text-sm text-slate-500">Les matières sont attribuées aux encadreurs classe par classe dans <a href="/admin/attributions" className="text-royal-700 underline">Attributions</a>.</p></TableWrap></Card>
    </div>
  );
}
