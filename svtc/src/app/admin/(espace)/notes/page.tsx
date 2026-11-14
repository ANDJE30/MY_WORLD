import Link from 'next/link';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { FileDown, Send, LineChart as LineIcon } from 'lucide-react';
import { db } from '@/db';
import { evaluations, grades, students, tutors } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { refData, studentsOfYear } from '@/lib/queries';
import { weightedAverage, appreciation } from '@/lib/calc';
import { dateFr, score } from '@/lib/format';
import { EVALUATION_TYPES } from '@/lib/constants';
import { Badge, Card, Dot, Empty, PageHeader, TableWrap, avgTone } from '@/components/ui';
import { ActionButton, AutoSubmitSelect } from '@/components/client/forms';
import { sendClassReports } from '@/app/actions/messaging';

export const metadata = { title: 'Notes & suivi' };

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const sp = await searchParams;
  const [ref, year] = await Promise.all([refData(), getCurrentYear()]);
  const active = ref.classes.filter((c) => c.isActive);
  const classId = sp.classe ? Number(sp.classe) : active[0]?.id;
  const evals = classId ? await db.select({ e: evaluations, tFirst: tutors.firstName, tLast: tutors.lastName }).from(evaluations).leftJoin(tutors, eq(tutors.id, evaluations.tutorId))
    .where(and(eq(evaluations.classId, classId), eq(evaluations.academicYearId, year.id))).orderBy(asc(evaluations.date)) : [];
  const gr = evals.length ? await db.select().from(grades).where(inArray(grades.evaluationId, evals.map((e) => e.e.id))) : [];
  const roster = classId ? await studentsOfYear(year.id, and(eq(students.classId, classId), eq(students.status, 'ACTIF'))) : [];
  const evalBy = new Map(evals.map((e) => [e.e.id, e.e]));
  const subjIds = [...new Set(evals.map((e) => e.e.subjectId))];
  const table = roster.map((s) => {
    const mine = gr.filter((g) => g.studentId === s.id).map((g) => ({ ...g, ...evalBy.get(g.evaluationId)!, score: g.score, absent: g.absent }));
    return { s, avg: weightedAverage(mine), bySubject: subjIds.map((id) => weightedAverage(mine.filter((m) => m.subjectId === id))) };
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  const evalAvg = (id: number) => weightedAverage(gr.filter((g) => g.evaluationId === id).map((g) => ({ ...g, maxScore: evalBy.get(id)!.maxScore, coefficient: 1 })));
  const classAvg = weightedAverage(table.filter((t) => t.avg !== null).map((t) => ({ score: t.avg, absent: false, maxScore: 20, coefficient: 1 })));
  return (
    <div className="space-y-6">
      <PageHeader kicker="Pédagogie" title="Notes & suivi des élèves" subtitle="Évaluations saisies par les encadreurs, moyennes et classement par classe."
        actions={classId ? <>
          <ActionButton action={sendClassReports.bind(null, classId)} className="btn btn-soft" confirm="Envoyer l'état de suivi de chaque élève de la classe à son parent ?"><Send size={16} /> Envoyer les états de suivi</ActionButton>
        </> : null} />
      <form method="get" className="flex flex-wrap gap-2">
        <AutoSubmitSelect name="classe" defaultValue={String(classId ?? '')} className="input w-auto">{active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AutoSubmitSelect>
      </form>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={`Classement — ${classId ? ref.classById.get(classId)?.name : ''}`} subtitle={`Moyenne de la classe : ${classAvg === null ? '—' : `${score(classAvg)}/20`}`} pad={false}>
          {table.length === 0 ? <Empty icon={<LineIcon />} title="Aucun élève" /> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th>#</th><th>Élève</th>{subjIds.map((id) => <th key={id} className="text-center">{ref.subjectById.get(id)?.code}</th>)}<th className="text-center">Moyenne</th><th className="hidden md:table-cell">Appréciation</th><th /></tr></thead>
                <tbody>
                  {table.map((t, i) => (
                    <tr key={t.s.id}>
                      <td className="text-slate-500">{t.avg === null ? '—' : i + 1}</td>
                      <td><Link href={`/admin/eleves/${t.s.id}`} className="font-medium hover:text-royal-700">{t.s.lastName} {t.s.firstName}</Link></td>
                      {t.bySubject.map((v, k) => <td key={k} className="text-center">{v === null ? '—' : score(v)}</td>)}
                      <td className="text-center"><Badge tone={avgTone(t.avg)}>{t.avg === null ? '—' : score(t.avg)}</Badge></td>
                      <td className="hidden text-sm text-slate-600 md:table-cell">{appreciation(t.avg)}</td>
                      <td><a href={`/api/pdf/suivi/${t.s.id}`} target="_blank" className="btn-icon" title="État de suivi PDF"><FileDown size={16} /></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
        <Card title="Évaluations" subtitle={`${evals.length} évaluation(s)`} pad={false}>
          {evals.length === 0 ? <Empty title="Aucune évaluation" text="Les encadreurs saisissent les notes depuis leur espace." /> : (
            <ul className="divide-y divide-navy-50">
              {[...evals].reverse().map(({ e, tFirst, tLast }) => {
                const a = evalAvg(e.id);
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate text-sm font-medium text-navy-950">{e.title}</p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Dot color={ref.subjectById.get(e.subjectId)?.color ?? '#999'} />{ref.subjectById.get(e.subjectId)?.code} · {EVALUATION_TYPES[e.type as keyof typeof EVALUATION_TYPES] ?? e.type} · {dateFr(e.date)}</p>
                        <p className="text-xs text-slate-400">{tFirst ? `${tFirst} ${tLast}` : ''}</p></div>
                      <Badge tone={avgTone(a)}>{a === null ? '—' : `${score(a)}/20`}</Badge>
                    </div>
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
