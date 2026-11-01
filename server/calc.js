// Moteur de calcul : moyennes pondérées, rangs (ex æquo), statistiques, appréciations.
import { db, getSettings } from './db.js';

export const TRIMESTRES = { 1: [1, 2], 2: [3, 4], 3: [5, 6] };

/** 'S3' | 'T2' | 'A' → { type, n, seqs, label } */
export function parsePeriod(p) {
  const m = /^(S|T|A)([1-6])?$/.exec(String(p || '').toUpperCase());
  if (!m) throw Object.assign(new Error('Période invalide'), { status: 400 });
  const [, t, n] = m;
  if (t === 'S' && n) return { type: 'S', n: +n, seqs: [+n], label: `Séquence ${n}`, code: `S${n}` };
  if (t === 'T' && n && +n <= 3) return { type: 'T', n: +n, seqs: TRIMESTRES[n], label: `Trimestre ${n}`, code: `T${n}` };
  if (t === 'A') return { type: 'A', n: 0, seqs: [1, 2, 3, 4, 5, 6], label: 'Bilan annuel', code: 'A' };
  throw Object.assign(new Error('Période invalide'), { status: 400 });
}

export function appreciation(avg) {
  if (avg == null || Number.isNaN(avg)) return '—';
  if (avg >= 18) return 'Excellent';
  if (avg >= 16) return 'Très bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez bien';
  if (avg >= 10) return 'Passable';
  if (avg >= 8) return 'Insuffisant';
  if (avg >= 5) return 'Faible';
  return 'Très faible';
}
export function decisionConseil(avg, disc = {}) {
  if (avg == null) return 'Non classé';
  let d;
  if (avg >= 16) d = "Tableau d'honneur + Félicitations";
  else if (avg >= 14) d = "Tableau d'honneur + Encouragements";
  else if (avg >= 12) d = "Tableau d'honneur";
  else if (avg >= 10) d = 'Travail acceptable';
  else if (avg >= 8) d = 'Avertissement travail';
  else d = 'Blâme travail';
  if (disc.blame || disc.exclusion_jours) d += ' — Blâme conduite';
  else if (disc.avertissement || (disc.abs_nj || 0) >= 10) d += ' — Avertissement conduite';
  return d;
}

export const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const mean = (arr) => { const v = arr.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

/** Attribue des rangs avec ex æquo. items: [{key, value}] → Map key → {rang, exaequo} */
export function rank(items) {
  const sorted = items.filter((i) => i.value != null).sort((a, b) => b.value - a.value);
  const out = new Map();
  sorted.forEach((it, i) => {
    const prev = sorted[i - 1];
    const r = prev && Math.abs(prev.value - it.value) < 1e-9 ? out.get(prev.key).rang : i + 1;
    out.set(it.key, { rang: r });
  });
  for (const [k, v] of out) v.exaequo = [...out.values()].filter((x) => x.rang === v.rang).length > 1;
  return out;
}

export function classSubjects(classId) {
  return db.prepare(`SELECT cs.id, cs.coef, cs.teacher_id, cs.hours_week, s.id subject_id, s.name subject, s.code, s.groupe,
      u.full_name teacher
    FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id LEFT JOIN users u ON u.id = cs.teacher_id
    WHERE cs.class_id = ? ORDER BY s.groupe, s.name`).all(classId);
}
export function classStudents(classId) {
  return db.prepare(`SELECT * FROM students WHERE class_id = ? AND active = 1 ORDER BY nom COLLATE NOCASE, prenom COLLATE NOCASE`).all(classId);
}

/** Calcule les résultats complets d'une classe sur une période. */
export function computeClassResults(classId, periodCode) {
  const period = parsePeriod(periodCode);
  const settings = getSettings();
  const seuil = Number(settings.seuil_reussite) || 10;
  const cls = db.prepare(`SELECT c.*, u.full_name titulaire FROM classes c LEFT JOIN users u ON u.id = c.titulaire_id WHERE c.id = ?`).get(classId);
  if (!cls) throw Object.assign(new Error('Classe introuvable'), { status: 404 });
  const subjects = classSubjects(classId);
  const students = classStudents(classId);
  const seqs = period.seqs;

  // notes[studentId][csId][seq] = {value, absent}
  const notes = {};
  if (subjects.length && students.length) {
    const rows = db.prepare(`SELECT n.* FROM notes n JOIN class_subjects cs ON cs.id = n.class_subject_id
      WHERE cs.class_id = ? AND n.seq IN (${seqs.map(() => '?').join(',')})`).all(classId, ...seqs);
    for (const r of rows) ((notes[r.student_id] ??= {})[r.class_subject_id] ??= {})[r.seq] = r;
  }
  const noteOf = (sid, csid, s) => { const n = notes[sid]?.[csid]?.[s]; return n && !n.absent && n.value != null ? n.value : null; };

  // moyenne matière pour la période
  const subjAvg = (sid, csid) => {
    if (period.type === 'S') return noteOf(sid, csid, period.n);
    if (period.type === 'T') return mean(seqs.map((s) => noteOf(sid, csid, s)));
    return mean([1, 2, 3].map((t) => mean(TRIMESTRES[t].map((s) => noteOf(sid, csid, s)))));
  };

  const disc = {};
  if (students.length) {
    const rows = db.prepare(`SELECT d.student_id, SUM(abs_j) abs_j, SUM(abs_nj) abs_nj, SUM(retards) retards, SUM(consignes) consignes,
        MAX(avertissement) avertissement, MAX(blame) blame, SUM(exclusion_jours) exclusion_jours
      FROM discipline_records d JOIN students st ON st.id = d.student_id
      WHERE st.class_id = ? AND d.seq IN (${seqs.map(() => '?').join(',')}) GROUP BY d.student_id`).all(classId, ...seqs);
    for (const r of rows) disc[r.student_id] = r;
  }

  const res = students.map((st) => {
    const lines = subjects.map((cs) => {
      const avg = subjAvg(st.id, cs.id);
      const bySeq = Object.fromEntries(seqs.map((s) => {
        const n = notes[st.id]?.[cs.id]?.[s];
        return [s, n ? (n.absent ? 'ABS' : n.value) : null];
      }));
      return { cs_id: cs.id, subject: cs.subject, groupe: cs.groupe, coef: cs.coef, teacher: cs.teacher, bySeq,
        avg: round2(avg), total: avg == null ? null : round2(avg * cs.coef), appreciation: appreciation(avg) };
    });
    let sc = 0, sw = 0;
    for (const l of lines) if (l.avg != null) { sc += l.avg * l.coef; sw += l.coef; }
    const general = sw ? sc / sw : null;
    const d = disc[st.id] || { abs_j: 0, abs_nj: 0, retards: 0, consignes: 0, avertissement: 0, blame: 0, exclusion_jours: 0 };
    return { student: st, lines, total_points: round2(sc), total_coef: sw, general: round2(general),
      appreciation: appreciation(general), discipline: d, decision: decisionConseil(general, d) };
  });

  // rangs généraux et par matière
  const gr = rank(res.map((r) => ({ key: r.student.id, value: r.general })));
  res.forEach((r) => { const g = gr.get(r.student.id); r.rang = g?.rang ?? null; r.exaequo = !!g?.exaequo; });
  const subjectStats = subjects.map((cs) => {
    const vals = res.map((r) => r.lines.find((l) => l.cs_id === cs.id).avg).filter((v) => v != null);
    const rk = rank(res.map((r) => ({ key: r.student.id, value: r.lines.find((l) => l.cs_id === cs.id).avg })));
    res.forEach((r) => { const l = r.lines.find((x) => x.cs_id === cs.id); l.rang = rk.get(r.student.id)?.rang ?? null; });
    return { cs_id: cs.id, subject: cs.subject, coef: cs.coef, teacher: cs.teacher, count: vals.length,
      avg: round2(mean(vals)), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null,
      reussite: vals.length ? round2((vals.filter((v) => v >= seuil).length / vals.length) * 100) : null };
  });
  res.sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.student.nom.localeCompare(b.student.nom));

  const gens = res.map((r) => r.general).filter((v) => v != null);
  const stats = {
    effectif: students.length, classes: gens.length,
    garcons: students.filter((s) => s.sexe === 'M').length, filles: students.filter((s) => s.sexe === 'F').length,
    moyenne: round2(mean(gens)), max: gens.length ? Math.max(...gens) : null, min: gens.length ? Math.min(...gens) : null,
    admis: gens.filter((g) => g >= seuil).length,
    reussite: gens.length ? round2((gens.filter((g) => g >= seuil).length / gens.length) * 100) : null,
    ecart_type: gens.length ? round2(Math.sqrt(mean(gens.map((g) => (g - mean(gens)) ** 2)))) : null
  };
  return { classe: cls, period, subjects, subjectStats, results: res, stats, seuil };
}

/** État de complétude de la saisie pour une séquence (utilisé pour la clôture). */
export function completeness(seq) {
  const cs = db.prepare(`SELECT cs.id, c.id class_id, c.name classe, s.name subject, u.full_name teacher,
      (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.active = 1) effectif,
      (SELECT COUNT(*) FROM notes n JOIN students st ON st.id = n.student_id AND st.active = 1
         WHERE n.class_subject_id = cs.id AND n.seq = ? AND (n.value IS NOT NULL OR n.absent = 1)) saisies,
      (SELECT validated_at FROM note_validations v WHERE v.class_subject_id = cs.id AND v.seq = ?) validated_at
    FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id
    LEFT JOIN users u ON u.id = cs.teacher_id ORDER BY c.name, s.name`).all(seq, seq);
  const disc = db.prepare(`SELECT c.id class_id, c.name classe,
      (SELECT GROUP_CONCAT(u.full_name, ', ') FROM officer_classes oc JOIN users u ON u.id = oc.user_id WHERE oc.class_id = c.id) officers,
      (SELECT validated_at FROM discipline_validations v WHERE v.class_id = c.id AND v.seq = ?) validated_at
    FROM classes c ORDER BY c.name`).all(seq);
  const notesDone = cs.filter((c) => c.effectif > 0 && c.saisies >= c.effectif && c.validated_at).length;
  const notesTotal = cs.filter((c) => c.effectif > 0).length;
  const discDone = disc.filter((d) => d.validated_at).length;
  return {
    seq, notes: cs, discipline: disc,
    summary: { notesDone, notesTotal, discDone, discTotal: disc.length,
      ready: notesDone === notesTotal && discDone === disc.length,
      percent: Math.round(((notesDone + discDone) / Math.max(1, notesTotal + disc.length)) * 100) }
  };
}

/** Séquence courante d'après le calendrier. */
export function currentSeq() {
  const today = new Date().toISOString().slice(0, 10);
  const ps = db.prepare('SELECT * FROM periods ORDER BY seq').all();
  const inside = ps.find((p) => p.start_date <= today && today <= p.end_date);
  if (inside) return inside.seq;
  const firstOpen = ps.find((p) => p.status === 'open');
  return firstOpen ? firstOpen.seq : 6;
}

/** Vérifie qu'une saisie est autorisée pour une séquence (statut + calendrier). */
export function assertEntryOpen(seq) {
  const p = db.prepare('SELECT * FROM periods WHERE seq = ?').get(seq);
  if (!p) throw Object.assign(new Error('Séquence invalide'), { status: 400 });
  if (p.status === 'closed') throw Object.assign(new Error(`La séquence ${seq} est clôturée : saisie verrouillée.`), { status: 423 });
  const s = getSettings();
  const today = new Date().toISOString().slice(0, 10);
  if (s.strict_calendar && p.start_date && today < p.start_date)
    throw Object.assign(new Error(`La séquence ${seq} n'est pas encore ouverte (début le ${p.start_date}).`), { status: 423 });
  return p;
}
