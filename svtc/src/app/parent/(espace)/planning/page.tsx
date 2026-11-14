import Link from 'next/link';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { FileDown, ArrowRight } from 'lucide-react';
import { db } from '@/db';
import { seances, timeslots } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { selectedKid } from '@/lib/parent';
import { refData, seancesWithNames, tutorName } from '@/lib/queries';
import { addDays, todayISO } from '@/lib/time';
import { dateShort, hm } from '@/lib/format';
import { DAYS, SEANCE_STATUS } from '@/lib/constants';
import { Badge, Empty, PageHeader } from '@/components/ui';

export const metadata = { title: 'Planning' };

export default async function ParentPlanning({ searchParams }: { searchParams: Promise<{ enfant?: string }> }) {
  const me = await requireRole('PARENT');
  const { kid } = await selectedKid(me.parentId!, (await searchParams).enfant);
  if (!kid) return <Empty title="Aucun enfant" />;
  const [year, s, ref] = await Promise.all([getCurrentYear(), getSettings(), refData()]);
  const today = todayISO();
  const [week, list] = await Promise.all([
    db.select().from(timeslots).where(and(eq(timeslots.academicYearId, year.id), eq(timeslots.classId, kid.classId))).orderBy(asc(timeslots.dayOfWeek), asc(timeslots.startTime)),
    seancesWithNames(and(eq(seances.classId, kid.classId), gte(seances.date, addDays(today, -14)), lte(seances.date, addDays(today, 35)))!),
  ]);
  const q = `?enfant=${kid.id}`;
  return (
    <div className="space-y-5">
      <PageHeader title={`Planning — ${kid.className}`} subtitle={`Séances de ${kid.firstName} au ${s.identity.host}`} actions={<a href={`/api/pdf/planning?classe=${kid.classId}`} target="_blank" className="btn btn-navy"><FileDown size={16} /> Planning PDF</a>} />
      <section className="grid gap-3 sm:grid-cols-2">
        {s.sessions.days.map((d) => (
          <div key={d.day} className="card p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">{DAYS[d.day]} · {hm(d.start)}–{hm(d.end)}</p>
            <ul className="mt-3 space-y-2">
              {week.filter((t) => t.dayOfWeek === d.day).map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl bg-navy-50/60 p-2.5" style={{ borderLeft: `4px solid ${ref.subjectById.get(t.subjectId)?.color}` }}>
                  <span className="w-24 shrink-0 text-sm font-semibold text-navy-900">{hm(t.startTime)}–{hm(t.endTime)}</span>
                  <span className="min-w-0 text-sm"><span className="block truncate font-medium text-navy-950">{ref.subjectById.get(t.subjectId)?.name}</span><span className="text-xs text-slate-500">{t.tutorId ? tutorName(ref.tutorById.get(t.tutorId)) : '—'} · {ref.roomById.get(t.roomId ?? 0)?.name ?? '—'}</span></span>
                </li>
              ))}
              {week.filter((t) => t.dayOfWeek === d.day).length === 0 && <li className="text-sm text-slate-500">Pas de cours ce jour.</li>}
            </ul>
          </div>
        ))}
      </section>
      <section className="card overflow-hidden">
        <h2 className="border-b border-gold-100 px-4 py-3 font-semibold text-navy-950">Séances récentes et à venir</h2>
        {list.length === 0 ? <Empty title="Aucune séance" /> : (
          <ul className="divide-y divide-gold-100">
            {list.map((r) => (
              <li key={r.s.id}>
                <Link href={`/parent/seances/${r.s.id}${q}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-gold-50/60 ${r.s.date === today ? 'bg-gold-50' : ''}`}>
                  <span className="w-24 shrink-0 text-sm font-medium first-up text-navy-900">{dateShort(r.s.date)}<span className="block text-xs font-normal text-slate-500">{hm(r.s.startTime)}–{hm(r.s.endTime)}</span></span>
                  <span className="min-w-0 flex-1 text-sm"><span className="block truncate font-medium text-navy-950">{r.subjectName}</span><span className="text-xs text-slate-500">{r.tutorFirst ? `${r.tutorFirst} ${r.tutorLast}` : '—'} · {r.roomName ?? '—'}</span></span>
                  <Badge tone={SEANCE_STATUS[r.s.status].tone}>{r.s.date < today && r.s.status === 'PLANIFIEE' ? 'Passée' : SEANCE_STATUS[r.s.status].label}</Badge>
                  <ArrowRight size={16} className="text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
