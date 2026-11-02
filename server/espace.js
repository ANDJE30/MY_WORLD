// Témoin d'espace : signale au serveur qu'un navigateur est connecté à un établissement (administration, enseignant,
// vie scolaire). Le cookie de session reste limité à /e/<code>/ ; ce témoin, sans valeur d'authentification, est visible
// sur tout le site pour que la console AI721 refuse ce navigateur. HttpOnly, signé (HMAC-SHA256), durée d'une session.
import crypto from 'node:crypto';
import { deriveKey } from './vault.js';

const KEY = deriveKey('schoolx:temoin-espace:v1');
const PREFIX = 'sx_esp_';
const TTL = 8 * 3600 * 1000;
const ROLES = new Set(['admin', 'teacher', 'discipline']);
export const ROLE_SLUG = { admin: 'admin', teacher: 'enseignant', discipline: 'discipline' };
export const SLUG_ROLE = { admin: 'admin', enseignant: 'teacher', discipline: 'discipline' };

const sign = (s) => crypto.createHmac('sha256', KEY).update(s).digest('base64url');
const opts = (req) => ({ httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });

export function setEspace(req, res, code, role) {
  const exp = Date.now() + TTL;
  res.cookie(PREFIX + code, `${role}.${exp}.${sign(`${code}|${role}|${exp}`)}`, { ...opts(req), maxAge: TTL });
}
export function clearEspace(req, res, code) { res.clearCookie(PREFIX + code, opts(req)); }

/** Espaces d'établissement ouverts dans ce navigateur (témoins valides et non expirés). */
export function espacesOuverts(req) {
  const out = [];
  for (const part of String(req.headers.cookie || '').split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i < 0 || !part.startsWith(PREFIX)) continue;
    const code = part.slice(PREFIX.length, i), [role, exp, sig] = decodeURIComponent(part.slice(i + 1)).split('.');
    if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(code) || !ROLES.has(role) || !(+exp > Date.now()) || !sig) continue;
    const want = sign(`${code}|${role}|${exp}`);
    if (sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) out.push({ code, role });
  }
  return out;
}
