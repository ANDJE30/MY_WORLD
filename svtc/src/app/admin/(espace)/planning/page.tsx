import { asc, eq, sql } from 'drizzle-orm';
import { Wand2, Plus, FileDown, CalendarPlus, Pencil, Trash2, TriangleAlert, RefreshCw, CalendarX } from 'lucide-react';
import { db } from '@/db';
import { timeslots, seances } from '@/db/schema';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { refData, tutorName } from '@/lib/queries';
import { findConflicts } from '@/lib/calc';
import { hm, dateFr } from '@/lib/format';
import { DAYS } from '@/lib/constants';
import { todayISO, periodBounds, currentPeriod, toMinutes } from '@/lib/time';
import { Card, Dot, Empty, PageHeader, Badge } from '@/components/ui';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { autoGeneratePlanning, saveTimeslot, deleteTimeslot, generateSeances, syncFutureSeances, cancelDay } from '@/app/actions/pedagogy';

export const metadata = { title: 'Planning' };

type TS = typeof timeslots.$inferSelect;
type Ref = Awaited<ReturnType<typeof refData>>;

function SlotForm({ t, rd: ref, days, defaults }: { t?: TS; rd: Ref; days: { day: number; label: string }[]; defaults?: Partial<TS> }) {
  const v = { ...defaults, ...t };
  return (
    <ActionForm action={saveTimeslot} className="grid gap-4 sm:grid-cols-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <label><span className="label">Jour</span>
        <select name="dayOfWeek" className="input" defaultValue={v.dayOfWeek ?? days[0]?.day}>{days.map((d) => <option key={d.day} value={d.day}>{d.label}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Début</span><input type="time" name="startTime" className="input" defaultValue={v.startTime} required /></label>
        <label><span className="label">Fin</span><input type="time" name="endTime" className="input" defaultValue={v.endTime} required /></label>
      </div>
      <label><span className="label">Classe</span><select name="classId" className="input" defaultValue={v.classId ?? ''} required><option value="">—</option>{ref.classes.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label><span className="label">Matière</span><select name="subjectId" className="input" defaultValue={v.subjectId ?? ''} required><option value="">—</option>{ref.subjects.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label><span className="label">Encadreur</span><select name="tutorId" className="input" defaultValue={v.tutorId ?? ''}><option value="">— Non attribué —</option>{ref.tutors.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{tutorName(x)}</option>)}</select></label>
      <label><span className="label">Salle</span><select name="roomId" className="input" defaultValue={v.roomId ?? ''}><option value="">—</option>{ref.rooms.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <p className="hint sm:col-span-2">Le serveur refuse tout chevauchement pour une même classe, un même encadreur ou une même salle.</p>
      <div className="sm:col-span-2"><SubmitButton>{t ? 'Enregistrer' : 'Ajouter le créneau'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function PlanningPage() {
  const [year, s, ref] = await Promise.all([getCurrentYear(), getSettings(), refData()]);
  const [list, [range]] = await Promise.all([
    db.select().from(timeslots).where(eq(timeslots.academicYearId, year.id)).orderBy(asc(timeslots.dayOfWeek), asc(timeslots.startTime)),
    db.select({ min: sql<string | null>`min(${seances.date})`, max: sql<string | null>`max(${seances.date})`, n: sql<number>`count(*)::int` }).from(seances).where(eq(seances.academicYearId, year.id)),
  ]);
  const conflicts = findConflicts(list);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a, c.b]));
  const days = s.sessions.days;
  const today = todayISO();
  const { end: monthEnd } = periodBounds(currentPeriod());
  const activeRooms = ref.rooms.filter((r) => r.isActive || list.some((t) => t.roomId === r.id));

  const cell = (t: TS) => {
    const c = ref.classById.get(t.classId);
    const sub = ref.subjectById.get(t.subjectId);
    return (
      <div key={t.id} className={`group relative rounded-xl border p-2.5 text-left transition hover:shadow-md ${conflictIds.has(t.id) ? 'border-rose-300 bg-rose-50' : 'border-navy-100 bg-white'}`} style={{ borderLeft: `4px solid ${sub?.color ?? '#2453d6'}` }}>
        <div className="flex items-start justify-between gap-1">
          <p className="text-[13px] font-semibold text-navy-950">{c?.name ?? '?'}</p>
          <div className="flex opacity-60 group-hover:opacity-100">
            <Modal title="Modifier le créneau" size="lg" trigger={<button className="rounded p-1 hover:bg-navy-50" aria-label="Modifier"><Pencil size={13} /></button>}><SlotForm t={t} rd={ref} days={days} /></Modal>
            <ActionButton action={deleteTimeslot.bind(null, t.id)} confirm="Supprimer ce créneau du planning ?" className="rounded p-1 hover:bg-rose-50 hover:text-rose-600" title="Supprimer"><Trash2 size={13} /></ActionButton>
          </div>
        </div>
        <p className="truncate text-xs text-slate-600">{sub?.name}</p>
        <p className="mt-1 truncate text-[11.5px] text-royal-700">{t.tutorId ? tutorName(ref.tutorById.get(t.tutorId)) : 'Encadreur ?'}</p>
        <p className="text-[11px] text-slate-400">{hm(t.startTime)}–{hm(t.endTime)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader kicker="Pédagogie" title="Planning des séances" subtitle={`Planning hebdomadaire ${year.label} · ${list.length} créneau(x) · ${range?.n ?? 0} séance(s) datée(s)${range?.min ? ` du ${dateFr(range.min)} au ${dateFr(range.max)}` : ''}`}
        actions={<>
          <ActionButton action={autoGeneratePlanning} className="btn btn-gold" confirm="Générer automatiquement le planning à partir des attributions ? Le planning hebdomadaire actuel sera remplacé (les séances déjà datées ne sont pas modifiées)."><Wand2 size={17} /> Générer automatiquement</ActionButton>
          <Modal title="Ajouter un créneau" size="lg" trigger={<button className="btn btn-ghost"><Plus size={17} /> Créneau</button>}><SlotForm rd={ref} days={days} /></Modal>
        </>} />

      {conflicts.length > 0 && (
        <div className="card flex items-start gap-3 border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><TriangleAlert className="shrink-0" /> {conflicts.length} conflit(s) détecté(s) (cases en rouge) : une classe, un encadreur ou une salle est utilisé deux fois au même moment.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="1. Générer les séances datées" subtitle="Crée les séances réelles (pointage, appel, heures) à partir du planning hebdomadaire.">
          <ActionForm action={generateSeances} reset={false} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label><span className="label">Du</span><input type="date" name="start" className="input" defaultValue={today} required /></label>
              <label><span className="label">Au</span><input type="date" name="end" className="input" defaultValue={monthEnd} required /></label>
            </div>
            <SubmitButton className="btn btn-primary w-full"><CalendarPlus size={16} /> Générer les séances</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="2. Exporter le planning (PDF)" subtitle="Planning de travail par séance et par classe, au format du papier en-tête SVTC.">
          <div className="space-y-2">
            <a href="/api/pdf/planning" target="_blank" className="btn btn-navy w-full"><FileDown size={16} /> Planning général (toutes classes)</a>
            <form action="/api/pdf/planning" target="_blank" className="flex flex-wrap gap-2">
              <select name="classe" className="input min-w-0 flex-1" required defaultValue=""><option value="" disabled>Planning d&apos;une classe…</option>{ref.classes.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <button className="btn btn-ghost">PDF</button>
            </form>
            <form action="/api/pdf/seances" target="_blank" className="flex flex-wrap gap-2">
              <input type="month" name="mois" className="input min-w-0 flex-1" defaultValue={currentPeriod()} />
              <button className="btn btn-ghost">Séances du mois</button>
            </form>
          </div>
        </Card>
        <Card title="3. Ajustements" subtitle="Après une modification du planning, ou un jour férié.">
          <div className="space-y-2">
            <Modal title="Mettre à jour les séances futures" size="sm" trigger={<button className="btn btn-ghost w-full"><RefreshCw size={16} /> Appliquer le planning aux séances futures</button>}>
              <ActionForm action={syncFutureSeances} className="space-y-3">
                <p className="text-sm text-slate-600">Les séances planifiées (non commencées, sans appel) à partir de cette date sont recréées selon le nouveau planning.</p>
                <label className="block"><span className="label">À partir du</span><input type="date" name="from" className="input" defaultValue={today} required /></label>
                <SubmitButton>Mettre à jour</SubmitButton>
              </ActionForm>
            </Modal>
            <Modal title="Annuler une journée (jour férié, examen…)" size="sm" trigger={<button className="btn btn-ghost w-full"><CalendarX size={16} /> Annuler une journée de séances</button>}>
              <ActionForm action={cancelDay} className="space-y-3">
                <label className="block"><span className="label">Date</span><input type="date" name="date" className="input" required /></label>
                <label className="block"><span className="label">Motif</span><input name="reason" className="input" required placeholder="Ex. : Fête nationale du 20 mai" /></label>
                <SubmitButton className="btn btn-danger">Annuler les séances</SubmitButton>
              </ActionForm>
            </Modal>
          </div>
        </Card>
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty icon={<Wand2 />} title="Planning vide" text="Renseignez les attributions (qui enseigne quoi dans chaque classe) puis cliquez sur « Générer automatiquement »." /></div>
      ) : (
        days.map((d) => {
          const daySlots = list.filter((t) => t.dayOfWeek === d.day);
          const starts = [...new Set([...d.slots.map((x) => `${x.start}|${x.end}`), ...daySlots.map((t) => `${t.startTime}|${t.endTime}`)])].sort((a, b) => toMinutes(a.split('|')[0]) - toMinutes(b.split('|')[0]));
          return (
            <Card key={d.day} title={`${DAYS[d.day]} · ${hm(d.start)} – ${hm(d.end)}`} subtitle={`${daySlots.length} créneau(x)`} pad={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-separate border-spacing-2">
                  <thead>
                    <tr>
                      <th className="w-28 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Horaire</th>
                      {activeRooms.map((r) => <th key={r.id} className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{r.name}</th>)}
                      <th className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Sans salle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {starts.map((k) => {
                      const [st, en] = k.split('|');
                      const here = daySlots.filter((t) => t.startTime === st && t.endTime === en);
                      return (
                        <tr key={k} className="align-top">
                          <td className="rounded-xl bg-navy-950 px-3 py-2 text-sm font-semibold text-white">{hm(st)}<br /><span className="text-xs font-normal text-navy-200">{hm(en)}</span></td>
                          {activeRooms.map((r) => (
                            <td key={r.id} className="rounded-xl bg-navy-50/50 p-1.5">
                              <div className="space-y-1.5">
                                {here.filter((t) => t.roomId === r.id).map(cell)}
                                <Modal title={`Nouveau créneau — ${DAYS[d.day]} ${hm(st)}`} size="lg" trigger={<button className="w-full rounded-lg border border-dashed border-navy-200 py-1.5 text-xs text-slate-400 hover:border-royal-400 hover:text-royal-600">+ Ajouter</button>}>
                                  <SlotForm rd={ref} days={days} defaults={{ dayOfWeek: d.day, startTime: st, endTime: en, roomId: r.id }} />
                                </Modal>
                              </div>
                            </td>
                          ))}
                          <td className="rounded-xl bg-slate-50 p-1.5"><div className="space-y-1.5">{here.filter((t) => !t.roomId).map(cell)}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}

      {list.length > 0 && (
        <Card title="Vue par classe" pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Classe</th>{days.map((d) => <th key={d.day}>{d.label}</th>)}</tr></thead>
              <tbody>
                {ref.classes.filter((c) => c.isActive).map((c) => (
                  <tr key={c.id}>
                    <td><span className="inline-flex items-center gap-2 font-medium"><Dot color={c.color} />{c.name}</span></td>
                    {days.map((d) => (
                      <td key={d.day}>
                        <div className="flex flex-wrap gap-1">
                          {list.filter((t) => t.classId === c.id && t.dayOfWeek === d.day).map((t) => (
                            <Badge key={t.id} tone="blue">{hm(t.startTime)} {ref.subjectById.get(t.subjectId)?.code} · {ref.roomById.get(t.roomId ?? 0)?.name ?? '—'}</Badge>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
