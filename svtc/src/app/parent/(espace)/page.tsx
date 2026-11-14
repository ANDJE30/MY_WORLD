import Link from 'next/link';
import { and, eq, gte } from 'drizzle-orm';
import { CalendarDays, Clock, User, DoorOpen, FileDown, Wallet, ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { seances } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { selectedKid } from '@/lib/parent';
import { balances, seancesWithNames, studentProgress } from '@/lib/queries';
import { appreciation } from '@/lib/calc';
import { inboxFor } from '@/lib/inbox';
import { todayISO } from '@/lib/time';
import { dateLong, dateTimeFr, hm, money, pct, phoneFr, score } from '@/lib/format';
import { Avatar, Empty, Progress, rateTone } from '@/components/ui';

export const metadata = { title: 'Espace parents' };

export default async function ParentHome({ searchParams }: { searchParams: Promise<{ enfant?: string }> }) {
  const me = await requireRole('PARENT');
  const sp = await searchParams;
  const { kid } = await selectedKid(me.parentId!, sp.enfant);
  const s = await getSettings();
  if (!kid) return <div className="card"><Empty title="Aucun enfant inscrit cette année" text={`Contactez le centre au ${phoneFr(s.identity.phones[0])}.`} /></div>;
  const year = await getCurrentYear();
  const [next, prog, [bal], inbox] = await Promise.all([
    seancesWithNames(and(eq(seances.classId, kid.classId), gte(seances.date, todayISO()), eq(seances.status, 'PLANIFIEE'))!),
    studentProgress(kid.id),
    balances(year.id, [kid.id]),
    inboxFor(me.id),
  ]);
  const q = `?enfant=${kid.id}`;
  const n = next[0];
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-950 p-5 text-white shadow-[var(--shadow-lift)] sm:p-7">
        <div className="absolute inset-0 circuit-bg opacity-60" />
        <div className="relative flex flex-wrap items-center gap-4">
          <Avatar name={`${kid.firstName} ${kid.lastName}`} color={kid.classColor} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gold-300">{kid.className}{kid.school ? ` · ${kid.school}` : ''}</p>
            <h1 className="text-2xl font-semibold">{kid.firstName} {kid.lastName}</h1>
            <p className="mt-1 text-sm text-navy-200">{appreciation(prog.average)}</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"><p className="text-[11px] uppercase tracking-wide text-navy-200">Assiduité</p><p className="text-xl font-semibold">{pct(prog.stats.rate)}</p></div>
          <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"><p className="text-[11px] uppercase tracking-wide text-navy-200">Moyenne</p><p className="text-xl font-semibold">{prog.average === null ? '—' : score(prog.average)}<span className="text-sm text-navy-200">/20</span></p></div>
          <div className="rounded-2xl bg-gold-400 p-3 text-navy-950"><p className="text-[11px] uppercase tracking-wide">À régler</p><p className="text-xl font-semibold">{bal && bal.balance > 0 ? money(bal.balance) : 'À jour'}</p></div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gold-100 bg-gold-50/60 px-4 py-3"><h2 className="font-semibold text-navy-950">Prochaine séance</h2><Link href={`/parent/planning${q}`} className="text-sm font-medium text-gold-700">Tout le planning</Link></div>
        {n ? (
          <Link href={`/parent/seances/${n.s.id}${q}`} className="grid gap-3 p-4 sm:grid-cols-2">
            <p className="flex items-center gap-3 text-navy-900"><CalendarDays className="text-gold-600" /> <span className="first-up">{dateLong(n.s.date)}</span></p>
            <p className="flex items-center gap-3 text-navy-900"><Clock className="text-gold-600" /> {hm(n.s.startTime)} – {hm(n.s.endTime)}</p>
            <p className="flex items-center gap-3 text-navy-900"><span className="h-5 w-5 rounded-full" style={{ background: n.subjectColor }} /> {n.subjectName}</p>
            <p className="flex items-center gap-3 text-navy-900"><User className="text-gold-600" /> {n.tutorFirst ? `${n.tutorFirst} ${n.tutorLast}` : 'Encadreur à confirmer'}</p>
            <p className="flex items-center gap-3 text-navy-900 sm:col-span-2"><DoorOpen className="text-gold-600" /> {n.roomName ?? 'Salle à confirmer'} — {s.identity.host}, {s.identity.address}</p>
          </Link>
        ) : <p className="p-5 text-sm text-slate-500">Aucune séance planifiée pour le moment.</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <a href={`/api/pdf/suivi/${kid.id}`} target="_blank" className="card flex items-center gap-3 p-4 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"><FileDown className="text-royal-600" /><span className="flex-1 font-medium text-navy-950">État de suivi (PDF)</span><ArrowRight size={16} className="text-slate-400" /></a>
        <Link href={`/parent/paiements${q}`} className="card flex items-center gap-3 p-4 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"><Wallet className="text-gold-600" /><span className="flex-1 font-medium text-navy-950">Paiements et reçus</span><ArrowRight size={16} className="text-slate-400" /></Link>
        <a href={`tel:+237${s.identity.phones[0]}`} className="card flex items-center gap-3 p-4 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"><Phone className="text-emerald-600" /><span className="flex-1 font-medium text-navy-950">Appeler le centre</span><span className="text-sm text-slate-500">{phoneFr(s.identity.phones[0])}</span></a>
      </section>

      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-navy-950">Assiduité</h2><span className="text-sm text-slate-500">{prog.stats.ABSENT} absence(s) · {prog.stats.RETARD} retard(s)</span></div>
        <Progress value={prog.stats.rate} tone={rateTone(prog.stats.rate) === 'blue' ? 'blue' : rateTone(prog.stats.rate)} />
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gold-100 px-4 py-3"><h2 className="font-semibold text-navy-950">Derniers messages</h2><Link href={`/parent/messages${q}`} className="text-sm font-medium text-gold-700">Tous les messages</Link></div>
        {inbox.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucun message.</p> : (
          <ul className="divide-y divide-gold-100">
            {inbox.slice(0, 3).map((m) => (
              <li key={m.id}><Link href={`/parent/messages${q}`} className="flex items-start gap-3 px-4 py-3">
                <MessageCircle size={18} className={m.readAt ? 'mt-0.5 text-slate-300' : 'mt-0.5 text-gold-600'} />
                <div className="min-w-0 flex-1"><p className={`truncate text-sm ${m.readAt ? 'text-navy-800' : 'font-semibold text-navy-950'}`}>{m.subject}</p><p className="truncate text-xs text-slate-500">{dateTimeFr(m.createdAt)} · {m.body}</p></div>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
