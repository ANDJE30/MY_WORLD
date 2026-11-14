import Link from 'next/link';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Plus, ArrowRight, PenLine } from 'lucide-react';
import { db } from '@/db';
import { evaluations, grades } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { myAssignments } from '@/lib/tutor';
import { weightedAverage } from '@/lib/calc';
import { dateFr, score } from '@/lib/format';
import { todayISO } from '@/lib/time';
import { EVALUATION_TYPES } from '@/lib/constants';
import { Badge, Dot, Empty, PageHeader, avgTone } from '@/components/ui';
import { ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { createEvaluation } from '@/app/actions/tutor';

export const metadata = { title: 'Notes' };

export default async function TutorGrades({ searchParams }: { searchParams: Promise<{ classe?: string; matiere?: string; seance?: string }> }) {
  const me = await requireRole('ENCADREUR');
  const sp = await searchParams;
  const asg = await myAssignments(me.tutorId!);
  const evals = await db.select().from(evaluations).where(and(eq(evaluations.tutorId, me.tutorId!), eq(evaluations.academicYearId, asg.year.id))).orderBy(desc(evaluations.date), desc(evaluations.id));
  const gr = evals.length ? await db.select().from(grades).where(inArray(grades.evaluationId, evals.map((e) => e.id))) : [];
  const pair = sp.classe && sp.matiere ? `${sp.classe}_${sp.matiere}` : undefined;
  const form = (
    <ActionForm action={createEvaluation} className="grid gap-4 sm:grid-cols-2">
      {sp.seance && <input type="hidden" name="seanceId" value={sp.seance} />}
      <label className="sm:col-span-2"><span className="label">Classe et matière</span>
        <select name="pair" className="input" defaultValue={pair} required>
          {asg.rows.map((a) => <option key={`${a.classId}_${a.subjectId}`} value={`${a.classId}_${a.subjectId}`}>{a.className} — {a.subjectName}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2"><span className="label">Intitulé</span><input name="title" className="input" required placeholder="Ex. : TD n°3 — Les tableaux" /></label>
      <label><span className="label">Type</span><select name="type" className="input">{Object.entries(EVALUATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label><span className="label">Date</span><input type="date" name="date" className="input" defaultValue={todayISO()} max={todayISO()} required /></label>
      <label><span className="label">Barème (noté sur)</span><input type="number" name="maxScore" className="input" defaultValue={20} min={1} max={100} /></label>
      <label><span className="label">Coefficient</span><input type="number" name="coefficient" className="input" defaultValue={1} min={0.5} max={10} step={0.5} /></label>
      <div className="sm:col-span-2"><SubmitButton>Créer et saisir les notes</SubmitButton></div>
    </ActionForm>
  );
  return (
    <div className="space-y-5">
      <PageHeader title="Évaluations & notes" subtitle="Créez une évaluation puis saisissez les notes de la classe (sur ordinateur ou téléphone)."
        actions={<Modal title="Nouvelle évaluation" defaultOpen={!!pair} trigger={<button className="btn btn-primary"><Plus size={17} /> Nouvelle évaluation</button>}>{form}</Modal>} />
      {evals.length === 0 ? <div className="card"><Empty icon={<PenLine />} title="Aucune évaluation" text="Créez votre première évaluation." /></div> : (
        <div className="card divide-y divide-navy-50">
          {evals.map((e) => {
            const a = asg.rows.find((x) => x.classId === e.classId && x.subjectId === e.subjectId);
            const mine = gr.filter((g) => g.evaluationId === e.id);
            const avg = weightedAverage(mine.map((g) => ({ ...g, maxScore: e.maxScore, coefficient: 1 })));
            return (
              <Link key={e.id} href={`/encadreur/notes/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-royal-50/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-950">{e.title}</p>
                  <p className="text-xs text-slate-500"><Dot color={a?.subjectColor ?? '#999'} /> {a?.className ?? ''} · {EVALUATION_TYPES[e.type as keyof typeof EVALUATION_TYPES]} · {dateFr(e.date)} · {mine.length} note(s)</p>
                </div>
                <Badge tone={avgTone(avg)}>{avg === null ? 'À saisir' : `Moy. ${score(avg)}/20`}</Badge>
                <ArrowRight size={16} className="text-slate-400" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
