import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { Link2, Info } from 'lucide-react';
import { db } from '@/db';
import { assignments } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { refData, tutorName } from '@/lib/queries';
import { Card, Dot, Empty, PageHeader } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/client/forms';
import { saveAssignments } from '@/app/actions/people';

export const metadata = { title: 'Attributions' };

export default async function AssignmentsPage() {
  const [ref, year] = await Promise.all([refData(), getCurrentYear()]);
  const list = await db.select().from(assignments).where(eq(assignments.academicYearId, year.id));
  const by = new Map(list.map((a) => [`${a.classId}_${a.subjectId}`, a]));
  const cls = ref.classes.filter((c) => c.isActive);
  const subj = ref.subjects.filter((s) => s.isActive);
  const tts = ref.tutors.filter((t) => t.isActive);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Personnes" title="Attributions des classes" subtitle="Pour chaque classe, choisissez l'encadreur de chaque matière et le nombre de créneaux par semaine. Laissez « — » si la matière n'est pas suivie dans la classe."
        actions={<Link href="/admin/planning" className="btn btn-ghost">Générer le planning →</Link>} />
      {tts.length === 0 ? <div className="card"><Empty icon={<Link2 />} title="Ajoutez d'abord des encadreurs" action={<Link className="btn btn-primary" href="/admin/encadreurs">Encadreurs</Link>} /></div> : (
        <ActionForm action={saveAssignments} reset={false} className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-royal-100 bg-royal-50/60 p-3 text-sm text-royal-800"><Info size={17} className="mt-0.5 shrink-0" /> Un créneau = une plage du planning (ex. mercredi 15h30–16h45). Le générateur automatique place ces créneaux sans conflit d’encadreur, de classe ni de salle.</div>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {cls.map((c) => {
              const n = subj.filter((s) => by.has(`${c.id}_${s.id}`)).length;
              return (
                <Card key={c.id} title={<span className="flex items-center gap-2"><Dot color={c.color} /> {c.name}</span>} subtitle={`${n} matière(s) attribuée(s)`}>
                  <div className="space-y-2.5">
                    {subj.map((s) => {
                      const a = by.get(`${c.id}_${s.id}`);
                      return (
                        <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
                          <div className="min-w-0">
                            <p className="mb-1 flex items-center gap-1.5 truncate text-[12.5px] font-medium text-navy-800"><Dot color={s.color} />{s.name}</p>
                            <select name={`t_${c.id}_${s.id}`} className="input py-2" defaultValue={a?.tutorId ?? ''} aria-label={`Encadreur ${s.name} en ${c.name}`}>
                              <option value="">—</option>
                              {tts.map((t) => <option key={t.id} value={t.id}>{tutorName(t)}</option>)}
                            </select>
                          </div>
                          <label className="pt-5 text-center">
                            <input type="number" name={`n_${c.id}_${s.id}`} min={1} max={6} defaultValue={a?.sessionsPerWeek ?? 1} className="input w-16 px-2 py-2 text-center" aria-label="Créneaux par semaine" title="Créneaux par semaine" />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="sticky bottom-3 z-10 flex justify-end"><SubmitButton className="btn btn-gold shadow-lg">Enregistrer toutes les attributions</SubmitButton></div>
        </ActionForm>
      )}
    </div>
  );
}
