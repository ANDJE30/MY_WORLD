import { and, desc, eq, type SQL } from 'drizzle-orm';
import { FileText, Eye, Trash2, Download, CheckCircle2 } from 'lucide-react';
import { db } from '@/db';
import { documents, files } from '@/db/schema';
import { refData, tutorName } from '@/lib/queries';
import { dateTimeFr, num } from '@/lib/format';
import { DOCUMENT_STATUS, DOCUMENT_TYPES } from '@/lib/constants';
import { Badge, Dot, Empty, PageHeader } from '@/components/ui';
import { ActionButton, ActionForm, AutoSubmitSelect, Modal, SubmitButton } from '@/components/client/forms';
import { reviewDocument, deleteDocument } from '@/app/actions/pedagogy';

export const metadata = { title: 'Documents pédagogiques' };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ statut?: string; classe?: string; encadreur?: string }> }) {
  const sp = await searchParams;
  const ref = await refData();
  const conds: SQL[] = [];
  if (sp.statut) conds.push(eq(documents.status, sp.statut));
  if (sp.classe) conds.push(eq(documents.classId, Number(sp.classe)));
  if (sp.encadreur) conds.push(eq(documents.tutorId, Number(sp.encadreur)));
  const list = await db.select({ d: documents, size: files.size, name: files.name }).from(documents).innerJoin(files, eq(files.id, documents.fileId))
    .where(conds.length ? and(...conds) : undefined).orderBy(desc(documents.createdAt)).limit(300);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Pédagogie" title="Documents pédagogiques" subtitle="Fiches de TD, corrigés et supports déposés par les encadreurs (PDF). Approuvez-les et choisissez s'ils sont visibles des parents." />
      <form method="get" className="flex flex-wrap gap-2">
        <AutoSubmitSelect name="statut" defaultValue={sp.statut ?? ''} className="input w-auto"><option value="">Tous les statuts</option>{Object.entries(DOCUMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</AutoSubmitSelect>
        <AutoSubmitSelect name="classe" defaultValue={sp.classe ?? ''} className="input w-auto"><option value="">Toutes les classes</option>{ref.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AutoSubmitSelect>
        <AutoSubmitSelect name="encadreur" defaultValue={sp.encadreur ?? ''} className="input w-auto"><option value="">Tous les encadreurs</option>{ref.tutors.map((t) => <option key={t.id} value={t.id}>{tutorName(t)}</option>)}</AutoSubmitSelect>
      </form>
      {list.length === 0 ? <div className="card"><Empty icon={<FileText />} title="Aucun document" text="Les documents déposés par les encadreurs apparaîtront ici." /></div> : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map(({ d, size }) => {
            const st = DOCUMENT_STATUS[d.status as keyof typeof DOCUMENT_STATUS] ?? DOCUMENT_STATUS.SOUMIS;
            const sub = d.subjectId ? ref.subjectById.get(d.subjectId) : null;
            return (
              <div key={d.id} className="card flex flex-col p-4 animate-fade-up">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[10px] font-bold text-rose-600 ring-1 ring-rose-200">PDF</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy-950">{d.title}</p>
                    <p className="text-xs text-slate-500">{DOCUMENT_TYPES[d.type as keyof typeof DOCUMENT_TYPES] ?? d.type} · {num(Math.round(size / 1024))} Ko</p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {d.classId && <Badge>{ref.classById.get(d.classId)?.name}</Badge>}
                  {sub && <Badge><Dot color={sub.color} />{sub.code}</Badge>}
                  {d.visibleToParents && <Badge tone="gold">Visible des parents</Badge>}
                </div>
                {d.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{d.description}</p>}
                <p className="mt-2 text-xs text-slate-500">{d.tutorId ? tutorName(ref.tutorById.get(d.tutorId)) : 'Administration'} · {dateTimeFr(d.createdAt)}</p>
                {d.adminComment && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">Avis : {d.adminComment}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                  <Modal title={d.title} size="xl" trigger={<button className="btn btn-ghost btn-sm"><Eye size={15} /> Consulter</button>}>
                    <iframe src={`/api/fichiers/${d.fileId}`} title={d.title} className="h-[70dvh] w-full rounded-lg border border-navy-100" />
                  </Modal>
                  <a href={`/api/fichiers/${d.fileId}?dl=1`} className="btn btn-ghost btn-sm"><Download size={15} /></a>
                  <Modal title="Examiner le document" size="sm" trigger={<button className="btn btn-primary btn-sm"><CheckCircle2 size={15} /> Examiner</button>}>
                    <ActionForm action={reviewDocument.bind(null, d.id)} className="space-y-3">
                      <label className="block"><span className="label">Décision</span>
                        <select name="status" className="input" defaultValue={d.status === 'SOUMIS' ? 'APPROUVE' : d.status}><option value="APPROUVE">Approuver</option><option value="A_REVOIR">Renvoyer pour correction</option><option value="SOUMIS">Laisser en attente</option></select></label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="visibleToParents" className="check" defaultChecked={d.visibleToParents || d.status === 'SOUMIS'} /> Rendre visible dans l&apos;espace des parents de la classe</label>
                      <label className="block"><span className="label">Commentaire pour l&apos;encadreur</span><textarea name="comment" className="input" defaultValue={d.adminComment ?? ''} /></label>
                      <SubmitButton>Enregistrer</SubmitButton>
                    </ActionForm>
                  </Modal>
                  <ActionButton action={deleteDocument.bind(null, d.id)} confirm={`Supprimer « ${d.title} » ?`} className="btn-icon ml-auto hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
