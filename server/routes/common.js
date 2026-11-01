import { Router } from 'express';
import { db } from '../db.js';
import { currentSeq } from '../calc.js';
import { id } from '../util.js';
import { requireAuth, assertClass } from './access.js';
import { timetableGrid } from './admin.js';
import { INCIDENT_TYPES } from './work.js';
import { HttpError } from '../util.js';

const r = Router();
r.use(requireAuth);

r.get('/periods', (_req, res) => res.json({ periods: db.prepare('SELECT * FROM periods ORDER BY seq').all(), current: currentSeq(), incidentTypes: INCIDENT_TYPES }));
r.get('/announcements', (req, res) => {
  res.json(db.prepare("SELECT * FROM announcements WHERE audience = 'all' OR audience = ? OR ? = 'admin' ORDER BY id DESC LIMIT 50").all(req.user.role, req.user.role));
});
r.get('/classes/mine', (req, res) => {
  const u = req.user;
  const sql = u.role === 'admin' ? 'SELECT id, name FROM classes ORDER BY name'
    : u.role === 'teacher' ? 'SELECT DISTINCT c.id, c.name FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.teacher_id = ? ORDER BY c.name'
      : 'SELECT c.id, c.name FROM officer_classes oc JOIN classes c ON c.id = oc.class_id WHERE oc.user_id = ? ORDER BY c.name';
  res.json(u.role === 'admin' ? db.prepare(sql).all() : db.prepare(sql).all(u.id));
});
r.get('/timetable/class/:id', (req, res) => {
  const c = assertClass(req.user, id(req.params.id));
  res.json({ title: c.name, ...timetableGrid({ classId: c.id }) });
});
r.get('/timetable/teacher/:id', (req, res) => {
  const tid = id(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== tid) throw new HttpError(403, 'Accès refusé.');
  const t = db.prepare("SELECT full_name FROM users WHERE id = ? AND role = 'teacher'").get(tid);
  if (!t) throw new HttpError(404, 'Enseignant introuvable');
  res.json({ title: t.full_name, ...timetableGrid({ teacherId: tid }) });
});
r.get('/search', (req, res) => {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Accès refusé.');
  const q = `%${String(req.query.q || '').slice(0, 60)}%`;
  res.json({
    students: db.prepare("SELECT s.id, s.nom, s.prenom, s.matricule, c.name classe FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE (s.nom || ' ' || s.prenom || ' ' || s.matricule) LIKE ? LIMIT 8").all(q),
    users: db.prepare("SELECT id, full_name, username, role FROM users WHERE (full_name || ' ' || username) LIKE ? LIMIT 6").all(q),
    classes: db.prepare('SELECT id, name FROM classes WHERE name LIKE ? LIMIT 5').all(q)
  });
});
export default r;
