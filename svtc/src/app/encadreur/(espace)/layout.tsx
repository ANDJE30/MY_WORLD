import { and, count, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { messageRecipients } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { TutorShell } from '@/components/client/tutor-shell';

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole('ENCADREUR');
  const [{ n }] = await db.select({ n: count() }).from(messageRecipients).where(and(eq(messageRecipients.userId, me.id), isNull(messageRecipients.readAt)));
  return <TutorShell name={me.fullName} unread={Number(n)}>{children}</TutorShell>;
}
