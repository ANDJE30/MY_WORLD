import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowLeft, Clock, User, DoorOpen, BookOpen, FileText, CalendarDays } from 'lucide-react';
import { db } from '@/db';
import { attendances, documents } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { selectedKid } from '@/lib/parent';
import { seanceDetail } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { dateLong, duration, hm, timeOf } from '@/lib/format';
import { minutesBetween } from '@/lib/time';
import { ATTENDANCE_STATUS, SEANCE_STATUS } from '@/lib/constants';
import { Badge } from '@/components/ui';

export default async function ParentSeance({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enfant?: string }> }) {
  const me = await requireRole('PARENT');
  const id = Number((await params).id);
  const { kids } = await selectedKid(me.parentId!, (await searchParams).enfant);
  const d = Number.isInteger(id) ? await seanceDetail(id) : null;
  const kid = d ? kids.find((k) => k.classId === d.s.classId) : null;
  if (!d || !kid) notFound();
  const s = d.s;
  const st = await getSettings();
  const [att] = await db.select().from(attendances).where(and(eq(attendances.seanceId, id), eq(attendances.studentId, kid.id)));
  const docs = await db.select().from(documents).where(and(eq(documents.seanceId, id), eq(documents.visibleToParents, true), eq(documents.status, 'APPROUVE')));
  const items = [
    { icon: CalendarDays, label: 'Date', value: <span className="first-up">{dateLong(s.date)}</span> },
    { icon: Clock, label: 'Horaire prévu', value: `${hm(s.startTime)} – ${hm(s.endTime)}` },
    { icon: Clock, label: 'Début et fin effectifs', value: s.actualStart ? `${timeOf(s.actualStart)} – ${s.actualEnd ? timeOf(s.actualEnd) : 'en cours'}${s.actualEnd ? ` (${duration(minutesBetween(s.actualStart, s.actualEnd))})` : ''}` : '—' },
    { icon: User, label: 'Encadreur', value: d.tutorFirst ? `${d.tutorFirst} ${d.tutorLast}` : '—' },
    { icon: DoorOpen, label: 'Lieu', value: `${d.roomName ?? '—'} · ${st.identity.host}, ${st.identity.address}` },
  ];
  return (
    <div className="space-y-5">
      <Link href={`/parent/planning?enfant=${kid.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500"><ArrowLeft size={16} /> Planning</Link>
      <section className="card overflow-hidden">
        <div className="p-5" style={{ background: `linear-gradient(135deg, ${d.subjectColor}22, transparent)` }}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="text-sm text-slate-500">{d.className}</p><h1 className="text-2xl font-semibold text-navy-950">{d.subjectName}</h1></div>
            <Badge tone={SEANCE_STATUS[s.status].tone}>{SEANCE_STATUS[s.status].label}</Badge>
          </div>
          {s.cancelReason && <p className="mt-2 text-sm text-rose-700">Motif : {s.cancelReason}</p>}
        </div>
        <dl className="divide-y divide-gold-100">
          {items.map((i) => (
            <div key={i.label} className="flex items-center gap-3 px-5 py-3"><i.icon size={18} className="text-gold-600" /><dt className="w-44 shrink-0 text-sm text-slate-500">{i.label}</dt><dd className="text-sm font-medium text-navy-950">{i.value}</dd></div>
          ))}
          <div className="flex items-center gap-3 px-5 py-3"><User size={18} className="text-gold-600" /><dt className="w-44 shrink-0 text-sm text-slate-500">Présence de {kid.firstName}</dt><dd>{att ? <Badge tone={ATTENDANCE_STATUS[att.status].tone}>{ATTENDANCE_STATUS[att.status].label}</Badge> : <span className="text-sm text-slate-400">Non renseignée</span>}</dd></div>
        </dl>
      </section>
      {(s.topic || s.summary || s.homework || docs.length > 0) && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-navy-950"><BookOpen size={18} className="text-royal-600" /> Ce qui a été fait</h2>
          {s.topic && <p className="mt-3"><span className="text-xs uppercase tracking-wide text-slate-500">Leçon</span><br />{s.topic}</p>}
          {s.summary && <p className="mt-3 whitespace-pre-line"><span className="text-xs uppercase tracking-wide text-slate-500">Résumé</span><br />{s.summary}</p>}
          {s.homework && <p className="mt-3 rounded-xl bg-gold-50 p-3 whitespace-pre-line"><span className="text-xs font-semibold uppercase tracking-wide text-gold-700">Travail à faire</span><br />{s.homework}</p>}
          {docs.map((doc) => <a key={doc.id} href={`/api/fichiers/${doc.fileId}`} target="_blank" className="btn btn-ghost btn-sm mt-3"><FileText size={15} /> {doc.title}</a>)}
        </section>
      )}
    </div>
  );
}
