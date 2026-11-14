import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArrowLeft, FileDown, Send } from 'lucide-react';
import { students } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { studentProgress, studentsOfYear } from '@/lib/queries';
import { myAssignments } from '@/lib/tutor';
import { appreciation } from '@/lib/calc';
import { dateFr, dateShort, pct, score } from '@/lib/format';
import { ATTENDANCE_STATUS, EVALUATION_TYPES } from '@/lib/constants';
import { Avatar, Badge, Card, Stat, avgTone } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { ActionButton } from '@/components/client/forms';
import { sendProgressReport } from '@/app/actions/messaging';

export default async function TutorStudent({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole('ENCADREUR');
  const id = Number((await params).id);
  const asg = await myAssignments(me.tutorId!);
  const [st] = Number.isInteger(id) ? await studentsOfYear(asg.year.id, eq(students.id, id)) : [];
  if (!st || !asg.classIds.includes(st.classId)) notFound();
  const p = await studentProgress(id);
  return (
    <div className="space-y-5">
      <Link href={`/encadreur/eleves?classe=${st.classId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500"><ArrowLeft size={16} /> {st.className}</Link>
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={`${st.firstName} ${st.lastName}`} color={st.classColor} size={60} />
        <div className="min-w-0 flex-1"><h1 className="text-xl font-semibold text-navy-950">{st.lastName} {st.firstName}</h1><p className="text-sm text-slate-500">{st.className} · {st.school ?? ''} · Parent : {st.parentName ?? '—'}</p></div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/pdf/suivi/${id}`} target="_blank" className="btn btn-ghost"><FileDown size={16} /> État de suivi (PDF)</a>
          {st.parentId && <ActionButton action={sendProgressReport.bind(null, id)} confirm={`Envoyer l'état de suivi (assiduité et performances) à ${st.parentName} ?`} className="btn btn-primary"><Send size={16} /> Envoyer au parent</ActionButton>}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Assiduité" value={pct(p.stats.rate)} hint={`${p.stats.ABSENT} absence(s)`} tone="green" />
        <Stat label="Retards" value={p.stats.RETARD} tone="gold" />
        <Stat label="Moyenne" value={p.average === null ? '—' : `${score(p.average)}/20`} hint={appreciation(p.average)} tone="blue" />
        <Stat label="Évaluations" value={p.grades.length} tone="navy" />
      </div>
      <Card title="Évolution des notes">
        <LineChart points={p.grades.filter((g) => !g.absent && g.score !== null).map((g) => ({ label: dateShort(g.date).split(' ').slice(1).join(' '), value: Math.round(((g.score as number) / g.maxScore) * 2000) / 100 }))} />
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Notes" pad={false}>
          <ul className="divide-y divide-navy-50">
            {p.grades.length === 0 && <li className="p-5 text-sm text-slate-500">Aucune note.</li>}
            {[...p.grades].reverse().map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium">{g.title}</span><span className="text-xs text-slate-500">{dateFr(g.date)} · {EVALUATION_TYPES[g.type as keyof typeof EVALUATION_TYPES] ?? g.type}</span></span>
                <Badge tone={g.absent ? 'slate' : avgTone(((g.score ?? 0) / g.maxScore) * 20)}>{g.absent ? 'Absent' : `${score(g.score)}/${g.maxScore}`}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Présences" pad={false}>
          <ul className="max-h-96 divide-y divide-navy-50 overflow-y-auto">
            {p.attendance.length === 0 && <li className="p-5 text-sm text-slate-500">Aucun appel.</li>}
            {[...p.attendance].reverse().map((a, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{dateFr(a.date)} · <span className="text-slate-500">{a.subjectName}</span></span><Badge tone={ATTENDANCE_STATUS[a.status].tone}>{ATTENDANCE_STATUS[a.status].label}</Badge></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
