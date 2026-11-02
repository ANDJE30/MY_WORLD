// Messages aux parents d'élèves : remise des bulletins, réunion des parents, informations — personnalisés avec le nom de l'enfant.
// Envoi automatique par la passerelle SMS d'AI721, ou envoi manuel (WhatsApp / SMS depuis le téléphone de l'administration), ou export CSV.
import { Router } from 'express';
import { db, tx, audit, getSettings, applyTerms } from '../db.js';
import { str, id, bool, oneOf, bad, HttpError } from '../util.js';
import { requireRole } from './access.js';
import { normalizePhone, smsInfo, gatewayConfig, sendSms, gsmify } from '../sms.js';
import { inTenant } from '../platform.js';

const r = Router();
r.use(requireRole('admin'));

export const MODELES = {
  bulletins: { titre: 'Remise des bulletins', vars: ['periode', 'date', 'heure', 'lieu'],
    texte: 'Chers parents, les bulletins {periode} de {enfant} ({classe}) seront remis le {date} à {heure}, {lieu}. Merci de votre présence. {etablissement}' },
  reunion: { titre: 'Réunion des parents', vars: ['date', 'heure', 'lieu', 'objet'],
    texte: 'Chers parents de {enfant} ({classe}), vous êtes conviés à la réunion des parents le {date} à {heure}, {lieu}. Ordre du jour : {objet}. Votre présence est vivement souhaitée. {etablissement}' },
  information: { titre: 'Information aux parents', vars: ['objet'],
    texte: 'Chers parents de {enfant} ({classe}), {objet} {etablissement}' },
  libre: { titre: 'Message libre', vars: [], texte: '' }
};
export const VARIABLES = { enfant: "Nom de l'enfant (ou des enfants)", classe: 'Classe', parent: 'Nom du parent', matricule: 'Matricule',
  etablissement: "Nom de l'établissement", sigle: 'Sigle', periode: 'Période', date: 'Date', heure: 'Heure', lieu: 'Lieu', objet: 'Objet / ordre du jour' };

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const dateLongue = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return Number.isNaN(d.getTime()) ? iso : `${JOURS[d.getUTCDay()]} ${d.getUTCDate() === 1 ? '1er' : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const heureFr = (h) => (/^\d{2}:\d{2}$/.test(h) ? `${+h.slice(0, 2)} h${h.slice(3) === '00' ? '' : ' ' + h.slice(3)}` : h);
const liste = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`);

/** Lecture et contrôle d'une demande (texte, variables, classes, regroupement par numéro). */
function readRequest(b) {
  const texte = str(b.texte, { max: 1000, required: true, label: 'Texte du message' });
  const modele = b.modele ? oneOf(b.modele, Object.keys(MODELES), 'Modèle') : 'libre';
  const v = b.variables || {};
  const variables = {};
  for (const k of ['periode', 'date', 'heure', 'lieu', 'objet']) variables[k] = str(v[k], { max: k === 'objet' ? 400 : 120, label: VARIABLES[k] }) || '';
  if (variables.date && !/^\d{4}-\d{2}-\d{2}$/.test(variables.date)) throw bad('Date invalide');
  const used = [...texte.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const unknown = used.filter((k) => !VARIABLES[k]);
  if (unknown.length) throw bad(`Champ(s) inconnu(s) dans le texte : ${unknown.map((k) => `{${k}}`).join(', ')}`);
  const missing = used.filter((k) => ['periode', 'date', 'heure', 'lieu', 'objet'].includes(k) && !variables[k]);
  if (missing.length) throw bad(`Renseignez : ${missing.map((k) => VARIABLES[k].toLowerCase()).join(', ')}`);
  const classIds = Array.isArray(b.class_ids) ? b.class_ids.map((x) => id(x, 'Classe')) : [];
  for (const c of classIds) if (!db.prepare('SELECT 1 FROM classes WHERE id = ?').get(c)) throw bad('Classe inconnue');
  return { texte, modele, variables, classIds, regrouper: b.regrouper !== false && b.regrouper !== 'false', optimiser: b.optimiser !== false && b.optimiser !== 'false' };
}

/** Destinataires : un message par numéro (enfants regroupés) ou par élève, avec le texte personnalisé. */
function buildMessages({ texte, variables, classIds, regrouper, optimiser }) {
  const s = getSettings();
  const where = classIds.length ? `AND st.class_id IN (${classIds.map(() => '?').join(',')})` : '';
  const students = db.prepare(`SELECT st.id, st.matricule, st.nom, st.prenom, st.parent_nom, st.parent_tel, c.name classe FROM students st
    JOIN classes c ON c.id = st.class_id WHERE st.active = 1 ${where} ORDER BY c.name, st.nom COLLATE NOCASE, st.prenom COLLATE NOCASE`).all(...classIds);
  const sansTel = [], invalides = [], groups = new Map();
  for (const st of students) {
    if (!st.parent_tel) { sansTel.push({ eleve: `${st.nom} ${st.prenom}`.trim(), classe: st.classe }); continue; }
    const phone = normalizePhone(st.parent_tel);
    if (!phone) { invalides.push({ eleve: `${st.nom} ${st.prenom}`.trim(), classe: st.classe, tel: st.parent_tel }); continue; }
    const key = regrouper ? phone : `${phone}#${st.id}`;
    const g = groups.get(key) || { phone, parent: st.parent_nom || '', eleves: [] };
    g.eleves.push(st); if (!g.parent && st.parent_nom) g.parent = st.parent_nom;
    groups.set(key, g);
  }
  const fill = (g) => {
    const vals = {
      enfant: liste(g.eleves.map((e) => `${e.nom} ${e.prenom}`.trim())), classe: [...new Set(g.eleves.map((e) => e.classe))].join(', '),
      parent: g.parent, matricule: g.eleves.map((e) => e.matricule).join(', '), etablissement: s.nom, sigle: s.nom_court || s.nom,
      periode: applyTerms(variables.periode, s), date: variables.date ? dateLongue(variables.date) : '', heure: heureFr(variables.heure), lieu: variables.lieu, objet: variables.objet
    };
    const out = texte.replace(/\{(\w+)\}/g, (_m, k) => vals[k] ?? '').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
    return optimiser ? gsmify(out) : out;
  };
  const messages = [...groups.values()].map((g) => { const message = fill(g); const info = smsInfo(message);
    return { phone: g.phone, parent: g.parent, enfants: g.eleves.map((e) => `${e.nom} ${e.prenom}`.trim()).join(' ; '), classes: [...new Set(g.eleves.map((e) => e.classe))].join(', '),
      student_ids: g.eleves.map((e) => e.id).join(','), message, segments: info.segments, encoding: info.encoding, unicode: info.unicode }; });
  return { messages, eleves: students.length, sansTel, invalides };
}

r.get('/modeles', (_req, res) => {
  const g = gatewayConfig();
  const periodes = db.prepare('SELECT seq FROM periods ORDER BY seq').all();
  const s = getSettings();
  res.json({ modeles: MODELES, variables: VARIABLES, passerelle: { provider: g.provider, label: g.label, configured: g.configured },
    periodes: [...[1, 2, 3].map((t) => `du ${t === 1 ? '1er' : `${t}e`} trimestre`), ...periodes.map((p) => applyTerms(`de la séquence ${p.seq}`, s)), "de fin d'année"],
    classes: db.prepare(`SELECT c.id, c.name, (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.active = 1) eleves,
      (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.active = 1 AND COALESCE(st.parent_tel, '') != '') avec_tel FROM classes c ORDER BY c.name`).all() });
});

r.post('/apercu', (req, res) => {
  const q = readRequest(req.body || {});
  const out = buildMessages(q);
  const seg = out.messages.reduce((a, m) => a + m.segments, 0);
  res.json({ destinataires: out.messages.length, eleves: out.eleves, sans_tel: out.sansTel, invalides: out.invalides, sms: seg,
    exemples: out.messages.slice(0, 4), max_segments: Math.max(0, ...out.messages.map((m) => m.segments)), unicode: [...new Set(out.messages.flatMap((m) => m.unicode))],
    ...(req.body.complet ? { tous: out.messages.slice(0, 5000) } : {}) });
});

/** Envoi en arrière-plan par la passerelle (5 envois simultanés), dans le contexte de l'établissement. */
function dispatch(tenant, campaignId, ids) {
  const cfg = gatewayConfig();
  const queue = [...ids];
  const worker = async () => {
    for (let mid = queue.shift(); mid; mid = queue.shift()) {
      const m = inTenant(tenant, () => db.prepare('SELECT * FROM parent_messages WHERE id = ?').get(mid));
      if (!m) continue;
      const out = await sendSms(cfg, m.phone, m.message);
      inTenant(tenant, () => tx(() => {
        db.prepare('UPDATE parent_messages SET status = ?, provider_id = ?, error = ?, sent_at = unixepoch() WHERE id = ?')
          .run(out.ok ? (out.simulated ? 'simule' : 'envoye') : 'echec', out.id || null, out.ok ? null : String(out.error).slice(0, 200), mid);
        refreshCounts(campaignId);
      }));
    }
  };
  return Promise.all(Array.from({ length: Math.min(5, ids.length) }, worker));
}
function refreshCounts(cid) {
  db.prepare(`UPDATE parent_campaigns SET envoyes = (SELECT COUNT(*) FROM parent_messages WHERE campaign_id = ? AND status IN ('envoye','simule')),
    echecs = (SELECT COUNT(*) FROM parent_messages WHERE campaign_id = ? AND status = 'echec'),
    en_cours = (SELECT COUNT(*) FROM parent_messages WHERE campaign_id = ? AND status = 'en_cours') WHERE id = ?`).run(cid, cid, cid, cid);
}

r.post('/campagnes', async (req, res) => {
  const b = req.body || {};
  const q = readRequest(b);
  const canal = oneOf(b.canal || 'manuel', ['sms', 'manuel'], "Mode d'envoi");
  const titre = str(b.titre, { max: 120, label: 'Titre' }) || MODELES[q.modele].titre;
  const { messages } = buildMessages(q);
  if (!messages.length) throw bad('Aucun destinataire : aucun parent de la sélection n’a de numéro de téléphone valide.');
  if (messages.length > 5000) throw bad('5 000 destinataires au plus par envoi');
  let gw = null;
  if (canal === 'sms') { gw = gatewayConfig(); if (!gw.configured) throw bad("La passerelle SMS n'est pas configurée par AI721 TECH STUFF : utilisez l'envoi par WhatsApp ou SMS depuis votre téléphone, ou l'export CSV."); }
  const out = tx(() => {
    const info = db.prepare(`INSERT INTO parent_campaigns(titre, modele, texte, variables, canal, classes, total, created_by) VALUES(?,?,?,?,?,?,?,?)`)
      .run(titre, q.modele, q.texte, JSON.stringify(q.variables), canal, q.classIds.join(',') || null, messages.length, req.user.id);
    const cid = Number(info.lastInsertRowid);
    const ins = db.prepare(`INSERT INTO parent_messages(campaign_id, phone, parent, enfants, classes, student_ids, message, segments, status) VALUES(?,?,?,?,?,?,?,?,?)`);
    const ids = messages.map((m) => Number(ins.run(cid, m.phone, m.parent || null, m.enfants, m.classes, m.student_ids, m.message, m.segments, canal === 'sms' ? 'en_cours' : 'a_envoyer').lastInsertRowid));
    if (canal === 'sms') refreshCounts(cid);
    return { cid, ids };
  });
  audit(req, 'MESSAGE_PARENTS', `${titre} — ${messages.length} destinataire(s) — ${canal === 'sms' ? `SMS (${gw.label})` : 'envoi manuel'}`);
  if (canal === 'sms') {
    const job = dispatch(req.tenant, out.cid, out.ids);
    // petits envois (ou simulation) : on attend le résultat ; sinon l'envoi se poursuit en arrière-plan
    if (messages.length <= 30 || gw.provider === 'simulation') await job; else job.catch((e) => console.error('Envoi SMS :', e.message));
  }
  res.status(201).json(campaign(out.cid));
});

function campaign(cid) {
  const c = db.prepare('SELECT * FROM parent_campaigns WHERE id = ?').get(cid);
  if (!c) throw new HttpError(404, 'Envoi introuvable');
  return { ...c, variables: JSON.parse(c.variables || '{}') };
}
r.get('/campagnes', (_req, res) => {
  res.json(db.prepare(`SELECT c.*, u.full_name auteur, (SELECT COUNT(*) FROM parent_messages m WHERE m.campaign_id = c.id AND m.status = 'a_envoyer') a_envoyer
    FROM parent_campaigns c LEFT JOIN users u ON u.id = c.created_by ORDER BY c.id DESC LIMIT 200`).all());
});
r.get('/campagnes/:id', (req, res) => {
  const c = campaign(id(req.params.id));
  res.json({ ...c, messages: db.prepare('SELECT * FROM parent_messages WHERE campaign_id = ? ORDER BY classes, enfants').all(c.id) });
});
// Envoi manuel : l'administration a ouvert WhatsApp ou l'application SMS pour ce parent
r.post('/messages/:id/envoye', (req, res) => {
  const m = db.prepare('SELECT * FROM parent_messages WHERE id = ?').get(id(req.params.id));
  if (!m) throw new HttpError(404, 'Message introuvable');
  const canal = oneOf(req.body.canal || 'whatsapp', ['whatsapp', 'sms'], 'Canal');
  tx(() => { db.prepare("UPDATE parent_messages SET status = 'envoye', provider_id = ?, sent_at = unixepoch(), error = NULL WHERE id = ?").run(canal, m.id); refreshCounts(m.campaign_id); });
  res.json({ ok: true });
});
// Nouvel essai des échecs par la passerelle
r.post('/campagnes/:id/relancer', async (req, res) => {
  const c = campaign(id(req.params.id));
  const gw = gatewayConfig();
  if (!gw.configured) throw bad("La passerelle SMS n'est pas configurée.");
  const ids = db.prepare(`SELECT id FROM parent_messages WHERE campaign_id = ? AND status IN ('echec'${bool(req.body.tous) ? ",'a_envoyer'" : ''})`).all(c.id).map((x) => x.id);
  if (!ids.length) throw bad('Aucun message à relancer');
  tx(() => { db.prepare(`UPDATE parent_messages SET status = 'en_cours' WHERE id IN (${ids.join(',')})`).run(); db.prepare("UPDATE parent_campaigns SET canal = 'sms' WHERE id = ?").run(c.id); refreshCounts(c.id); });
  audit(req, 'MESSAGE_PARENTS_RELANCE', `${c.titre} — ${ids.length} message(s)`);
  const job = dispatch(req.tenant, c.id, ids);
  if (ids.length <= 30 || gw.provider === 'simulation') await job; else job.catch(() => {});
  res.json(campaign(c.id));
});

export default r;
