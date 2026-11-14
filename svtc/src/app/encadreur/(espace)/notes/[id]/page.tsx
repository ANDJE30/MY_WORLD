import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { db } from '@/db';
import { evaluations, grades, students, subjects, classes } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { dateFr, score } from '@/lib/format';
import { EVALUATION_TYPES } from '@/lib/constants';
import { weightedAverage } from '@/lib/calc';
import { Badge, avgTone } from '@/components/ui';
import { ActionButton, ActionForm, SubmitButton } from '@/components/client/forms';
import { saveGrades, deleteEvaluation } from '@/app/actions/tutor';

export default async function GradeEntry({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole('ENCADREUR');
  const id = Number((await params).id);
  const [row] = Number.isInteger(id) ? await db.select({ e: evaluations, subject: subjects.name, className: classes.name }).from(evaluations)
    .innerJoin(subjects, eq(subjects.id, evaluations.subjectId)).innerJoin(classes, eq(classes.id, evaluations.classId)).where(eq(evaluations.id, id)) : [];
  if (!row || row.e.tutorId !== me.tutorId) notFound();
  const e = row.e;
  const [roster, gr] = await Promise.all([
    db.select().from(students).where(and(eq(students.classId, e.classId), eq(students.academicYearId, e.academicYearId), eq(students.status, 'ACTIF'))).orderBy(asc(students.lastName), asc(students.firstName)),
    db.select().from(grades).where(eq(grades.evaluationId, id)),
  ]);
  const by = new Map(gr.map((g) => [g.studentId, g]));
  const avg = weightedAverage(gr.map((g) => ({ ...g, maxScore: e.maxScore, coefficient: 1 })));
  return (
    <div className="space-y-5">
      <Link href="/encadreur/notes" className="inline-flex items-center gap-1.5 text-sm text-slate-500"><ArrowLeft size={16} /> Évaluations</Link>
      <section className="card flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h1 className="text-xl font-semibold text-navy-950">{e.title}</h1>
          <p className="text-sm text-slate-500">{row.className} · {row.subject} · {EVALUATION_TYPES[e.type as keyof typeof EVALUATION_TYPES]} · {dateFr(e.date)} · noté sur {e.maxScore} · coef. {e.coefficient}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={avgTone(avg)}>{avg === null ? 'Moyenne —' : `Moyenne ${score(avg)}/20`}</Badge>
          <ActionButton action={deleteEvaluation.bind(null, id)} confirm="Supprimer cette évaluation et toutes ses notes ?" className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>
        </div>
      </section>
      <ActionForm action={saveGrades.bind(null, id)} reset={false} closeOnSuccess={false}>
        <p className="mb-2 text-sm text-slate-500">Saisissez une note entre 0 et {e.maxScore} (virgule acceptée) ou « abs » pour un absent. Laissez vide pour ne pas noter.</p>
        <ul className="divide-y divide-navy-50 rounded-2xl border border-navy-100 bg-white">
          {roster.map((s, i) => {
            const g = by.get(s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-xs text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-navy-950">{s.lastName} {s.firstName}</span>
                <input name={`g_${s.id}`} defaultValue={g ? (g.absent ? 'abs' : String(g.score ?? '').replace('.', ',')) : ''} inputMode="decimal" className="input w-24 text-center text-lg font-semibold" placeholder="—" aria-label={`Note de ${s.firstName}`} />
                <input name={`c_${s.id}`} defaultValue={g?.comment ?? ''} className="input hidden w-56 sm:block" placeholder="Observation (facultatif)" />
              </li>
            );
          })}
        </ul>
        <div className="sticky bottom-20 z-10 mt-4 lg:bottom-4"><SubmitButton className="btn btn-gold w-full py-3 shadow-lg">Enregistrer les notes</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
