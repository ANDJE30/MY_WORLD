// Sécurité : hachage scrypt, génération d'identifiants mémorisables, sessions, limitation de débit.
import crypto from 'node:crypto';
import { db } from './db.js';

/* ---------- Mots de passe ---------- */
const N = 16384, R = 8, P = 1, KEYLEN = 64;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(pw, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${dk.toString('base64')}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [alg, n, r, p, salt, hash] = stored.split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    const dk = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
    return crypto.timingSafeEqual(dk, expected);
  } catch { return false; }
}
// Hachage factice pour égaliser le temps de réponse quand l'utilisateur n'existe pas
const DUMMY = hashPassword('dummy-password-for-timing');
export const dummyVerify = (pw) => verifyPassword(pw, DUMMY);

export function passwordIssues(pw) {
  const issues = [];
  if (typeof pw !== 'string' || pw.length < 8) issues.push('au moins 8 caractères');
  if (pw && pw.length > 128) issues.push('128 caractères maximum');
  if (pw && !/[A-Za-z]/.test(pw)) issues.push('au moins une lettre');
  if (pw && !/\d/.test(pw)) issues.push('au moins un chiffre');
  return issues;
}

/* ---------- Identifiants faciles à retenir ---------- */
const WORDS = ('lion tigre zebre girafe singe hibou aigle colibri pelican cigale abeille fourmi papillon dauphin requin ' +
  'tortue crabe mangue ananas papaye banane goyave citron orange avocat manioc igname plantain arachide cacao cafe coton ' +
  'palmier baobab ebene acajou bambou savane foret riviere cascade volcan montagne plaine lagune soleil lune etoile nuage ' +
  'orage arc ciel brise sable rocher grotte sentier pirogue tambour balafon kora masque perle cauri indigo ocre jade ' +
  'corail ambre rubis opale saphir azur vert rouge jaune bleu blanc noir clair rapide brave sage calme joyeux fier ' +
  'libre fort doux franc loyal noble vaillant agile futur espoir unite paix travail avenir savoir livre cahier stylo ' +
  'craie tableau regle compas atlas globe carte lampe horloge cloche pont route marche village cite phare voile').split(' ');

export function genPassword() {
  const w = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${w()}-${w()}-${crypto.randomInt(100, 1000)}`;
}
export const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Identifiant court : initiale du prénom + nom (ex. « jmbarga »), unique. */
export function genUsername(fullName, role) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  const prefix = role === 'discipline' ? 'sg.' : role === 'teacher' ? '' : '';
  const nom = slug(parts[0] || 'user');
  const ini = slug(parts.slice(1).map((p) => p[0]).join('')).slice(0, 2);
  let base = (prefix + nom + ini).slice(0, 16) || 'user';
  let u = base, i = 1;
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?');
  while (exists.get(u)) u = `${base}${++i}`;
  return u;
}

/* ---------- Sessions ---------- */
const SESSION_TTL = 8 * 3600, IDLE_TTL = 2 * 3600;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function createSession(userId, ip, ua) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,last_seen,expires_at,ip,ua) VALUES(?,?,?,?,?,?,?)')
    .run(sha(token), userId, now, now, now + SESSION_TTL, ip, String(ua || '').slice(0, 200));
  return token;
}
export function getSession(token) {
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const s = db.prepare(`SELECT s.*, u.id uid, u.role, u.username, u.full_name, u.active, u.must_change
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(token));
  if (!s) return null;
  if (!s.active || s.expires_at < now || now - s.last_seen > IDLE_TTL) { destroySession(token); return null; }
  if (now - s.last_seen > 60) db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(now, s.token_hash);
  return { id: s.uid, role: s.role, username: s.username, full_name: s.full_name, must_change: !!s.must_change };
}
export const destroySession = (token) => db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
export const destroyUserSessions = (uid, exceptToken) =>
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(uid, exceptToken ? sha(exceptToken) : '');
export function purgeSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
}

/* ---------- Limitation de débit (mémoire) ---------- */
const buckets = new Map();
/** failuresOnly : ne compte que les réponses en échec (≥ 400) — une connexion réussie ne doit jamais bloquer. */
export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Trop de requêtes, réessayez plus tard.', failuresOnly = false }) {
  return (req, res, next) => {
    const k = key(req) + '|' + windowMs, now = Date.now();
    let b = buckets.get(k);
    if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(k, b); }
    if (b.n >= max) {
      res.set('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: message });
    }
    if (failuresOnly) res.on('finish', () => { if (res.statusCode >= 400) b.n++; });
    else b.n++;
    next();
  };
}
setInterval(() => { const n = Date.now(); for (const [k, b] of buckets) if (b.reset < n) buckets.delete(k); }, 60000).unref();
