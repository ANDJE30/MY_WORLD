import { CheckCheck, FileDown, MailOpen, Mail } from 'lucide-react';
import { dateTimeFr } from '@/lib/format';
import { MESSAGE_CATEGORIES } from '@/lib/constants';
import { Badge, Empty } from '@/components/ui';
import { ActionButton } from '@/components/client/forms';
import { markRead, markAllRead } from '@/app/actions/messaging';

export type InboxItem = { id: number; readAt: Date | null; body: string; createdAt: Date; subject: string; category: string; senderName: string; attachmentKind: string | null; attachmentRef: string | null };

export function Inbox({ items, accent = 'royal' }: { items: InboxItem[]; accent?: 'royal' | 'gold' }) {
  const unread = items.filter((i) => !i.readAt).length;
  if (items.length === 0) return <div className="card"><Empty icon={<Mail />} title="Aucun message" text="Les messages du centre apparaîtront ici." /></div>;
  return (
    <div className="space-y-3">
      {unread > 0 && <div className="flex justify-end"><ActionButton action={markAllRead} className="btn btn-ghost btn-sm"><CheckCheck size={15} /> Tout marquer comme lu</ActionButton></div>}
      {items.map((m) => {
        const cat = MESSAGE_CATEGORIES[m.category as keyof typeof MESSAGE_CATEGORIES] ?? MESSAGE_CATEGORIES.INFO;
        return (
          <article key={m.id} className={`card p-4 ${!m.readAt ? (accent === 'gold' ? 'border-l-4 border-l-gold-400' : 'border-l-4 border-l-royal-500') : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-navy-950">{m.readAt ? <MailOpen size={16} className="text-slate-400" /> : <Mail size={16} className="text-royal-600" />}{m.subject}</p>
                <p className="text-xs text-slate-500">{m.senderName} · {dateTimeFr(m.createdAt)}</p>
              </div>
              <Badge tone={cat.tone}>{cat.label}</Badge>
            </div>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-navy-900">{m.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {m.attachmentKind === 'SUIVI' && m.attachmentRef && <a href={`/api/pdf/suivi/${m.attachmentRef}`} target="_blank" className="btn btn-gold btn-sm"><FileDown size={15} /> État de suivi (PDF)</a>}
              {!m.readAt && <ActionButton action={markRead.bind(null, m.id)} className="btn btn-ghost btn-sm">Marquer comme lu</ActionButton>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
