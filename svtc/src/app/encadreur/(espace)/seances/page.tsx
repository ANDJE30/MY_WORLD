import Link from 'next/link';
import { and, eq, gte, lte } from 'drizzle-orm';
import { ArrowRight, FileDown } from 'lucide-react';
import { seances } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { seancesWithNames } from '@/lib/queries';
import { myAssignments } from '@/lib/tutor';
import { addMonths, currentPeriod, periodBounds, todayISO } from '@/lib/time';
import { dateShort, hm, periodLabel, timeOf } from '@/lib/format';
import { SEANCE_STATUS } from '@/lib/constants';
import { Badge, Dot, Empty, PageHeader } from '@/components/ui';

export const metadata = { title: 'Mes séances' };

export default async function TutorSeances({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const me = await requireRole('ENCADREUR');
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.mois ?? '') ? sp.mois! : currentPeriod();
  const { start, end } = periodBounds(period);
  const [rows, asg] = await Promise.all([seancesWithNames(and(eq(seances.tutorId, me.tutorId!), gte(seances.date, start), lte(seances.date, end))!), myAssignments(me.tutorId!)]);
  const today = todayISO();
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.s.date, [...(byDate.get(r.s.date) ?? []), r]);
  return (
    <div className="space-y-5">
      <PageHeader title="Mes séances" subtitle={`${rows.length} séance(s) en ${periodLabel(period)}`}
        actions={<div className="flex flex-wrap gap-2">
          <Link href={`?mois=${addMonths(period, -1)}`} className="btn btn-ghost btn-sm">← {periodLabel(addMonths(period, -1))}</Link>
          <Link href={`?mois=${addMonths(period, 1)}`} className="btn btn-ghost btn-sm">{periodLabel(addMonths(period, 1))} →</Link>
        </div>} />
      <div className="flex flex-wrap gap-2">
        {asg.classIds.map((cid) => {
          const a = asg.rows.find((x) => x.classId === cid)!;
          return <a key={cid} href={`/api/pdf/planning?classe=${cid}`} target="_blank" className="chip"><FileDown size={14} /> Planning {a.className}</a>;
        })}
      </div>
      {rows.length === 0 ? <div className="card"><Empty title="Aucune séance ce mois-ci" /></div> : (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, list]) => (
            <div key={date}>
              <p className={`mb-2 text-sm font-semibold first-up ${date === today ? 'text-royal-700' : 'text-slate-500'}`}>{date === today ? "Aujourd'hui · " : ''}{dateShort(date)}</p>
              <div className="card divide-y divide-navy-50">
                {list.map((r) => {
                  const st = SEANCE_STATUS[r.s.status];
                  const late = r.s.status === 'PLANIFIEE' && r.s.date < today;
                  return (
                    <Link key={r.s.id} href={`/encadreur/seances/${r.s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-royal-50/40">
                      <div className="w-20 shrink-0 text-sm font-semibold text-navy-900">{hm(r.s.startTime)}<span className="block text-xs font-normal text-slate-500">{hm(r.s.endTime)}</span></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-navy-950"><Dot color={r.subjectColor} /> {r.className} · {r.subjectName}</p>
                        <p className="text-xs text-slate-500">{r.roomName ?? '—'}{r.s.actualStart ? ` · réalisé ${timeOf(r.s.actualStart)}–${r.s.actualEnd ? timeOf(r.s.actualEnd) : '…'}` : ''}{r.s.topic ? ` · ${r.s.topic}` : ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={late ? 'red' : st.tone}>{late ? 'À pointer' : st.label}</Badge>
                        {r.s.validated && <Badge tone="green">Validée</Badge>}
                      </div>
                      <ArrowRight size={16} className="text-slate-400" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
