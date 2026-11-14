import { Suspense } from 'react';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { messageRecipients } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { myKids } from '@/lib/parent';
import { ParentShell } from '@/components/client/parent-shell';

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('PARENT');
  const [kids, [{ n }]] = await Promise.all([
    myKids(me.parentId!),
    db.select({ n: count() }).from(messageRecipients).where(and(eq(messageRecipients.userId, me.id), isNull(messageRecipients.readAt))),
  ]);
  return (
    <Suspense>
      <ParentShell name={me.fullName} unread={Number(n)} kids={kids.map((k) => ({ id: k.id, firstName: k.firstName, className: k.className, color: k.classColor }))}>{children}</ParentShell>
    </Suspense>
  );
}
