// Espaces de travail : saisie des notes / progression (enseignant) et faits disciplinaires (responsable).
import { Router } from 'express';
import { db, tx, audit } from '../db.js';
import { assertEntryOpen, classStudents, currentSeq, parsePeriod } from '../calc.js';
import { str, num, id, bool, date, oneOf, bad, seqParam, HttpError } from '../util.js';
import { requireRole, assertCs, assertClass } from './access.js';

const r = Router();

/* ================= Enseignant ================= */
r.get('/teacher/assignments', requireRole('teacher', 'admin'), (req, res) => {
  const tid = req.user.role === 'admin' && req.query.teacher_id ? id(req.query.teacher_id) : req.user.id;
  const rows = db.prepare(`SELECT cs.id, cs.coef, cs.hours_week, c.id class_id, c.name classe, s.name subject, s.code,
      (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.active = 1) effectif,
      (SELECT COALESCE(SUM(planned),0) FROM progressions p WHERE p.class_subject_id = cs.id) planned,
      (SELECT COALESCE(SUM(done),0) FROM progressions p WHERE p.class_subject_id = cs.id) done,
      (SELECT COALESCE(SUM(digital),0) FROM progressions p WHERE p.class_subject_id = cs.id) digital
    FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id
    WHERE cs.teacher_id = ? ORDER BY c.name, s.name`).all(tid);
  const cnt = db.prepare(`SELECT n.seq, COUNT(*) c FROM notes n JOIN students st ON st.id = n.student_id AND st.active = 1
    WHERE n.class_subject_id = ? AND (n.value IS NOT NULL OR n.absent = 1) GROUP BY n.seq`);
  const val = db.prepare('SELECT seq FROM note_validations WHERE class_subject_id = ?');
  for (const a of rows) {
    a.saisies = Object.fromEntries(cnt.all(a.id).map((x) => [x.seq, x.c]));
    a.validated = val.all(a.id).map((x) => x.seq);
  }
  res.json({ assignments: rows, seq: currentSeq() });
});

/** Séquences concernées : ?period=S2 | T1 (saisie par trimestre) ou ?seq=2 (compatibilité). */
function entrySeqs(q) {
  if (q.period) {
    const p = parsePeriod(q.period);
    if (p.type === 'A') throw bad('La saisie se fait par séquence ou par trimestre.');
    return p;
  }
  const seq = seqParam(q.seq);
  return parsePeriod(`S${seq}`);
}
const lockOf = (seq) => { try { assertEntryOpen(seq); return null; } catch (e) { return e.message; } };

r.get('/notes/grid', requireRole('teacher', 'admin'), (req, res) => {
  const cs = assertCs(req.user, id(req.query.cs));
  const period = entrySeqs(req.query);
  const seqs = period.seqs;
  const students = db.prepare(`SELECT id, matricule, nom, prenom, sexe FROM students WHERE class_id = ? AND active = 1
    ORDER BY nom COLLATE NOCASE, prenom COLLATE NOCASE`).all(cs.class_id);
  const notes = db.prepare(`SELECT student_id, seq, value, absent FROM notes WHERE class_subject_id = ? AND seq IN (${seqs.join(',')})`).all(cs.id);
  for (const st of students) {
    st.values = Object.fromEntries(seqs.map((q) => { const n = notes.find((x) => x.student_id === st.id && x.seq === q); return [q, n ? { value: n.value, absent: n.absent } : null]; }));
    if (seqs.length === 1) { const v = st.values[seqs[0]]; st.value = v?.value ?? null; st.absent = v?.absent ?? 0; }
  }
  const validated = Object.fromEntries(seqs.map((q) => [q, db.prepare('SELECT validated_at FROM note_validations WHERE class_subject_id = ? AND seq = ?').get(cs.id, q)?.validated_at || null]));
  const locked = Object.fromEntries(seqs.map((q) => [q, lockOf(q)]));
  const periods = db.prepare(`SELECT * FROM periods WHERE seq IN (${seqs.join(',')}) ORDER BY seq`).all();
  res.json({ cs, period: { code: period.code, label: period.label, type: period.type }, seqs, periods, students, validated, locked,
    // compatibilité (une seule séquence)
    seq: seqs.length === 1 ? seqs[0] : null, validated_at: seqs.length === 1 ? validated[seqs[0]] : null, locked_msg: seqs.length === 1 ? locked[seqs[0]] : null });
});

r.put('/notes/grid', requireRole('teacher', 'admin'), (req, res) => {
  const cs = assertCs(req.user, id(req.body.cs));
  const entries = req.body.entries;
  if (!Array.isArray(entries) || entries.length > 1000) throw bad('Données de saisie invalides');
  const seqOf = (e) => seqParam(e.seq ?? req.body.seq);
  const touched = [...new Set(entries.map(seqOf))];
  if (!touched.length && req.body.seq != null) touched.push(seqParam(req.body.seq));
  touched.forEach((q) => assertEntryOpen(q));
  const allowed = new Set(db.prepare('SELECT id FROM students WHERE class_id = ? AND active = 1').all(cs.class_id).map((x) => x.id));
  let saved = 0;
  tx(() => {
    const up = db.prepare(`INSERT INTO notes(student_id, class_subject_id, seq, value, absent, updated_by, updated_at) VALUES(?,?,?,?,?,?,unixepoch())
      ON CONFLICT(student_id, class_subject_id, seq) DO UPDATE SET value = excluded.value, absent = excluded.absent, updated_by = excluded.updated_by, updated_at = unixepoch()`);
    const del = db.prepare('DELETE FROM notes WHERE student_id = ? AND class_subject_id = ? AND seq = ?');
    for (const e of entries) {
      const sid = id(e.student_id, 'Élève'); const q = seqOf(e);
      if (!allowed.has(sid)) throw bad("Un élève ne fait pas partie de cette classe");
      const absent = bool(e.absent);
      const value = absent ? null : num(e.value, { min: 0, max: 20, label: 'Note' });
      if (value != null && Math.round(value * 100) !== value * 100) throw bad('Les notes ont au plus 2 décimales');
      if (value == null && !absent) del.run(sid, cs.id, q); else up.run(sid, cs.id, q, value, absent ? 1 : 0, req.user.id);
      saved++;
    }
    // toute modification annule la validation de la séquence concernée : l'enseignant doit revalider
    for (const q of touched) db.prepare('DELETE FROM note_validations WHERE class_subject_id = ? AND seq = ?').run(cs.id, q);
  });
  audit(req, 'NOTES_SAISIES', `${cs.classe} / ${cs.subject} / S${touched.join('+S')} : ${saved} note(s)`);
  res.json({ ok: true, saved });
});

r.post('/notes/validate', requireRole('teacher', 'admin'), (req, res) => {
  const cs = assertCs(req.user, id(req.body.cs));
  const { seqs } = entrySeqs(req.body);
  seqs.forEach((q) => assertEntryOpen(q));
  if (bool(req.body.cancel)) {
    for (const q of seqs) db.prepare('DELETE FROM note_validations WHERE class_subject_id = ? AND seq = ?').run(cs.id, q);
    return res.json({ ok: true });
  }
  const { eff } = db.prepare('SELECT COUNT(*) eff FROM students WHERE class_id = ? AND active = 1').get(cs.class_id);
  for (const q of seqs) {
    const { done } = db.prepare(`SELECT COUNT(*) done FROM notes n JOIN students st ON st.id = n.student_id AND st.active = 1
      WHERE n.class_subject_id = ? AND n.seq = ? AND (n.value IS NOT NULL OR n.absent = 1)`).get(cs.id, q);
    if (done < eff) throw bad(`Séquence ${q} incomplète : ${eff - done} élève(s) sans note. Saisissez une note ou la mention « Absent ».`);
  }
  tx(() => seqs.forEach((q) => db.prepare('INSERT OR REPLACE INTO note_validations(class_subject_id, seq, validated_at, validated_by) VALUES(?,?,unixepoch(),?)').run(cs.id, q, req.user.id)));
  audit(req, 'NOTES_VALIDEES', `${cs.classe} / ${cs.subject} / S${seqs.join('+S')}`);
  res.json({ ok: true });
});

r.get('/progression', requireRole('teacher', 'admin'), (req, res) => {
  const cs = assertCs(req.user, id(req.query.cs));
  const rows = db.prepare('SELECT * FROM progressions WHERE class_subject_id = ?').all(cs.id);
  const periods = db.prepare('SELECT seq, status FROM periods ORDER BY seq').all();
  res.json({ cs, rows: periods.map((p) => ({ seq: p.seq, status: p.status, planned: 0, done: 0, digital: 0, comment: '', ...rows.find((x) => x.seq === p.seq) })) });
});
r.put('/progression', requireRole('teacher', 'admin'), (req, res) => {
  const cs = assertCs(req.user, id(req.body.cs));
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  tx(() => rows.forEach((x) => {
    const seq = seqParam(x.seq);
    const p = db.prepare('SELECT status FROM periods WHERE seq = ?').get(seq);
    const planned = num(x.planned ?? 0, { min: 0, max: 500, int: true, label: 'Leçons prévues' });
    const done = num(x.done ?? 0, { min: 0, max: 500, int: true, label: 'Leçons faites' });
    const digital = num(x.digital ?? 0, { min: 0, max: 500, int: true, label: 'Leçons digitalisées' });
    if (digital > Math.max(planned, done)) throw bad(`Séquence ${seq} : ${digital} leçon(s) digitalisée(s) pour ${Math.max(planned, done)} leçon(s) prévue(s) ou faite(s). Une leçon digitalisée doit figurer dans la progression.`);
    const comment = str(x.comment, { max: 300 });
    const cur = db.prepare('SELECT * FROM progressions WHERE class_subject_id = ? AND seq = ?').get(cs.id, seq);
    if (p.status === 'closed') {
      if (cur && (cur.planned !== planned || cur.done !== done || (cur.digital || 0) !== digital)) throw bad(`Séquence ${seq} clôturée : progression verrouillée`);
      if (!cur && (planned || done || digital)) throw bad(`Séquence ${seq} clôturée : progression verrouillée`);
      return;
    }
    db.prepare(`INSERT INTO progressions(class_subject_id, seq, planned, done, digital, comment, updated_at) VALUES(?,?,?,?,?,?,unixepoch())
      ON CONFLICT(class_subject_id, seq) DO UPDATE SET planned = excluded.planned, done = excluded.done, digital = excluded.digital, comment = excluded.comment, updated_at = unixepoch()`)
      .run(cs.id, seq, planned, done, digital, comment);
  }));
  audit(req, 'PROGRESSION', `${cs.classe} / ${cs.subject}`);
  res.json({ ok: true });
});

/* ================= Responsable disciplinaire ================= */
r.get('/discipline/classes', requireRole('discipline', 'admin'), (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT id, name FROM classes ORDER BY name').all()
    : db.prepare('SELECT c.id, c.name FROM officer_classes oc JOIN classes c ON c.id = oc.class_id WHERE oc.user_id = ? ORDER BY c.name').all(req.user.id);
  const seq = currentSeq();
  for (const c of rows) {
    c.effectif = db.prepare('SELECT COUNT(*) c FROM students WHERE class_id = ? AND active = 1').get(c.id).c;
    c.validated = db.prepare('SELECT seq FROM discipline_validations WHERE class_id = ?').all(c.id).map((x) => x.seq);
    c.incidents = db.prepare('SELECT COUNT(*) c FROM incidents i JOIN students s ON s.id = i.student_id WHERE s.class_id = ? AND i.seq = ?').get(c.id, seq).c;
    c.abs_nj = db.prepare('SELECT COALESCE(SUM(abs_nj),0) c FROM discipline_records d JOIN students s ON s.id = d.student_id WHERE s.class_id = ? AND d.seq = ?').get(c.id, seq).c;
  }
  res.json({ classes: rows, seq });
});

r.get('/discipline/sheet', requireRole('discipline', 'admin'), (req, res) => {
  const cls = assertClass(req.user, id(req.query.class_id));
  // Vue récapitulative d'un trimestre (somme des deux séquences, lecture seule)
  if (/^T[1-3]$/i.test(req.query.period || '')) {
    const p = parsePeriod(req.query.period); const ph = p.seqs.join(',');
    const students = db.prepare(`SELECT st.id, st.matricule, st.nom, st.prenom, st.sexe,
        COALESCE(SUM(d.abs_j),0) abs_j, COALESCE(SUM(d.abs_nj),0) abs_nj, COALESCE(SUM(d.retards),0) retards, COALESCE(SUM(d.consignes),0) consignes,
        COALESCE(MAX(d.avertissement),0) avertissement, COALESCE(MAX(d.blame),0) blame, COALESCE(SUM(d.exclusion_jours),0) exclusion_jours,
        GROUP_CONCAT(d.observation, ' / ') observation,
        (SELECT COUNT(*) FROM incidents i WHERE i.student_id = st.id AND i.seq IN (${ph})) incidents
      FROM students st LEFT JOIN discipline_records d ON d.student_id = st.id AND d.seq IN (${ph})
      WHERE st.class_id = ? AND st.active = 1 GROUP BY st.id ORDER BY st.nom COLLATE NOCASE, st.prenom COLLATE NOCASE`).all(cls.id);
    const val = p.seqs.map((q) => db.prepare('SELECT validated_at FROM discipline_validations WHERE class_id = ? AND seq = ?').get(cls.id, q)?.validated_at || null);
    return res.json({ classe: cls, seq: null, period: { code: p.code, label: p.label, seqs: p.seqs }, students, recap: true,
      validated_at: val.every(Boolean) ? Math.max(...val) : null, validated: Object.fromEntries(p.seqs.map((q, i) => [q, val[i]])),
      locked: `Récapitulatif du ${p.label.toLowerCase()} (séquences ${p.seqs.join(' et ')}) — lecture seule. Choisissez une séquence pour saisir.` });
  }
  const seq = seqParam(req.query.seq);
  const students = db.prepare(`SELECT st.id, st.matricule, st.nom, st.prenom, st.sexe,
      COALESCE(d.abs_j,0) abs_j, COALESCE(d.abs_nj,0) abs_nj, COALESCE(d.retards,0) retards, COALESCE(d.consignes,0) consignes,
      COALESCE(d.avertissement,0) avertissement, COALESCE(d.blame,0) blame, COALESCE(d.exclusion_jours,0) exclusion_jours, d.observation,
      (SELECT COUNT(*) FROM incidents i WHERE i.student_id = st.id AND i.seq = ?) incidents
    FROM students st LEFT JOIN discipline_records d ON d.student_id = st.id AND d.seq = ?
    WHERE st.class_id = ? AND st.active = 1 ORDER BY st.nom COLLATE NOCASE, st.prenom COLLATE NOCASE`).all(seq, seq, cls.id);
  const v = db.prepare('SELECT validated_at FROM discipline_validations WHERE class_id = ? AND seq = ?').get(cls.id, seq);
  let locked = null; try { assertEntryOpen(seq); } catch (e) { locked = e.message; }
  res.json({ classe: cls, seq, students, validated_at: v?.validated_at || null, locked });
});

r.put('/discipline/sheet', requireRole('discipline', 'admin'), (req, res) => {
  const cls = assertClass(req.user, id(req.body.class_id));
  const seq = seqParam(req.body.seq);
  assertEntryOpen(seq);
  const entries = req.body.entries;
  if (!Array.isArray(entries) || entries.length > 500) throw bad('Données invalides');
  const allowed = new Set(classStudents(cls.id).map((s) => s.id));
  tx(() => {
    const up = db.prepare(`INSERT INTO discipline_records(student_id, seq, abs_j, abs_nj, retards, consignes, avertissement, blame, exclusion_jours, observation, officer_id, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,unixepoch()) ON CONFLICT(student_id, seq) DO UPDATE SET abs_j=excluded.abs_j, abs_nj=excluded.abs_nj, retards=excluded.retards,
      consignes=excluded.consignes, avertissement=excluded.avertissement, blame=excluded.blame, exclusion_jours=excluded.exclusion_jours,
      observation=excluded.observation, officer_id=excluded.officer_id, updated_at=unixepoch()`);
    for (const e of entries) {
      const sid = id(e.student_id, 'Élève');
      if (!allowed.has(sid)) throw bad("Un élève ne fait pas partie de cette classe");
      const n = (k, max, label) => num(e[k] ?? 0, { min: 0, max, label }) ?? 0;
      up.run(sid, seq, n('abs_j', 500, 'Absences justifiées'), n('abs_nj', 500, 'Absences non justifiées'), num(e.retards ?? 0, { min: 0, max: 200, int: true, label: 'Retards' }) ?? 0,
        n('consignes', 200, 'Consignes'), bool(e.avertissement) ? 1 : 0, bool(e.blame) ? 1 : 0, num(e.exclusion_jours ?? 0, { min: 0, max: 60, int: true, label: 'Exclusion' }) ?? 0,
        str(e.observation, { max: 300, label: 'Observation' }), req.user.id);
    }
    db.prepare('DELETE FROM discipline_validations WHERE class_id = ? AND seq = ?').run(cls.id, seq);
  });
  audit(req, 'DISCIPLINE_SAISIE', `${cls.name} / S${seq}`);
  res.json({ ok: true });
});

r.post('/discipline/validate', requireRole('discipline', 'admin'), (req, res) => {
  const cls = assertClass(req.user, id(req.body.class_id));
  // une séquence, ou les deux séquences d'un trimestre
  const { seqs } = entrySeqs(req.body);
  seqs.forEach((q) => assertEntryOpen(q));
  tx(() => seqs.forEach((q) => {
    if (bool(req.body.cancel)) db.prepare('DELETE FROM discipline_validations WHERE class_id = ? AND seq = ?').run(cls.id, q);
    else db.prepare('INSERT OR REPLACE INTO discipline_validations(class_id, seq, validated_at, validated_by) VALUES(?,?,unixepoch(),?)').run(cls.id, q, req.user.id);
  }));
  audit(req, bool(req.body.cancel) ? 'DISCIPLINE_DEVALIDEE' : 'DISCIPLINE_VALIDEE', `${cls.name} / S${seqs.join('+S')}`);
  res.json({ ok: true });
});

r.get('/discipline/incidents', requireRole('discipline', 'admin'), (req, res) => {
  const cls = assertClass(req.user, id(req.query.class_id));
  const p = [cls.id]; let extra = '';
  if (req.query.seq) { extra = 'AND i.seq = ?'; p.push(seqParam(req.query.seq)); }
  res.json(db.prepare(`SELECT i.*, s.nom, s.prenom, s.matricule, u.full_name officer FROM incidents i JOIN students s ON s.id = i.student_id
    LEFT JOIN users u ON u.id = i.officer_id WHERE s.class_id = ? ${extra} ORDER BY i.date DESC, i.id DESC`).all(...p));
});
export const INCIDENT_TYPES = ['Absence non justifiée', 'Retard répété', 'Indiscipline en classe', 'Insolence / Impolitesse', 'Bagarre / Violence',
  'Tricherie / Fraude', 'Tenue non réglementaire', 'Dégradation du matériel', 'Usage du téléphone', 'Vol', 'Consommation de substances interdites', 'Autre'];
r.post('/discipline/incidents', requireRole('discipline', 'admin'), (req, res) => {
  const sid = id(req.body.student_id, 'Élève');
  const st = db.prepare('SELECT class_id, nom, prenom FROM students WHERE id = ?').get(sid);
  if (!st) throw new HttpError(404, 'Élève introuvable');
  assertClass(req.user, st.class_id);
  const seq = seqParam(req.body.seq);
  assertEntryOpen(seq);
  const d = date(req.body.date, 'Date') || new Date().toISOString().slice(0, 10);
  const type = str(req.body.type, { max: 80, required: true, label: 'Type de fait' });
  const gravite = oneOf(req.body.gravite || 'mineure', ['mineure', 'moyenne', 'grave', 'très grave'], 'Gravité');
  db.prepare('INSERT INTO incidents(student_id, seq, date, type, gravite, sanction, description, officer_id) VALUES(?,?,?,?,?,?,?,?)')
    .run(sid, seq, d, type, gravite, str(req.body.sanction, { max: 120 }), str(req.body.description, { max: 1000 }), req.user.id);
  audit(req, 'INCIDENT', `${st.nom} ${st.prenom} : ${type}`);
  res.status(201).json({ ok: true });
});
r.delete('/discipline/incidents/:id', requireRole('discipline', 'admin'), (req, res) => {
  const inc = db.prepare('SELECT i.*, s.class_id FROM incidents i JOIN students s ON s.id = i.student_id WHERE i.id = ?').get(id(req.params.id));
  if (!inc) throw new HttpError(404, 'Incident introuvable');
  assertClass(req.user, inc.class_id);
  assertEntryOpen(inc.seq);
  db.prepare('DELETE FROM incidents WHERE id = ?').run(inc.id);
  audit(req, 'INCIDENT_SUPPRIME', String(inc.id));
  res.json({ ok: true });
});
r.get('/discipline/student/:id', requireRole('discipline', 'admin'), (req, res) => {
  const st = db.prepare('SELECT * FROM students WHERE id = ?').get(id(req.params.id));
  if (!st) throw new HttpError(404, 'Élève introuvable');
  assertClass(req.user, st.class_id);
  res.json({ student: st, records: db.prepare('SELECT * FROM discipline_records WHERE student_id = ? ORDER BY seq').all(st.id),
    incidents: db.prepare('SELECT * FROM incidents WHERE student_id = ? ORDER BY date DESC').all(st.id) });
});

export default r;
