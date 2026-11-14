import { Plus, Pencil, Trash2, DoorOpen } from 'lucide-react';
import { rooms } from '@/db/schema';
import { refData } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { money, hm } from '@/lib/format';
import { DAYS } from '@/lib/constants';
import { Badge, PageHeader } from '@/components/ui';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { saveRoom, deleteRoom } from '@/app/actions/structure';
import type { SessionDay } from '@/lib/settings-types';

export const metadata = { title: 'Salles' };

type R = typeof rooms.$inferSelect;

function RoomForm({ r, days }: { r?: R; days: SessionDay[] }) {
  return (
    <ActionForm action={saveRoom} className="grid gap-4 sm:grid-cols-2">
      {r && <input type="hidden" name="id" value={r.id} />}
      <label><span className="label">Nom</span><input name="name" className="input" defaultValue={r?.name} required placeholder="Salle C" /></label>
      <label><span className="label">Capacité</span><input name="capacity" type="number" min={1} className="input" defaultValue={r?.capacity ?? 30} /></label>
      {days.map((d) => (
        <label key={d.day}><span className="label">Tarif du {d.label.toLowerCase()} (FCFA / heure)</span>
          <input name={`rate_${d.day}`} type="number" min={0} className="input" defaultValue={r?.rates?.[String(d.day)] ?? (d.day === 0 ? 1000 : 500)} /></label>
      ))}
      <label className="sm:col-span-2"><span className="label">Remarques</span><textarea name="notes" className="input" defaultValue={r?.notes ?? ''} placeholder="Équipements, propriétaire, conditions de location…" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" className="check" defaultChecked={r?.isActive ?? true} /> Salle disponible</label>
      <div className="sm:col-span-2"><SubmitButton>{r ? 'Enregistrer' : 'Ajouter la salle'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function RoomsPage() {
  const [ref, s] = await Promise.all([refData(), getSettings()]);
  const days = s.sessions.days;
  return (
    <div className="space-y-6">
      <PageHeader kicker="Structure" title="Salles de cours" subtitle="Salles louées au Centre Éducatif TYRANNUS et tarifs horaires par jour de séance."
        actions={<Modal title="Nouvelle salle" trigger={<button className="btn btn-primary"><Plus size={17} /> Ajouter une salle</button>}><RoomForm days={days} /></Modal>} />
      <div className="grid gap-4 md:grid-cols-2">
        {ref.rooms.map((r) => (
          <div key={r.id} className="card overflow-hidden animate-fade-up">
            <div className="flex items-center justify-between bg-gradient-to-r from-navy-900 to-royal-700 px-5 py-4 text-white">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><DoorOpen /></span>
                <div><p className="text-lg font-semibold">{r.name}</p><p className="text-xs text-royal-100">{r.capacity} places</p></div></div>
              <div className="flex gap-1">
                <Modal title={`Modifier ${r.name}`} trigger={<button className="rounded-lg p-2 hover:bg-white/10" aria-label="Modifier"><Pencil size={16} /></button>}><RoomForm r={r} days={days} /></Modal>
                <ActionButton action={deleteRoom.bind(null, r.id)} confirm={`Désactiver ${r.name} ?`} className="rounded-lg p-2 hover:bg-white/10" title="Désactiver"><Trash2 size={16} /></ActionButton>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {days.map((d) => (
                <div key={d.day} className="rounded-xl border border-navy-50 bg-navy-50/40 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{DAYS[d.day]} · {hm(d.start)}–{hm(d.end)}</p>
                  <p className="mt-1 text-lg font-semibold text-navy-950">{money(r.rates?.[String(d.day)] ?? 0)} <span className="text-sm font-normal text-slate-500">/ heure</span></p>
                </div>
              ))}
              {r.notes && <p className="text-sm text-slate-500 sm:col-span-2">{r.notes}</p>}
              <div>{r.isActive ? <Badge tone="green">Disponible</Badge> : <Badge>Désactivée</Badge>}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
