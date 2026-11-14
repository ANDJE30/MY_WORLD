import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, rateLimits } from '@/db/schema';
import { clientInfo, type SessionUser } from './auth';

export async function audit(
  user: Pick<SessionUser, 'id' | 'username'> | null,
  action: string,
  opts: { entity?: string; entityId?: string | number; details?: Record<string, unknown> } = {},
) {
  try {
    const { ip } = await clientInfo();
    await db.insert(auditLogs).values({
      userId: user?.id ?? null,
      username: user?.username ?? null,
      action,
      entity: opts.entity ?? null,
      entityId: opts.entityId !== undefined ? String(opts.entityId) : null,
      details: opts.details ?? null,
      ip,
    });
  } catch {
    // le journal ne doit jamais bloquer l'action métier
  }
}

/** Limiteur de débit en base (fenêtre fixe). Renvoie le nombre de secondes à attendre si la limite est atteinte. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const reset = new Date(Date.now() + windowSec * 1000);
  const rows = await db.execute<{ count: number; reset_at: Date }>(sql`
    insert into ${rateLimits} (key, count, reset_at) values (${key}, 1, ${reset.toISOString()}::timestamptz)
    on conflict (key) do update set
      count = case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end,
      reset_at = case when ${rateLimits.resetAt} < now() then excluded.reset_at else ${rateLimits.resetAt} end
    returning count, reset_at`);
  const r = rows[0];
  const count = Number(r?.count ?? 1);
  const resetAt = r ? new Date(r.reset_at) : reset;
  if (count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)) };
  return { ok: true, retryAfter: 0 };
}

export async function clearRateLimit(key: string) {
  await db.execute(sql`delete from ${rateLimits} where key = ${key}`);
}
