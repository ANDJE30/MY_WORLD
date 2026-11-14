import Link from 'next/link';
import { and, eq, inArray } from 'drizzle-orm';
import { ArrowRight } from 'lucide-react';
import { db } from '@/db';
import { attendances, seances, students } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { studentsOfYear } from '@/lib/queries';
import { myAssignments } from '@/lib/tutor';
import { attendanceStats } from '@/lib/calc';
import { pct } from '@/lib/format';
import { Avatar, Badge, Dot, Empty, PageHeader, rateTone } from '@/components/ui';

export const metadata = { title: 'Mes élèves' };

export default async function TutorStudents({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const me = await requireRole('ENCADREUR');
  const sp = await searchParams;
  const asg = await myAssignments(me.tutorId!);
  const ids = asg.classIds;
  const classId = sp.classe && ids.includes(Number(sp.classe)) ? Number(sp.classe) : ids[0];
  const list = classId ? await studentsOfYear(asg.year.id, and(eq(students.classId, classId), eq(students.status, 'ACTIF'))) : [];
  const att = list.length ? await db.select({ studentId: attendances.studentId, status: attendances.status }).from(attendances).innerJoin(seances, eq(seances.id, attendances.seanceId))
    .where(and(inArray(attendances.studentId, list.map((l) => l.id)), eq(seances.tutorId, me.tutorId!))) : [];
  return (
    <div className="space-y-5">
      <PageHeader title="Mes élèves" subtitle="Assiduité dans vos séances, progression et état de suivi." />
      {ids.length === 0 ? <div className="card"><Empty title="Aucune classe attribuée" text="Contactez l'administration." /></div> : (
        <>
          <div className="flex flex-wrap gap-2">
            {ids.map((cid) => {
              const a = asg.rows.find((x) => x.classId === cid)!;
              return <Link key={cid} href={`?classe=${cid}`} className={`chip ${cid === classId ? 'chip-on' : ''}`}><Dot color={a.classColor} />{a.className}</Link>;
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => {
              const st = attendanceStats(att.filter((a) => a.studentId === s.id).map((a) => a.status));
              return (
                <Link key={s.id} href={`/encadreur/eleves/${s.id}`} className="card flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                  <Avatar name={`${s.firstName} ${s.lastName}`} color={s.classColor} size={42} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-navy-950">{s.lastName} {s.firstName}</p><p className="truncate text-xs text-slate-500">{s.school ?? s.matricule}</p></div>
                  <Badge tone={rateTone(st.rate) === 'blue' ? 'slate' : rateTone(st.rate)}>{pct(st.rate)}</Badge>
                  <ArrowRight size={16} className="text-slate-400" />
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
