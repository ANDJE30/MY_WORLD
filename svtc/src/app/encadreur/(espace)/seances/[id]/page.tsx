import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Play, Square, Clock, FileUp, BookOpen, PenLine, FileText, Lock } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { seanceDetail } from '@/lib/queries';
import { myAssignments } from '@/lib/tutor';
import { addDays, todayISO, minutesBetween } from '@/lib/time';
import { dateLong, duration, hm, timeOf } from '@/lib/format';
import { DOCUMENT_TYPES, SEANCE_STATUS } from '@/lib/constants';
import { Badge, Card } from '@/components/ui';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { AttendanceForm } from '@/components/client/attendance-form';
import { LiveTimer } from '@/components/client/timer';
import { startSeance, endSeance, setSeanceTimes, saveAttendance, saveSeanceContent, uploadDocument } from '@/app/actions/tutor';

export default async function TutorSeance({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole('ENCADREUR');
  const id = Number((await params).id);
  const d = Number.isInteger(id) ? await seanceDetail(id) : null;
  if (!d || d.s.tutorId !== me.tutorId) notFound();
  const s = d.s;
  const today = todayISO();
  const locked = s.validated || s.status === 'ANNULEE' || s.date > today || s.date < addDays(today, -7);
  const lockReason = s.validated ? 'Heures validées par l’administration.' : s.status === 'ANNULEE' ? `Séance annulée : ${s.cancelReason ?? ''}` : s.date > today ? 'Séance à venir : l’appel s’ouvre le jour de la séance.' : s.date < addDays(today, -7) ? 'Délai de saisie dépassé (7 jours).' : '';
  const asg = await myAssignments(me.tutorId!);
  return (
    <div className="space-y-5">
      <Link href="/encadreur/seances" className="inline-flex items-center gap-1.5 text-sm text-slate-500"><ArrowLeft size={16} /> Mes séances</Link>
      <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]" style={{ borderTop: `5px solid ${d.subjectColor}` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm first-up text-slate-500">{dateLong(s.date)}</p>
            <h1 className="text-2xl font-semibold text-navy-950">{d.className}</h1>
            <p className="text-slate-600">{d.subjectName} · {hm(s.startTime)}–{hm(s.endTime)} · {d.roomName ?? 'Salle ?'}</p>
          </div>
          <div className="flex flex-col items-end gap-1"><Badge tone={SEANCE_STATUS[s.status].tone}>{SEANCE_STATUS[s.status].label}</Badge>{s.validated && <Badge tone="green">Heures validées</Badge>}</div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-navy-50/70 p-3"><p className="text-xs text-slate-500">Début réel</p><p className="text-lg font-semibold">{s.actualStart ? timeOf(s.actualStart) : '—'}</p></div>
          <div className="rounded-2xl bg-navy-50/70 p-3"><p className="text-xs text-slate-500">Fin réelle</p><p className="text-lg font-semibold">{s.actualEnd ? timeOf(s.actualEnd) : '—'}</p></div>
          <div className="rounded-2xl bg-navy-50/70 p-3"><p className="text-xs text-slate-500">Durée</p><p className="text-lg font-semibold">{s.status === 'EN_COURS' && s.actualStart ? <LiveTimer since={s.actualStart.toISOString()} /> : s.actualEnd ? duration(minutesBetween(s.actualStart, s.actualEnd)) : '—'}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {s.status === 'PLANIFIEE' && s.date === today && <ActionButton action={startSeance.bind(null, s.id)} className="btn btn-success flex-1 py-3"><Play size={18} /> Démarrer maintenant</ActionButton>}
          {s.status === 'EN_COURS' && <ActionButton action={endSeance.bind(null, s.id)} confirm="Terminer la séance maintenant ?" className="btn btn-danger flex-1 py-3"><Square size={16} /> Terminer la séance</ActionButton>}
          {!locked && (
            <Modal title="Saisir les heures de la séance" size="sm" trigger={<button className="btn btn-ghost flex-1 py-3"><Clock size={16} /> Saisir les heures</button>}>
              <ActionForm action={setSeanceTimes.bind(null, s.id)} className="space-y-3">
                <p className="text-sm text-slate-600">En cas d&apos;oubli de pointage, indiquez les heures réelles de début et de fin.</p>
                <div className="grid grid-cols-2 gap-2">
                  <label><span className="label">Début</span><input type="time" name="start" className="input" defaultValue={s.actualStart ? timeOf(s.actualStart) : s.startTime} required /></label>
                  <label><span className="label">Fin</span><input type="time" name="end" className="input" defaultValue={s.actualEnd ? timeOf(s.actualEnd) : s.endTime} /></label>
                </div>
                <SubmitButton>Enregistrer</SubmitButton>
              </ActionForm>
            </Modal>
          )}
        </div>
        {locked && lockReason && <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Lock size={14} /> {lockReason}</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section id="appel" className="lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold text-navy-950">Appel — {d.roster.length} élève(s)</h2>
          {d.roster.length === 0 ? <p className="card p-6 text-center text-sm text-slate-500">Aucun élève inscrit dans cette classe.</p> : (
            <AttendanceForm action={saveAttendance.bind(null, s.id)} disabled={locked} rows={d.roster.map((r) => ({ id: r.id, name: `${r.lastName} ${r.firstName}`, status: r.attendance?.status ?? null, comment: r.attendance?.comment ?? null }))} />
          )}
        </section>
        <div className="space-y-5 lg:col-span-2">
          <Card title={<span className="flex items-center gap-2"><BookOpen size={17} className="text-royal-600" /> Contenu de la séance</span>}>
            <ActionForm action={saveSeanceContent.bind(null, s.id)} reset={false} closeOnSuccess={false} className="space-y-3">
              <label className="block"><span className="label">Leçon / thème</span><input name="topic" className="input" defaultValue={s.topic ?? ''} disabled={s.validated} placeholder="Ex. : Les boucles POUR" /></label>
              <label className="block"><span className="label">Résumé</span><textarea name="summary" className="input" defaultValue={s.summary ?? ''} disabled={s.validated} /></label>
              <label className="block"><span className="label">Travail à faire</span><textarea name="homework" className="input" defaultValue={s.homework ?? ''} disabled={s.validated} /></label>
              {!s.validated && <SubmitButton className="btn btn-primary w-full">Enregistrer</SubmitButton>}
            </ActionForm>
          </Card>
          <Card title={<span className="flex items-center gap-2"><FileText size={17} className="text-royal-600" /> Fiche de TD de la séance</span>}>
            {d.docs.length > 0 && <ul className="mb-3 space-y-1.5">{d.docs.map((doc) => <li key={doc.id}><a href={`/api/fichiers/${doc.fileId}`} target="_blank" className="text-sm text-royal-700 hover:underline">{doc.title}</a></li>)}</ul>}
            <ActionForm action={uploadDocument} className="space-y-3">
              <input type="hidden" name="seanceId" value={s.id} />
              <input type="hidden" name="classId" value={s.classId} />
              <input type="hidden" name="subjectId" value={s.subjectId} />
              <label className="block"><span className="label">Titre</span><input name="title" className="input" required defaultValue={`Fiche de TD — ${s.topic ?? d.subjectName}`} /></label>
              <label className="block"><span className="label">Type</span><select name="type" className="input">{Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="block"><span className="label">Fichier PDF (4 Mo max.)</span><input type="file" name="file" accept="application/pdf" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-royal-50 file:px-3 file:py-2 file:text-royal-700" /></label>
              <SubmitButton className="btn btn-primary w-full"><FileUp size={16} /> Déposer la fiche</SubmitButton>
            </ActionForm>
          </Card>
          {asg.rows.some((a) => a.classId === s.classId && a.subjectId === s.subjectId) && (
            <Link href={`/encadreur/notes?classe=${s.classId}&matiere=${s.subjectId}&seance=${s.id}`} className="btn btn-gold w-full"><PenLine size={16} /> Saisir les notes d&apos;une évaluation</Link>
          )}
        </div>
      </div>
    </div>
  );
}
