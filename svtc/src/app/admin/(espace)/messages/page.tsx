import { asc, desc, eq, sql, and } from 'drizzle-orm';
import { MessageSquare } from 'lucide-react';
import { db } from '@/db';
import { messages, messageRecipients, parents, students } from '@/db/schema';
import { getCurrentYear } from '@/lib/settings';
import { refData } from '@/lib/queries';
import { smsConfig } from '@/lib/sms';
import { dateTimeFr, phoneFr } from '@/lib/format';
import { MESSAGE_CATEGORIES } from '@/lib/constants';
import { Badge, Card, Empty, PageHeader } from '@/components/ui';
import { Modal } from '@/components/client/forms';
import { MessageComposer } from '@/components/admin/message-composer';

export const metadata = { title: 'Messages aux parents' };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  const sp = await searchParams;
  const [ref, year] = await Promise.all([refData(), getCurrentYear()]);
  const [ps, kids, history] = await Promise.all([
    db.select().from(parents).orderBy(asc(parents.fullName)),
    db.select({ parentId: students.parentId, first: students.firstName }).from(students).where(and(eq(students.academicYearId, year.id), eq(students.status, 'ACTIF'))),
    db.select({
      m: messages,
      total: sql<number>`count(${messageRecipients.id})::int`,
      read: sql<number>`count(${messageRecipients.readAt})::int`,
      sent: sql<number>`count(*) filter (where ${messageRecipients.smsStatus} = 'ENVOYE')::int`,
      failed: sql<number>`count(*) filter (where ${messageRecipients.smsStatus} = 'ECHEC')::int`,
    }).from(messages).leftJoin(messageRecipients, eq(messageRecipients.messageId, messages.id)).groupBy(messages.id).orderBy(desc(messages.createdAt)).limit(60),
  ]);
  const kidsBy = new Map<number, string[]>();
  for (const k of kids) if (k.parentId) kidsBy.set(k.parentId, [...(kidsBy.get(k.parentId) ?? []), k.first]);
  const recipients = history.length ? await db.select().from(messageRecipients).where(sql`${messageRecipients.messageId} in (${sql.join(history.map((h) => sql`${h.m.id}`), sql`, `)})`) : [];
  const sms = smsConfig();
  return (
    <div className="space-y-6">
      <PageHeader kicker="Communication" title="Messages aux parents" subtitle="Rappels de paiement, réunions, absences, informations : envoi dans l'espace parent, par SMS (passerelle) et par WhatsApp en un clic." />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Nouveau message">
          <MessageComposer classes={ref.classes.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))} parents={ps.map((p) => ({ id: p.id, fullName: p.fullName, phone: p.phone, kids: (kidsBy.get(p.id) ?? []).join(', ') }))} smsReady={sms.configured} defaultParentId={sp.parent ? Number(sp.parent) : undefined} />
        </Card>
        <Card className="xl:col-span-2" title="Historique des envois" pad={false}>
          {history.length === 0 ? <Empty icon={<MessageSquare />} title="Aucun message envoyé" /> : (
            <ul className="max-h-[75vh] divide-y divide-navy-50 overflow-y-auto">
              {history.map(({ m, total, read, sent, failed }) => {
                const cat = MESSAGE_CATEGORIES[m.category as keyof typeof MESSAGE_CATEGORIES] ?? MESSAGE_CATEGORIES.INFO;
                const rec = recipients.filter((r) => r.messageId === m.id);
                return (
                  <li key={m.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-950">{m.subject}</p>
                        <p className="truncate text-xs text-slate-500">{m.audience} · {dateTimeFr(m.createdAt)}</p>
                      </div>
                      <Badge tone={cat.tone}>{cat.label}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge>{total} destinataire(s)</Badge>
                      <Badge tone="green">{read} lu(s)</Badge>
                      {m.channels.includes('SMS') && <Badge tone={failed ? 'amber' : 'blue'}>SMS {sent}/{total}</Badge>}
                      <Modal title={m.subject} subtitle={`${m.audience} · par ${m.senderName}`} size="lg" trigger={<button className="ml-auto text-royal-700 hover:underline">Détails</button>}>
                        <p className="whitespace-pre-line rounded-xl bg-navy-50/60 p-3 text-sm">{rec[0]?.body ?? m.body}</p>
                        <table className="tbl mt-4">
                          <thead><tr><th>Destinataire</th><th>Téléphone</th><th>SMS</th><th>Lu</th></tr></thead>
                          <tbody>{rec.map((r) => <tr key={r.id}><td>{r.name}</td><td>{phoneFr(r.phone)}</td><td><Badge tone={r.smsStatus === 'ENVOYE' ? 'green' : r.smsStatus === 'ECHEC' ? 'red' : 'slate'}>{r.smsStatus === 'NON_DEMANDE' ? '—' : r.smsStatus.toLowerCase()}</Badge></td><td>{r.readAt ? dateTimeFr(r.readAt) : '—'}</td></tr>)}</tbody>
                        </table>
                      </Modal>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
