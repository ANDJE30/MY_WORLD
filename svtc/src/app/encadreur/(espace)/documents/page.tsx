import { desc, eq } from 'drizzle-orm';
import { FileUp, Trash2, Eye } from 'lucide-react';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { myAssignments } from '@/lib/tutor';
import { dateTimeFr } from '@/lib/format';
import { DOCUMENT_STATUS, DOCUMENT_TYPES } from '@/lib/constants';
import { Badge, Card, Empty, PageHeader } from '@/components/ui';
import { ActionButton, ActionForm, SubmitButton } from '@/components/client/forms';
import { uploadDocument } from '@/app/actions/tutor';
import { deleteDocument } from '@/app/actions/pedagogy';

export const metadata = { title: 'Fiches de TD' };

export default async function TutorDocs() {
  const me = await requireRole('ENCADREUR');
  const asg = await myAssignments(me.tutorId!);
  const list = await db.select().from(documents).where(eq(documents.tutorId, me.tutorId!)).orderBy(desc(documents.createdAt));
  return (
    <div className="space-y-5">
      <PageHeader title="Fiches de TD & documents" subtitle="Déposez vos fiches au format PDF : l'administration les consulte, les approuve et peut les partager avec les parents." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><FileUp size={17} className="text-royal-600" /> Déposer un document</span>}>
          {asg.rows.length === 0 ? <p className="text-sm text-slate-500">Aucune classe attribuée.</p> : (
            <ActionForm action={uploadDocument} className="space-y-3">
              <label className="block"><span className="label">Classe et matière</span>
                <select name="pair" className="input" required>{asg.rows.map((a) => <option key={`${a.classId}_${a.subjectId}`} value={`${a.classId}_${a.subjectId}`}>{a.className} — {a.subjectName}</option>)}</select></label>
              <label className="block"><span className="label">Titre</span><input name="title" className="input" required placeholder="Ex. : Fiche de TD n°4 — Les fonctions" /></label>
              <label className="block"><span className="label">Type</span><select name="type" className="input">{Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="block"><span className="label">Description</span><textarea name="description" className="input" rows={2} /></label>
              <label className="block"><span className="label">Fichier PDF (4 Mo max.)</span><input type="file" name="file" accept="application/pdf" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-royal-50 file:px-3 file:py-2 file:text-royal-700" /></label>
              <SubmitButton className="btn btn-primary w-full">Déposer</SubmitButton>
            </ActionForm>
          )}
        </Card>
        <Card className="lg:col-span-3" title="Mes documents" pad={false}>
          {list.length === 0 ? <Empty title="Aucun document déposé" /> : (
            <ul className="divide-y divide-navy-50">
              {list.map((d) => {
                const st = DOCUMENT_STATUS[d.status as keyof typeof DOCUMENT_STATUS] ?? DOCUMENT_STATUS.SOUMIS;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex h-10 w-9 items-center justify-center rounded-lg bg-rose-50 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">PDF</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy-950">{d.title}</p>
                      <p className="text-xs text-slate-500">{DOCUMENT_TYPES[d.type as keyof typeof DOCUMENT_TYPES]} · {dateTimeFr(d.createdAt)}{d.visibleToParents ? ' · visible des parents' : ''}</p>
                      {d.adminComment && <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">Administration : {d.adminComment}</p>}
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <a href={`/api/fichiers/${d.fileId}`} target="_blank" className="btn-icon" title="Ouvrir"><Eye size={16} /></a>
                    {d.status !== 'APPROUVE' && <ActionButton action={deleteDocument.bind(null, d.id)} confirm={`Supprimer « ${d.title} » ?`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
