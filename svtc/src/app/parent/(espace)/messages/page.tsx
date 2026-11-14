import { requireRole } from '@/lib/auth';
import { inboxFor } from '@/lib/inbox';
import { PageHeader } from '@/components/ui';
import { Inbox } from '@/components/inbox';

export const metadata = { title: 'Messages' };

export default async function ParentMessages() {
  const me = await requireRole('PARENT');
  return (
    <div className="space-y-5">
      <PageHeader title="Messages du centre" subtitle="Informations, rappels, états de suivi de votre enfant." />
      <Inbox items={await inboxFor(me.id)} accent="gold" />
    </div>
  );
}
