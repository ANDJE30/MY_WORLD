// Console du super administrateur AI721 : établissements, abonnements, accès, paiements.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, audit, tx, DATA_DIR } from '../db.js';
import { hashPassword, genPassword, verifyPassword, destroyUserSessions } from '../security.js';
import { seal, unseal } from '../vault.js';
import { pdb, getTenant, createTenant, inTenant, closeTenant, tenantDir, subscriptionStatus, schoolYearOf, isSchoolYear, yearBounds,
  suggestCode, getPlatformSettings, savePlatformSettings, PLATFORM_DEFAULTS, CODE_RE, today, COMPANY } from '../platform.js';
import { str, num, id, bool, date, oneOf, bad, HttpError } from '../util.js';
import { requireRole } from './access.js';
import * as P from '../pdf.js';
import { PROVIDERS, gatewayConfig, sendSms, normalizePhone } from '../sms.js';

const r = Router();
r.use(requireRole('superadmin'));

const MODES = ['Espèces', 'Mobile Money', 'Orange Money', 'Virement', 'Chèque', 'Autre'];
const links = (req, code) => {
  const base = `${req.protocol}://${req.get('host')}/e/${code}`;
  return { portal: base, admin: `${base}/admin`, teacher: `${base}/enseignant`, discipline: `${base}/discipline` };
};
const confirmPassword = (req) => {
  const pw = str(req.body?.password, { max: 128, required: true, label: 'Mot de passe de confirmation' });
  if (!verifyPassword(pw, pdb.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.user.id).pass_hash)) throw new HttpError(403, 'Mot de passe de confirmation incorrect');
};
const mustTenant = (tid) => { const t = getTenant(id(tid)); if (!t) throw new HttpError(404, 'Établissement introuvable'); return t; };

/** Synthèse d'un établissement : abonnement + indicateurs lus dans sa propre base. */
function summary(req, t) {
  const st = subscriptionStatus(t);
  let counts = {};
  try {
    counts = inTenant(t, () => ({
      eleves: db.prepare('SELECT COUNT(*) c FROM students WHERE active = 1').get().c,
      enseignants: db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'teacher'").get().c,
      responsables: db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'discipline'").get().c,
      classes: db.prepare('SELECT COUNT(*) c FROM classes').get().c,
      sequences_cloturees: db.prepare("SELECT COUNT(*) c FROM periods WHERE status = 'closed'").get().c,
      derniere_connexion: db.prepare('SELECT MAX(last_login) m FROM users').get().m,
      annee_scolaire: (() => { try { return JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'annee_scolaire'").get()?.value || '""'); } catch { return ''; } })()
    }));
  } catch (e) { counts = { erreur: e.message }; }
  const cur = st.current || st.subs[0] || null;
  return { ...t, admin_pw_enc: undefined, has_admin_pw: !!t.admin_pw_enc, status_code: st.code, status_label: st.label, valid: st.valid,
    message: st.message, days_left: st.days_left ?? null, annee: cur?.annee || null, valid_to: cur?.valid_to || null, montant: cur?.montant ?? null,
    paid: cur?.paid ?? null, links: links(req, t.code), ...counts };
}

/* ---------------- Tableau de bord ---------------- */
r.get('/dashboard', (req, res) => {
  const ts = pdb.prepare('SELECT * FROM tenants ORDER BY name').all().map((t) => summary(req, t));
  const year = schoolYearOf();
  const subs = pdb.prepare('SELECT * FROM subscriptions').all();
  const byYear = {};
  for (const s of subs) { const b = (byYear[s.annee] ??= { annee: s.annee, recettes: 0, attendu: 0, abonnements: 0 }); b.abonnements++; b.attendu += s.montant; if (s.paid) b.recettes += s.montant; }
  const byRegion = {};
  for (const t of ts) byRegion[t.region || 'Non précisée'] = (byRegion[t.region || 'Non précisée'] || 0) + 1;
  res.json({
    year, today: today(),
    kpis: {
      total: ts.length, actifs: ts.filter((t) => t.valid).length, inactifs: ts.filter((t) => !t.valid).length,
      expirent_bientot: ts.filter((t) => t.status_code === 'expire_bientot').length, impayes: ts.filter((t) => t.status_code === 'impaye').length,
      eleves: ts.reduce((a, t) => a + (t.eleves || 0), 0), enseignants: ts.reduce((a, t) => a + (t.enseignants || 0), 0),
      recettes_annee: subs.filter((s) => s.annee === year && s.paid).reduce((a, s) => a + s.montant, 0),
      attendu_annee: subs.filter((s) => s.annee === year).reduce((a, s) => a + s.montant, 0),
      recettes_total: subs.filter((s) => s.paid).reduce((a, s) => a + s.montant, 0)
    },
    tenants: ts, years: Object.values(byYear).sort((a, b) => a.annee.localeCompare(b.annee)),
    regions: Object.entries(byRegion).map(([region, n]) => ({ region, n })).sort((a, b) => b.n - a.n),
    activity: pdb.prepare('SELECT at, username, action, detail FROM audit_log ORDER BY id DESC LIMIT 8').all()
  });
});

/* ---------------- Établissements ---------------- */
r.get('/tenants', (req, res) => res.json(pdb.prepare('SELECT * FROM tenants ORDER BY name').all().map((t) => summary(req, t))));
r.get('/code-suggestion', (req, res) => res.json({ code: suggestCode(str(req.query.name, { max: 120 }) || '', str(req.query.sigle, { max: 30 }) || '') }));

const tenantBody = (b) => ({
  name: str(b.name, { max: 120, required: true, label: "Nom de l'établissement" }), sigle: str(b.sigle, { max: 20, label: 'Sigle' }),
  type: str(b.type, { max: 80 }), statut: str(b.statut, { max: 40 }), region: str(b.region, { max: 40 }), ville: str(b.ville, { max: 60 }),
  contact_nom: str(b.contact_nom, { max: 120 }), contact_tel: str(b.contact_tel, { max: 30 }), contact_email: str(b.contact_email, { max: 120 }),
  notes: str(b.notes, { max: 500 })
});
const subBody = (b) => {
  const annee = str(b.annee, { max: 9, required: true, label: 'Année scolaire' });
  if (!isSchoolYear(annee)) throw bad('Année scolaire invalide (ex. 2026-2027)');
  return { annee, montant: num(b.montant ?? 0, { min: 0, max: 100_000_000, int: true, label: 'Montant' }), paid: bool(b.paid),
    paid_at: date(b.paid_at, 'Date de paiement'), mode: b.mode ? oneOf(b.mode, MODES, 'Mode de paiement') : null,
    reference: str(b.reference, { max: 60 }), note: str(b.note, { max: 300 }) };
};

r.post('/tenants', (req, res) => {
  const t = tenantBody(req.body), sub = subBody(req.body);
  const code = String(req.body.code || suggestCode(t.name, t.sigle)).toLowerCase().trim();
  if (!CODE_RE.test(code)) throw bad('Code invalide : 2 à 30 caractères (lettres minuscules, chiffres, tirets).');
  const out = createTenant({ ...t, ...sub, code }, req.user.username);
  audit(req, 'ETABLISSEMENT_CREE', `${out.tenant.name} (${code}) — ${sub.annee} — ${sub.montant} ${getPlatformSettings().devise}`);
  res.status(201).json({ tenant: summary(req, out.tenant), username: out.username, password: out.password, links: links(req, code) });
});
r.get('/tenants/:id', (req, res) => {
  const t = mustTenant(req.params.id);
  res.json({ ...summary(req, t), subscriptions: pdb.prepare('SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY valid_from DESC').all(t.id) });
});
r.put('/tenants/:id', (req, res) => {
  const t = mustTenant(req.params.id); const b = tenantBody(req.body);
  pdb.prepare(`UPDATE tenants SET name=?, sigle=?, type=?, statut=?, region=?, ville=?, contact_nom=?, contact_tel=?, contact_email=?, notes=? WHERE id=?`)
    .run(b.name, b.sigle, b.type, b.statut, b.region, b.ville, b.contact_nom, b.contact_tel, b.contact_email, b.notes, t.id);
  audit(req, 'ETABLISSEMENT_MODIFIE', t.code);
  res.json({ ok: true });
});
r.post('/tenants/:id/toggle', (req, res) => {
  const t = mustTenant(req.params.id);
  const next = t.status === 'active' ? 'suspended' : 'active';
  pdb.prepare('UPDATE tenants SET status = ? WHERE id = ?').run(next, t.id);
  if (next === 'suspended') inTenant(t, () => db.exec('DELETE FROM sessions'));
  audit(req, next === 'active' ? 'ETABLISSEMENT_REACTIVE' : 'ETABLISSEMENT_SUSPENDU', t.code);
  res.json({ ok: true, status: next });
});
// Coffre : identifiants de l'administrateur de l'établissement
r.post('/tenants/:id/reveal', (req, res) => {
  const t = mustTenant(req.params.id);
  audit(req, 'COFFRE_CONSULTATION', t.code);
  res.json({ username: t.admin_username, password: unseal(t.admin_pw_enc), changed_by_user: !t.admin_pw_enc && !!t.admin_pw_user_changed_at,
    changed_at: t.admin_pw_user_changed_at, links: links(req, t.code) });
});
/** Génère un nouveau mot de passe pour l'administrateur de l'établissement (conservé chiffré dans le coffre). */
function resetAdmin(req, t) {
  const password = genPassword();
  const admin = inTenant(t, () => tx(() => {
    let a = db.prepare("SELECT id, username FROM users WHERE role = 'admin' AND (id = ? OR username = ?) ORDER BY id = ? DESC LIMIT 1").get(t.admin_user_id, t.admin_username, t.admin_user_id)
      || db.prepare("SELECT id, username FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    if (!a) {
      const u = `admin.${t.code}`.slice(0, 40);
      a = { id: Number(db.prepare("INSERT INTO users(role, username, pass_hash, full_name, must_change) VALUES('admin', ?, 'x', 'Administrateur', 0)").run(u).lastInsertRowid), username: u };
    }
    db.prepare('UPDATE users SET pass_hash = ?, active = 1, must_change = 0, failed_attempts = 0, locked_until = 0, pw_enc = ?, pw_set_at = unixepoch(), pw_user_changed_at = NULL WHERE id = ?')
      .run(hashPassword(password), seal(password), a.id);
    destroyUserSessions(a.id);
    db.prepare("INSERT INTO audit_log(username, action, detail) VALUES('AI721', 'MOT_DE_PASSE_ADMIN_REINITIALISE', ?)").run(`par ${COMPANY}`);
    return a;
  }));
  pdb.prepare('UPDATE tenants SET admin_user_id = ?, admin_username = ?, admin_pw_enc = ?, admin_pw_set_at = unixepoch(), admin_pw_user_changed_at = NULL WHERE id = ?')
    .run(admin.id, admin.username, seal(password), t.id);
  audit(req, 'ADMIN_ETABLISSEMENT_REINITIALISE', t.code);
  return { username: admin.username, password, links: links(req, t.code) };
}
r.post('/tenants/:id/reset-admin', (req, res) => res.json(resetAdmin(req, mustTenant(req.params.id))));
r.delete('/tenants/:id', (req, res) => {
  confirmPassword(req);
  const t = mustTenant(req.params.id);
  closeTenant(t.code);
  const trash = path.join(DATA_DIR, 'supprimes'); fs.mkdirSync(trash, { recursive: true });
  if (fs.existsSync(tenantDir(t.code))) fs.renameSync(tenantDir(t.code), path.join(trash, `${t.code}-${Date.now()}`));
  pdb.prepare('DELETE FROM tenants WHERE id = ?').run(t.id);
  audit(req, 'ETABLISSEMENT_SUPPRIME', `${t.name} (${t.code}) — données archivées dans supprimes/`);
  res.json({ ok: true });
});

/* ---------------- Abonnements et paiements ---------------- */
r.get('/subscriptions', (req, res) => {
  const annee = req.query.annee && isSchoolYear(req.query.annee) ? req.query.annee : null;
  res.json(pdb.prepare(`SELECT s.*, t.name, t.code, t.ville FROM subscriptions s JOIN tenants t ON t.id = s.tenant_id
    ${annee ? 'WHERE s.annee = ?' : ''} ORDER BY s.annee DESC, t.name`).all(...(annee ? [annee] : [])));
});
r.post('/tenants/:id/subscriptions', (req, res) => {
  const t = mustTenant(req.params.id); const s = subBody(req.body);
  const [from, to] = yearBounds(s.annee);
  const info = pdb.prepare(`INSERT INTO subscriptions(tenant_id, annee, valid_from, valid_to, montant, paid, paid_at, mode, reference, note, created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(t.id, s.annee, from, to, s.montant, s.paid ? 1 : 0, s.paid ? (s.paid_at || today()) : null, s.mode, s.reference, s.note, req.user.username);
  audit(req, 'ABONNEMENT_AJOUTE', `${t.code} ${s.annee} — ${s.montant}${s.paid ? ' (payé)' : ' (en attente)'}`);
  // option : nouveaux identifiants pour la nouvelle année scolaire
  const creds = bool(req.body.regenerate) ? resetAdmin(req, t) : null;
  res.status(201).json({ id: Number(info.lastInsertRowid), credentials: creds });
});
r.put('/subscriptions/:id', (req, res) => {
  const sub = pdb.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id(req.params.id));
  if (!sub) throw new HttpError(404, 'Abonnement introuvable');
  const s = subBody({ ...sub, ...req.body, annee: sub.annee });
  pdb.prepare('UPDATE subscriptions SET montant = ?, paid = ?, paid_at = ?, mode = ?, reference = ?, note = ? WHERE id = ?')
    .run(s.montant, s.paid ? 1 : 0, s.paid ? (s.paid_at || sub.paid_at || today()) : null, s.mode, s.reference, s.note, sub.id);
  audit(req, s.paid && !sub.paid ? 'PAIEMENT_ENREGISTRE' : 'ABONNEMENT_MODIFIE', `abonnement ${sub.id} — ${s.montant}`);
  res.json({ ok: true });
});
r.delete('/subscriptions/:id', (req, res) => {
  confirmPassword(req);
  const sub = pdb.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id(req.params.id));
  if (!sub) throw new HttpError(404, 'Abonnement introuvable');
  pdb.prepare('DELETE FROM subscriptions WHERE id = ?').run(sub.id);
  audit(req, 'ABONNEMENT_SUPPRIME', `${sub.annee} (établissement ${sub.tenant_id})`);
  res.json({ ok: true });
});

/* ---------------- Paramètres de l'entreprise & journal ---------------- */
const publicSettings = () => { const { sms_secret_enc: enc, ...ps } = getPlatformSettings(); return { ...ps, sms_secret_set: !!enc, sms_providers: PROVIDERS }; };
r.get('/settings', (_req, res) => res.json(publicSettings()));
r.put('/settings', (req, res) => {
  const out = {};
  for (const k of Object.keys(PLATFORM_DEFAULTS)) {
    if (!(k in req.body) || k === 'sms_secret_enc') continue;
    if (k === 'tarif') out[k] = num(req.body.tarif, { min: 0, max: 100_000_000, int: true, label: 'Tarif' });
    else if (k === 'sms_provider') out[k] = oneOf(req.body.sms_provider, Object.keys(PROVIDERS), 'Passerelle SMS');
    else if (k === 'sms_sender') { out[k] = str(req.body.sms_sender, { max: 11, label: "Nom d'expéditeur (11 caractères)" }) || ''; if (out[k] && !/^[A-Za-z0-9 .-]+$/.test(out[k])) throw bad("Nom d'expéditeur : lettres, chiffres, espace, point ou tiret"); }
    else out[k] = str(req.body[k], { max: 200, label: k }) || '';
  }
  // secret de la passerelle : jamais renvoyé, conservé chiffré ; champ vide = inchangé
  if (req.body.sms_secret) out.sms_secret_enc = seal(str(req.body.sms_secret, { max: 300, label: 'Clé de la passerelle' }));
  if (out.societe === '') throw bad("Le nom de l'entreprise est obligatoire");
  savePlatformSettings(out);
  audit(req, 'PARAMETRES_PLATEFORME', Object.keys(out).map((k) => (k === 'sms_secret_enc' ? 'sms_secret' : k)).join(', '));
  res.json(publicSettings());
});
// Envoi d'un SMS de test pour vérifier la passerelle
r.post('/sms/test', async (req, res) => {
  const to = normalizePhone(req.body.to);
  if (!to) throw bad('Numéro de téléphone invalide');
  const cfg = gatewayConfig();
  if (!cfg.configured) throw bad('Passerelle SMS non configurée : choisissez un fournisseur et renseignez ses identifiants.');
  const r1 = await sendSms(cfg, to, `${getPlatformSettings().societe} : message de test de la passerelle SMS de la plateforme AI721 SchoolX CM.`);
  audit(req, 'SMS_TEST', `${to} : ${r1.ok ? 'envoyé' : r1.error}`);
  if (!r1.ok) throw bad(`Échec de l'envoi : ${r1.error}`);
  res.json({ ok: true, simulated: !!r1.simulated, id: r1.id });
});
r.get('/audit', (req, res) => {
  const q = req.query.q ? `%${str(req.query.q, { max: 60 })}%` : '%';
  res.json(pdb.prepare(`SELECT * FROM audit_log WHERE (COALESCE(username,'') || ' ' || action || ' ' || COALESCE(detail,'')) LIKE ? ORDER BY id DESC LIMIT 500`).all(q));
});

/* ---------------- Documents PDF ---------------- */
const platformDoc = (res, title, filename, landscape = false) => {
  const ps = getPlatformSettings();
  return P.createDoc(res, { title, filename, landscape, settings: { ...ps, nom: ps.societe } });
};
r.get('/pdf/acces/:id', (req, res) => {
  const t = mustTenant(req.params.id);
  const st = subscriptionStatus(t);
  const doc = platformDoc(res, "Fiche d'accès", `acces_${t.code}`);
  P.accessSheet(doc, { tenant: t, sub: st.current || st.subs[0], username: t.admin_username, password: unseal(t.admin_pw_enc), links: links(req, t.code) });
  audit(req, 'PDF_FICHE_ACCES', t.code);
  P.finalize(doc);
});
r.get('/pdf/recu/:id', (req, res) => {
  const sub = pdb.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id(req.params.id));
  if (!sub) throw new HttpError(404, 'Abonnement introuvable');
  const t = getTenant(sub.tenant_id);
  const doc = platformDoc(res, 'Reçu', `recu_${t.code}_${sub.annee}`);
  P.receipt(doc, { tenant: t, sub });
  audit(req, 'PDF_RECU', `${t.code} ${sub.annee}`);
  P.finalize(doc);
});
r.get('/pdf/etablissements', (req, res) => {
  const ts = pdb.prepare('SELECT * FROM tenants ORDER BY name').all().map((t) => summary(req, t));
  const year = schoolYearOf(); const subs = pdb.prepare('SELECT * FROM subscriptions').all();
  const doc = platformDoc(res, 'Établissements', 'etablissements_abonnes', true);
  P.tenantsList(doc, ts, { total: ts.length, actifs: ts.filter((t) => t.valid).length, inactifs: ts.filter((t) => !t.valid).length,
    eleves: ts.reduce((a, t) => a + (t.eleves || 0), 0), recettes_annee: subs.filter((s) => s.annee === year && s.paid).reduce((a, s) => a + s.montant, 0),
    recettes_total: subs.filter((s) => s.paid).reduce((a, s) => a + s.montant, 0) });
  P.finalize(doc);
});

export default r;
