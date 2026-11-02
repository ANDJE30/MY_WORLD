// Dossier administratif des enseignants : pointage, assiduité, documents administratifs (administration)
// et « Mes documents » (enseignant : consultation, accusé de réception, réponse à une demande d'explication).
import { Router } from 'express';
import { db, tx, audit, getSettings, HR_FIELDS } from '../db.js';
import { str, num, id, bool, date, oneOf, bad, HttpError } from '../util.js';
import { requireRole } from './access.js';
import {
  DOC_TYPES, DOC_STATUS, DEFAULT_AMPLIATIONS, GRADES, STATUTS, attendanceRange, attendanceSummary, attendanceBySeq, schoolDays, weeklyLoad,
  agentSnapshot, nextReference, suggestFacts, ensureDaysOff, todayIso, frDate
} from '../staff.js';

const r = Router();
const admin = requireRole('admin');
const teacher = requireRole('teacher');
const now = () => Math.floor(Date.now() / 1000);

const assertTeacher = (tid) => {
  const t = db.prepare("SELECT id, full_name FROM users WHERE id = ? AND role = 'teacher'").get(tid);
  if (!t) throw new HttpError(404, 'Enseignant introuvable');
  return t;
};
/** Absences/retards enrichis (classe, créneau horaire). */
function decorate(records) {
  const s = getSettings();
  const cls = new Map(db.prepare('SELECT id, name FROM classes').all().map((c) => [c.id, c.name]));
  return records.map((x) => ({ ...x, classe: x.class_id ? cls.get(x.class_id) : null,
    creneau: x.slot != null && s.time_slots[x.slot] ? `${s.time_slots[x.slot].start}–${s.time_slots[x.slot].end}` : null }));
}
function dossier(tid, q) {
  const range = attendanceRange(q);
  const summary = attendanceSummary(tid, range);
  summary.records = decorate(summary.records);
  return { range, summary, parSequence: attendanceBySeq(tid, range) };
}
const docRow = (d) => ({ ...d, data: undefined, type_label: DOC_TYPES[d.type].titre, type_court: DOC_TYPES[d.type].court, status_label: DOC_STATUS[d.status],
  en_retard: d.type === 'demande_explication' && d.status === 'emis' && d.echeance != null && d.echeance < now(),
  hors_delai: d.type === 'demande_explication' && d.reponse_at != null && d.echeance != null && d.reponse_at > d.echeance });

/* ======================= Administration ======================= */
r.get('/rh/referentiels', admin, (_req, res) => res.json({ types: DOC_TYPES, status: DOC_STATUS, ampliations: DEFAULT_AMPLIATIONS, grades: GRADES, statuts: STATUTS }));

r.get('/rh/enseignants', admin, (req, res) => {
  const range = attendanceRange(req.query);
  const days = schoolDays(range.from, range.to);
  const docs = db.prepare(`SELECT user_id, type, COUNT(*) n, SUM(type = 'demande_explication' AND status = 'emis') attente FROM staff_documents
    WHERE status != 'annule' AND annee = ? GROUP BY user_id, type`).all(getSettings().annee_scolaire);
  const rows = db.prepare(`SELECT id, full_name, sexe, matricule, specialite, phone, active, ${HR_FIELDS.join(', ')} FROM users WHERE role = 'teacher' ORDER BY full_name COLLATE NOCASE`).all()
    .map((u) => {
      const sm = attendanceSummary(u.id, range, days);
      const mine = docs.filter((d) => d.user_id === u.id);
      return { ...u, assiduite: { ...sm, records: undefined }, documents: Object.fromEntries(mine.map((d) => [d.type, d.n])), de_attente: mine.reduce((a, d) => a + (d.attente || 0), 0) };
    });
  res.json({ range, jours: days.length, rows });
});

r.get('/rh/enseignants/:id', admin, (req, res) => {
  const tid = id(req.params.id); assertTeacher(tid);
  const agent = agentSnapshot(tid);
  const docs = db.prepare('SELECT * FROM staff_documents WHERE user_id = ? ORDER BY date_doc DESC, id DESC').all(tid).map(docRow);
  res.json({ agent, load: weeklyLoad(tid), ...dossier(tid, req.query), documents: docs });
});

r.put('/rh/enseignants/:id', admin, (req, res) => {
  const tid = id(req.params.id); const t = assertTeacher(tid);
  const b = req.body || {}; const sets = [], vals = [];
  for (const f of HR_FIELDS) {
    if (!(f in b)) continue;
    const v = f.startsWith('date_') ? date(b[f] || null, f === 'date_naissance' ? 'Date de naissance' : 'Date de prise de service') : str(b[f], { max: f === 'acte_affectation' ? 250 : 120, label: f });
    sets.push(`${f} = ?`); vals.push(v);
  }
  if ('matricule' in b) { sets.push('matricule = ?'); vals.push(str(b.matricule, { max: 30 })); }
  if (!sets.length) throw bad('Aucune donnée à enregistrer');
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, tid);
  audit(req, 'DOSSIER_ENSEIGNANT', t.full_name);
  res.json(agentSnapshot(tid));
});

/* ---------- Pointage journalier (d'après l'emploi du temps) ---------- */
r.get('/rh/pointage', admin, (req, res) => {
  const d = date(req.query.date || todayIso(), 'Date');
  const s = getSettings();
  ensureDaysOff();
  const wd = new Date(d + 'T00:00:00Z').getUTCDay() || 7;
  const off = db.prepare('SELECT label FROM days_off WHERE date = ?').get(d);
  const period = db.prepare('SELECT seq FROM periods WHERE start_date <= ? AND end_date >= ?').get(d, d);
  const slots = db.prepare(`SELECT t.slot, t.class_id, c.name classe, sb.name subject, sb.code, cs.teacher_id, u.full_name teacher, t.room
    FROM timetable t JOIN class_subjects cs ON cs.id = t.class_subject_id JOIN subjects sb ON sb.id = cs.subject_id JOIN classes c ON c.id = t.class_id
    JOIN users u ON u.id = cs.teacher_id WHERE t.day = ? ORDER BY t.slot, u.full_name COLLATE NOCASE`).all(wd);
  const recs = db.prepare('SELECT * FROM staff_attendance WHERE date = ?').all(d);
  const rows = slots.map((x) => {
    const rec = recs.find((r) => r.user_id === x.teacher_id && r.slot === x.slot);
    const ts = s.time_slots[x.slot] || {};
    return { ...x, start: ts.start, end: ts.end, status: rec ? rec.kind : 'present', minutes: rec?.minutes || 0, justified: !!rec?.justified, motif: rec?.motif || '', record_id: rec?.id || null };
  });
  const dayRecords = decorate(recs.filter((r) => r.slot == null)).map((r) => ({ ...r, teacher: db.prepare('SELECT full_name FROM users WHERE id = ?').get(r.user_id)?.full_name }));
  res.json({ date: d, weekday: wd, actif: s.jours_actifs.includes(wd), ferie: off?.label || null, seq: period?.seq || null, rows, dayRecords });
});

r.put('/rh/pointage', admin, (req, res) => {
  const d = date(req.body.date, 'Date');
  if (!d) throw bad('Date obligatoire');
  if (d > todayIso()) throw bad('Le pointage ne peut pas porter sur une date future.');
  const entries = Array.isArray(req.body.entries) ? req.body.entries.slice(0, 2000) : [];
  const wd = new Date(d + 'T00:00:00Z').getUTCDay() || 7;
  let n = 0;
  tx(() => {
    const del = db.prepare('DELETE FROM staff_attendance WHERE user_id = ? AND date = ? AND slot = ?');
    const ins = db.prepare('INSERT INTO staff_attendance(user_id, date, kind, hours, minutes, slot, class_id, justified, motif, recorded_by) VALUES(?,?,?,?,?,?,?,?,?,?)');
    const dayAbs = db.prepare("SELECT 1 FROM staff_attendance WHERE user_id = ? AND date = ? AND slot IS NULL AND kind = 'absence'");
    for (const e of entries) {
      const tid = id(e.teacher_id, 'Enseignant'), slot = num(e.slot, { min: 0, max: 30, int: true, required: true, label: 'Créneau' });
      const st = oneOf(e.status, ['present', 'absence', 'retard'], 'Statut');
      // le créneau doit figurer à l'emploi du temps de l'enseignant ce jour-là
      const tt = db.prepare(`SELECT t.class_id FROM timetable t JOIN class_subjects cs ON cs.id = t.class_subject_id WHERE cs.teacher_id = ? AND t.day = ? AND t.slot = ?`).get(tid, wd, slot);
      if (!tt) throw bad("Créneau absent de l'emploi du temps de l'enseignant");
      del.run(tid, d, slot);
      if (st === 'present') continue;
      // absence déjà saisie pour toute la journée : les heures sont déjà décomptées
      if (dayAbs.get(tid, d)) continue;
      const minutes = st === 'retard' ? num(e.minutes, { min: 1, max: 600, int: true, required: true, label: 'Minutes de retard' }) : 0;
      ins.run(tid, d, st, st === 'absence' ? 1 : 0, minutes, slot, tt.class_id, bool(e.justified) ? 1 : 0, str(e.motif, { max: 200 }), req.user.id);
      n++;
    }
  });
  audit(req, 'POINTAGE', `${d} : ${n} absence(s)/retard(s)`);
  res.json({ ok: true, enregistrements: n });
});

/* ---------- Absences et retards (saisie libre, période d'absence) ---------- */
r.get('/rh/absences', admin, (req, res) => {
  const range = attendanceRange(req.query);
  const where = ['a.date BETWEEN ? AND ?']; const p = [range.from, range.to];
  if (req.query.teacher_id) { where.push('a.user_id = ?'); p.push(id(req.query.teacher_id)); }
  const rows = db.prepare(`SELECT a.*, u.full_name teacher FROM staff_attendance a JOIN users u ON u.id = a.user_id WHERE ${where.join(' AND ')} ORDER BY a.date DESC, u.full_name, a.slot`).all(...p);
  res.json({ range, rows: decorate(rows) });
});
r.post('/rh/absences', admin, (req, res) => {
  const b = req.body || {};
  const tid = id(b.teacher_id, 'Enseignant'); const t = assertTeacher(tid);
  const kind = oneOf(b.kind, ['absence', 'retard'], 'Nature');
  const d1 = date(b.date, 'Date'); if (!d1) throw bad('Date obligatoire');
  const d2 = date(b.date_fin || null, 'Date de fin') || d1;
  if (d2 < d1) throw bad('La date de fin doit suivre la date de début');
  if (d2 > todayIso()) throw bad('Impossible de saisir une absence ou un retard à une date future.');
  const justified = bool(b.justified) ? 1 : 0, motif = str(b.motif, { max: 200 });
  const ins = db.prepare('INSERT INTO staff_attendance(user_id, date, kind, hours, minutes, justified, motif, recorded_by) VALUES(?,?,?,?,?,?,?,?)');
  let n = 0;
  tx(() => {
    if (kind === 'retard') { ins.run(tid, d1, 'retard', 0, num(b.minutes, { min: 1, max: 600, int: true, required: true, label: 'Minutes de retard' }), justified, motif, req.user.id); n = 1; return; }
    if (b.hours != null && b.hours !== '' && d1 === d2) { ins.run(tid, d1, 'absence', num(b.hours, { min: 0.5, max: 16, required: true, label: 'Heures' }), 0, justified, motif, req.user.id); n = 1; return; }
    // absence sur une ou plusieurs journées : heures de cours prévues à l'emploi du temps de chaque jour de classe
    const load = weeklyLoad(tid);
    for (const d of schoolDays(d1, d2)) {
      const h = load.byDay[new Date(d + 'T00:00:00Z').getUTCDay() || 7] || 0;
      if (!h) continue;
      db.prepare('DELETE FROM staff_attendance WHERE user_id = ? AND date = ? AND kind = ?').run(tid, d, 'absence');
      ins.run(tid, d, 'absence', Math.round(h * 10) / 10, 0, justified, motif, req.user.id); n++;
    }
  });
  if (!n) throw bad("Aucune heure de cours prévue pour cet enseignant sur ces dates (jours non ouvrés, vacances ou emploi du temps vide).");
  audit(req, 'ABSENCE_ENSEIGNANT', `${t.full_name} : ${kind} ${d1}${d2 !== d1 ? ' → ' + d2 : ''}`);
  res.status(201).json({ ok: true, enregistrements: n });
});
r.put('/rh/absences/:id', admin, (req, res) => {
  const aid = id(req.params.id);
  const a = db.prepare('SELECT * FROM staff_attendance WHERE id = ?').get(aid);
  if (!a) throw new HttpError(404, 'Enregistrement introuvable');
  db.prepare('UPDATE staff_attendance SET justified = ?, motif = ? WHERE id = ?').run(bool(req.body.justified) ? 1 : 0, str(req.body.motif, { max: 200 }), aid);
  audit(req, 'ABSENCE_MODIFIEE', `${a.date} ${req.body.justified ? 'justifiée' : 'non justifiée'}`);
  res.json({ ok: true });
});
r.delete('/rh/absences/:id', admin, (req, res) => {
  const a = db.prepare('SELECT * FROM staff_attendance WHERE id = ?').get(id(req.params.id));
  if (!a) throw new HttpError(404, 'Enregistrement introuvable');
  db.prepare('DELETE FROM staff_attendance WHERE id = ?').run(a.id);
  audit(req, 'ABSENCE_SUPPRIMEE', `${a.date} (${a.kind})`);
  res.json({ ok: true });
});

/* ---------- Jours non ouvrés ---------- */
r.get('/rh/jours-feries', admin, (_req, res) => { ensureDaysOff(); res.json(db.prepare('SELECT * FROM days_off ORDER BY date').all()); });
r.post('/rh/jours-feries', admin, (req, res) => {
  const d = date(req.body.date, 'Date'); if (!d) throw bad('Date obligatoire');
  const label = str(req.body.label, { max: 80, required: true, label: 'Libellé' });
  db.prepare('INSERT INTO days_off(date, label) VALUES(?, ?) ON CONFLICT(date) DO UPDATE SET label = excluded.label').run(d, label);
  audit(req, 'JOUR_NON_OUVRE', `${d} ${label}`);
  res.status(201).json({ ok: true });
});
r.delete('/rh/jours-feries/:date', admin, (req, res) => {
  const d = date(req.params.date, 'Date');
  db.prepare('DELETE FROM days_off WHERE date = ?').run(d);
  audit(req, 'JOUR_NON_OUVRE_RETIRE', d);
  res.json({ ok: true });
});

/* ---------- Documents administratifs ---------- */
r.get('/rh/documents', admin, (req, res) => {
  const where = ['1=1'], p = [];
  const annee = req.query.annee || getSettings().annee_scolaire;
  if (annee !== 'toutes') { where.push('d.annee = ?'); p.push(str(annee, { max: 9 })); }
  if (req.query.type) { where.push('d.type = ?'); p.push(oneOf(req.query.type, Object.keys(DOC_TYPES), 'Type')); }
  if (req.query.status) { where.push('d.status = ?'); p.push(oneOf(req.query.status, Object.keys(DOC_STATUS), 'Statut')); }
  if (req.query.teacher_id) { where.push('d.user_id = ?'); p.push(id(req.query.teacher_id)); }
  const rows = db.prepare(`SELECT d.*, COALESCE(u.full_name, json_extract(d.data, '$.agent.full_name')) agent FROM staff_documents d LEFT JOIN users u ON u.id = d.user_id
    WHERE ${where.join(' AND ')} ORDER BY d.date_doc DESC, d.id DESC`).all(...p).map(docRow);
  const annees = db.prepare('SELECT DISTINCT annee FROM staff_documents ORDER BY annee DESC').all().map((x) => x.annee);
  res.json({ annee, annees, rows });
});
r.get('/rh/documents/faits', admin, (req, res) => {
  const tid = id(req.query.teacher_id, 'Enseignant'); assertTeacher(tid);
  res.json(suggestFacts(tid, attendanceRange(req.query)));
});
r.get('/rh/documents/:id', admin, (req, res) => {
  const d = db.prepare('SELECT * FROM staff_documents WHERE id = ?').get(id(req.params.id));
  if (!d) throw new HttpError(404, 'Document introuvable');
  res.json({ ...docRow(d), data: JSON.parse(d.data) });
});

r.post('/rh/documents', admin, (req, res) => {
  const b = req.body || {};
  const tid = id(b.teacher_id, 'Enseignant'); assertTeacher(tid);
  const type = oneOf(b.type, Object.keys(DOC_TYPES), 'Type de document');
  const s = getSettings();
  const agent = agentSnapshot(tid);
  const date_doc = date(b.date_doc || todayIso(), 'Date du document');
  const data = { agent, signataire: { chef_titre: s.chef_titre, chef_nom: s.chef_nom } };
  let faits = str(b.faits, { max: 4000, label: 'Faits' }), objet = str(b.objet, { max: 200, label: 'Objet' }), delai = null, refDoc = null;
  if (type === 'prise_service') {
    if (!agent.date_prise_service) throw bad("Renseignez d'abord la date de prise de service dans le dossier de l'enseignant.");
  } else if (type === 'presence') {
    const range = attendanceRange(b);
    const sm = attendanceSummary(tid, range);
    if (!sm.dues) throw bad("Aucune heure de cours due sur cette période : vérifiez l'emploi du temps de l'enseignant et le calendrier.");
    data.assiduite = { ...sm, records: undefined }; data.parSequence = attendanceBySeq(tid, range);
  } else {
    if (!faits || faits.length < 10) throw bad('Décrivez précisément les faits reprochés (10 caractères au moins).');
    if (type === 'demande_explication') delai = num(b.delai_heures ?? 72, { min: 24, max: 720, int: true, label: 'Délai de réponse (heures)' });
    if (b.ref_doc_id) {
      refDoc = db.prepare('SELECT id, user_id FROM staff_documents WHERE id = ?').get(id(b.ref_doc_id));
      if (!refDoc || refDoc.user_id !== tid) throw bad('Document de référence invalide');
    }
    objet ||= DOC_TYPES[type].titre;
  }
  const amp = str(b.ampliations, { max: 500 }) ?? DEFAULT_AMPLIATIONS[type].join('\n');
  const out = tx(() => {
    const { num: n, reference } = nextReference(type, s.annee_scolaire);
    const info = db.prepare(`INSERT INTO staff_documents(user_id, type, annee, num, reference, date_doc, objet, faits, ampliations, data, ref_doc_id, delai_heures, created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(tid, type, s.annee_scolaire, n, reference, date_doc, objet, faits, amp, JSON.stringify(data), refDoc?.id ?? null, delai, req.user.id);
    return { id: Number(info.lastInsertRowid), reference };
  });
  audit(req, 'DOCUMENT_ADMIN_EMIS', `${DOC_TYPES[type].court} ${out.reference} — ${agent.full_name}`);
  res.status(201).json(out);
});

r.put('/rh/documents/:id', admin, (req, res) => {
  const d = db.prepare('SELECT * FROM staff_documents WHERE id = ?').get(id(req.params.id));
  if (!d) throw new HttpError(404, 'Document introuvable');
  if (d.status !== 'emis' || d.ack_at) throw bad("Ce document a déjà été remis à l'intéressé(e) : il ne peut plus être modifié. Annulez-le et émettez-en un nouveau si nécessaire.");
  const b = req.body || {};
  const faits = 'faits' in b ? str(b.faits, { max: 4000 }) : d.faits;
  if (DOC_TYPES[d.type].lettre && (!faits || faits.length < 10)) throw bad('Décrivez précisément les faits reprochés (10 caractères au moins).');
  db.prepare('UPDATE staff_documents SET date_doc = ?, objet = ?, faits = ?, ampliations = ?, delai_heures = ? WHERE id = ?').run(
    'date_doc' in b ? date(b.date_doc, 'Date du document') || d.date_doc : d.date_doc, 'objet' in b ? str(b.objet, { max: 200 }) : d.objet, faits,
    'ampliations' in b ? str(b.ampliations, { max: 500 }) : d.ampliations,
    d.type === 'demande_explication' && 'delai_heures' in b ? num(b.delai_heures, { min: 24, max: 720, int: true, label: 'Délai' }) : d.delai_heures, d.id);
  audit(req, 'DOCUMENT_ADMIN_MODIFIE', d.reference);
  res.json({ ok: true });
});

/** Remise du document en main propre : date de réception (point de départ du délai de réponse). */
function acknowledge(d, at) {
  if (d.ack_at) return;
  db.prepare('UPDATE staff_documents SET ack_at = ?, echeance = CASE WHEN delai_heures IS NOT NULL THEN ? + delai_heures * 3600 ELSE NULL END WHERE id = ?').run(at, at, d.id);
}
r.post('/rh/documents/:id/remise', admin, (req, res) => {
  const d = db.prepare('SELECT * FROM staff_documents WHERE id = ?').get(id(req.params.id));
  if (!d) throw new HttpError(404, 'Document introuvable');
  if (d.status === 'annule') throw bad('Document annulé');
  if (d.ack_at) throw bad(`Réception déjà enregistrée le ${new Date(d.ack_at * 1000).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}`);
  const at = req.body.date ? Math.floor(Date.parse(date(req.body.date, 'Date de remise') + 'T08:00:00Z') / 1000) : now();
  if (at > now() + 60) throw bad('La date de remise ne peut pas être future');
  acknowledge(d, at);
  audit(req, 'DOCUMENT_ADMIN_REMIS', d.reference);
  res.json({ ok: true });
});
r.post('/rh/documents/:id/suite', admin, (req, res) => {
  const d = db.prepare('SELECT * FROM staff_documents WHERE id = ?').get(id(req.params.id));
  if (!d) throw new HttpError(404, 'Document introuvable');
  if (d.status === 'annule') throw bad('Document annulé');
  const suite = str(req.body.suite, { max: 2000, required: true, label: 'Suite réservée' });
  db.prepare("UPDATE staff_documents SET suite = ?, suite_at = unixepoch(), status = 'clos' WHERE id = ?").run(suite, d.id);
  audit(req, 'DOCUMENT_ADMIN_CLOS', d.reference);
  res.json({ ok: true });
});
r.post('/rh/documents/:id/annuler', admin, (req, res) => {
  const d = db.prepare('SELECT * FROM staff_documents WHERE id = ?').get(id(req.params.id));
  if (!d) throw new HttpError(404, 'Document introuvable');
  if (d.status === 'annule') throw bad('Document déjà annulé');
  const motif = str(req.body.motif, { max: 300, required: true, label: "Motif d'annulation" });
  db.prepare("UPDATE staff_documents SET status = 'annule', suite = ?, suite_at = unixepoch() WHERE id = ?").run(`Annulé : ${motif}`, d.id);
  audit(req, 'DOCUMENT_ADMIN_ANNULE', `${d.reference} — ${motif}`);
  res.json({ ok: true });
});

/* ======================= Espace enseignant ======================= */
const ownDoc = (req) => {
  const d = db.prepare("SELECT * FROM staff_documents WHERE id = ? AND user_id = ? AND status != 'annule'").get(id(req.params.id), req.user.id);
  if (!d) throw new HttpError(404, 'Document introuvable');
  return d;
};
r.get('/mes-documents', teacher, (req, res) => {
  const rows = db.prepare("SELECT * FROM staff_documents WHERE user_id = ? AND status != 'annule' ORDER BY date_doc DESC, id DESC").all(req.user.id).map(docRow);
  res.json({ rows, a_repondre: rows.filter((d) => d.type === 'demande_explication' && d.status === 'emis').length, non_lus: rows.filter((d) => !d.ack_at).length });
});
r.post('/mes-documents/:id/accuse', teacher, (req, res) => {
  const d = ownDoc(req);
  acknowledge(d, now());
  if (!d.ack_at) audit(req, 'DOCUMENT_ADMIN_RECU', d.reference);
  res.json(docRow(db.prepare('SELECT * FROM staff_documents WHERE id = ?').get(d.id)));
});
r.put('/mes-documents/:id/reponse', teacher, (req, res) => {
  const d = ownDoc(req);
  if (d.type !== 'demande_explication') throw bad("Seule une demande d'explication appelle une réponse.");
  if (d.status !== 'emis') throw bad(d.status === 'repondu' ? 'Votre réponse a déjà été transmise.' : 'Ce dossier est clos.');
  const reponse = str(req.body.reponse, { max: 6000, required: true, label: 'Réponse' });
  if (reponse.length < 20) throw bad('Votre réponse est trop courte (20 caractères au moins).');
  tx(() => {
    acknowledge(d, now());
    db.prepare("UPDATE staff_documents SET reponse = ?, reponse_at = unixepoch(), status = 'repondu' WHERE id = ?").run(reponse, d.id);
  });
  audit(req, 'DOCUMENT_ADMIN_REPONSE', d.reference);
  res.json(docRow(db.prepare('SELECT * FROM staff_documents WHERE id = ?').get(d.id)));
});
r.get('/mon-assiduite', teacher, (req, res) => {
  res.json({ agent: agentSnapshot(req.user.id), load: weeklyLoad(req.user.id), ...dossier(req.user.id, req.query) });
});

export { dossier, acknowledge };
export default r;
