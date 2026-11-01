import { Router } from 'express';
import { db, audit, getSettings } from '../db.js';
import { verifyPassword, dummyVerify, createSession, destroySession, destroyUserSessions, hashPassword, passwordIssues, rateLimit } from '../security.js';
import { str, bad, HttpError } from '../util.js';

const r = Router();
const MAX_FAILS = 5, LOCK_SECONDS = 15 * 60;

export const COOKIE = 'edugest_sid';
export function cookieOpts(req) {
  return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/', maxAge: 8 * 3600 * 1000 };
}

// Informations publiques pour l'écran de connexion (aucune donnée sensible)
r.get('/public', (_req, res) => {
  const s = getSettings();
  const hasAdmin = !!db.prepare("SELECT 1 FROM users WHERE role='admin'").get();
  res.json({ nom: s.nom, nom_court: s.nom_court, logo: s.logo, devise: s.devise, annee_scolaire: s.annee_scolaire, ville: s.ville, ready: hasAdmin,
    demo: process.env.DEMO === '1' ? [{ r: 'Administrateur', u: 'admin', p: 'Admin@2026' }, { r: 'Enseignant', u: 'mbargajp', p: 'Prof@2026' }, { r: 'Resp. disciplinaire', u: 'sg.nguemap', p: 'Disc@2026' }] : null });
});

// Double limitation : par IP (établissement derrière une même IP publique) et par identifiant ciblé
r.post('/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 150, message: 'Trop de tentatives de connexion depuis ce réseau. Réessayez dans 15 minutes.' }),
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: (req) => `login|${req.ip}|${String(req.body?.username || '').toLowerCase().slice(0, 60)}`, message: 'Trop de tentatives pour cet identifiant. Réessayez dans 15 minutes.' }),
  (req, res) => {
    const username = str(req.body?.username, { max: 60, required: true, label: 'Identifiant' });
    const password = str(req.body?.password, { max: 128, required: true, label: 'Mot de passe' });
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const now = Math.floor(Date.now() / 1000);
    if (!u) { dummyVerify(password); audit(req, 'LOGIN_ECHEC', `identifiant inconnu: ${username}`); throw new HttpError(401, 'Identifiant ou mot de passe incorrect.'); }
    if (u.locked_until > now) {
      const min = Math.ceil((u.locked_until - now) / 60);
      throw new HttpError(423, `Compte temporairement verrouillé suite à plusieurs échecs. Réessayez dans ${min} min.`);
    }
    if (!verifyPassword(password, u.pass_hash)) {
      const fails = u.failed_attempts + 1;
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? now + LOCK_SECONDS : 0, u.id);
      audit({ ...req, user: { id: u.id, username: u.username } }, 'LOGIN_ECHEC', `tentative ${fails}`);
      throw new HttpError(401, fails >= MAX_FAILS ? 'Trop d\'échecs : compte verrouillé 15 minutes.' : `Identifiant ou mot de passe incorrect. (${MAX_FAILS - fails} essai(s) restant(s))`);
    }
    if (!u.active) throw new HttpError(403, 'Ce compte est désactivé. Contactez l\'administrateur.');
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = 0, last_login = ? WHERE id = ?').run(now, u.id);
    const token = createSession(u.id, req.ip, req.get('user-agent'));
    res.cookie(COOKIE, token, cookieOpts(req));
    audit({ ...req, user: u }, 'LOGIN', u.role);
    res.json({ user: { id: u.id, role: u.role, username: u.username, full_name: u.full_name, must_change: !!u.must_change } });
  });

r.post('/logout', (req, res) => {
  if (req.sessionToken) destroySession(req.sessionToken);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

r.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const u = db.prepare('SELECT id, role, username, full_name, phone, email, sexe, matricule, specialite, must_change, last_login FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: { ...u, must_change: !!u.must_change } });
});

r.post('/password', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: (req) => `pw|${req.sessionToken || req.ip}` }), (req, res) => {
  if (!req.user) throw new HttpError(401, 'Non connecté');
  const current = str(req.body?.current, { max: 128, required: true, label: 'Mot de passe actuel' });
  const next = str(req.body?.next, { max: 128, required: true, label: 'Nouveau mot de passe' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, u.pass_hash)) throw bad('Mot de passe actuel incorrect.');
  const issues = passwordIssues(next);
  if (issues.length) throw bad(`Le mot de passe doit contenir ${issues.join(', ')}.`);
  if (next === current) throw bad('Le nouveau mot de passe doit être différent de l\'actuel.');
  if (next.toLowerCase().includes(u.username.toLowerCase())) throw bad('Le mot de passe ne doit pas contenir votre identifiant.');
  db.prepare('UPDATE users SET pass_hash = ?, must_change = 0 WHERE id = ?').run(hashPassword(next), u.id);
  destroyUserSessions(u.id, req.sessionToken); // déconnecte les autres appareils
  audit(req, 'MOT_DE_PASSE_MODIFIE');
  res.json({ ok: true });
});

r.put('/profile', (req, res) => {
  if (!req.user) throw new HttpError(401, 'Non connecté');
  const phone = str(req.body?.phone, { max: 30, label: 'Téléphone' });
  const email = str(req.body?.email, { max: 120, label: 'E-mail' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('E-mail invalide');
  db.prepare('UPDATE users SET phone = ?, email = ? WHERE id = ?').run(phone, email, req.user.id);
  res.json({ ok: true });
});

export default r;
