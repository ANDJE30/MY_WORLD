import Link from 'next/link';
import { and, eq, gte, lte } from 'drizzle-orm';
import { FileDown, MessageCircle } from 'lucide-react';
import { db } from '@/db';
import { attendances, seances, students } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { refData, studentsOfYear } from '@/lib/queries';
import { attendanceStats } from '@/lib/calc';
import { pct, num, phoneIntl } from '@/lib/format';
import { addDays, todayISO } from '@/lib/time';
import { Card, Dot, Empty, PageHeader, Progress, TableWrap, rateTone, Badge } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/client/forms';

export const metadata = { title: 'Présences' };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ classe?: string; du?: string; au?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const from = sp.du ?? addDays(today, -30);
  const to = sp.au ?? today;
  const [ref, year] = await Promise.all([refData(), getCurrentYear()]);
  const rows = await db.select({ status: attendances.status, studentId: attendances.studentId, classId: seances.classId })
    .from(attendances).innerJoin(seances, eq(seances.id, attendances.seanceId))
    .where(and(gte(seances.date, from), lte(seances.date, to), eq(seances.academicYearId, year.id)));
  const classId = sp.classe ? Number(sp.classe) : null;
  const perClass = ref.classes.filter((c) => c.isActive).map((c) => ({ c, stats: attendanceStats(rows.filter((r) => r.classId === c.id).map((r) => r.status)) }));
  const roster = classId ? await studentsOfYear(year.id, and(eq(students.classId, classId), eq(students.status, 'ACTIF'))) : [];
  const perStudent = roster.map((s) => ({ s, stats: attendanceStats(rows.filter((r) => r.studentId === s.id).map((r) => r.status)) })).sort((a, b) => (a.stats.rate ?? 101) - (b.stats.rate ?? 101));
  const global = attendanceStats(rows.map((r) => r.status));
  return (
    <div className="space-y-6">
      <PageHeader kicker="Pédagogie" title="Présences" subtitle={`Taux de présence global : ${pct(global.rate)} · ${num(global.ABSENT)} absence(s) du ${from.split('-').reverse().join('/')} au ${to.split('-').reverse().join('/')}`}
        actions={classId ? <a className="btn btn-ghost" target="_blank" href={`/api/pdf/presences?classe=${classId}&du=${from}&au=${to}`}><FileDown size={17} /> État de présence PDF</a> : null} />
      <Card pad={false}>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-navy-50 p-3 sm:p-4">
          <label><span className="label">Du</span><input type="date" name="du" className="input" defaultValue={from} /></label>
          <label><span className="label">Au</span><input type="date" name="au" className="input" defaultValue={to} /></label>
          <AutoSubmitSelect name="classe" defaultValue={sp.classe ?? ''} className="input w-auto"><option value="">Choisir une classe pour le détail…</option>{ref.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AutoSubmitSelect>
          <button className="btn btn-navy">Afficher</button>
        </form>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {perClass.map(({ c, stats }) => (
            <Link key={c.id} href={`/admin/presences?classe=${c.id}&du=${from}&au=${to}`} className={`rounded-xl border p-3 transition hover:border-royal-300 ${classId === c.id ? 'border-royal-500 bg-royal-50/50' : 'border-navy-100'}`}>
              <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium"><Dot color={c.color} />{c.name}</span><span className="text-sm font-semibold">{pct(stats.rate)}</span></div>
              <Progress value={stats.rate} tone={rateTone(stats.rate) === 'blue' ? 'blue' : rateTone(stats.rate)} />
              <p className="mt-1.5 text-xs text-slate-500">{stats.ABSENT} absence(s) · {stats.RETARD} retard(s) · {stats.total} pointage(s)</p>
            </Link>
          ))}
        </div>
      </Card>
      {classId && (
        <Card title={`Détail — ${ref.classById.get(classId)?.name}`} subtitle="Élèves classés du moins assidu au plus assidu" pad={false}>
          {perStudent.length === 0 ? <Empty title="Aucun élève actif dans cette classe" /> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th>Élève</th><th className="text-center">Présent</th><th className="text-center">Retard</th><th className="text-center">Absent</th><th className="text-center">Justifié</th><th className="w-48">Taux</th><th /></tr></thead>
                <tbody>
                  {perStudent.map(({ s, stats }) => (
                    <tr key={s.id}>
                      <td><Link href={`/admin/eleves/${s.id}`} className="font-medium hover:text-royal-700">{s.lastName} {s.firstName}</Link></td>
                      <td className="text-center">{stats.PRESENT}</td><td className="text-center">{stats.RETARD}</td>
                      <td className="text-center">{stats.ABSENT > 0 ? <Badge tone="red">{stats.ABSENT}</Badge> : 0}</td><td className="text-center">{stats.EXCUSE}</td>
                      <td><div className="flex items-center gap-2"><Progress value={stats.rate} tone={rateTone(stats.rate) === 'blue' ? 'blue' : rateTone(stats.rate)} /><span className="w-12 text-right text-sm font-medium">{pct(stats.rate)}</span></div></td>
                      <td>{s.parentPhone && stats.ABSENT > 0 && <a className="btn-icon text-emerald-600" target="_blank" rel="noopener noreferrer" title="Prévenir le parent sur WhatsApp" href={`https://wa.me/${phoneIntl(s.parentPhone).replace('+', '')}?text=${encodeURIComponent(`Bonjour ${s.parentName}, ${s.firstName} totalise ${stats.ABSENT} absence(s) aux répétitions de la SVTC depuis le ${from.split('-').reverse().join('/')}. Merci de nous contacter.`)}`}><MessageCircle size={16} /></a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}
    </div>
  );
}
