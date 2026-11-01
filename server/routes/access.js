// Contrôle d'accès par rôle et par ressource (principe du moindre privilège).
import { db } from '../db.js';
import { HttpError } from '../util.js';

export const requireAuth = (req, _res, next) => { if (!req.user) throw new HttpError(401, 'Session expirée, veuillez vous reconnecter.'); next(); };
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Session expirée, veuillez vous reconnecter.');
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Accès refusé.');
  next();
};

export function assertCs(user, csId) {
  const cs = db.prepare(`SELECT cs.*, c.name classe, s.name subject, u.full_name teacher FROM class_subjects cs
    JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id LEFT JOIN users u ON u.id = cs.teacher_id WHERE cs.id = ?`).get(csId);
  if (!cs) throw new HttpError(404, 'Attribution introuvable');
  if (user.role !== 'admin' && cs.teacher_id !== user.id) throw new HttpError(403, 'Cette classe/matière ne vous est pas attribuée.');
  return cs;
}
export function assertClass(user, classId) {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!c) throw new HttpError(404, 'Classe introuvable');
  if (user.role === 'admin') return c;
  if (user.role === 'discipline' && db.prepare('SELECT 1 FROM officer_classes WHERE user_id = ? AND class_id = ?').get(user.id, classId)) return c;
  if (user.role === 'teacher' && db.prepare('SELECT 1 FROM class_subjects WHERE teacher_id = ? AND class_id = ?').get(user.id, classId)) return c;
  throw new HttpError(403, 'Cette classe ne vous est pas attribuée.');
}

// Liens des interfaces de connexion d'un établissement (à transmettre aux personnels)
export const PORTAL_PATHS = { admin: 'admin', teacher: 'enseignant', discipline: 'discipline' };
export const portalLink = (req, role) => `${req.protocol}://${req.get('host')}${req.portalBase || ''}/${PORTAL_PATHS[role]}`;
