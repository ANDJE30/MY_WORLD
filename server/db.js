// Couche d'accès aux données — SQLite natif (node:sqlite), une base par établissement.
// `db` désigne toujours la base de l'établissement de la requête en cours (voir context.js).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { currentDb, withDb } from './context.js';

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });

/** Base courante : proxy vers la base de l'établissement (ou de la plateforme) de la requête. */
export const db = new Proxy({}, {
  get(_t, prop) { const d = currentDb(); const v = d[prop]; return typeof v === 'function' ? v.bind(d) : v; }
});

export function openSqlite(file) {
  const h = new DatabaseSync(file);
  h.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return h;
}

export const TENANT_SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','discipline')),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  sexe TEXT, phone TEXT, email TEXT, matricule TEXT, specialite TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  must_change INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  last_login INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  ip TEXT, ua TEXT
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  level TEXT, serie TEXT, cycle TEXT, room TEXT,
  titulaire_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Référentiels des matières : groupe (regroupement sur le bulletin) et type (littéraire, scientifique…)
CREATE TABLE IF NOT EXISTS subject_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  ordre INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS subject_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  code TEXT,
  group_id INTEGER REFERENCES subject_groups(id),
  type_id INTEGER REFERENCES subject_types(id)
);

-- Attribution : une matière d'une classe, son coefficient et son enseignant
CREATE TABLE IF NOT EXISTS class_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  coef REAL NOT NULL DEFAULT 1 CHECK (coef > 0),
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  hours_week REAL NOT NULL DEFAULT 2,
  UNIQUE (class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nom TEXT NOT NULL, prenom TEXT NOT NULL DEFAULT '',
  sexe TEXT CHECK (sexe IN ('M','F')),
  date_naissance TEXT, lieu_naissance TEXT,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  redoublant INTEGER NOT NULL DEFAULT 0,
  parent_nom TEXT, parent_tel TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

CREATE TABLE IF NOT EXISTS officer_classes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, class_id)
);

-- Calendrier : 6 séquences ; les trimestres regroupent (1,2) (3,4) (5,6)
CREATE TABLE IF NOT EXISTS periods (
  seq INTEGER PRIMARY KEY CHECK (seq BETWEEN 1 AND 6),
  start_date TEXT, end_date TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at INTEGER, closed_by TEXT, forced INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_subject_id INTEGER NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq BETWEEN 1 AND 6),
  value REAL CHECK (value IS NULL OR (value >= 0 AND value <= 20)),
  absent INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER, updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, class_subject_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_notes_cs ON notes(class_subject_id, seq);

CREATE TABLE IF NOT EXISTS note_validations (
  class_subject_id INTEGER NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL, validated_at INTEGER NOT NULL, validated_by INTEGER,
  PRIMARY KEY (class_subject_id, seq)
);

CREATE TABLE IF NOT EXISTS progressions (
  class_subject_id INTEGER NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq BETWEEN 1 AND 6),
  planned INTEGER NOT NULL DEFAULT 0 CHECK (planned >= 0),
  done INTEGER NOT NULL DEFAULT 0 CHECK (done >= 0),
  comment TEXT, updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (class_subject_id, seq)
);

-- Synthèse disciplinaire par élève et par séquence
CREATE TABLE IF NOT EXISTS discipline_records (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq BETWEEN 1 AND 6),
  abs_j REAL NOT NULL DEFAULT 0, abs_nj REAL NOT NULL DEFAULT 0,
  retards INTEGER NOT NULL DEFAULT 0, consignes REAL NOT NULL DEFAULT 0,
  avertissement INTEGER NOT NULL DEFAULT 0, blame INTEGER NOT NULL DEFAULT 0,
  exclusion_jours INTEGER NOT NULL DEFAULT 0,
  observation TEXT, officer_id INTEGER, updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, seq)
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq BETWEEN 1 AND 6),
  date TEXT NOT NULL, type TEXT NOT NULL, gravite TEXT NOT NULL DEFAULT 'mineure',
  sanction TEXT, description TEXT, officer_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_incidents_student ON incidents(student_id, seq);

CREATE TABLE IF NOT EXISTS discipline_validations (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL, validated_at INTEGER NOT NULL, validated_by INTEGER,
  PRIMARY KEY (class_id, seq)
);

CREATE TABLE IF NOT EXISTS timetable (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 7),
  slot INTEGER NOT NULL CHECK (slot >= 0),
  class_subject_id INTEGER NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  room TEXT,
  PRIMARY KEY (class_id, day, slot)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','teacher','discipline')),
  author TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL DEFAULT (unixepoch()),
  user_id INTEGER, username TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT
);

-- Dossier administratif des enseignants : jours non ouvrés, assiduité et documents administratifs
CREATE TABLE IF NOT EXISTS days_off (date TEXT PRIMARY KEY, label TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('absence','retard')),
  hours REAL NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 16),
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0 AND minutes <= 600),
  slot INTEGER, class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  justified INTEGER NOT NULL DEFAULT 0, motif TEXT,
  recorded_by INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_staff_att_user ON staff_attendance(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_att_slot ON staff_attendance(user_id, date, slot) WHERE slot IS NOT NULL;

CREATE TABLE IF NOT EXISTS staff_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('presence','prise_service','rappel_ordre','observation','demande_explication')),
  annee TEXT NOT NULL, num INTEGER NOT NULL, reference TEXT NOT NULL,
  date_doc TEXT NOT NULL, objet TEXT, faits TEXT, ampliations TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  ref_doc_id INTEGER REFERENCES staff_documents(id) ON DELETE SET NULL,
  delai_heures INTEGER, echeance INTEGER,
  status TEXT NOT NULL DEFAULT 'emis' CHECK (status IN ('emis','repondu','clos','annule')),
  ack_at INTEGER, reponse TEXT, reponse_at INTEGER, suite TEXT, suite_at INTEGER,
  created_by INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (type, annee, num)
);
CREATE INDEX IF NOT EXISTS idx_staff_docs_user ON staff_documents(user_id, status);

CREATE TABLE IF NOT EXISTS year_archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annee TEXT NOT NULL UNIQUE, closed_at INTEGER NOT NULL, closed_by TEXT,
  stats_json TEXT, report_file TEXT, backup_file TEXT
);
`;

/** Exécute fn dans une transaction (rollback si exception). Réentrant, compteur propre à chaque base. */
const txDepths = new WeakMap();
export function tx(fn) {
  const h = currentDb();
  const depth = txDepths.get(h) || 0;
  const sp = `sp${depth}`;
  h.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
  txDepths.set(h, depth + 1);
  try {
    const r = fn();
    txDepths.set(h, depth);
    h.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return r;
  } catch (e) {
    txDepths.set(h, depth);
    h.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw e;
  }
}

export const DEFAULT_SETTINGS = {
  nom: 'Mon Établissement', nom_court: '', type: "Lycée d'enseignement général",
  statut: 'Public', sous_systeme: 'Francophone',
  ministere: 'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES',
  ministere_en: 'MINISTRY OF SECONDARY EDUCATION',
  delegation_regionale: '', delegation_departementale: '',
  region: '', departement: '', ville: '', bp: '', tel: '', email: '', site: '',
  immatriculation: '', arrete_creation: '', devise: 'Discipline – Travail – Réussite',
  chef_titre: 'Le Proviseur', chef_nom: '', censeur_titre: 'Censeur', censeur_nom: '', sg_titre: 'Surveillant Général', surveillant_general: '',
  ap_titre: 'Animateur Pédagogique',
  annee_scolaire: '', annee_cloturee: '', feries_annee: '', ref_documents: '', note_max: 20, seuil_reussite: 10, strict_calendar: true,
  logo: '',
  jours_actifs: [1, 2, 3, 4, 5],
  time_slots: [
    { start: '07:30', end: '08:20', break: false }, { start: '08:20', end: '09:10', break: false },
    { start: '09:10', end: '09:30', break: true, label: 'Récréation' },
    { start: '09:30', end: '10:20', break: false }, { start: '10:20', end: '11:10', break: false },
    { start: '11:10', end: '12:00', break: false }, { start: '12:00', end: '12:50', break: false },
    { start: '12:50', end: '13:30', break: true, label: 'Pause déjeuner' },
    { start: '13:30', end: '14:20', break: false }, { start: '14:20', end: '15:10', break: false }
  ]
};

/* ---------- Appellations des fonctions (paramétrables par l'établissement) ---------- */
export const FONCTIONS = {
  chef_titre: { label: "Chef d'établissement", options: ['Le Proviseur', 'Le Directeur', 'Le Principal'], nom: 'chef_nom' },
  censeur_titre: { label: "Adjoint du chef d'établissement", options: ['Censeur', 'Préfet', 'Préfet Adjoint'], nom: 'censeur_nom' },
  sg_titre: { label: 'Vie scolaire', options: ['Surveillant Général', 'Surveillant Général Adjoint'], nom: 'surveillant_general' },
  ap_titre: { label: 'Animation pédagogique', options: ['Animateur Pédagogique', 'Coordonnateur'] }
};
/** « Censeur » → « Le Censeur » ; « Animateur Pédagogique » → « L'Animateur Pédagogique » (un titre déjà précédé d'un article est conservé). */
export const withArticle = (t) => (/^(le |la |les |l'|l’|the )/i.test(t) ? t : /^[aeiouyéèêâîôh]/i.test(t) ? `L'${t}` : `Le ${t}`);
/** Appellations avec article et noms des titulaires, pour les signatures et les courriers. */
export function titres(s = getSettings()) {
  return {
    chef: s.chef_titre || "Le Chef d'établissement", chefNom: s.chef_nom || '',
    adjoint: withArticle(s.censeur_titre || 'Censeur'), adjointNom: s.censeur_nom || '',
    sg: withArticle(s.sg_titre || 'Surveillant Général'), sgNom: s.surveillant_general || '',
    ap: withArticle(s.ap_titre || 'Animateur Pédagogique')
  };
}

export function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  const getS = db.prepare('SELECT value FROM settings WHERE key = ?');
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const r = getS.get(k);
    if (r) { try { out[k] = JSON.parse(r.value); } catch { /* valeur par défaut */ } }
  }
  if (!out.annee_scolaire) {
    const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
    out.annee_scolaire = `${y}-${y + 1}`;
  }
  return out;
}
export function saveSettings(obj) {
  const setS = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  tx(() => { for (const [k, v] of Object.entries(obj)) if (k in DEFAULT_SETTINGS) setS.run(k, JSON.stringify(v)); });
}

// Périodes : initialise les 6 séquences si absentes
/** Calendrier type d'une année scolaire camerounaise (6 séquences). */
export function periodPlan(startYear) {
  const y = Number(startYear);
  return [[`${y}-09-02`, `${y}-10-18`], [`${y}-10-21`, `${y}-12-06`], [`${y + 1}-01-06`, `${y + 1}-02-14`],
    [`${y + 1}-02-17`, `${y + 1}-03-28`], [`${y + 1}-03-31`, `${y + 1}-05-09`], [`${y + 1}-05-12`, `${y + 1}-06-13`]];
}
export function ensurePeriods(startYear) {
  const n = db.prepare('SELECT COUNT(*) c FROM periods').get().c;
  if (n >= 6) return;
  const d = new Date(); const y = startYear || (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1);
  const ins = db.prepare('INSERT OR IGNORE INTO periods(seq,start_date,end_date) VALUES(?,?,?)');
  periodPlan(y).forEach((p, i) => ins.run(i + 1, p[0], p[1]));
}

/* ---------- Groupes et types de matières ---------- */
export const DEFAULT_GROUPS = [['Groupe 1', 1], ['Groupe 2', 2], ['Groupe 3', 3]];
export const DEFAULT_TYPES = ['Matière littéraire', 'Matière scientifique', 'Autre matière'];

/** Correspondance de l'ancien champ « groupe » (1 à 3, qui mêlait groupe et type) vers le nouveau modèle. */
export function legacyTaxonomy(groupe) {
  const g = Number(groupe) || 1;
  const grp = db.prepare('SELECT id FROM subject_groups WHERE ordre = ? ORDER BY id LIMIT 1').get(g)
    || db.prepare('SELECT id FROM subject_groups ORDER BY ordre, id LIMIT 1').get();
  const typeName = DEFAULT_TYPES[Math.min(Math.max(g, 1), 3) - 1];
  const typ = db.prepare('SELECT id FROM subject_types WHERE name = ?').get(typeName)
    || db.prepare('SELECT id FROM subject_types ORDER BY id LIMIT 1').get();
  return { group_id: grp?.id ?? null, type_id: typ?.id ?? null };
}

/**
 * Garantit l'existence des référentiels et migre les anciennes bases (colonne « groupe »).
 * Idempotent : appelé au démarrage et après chaque restauration de sauvegarde.
 */
export function ensureTaxonomy() {
  tx(() => {
    if (!db.prepare('SELECT 1 FROM subject_groups').get()) {
      const ins = db.prepare('INSERT INTO subject_groups(name, ordre) VALUES(?, ?)');
      DEFAULT_GROUPS.forEach(([n, o]) => ins.run(n, o));
    }
    if (!db.prepare('SELECT 1 FROM subject_types').get()) {
      const ins = db.prepare('INSERT INTO subject_types(name) VALUES(?)');
      DEFAULT_TYPES.forEach((n) => ins.run(n));
    }
    const cols = db.prepare('PRAGMA table_info(subjects)').all().map((c) => c.name);
    if (!cols.includes('group_id')) db.exec('ALTER TABLE subjects ADD COLUMN group_id INTEGER REFERENCES subject_groups(id)');
    if (!cols.includes('type_id')) db.exec('ALTER TABLE subjects ADD COLUMN type_id INTEGER REFERENCES subject_types(id)');
    const orphans = db.prepare(`SELECT id${cols.includes('groupe') ? ', groupe' : ''} FROM subjects WHERE group_id IS NULL OR type_id IS NULL`).all();
    const upd = db.prepare('UPDATE subjects SET group_id = COALESCE(group_id, ?), type_id = COALESCE(type_id, ?) WHERE id = ?');
    for (const o of orphans) { const t = legacyTaxonomy(o.groupe); upd.run(t.group_id, t.type_id, o.id); }
  });
  // l'ancienne colonne n'est plus utilisée : on la retire (SQLite ≥ 3.35)
  const cols = db.prepare('PRAGMA table_info(subjects)').all().map((c) => c.name);
  if (cols.includes('groupe')) { try { db.exec('ALTER TABLE subjects DROP COLUMN groupe'); } catch { /* colonne conservée, sans effet */ } }
}

/** Colonnes du coffre des accès (mots de passe générés chiffrés) — ajoutées aux bases existantes. */
function ensureVaultColumns() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('pw_enc')) db.exec('ALTER TABLE users ADD COLUMN pw_enc TEXT');
  if (!cols.includes('pw_set_at')) db.exec('ALTER TABLE users ADD COLUMN pw_set_at INTEGER');
  if (!cols.includes('pw_user_changed_at')) db.exec('ALTER TABLE users ADD COLUMN pw_user_changed_at INTEGER');
}

/** Données administratives des enseignants (grade, statut, prise de service…) — ajoutées aux bases existantes. */
export const HR_FIELDS = ['grade', 'statut_agent', 'fonction', 'diplome', 'date_naissance', 'lieu_naissance', 'date_prise_service', 'acte_affectation'];
function ensureStaffColumns() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  for (const f of HR_FIELDS) if (!cols.includes(f)) db.exec(`ALTER TABLE users ADD COLUMN ${f} TEXT`);
}

/** Ouvre (ou crée) la base d'un établissement et applique schéma et migrations. */
export function openTenantDb(file) {
  const h = openSqlite(file);
  h.exec(TENANT_SCHEMA);
  withDb(h, () => { ensurePeriods(); ensureTaxonomy(); ensureVaultColumns(); ensureStaffColumns(); });
  return h;
}

export function audit(req, action, detail = '') {
  try {
    db.prepare('INSERT INTO audit_log(user_id,username,action,detail,ip) VALUES(?,?,?,?,?)')
      .run(req?.user?.id ?? null, req?.user?.username ?? null, action, String(detail).slice(0, 500), req?.ip ?? null);
  } catch { /* l'audit ne doit jamais casser une requête */ }
}
