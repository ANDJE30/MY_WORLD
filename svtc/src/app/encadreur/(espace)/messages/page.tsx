import { requireRole } from '@/lib/auth';
import { inboxFor } from '@/lib/inbox';
import { PageHeader } from '@/components/ui';
import { Inbox } from '@/components/inbox';

export const metadata = { title: 'Messages' };

export default async function TutorMessages() {
  const me = await requireRole('ENCADREUR');
  return (
    <div className="space-y-5">
      <PageHeader title="Messages de l'administration" />
      <Inbox items={await inboxFor(me.id)} />
    </div>
  );
}
