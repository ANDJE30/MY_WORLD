// Exports PDF — chaque route vérifie les droits d'accès à la ressource demandée.
import { Router } from 'express';
import { db, audit } from '../db.js';
import { parsePeriod, computeClassResults, rank, round2, classStudents } from '../calc.js';
import { id, str, bad, HttpError } from '../util.js';
import { requireAuth, requireRole, assertCs, assertClass, portalLink } from './access.js';
import { unseal } from '../vault.js';
import { computeStats } from './admin.js';
import * as P from '../pdf.js';
import { timetableGrid } from './admin.js';

const r = Router();
r.use(requireAuth);

// Relevé de notes d'une classe/matière (enseignant ou admin)
r.get('/releve', (req, res) => {
  const cs = assertCs(req.user, id(req.query.cs));
  const period = parsePeriod(req.query.period || 'S1');
  const classe = db.prepare('SELECT * FROM classes WHERE id = ?').get(cs.class_id);
  const students = classStudents(cs.class_id);
  const notes = db.prepare(`SELECT * FROM notes WHERE class_subject_id = ? AND seq IN (${period.seqs.join(',')})`).all(cs.id);
  const rows = students.map((st) => {
    const bySeq = {}; const vals = [];
    for (const s of period.seqs) {
      const n = notes.find((x) => x.student_id === st.id && x.seq === s);
      bySeq[s] = n ? (n.absent ? 'ABS' : n.value) : null;
      if (n && !n.absent && n.value != null) vals.push(n.value);
    }
    const allAbs = period.seqs.every((s) => bySeq[s] === 'ABS');
    const avg = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : allAbs ? 'ABS' : null;
    return { ...st, bySeq, avg };
  });
  const rk = rank(rows.map((x) => ({ key: x.id, value: typeof x.avg === 'number' ? x.avg : null })));
  rows.forEach((x) => { x.rang = rk.get(x.id)?.rang ?? null; });
  const vals = rows.map((x) => x.avg).filter((v) => typeof v === 'number');
  const stats = { avg: vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null, max: vals.length ? Math.max(...vals) : null,
    min: vals.length ? Math.min(...vals) : null, admis: vals.filter((v) => v >= 10).length,
    reussite: vals.length ? round2((vals.filter((v) => v >= 10).length / vals.length) * 100) : null, absents: rows.filter((x) => x.avg === 'ABS').length };
  const doc = P.createDoc(res, { title: 'Relevé de notes', filename: `releve_${classe.name}_${cs.subject}_${period.code}` });
  P.releveNotes(doc, { classe, subject: cs.subject, teacher: cs.teacher, coef: cs.coef, period, rows, stats });
  audit(req, 'PDF_RELEVE', `${classe.name} / ${cs.subject} / ${period.code}`);
  P.finalize(doc);
});

// Fiche de progression (enseignant : la sienne ; admin : celle d'un enseignant)
r.get('/progression', requireRole('teacher', 'admin'), (req, res) => {
  const tid = req.user.role === 'admin' ? id(req.query.teacher_id) : req.user.id;
  const t = db.prepare('SELECT full_name FROM users WHERE id = ?').get(tid);
  if (!t) throw new HttpError(404, 'Enseignant introuvable');
  const css = db.prepare(`SELECT cs.id, c.name classe, s.name subject FROM class_subjects cs JOIN classes c ON c.id = cs.class_id
    JOIN subjects s ON s.id = cs.subject_id WHERE cs.teacher_id = ? ORDER BY c.name, s.name`).all(tid);
  const items = css.map((cs) => {
    const rows = db.prepare('SELECT * FROM progressions WHERE class_subject_id = ?').all(cs.id);
    return { ...cs, rows: [1, 2, 3, 4, 5, 6].map((s) => ({ seq: s, planned: 0, done: 0, comment: '', ...rows.find((x) => x.seq === s) })) };
  });
  const doc = P.createDoc(res, { title: 'Fiche de progression', filename: `progression_${t.full_name}` });
  P.progressionDoc(doc, { teacher: t.full_name, items });
  P.finalize(doc);
});

// Fiche des faits disciplinaires d'une classe pour une période
r.get('/discipline', requireRole('discipline', 'admin'), (req, res) => {
  const classe = assertClass(req.user, id(req.query.class_id));
  const period = parsePeriod(req.query.period || 'S1');
  const ph = period.seqs.join(',');
  const rows = db.prepare(`SELECT st.id, st.nom, st.prenom, COALESCE(SUM(d.abs_j),0) abs_j, COALESCE(SUM(d.abs_nj),0) abs_nj, COALESCE(SUM(d.retards),0) retards,
      COALESCE(SUM(d.consignes),0) consignes, COALESCE(MAX(d.avertissement),0) avertissement, COALESCE(MAX(d.blame),0) blame,
      COALESCE(SUM(d.exclusion_jours),0) exclusion_jours, GROUP_CONCAT(d.observation, ' / ') observation
    FROM students st LEFT JOIN discipline_records d ON d.student_id = st.id AND d.seq IN (${ph})
    WHERE st.class_id = ? AND st.active = 1 GROUP BY st.id ORDER BY st.nom COLLATE NOCASE, st.prenom COLLATE NOCASE`).all(classe.id);
  const incidents = db.prepare(`SELECT i.*, s.nom, s.prenom FROM incidents i JOIN students s ON s.id = i.student_id
    WHERE s.class_id = ? AND i.seq IN (${ph}) ORDER BY i.date`).all(classe.id);
  const officer = db.prepare(`SELECT GROUP_CONCAT(u.full_name, ', ') n FROM officer_classes oc JOIN users u ON u.id = oc.user_id WHERE oc.class_id = ?`).get(classe.id).n;
  const doc = P.createDoc(res, { title: 'Fiche disciplinaire', filename: `discipline_${classe.name}_${period.code}`, landscape: true });
  P.ficheDiscipline(doc, { classe, period, rows, incidents, officer });
  audit(req, 'PDF_DISCIPLINE', `${classe.name} / ${period.code}`);
  P.finalize(doc);
});

r.get('/discipline-eleve', requireRole('discipline', 'admin'), (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id(req.query.student_id));
  if (!student) throw new HttpError(404, 'Élève introuvable');
  const classe = assertClass(req.user, student.class_id);
  const records = db.prepare('SELECT * FROM discipline_records WHERE student_id = ? ORDER BY seq').all(student.id);
  const incidents = db.prepare('SELECT * FROM incidents WHERE student_id = ? ORDER BY date').all(student.id);
  const doc = P.createDoc(res, { title: 'Fiche disciplinaire individuelle', filename: `discipline_${student.nom}_${student.prenom}` });
  P.ficheEleveDiscipline(doc, { student, classe, records, incidents });
  P.finalize(doc);
});

// Bulletins (admin) : toute la classe ou un élève
r.get('/bulletins', requireRole('admin'), (req, res) => {
  const ctx = computeClassResults(id(req.query.class_id), req.query.period || 'S1');
  let list = ctx.results;
  if (req.query.student_id) list = list.filter((x) => x.student.id === id(req.query.student_id));
  if (!list.length) throw bad('Aucun élève dans cette sélection');
  const doc = P.createDoc(res, { title: 'Bulletins', filename: `bulletins_${ctx.classe.name}_${ctx.period.code}` });
  list.forEach((x, i) => { if (i) doc.addPage(); P.bulletin(doc, x, ctx); });
  audit(req, 'PDF_BULLETINS', `${ctx.classe.name} / ${ctx.period.code} (${list.length})`);
  P.finalize(doc);
});

r.get('/pv', requireRole('admin'), (req, res) => {
  const ctx = computeClassResults(id(req.query.class_id), req.query.period || 'S1');
  const doc = P.createDoc(res, { title: 'Procès-verbal', filename: `pv_${ctx.classe.name}_${ctx.period.code}`, landscape: true });
  P.pvClasse(doc, ctx);
  P.finalize(doc);
});

r.get('/liste', (req, res) => {
  const classe = assertClass(req.user, id(req.query.class_id));
  const doc = P.createDoc(res, { title: 'Liste de classe', filename: `liste_${classe.name}` });
  P.listeClasse(doc, { classe, students: classStudents(classe.id) });
  P.finalize(doc);
});

r.get('/timetable', (req, res) => {
  let title, subtitle, g;
  if (req.query.class_id) {
    const c = assertClass(req.user, id(req.query.class_id));
    g = timetableGrid({ classId: c.id }); title = `Emploi du temps — ${c.name}`; subtitle = c.room ? `Salle ${c.room}` : '';
  } else {
    const tid = req.user.role === 'admin' ? id(req.query.teacher_id) : req.user.id;
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') throw new HttpError(403, 'Accès refusé.');
    const t = db.prepare('SELECT full_name FROM users WHERE id = ?').get(tid);
    if (!t) throw new HttpError(404, 'Enseignant introuvable');
    g = timetableGrid({ teacherId: tid }); title = 'Emploi du temps enseignant'; subtitle = t.full_name;
  }
  const grid = {};
  for (const c of g.cells) (grid[c.day] ??= {})[c.slot] = req.query.class_id
    ? `${c.subject}\n${c.teacher || ''}${c.room ? ' • ' + c.room : ''}` : `${c.classe}\n${c.subject}${c.room ? ' • ' + c.room : ''}`;
  const doc = P.createDoc(res, { title, filename: title, landscape: true });
  P.emploiDuTemps(doc, { title, subtitle, grid, slots: g.slots, days: g.days });
  P.finalize(doc);
});

// Fiches d'identifiants : depuis le coffre (ids) ou juste après génération (items)
r.post('/credentials', requireRole('admin'), (req, res) => {
  let items;
  if (Array.isArray(req.body.ids)) {
    items = req.body.ids.slice(0, 500).map((x) => db.prepare("SELECT id, role, username, full_name, pw_enc FROM users WHERE id = ? AND role IN ('teacher','discipline')").get(id(x)))
      .filter(Boolean).map((u) => ({ full_name: u.full_name, username: u.username, role: u.role, password: unseal(u.pw_enc) || '(modifié par l\'utilisateur)' }));
  } else {
    items = (req.body.items || []).slice(0, 500).map((x) => ({
      full_name: str(x.full_name, { max: 120, required: true }), username: str(x.username, { max: 60, required: true }),
      password: str(x.password, { max: 60, required: true }), role: x.role }));
  }
  if (!items.length) throw bad('Aucun identifiant');
  items.forEach((it) => { it.link = portalLink(req, ['teacher', 'discipline', 'admin'].includes(it.role) ? it.role : 'teacher'); });
  const doc = P.createDoc(res, { title: 'Identifiants', filename: 'identifiants_confidentiels' });
  P.credentialsSheet(doc, items, portalLink(req, 'teacher'));
  audit(req, 'PDF_IDENTIFIANTS', `${items.length} compte(s)`);
  P.finalize(doc);
});

// Statistiques de l'établissement (séquence, trimestre ou année)
r.get('/stats', requireRole('admin'), (req, res) => {
  const st = computeStats(req.query.period || 'S1');
  const doc = P.createDoc(res, { title: 'Statistiques', filename: `statistiques_${st.period}` });
  P.statsReport(doc, st, { annual: st.period === 'A' });
  audit(req, 'PDF_STATISTIQUES', st.period);
  P.finalize(doc);
});

export default r;
