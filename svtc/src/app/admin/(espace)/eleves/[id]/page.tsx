import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { ArrowLeft, FileDown, Phone, Wallet, Send, School as SchoolIcon, Cake, CalendarDays, MessageCircle } from 'lucide-react';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { balances, studentProgress } from '@/lib/queries';
import { appreciation } from '@/lib/calc';
import { dateFr, dateTimeFr, money, periodLabel, phoneFr, phoneIntl, score, pct, dateShort } from '@/lib/format';
import { ATTENDANCE_STATUS, PAYMENT_METHODS, PAYMENT_TYPES, STUDENT_STATUS } from '@/lib/constants';
import { Avatar, Badge, Card, Empty, PageHeader, Progress, Stat, TableWrap, avgTone, rateTone } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { ActionButton, Modal } from '@/components/client/forms';
import { PaymentForm } from '@/components/admin/payment-form';
import { sendProgressReport } from '@/app/actions/messaging';

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const year = await getCurrentYear();
  const [b] = await balances(year.id, [id]);
  if (!b) notFound();
  const [prog, pays] = await Promise.all([
    studentProgress(id),
    db.select().from(payments).where(eq(payments.studentId, id)).orderBy(desc(payments.paidAt)),
  ]);
  const st = STUDENT_STATUS[b.status as keyof typeof STUDENT_STATUS] ?? STUDENT_STATUS.ACTIF;
  const name = `${b.lastName} ${b.firstName}`;

  return (
    <div className="space-y-6">
      <Link href="/admin/eleves" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft size={16} /> Retour aux élèves</Link>
      <PageHeader
        kicker={`${b.matricule} · ${b.className}`}
        title={name}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone={st.tone}>{st.label}</Badge><span>Inscrit(e) le {dateFr(b.enrolledAt)}</span>{b.discountPct > 0 && <Badge tone="gold">Réduction {b.discountPct} %</Badge>}</span>}
        actions={<>
          <a href={`/api/pdf/suivi/${id}`} target="_blank" className="btn btn-ghost"><FileDown size={17} /> État de suivi PDF</a>
          {b.parentId && <ActionButton action={sendProgressReport.bind(null, id)} className="btn btn-soft" confirm={`Envoyer l'état de suivi de ${b.firstName} à ${b.parentName} ?`}><Send size={16} /> Envoyer au parent</ActionButton>}
          <Modal title={`Encaisser — ${name}`} trigger={<button className="btn btn-gold"><Wallet size={17} /> Encaisser</button>}>
            <PaymentForm students={[{ id, label: `${name} (${b.classCode})`, balance: b.balance, monthlyNet: b.monthlyNet }]} defaultStudentId={id} />
          </Modal>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Assiduité" value={pct(prog.stats.rate)} hint={`${prog.stats.ABSENT} absence(s) · ${prog.stats.RETARD} retard(s)`} tone="green" />
        <Stat label="Moyenne générale" value={prog.average === null ? '—' : `${score(prog.average)}/20`} hint={appreciation(prog.average)} tone="blue" />
        <Stat label="Payé (année)" value={money(b.paid)} hint={`Total annuel : ${money(b.dueTotal)}`} tone="gold" />
        <Stat label="Solde à ce jour" value={b.balance > 0 ? money(b.balance) : 'À jour'} hint={b.balance < 0 ? `Avance : ${money(-b.balance)}` : `Reste sur l'année : ${money(Math.max(0, b.remainingYear))}`} tone={b.balance > 0 ? 'red' : 'green'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Identité & famille">
          <div className="flex items-center gap-3">
            <Avatar name={`${b.firstName} ${b.lastName}`} color={b.classColor} size={52} />
            <div><p className="font-semibold text-navy-950">{name}</p><p className="text-sm text-slate-500">{b.gender === 'F' ? 'Fille' : 'Garçon'} · {b.className}</p></div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-navy-800">
            {b.birthDate && <li className="flex gap-2"><Cake size={16} className="text-slate-400" /> Né(e) le {dateFr(b.birthDate)}</li>}
            {b.school && <li className="flex gap-2"><SchoolIcon size={16} className="text-slate-400" /> {b.school}</li>}
            {b.phone && <li className="flex gap-2"><Phone size={16} className="text-slate-400" /> {phoneFr(b.phone)}</li>}
          </ul>
          <div className="mt-4 rounded-xl border border-navy-50 bg-navy-50/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parent / tuteur</p>
            {b.parentName ? (
              <>
                <p className="mt-1 font-medium text-navy-950">{b.parentName}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`tel:${phoneIntl(b.parentPhone)}`} className="btn btn-ghost btn-sm"><Phone size={14} /> {phoneFr(b.parentPhone)}</a>
                  <a href={`https://wa.me/${phoneIntl(b.parentPhone).replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"><MessageCircle size={14} /> WhatsApp</a>
                </div>
                {!b.parentUserId && <p className="mt-2 text-xs text-amber-700">Ce parent n&apos;a pas encore de compte d&apos;accès — <Link href="/admin/parents" className="underline">le créer</Link>.</p>}
              </>
            ) : <p className="mt-1 text-sm text-amber-700">Aucun parent rattaché.</p>}
          </div>
          {b.notes && <p className="mt-3 text-sm text-slate-600">{b.notes}</p>}
        </Card>

        <Card className="xl:col-span-2" title="Situation financière" subtitle={`Mensualité : ${money(b.monthlyNet)} · Inscription : ${money(b.registrationFee)}`}>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className={`rounded-xl px-3 py-2 text-xs font-medium ${b.alloc.registration.paid >= b.alloc.registration.due ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>Inscription · {money(b.alloc.registration.paid)} / {money(b.alloc.registration.due)}</span>
            {b.alloc.months.map((m) => (
              <span key={m.period} title={`${money(m.paid)} / ${money(m.due)}`} className={`rounded-xl px-3 py-2 text-xs font-medium first-up ${m.state === 'PAYE' ? 'bg-emerald-50 text-emerald-700' : m.state === 'PARTIEL' ? 'bg-amber-50 text-amber-800' : b.dueMonths.includes(m.period) ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
                {periodLabel(m.period)}
              </span>
            ))}
          </div>
          {pays.length === 0 ? <Empty title="Aucun paiement" /> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th>Reçu</th><th>Date</th><th>Nature</th><th>Mode</th><th className="text-right">Montant</th><th /></tr></thead>
                <tbody>
                  {pays.map((p) => (
                    <tr key={p.id} className={p.cancelled ? 'opacity-50 line-through' : ''}>
                      <td className="font-mono text-xs">{p.receiptNo}</td>
                      <td>{dateTimeFr(p.paidAt)}</td>
                      <td>{PAYMENT_TYPES[p.type as keyof typeof PAYMENT_TYPES] ?? p.type}</td>
                      <td>{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}</td>
                      <td className="text-right font-semibold">{money(p.amount)}</td>
                      <td>{!p.cancelled && <a className="btn btn-ghost btn-sm" target="_blank" href={`/api/pdf/recu/${p.id}`}>Reçu</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Évolution des notes" subtitle="Notes ramenées sur 20">
          <LineChart points={prog.grades.filter((g) => !g.absent && g.score !== null).map((g) => ({ label: dateShort(g.date).replace(/^\S+\s/, ''), value: Math.round(((g.score as number) / g.maxScore) * 2000) / 100 }))} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {prog.subjectsAvg.map((s) => (
              <div key={s.name} className="rounded-xl border border-navy-50 p-3">
                <p className="truncate text-sm text-navy-800">{s.name}</p>
                <div className="mt-1 flex items-center justify-between"><Badge tone={avgTone(s.average)}>{s.average === null ? '—' : `${score(s.average)}/20`}</Badge><span className="text-xs text-slate-500">{s.count} note(s)</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Assiduité">
          <div className="mb-3"><Progress value={prog.stats.rate} tone={rateTone(prog.stats.rate) === 'blue' ? 'blue' : rateTone(prog.stats.rate)} /></div>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto text-sm">
            {prog.attendance.length === 0 && <li className="text-slate-500">Aucun appel enregistré.</li>}
            {[...prog.attendance].reverse().map((a, i) => {
              const s = ATTENDANCE_STATUS[a.status];
              return (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-50/50">
                  <span className="flex items-center gap-2 text-navy-800"><CalendarDays size={14} className="text-slate-400" />{dateFr(a.date)} · <span className="truncate text-slate-500">{a.subjectName}</span></span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
