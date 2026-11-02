// Chronogramme des dépôts des documents périodiques : import du fichier (Word ou PDF), échéances, rappels,
// modèles Word pré-remplis, enregistrement des dépôts (avec la pièce déposée).
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db, tx, audit, getSettings, applyTerms } from '../db.js';
import { str, num, id, date, oneOf, bad, HttpError } from '../util.js';
import { requireRole } from './access.js';
import { TENANTS_DIR } from '../platform.js';
import { readChronogramme, extractEcheances, detectModele, MODELES } from '../chrono.js';
import { buildModele } from '../modeles.js';

const r = Router();
r.use(requireRole('admin'));
const today = () => new Date().toISOString().slice(0, 10);
const dirOf = (req, sub) => { const d = path.join(TENANTS_DIR, req.tenant.code, sub); fs.mkdirSync(d, { recursive: true }); return d; };
const MAX = 10 * 1024 * 1024;
const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
// nom de fichier ASCII (accents retirés) : l'en-tête filename* (RFC 5987) n'est pas compris par tous les navigateurs
const disposition = (kind, name) => `${kind}; filename="${String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '') || 'document'}"`;
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/** État d'une échéance : déposé, en retard, aujourd'hui, bientôt (dans le délai de rappel), à venir. */
export function etat(e, t = today()) {
  if (e.status === 'depose') return { etat: 'depose', jours: null };
  const j = daysBetween(t, e.date_limite);
  return { etat: j < 0 ? 'retard' : j === 0 ? 'aujourdhui' : j <= (e.rappel_jours ?? 7) ? 'bientot' : 'a_venir', jours: j };
}
/** Échéances à rappeler (en retard, du jour ou proches) : tableau de bord et connexion de l'administrateur. */
export function rappels() {
  const annee = getSettings().annee_scolaire;
  return db.prepare("SELECT * FROM echeances WHERE annee = ? AND status = 'a_produire' ORDER BY date_limite").all(annee)
    .map((e) => ({ ...e, ...etat(e) })).filter((e) => e.etat !== 'a_venir');
}
/** Fichier transmis en base64 (Word ou PDF, 10 Mo au plus). */
function readUpload(b) {
  const name = str(b.nom_fichier, { max: 200, required: true, label: 'Nom du fichier' });
  const ext = (/\.(pdf|docx)$/i.exec(name)?.[1] || '').toLowerCase();
  if (!ext) throw bad(/\.doc$/i.test(name) ? 'Ancien format Word (.doc) : enregistrez le fichier au format .docx, puis importez-le.' : 'Importez un document Word (.docx) ou PDF.');
  const data = String(b.data || '').replace(/^data:[^,]*,/, '');
  if (!data || !/^[A-Za-z0-9+/=\s]+$/.test(data)) throw bad('Fichier illisible');
  const buf = Buffer.from(data, 'base64');
  if (!buf.length) throw bad('Fichier vide');
  if (buf.length > MAX) throw bad('Fichier trop volumineux (10 Mo au plus)');
  if (ext === 'pdf' && buf.subarray(0, 5).toString() !== '%PDF-') throw bad("Ce fichier n'est pas un PDF valide.");
  if (ext === 'docx' && buf.subarray(0, 2).toString() !== 'PK') throw bad("Ce fichier n'est pas un document Word (.docx) valide.");
  return { name, ext, buf };
}
async function propose(buf, name) {
  const s = getSettings();
  const content = await readChronogramme(buf, name);
  const periods = db.prepare('SELECT seq, start_date, end_date FROM periods ORDER BY seq').all();
  const items = extractEcheances(content.rows, { y0: +String(s.annee_scolaire).slice(0, 4), periods, term: s.terme_sequence === 'Situation' ? 'situation' : 'séquence' });
  return { lignes: content.rows.length, propositions: items.map((x) => ({ ...x, titre: applyTerms(x.titre, s) })) };
}

r.get('/', (_req, res) => {
  const s = getSettings();
  const echeances = db.prepare('SELECT e.*, c.titre chronogramme FROM echeances e LEFT JOIN chronogrammes c ON c.id = e.chronogramme_id WHERE e.annee = ? ORDER BY e.date_limite, e.id').all(s.annee_scolaire)
    .map((e) => ({ ...e, ...etat(e), depot_fichier: undefined, a_fichier: !!e.depot_fichier }));
  const n = (k) => echeances.filter((e) => e.etat === k).length;
  res.json({ annee: s.annee_scolaire, modeles: MODELES,
    chronogrammes: db.prepare('SELECT id, titre, nom_fichier, mime, taille, extraits, uploaded_at FROM chronogrammes WHERE annee = ? ORDER BY id DESC').all(s.annee_scolaire),
    echeances, stats: { total: echeances.length, depose: n('depose'), retard: n('retard'), proches: n('aujourdhui') + n('bientot'), a_venir: n('a_venir') } });
});
r.get('/rappels', (_req, res) => res.json(rappels()));

// Import d'un chronogramme : enregistrement du fichier et propositions d'échéances à vérifier
r.post('/chronogrammes', async (req, res) => {
  const f = readUpload(req.body || {});
  const titre = str(req.body.titre, { max: 150, label: 'Titre' }) || f.name.replace(/\.(pdf|docx)$/i, '');
  let analyse;
  try { analyse = await propose(f.buf, f.name); } catch (e) { if (e.status) throw e; analyse = { lignes: 0, propositions: [], erreur: 'Le contenu du fichier n’a pas pu être lu automatiquement.' }; }
  const s = getSettings();
  const info = db.prepare('INSERT INTO chronogrammes(titre, annee, fichier, nom_fichier, mime, taille, uploaded_by) VALUES(?,?,?,?,?,?,?)')
    .run(titre, s.annee_scolaire, '', f.name, MIME[f.ext], f.buf.length, req.user.id);
  const cid = Number(info.lastInsertRowid);
  const file = `${cid}.${f.ext}`;
  fs.writeFileSync(path.join(dirOf(req, 'chronogrammes'), file), f.buf);
  db.prepare('UPDATE chronogrammes SET fichier = ? WHERE id = ?').run(file, cid);
  audit(req, 'CHRONOGRAMME_IMPORTE', `${titre} (${f.name}, ${analyse.propositions.length} échéance(s) repérée(s))`);
  res.status(201).json({ id: cid, titre, ...analyse,
    message: analyse.propositions.length ? null : analyse.lignes ? 'Aucune date limite reconnue dans ce document : ajoutez les échéances manuellement.'
      : 'Aucun texte lisible (document scanné ou image) : ajoutez les échéances manuellement en consultant le fichier.' });
});
r.post('/chronogrammes/:id/analyser', async (req, res) => {
  const c = db.prepare('SELECT * FROM chronogrammes WHERE id = ?').get(id(req.params.id));
  if (!c) throw new HttpError(404, 'Chronogramme introuvable');
  const buf = fs.readFileSync(path.join(dirOf(req, 'chronogrammes'), path.basename(c.fichier)));
  res.json({ id: c.id, titre: c.titre, ...(await propose(buf, c.nom_fichier)) });
});
r.get('/chronogrammes/:id/fichier', (req, res) => {
  const c = db.prepare('SELECT * FROM chronogrammes WHERE id = ?').get(id(req.params.id));
  if (!c) throw new HttpError(404, 'Chronogramme introuvable');
  const file = path.join(dirOf(req, 'chronogrammes'), path.basename(c.fichier));
  if (!fs.existsSync(file)) throw new HttpError(404, 'Fichier introuvable sur le serveur');
  res.type(c.mime); res.setHeader('Content-Disposition', disposition(c.mime === MIME.pdf ? 'inline' : 'attachment', c.nom_fichier));
  res.sendFile(file);
});
r.delete('/chronogrammes/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM chronogrammes WHERE id = ?').get(id(req.params.id));
  if (!c) throw new HttpError(404, 'Chronogramme introuvable');
  const keep = req.query.garder !== '0';
  tx(() => {
    if (!keep) db.prepare("DELETE FROM echeances WHERE chronogramme_id = ? AND status = 'a_produire'").run(c.id);
    db.prepare('DELETE FROM chronogrammes WHERE id = ?').run(c.id);
  });
  fs.rmSync(path.join(dirOf(req, 'chronogrammes'), path.basename(c.fichier)), { force: true });
  audit(req, 'CHRONOGRAMME_SUPPRIME', c.titre);
  res.json({ ok: true });
});

/* ---------- Échéances ---------- */
const echeanceBody = (b, partial = false) => {
  const o = {};
  if (!partial || 'titre' in b) o.titre = str(b.titre, { max: 220, required: true, label: 'Document à produire' });
  if (!partial || 'date_limite' in b) { o.date_limite = date(b.date_limite, 'Date limite'); if (!o.date_limite) throw bad('Date limite obligatoire'); }
  if (!partial || 'destinataire' in b) o.destinataire = str(b.destinataire, { max: 120 }) || null;
  if (!partial || 'modele' in b) o.modele = b.modele ? oneOf(b.modele, Object.keys(MODELES), 'Modèle') : detectModele(o.titre || '');
  if (!partial || 'rappel_jours' in b) o.rappel_jours = b.rappel_jours == null || b.rappel_jours === '' ? 7 : num(b.rappel_jours, { min: 0, max: 60, int: true, label: 'Rappel (jours)' });
  if ('periodicite' in b) o.periodicite = b.periodicite ? oneOf(b.periodicite, ['ponctuel', 'mensuel', 'sequentiel', 'trimestriel', 'annuel'], 'Périodicité') : null;
  if ('observation' in b) o.observation = str(b.observation, { max: 500 });
  if ('source' in b) o.source = str(b.source, { max: 300 });
  return o;
};
r.post('/echeances', (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [b];
  if (!items.length || items.length > 300) throw bad('1 à 300 échéances');
  const cid = b.chronogramme_id ? id(b.chronogramme_id) : null;
  if (cid && !db.prepare('SELECT 1 FROM chronogrammes WHERE id = ?').get(cid)) throw bad('Chronogramme inconnu');
  const annee = getSettings().annee_scolaire;
  const ins = db.prepare(`INSERT INTO echeances(chronogramme_id, annee, titre, date_limite, destinataire, modele, periodicite, source, rappel_jours, observation)
    VALUES(?,?,?,?,?,?,?,?,?,?)`);
  const ids = tx(() => items.map((x, i) => {
    let o; try { o = echeanceBody(x); } catch (e) { throw bad(`Ligne ${i + 1} : ${e.message}`); }
    return Number(ins.run(cid, annee, o.titre, o.date_limite, o.destinataire, o.modele, o.periodicite || 'ponctuel', o.source || null, o.rappel_jours, o.observation || null).lastInsertRowid);
  }));
  if (cid) db.prepare('UPDATE chronogrammes SET extraits = extraits + ? WHERE id = ?').run(ids.length, cid);
  audit(req, 'ECHEANCES_AJOUTEES', `${ids.length} échéance(s)`);
  res.status(201).json({ ids });
});
const one = (rid) => { const e = db.prepare('SELECT * FROM echeances WHERE id = ?').get(id(rid)); if (!e) throw new HttpError(404, 'Échéance introuvable'); return e; };
r.put('/echeances/:id', (req, res) => {
  const e = one(req.params.id); const o = echeanceBody(req.body || {}, true);
  const keys = Object.keys(o); if (!keys.length) throw bad('Rien à modifier');
  db.prepare(`UPDATE echeances SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => o[k]), e.id);
  audit(req, 'ECHEANCE_MODIFIEE', e.titre);
  res.json({ ok: true });
});
r.delete('/echeances/:id', (req, res) => {
  const e = one(req.params.id);
  db.prepare('DELETE FROM echeances WHERE id = ?').run(e.id);
  if (e.depot_fichier) fs.rmSync(path.join(dirOf(req, 'depots'), path.basename(e.depot_fichier)), { force: true });
  audit(req, 'ECHEANCE_SUPPRIMEE', e.titre);
  res.json({ ok: true });
});
// Modèle Word pré-rempli du document à produire
r.get('/echeances/:id/modele', (req, res) => {
  const e = one(req.params.id);
  const { buf, filename } = buildModele(e);
  audit(req, 'MODELE_WORD', e.titre);
  res.type(MIME.docx); res.setHeader('Content-Disposition', disposition('attachment', filename));
  res.send(buf);
});
r.get('/modeles/:type', (req, res) => {
  const type = oneOf(req.params.type, Object.keys(MODELES), 'Modèle');
  const { buf, filename } = buildModele({ titre: MODELES[type], modele: type });
  res.type(MIME.docx); res.setHeader('Content-Disposition', disposition('attachment', filename));
  res.send(buf);
});
// Dépôt : date, observation et, facultativement, le document déposé (Word ou PDF)
r.post('/echeances/:id/depot', (req, res) => {
  const e = one(req.params.id); const b = req.body || {};
  const d = date(b.date || today(), 'Date de dépôt');
  if (d > today()) throw bad('La date de dépôt ne peut pas être future');
  let file = e.depot_fichier, nom = e.depot_nom;
  if (b.data) {
    const f = readUpload(b);
    if (file) fs.rmSync(path.join(dirOf(req, 'depots'), path.basename(file)), { force: true });
    file = `${e.id}-${Date.now()}.${f.ext}`; nom = f.name;
    fs.writeFileSync(path.join(dirOf(req, 'depots'), file), f.buf);
  }
  db.prepare("UPDATE echeances SET status = 'depose', depose_at = ?, depose_by = ?, depot_fichier = ?, depot_nom = ?, observation = COALESCE(?, observation) WHERE id = ?")
    .run(d, req.user.id, file, nom, str(b.observation, { max: 500 }), e.id);
  audit(req, 'DOCUMENT_DEPOSE', `${e.titre} — ${d}${nom ? ` (${nom})` : ''}`);
  res.json({ ok: true });
});
r.post('/echeances/:id/annuler-depot', (req, res) => {
  const e = one(req.params.id);
  db.prepare("UPDATE echeances SET status = 'a_produire', depose_at = NULL, depose_by = NULL WHERE id = ?").run(e.id);
  audit(req, 'DEPOT_ANNULE', e.titre);
  res.json({ ok: true });
});
r.get('/echeances/:id/depot', (req, res) => {
  const e = one(req.params.id);
  if (!e.depot_fichier) throw new HttpError(404, 'Aucun document déposé');
  const file = path.join(dirOf(req, 'depots'), path.basename(e.depot_fichier));
  if (!fs.existsSync(file)) throw new HttpError(404, 'Fichier introuvable sur le serveur');
  const pdf = /\.pdf$/i.test(e.depot_fichier);
  res.type(pdf ? MIME.pdf : MIME.docx); res.setHeader('Content-Disposition', disposition(pdf ? 'inline' : 'attachment', e.depot_nom || path.basename(file)));
  res.sendFile(file);
});

export default r;
