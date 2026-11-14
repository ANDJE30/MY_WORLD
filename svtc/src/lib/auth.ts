import 'server-only';
import { createHash } from 'node:crypto';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { authSessions, users, tutors, parents, type Role } from '@/db/schema';
import { randomToken } from './passwords';

export const PORTALS: Record<Role, { home: string; login: string; label: string }> = {
  ADMIN: { home: '/admin', login: '/admin/connexion', label: 'Administration' },
  ENCADREUR: { home: '/encadreur', login: '/encadreur/connexion', label: 'Espace encadreur' },
  PARENT: { home: '/parent', login: '/parent/connexion', label: 'Espace parent' },
};

const DURATION_H: Record<Role, number> = { ADMIN: 12, ENCADREUR: 24 * 7, PARENT: 24 * 30 };
const IDLE_H: Record<Role, number> = { ADMIN: 4, ENCADREUR: 24 * 3, PARENT: 24 * 14 };

const isProd = process.env.NODE_ENV === 'production';
const COOKIE = isProd ? '__Host-svtc_session' : 'svtc_session';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function clientInfo() {
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local').trim().slice(0, 64);
  const ua = (h.get('user-agent') || '').slice(0, 250);
  return { ip, ua };
}

export async function createSession(user: { id: string; role: Role }) {
  const token = randomToken(32);
  const { ip, ua } = await clientInfo();
  const expiresAt = new Date(Date.now() + DURATION_H[user.role] * 3600_000);
  await db.insert(authSessions).values({ id: sha256(token), userId: user.id, role: user.role, expiresAt, ip, userAgent: ua });
  // Nettoyage opportuniste des sessions expirées
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    priority: 'high',
  });
}

export type SessionUser = {
  id: string;
  role: Role;
  username: string;
  fullName: string;
  phone: string | null;
  mustChangePassword: boolean;
  sessionId: string;
  tutorId: number | null;
  parentId: number | null;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ s: authSessions, u: users })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.id, id))
    .limit(1);
  if (!row) return null;
  const now = Date.now();
  const idleLimit = row.s.lastSeenAt.getTime() + IDLE_H[row.s.role] * 3600_000;
  if (row.s.expiresAt.getTime() < now || idleLimit < now || !row.u.isActive || row.u.role !== row.s.role) {
    await db.delete(authSessions).where(eq(authSessions.id, id));
    return null;
  }
  if (now - row.s.lastSeenAt.getTime() > 5 * 60_000) {
    await db.update(authSessions).set({ lastSeenAt: new Date() }).where(eq(authSessions.id, id));
  }
  let tutorId: number | null = null;
  let parentId: number | null = null;
  if (row.u.role === 'ENCADREUR') {
    const [t] = await db.select({ id: tutors.id }).from(tutors).where(eq(tutors.userId, row.u.id)).limit(1);
    tutorId = t?.id ?? null;
  } else if (row.u.role === 'PARENT') {
    const [p] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, row.u.id)).limit(1);
    parentId = p?.id ?? null;
  }
  return {
    id: row.u.id,
    role: row.u.role,
    username: row.u.username,
    fullName: row.u.fullName,
    phone: row.u.phone,
    mustChangePassword: row.u.mustChangePassword,
    sessionId: id,
    tutorId,
    parentId,
  };
});

/** Garde d'accès côté serveur : chaque espace n'accepte que son propre rôle. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(PORTALS[role].login);
  if (u.role !== role) redirect(`${PORTALS[u.role].home}?refus=${role.toLowerCase()}`);
  if (role === 'ENCADREUR' && !u.tutorId) redirect(`${PORTALS[role].login}?erreur=profil`);
  if (role === 'PARENT' && !u.parentId) redirect(`${PORTALS[role].login}?erreur=profil`);
  return u;
}

/** Variante pour les actions serveur et les routes : lève une erreur au lieu de rediriger. */
export async function assertRole(...roles: Role[]): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u || !roles.includes(u.role)) throw new AuthError();
  if (u.role === 'ENCADREUR' && !u.tutorId) throw new AuthError();
  if (u.role === 'PARENT' && !u.parentId) throw new AuthError();
  return u;
}

export class AuthError extends Error {
  constructor() {
    super('Accès refusé : veuillez vous reconnecter.');
  }
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(authSessions).where(eq(authSessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Ferme toutes les sessions d'un utilisateur (changement de mot de passe, désactivation), sauf éventuellement la courante. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  const rows = await db.select({ id: authSessions.id }).from(authSessions).where(eq(authSessions.userId, userId));
  for (const r of rows) {
    if (r.id !== exceptSessionId) await db.delete(authSessions).where(and(eq(authSessions.id, r.id), eq(authSessions.userId, userId)));
  }
}
