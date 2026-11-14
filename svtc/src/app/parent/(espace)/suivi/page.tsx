import { and, desc, eq, inArray } from 'drizzle-orm';
import { FileDown, FileText } from 'lucide-react';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { selectedKid } from '@/lib/parent';
import { studentProgress } from '@/lib/queries';
import { appreciation } from '@/lib/calc';
import { dateFr, dateShort, pct, score } from '@/lib/format';
import { ATTENDANCE_STATUS, EVALUATION_TYPES } from '@/lib/constants';
import { Badge, Card, Empty, PageHeader, Stat, avgTone } from '@/components/ui';
import { LineChart } from '@/components/charts';

export const metadata = { title: 'Suivi de mon enfant' };

export default async function ParentFollowUp({ searchParams }: { searchParams: Promise<{ enfant?: string }> }) {
  const me = await requireRole('PARENT');
  const { kid } = await selectedKid(me.parentId!, (await searchParams).enfant);
  if (!kid) return <Empty title="Aucun enfant" />;
  const [p, docs] = await Promise.all([
    studentProgress(kid.id),
    db.select().from(documents).where(and(inArray(documents.classId, [kid.classId]), eq(documents.visibleToParents, true), eq(documents.status, 'APPROUVE'))).orderBy(desc(documents.createdAt)).limit(20),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title={`Suivi de ${kid.firstName}`} subtitle={`${kid.className} · assiduité et performances`} actions={<a href={`/api/pdf/suivi/${kid.id}`} target="_blank" className="btn btn-gold"><FileDown size={16} /> Télécharger l&apos;état de suivi (PDF)</a>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Assiduité" value={pct(p.stats.rate)} hint={`${p.stats.PRESENT + p.stats.RETARD} présence(s)`} tone="green" />
        <Stat label="Absences" value={p.stats.ABSENT} hint={`${p.stats.EXCUSE} justifiée(s) · ${p.stats.RETARD} retard(s)`} tone="red" />
        <Stat label="Moyenne générale" value={p.average === null ? '—' : `${score(p.average)}/20`} hint={appreciation(p.average)} tone="blue" />
        <Stat label="Évaluations" value={p.grades.length} tone="gold" />
      </div>
      <Card title="Évolution des notes (sur 20)">
        <LineChart points={p.grades.filter((g) => !g.absent && g.score !== null).map((g) => ({ label: dateShort(g.date).split(' ').slice(1).join(' '), value: Math.round(((g.score as number) / g.maxScore) * 2000) / 100 }))} color="#b78507" />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {p.subjectsAvg.map((s) => <div key={s.name} className="rounded-xl border border-gold-100 p-3"><p className="truncate text-sm text-navy-800">{s.name}</p><Badge tone={avgTone(s.average)}>{s.average === null ? '—' : `${score(s.average)}/20`}</Badge></div>)}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Notes" pad={false}>
          <ul className="divide-y divide-gold-100">
            {p.grades.length === 0 && <li className="p-5 text-sm text-slate-500">Pas encore de note.</li>}
            {[...p.grades].reverse().map((g, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium">{g.title}</span><span className="text-xs text-slate-500">{dateFr(g.date)} · {EVALUATION_TYPES[g.type as keyof typeof EVALUATION_TYPES] ?? g.type}</span></span>
                <Badge tone={g.absent ? 'slate' : avgTone(((g.score ?? 0) / g.maxScore) * 20)}>{g.absent ? 'Absent' : `${score(g.score)}/${g.maxScore}`}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Absences et retards" pad={false}>
          <ul className="max-h-96 divide-y divide-gold-100 overflow-y-auto">
            {p.attendance.filter((a) => a.status !== 'PRESENT').length === 0 && <li className="p-5 text-sm text-emerald-700">Aucune absence ni retard. Bravo !</li>}
            {[...p.attendance].reverse().filter((a) => a.status !== 'PRESENT').map((a, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{dateFr(a.date)} · <span className="text-slate-500">{a.subjectName}</span></span><Badge tone={ATTENDANCE_STATUS[a.status].tone}>{ATTENDANCE_STATUS[a.status].label}</Badge></li>
            ))}
          </ul>
        </Card>
      </div>
      {docs.length > 0 && (
        <Card title="Fiches de TD partagées par le centre">
          <div className="flex flex-wrap gap-2">{docs.map((d) => <a key={d.id} href={`/api/fichiers/${d.fileId}`} target="_blank" className="btn btn-ghost btn-sm"><FileText size={15} /> {d.title}</a>)}</div>
        </Card>
      )}
    </div>
  );
}
