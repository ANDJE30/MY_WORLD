// Dossier administratif des enseignants : assiduité (présence effective au poste) et documents administratifs.
import { db, getSettings, saveSettings, HR_FIELDS } from './db.js';
export { HR_FIELDS };
import { parsePeriod } from './calc.js';

/* ---------- Types de documents ---------- */
export const DOC_TYPES = {
  presence: { code: 'APEP', titre: 'Attestation de présence effective au poste', court: 'Présence effective', lettre: false },
  prise_service: { code: 'CPS', titre: 'Certificat de prise de service', court: 'Prise de service', lettre: false },
  rappel_ordre: { code: 'RO', titre: "Rappel à l'ordre", court: "Rappel à l'ordre", lettre: true },
  observation: { code: 'LO', titre: "Lettre d'observation", court: "Lettre d'observation", lettre: true },
  demande_explication: { code: 'DE', titre: "Demande d'explication", court: "Demande d'explication", lettre: true }
};
export const DOC_STATUS = { emis: 'Émis', repondu: 'Réponse reçue', clos: 'Clos', annule: 'Annulé' };
export const DEFAULT_AMPLIATIONS = {
  presence: ['Hiérarchie', 'Intéressé(e)', 'Dossier/Chrono'],
  prise_service: ['Hiérarchie', 'Intéressé(e)', 'Dossier/Chrono'],
  rappel_ordre: ['Intéressé(e)', 'Dossier administratif', 'Archives'],
  observation: ['Intéressé(e)', 'Délégation départementale', 'Dossier administratif', 'Archives'],
  demande_explication: ['Intéressé(e)', 'Dossier administratif', 'Archives']
};

/* ---------- Données administratives de l'agent (colonnes ajoutées aux bases existantes) ---------- */
export const GRADES = ['PLEG', 'PCEG', 'PLET', 'PCET', 'PEPS', 'PAEPS', 'IEG', 'Contractuel(le) d\'enseignement', 'Vacataire', 'Maître des parents'];
export const STATUTS = ['Fonctionnaire', 'Contractuel(le)', 'Vacataire', 'Agent temporaire'];

/* ---------- Dates ---------- */
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const frDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
export const longDate = (iso) => (iso ? `${+iso.slice(8, 10) === 1 ? '1er' : +iso.slice(8, 10)} ${MOIS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '');
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay() || 7; // 1 = lundi … 7 = dimanche

/* ---------- Jours non ouvrés (fêtes légales à date fixe pré-remplies chaque année) ---------- */
const FIXED_HOLIDAYS = [['12-25', 'Noël'], ['01-01', 'Nouvel An'], ['02-11', 'Fête de la Jeunesse'], ['05-01', 'Fête du Travail'],
  ['05-20', 'Fête nationale'], ['08-15', 'Assomption']];
export function ensureDaysOff() {
  const s = getSettings();
  if (s.feries_annee === s.annee_scolaire) return;
  const y = +s.annee_scolaire.slice(0, 4);
  const ins = db.prepare('INSERT OR IGNORE INTO days_off(date, label) VALUES(?, ?)');
  for (const [md, label] of FIXED_HOLIDAYS) ins.run(`${+md.slice(0, 2) >= 9 ? y : y + 1}-${md}`, label);
  saveSettings({ feries_annee: s.annee_scolaire });
}

/* ---------- Périodes de calcul ---------- */
/** 'S1'…'S6', 'T1'…'T3', 'A' (année), 'M2026-10' (mois) ou bornes libres → { code, label, from, to }. */
export function attendanceRange(q = {}) {
  const ps = db.prepare('SELECT * FROM periods ORDER BY seq').all();
  if (q.from || q.to) {
    const from = q.from || ps[0]?.start_date, to = q.to || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw Object.assign(new Error('Période invalide'), { status: 400 });
    return { code: `D${from}_${to}`, label: `Du ${frDate(from)} au ${frDate(to)}`, from, to };
  }
  const code = String(q.period || 'A').toUpperCase();
  const m = /^M(\d{4})-(\d{2})$/.exec(code);
  if (m) {
    const from = `${m[1]}-${m[2]}-01`, to = addDays(`${m[2] === '12' ? +m[1] + 1 : m[1]}-${m[2] === '12' ? '01' : String(+m[2] + 1).padStart(2, '0')}-01`, -1);
    return { code, label: `Mois de ${MOIS[+m[2] - 1]} ${m[1]}`, from, to };
  }
  const p = parsePeriod(code);
  const sel = ps.filter((x) => p.seqs.includes(x.seq));
  const from = sel[0]?.start_date, to = sel[sel.length - 1]?.end_date;
  if (!from || !to) throw Object.assign(new Error('Calendrier des séquences incomplet'), { status: 400 });
  return { code: p.code, label: p.type === 'A' ? `Année scolaire ${getSettings().annee_scolaire}` : p.label, from, to, seqs: p.seqs };
}

/** Jours de classe d'un intervalle : dans une séquence, jour de cours actif, hors jours non ouvrés. Bornés à aujourd'hui. */
export function schoolDays(from, to) {
  ensureDaysOff();
  const s = getSettings();
  const ps = db.prepare('SELECT start_date, end_date FROM periods WHERE start_date IS NOT NULL').all();
  const off = new Set(db.prepare('SELECT date FROM days_off WHERE date BETWEEN ? AND ?').all(from, to).map((x) => x.date));
  const end = to < todayIso() ? to : todayIso();
  const out = [];
  for (let d = from; d <= end; d = addDays(d, 1)) {
    if (!s.jours_actifs.includes(weekday(d)) || off.has(d)) continue;
    if (!ps.some((p) => p.start_date <= d && d <= p.end_date)) continue;
    out.push(d);
  }
  return out;
}

/** Charge hebdomadaire d'un enseignant : nombre d'heures de cours par jour (emploi du temps, à défaut volume des attributions). */
export function weeklyLoad(uid) {
  const s = getSettings();
  const rows = db.prepare(`SELECT t.day, COUNT(*) n FROM timetable t JOIN class_subjects cs ON cs.id = t.class_subject_id
    WHERE cs.teacher_id = ? GROUP BY t.day`).all(uid);
  if (rows.length) return { source: 'emploi du temps', byDay: Object.fromEntries(rows.map((r) => [r.day, r.n])), week: rows.reduce((a, r) => a + r.n, 0) };
  const week = db.prepare('SELECT COALESCE(SUM(hours_week), 0) h FROM class_subjects WHERE teacher_id = ?').get(uid).h;
  const per = week / Math.max(1, s.jours_actifs.length);
  return { source: 'volume horaire des attributions', byDay: Object.fromEntries(s.jours_actifs.map((d) => [d, per])), week };
}

export const assiduiteLabel = (t) => (t == null ? '—' : t >= 98 ? 'Excellente' : t >= 95 ? 'Très bonne' : t >= 90 ? 'Bonne' : t >= 80 ? 'Assez bonne' : t >= 70 ? 'Passable' : 'Insuffisante');
const r1 = (x) => Math.round(x * 10) / 10;

/** Assiduité d'un enseignant sur un intervalle : heures dues, effectuées, absences, retards, taux. */
export function attendanceSummary(uid, range, days = schoolDays(range.from, range.to)) {
  const load = weeklyLoad(uid);
  const dues = r1(days.reduce((a, d) => a + (load.byDay[weekday(d)] || 0), 0));
  const end = range.to < todayIso() ? range.to : todayIso();
  const recs = db.prepare('SELECT * FROM staff_attendance WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, slot').all(uid, range.from, end);
  const abs = recs.filter((r) => r.kind === 'absence'), ret = recs.filter((r) => r.kind === 'retard');
  let absJ = r1(abs.filter((r) => r.justified).reduce((a, r) => a + r.hours, 0));
  let absNJ = r1(abs.filter((r) => !r.justified).reduce((a, r) => a + r.hours, 0));
  if (absJ + absNJ > dues && dues > 0) { const k = dues / (absJ + absNJ); absJ = r1(absJ * k); absNJ = r1(dues - absJ); }
  const faites = r1(Math.max(0, dues - absJ - absNJ));
  const taux = dues > 0 ? r1((faites / dues) * 100) : null;
  return {
    code: range.code, from: range.from, to: end, label: range.label, jours: days.length, source: load.source, hebdo: r1(load.week),
    dues, faites, abs_j: absJ, abs_nj: absNJ, jours_absence: new Set(abs.map((r) => r.date)).size,
    retards: ret.length, retard_minutes: ret.reduce((a, r) => a + r.minutes, 0),
    taux, taux_hors_justifiees: dues > 0 ? r1(((dues - absNJ) / dues) * 100) : null, appreciation: assiduiteLabel(taux), records: recs
  };
}

/** Détail par séquence d'une période (trimestre ou année). */
export function attendanceBySeq(uid, range) {
  if (!range.seqs || range.seqs.length < 2) return [];
  return db.prepare(`SELECT * FROM periods WHERE seq IN (${range.seqs.join(',')}) ORDER BY seq`).all()
    .filter((p) => p.start_date && p.start_date <= todayIso())
    .map((p) => ({ seq: p.seq, ...attendanceSummary(uid, { from: p.start_date, to: p.end_date, label: `Séquence ${p.seq}` }), records: undefined }));
}

/* ---------- Agent, numérotation, faits ---------- */
export function agentSnapshot(uid) {
  const u = db.prepare(`SELECT id, full_name, sexe, matricule, specialite, phone, email, ${HR_FIELDS.join(', ')} FROM users WHERE id = ? AND role = 'teacher'`).get(uid);
  if (!u) return null;
  u.classes = db.prepare(`SELECT DISTINCT c.name FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.teacher_id = ? ORDER BY c.name`).all(uid).map((x) => x.name);
  u.disciplines = db.prepare(`SELECT DISTINCT s.name FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.teacher_id = ? ORDER BY s.name`).all(uid).map((x) => x.name);
  return u;
}
export const civilite = (sexe, court = false) => (sexe === 'F' ? (court ? 'Mme' : 'Madame') : sexe === 'M' ? (court ? 'M.' : 'Monsieur') : (court ? 'M./Mme' : 'Madame, Monsieur'));
export const accord = (sexe, m, f) => (sexe === 'F' ? f : sexe === 'M' ? m : `${m}(e)`);
export const fonctionOf = (a) => a.fonction || `Enseignant${a.sexe === 'F' ? 'e' : a.sexe === 'M' ? '' : '(e)'}${a.specialite ? ' de ' + a.specialite : ''}`;
/** « Le Proviseur » → « Proviseur ». */
export const chefFonction = (s) => String(s.chef_titre || 'Le Chef d\'établissement').replace(/^(Le|La|L')\s*/i, '').trim();

export function nextReference(type, annee) {
  const s = getSettings();
  const num = (db.prepare('SELECT MAX(num) n FROM staff_documents WHERE type = ? AND annee = ?').get(type, annee).n || 0) + 1;
  // ex. N° 004/26-27/APEP/MINESEC/DRES-CE/DDES-MFDI/LPEY (le millésime évite les doublons d'une année à l'autre)
  const suffixe = s.ref_documents || `MINESEC/${s.nom_court || 'ETAB'}`;
  const mil = `${String(annee).slice(2, 4)}-${String(annee).slice(7, 9)}`;
  return { num, reference: `N° ${String(num).padStart(3, '0')}/${mil}/${DOC_TYPES[type].code}/${suffixe}` };
}

/** Faits constatés proposés pour un rappel à l'ordre, une lettre d'observation ou une demande d'explication. */
export function suggestFacts(uid, range) {
  const out = [];
  const sum = attendanceSummary(uid, range);
  const absNJ = sum.records.filter((r) => r.kind === 'absence' && !r.justified);
  if (absNJ.length) {
    const dates = [...new Set(absNJ.map((r) => frDate(r.date)))];
    out.push({ cat: 'Assiduité', text: `Absences non justifiées : ${String(sum.abs_nj).replace('.', ',')} heure(s) de cours non dispensée(s) (${dates.length > 6 ? dates.slice(0, 6).join(', ') + '…' : dates.join(', ')}), période : ${range.label.toLowerCase()}.` });
  }
  const ret = sum.records.filter((r) => r.kind === 'retard');
  if (ret.length) out.push({ cat: 'Ponctualité', text: `Retards répétés : ${ret.length} retard(s) cumulant ${sum.retard_minutes} minutes (${[...new Set(ret.map((r) => frDate(r.date)))].slice(0, 6).join(', ')}).` });
  // notes non saisies ou non validées pour les séquences échues
  const today = todayIso();
  const ended = db.prepare('SELECT seq FROM periods WHERE end_date < ? AND start_date >= ? AND end_date <= ? ORDER BY seq').all(today, range.from, range.to > today ? today : range.to)
    .map((x) => x.seq);
  for (const seq of ended) {
    const late = db.prepare(`SELECT c.name classe, s.name subject,
        (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id AND st.active = 1) eff,
        (SELECT COUNT(*) FROM notes n JOIN students st ON st.id = n.student_id AND st.active = 1 WHERE n.class_subject_id = cs.id AND n.seq = ? AND (n.value IS NOT NULL OR n.absent = 1)) saisies,
        (SELECT 1 FROM note_validations v WHERE v.class_subject_id = cs.id AND v.seq = ?) valide
      FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id WHERE cs.teacher_id = ?`).all(seq, seq, uid)
      .filter((x) => x.eff > 0 && (x.saisies < x.eff || !x.valide));
    if (late.length) out.push({ cat: 'Évaluations', text: `Notes de la séquence ${seq} non saisies ou non validées dans les délais : ${late.map((x) => `${x.classe} (${x.subject})`).join(', ')}.` });
  }
  // progression en retard
  const prog = db.prepare(`SELECT c.name classe, s.name subject, COALESCE(SUM(p.planned),0) planned, COALESCE(SUM(p.done),0) done
    FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id
    LEFT JOIN progressions p ON p.class_subject_id = cs.id AND p.seq IN (SELECT seq FROM periods WHERE start_date <= ?)
    WHERE cs.teacher_id = ? GROUP BY cs.id`).all(today, uid).filter((x) => x.planned > 0 && x.done / x.planned < 0.7);
  if (prog.length) out.push({ cat: 'Progression', text: `Retard dans l'exécution de la progression annuelle : ${prog.map((x) => `${x.classe} ${x.subject} — ${x.done} leçon(s) sur ${x.planned} prévue(s) (${Math.round((x.done / x.planned) * 100)} %)`).join(' ; ')}.` });
  return { summary: { ...sum, records: undefined }, facts: out };
}
