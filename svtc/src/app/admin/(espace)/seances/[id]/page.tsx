import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, DoorOpen, User, FileText, BookOpen } from 'lucide-react';
import { seanceDetail, refData, tutorName } from '@/lib/queries';
import { dateLong, duration, hm, timeOf, pct } from '@/lib/format';
import { ATTENDANCE_STATUS, SEANCE_STATUS } from '@/lib/constants';
import { minutesBetween } from '@/lib/time';
import { Badge, Card, PageHeader, Stat } from '@/components/ui';
import { ActionButton, ActionForm, SubmitButton } from '@/components/client/forms';
import { updateSeance, validateSeances } from '@/app/actions/pedagogy';

export default async function SeanceAdmin({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await seanceDetail(id) : null;
  if (!d) notFound();
  const ref = await refData();
  const s = d.s;
  const st = SEANCE_STATUS[s.status];
  return (
    <div className="space-y-6">
      <Link href="/admin/seances" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft size={16} /> Séances</Link>
      <PageHeader kicker={dateLong(s.date)} title={`${d.className} · ${d.subjectName}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={st.tone}>{st.label}</Badge>{s.status === 'TERMINEE' && (s.validated ? <Badge tone="green">Heures validées</Badge> : <Badge tone="amber">Heures à valider</Badge>)}</span>}
        actions={s.status === 'TERMINEE' && !s.validated ? <ActionButton action={validateSeances.bind(null, [s.id])} className="btn btn-success">Valider les heures</ActionButton> : null} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Horaire prévu" value={`${hm(s.startTime)} – ${hm(s.endTime)}`} icon={<Clock size={18} />} tone="navy" />
        <Stat label="Réalisé" value={s.actualStart ? `${timeOf(s.actualStart)} – ${s.actualEnd ? timeOf(s.actualEnd) : '…'}` : '—'} hint={s.actualEnd ? duration(minutesBetween(s.actualStart, s.actualEnd)) : undefined} icon={<Clock size={18} />} tone="cyan" />
        <Stat label="Encadreur" value={d.tutorFirst ? `${d.tutorFirst} ${d.tutorLast}` : '—'} icon={<User size={18} />} tone="blue" />
        <Stat label="Présence" value={pct(d.stats.rate)} hint={`${d.attendanceCount} élève(s) pointé(s)`} icon={<DoorOpen size={18} />} tone="green" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Appel" subtitle={d.attendanceCount ? undefined : "L'appel n'a pas encore été fait par l'encadreur."} pad={false}>
          <ul className="divide-y divide-navy-50">
            {d.roster.map((r) => {
              const a = r.attendance ? ATTENDANCE_STATUS[r.attendance.status] : null;
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <Link href={`/admin/eleves/${r.id}`} className="font-medium text-navy-900 hover:text-royal-700">{r.lastName} {r.firstName}</Link>
                  {a ? <Badge tone={a.tone}>{a.label}</Badge> : <span className="text-xs text-slate-400">Non pointé</span>}
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><BookOpen size={17} className="text-royal-600" /> Contenu de la séance</span>}>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-slate-500">Leçon / thème</dt><dd className="text-navy-900">{s.topic || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Résumé</dt><dd className="whitespace-pre-line text-navy-900">{s.summary || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Travail à faire</dt><dd className="whitespace-pre-line text-navy-900">{s.homework || '—'}</dd></div>
            </dl>
            {d.docs.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {d.docs.map((doc) => <li key={doc.id}><a href={`/api/fichiers/${doc.fileId}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-royal-700 hover:underline"><FileText size={14} />{doc.title}</a></li>)}
              </ul>
            )}
          </Card>
          <Card title="Corriger la séance" subtitle="Réservé à l'administration (oubli de pointage, changement d'encadreur…)">
            <ActionForm action={updateSeance} reset={false} className="grid gap-3">
              <input type="hidden" name="id" value={s.id} />
              <label><span className="label">Date</span><input type="date" name="date" className="input" defaultValue={s.date} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="label">Début prévu</span><input type="time" name="startTime" className="input" defaultValue={s.startTime} /></label>
                <label><span className="label">Fin prévue</span><input type="time" name="endTime" className="input" defaultValue={s.endTime} /></label>
                <label><span className="label">Début réel</span><input type="time" name="actualStartHM" className="input" defaultValue={s.actualStart ? timeOf(s.actualStart) : ''} /></label>
                <label><span className="label">Fin réelle</span><input type="time" name="actualEndHM" className="input" defaultValue={s.actualEnd ? timeOf(s.actualEnd) : ''} /></label>
              </div>
              <label><span className="label">Encadreur</span><select name="tutorId" className="input" defaultValue={s.tutorId ?? ''}><option value="">—</option>{ref.tutors.map((t) => <option key={t.id} value={t.id}>{tutorName(t)}</option>)}</select></label>
              <label><span className="label">Salle</span><select name="roomId" className="input" defaultValue={s.roomId ?? ''}><option value="">—</option>{ref.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <label><span className="label">Thème</span><input name="topic" className="input" defaultValue={s.topic ?? ''} /></label>
              <SubmitButton>Enregistrer</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
