import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { AccountPanel } from '@/components/account-panel';

export const metadata = { title: 'Mon compte' };

export default async function AdminAccount({ searchParams }: { searchParams: Promise<{ premier?: string }> }) {
  const me = await requireRole('ADMIN');
  const [u] = await db.select({ lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.id, me.id));
  return (
    <div className="space-y-6">
      <PageHeader kicker="Sécurité" title="Mon compte" />
      <AccountPanel user={me} first={!!(await searchParams).premier} lastLogin={u?.lastLoginAt} />
    </div>
  );
}
