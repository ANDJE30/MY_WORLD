import { Router } from 'express';
import { db, audit, getSettings } from '../db.js';
import { inPlatform, subscriptionStatus, getPlatformSettings, pdb, COMPANY } from '../platform.js';
import { verifyPassword, dummyVerify, createSession, destroySession, destroyUserSessions, hashPassword, passwordIssues, rateLimit } from '../security.js';
import { str, bad, HttpError } from '../util.js';

const r = Router();
const MAX_FAILS = 5, LOCK_SECONDS = 15 * 60;

export const COOKIE = 'eg_sid';
// Cookie limité au chemin de l'interface : /console pour AI721, /e/<code>/ pour chaque établissement
export function cookieOpts(req) {
  return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: req.cookiePath || '/', maxAge: 8 * 3600 * 1000 };
}
// Interfaces de connexion : chacune n'accepte que son rôle
const PORTALS = { superadmin: 'la console AI721', admin: "l'interface Administration", teacher: "l'interface Enseignants", discipline: "l'interface Vie scolaire (discipline)" };
const PORTAL_PATH = { admin: 'admin', teacher: 'enseignant', discipline: 'discipline' };
const DEMO_ACCOUNTS = { superadmin: { u: 'AI721', p: 'Ai721@2026' }, admin: { u: 'admin', p: 'Admin@2026' }, teacher: { u: 'mbargajp', p: 'Prof@2026' }, discipline: { u: 'sg.nguemap', p: 'Disc@2026' } };

// Informations publiques pour l'écran de connexion (aucune donnée sensible)
r.get('/public', (req, res) => {
  const demo = process.env.DEMO === '1';
  if (!req.tenant) {
    const ps = getPlatformSettings();
    return res.json({ platform: true, societe: ps.societe, slogan: ps.slogan, tel: ps.tel, email: ps.email, adresse: ps.adresse,
      demo: demo ? { superadmin: DEMO_ACCOUNTS.superadmin } : null });
  }
  const s = getSettings();
  const st = inPlatform(() => subscriptionStatus(req.tenant));
  const ps = inPlatform(getPlatformSettings);
  res.json({ code: req.tenant.code, nom: s.nom, nom_court: s.nom_court, logo: s.logo, devise: s.devise, annee_scolaire: s.annee_scolaire, ville: s.ville,
    fonctions: { chef_titre: s.chef_titre, censeur_titre: s.censeur_titre, sg_titre: s.sg_titre, ap_titre: s.ap_titre },
    subscription: { valid: st.valid, code: st.code, label: st.label, message: st.message, valid_to: st.current?.valid_to || null },
    societe: ps.societe, societe_tel: ps.tel, societe_email: ps.email,
    demo: demo && req.tenant.code === 'lpey' ? { admin: DEMO_ACCOUNTS.admin, teacher: DEMO_ACCOUNTS.teacher, discipline: DEMO_ACCOUNTS.discipline } : null });
});

// Double limitation : par IP (établissement derrière une même IP publique) et par identifiant ciblé
r.post('/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 150, message: 'Trop de tentatives de connexion depuis ce réseau. Réessayez dans 15 minutes.' }),
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: (req) => `login|${req.tenant?.code || 'console'}|${req.ip}|${String(req.body?.username || '').toLowerCase().slice(0, 60)}`, message: 'Trop de tentatives pour cet identifiant. Réessayez dans 15 minutes.', failuresOnly: true }),
  (req, res) => {
    const username = str(req.body?.username, { max: 60, required: true, label: 'Identifiant' });
    const password = str(req.body?.password, { max: 128, required: true, label: 'Mot de passe' });
    const portal = req.tenant ? req.body?.portal : 'superadmin';
    if (!PORTAL_PATH[portal] && portal !== 'superadmin') throw bad('Interface de connexion invalide.');
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
    // Mot de passe correct mais mauvaise interface : on indique la bonne, sans ouvrir de session
    if (u.role !== portal) {
      const where = req.tenant ? `${req.portalBase}/${PORTAL_PATH[u.role]}` : null;
      throw Object.assign(new HttpError(403, `Ce compte doit se connecter via ${PORTALS[u.role]}${where ? ' : ' + where : ''}.`), { redirect: where });
    }
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = 0, last_login = ? WHERE id = ?').run(now, u.id);
    const token = createSession(u.id, req.ip, req.get('user-agent'));
    res.cookie(COOKIE, token, cookieOpts(req));
    audit({ ...req, user: u }, 'LOGIN', u.role);
    res.json({ user: { id: u.id, role: u.role, username: u.username, full_name: u.full_name, must_change: !!u.must_change } });
  });

r.post('/logout', (req, res) => {
  if (req.sessionToken) destroySession(req.sessionToken);
  res.clearCookie(COOKIE, { path: req.cookiePath || '/' });
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
  // le mot de passe choisi par l'utilisateur n'est jamais conservé en clair : le coffre est vidé et la date notée
  db.prepare('UPDATE users SET pass_hash = ?, must_change = 0, pw_enc = NULL, pw_user_changed_at = unixepoch() WHERE id = ?').run(hashPassword(next), u.id);
  if (req.tenant && u.role === 'admin') inPlatform(() => pdb.prepare('UPDATE tenants SET admin_pw_enc = NULL, admin_pw_user_changed_at = unixepoch() WHERE id = ? AND admin_user_id = ?').run(req.tenant.id, u.id));
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
