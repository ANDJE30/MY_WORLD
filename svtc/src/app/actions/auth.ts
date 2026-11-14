'use server';

import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users, type Role } from '@/db/schema';
import { PORTALS, createSession, destroySession, getSessionUser, revokeUserSessions, clientInfo } from '@/lib/auth';
import { DUMMY_HASH, hashPassword, passwordPolicyError, verifyPassword } from '@/lib/passwords';
import { audit, rateLimit, clearRateLimit } from '@/lib/audit';
import { adminExists } from '@/lib/bootstrap';
import { safe, UserError, type ActionResult } from '@/lib/action';
import { normalizePhone } from '@/lib/format';

const ROLES: Role[] = ['ADMIN', 'ENCADREUR', 'PARENT'];

function normalizeUsername(raw: string): string {
  const v = raw.trim().toLowerCase();
  const digits = normalizePhone(v);
  return /^[\d\s+().-]+$/.test(v) && digits.length >= 9 ? digits : v;
}

export async function loginAction(fd: FormData): Promise<ActionResult> {
  const portal = String(fd.get('portal') ?? '') as Role;
  const result = await safe(async () => {
    if (!ROLES.includes(portal)) throw new UserError('Espace de connexion inconnu.');
    const username = normalizeUsername(String(fd.get('username') ?? '')).slice(0, 80);
    const password = String(fd.get('password') ?? '').slice(0, 200);
    if (!username || !password) throw new UserError('Saisissez votre identifiant et votre mot de passe.');

    const { ip } = await clientInfo();
    const byIp = await rateLimit(`login:ip:${ip}`, 30, 15 * 60);
    const byUser = await rateLimit(`login:user:${username}`, 10, 15 * 60);
    if (!byIp.ok || !byUser.ok) {
      const wait = Math.ceil(Math.max(byIp.retryAfter, byUser.retryAfter) / 60);
      throw new UserError(`Trop de tentatives. Réessayez dans ${wait} minute${wait > 1 ? 's' : ''}.`);
    }

    const [u] = await db.select().from(users).where(eq(sql`lower(${users.username})`, username)).limit(1);
    if (!u) {
      await verifyPassword(password, DUMMY_HASH);
      throw new UserError('Identifiant ou mot de passe incorrect.');
    }
    if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
      const min = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UserError(`Compte temporairement verrouillé après plusieurs échecs. Réessayez dans ${min} minute${min > 1 ? 's' : ''}.`);
    }
    const ok = await verifyPassword(password, u.passwordHash);
    if (!ok) {
      const attempts = u.failedAttempts + 1;
      const lock = attempts >= 5;
      await db
        .update(users)
        .set({ failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + 15 * 60_000) : null })
        .where(eq(users.id, u.id));
      await audit({ id: u.id, username: u.username }, lock ? 'CONNEXION_VERROUILLAGE' : 'CONNEXION_ECHEC');
      throw new UserError(lock ? 'Trop d’échecs : compte verrouillé pendant 15 minutes.' : 'Identifiant ou mot de passe incorrect.');
    }
    if (!u.isActive) throw new UserError('Ce compte est désactivé. Contactez l’administration du centre.');
    if (u.role !== portal) {
      throw new UserError(`Ce compte n'appartient pas à cet espace. Connectez-vous depuis l'${PORTALS[u.role].label.toLowerCase()}.`);
    }
    await db.update(users).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
    await clearRateLimit(`login:user:${username}`);
    await createSession({ id: u.id, role: u.role });
    await audit({ id: u.id, username: u.username }, 'CONNEXION');
    return { ok: true, data: u.mustChangePassword ? `${PORTALS[u.role].home}/compte?premier=1` : PORTALS[u.role].home };
  });
  if (result.ok) redirect(String(result.data));
  return result;
}

export async function logoutAction() {
  const u = await getSessionUser();
  if (u) await audit(u, 'DECONNEXION');
  await destroySession();
  redirect(u ? PORTALS[u.role].login : '/connexion');
}

const pwSchema = z.object({
  current: z.string().min(1, 'Saisissez votre mot de passe actuel.'),
  next: z.string(),
  confirm: z.string(),
});

export async function changePasswordAction(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await getSessionUser();
    if (!me) throw new UserError('Session expirée : reconnectez-vous.');
    const { current, next, confirm } = pwSchema.parse(Object.fromEntries(fd));
    const policy = passwordPolicyError(next);
    if (policy) throw new UserError(policy);
    if (next !== confirm) throw new UserError('La confirmation ne correspond pas au nouveau mot de passe.');
    const [u] = await db.select().from(users).where(eq(users.id, me.id));
    if (!u || !(await verifyPassword(current, u.passwordHash))) throw new UserError('Mot de passe actuel incorrect.');
    if (current === next) throw new UserError('Le nouveau mot de passe doit être différent de l’ancien.');
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(next), mustChangePassword: false, passwordChangedAt: new Date() })
      .where(eq(users.id, me.id));
    await revokeUserSessions(me.id, me.sessionId);
    await audit(me, 'MOT_DE_PASSE_MODIFIE');
    return { ok: true, message: 'Mot de passe modifié. Vos autres sessions ont été fermées.' };
  });
}

const installSchema = z.object({
  fullName: z.string().trim().min(3, 'Nom complet obligatoire.').max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, 'Identifiant : 3 à 32 caractères (lettres, chiffres, point, tiret).'),
  password: z.string(),
  confirm: z.string(),
});

/** Assistant de première installation : disponible uniquement tant qu'aucun administrateur n'existe. */
export async function installAction(fd: FormData): Promise<ActionResult> {
  const r = await safe(async () => {
    if (await adminExists()) throw new UserError('L’application est déjà installée.');
    const { ip } = await clientInfo();
    if (!(await rateLimit(`install:${ip}`, 10, 3600)).ok) throw new UserError('Trop de tentatives.');
    const d = installSchema.parse(Object.fromEntries(fd));
    const policy = passwordPolicyError(d.password);
    if (policy) throw new UserError(policy);
    if (d.password !== d.confirm) throw new UserError('La confirmation ne correspond pas.');
    const [u] = await db
      .insert(users)
      .values({ role: 'ADMIN', username: d.username, fullName: d.fullName, passwordHash: await hashPassword(d.password) })
      .returning();
    await createSession({ id: u.id, role: 'ADMIN' });
    await audit({ id: u.id, username: u.username }, 'INSTALLATION');
    return { ok: true };
  });
  if (r.ok) redirect('/admin?bienvenue=1');
  return r;
}
