import Link from 'next/link';
import { and, eq, gte, lte, lt, type SQL } from 'drizzle-orm';
import { CheckCheck, Eye, Ban, Undo2, Trash2, CalendarPlus, Search } from 'lucide-react';
import { seances } from '@/db/schema';
import { refData, seancesWithNames, tutorName } from '@/lib/queries';
import { doneMinutes, plannedMinutes } from '@/lib/calc';
import { getSettings } from '@/lib/settings';
import { dateShort, duration, hm, timeOf } from '@/lib/format';
import { SEANCE_STATUS } from '@/lib/constants';
import { addDays, todayISO, weekStart } from '@/lib/time';
import { Badge, Card, Empty, PageHeader, TableWrap, Dot } from '@/components/ui';
import { ActionButton, ActionForm, AutoSubmitSelect, Modal, SubmitButton } from '@/components/client/forms';
import { validateSeances, cancelSeance, restoreSeance, deleteSeance, addSeance } from '@/app/actions/pedagogy';

export const metadata = { title: 'Séances' };

export default async function SeancesPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string; classe?: string; encadreur?: string; statut?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const filterStatus = sp.statut ?? '';
  const wide = filterStatus === 'AVALIDER' || filterStatus === 'NONPOINTEE';
  const from = sp.du ?? (wide ? addDays(today, -120) : weekStart(today));
  const to = sp.au ?? (wide ? today : addDays(weekStart(today), 6));
  const [ref, s] = await Promise.all([refData(), getSettings()]);
  const conds: SQL[] = [gte(seances.date, from), lte(seances.date, to)];
  if (sp.classe) conds.push(eq(seances.classId, Number(sp.classe)));
  if (sp.encadreur) conds.push(eq(seances.tutorId, Number(sp.encadreur)));
  if (filterStatus === 'AVALIDER') conds.push(eq(seances.status, 'TERMINEE'), eq(seances.validated, false));
  else if (filterStatus === 'NONPOINTEE') conds.push(eq(seances.status, 'PLANIFIEE'), lt(seances.date, today));
  else if (filterStatus) conds.push(eq(seances.status, filterStatus as 'PLANIFIEE'));
  const rows = await seancesWithNames(and(...conds)!);
  const toValidate = rows.filter((r) => r.s.status === 'TERMINEE' && !r.s.validated).map((r) => r.s.id);
  const totalDone = rows.reduce((a, r) => a + doneMinutes(r.s, s.salary.countBasis), 0);
  const totalPlanned = rows.filter((r) => r.s.status !== 'ANNULEE').reduce((a, r) => a + plannedMinutes(r.s), 0);

  return (
    <div className="space-y-6">
      <PageHeader kicker="Pédagogie" title="Séances" subtitle={`${rows.length} séance(s) · ${duration(totalDone)} effectuées sur ${duration(totalPlanned)} prévues`}
        actions={<>
          {toValidate.length > 0 && <ActionButton action={validateSeances.bind(null, toValidate)} className="btn btn-success" confirm={`Valider les heures de ${toValidate.length} séance(s) terminée(s) ?`}><CheckCheck size={17} /> Valider ({toValidate.length})</ActionButton>}
          <Modal title="Ajouter une séance (rattrapage, séance supplémentaire)" size="lg" trigger={<button className="btn btn-ghost"><CalendarPlus size={17} /> Séance ponctuelle</button>}>
            <ActionForm action={addSeance} className="grid gap-4 sm:grid-cols-2">
              <label><span className="label">Date</span><input type="date" name="date" className="input" required defaultValue={today} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="label">Début</span><input type="time" name="startTime" className="input" required /></label>
                <label><span className="label">Fin</span><input type="time" name="endTime" className="input" required /></label>
              </div>
              <label><span className="label">Classe</span><select name="classId" className="input" required defaultValue="">{[<option key="" value="">—</option>, ...ref.classes.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)]}</select></label>
              <label><span className="label">Matière</span><select name="subjectId" className="input" required defaultValue="">{[<option key="" value="">—</option>, ...ref.subjects.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)]}</select></label>
              <label><span className="label">Encadreur</span><select name="tutorId" className="input" defaultValue="">{[<option key="" value="">—</option>, ...ref.tutors.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{tutorName(t)}</option>)]}</select></label>
              <label><span className="label">Salle</span><select name="roomId" className="input" defaultValue="">{[<option key="" value="">—</option>, ...ref.rooms.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)]}</select></label>
              <label className="sm:col-span-2"><span className="label">Objet</span><input name="topic" className="input" placeholder="Séance de rattrapage" /></label>
              <div className="sm:col-span-2"><SubmitButton>Ajouter</SubmitButton></div>
            </ActionForm>
          </Modal>
        </>} />

      <Card pad={false}>
        <form method="get" className="flex flex-wrap items-end gap-2 border-b border-navy-50 p-3 sm:p-4">
          <label><span className="label">Du</span><input type="date" name="du" defaultValue={from} className="input" /></label>
          <label><span className="label">Au</span><input type="date" name="au" defaultValue={to} className="input" /></label>
          <AutoSubmitSelect name="classe" defaultValue={sp.classe ?? ''} className="input w-auto"><option value="">Toutes les classes</option>{ref.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AutoSubmitSelect>
          <AutoSubmitSelect name="encadreur" defaultValue={sp.encadreur ?? ''} className="input w-auto"><option value="">Tous les encadreurs</option>{ref.tutors.map((t) => <option key={t.id} value={t.id}>{tutorName(t)}</option>)}</AutoSubmitSelect>
          <AutoSubmitSelect name="statut" defaultValue={filterStatus} className="input w-auto">
            <option value="">Tous les statuts</option>
            {Object.entries(SEANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            <option value="AVALIDER">Terminées à valider</option>
            <option value="NONPOINTEE">Passées non pointées</option>
          </AutoSubmitSelect>
          <button className="btn btn-navy"><Search size={16} /> Afficher</button>
        </form>
        {rows.length === 0 ? <Empty title="Aucune séance sur cette période" text="Générez les séances depuis le planning." action={<Link href="/admin/planning" className="btn btn-primary btn-sm">Planning</Link>} /> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Classe · matière</th><th className="hidden md:table-cell">Encadreur</th><th className="hidden lg:table-cell">Salle</th><th>Réalisé</th><th>Statut</th><th className="w-28" /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const st = SEANCE_STATUS[r.s.status];
                  const late = r.s.status === 'PLANIFIEE' && r.s.date < today;
                  return (
                    <tr key={r.s.id}>
                      <td><p className="font-medium first-up">{dateShort(r.s.date)}</p><p className="text-xs text-slate-500">{hm(r.s.startTime)}–{hm(r.s.endTime)}</p></td>
                      <td><p className="flex items-center gap-1.5 font-medium"><Dot color={r.classColor} />{r.className}</p><p className="text-xs text-slate-500">{r.subjectName}</p></td>
                      <td className="hidden md:table-cell">{r.tutorFirst ? `${r.tutorFirst} ${r.tutorLast}` : <span className="text-slate-400">—</span>}</td>
                      <td className="hidden lg:table-cell">{r.roomName ?? '—'}</td>
                      <td className="text-sm">{r.s.actualStart ? <>{timeOf(r.s.actualStart)} → {r.s.actualEnd ? timeOf(r.s.actualEnd) : '…'}<p className="text-xs text-slate-500">{r.s.actualEnd ? duration(doneMinutes(r.s, 'ACTUAL')) : 'en cours'}</p></> : <span className="text-slate-400">—</span>}</td>
                      <td className="space-y-1">
                        <Badge tone={late ? 'red' : st.tone}>{late ? 'Non pointée' : st.label}</Badge>
                        {r.s.status === 'TERMINEE' && (r.s.validated ? <Badge tone="green">Validée</Badge> : <Badge tone="amber">À valider</Badge>)}
                        {r.s.cancelReason && <p className="max-w-[160px] truncate text-[11px] text-slate-500" title={r.s.cancelReason}>{r.s.cancelReason}</p>}
                      </td>
                      <td>
                        <div className="flex justify-end gap-0.5">
                          <Link href={`/admin/seances/${r.s.id}`} className="btn-icon" title="Détails"><Eye size={16} /></Link>
                          {r.s.status === 'TERMINEE' && !r.s.validated && <ActionButton action={validateSeances.bind(null, [r.s.id])} className="btn-icon text-emerald-600" title="Valider"><CheckCheck size={16} /></ActionButton>}
                          {r.s.status === 'ANNULEE' ? (
                            <ActionButton action={restoreSeance.bind(null, r.s.id)} className="btn-icon" title="Rétablir"><Undo2 size={16} /></ActionButton>
                          ) : r.s.status === 'PLANIFIEE' && (
                            <Modal title="Annuler la séance" size="sm" trigger={<button className="btn-icon hover:text-amber-600" aria-label="Annuler"><Ban size={16} /></button>}>
                              <ActionForm action={cancelSeance.bind(null, r.s.id)} className="space-y-3">
                                <label className="block"><span className="label">Motif</span><input name="reason" className="input" required placeholder="Encadreur absent, jour férié…" /></label>
                                <SubmitButton className="btn btn-danger">Annuler la séance</SubmitButton>
                              </ActionForm>
                            </Modal>
                          )}
                          {r.s.status === 'PLANIFIEE' && <ActionButton action={deleteSeance.bind(null, r.s.id)} confirm="Supprimer définitivement cette séance ?" className="btn-icon hover:text-rose-600" title="Supprimer"><Trash2 size={16} /></ActionButton>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
