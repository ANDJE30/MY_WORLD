// Plateforme AI721 TECH STUFF : super administration, registre des établissements, abonnements annuels.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, openSqlite, openTenantDb, saveSettings, getSettings, tx, periodPlan, db } from './db.js';
import { withDb } from './context.js';
import { hashPassword, verifyPassword, genPassword, slug } from './security.js';
import { seal } from './vault.js';

export const COMPANY = 'AI721 TECH STUFF';
export const TENANTS_DIR = path.join(DATA_DIR, 'tenants');
fs.mkdirSync(TENANTS_DIR, { recursive: true });

const PLATFORM_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL DEFAULT 'superadmin' CHECK (role IN ('superadmin')),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE, pass_hash TEXT NOT NULL, full_name TEXT NOT NULL,
  sexe TEXT, phone TEXT, email TEXT, matricule TEXT, specialite TEXT,
  active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, last_login INTEGER,
  pw_enc TEXT, pw_set_at INTEGER, pw_user_changed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL, ip TEXT, ua TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL DEFAULT (unixepoch()),
  user_id INTEGER, username TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT
);
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL, sigle TEXT, type TEXT, statut TEXT, region TEXT, ville TEXT,
  contact_nom TEXT, contact_tel TEXT, contact_email TEXT,
  admin_user_id INTEGER, admin_username TEXT, admin_pw_enc TEXT, admin_pw_set_at INTEGER, admin_pw_user_changed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  notes TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  annee TEXT NOT NULL, valid_from TEXT NOT NULL, valid_to TEXT NOT NULL,
  montant INTEGER NOT NULL DEFAULT 0 CHECK (montant >= 0),
  paid INTEGER NOT NULL DEFAULT 0, paid_at TEXT, mode TEXT, reference TEXT, note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()), created_by TEXT,
  UNIQUE (tenant_id, annee)
);
`;

export const pdb = openSqlite(path.join(DATA_DIR, 'platform.db'));
pdb.exec(PLATFORM_SCHEMA);

/** Exécute fn dans le contexte de la base plateforme. */
export const inPlatform = (fn) => withDb(pdb, fn);

/* ---------- Paramètres de l'entreprise ---------- */
export const PLATFORM_DEFAULTS = {
  societe: COMPANY, slogan: "Solutions numériques pour l'éducation", adresse: 'Yaoundé, Cameroun', tel: '', email: '', site: '',
  rccm: '', niu: '', tarif: 150000, devise: 'FCFA',
  // passerelle SMS des messages aux parents (le secret est chiffré par le coffre)
  sms_provider: process.env.DEMO === '1' ? 'simulation' : 'aucun', sms_user: '', sms_sender: '', sms_from: '', sms_secret_enc: ''
};
export function getPlatformSettings() {
  const out = { ...PLATFORM_DEFAULTS };
  for (const r of pdb.prepare('SELECT key, value FROM settings').all()) if (r.key in PLATFORM_DEFAULTS) { try { out[r.key] = JSON.parse(r.value); } catch { /* défaut */ } }
  return out;
}
export function savePlatformSettings(obj) {
  const st = pdb.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(obj)) if (k in PLATFORM_DEFAULTS) st.run(k, JSON.stringify(v));
}

/* ---------- Années scolaires et abonnements (1er septembre → 31 août) ---------- */
export const today = () => new Date().toISOString().slice(0, 10);
export function schoolYearOf(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();
  const y = d.getUTCMonth() >= 8 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${y + 1}`;
}
export const isSchoolYear = (a) => /^\d{4}-\d{4}$/.test(a || '') && +a.slice(5) === +a.slice(0, 4) + 1;
export const yearBounds = (annee) => { const y = +annee.slice(0, 4); return [`${y}-09-01`, `${y + 1}-08-31`]; };
const frDate = (s) => (s ? s.split('-').reverse().join('/') : '');
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

export function subscriptionStatus(t, day = today()) {
  const subs = pdb.prepare('SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY valid_from DESC').all(t.id);
  const cur = subs.find((s) => s.valid_from <= day && day <= s.valid_to);
  const base = { subs, current: cur || null };
  if (t.status === 'suspended') return { ...base, valid: false, code: 'suspendu', label: 'Suspendu', message: `L'accès de cet établissement est suspendu. Contactez ${COMPANY}.` };
  if (!cur) {
    const next = subs.filter((s) => s.valid_from > day).pop();
    if (next) return { ...base, valid: false, code: 'a_venir', label: 'À venir', message: `L'abonnement ${next.annee} commencera le ${frDate(next.valid_from)}.` };
    const last = subs[0];
    return { ...base, valid: false, code: last ? 'expire' : 'aucun', label: last ? 'Expiré' : 'Sans abonnement',
      message: last ? `L'abonnement ${last.annee} a expiré le ${frDate(last.valid_to)}. Contactez ${COMPANY} pour le renouveler.`
        : `Aucun abonnement actif. Contactez ${COMPANY}.` };
  }
  if (!cur.paid) return { ...base, valid: false, code: 'impaye', label: 'En attente de paiement', message: `L'abonnement ${cur.annee} est en attente de paiement. Contactez ${COMPANY}.` };
  const left = daysBetween(day, cur.valid_to);
  return { ...base, valid: true, code: left <= 30 ? 'expire_bientot' : 'actif', label: left <= 30 ? `Expire dans ${left} j` : 'Actif', days_left: left,
    message: `Abonnement ${cur.annee} valable jusqu'au ${frDate(cur.valid_to)}.` };
}

/* ---------- Registre des établissements ---------- */
export const CODE_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;
export const getTenantByCode = (code) => (CODE_RE.test(String(code || '').toLowerCase()) ? pdb.prepare('SELECT * FROM tenants WHERE code = ?').get(String(code).toLowerCase()) : null);
export const getTenant = (id) => pdb.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
export const tenantDir = (code) => path.join(TENANTS_DIR, code);

const handles = new Map();
/** Base de données d'un établissement (ouverte une seule fois, puis réutilisée). */
export function tenantHandle(t) {
  let h = handles.get(t.code);
  if (!h) {
    fs.mkdirSync(tenantDir(t.code), { recursive: true });
    h = openTenantDb(path.join(tenantDir(t.code), 'edugest.db'));
    handles.set(t.code, h);
  }
  return h;
}
export function closeTenant(code) { const h = handles.get(code); if (h) { try { h.close(); } catch { /* déjà fermée */ } handles.delete(code); } }
export const inTenant = (t, fn) => withDb(tenantHandle(t), fn, { tenant: t });

export function suggestCode(name, sigle) {
  let base = slug(sigle || '') || slug(name || '').slice(0, 16) || 'etablissement';
  base = base.slice(0, 24);
  let code = base, i = 1;
  while (pdb.prepare('SELECT 1 FROM tenants WHERE code = ?').get(code)) code = `${base}${++i}`;
  return code;
}

/**
 * Crée un établissement : base dédiée, paramètres, calendrier de l'année, compte administrateur
 * (mot de passe généré conservé chiffré dans le coffre du super admin) et abonnement.
 */
export function createTenant(d, by = 'AI721') {
  const code = String(d.code || '').toLowerCase();
  if (!CODE_RE.test(code)) throw Object.assign(new Error('Code invalide : 2 à 30 caractères (lettres minuscules, chiffres, tirets).'), { status: 400 });
  if (pdb.prepare('SELECT 1 FROM tenants WHERE code = ?').get(code)) throw Object.assign(new Error('Ce code est déjà utilisé par un autre établissement.'), { status: 409 });
  if (fs.existsSync(path.join(tenantDir(code), 'edugest.db'))) throw Object.assign(new Error('Un dossier de données existe déjà pour ce code.'), { status: 409 });
  const annee = d.annee || schoolYearOf();
  const [from, to] = yearBounds(annee);
  const username = d.admin_username || `admin.${code}`.slice(0, 40);
  const password = d.admin_password || genPassword();
  const t0 = { id: 0, code };
  // 1. base de l'établissement
  const adminId = inTenant(t0, () => tx(() => {
    saveSettings({ nom: d.name, nom_court: d.sigle || '', type: d.type || getSettings().type, statut: d.statut || 'Public',
      region: d.region || '', ville: d.ville || '', annee_scolaire: annee, tel: d.contact_tel || '', email: d.contact_email || '' });
    const up = db.prepare('UPDATE periods SET start_date = ?, end_date = ? WHERE seq = ?');
    periodPlan(+annee.slice(0, 4)).forEach((p, i) => up.run(p[0], p[1], i + 1));
    return Number(db.prepare(`INSERT INTO users(role, username, pass_hash, full_name, phone, email, must_change, pw_enc, pw_set_at)
      VALUES('admin', ?, ?, ?, ?, ?, 0, ?, unixepoch())`).run(username, hashPassword(password), d.contact_nom || 'Administrateur',
      d.contact_tel || null, d.contact_email || null, seal(password)).lastInsertRowid);
  }));
  // 2. registre de la plateforme
  try {
    const id = inPlatform(() => tx(() => {
      const tid = Number(pdb.prepare(`INSERT INTO tenants(code, name, sigle, type, statut, region, ville, contact_nom, contact_tel, contact_email,
        admin_user_id, admin_username, admin_pw_enc, admin_pw_set_at, notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,unixepoch(),?)`)
        .run(code, d.name, d.sigle || null, d.type || null, d.statut || null, d.region || null, d.ville || null, d.contact_nom || null,
          d.contact_tel || null, d.contact_email || null, adminId, username, seal(password), d.notes || null).lastInsertRowid);
      pdb.prepare(`INSERT INTO subscriptions(tenant_id, annee, valid_from, valid_to, montant, paid, paid_at, mode, reference, note, created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(tid, annee, from, to, Math.round(+d.montant || 0), d.paid ? 1 : 0, d.paid ? (d.paid_at || today()) : null,
        d.mode || null, d.reference || null, d.note || null, by);
      return tid;
    }));
    return { tenant: getTenant(id), username, password };
  } catch (e) {
    closeTenant(code); fs.rmSync(tenantDir(code), { recursive: true, force: true });
    throw e;
  }
}

/* ---------- Démarrage : super admin, migration d'une installation mono-établissement ---------- */
function logSuperadmin(title, pw) {
  console.log('\n=============================================================');
  console.log(` Console ${COMPANY} — ${title}`);
  console.log('   Adresse     : /console');
  console.log('   Identifiant : AI721');
  console.log(`   Mot de passe : ${process.env.SUPERADMIN_PASSWORD ? '(défini par SUPERADMIN_PASSWORD)' : `${pw}  (à changer à la première connexion)`}`);
  console.log('=============================================================\n');
}
// Mot de passe de démonstration publié par les versions antérieures à 3.4 (page d'accueil, documentation) : il ne doit
// jamais protéger une console en ligne. Seule exception : SUPERADMIN_PASSWORD le désigne explicitement (tests, poste local).
const KNOWN_PASSWORDS = ['Ai721@2026'];
export function secureSuperadmin() {
  const u = pdb.prepare("SELECT * FROM users WHERE role = 'superadmin'").all().find((x) => KNOWN_PASSWORDS.some((k) => verifyPassword(k, x.pass_hash)));
  if (!u || KNOWN_PASSWORDS.includes(process.env.SUPERADMIN_PASSWORD)) return null;
  const pw = process.env.SUPERADMIN_PASSWORD || genPassword();
  pdb.prepare('UPDATE users SET pass_hash = ?, must_change = ?, failed_attempts = 0, locked_until = 0 WHERE id = ?').run(hashPassword(pw), process.env.SUPERADMIN_PASSWORD ? 0 : 1, u.id);
  pdb.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  logSuperadmin('mot de passe public remplacé (sécurité)', pw);
  return pw;
}

export function initPlatform() {
  if (!pdb.prepare('SELECT 1 FROM users').get()) {
    // aucun mot de passe fixe, même en démonstration : SUPERADMIN_PASSWORD, sinon mot de passe aléatoire affiché une fois
    const pw = process.env.SUPERADMIN_PASSWORD || genPassword();
    pdb.prepare(`INSERT INTO users(role, username, pass_hash, full_name, must_change) VALUES('superadmin', 'AI721', ?, ?, ?)`)
      .run(hashPassword(pw), `Super administrateur ${COMPANY}`, process.env.SUPERADMIN_PASSWORD ? 0 : 1);
    logSuperadmin('compte super administrateur créé', pw);
  } else if (process.env.SUPERADMIN_RESET === '1') {
    // mot de passe AI721 oublié : redémarrer une fois avec SUPERADMIN_RESET=1 (et SUPERADMIN_PASSWORD, sinon mot de passe aléatoire)
    const pw = process.env.SUPERADMIN_PASSWORD || genPassword();
    const u = pdb.prepare("SELECT id FROM users WHERE role = 'superadmin' ORDER BY id LIMIT 1").get();
    pdb.prepare('UPDATE users SET pass_hash = ?, must_change = ?, failed_attempts = 0, locked_until = 0, active = 1 WHERE id = ?').run(hashPassword(pw), process.env.SUPERADMIN_PASSWORD ? 0 : 1, u.id);
    pdb.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    logSuperadmin('mot de passe réinitialisé (SUPERADMIN_RESET=1 : retirez cette variable)', pw);
  } else secureSuperadmin();
  // Installation 1.x (une seule base data/edugest.db) : conversion en premier établissement de la plateforme
  const legacy = path.join(DATA_DIR, 'edugest.db');
  if (fs.existsSync(legacy) && !pdb.prepare('SELECT 1 FROM tenants').get()) migrateLegacy(legacy);
}

function migrateLegacy(file) {
  const h = openTenantDb(file);
  const info = withDb(h, () => ({ s: getSettings(), admin: db.prepare("SELECT id, username FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get() }));
  h.exec('PRAGMA wal_checkpoint(TRUNCATE)'); h.close();
  const code = suggestCode(info.s.nom, info.s.nom_court);
  fs.mkdirSync(tenantDir(code), { recursive: true });
  for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(file + ext)) fs.renameSync(file + ext, path.join(tenantDir(code), 'edugest.db' + ext));
  const bk = path.join(DATA_DIR, 'backups');
  if (fs.existsSync(bk)) fs.renameSync(bk, path.join(tenantDir(code), 'backups'));
  const annee = isSchoolYear(info.s.annee_scolaire) ? info.s.annee_scolaire : schoolYearOf();
  const [from, to] = yearBounds(annee);
  const tid = Number(pdb.prepare(`INSERT INTO tenants(code, name, sigle, type, statut, region, ville, admin_user_id, admin_username, notes)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(code, info.s.nom, info.s.nom_court || null, info.s.type, info.s.statut, info.s.region || null, info.s.ville || null,
    info.admin?.id ?? null, info.admin?.username ?? null, 'Migré automatiquement depuis la version mono-établissement').lastInsertRowid);
  pdb.prepare(`INSERT INTO subscriptions(tenant_id, annee, valid_from, valid_to, montant, paid, paid_at, note, created_by) VALUES(?,?,?,?,0,1,?,?,?)`)
    .run(tid, annee, from, to, today(), 'Migration automatique (installation existante)', 'système');
  console.log(`Installation existante migrée : établissement « ${info.s.nom} » accessible sur /e/${code}/admin`);
}
