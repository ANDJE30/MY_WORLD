import { Router } from 'express';
import express from 'express';
import { db, tx, audit, getSettings, saveSettings, DEFAULT_SETTINGS, ensureTaxonomy, legacyTaxonomy } from '../db.js';
import { hashPassword, genPassword, genUsername, verifyPassword, slug, destroyUserSessions } from '../security.js';
import { completeness, currentSeq, computeClassResults, TRIMESTRES, round2 } from '../calc.js';
import { str, num, id, bool, date, oneOf, bad, seqParam, HttpError } from '../util.js';
import { requireRole } from './access.js';

const r = Router();
r.use(requireRole('admin'));

/* ============ Tableau de bord ============ */
r.get('/dashboard', (_req, res) => {
  const count = (sql, ...p) => db.prepare(sql).get(...p).c;
  const seq = currentSeq();
  const comp = completeness(seq);
  const lastClosed = db.prepare("SELECT MAX(seq) s FROM periods WHERE status='closed'").get().s;
  const refSeq = lastClosed || seq;
  const classes = db.prepare('SELECT id, name FROM classes ORDER BY name').all();
  const perf = classes.map((c) => {
    const rs = computeClassResults(c.id, `S${refSeq}`);
    return { classe: c.name, moyenne: rs.stats.moyenne, reussite: rs.stats.reussite, effectif: rs.stats.effectif };
  });
  const alerts = [];
  const noTeacher = count('SELECT COUNT(*) c FROM class_subjects WHERE teacher_id IS NULL');
  if (noTeacher) alerts.push({ level: 'warn', text: `${noTeacher} matière(s) de classe sans enseignant attribué`, link: '#/attributions' });
  const noOfficer = count('SELECT COUNT(*) c FROM classes c WHERE NOT EXISTS (SELECT 1 FROM officer_classes o WHERE o.class_id = c.id)');
  if (noOfficer) alerts.push({ level: 'warn', text: `${noOfficer} classe(s) sans responsable disciplinaire`, link: '#/responsables' });
  const noClass = count('SELECT COUNT(*) c FROM students WHERE class_id IS NULL AND active = 1');
  if (noClass) alerts.push({ level: 'info', text: `${noClass} élève(s) sans classe`, link: '#/eleves' });
  const p = db.prepare('SELECT * FROM periods WHERE seq = ?').get(seq);
  const today = new Date().toISOString().slice(0, 10);
  if (p.status === 'open' && p.end_date && p.end_date < today)
    alerts.push({ level: 'danger', text: `La séquence ${seq} est terminée depuis le ${p.end_date} : pensez à la clôturer`, link: '#/calendrier' });
  const locked = count('SELECT COUNT(*) c FROM users WHERE locked_until > unixepoch()');
  if (locked) alerts.push({ level: 'danger', text: `${locked} compte(s) verrouillé(s) suite à des échecs de connexion`, link: '#/enseignants' });
  res.json({
    counts: {
      eleves: count('SELECT COUNT(*) c FROM students WHERE active = 1'),
      garcons: count("SELECT COUNT(*) c FROM students WHERE active = 1 AND sexe = 'M'"),
      filles: count("SELECT COUNT(*) c FROM students WHERE active = 1 AND sexe = 'F'"),
      classes: classes.length, matieres: count('SELECT COUNT(*) c FROM subjects'),
      enseignants: count("SELECT COUNT(*) c FROM users WHERE role = 'teacher'"),
      responsables: count("SELECT COUNT(*) c FROM users WHERE role = 'discipline'"),
      incidents: count('SELECT COUNT(*) c FROM incidents WHERE seq = ?', seq)
    },
    seq, refSeq, completeness: comp.summary, perf, alerts,
    periods: db.prepare('SELECT * FROM periods ORDER BY seq').all(),
    activity: db.prepare('SELECT at, username, action, detail FROM audit_log ORDER BY id DESC LIMIT 8').all()
  });
});

/* ============ Paramètres de l'établissement ============ */
r.get('/settings', (_req, res) => res.json(getSettings()));
r.put('/settings', (req, res) => {
  const b = req.body || {}; const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (!(k in b)) continue;
    const def = DEFAULT_SETTINGS[k];
    if (k === 'logo') {
      if (b.logo && !/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(b.logo)) throw bad('Logo : PNG ou JPEG uniquement');
      if (b.logo && b.logo.length > 700_000) throw bad('Logo trop volumineux (500 Ko maximum)');
      out.logo = b.logo || '';
    } else if (k === 'jours_actifs') {
      if (!Array.isArray(b.jours_actifs) || !b.jours_actifs.length) throw bad('Choisissez au moins un jour de cours');
      out.jours_actifs = [...new Set(b.jours_actifs.map((d) => num(d, { min: 1, max: 6, int: true, label: 'Jour' })))].sort();
    } else if (k === 'time_slots') {
      if (!Array.isArray(b.time_slots) || b.time_slots.length > 16) throw bad('Créneaux horaires invalides');
      out.time_slots = b.time_slots.map((t) => {
        if (!/^\d{2}:\d{2}$/.test(t.start) || !/^\d{2}:\d{2}$/.test(t.end) || t.start >= t.end) throw bad('Créneau horaire invalide');
        return { start: t.start, end: t.end, break: bool(t.break), label: str(t.label, { max: 40 }) || undefined };
      });
    } else if (typeof def === 'number') out[k] = num(b[k], { min: 0, max: 100, label: k });
    else if (typeof def === 'boolean') out[k] = bool(b[k]);
    else out[k] = str(b[k], { max: 300, label: k }) || '';
  }
  if (out.nom === '') throw bad("Le nom de l'établissement est obligatoire");
  saveSettings(out);
  audit(req, 'PARAMETRES_MODIFIES', Object.keys(out).join(', '));
  res.json(getSettings());
});

/* ============ Calendrier & clôtures ============ */
r.put('/periods/:seq', (req, res) => {
  const seq = seqParam(req.params.seq);
  const start = date(req.body.start_date, 'Date de début'), end = date(req.body.end_date, 'Date de fin');
  if (!start || !end || start > end) throw bad('Dates invalides : la date de début doit précéder la date de fin');
  const prev = db.prepare('SELECT end_date FROM periods WHERE seq = ?').get(seq - 1);
  const next = db.prepare('SELECT start_date FROM periods WHERE seq = ?').get(seq + 1);
  if (prev?.end_date && start <= prev.end_date) throw bad(`La séquence ${seq} doit commencer après la fin de la séquence ${seq - 1} (${prev.end_date})`);
  if (next?.start_date && end >= next.start_date) throw bad(`La séquence ${seq} doit finir avant le début de la séquence ${seq + 1} (${next.start_date})`);
  db.prepare('UPDATE periods SET start_date = ?, end_date = ? WHERE seq = ?').run(start, end, seq);
  audit(req, 'CALENDRIER', `S${seq}: ${start} → ${end}`);
  res.json({ ok: true });
});
r.get('/periods/:seq/check', (req, res) => res.json(completeness(seqParam(req.params.seq))));

function closeSeq(req, seq, force) {
  const p = db.prepare('SELECT * FROM periods WHERE seq = ?').get(seq);
  if (p.status === 'closed') return { already: true };
  const prevOpen = db.prepare("SELECT seq FROM periods WHERE seq < ? AND status = 'open' ORDER BY seq").get(seq);
  if (prevOpen) throw bad(`Clôturez d'abord la séquence ${prevOpen.seq} (ordre chronologique).`);
  const today = new Date().toISOString().slice(0, 10);
  const comp = completeness(seq);
  const problems = [];
  if (p.end_date && today < p.end_date) problems.push(`la séquence se termine le ${p.end_date} selon le calendrier`);
  if (!comp.summary.ready) problems.push(`saisie incomplète (${comp.summary.notesDone}/${comp.summary.notesTotal} matières, ${comp.summary.discDone}/${comp.summary.discTotal} classes en discipline)`);
  if (problems.length && !force) throw Object.assign(new HttpError(409, `Clôture impossible : ${problems.join(' ; ')}. Cochez « Forcer la clôture » pour passer outre.`), { problems });
  db.prepare("UPDATE periods SET status = 'closed', closed_at = unixepoch(), closed_by = ?, forced = ? WHERE seq = ?").run(req.user.username, problems.length ? 1 : 0, seq);
  audit(req, 'SEQUENCE_CLOTUREE', `S${seq}${problems.length ? ' (forcée : ' + problems.join(' ; ') + ')' : ''}`);
  return { ok: true, forced: problems.length > 0 };
}
const confirmPassword = (req) => {
  const pw = str(req.body?.password, { max: 128, required: true, label: 'Mot de passe de confirmation' });
  const u = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(pw, u.pass_hash)) throw new HttpError(403, 'Mot de passe de confirmation incorrect');
};
r.post('/periods/:seq/close', (req, res) => {
  const seq = seqParam(req.params.seq);
  if (bool(req.body?.force)) confirmPassword(req);
  res.json(tx(() => closeSeq(req, seq, bool(req.body?.force))));
});
r.post('/periods/:seq/reopen', (req, res) => {
  const seq = seqParam(req.params.seq);
  confirmPassword(req);
  const later = db.prepare("SELECT seq FROM periods WHERE seq > ? AND status = 'closed'").get(seq);
  if (later) throw bad(`Rouvrez d'abord la séquence ${later.seq}.`);
  db.prepare("UPDATE periods SET status = 'open', closed_at = NULL, closed_by = NULL, forced = 0 WHERE seq = ?").run(seq);
  audit(req, 'SEQUENCE_ROUVERTE', `S${seq}`);
  res.json({ ok: true });
});
r.post('/trimestres/:n/close', (req, res) => {
  const n = num(req.params.n, { min: 1, max: 3, int: true, required: true, label: 'Trimestre' });
  const force = bool(req.body?.force);
  if (force) confirmPassword(req);
  const out = tx(() => TRIMESTRES[n].map((s) => closeSeq(req, s, force)));
  audit(req, 'TRIMESTRE_CLOTURE', `T${n}`);
  res.json({ ok: true, details: out });
});

/* ============ Classes ============ */
r.get('/classes', (_req, res) => {
  res.json(db.prepare(`SELECT c.*, u.full_name titulaire,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.active = 1) effectif,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.active = 1 AND s.sexe = 'F') filles,
      (SELECT COUNT(*) FROM class_subjects cs WHERE cs.class_id = c.id) matieres,
      (SELECT COALESCE(SUM(coef),0) FROM class_subjects cs WHERE cs.class_id = c.id) total_coef,
      (SELECT GROUP_CONCAT(u2.full_name, ', ') FROM officer_classes oc JOIN users u2 ON u2.id = oc.user_id WHERE oc.class_id = c.id) responsables
    FROM classes c LEFT JOIN users u ON u.id = c.titulaire_id ORDER BY c.cycle, c.name`).all());
});
const classBody = (b) => ({
  name: str(b.name, { max: 40, required: true, label: 'Nom de la classe' }), level: str(b.level, { max: 40 }),
  serie: str(b.serie, { max: 40 }), cycle: str(b.cycle, { max: 40 }), room: str(b.room, { max: 40 }),
  titulaire_id: b.titulaire_id ? id(b.titulaire_id) : null
});
r.post('/classes', (req, res) => {
  const c = classBody(req.body);
  const info = db.prepare('INSERT INTO classes(name, level, serie, cycle, room, titulaire_id) VALUES(?,?,?,?,?,?)').run(c.name, c.level, c.serie, c.cycle, c.room, c.titulaire_id);
  if (req.body.copy_from) copySubjects(id(req.body.copy_from), Number(info.lastInsertRowid));
  audit(req, 'CLASSE_CREEE', c.name);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
r.put('/classes/:id', (req, res) => {
  const c = classBody(req.body);
  db.prepare('UPDATE classes SET name=?, level=?, serie=?, cycle=?, room=?, titulaire_id=? WHERE id=?').run(c.name, c.level, c.serie, c.cycle, c.room, c.titulaire_id, id(req.params.id));
  audit(req, 'CLASSE_MODIFIEE', c.name);
  res.json({ ok: true });
});
r.delete('/classes/:id', (req, res) => {
  const cid = id(req.params.id);
  const n = db.prepare('SELECT COUNT(*) c FROM students WHERE class_id = ?').get(cid).c;
  if (n) throw bad(`Impossible : la classe contient ${n} élève(s). Transférez-les ou supprimez-les d'abord.`);
  db.prepare('DELETE FROM classes WHERE id = ?').run(cid);
  audit(req, 'CLASSE_SUPPRIMEE', String(cid));
  res.json({ ok: true });
});
function copySubjects(from, to) {
  const rows = db.prepare('SELECT subject_id, coef, hours_week FROM class_subjects WHERE class_id = ?').all(from);
  const ins = db.prepare('INSERT OR IGNORE INTO class_subjects(class_id, subject_id, coef, hours_week) VALUES(?,?,?,?)');
  rows.forEach((x) => ins.run(to, x.subject_id, x.coef, x.hours_week));
  return rows.length;
}
r.post('/classes/:id/copy-subjects', (req, res) => {
  const n = tx(() => copySubjects(id(req.body.from), id(req.params.id)));
  audit(req, 'MATIERES_COPIEES', `${req.body.from} → ${req.params.id}`);
  res.json({ ok: true, copied: n });
});

/* ============ Groupes et types de matières (référentiels administrables) ============ */
// Les deux référentiels partagent la même logique ; seul le groupe possède un ordre (position sur le bulletin).
const TAXO = {
  'subject-groups': { table: 'subject_groups', col: 'group_id', label: 'groupe', ordered: true },
  'subject-types': { table: 'subject_types', col: 'type_id', label: 'type de matière', ordered: false }
};
for (const [route, t] of Object.entries(TAXO)) {
  const body = (b) => ({ name: str(b.name, { max: 60, required: true, label: 'Libellé' }),
    ordre: t.ordered ? num(b.ordre ?? 1, { min: 1, max: 99, int: true, label: 'Ordre' }) : null });
  r.get(`/${route}`, (_req, res) => res.json(db.prepare(`SELECT x.*, (SELECT COUNT(*) FROM subjects s WHERE s.${t.col} = x.id) subjects
    FROM ${t.table} x ORDER BY ${t.ordered ? 'x.ordre, ' : ''}x.name`).all()));
  r.post(`/${route}`, (req, res) => {
    const b = body(req.body);
    const info = t.ordered ? db.prepare(`INSERT INTO ${t.table}(name, ordre) VALUES(?,?)`).run(b.name, b.ordre)
      : db.prepare(`INSERT INTO ${t.table}(name) VALUES(?)`).run(b.name);
    audit(req, t.ordered ? 'GROUPE_CREE' : 'TYPE_MATIERE_CREE', b.name);
    res.status(201).json({ id: Number(info.lastInsertRowid), name: b.name, ordre: b.ordre });
  });
  r.put(`/${route}/:id`, (req, res) => {
    const b = body(req.body); const xid = id(req.params.id);
    const ch = t.ordered ? db.prepare(`UPDATE ${t.table} SET name = ?, ordre = ? WHERE id = ?`).run(b.name, b.ordre, xid)
      : db.prepare(`UPDATE ${t.table} SET name = ? WHERE id = ?`).run(b.name, xid);
    if (!ch.changes) throw new HttpError(404, 'Élément introuvable');
    audit(req, t.ordered ? 'GROUPE_MODIFIE' : 'TYPE_MATIERE_MODIFIE', b.name);
    res.json({ ok: true });
  });
  r.delete(`/${route}/:id`, (req, res) => {
    const xid = id(req.params.id);
    const row = db.prepare(`SELECT name FROM ${t.table} WHERE id = ?`).get(xid);
    if (!row) throw new HttpError(404, 'Élément introuvable');
    const used = db.prepare(`SELECT COUNT(*) c FROM subjects WHERE ${t.col} = ?`).get(xid).c;
    if (used) throw bad(`Impossible : ce ${t.label} est utilisé par ${used} matière(s). Réaffectez-les d'abord.`);
    if (db.prepare(`SELECT COUNT(*) c FROM ${t.table}`).get().c <= 1) throw bad(`Il doit rester au moins un ${t.label}.`);
    db.prepare(`DELETE FROM ${t.table} WHERE id = ?`).run(xid);
    audit(req, t.ordered ? 'GROUPE_SUPPRIME' : 'TYPE_MATIERE_SUPPRIME', row.name);
    res.json({ ok: true });
  });
}

/* ============ Matières ============ */
r.get('/subjects', (_req, res) => res.json(db.prepare(`SELECT s.*, g.name group_name, g.ordre group_ordre, t.name type_name,
    (SELECT COUNT(*) FROM class_subjects cs WHERE cs.subject_id = s.id) classes
  FROM subjects s LEFT JOIN subject_groups g ON g.id = s.group_id LEFT JOIN subject_types t ON t.id = s.type_id
  ORDER BY COALESCE(g.ordre, 999), g.name, s.name`).all()));
const subjBody = (b) => {
  const s = { name: str(b.name, { max: 80, required: true, label: 'Nom de la matière' }), code: str(b.code, { max: 10 }),
    group_id: id(b.group_id, 'Groupe'), type_id: id(b.type_id, 'Type de matière') };
  if (!db.prepare('SELECT 1 FROM subject_groups WHERE id = ?').get(s.group_id)) throw bad('Groupe inexistant');
  if (!db.prepare('SELECT 1 FROM subject_types WHERE id = ?').get(s.type_id)) throw bad('Type de matière inexistant');
  return s;
};
r.post('/subjects', (req, res) => {
  const s = subjBody(req.body);
  const info = db.prepare('INSERT INTO subjects(name, code, group_id, type_id) VALUES(?,?,?,?)').run(s.name, s.code, s.group_id, s.type_id);
  audit(req, 'MATIERE_CREEE', s.name);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
r.put('/subjects/:id', (req, res) => {
  const s = subjBody(req.body);
  db.prepare('UPDATE subjects SET name=?, code=?, group_id=?, type_id=? WHERE id=?').run(s.name, s.code, s.group_id, s.type_id, id(req.params.id));
  audit(req, 'MATIERE_MODIFIEE', s.name);
  res.json({ ok: true });
});
r.delete('/subjects/:id', (req, res) => {
  const sid = id(req.params.id);
  const n = db.prepare('SELECT COUNT(*) c FROM notes n JOIN class_subjects cs ON cs.id = n.class_subject_id WHERE cs.subject_id = ?').get(sid).c;
  if (n) throw bad(`Impossible : ${n} note(s) sont déjà enregistrées pour cette matière.`);
  db.prepare('DELETE FROM subjects WHERE id = ?').run(sid);
  audit(req, 'MATIERE_SUPPRIMEE', String(sid));
  res.json({ ok: true });
});

/* ============ Attributions (classe × matière × enseignant) ============ */
r.get('/class-subjects', (req, res) => {
  const where = req.query.class_id ? 'WHERE cs.class_id = ?' : req.query.teacher_id ? 'WHERE cs.teacher_id = ?' : '';
  const p = req.query.class_id ? [id(req.query.class_id)] : req.query.teacher_id ? [id(req.query.teacher_id)] : [];
  res.json(db.prepare(`SELECT cs.*, c.name classe, s.name subject, s.code, g.name group_name, t.name type_name, u.full_name teacher
    FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id
    LEFT JOIN subject_groups g ON g.id = s.group_id LEFT JOIN subject_types t ON t.id = s.type_id LEFT JOIN users u ON u.id = cs.teacher_id
    ${where} ORDER BY c.name, COALESCE(g.ordre, 999), s.name`).all(...p));
});
const csBody = (b) => ({ coef: num(b.coef ?? 1, { min: 0.5, max: 10, label: 'Coefficient' }),
  teacher_id: b.teacher_id ? id(b.teacher_id) : null, hours_week: num(b.hours_week ?? 2, { min: 0, max: 20, label: 'Volume horaire' }) });
const assertTeacher = (tid) => { if (tid && !db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'teacher'").get(tid)) throw bad('Enseignant invalide'); };
r.post('/class-subjects', (req, res) => {
  const b = csBody(req.body); assertTeacher(b.teacher_id);
  const classIds = Array.isArray(req.body.class_ids) ? req.body.class_ids.map((x) => id(x)) : [id(req.body.class_id)];
  const sid = id(req.body.subject_id);
  tx(() => classIds.forEach((cid) => db.prepare(`INSERT INTO class_subjects(class_id, subject_id, coef, teacher_id, hours_week) VALUES(?,?,?,?,?)
    ON CONFLICT(class_id, subject_id) DO UPDATE SET coef = excluded.coef, teacher_id = COALESCE(excluded.teacher_id, teacher_id), hours_week = excluded.hours_week`)
    .run(cid, sid, b.coef, b.teacher_id, b.hours_week)));
  audit(req, 'ATTRIBUTION', `matière ${sid} → classes ${classIds.join(',')}`);
  res.status(201).json({ ok: true });
});
r.put('/class-subjects/:id', (req, res) => {
  const b = csBody(req.body); assertTeacher(b.teacher_id);
  db.prepare('UPDATE class_subjects SET coef=?, teacher_id=?, hours_week=? WHERE id=?').run(b.coef, b.teacher_id, b.hours_week, id(req.params.id));
  audit(req, 'ATTRIBUTION_MODIFIEE', String(req.params.id));
  res.json({ ok: true });
});
r.delete('/class-subjects/:id', (req, res) => {
  const csid = id(req.params.id);
  const n = db.prepare('SELECT COUNT(*) c FROM notes WHERE class_subject_id = ?').get(csid).c;
  if (n && !bool(req.query.force)) throw bad(`Cette attribution porte ${n} note(s). Confirmez la suppression définitive.`);
  db.prepare('DELETE FROM class_subjects WHERE id = ?').run(csid);
  audit(req, 'ATTRIBUTION_SUPPRIMEE', String(csid));
  res.json({ ok: true });
});

/* ============ Élèves ============ */
r.get('/students', (req, res) => {
  const cond = ['1=1'], p = [];
  if (req.query.class_id === 'none') cond.push('s.class_id IS NULL');
  else if (req.query.class_id) { cond.push('s.class_id = ?'); p.push(id(req.query.class_id)); }
  if (req.query.q) { cond.push("(s.nom || ' ' || s.prenom || ' ' || s.matricule) LIKE ?"); p.push(`%${str(req.query.q, { max: 60 })}%`); }
  res.json(db.prepare(`SELECT s.*, c.name classe FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE ${cond.join(' AND ')}
    ORDER BY c.name, s.nom COLLATE NOCASE, s.prenom COLLATE NOCASE LIMIT 3000`).all(...p));
});
const studentBody = (b) => ({
  matricule: str(b.matricule, { max: 30, label: 'Matricule' }), nom: str(b.nom, { max: 80, required: true, label: 'Nom' })?.toUpperCase(),
  prenom: str(b.prenom, { max: 80, label: 'Prénom' }) || '', sexe: b.sexe ? oneOf(String(b.sexe).toUpperCase().slice(0, 1), ['M', 'F'], 'Sexe') : null,
  date_naissance: date(b.date_naissance, 'Date de naissance'), lieu_naissance: str(b.lieu_naissance, { max: 80 }),
  class_id: b.class_id ? id(b.class_id) : null, redoublant: bool(b.redoublant) ? 1 : 0,
  parent_nom: str(b.parent_nom, { max: 120 }), parent_tel: str(b.parent_tel, { max: 30 }), active: b.active === undefined ? 1 : (bool(b.active) ? 1 : 0)
});
function nextMatricule() {
  const s = getSettings(); const yy = String(s.annee_scolaire).slice(2, 4);
  const pre = `${yy}${slug(s.nom_court || s.nom).slice(0, 4).toUpperCase() || 'EL'}`;
  const last = db.prepare('SELECT matricule FROM students WHERE matricule LIKE ? ORDER BY length(matricule) DESC, matricule DESC LIMIT 1').get(`${pre}%`);
  let n = last ? parseInt(last.matricule.slice(pre.length), 10) || 0 : 0;
  const exists = db.prepare('SELECT 1 FROM students WHERE matricule = ?');
  let m; do { m = `${pre}${String(++n).padStart(4, '0')}`; } while (exists.get(m));
  return m;
}
const insStudent = (s) => db.prepare(`INSERT INTO students(matricule, nom, prenom, sexe, date_naissance, lieu_naissance, class_id, redoublant, parent_nom, parent_tel, active)
  VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(s.matricule || nextMatricule(), s.nom, s.prenom, s.sexe, s.date_naissance, s.lieu_naissance, s.class_id, s.redoublant, s.parent_nom, s.parent_tel, s.active);
r.post('/students', (req, res) => {
  const s = studentBody(req.body);
  const info = insStudent(s);
  audit(req, 'ELEVE_CREE', `${s.nom} ${s.prenom}`);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});
r.put('/students/:id', (req, res) => {
  const s = studentBody(req.body);
  if (!s.matricule) throw bad('Matricule obligatoire');
  db.prepare(`UPDATE students SET matricule=?, nom=?, prenom=?, sexe=?, date_naissance=?, lieu_naissance=?, class_id=?, redoublant=?, parent_nom=?, parent_tel=?, active=? WHERE id=?`)
    .run(s.matricule, s.nom, s.prenom, s.sexe, s.date_naissance, s.lieu_naissance, s.class_id, s.redoublant, s.parent_nom, s.parent_tel, s.active, id(req.params.id));
  audit(req, 'ELEVE_MODIFIE', `${s.nom} ${s.prenom}`);
  res.json({ ok: true });
});
r.delete('/students/:id', (req, res) => {
  const st = db.prepare('SELECT nom, prenom FROM students WHERE id = ?').get(id(req.params.id));
  if (!st) throw new HttpError(404, 'Élève introuvable');
  db.prepare('DELETE FROM students WHERE id = ?').run(id(req.params.id));
  audit(req, 'ELEVE_SUPPRIME', `${st.nom} ${st.prenom}`);
  res.json({ ok: true });
});
r.post('/students/bulk', (req, res) => {
  const ids = (req.body.ids || []).map((x) => id(x));
  if (!ids.length || ids.length > 2000) throw bad('Sélection invalide');
  const action = oneOf(req.body.action, ['transfer', 'delete'], 'Action');
  tx(() => {
    if (action === 'transfer') { const cid = req.body.class_id ? id(req.body.class_id) : null; ids.forEach((x) => db.prepare('UPDATE students SET class_id = ? WHERE id = ?').run(cid, x)); }
    else ids.forEach((x) => db.prepare('DELETE FROM students WHERE id = ?').run(x));
  });
  audit(req, action === 'transfer' ? 'ELEVES_TRANSFERES' : 'ELEVES_SUPPRIMES', `${ids.length} élève(s)`);
  res.json({ ok: true, count: ids.length });
});
r.post('/students/import', (req, res) => {
  const rows = req.body.rows;
  if (!Array.isArray(rows) || !rows.length) throw bad('Aucune ligne à importer');
  if (rows.length > 5000) throw bad('5000 lignes maximum par import');
  const classes = Object.fromEntries(db.prepare('SELECT id, name FROM classes').all().map((c) => [slug(c.name), c.id]));
  const defaultClass = req.body.class_id ? id(req.body.class_id) : null;
  const errors = []; let created = 0, updated = 0;
  tx(() => rows.forEach((raw, i) => {
    try {
      const cls = raw.classe ? classes[slug(raw.classe)] : defaultClass;
      if (raw.classe && !cls) throw bad(`classe « ${raw.classe} » inconnue`);
      const s = studentBody({ ...raw, class_id: cls || defaultClass, date_naissance: normDate(raw.date_naissance) });
      const ex = s.matricule && db.prepare('SELECT id FROM students WHERE matricule = ?').get(s.matricule);
      if (ex) {
        db.prepare('UPDATE students SET nom=?, prenom=?, sexe=?, date_naissance=?, lieu_naissance=?, class_id=?, redoublant=?, parent_nom=?, parent_tel=? WHERE id=?')
          .run(s.nom, s.prenom, s.sexe, s.date_naissance, s.lieu_naissance, s.class_id, s.redoublant, s.parent_nom, s.parent_tel, ex.id); updated++;
      } else { insStudent(s); created++; }
    } catch (e) { errors.push(`Ligne ${i + 2} : ${e.message}`); }
  }));
  audit(req, 'IMPORT_ELEVES', `${created} créés, ${updated} mis à jour, ${errors.length} erreurs`);
  res.json({ created, updated, errors: errors.slice(0, 100) });
});
function normDate(v) {
  if (!v) return null; const s = String(v).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/* ============ Personnels : enseignants & responsables disciplinaires ============ */
r.get('/users', (req, res) => {
  const role = oneOf(req.query.role, ['teacher', 'discipline', 'admin'], 'Rôle');
  const users = db.prepare(`SELECT id, role, username, full_name, sexe, phone, email, matricule, specialite, active, must_change, last_login,
      locked_until > unixepoch() locked, created_at FROM users WHERE role = ? ORDER BY full_name COLLATE NOCASE`).all(role);
  for (const u of users) {
    if (role === 'teacher') u.assignments = db.prepare(`SELECT cs.id, c.name classe, s.name subject, cs.coef, cs.hours_week FROM class_subjects cs
      JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id WHERE cs.teacher_id = ? ORDER BY c.name`).all(u.id);
    if (role === 'discipline') u.classes = db.prepare(`SELECT c.id, c.name FROM officer_classes oc JOIN classes c ON c.id = oc.class_id WHERE oc.user_id = ? ORDER BY c.name`).all(u.id);
  }
  res.json(users);
});
const userBody = (b) => ({ full_name: str(b.full_name, { max: 120, required: true, label: 'Nom complet' }),
  sexe: b.sexe ? oneOf(String(b.sexe).toUpperCase().slice(0, 1), ['M', 'F'], 'Sexe') : null, phone: str(b.phone, { max: 30 }),
  email: str(b.email, { max: 120 }), matricule: str(b.matricule, { max: 30 }), specialite: str(b.specialite, { max: 80 }) });
function createUser(req, role, b, classIds) {
  const u = userBody(b);
  const username = b.username ? str(b.username, { max: 40 }).toLowerCase().replace(/[^a-z0-9._-]/g, '') : genUsername(u.full_name, role);
  if (!username) throw bad('Identifiant invalide');
  const password = genPassword();
  const info = db.prepare(`INSERT INTO users(role, username, pass_hash, full_name, sexe, phone, email, matricule, specialite, must_change) VALUES(?,?,?,?,?,?,?,?,?,1)`)
    .run(role, username, hashPassword(password), u.full_name, u.sexe, u.phone, u.email, u.matricule, u.specialite);
  const uid = Number(info.lastInsertRowid);
  if (role === 'discipline' && classIds?.length) setOfficerClasses(uid, classIds);
  audit(req, 'COMPTE_CREE', `${role} ${username}`);
  return { id: uid, role, full_name: u.full_name, username, password };
}
function setOfficerClasses(uid, classIds) {
  db.prepare('DELETE FROM officer_classes WHERE user_id = ?').run(uid);
  const ins = db.prepare('INSERT OR IGNORE INTO officer_classes(user_id, class_id) VALUES(?,?)');
  classIds.forEach((c) => ins.run(uid, id(c)));
}
r.post('/users', (req, res) => {
  const role = oneOf(req.body.role, ['teacher', 'discipline', 'admin'], 'Rôle');
  res.status(201).json(tx(() => createUser(req, role, req.body, req.body.class_ids)));
});
r.post('/users/import', (req, res) => {
  const role = oneOf(req.body.role, ['teacher', 'discipline'], 'Rôle');
  const rows = req.body.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw bad('Lignes invalides (1 à 1000)');
  const created = [], errors = [];
  tx(() => rows.forEach((row, i) => {
    try { created.push(createUser(req, role, { ...row, full_name: row.full_name || [row.nom, row.prenom].filter(Boolean).join(' ') }, [])); }
    catch (e) { errors.push(`Ligne ${i + 2} : ${e.message}`); }
  }));
  res.json({ created, errors });
});
r.put('/users/:id', (req, res) => {
  const uid = id(req.params.id); const u = userBody(req.body);
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(uid);
  if (!target) throw new HttpError(404, 'Utilisateur introuvable');
  db.prepare('UPDATE users SET full_name=?, sexe=?, phone=?, email=?, matricule=?, specialite=? WHERE id=?').run(u.full_name, u.sexe, u.phone, u.email, u.matricule, u.specialite, uid);
  if (target.role === 'discipline' && Array.isArray(req.body.class_ids)) tx(() => setOfficerClasses(uid, req.body.class_ids));
  audit(req, 'COMPTE_MODIFIE', u.full_name);
  res.json({ ok: true });
});
r.post('/users/:id/reset', (req, res) => {
  const uid = id(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  if (!u) throw new HttpError(404, 'Utilisateur introuvable');
  const password = genPassword();
  db.prepare('UPDATE users SET pass_hash = ?, must_change = 1, failed_attempts = 0, locked_until = 0 WHERE id = ?').run(hashPassword(password), uid);
  destroyUserSessions(uid);
  audit(req, 'MOT_DE_PASSE_REINITIALISE', u.username);
  res.json({ id: uid, role: u.role, full_name: u.full_name, username: u.username, password });
});
r.post('/users/:id/toggle', (req, res) => {
  const uid = id(req.params.id);
  if (uid === req.user.id) throw bad('Vous ne pouvez pas désactiver votre propre compte');
  db.prepare('UPDATE users SET active = 1 - active, locked_until = 0, failed_attempts = 0 WHERE id = ?').run(uid);
  destroyUserSessions(uid);
  audit(req, 'COMPTE_ACTIVATION', String(uid));
  res.json({ ok: true });
});
r.delete('/users/:id', (req, res) => {
  const uid = id(req.params.id);
  if (uid === req.user.id) throw bad('Vous ne pouvez pas supprimer votre propre compte');
  const u = db.prepare('SELECT username, role FROM users WHERE id = ?').get(uid);
  if (!u) throw new HttpError(404, 'Utilisateur introuvable');
  if (u.role === 'admin' && db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c <= 1) throw bad('Il doit rester au moins un administrateur');
  db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  audit(req, 'COMPTE_SUPPRIME', u.username);
  res.json({ ok: true });
});

/* ============ Emplois du temps ============ */
function slotLabel(cs) { return cs ? `${cs.code || cs.subject}${cs.teacher ? ' — ' + cs.teacher : ''}` : ''; }
export function timetableGrid({ classId, teacherId }) {
  const s = getSettings();
  const rows = db.prepare(`SELECT t.*, s.name subject, s.code, u.full_name teacher, c.name classe, cs.teacher_id
    FROM timetable t JOIN class_subjects cs ON cs.id = t.class_subject_id JOIN subjects s ON s.id = cs.subject_id
    JOIN classes c ON c.id = t.class_id LEFT JOIN users u ON u.id = cs.teacher_id
    WHERE ${classId ? 't.class_id = ?' : 'cs.teacher_id = ?'}`).all(classId || teacherId);
  return { slots: s.time_slots, days: s.jours_actifs, cells: rows };
}
r.get('/timetable/:classId', (req, res) => {
  const cid = id(req.params.classId);
  const g = timetableGrid({ classId: cid });
  const css = db.prepare(`SELECT cs.id, cs.hours_week, cs.teacher_id, s.name subject, s.code, u.full_name teacher,
      (SELECT COUNT(*) FROM timetable t WHERE t.class_subject_id = cs.id) placed
    FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id LEFT JOIN users u ON u.id = cs.teacher_id WHERE cs.class_id = ? ORDER BY s.name`).all(cid);
  // occupation des enseignants dans les autres classes (pour signaler les conflits dans l'interface)
  const busy = db.prepare(`SELECT t.day, t.slot, cs.teacher_id, c.name classe FROM timetable t JOIN class_subjects cs ON cs.id = t.class_subject_id
    JOIN classes c ON c.id = t.class_id WHERE t.class_id != ? AND cs.teacher_id IS NOT NULL`).all(cid);
  res.json({ ...g, subjects: css, busy });
});
function teacherConflict(classId, day, slot, csId) {
  const cs = db.prepare('SELECT teacher_id FROM class_subjects WHERE id = ?').get(csId);
  if (!cs?.teacher_id) return null;
  return db.prepare(`SELECT c.name classe FROM timetable t JOIN class_subjects cs ON cs.id = t.class_subject_id JOIN classes c ON c.id = t.class_id
    WHERE cs.teacher_id = ? AND t.day = ? AND t.slot = ? AND t.class_id != ?`).get(cs.teacher_id, day, slot, classId);
}
function roomConflict(classId, day, slot, room) {
  if (!room) return null;
  return db.prepare('SELECT c.name classe FROM timetable t JOIN classes c ON c.id = t.class_id WHERE t.room = ? AND t.day = ? AND t.slot = ? AND t.class_id != ?').get(room, day, slot, classId);
}
r.put('/timetable', (req, res) => {
  const s = getSettings();
  const classId = id(req.body.class_id), day = num(req.body.day, { min: 1, max: 6, int: true, required: true, label: 'Jour' });
  const slot = num(req.body.slot, { min: 0, max: s.time_slots.length - 1, int: true, required: true, label: 'Créneau' });
  if (s.time_slots[slot]?.break) throw bad('Ce créneau est une pause');
  const csId = id(req.body.class_subject_id); const room = str(req.body.room, { max: 40 });
  const cs = db.prepare('SELECT class_id FROM class_subjects WHERE id = ?').get(csId);
  if (!cs || cs.class_id !== classId) throw bad("Cette matière n'appartient pas à la classe");
  const tc = teacherConflict(classId, day, slot, csId);
  if (tc) throw new HttpError(409, `Conflit : l'enseignant a déjà cours en ${tc.classe} sur ce créneau.`);
  const rc = roomConflict(classId, day, slot, room);
  if (rc) throw new HttpError(409, `Conflit : la salle ${room} est occupée par ${rc.classe} sur ce créneau.`);
  db.prepare(`INSERT INTO timetable(class_id, day, slot, class_subject_id, room) VALUES(?,?,?,?,?)
    ON CONFLICT(class_id, day, slot) DO UPDATE SET class_subject_id = excluded.class_subject_id, room = excluded.room`).run(classId, day, slot, csId, room);
  res.json({ ok: true });
});
r.delete('/timetable', (req, res) => {
  db.prepare('DELETE FROM timetable WHERE class_id = ? AND day = ? AND slot = ?').run(id(req.query.class_id), num(req.query.day, { int: true, required: true }), num(req.query.slot, { int: true, required: true }));
  res.json({ ok: true });
});
// Génération automatique : répartit le volume horaire hebdomadaire en évitant les conflits enseignants
export function generateTimetable(cid) {
  const s = getSettings();
  const slots = s.time_slots.map((t, i) => ({ ...t, i })).filter((t) => !t.break);
  const days = s.jours_actifs;
  const cls = db.prepare('SELECT room FROM classes WHERE id = ?').get(cid);
  const css = db.prepare('SELECT id, teacher_id, hours_week FROM class_subjects WHERE class_id = ? ORDER BY hours_week DESC, id').all(cid);
  return tx(() => {
    db.prepare('DELETE FROM timetable WHERE class_id = ?').run(cid);
    const busyT = new Set(db.prepare('SELECT cs.teacher_id, t.day, t.slot FROM timetable t JOIN class_subjects cs ON cs.id = t.class_subject_id WHERE cs.teacher_id IS NOT NULL')
      .all().map((x) => `${x.teacher_id}|${x.day}|${x.slot}`));
    const taken = new Set(); const perDay = {}; const missing = [];
    const ins = db.prepare('INSERT INTO timetable(class_id, day, slot, class_subject_id, room) VALUES(?,?,?,?,?)');
    css.forEach((cs, ci) => {
      let need = Math.round(cs.hours_week);
      // rotation des jours de départ pour bien répartir les matières sur la semaine
      const order = days.map((_, k) => days[(k + ci) % days.length]);
      for (let pass = 0; pass < 3 && need > 0; pass++) {
        const maxDay = pass === 0 ? 2 : pass === 1 ? 3 : 4;
        for (const d of order) {
          if (need <= 0) break;
          let placedToday = 0;
          for (const sl of slots) {
            if (need <= 0 || (perDay[`${cs.id}|${d}`] || 0) >= maxDay || (pass === 0 && placedToday >= 2)) break;
            const key = `${d}|${sl.i}`;
            if (taken.has(key) || (cs.teacher_id && busyT.has(`${cs.teacher_id}|${d}|${sl.i}`))) continue;
            ins.run(cid, d, sl.i, cs.id, cls?.room || null);
            taken.add(key); if (cs.teacher_id) busyT.add(`${cs.teacher_id}|${d}|${sl.i}`);
            perDay[`${cs.id}|${d}`] = (perDay[`${cs.id}|${d}`] || 0) + 1; need--; placedToday++;
          }
        }
      }
      if (need > 0) missing.push({ cs_id: cs.id, missing: need });
    });
    return { placed: taken.size, missing };
  });
}
r.post('/timetable/:classId/generate', (req, res) => {
  const cid = id(req.params.classId);
  const result = generateTimetable(cid);
  audit(req, 'EDT_GENERE', `classe ${cid}`);
  res.json(result);
});

/* ============ Résultats & statistiques ============ */
r.get('/results', (req, res) => res.json(computeClassResults(id(req.query.class_id), req.query.period || 'S1')));
r.get('/stats', (req, res) => {
  const period = req.query.period || 'S1';
  const classes = db.prepare('SELECT id FROM classes ORDER BY name').all();
  const all = classes.map((c) => computeClassResults(c.id, period));
  const bySubject = {}, byType = {};
  for (const cr of all) for (const ss of cr.subjectStats) {
    const b = (bySubject[ss.subject] ??= { subject: ss.subject, sum: 0, n: 0, pass: 0 });
    const t = (byType[ss.type_name || 'Non défini'] ??= { type: ss.type_name || 'Non défini', sum: 0, n: 0, pass: 0 });
    for (const rr of cr.results) {
      const l = rr.lines.find((x) => x.cs_id === ss.cs_id);
      if (l?.avg != null) for (const x of [b, t]) { x.sum += l.avg; x.n++; if (l.avg >= cr.seuil) x.pass++; }
    }
  }
  const students = all.flatMap((cr) => cr.results.filter((x) => x.general != null).map((x) => ({ nom: `${x.student.nom} ${x.student.prenom}`, sexe: x.student.sexe, classe: cr.classe.name, general: x.general, seuil: cr.seuil })));
  const g = (sx) => { const l = students.filter((x) => x.sexe === sx); return { n: l.length, reussite: l.length ? round2((l.filter((x) => x.general >= x.seuil).length / l.length) * 100) : null }; };
  res.json({
    period, classes: all.map((cr) => ({ id: cr.classe.id, classe: cr.classe.name, ...cr.stats })),
    subjects: Object.values(bySubject).map((b) => ({ subject: b.subject, moyenne: b.n ? round2(b.sum / b.n) : null, reussite: b.n ? round2((b.pass / b.n) * 100) : null, n: b.n }))
      .sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1)),
    types: Object.values(byType).map((b) => ({ type: b.type, moyenne: b.n ? round2(b.sum / b.n) : null, reussite: b.n ? round2((b.pass / b.n) * 100) : null, n: b.n })),
    top: students.sort((a, b) => b.general - a.general).slice(0, 10),
    global: { n: students.length, reussite: students.length ? round2((students.filter((x) => x.general >= x.seuil).length / students.length) * 100) : null,
      moyenne: students.length ? round2(students.reduce((a, x) => a + x.general, 0) / students.length) : null, garcons: g('M'), filles: g('F') },
    discipline: db.prepare(`SELECT c.name classe, COALESCE(SUM(d.abs_nj),0) abs_nj, COALESCE(SUM(d.abs_j),0) abs_j, COALESCE(SUM(d.retards),0) retards,
      (SELECT COUNT(*) FROM incidents i JOIN students s2 ON s2.id = i.student_id WHERE s2.class_id = c.id) incidents
      FROM classes c LEFT JOIN students s ON s.class_id = c.id LEFT JOIN discipline_records d ON d.student_id = s.id GROUP BY c.id ORDER BY c.name`).all()
  });
});

/* ============ Suivi de saisie (progressions des enseignants) ============ */
r.get('/progressions', (_req, res) => {
  res.json(db.prepare(`SELECT cs.id, c.name classe, s.name subject, u.full_name teacher,
      COALESCE(SUM(p.planned),0) planned, COALESCE(SUM(p.done),0) done
    FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id
    LEFT JOIN users u ON u.id = cs.teacher_id LEFT JOIN progressions p ON p.class_subject_id = cs.id
    GROUP BY cs.id ORDER BY c.name, s.name`).all());
});

/* ============ Annonces ============ */
r.post('/announcements', (req, res) => {
  const t = str(req.body.title, { max: 120, required: true, label: 'Titre' }), b = str(req.body.body, { max: 3000, required: true, label: 'Message' });
  const a = oneOf(req.body.audience || 'all', ['all', 'teacher', 'discipline'], 'Destinataires');
  db.prepare('INSERT INTO announcements(title, body, audience, author) VALUES(?,?,?,?)').run(t, b, a, req.user.full_name);
  audit(req, 'ANNONCE', t);
  res.status(201).json({ ok: true });
});
r.delete('/announcements/:id', (req, res) => { db.prepare('DELETE FROM announcements WHERE id = ?').run(id(req.params.id)); res.json({ ok: true }); });

/* ============ Journal d'audit ============ */
r.get('/audit', (req, res) => {
  const q = req.query.q ? `%${str(req.query.q, { max: 60 })}%` : '%';
  res.json(db.prepare(`SELECT * FROM audit_log WHERE (COALESCE(username,'') || ' ' || action || ' ' || COALESCE(detail,'')) LIKE ? ORDER BY id DESC LIMIT 500`).all(q));
});

/* ============ Sauvegarde / restauration / nouvelle année ============ */
const TABLES = ['settings', 'users', 'classes', 'subject_groups', 'subject_types', 'subjects', 'class_subjects', 'students', 'officer_classes', 'periods', 'notes', 'note_validations',
  'progressions', 'discipline_records', 'incidents', 'discipline_validations', 'timetable', 'announcements'];
r.get('/backup', (req, res) => {
  const dump = { app: 'EduGest CM', version: 1, created_at: new Date().toISOString(), tables: {} };
  for (const t of TABLES) dump.tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
  audit(req, 'SAUVEGARDE');
  res.setHeader('Content-Disposition', `attachment; filename="edugest-sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(dump);
});
r.post('/restore', express.json({ limit: '50mb' }), (req, res) => {
  confirmPassword(req);
  const dump = req.body.dump;
  if (!dump || dump.app !== 'EduGest CM' || typeof dump.tables !== 'object') throw bad('Fichier de sauvegarde invalide');
  if (!dump.tables.users?.some((u) => u.role === 'admin')) throw bad('La sauvegarde ne contient aucun administrateur');
  tx(() => {
    db.exec('PRAGMA defer_foreign_keys = ON');
    for (const t of [...TABLES].reverse()) db.exec(`DELETE FROM ${t}`);
    db.exec('DELETE FROM sessions');
    for (const t of TABLES) {
      const rows = dump.tables[t] || [];
      if (!rows.length) continue;
      const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
      const use = cols.filter((c) => c in rows[0]);
      const ins = db.prepare(`INSERT INTO ${t}(${use.join(',')}) VALUES(${use.map(() => '?').join(',')})`);
      for (const row of rows) ins.run(...use.map((c) => row[c]));
    }
    // sauvegarde d'une version antérieure (champ « groupe » unique) : conversion vers groupe + type
    ensureTaxonomy();
    const legacy = (dump.tables.subjects || []).filter((x) => x.groupe != null && x.group_id === undefined);
    for (const x of legacy) { const t = legacyTaxonomy(x.groupe); db.prepare('UPDATE subjects SET group_id = ?, type_id = ? WHERE id = ?').run(t.group_id, t.type_id, x.id); }
  });
  audit(req, 'RESTAURATION', dump.created_at);
  res.json({ ok: true });
});
r.post('/new-year', (req, res) => {
  confirmPassword(req);
  const annee = str(req.body.annee_scolaire, { max: 9, required: true, label: 'Année scolaire' });
  if (!/^\d{4}-\d{4}$/.test(annee)) throw bad('Format attendu : 2026-2027');
  tx(() => {
    for (const t of ['notes', 'note_validations', 'progressions', 'discipline_records', 'incidents', 'discipline_validations']) db.exec(`DELETE FROM ${t}`);
    db.exec("UPDATE periods SET status = 'open', closed_at = NULL, closed_by = NULL, forced = 0");
    const y = +annee.slice(0, 4);
    const plan = [[`${y}-09-02`, `${y}-10-18`], [`${y}-10-21`, `${y}-12-06`], [`${y + 1}-01-06`, `${y + 1}-02-14`], [`${y + 1}-02-17`, `${y + 1}-03-28`], [`${y + 1}-03-31`, `${y + 1}-05-09`], [`${y + 1}-05-12`, `${y + 1}-06-13`]];
    plan.forEach((p, i) => db.prepare('UPDATE periods SET start_date = ?, end_date = ? WHERE seq = ?').run(p[0], p[1], i + 1));
    saveSettings({ annee_scolaire: annee });
  });
  audit(req, 'NOUVELLE_ANNEE', annee);
  res.json({ ok: true });
});

export default r;
