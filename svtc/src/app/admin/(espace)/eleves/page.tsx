import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { Plus, Upload, Eye, Pencil, Trash2, GraduationCap, Search, FileDown } from 'lucide-react';
import { db } from '@/db';
import { parents } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { balances, refData } from '@/lib/queries';
import { money, phoneFr, num } from '@/lib/format';
import { STUDENT_STATUS } from '@/lib/constants';
import { Badge, Card, Dot, Empty, PageHeader, TableWrap } from '@/components/ui';
import { ActionButton, AutoSubmitSelect, Modal } from '@/components/client/forms';
import { ImportStudentsForm } from '@/components/client/import-form';
import { StudentForm } from '@/components/admin/student-form';
import { deleteStudent, importStudents } from '@/app/actions/people';

export const metadata = { title: 'Élèves' };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; classe?: string; statut?: string; sansparent?: string }> }) {
  const sp = await searchParams;
  const [year, ref] = await Promise.all([getCurrentYear(), refData()]);
  const [all, parentList] = await Promise.all([balances(year.id), db.select({ id: parents.id, fullName: parents.fullName, phone: parents.phone }).from(parents).orderBy(asc(parents.fullName))]);
  const q = (sp.q ?? '').trim().toLowerCase();
  const list = all.filter((s) =>
    (!sp.classe || String(s.classId) === sp.classe) &&
    (!sp.statut || s.status === sp.statut) &&
    (!sp.sansparent || !s.parentId) &&
    (!q || `${s.lastName} ${s.firstName} ${s.matricule} ${s.parentName ?? ''} ${s.parentPhone ?? ''} ${s.school ?? ''}`.toLowerCase().includes(q)));
  const classOpts = ref.classes.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }));
  const qs = new URLSearchParams({ ...(sp.classe ? { classe: sp.classe } : {}) }).toString();

  return (
    <div className="space-y-6">
      <PageHeader kicker="Personnes" title="Élèves" subtitle={`${num(all.filter((s) => s.status === 'ACTIF').length)} élève(s) actif(s) en ${year.label}`}
        actions={<>
          <a href={`/api/pdf/eleves${qs ? `?${qs}` : ''}`} target="_blank" className="btn btn-ghost"><FileDown size={17} /> Liste PDF</a>
          <Modal title="Importer des élèves" subtitle="Depuis un fichier CSV ou un copier-coller Excel" size="lg" trigger={<button className="btn btn-ghost"><Upload size={17} /> Importer</button>}>
            <ImportStudentsForm action={importStudents} classes={classOpts} />
          </Modal>
          <Modal title="Inscrire un élève" size="lg" trigger={<button className="btn btn-primary"><Plus size={17} /> Inscrire un élève</button>}>
            <StudentForm classes={classOpts} parents={parentList} defaultClassId={sp.classe ? Number(sp.classe) : undefined} />
          </Modal>
        </>} />

      <Card pad={false}>
        <form className="flex flex-wrap items-center gap-2 border-b border-navy-50 p-3 sm:p-4" method="get">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={sp.q} placeholder="Nom, matricule, parent, téléphone…" className="input pl-9" />
          </div>
          <AutoSubmitSelect name="classe" defaultValue={sp.classe ?? ''} className="input w-auto">
            <option value="">Toutes les classes</option>
            {ref.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="statut" defaultValue={sp.statut ?? ''} className="input w-auto">
            <option value="">Tous les statuts</option>
            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </AutoSubmitSelect>
          <button className="btn btn-navy">Filtrer</button>
          {(sp.q || sp.classe || sp.statut || sp.sansparent) && <Link href="/admin/eleves" className="btn btn-ghost">Réinitialiser</Link>}
        </form>
        {list.length === 0 ? (
          <Empty icon={<GraduationCap />} title="Aucun élève" text="Inscrivez un élève ou importez une liste complète depuis Excel." />
        ) : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Élève</th><th>Classe</th><th className="hidden md:table-cell">Parent</th><th className="text-right">Solde à ce jour</th><th>Statut</th><th className="w-28" /></tr></thead>
              <tbody>
                {list.map((s) => {
                  const st = STUDENT_STATUS[s.status as keyof typeof STUDENT_STATUS] ?? STUDENT_STATUS.ACTIF;
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/admin/eleves/${s.id}`} className="font-medium text-navy-950 hover:text-royal-700">{s.lastName} {s.firstName}</Link>
                        <p className="text-xs text-slate-500">{s.matricule}{s.school ? ` · ${s.school}` : ''}</p>
                      </td>
                      <td><span className="inline-flex items-center gap-2"><Dot color={s.classColor} />{s.classCode}</span></td>
                      <td className="hidden md:table-cell">{s.parentName ? <><p className="text-sm">{s.parentName}</p><p className="text-xs text-slate-500">{phoneFr(s.parentPhone)}</p></> : <Badge tone="amber">Aucun parent</Badge>}</td>
                      <td className="text-right">{s.balance > 0 ? <span className="font-semibold text-rose-600">{money(s.balance)}</span> : <span className="font-medium text-emerald-700">À jour</span>}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-0.5">
                          <Link href={`/admin/eleves/${s.id}`} className="btn-icon" title="Fiche"><Eye size={16} /></Link>
                          <Modal title={`Modifier ${s.firstName} ${s.lastName}`} size="lg" trigger={<button className="btn-icon" aria-label="Modifier"><Pencil size={16} /></button>}>
                            <StudentForm s={s} classes={classOpts} parents={parentList} />
                          </Modal>
                          <ActionButton action={deleteStudent.bind(null, s.id)} confirm={`Supprimer ${s.firstName} ${s.lastName} ?`} className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
