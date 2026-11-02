'use strict';
/* =====================================================================
   AI721_ASTRA_LUZ_2.0 — noyau : constantes, utilitaires, stockage, état
   ===================================================================== */
const APP = { name: 'AI721_ASTRA_LUZ_2.0', short: 'ASTRA LUZ', version: '2.0.0', build: '2026-11' };

const LEVELS = [
  { id: '2nde', code: 1, nom: 'Seconde', pref: 'Préfecture de Seconde', roman: '2nde' },
  { id: '1ere', code: 2, nom: 'Première', pref: 'Préfecture de Première', roman: '1re' },
  { id: 'tle', code: 3, nom: 'Terminale', pref: 'Préfecture de Terminale', roman: 'Tle' }
];
const levelById = id => LEVELS.find(l => l.id === id);
const levelByCode = c => LEVELS.find(l => l.code === +c);

const POLES = {
  EG_GROUPE: 'Enseignement général · groupe',
  EG_LIT: 'Enseignement général · solo littéraire',
  EG_SCI: 'Enseignement général · solo scientifique',
  ET: 'Enseignement technique · solo'
};

const DEFAULT_CLASSES = [
  ['2nde', 'EG_GROUPE', ['2C1', '2C2', '2C3', '2C4', '2C5', '2C6']],
  ['2nde', 'EG_LIT', ['2A']],
  ['2nde', 'EG_SCI', ['2TI']],
  ['2nde', 'ET', ['2SES1', '2SES2']],
  ['1ere', 'EG_GROUPE', ['PC1', 'PC2', 'PCE', 'PD1', 'PD2', 'PD3', 'PDE']],
  ['1ere', 'EG_LIT', ['PA']],
  ['1ere', 'EG_SCI', ['PTI']],
  ['1ere', 'ET', ['PSES']],
  ['tle', 'EG_GROUPE', ['TC', 'TCE', 'TD1', 'TD2', 'TD3', 'TDE']],
  ['tle', 'EG_LIT', ['TA']],
  ['tle', 'EG_SCI', ['TTI']],
  ['tle', 'ET', ['TSES']]
];

/* Catalogue de matières proposé : codes à deux chiffres repris dans le code-barres. À valider par les préfets. */
const DEFAULT_SUBJECTS = [
  ['01', 'FRAN', 'Français'], ['02', 'ANG', 'Anglais'], ['03', 'MATH', 'Mathématiques'],
  ['04', 'PHY', 'Physique'], ['05', 'CHIM', 'Chimie'], ['06', 'SVT', 'SVTEEHB'],
  ['07', 'HIST', 'Histoire'], ['08', 'GEO', 'Géographie'], ['09', 'ECM', 'Éducation à la citoyenneté et à la morale'],
  ['10', 'PHILO', 'Philosophie'], ['11', 'INFO', 'Informatique'], ['12', 'EPS', 'Éducation physique et sportive'],
  ['13', 'LV2', 'Langue vivante II (espagnol / allemand)'], ['14', 'LCN', 'Langues et cultures nationales'],
  ['15', 'LIT', 'Littérature'], ['16', 'TECH', 'Technologie / sciences de l’ingénieur'],
  ['17', 'ALGO', 'Algorithmique et programmation'], ['18', 'RSI', 'Réseaux et systèmes informatiques'],
  ['19', 'ECO', 'Sciences économiques'], ['20', 'SOC', 'Sociologie'], ['21', 'COMPTA', 'Comptabilité et gestion']
].map(([code, abbr, nom]) => ({ code, abbr, nom }));

function defaultSubjectsFor(levelId, pole, name) {
  const s = ['01', '02', '03', '07', '08', '09', '11', '12'];
  const add = (...c) => c.forEach(x => { if (!s.includes(x)) s.push(x); });
  if (levelId !== '2nde') add('10');
  if (pole === 'EG_GROUPE') { add('04', '05'); if (/D/.test(name) || levelId === '2nde') add('06'); if (/E$|CE$/.test(name)) add('16'); }
  if (pole === 'EG_LIT') add('13', '14', '15', '06');
  if (pole === 'EG_SCI') add('04', '05', '17', '18');
  if (pole === 'ET') add('19', '20', '21');
  if (levelId === '2nde' && pole === 'EG_GROUPE') add('13');
  return s.sort().map(code => ({ m: code, prof: '', coef: defaultCoef(code, pole, name) }));
}
function defaultCoef(code, pole, name) {
  if (pole === 'EG_GROUPE') { if (code === '03') return /C/.test(name) ? 5 : 4; if (['04', '05'].includes(code)) return /C/.test(name) ? 3 : 2; if (code === '06') return /D/.test(name) ? 4 : 2; }
  if (pole === 'EG_LIT') { if (['01', '10', '15'].includes(code)) return 4; }
  if (pole === 'EG_SCI' && ['17', '18', '03'].includes(code)) return 4;
  if (pole === 'ET' && ['19', '21'].includes(code)) return 4;
  if (code === '12' || code === '09') return 1;
  return 2;
}

const DEFAULT_LOGO = 'data:image/jpeg;base64,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JbSxv5rq0bknex44IHYmvWKrE1L2jF6JCgt2wrwf48xBdc0iboWgdfybP9a94ryT4y+GtX8QXGknSrCa6MayB/LAwuSuMk/SpwskqqbdkOorrQ9P0pxJo9k4/igjP5qK8e+PF6ZLvRtMjyWw0xUdySAP5GrNivxcNrbWscNva28SrGufLB2gAc5JOcCtvX/hze+JvG1vrV3fRRWlusQWEKWZtpyQegGST61pTUaVTmk00S25KyR5v4i8K+NdT04a7qWnRW6WMCoqRYDhFxg4BJOBzyc16D4J8Qw/ELwXd6HqRDXqQmKUsPvgjCuPcHGfce9emPGkkZR1DKwwQRkEehqCx0yx06Py7Kzgtk9Iowo/SonieeNmtVtYahZ6M8d8OfBe9aMJr+ouloHLizt3J3HpknoPwBNeuaPo1hoVgljp1slvbp0VR1Pck9Sfc1pUVnUrTqfEylFLYKKKKyKCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9k=';
const DEFAULT_SETTINGS = {
  etab: 'Collège François-Xavier Vogt',
  sigle: 'CFX VOGT',
  tutelle: 'Secrétariat à l’Éducation de l’Archidiocèse de Yaoundé',
  ville: 'Yaoundé',
  annee: '2026-2027',
  coordo: 'M. ANDJE IBOT Georges',
  coordoTitre: 'Coordonnateur d’informatique du second cycle',
  prefets: { '2nde': '', '1ere': '', 'tle': '' },
  enteteFR: 'RÉPUBLIQUE DU CAMEROUN\nPaix – Travail – Patrie\nMINISTÈRE DES ENSEIGNEMENTS SECONDAIRES\nSECRÉTARIAT À L’ÉDUCATION DE L’ARCHIDIOCÈSE DE YAOUNDÉ\nCOLLÈGE FRANÇOIS-XAVIER VOGT',
  enteteEN: 'REPUBLIC OF CAMEROON\nPeace – Work – Fatherland\nMINISTRY OF SECONDARY EDUCATION\nEDUCATION SECRETARIAT OF THE ARCHDIOCESE OF YAOUNDÉ\nFRANÇOIS-XAVIER VOGT COLLEGE',
  logo: '', pdfStyle: 'etablissement', departement: 'Secrétariat des évaluations',
  trimCourant: 1, sitCourante: 1,
  seuilReussite: 10, delaiSaisie: 7, tailleLot: 25, ecartDouble: 3,
  sitDates: {}
};

/* ---------------- Utilitaires ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n, l) => String(n).padStart(l, '0');
const uid = (p = '') => p + Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`; };
const isoToDate = iso => new Date(iso + 'T12:00:00');
const addDays = (iso, n) => { const d = isoToDate(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`; };
const fmtDate = (iso, opt = 'long') => { if (!iso) return '—'; const d = isoToDate(iso); if (opt === 'short') return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); if (opt === 'dm') return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
const fmtTime = t => t ? t.replace(':', ' h ') : '';
const fmtDT = ts => ts ? new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const minutes = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const duree = (a, b) => { const d = minutes(b) - minutes(a); if (d <= 0) return '—'; const h = Math.floor(d / 60), m = d % 60; return h ? `${h} h${m ? ' ' + pad(m, 2) : ''}` : `${m} min`; };
const fmtNote = n => (n === null || n === undefined || n === '' || isNaN(n)) ? '' : (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const upperName = s => String(s || '').trim().toUpperCase();
const capName = s => String(s || '').trim().toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const fullName = st => `${upperName(st.nom)} ${capName(st.prenom)}`.trim();
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function deepMerge(a, b) {
  const out = (a && typeof a === 'object' && !Array.isArray(a)) ? { ...a } : {};
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}
async function sha256(txt) {
  try { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 0; for (const c of txt) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h; }
}
function seededRandom(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const lsGet = (k, d) => { try { const v = localStorage.getItem('astraluz:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('astraluz:' + k, JSON.stringify(v)); } catch (e) { } };

/* ---------------- Stockage : base partagée (claude.ai) ou locale (IndexedDB) ---------------- */
class LocalStore {
  constructor(ns) { this.ns = ns; this.kind = ns === 'demo' ? 'demo' : 'local'; this.mem = new Map(); this.idb = null; }
  async open() {
    try {
      this.idb = await new Promise((res, rej) => {
        const r = indexedDB.open('astraluz-' + this.ns, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      const all = await new Promise((res, rej) => {
        const out = new Map(); const tx = this.idb.transaction('kv', 'readonly'); const st = tx.objectStore('kv');
        const req = st.openCursor(); req.onsuccess = () => { const c = req.result; if (c) { out.set(c.key, c.value); c.continue(); } else res(out); }; req.onerror = () => rej(req.error);
      });
      this.mem = all;
    } catch (e) { this.idb = null; this.volatile = true; }
    return this;
  }
  _persist(path, val) {
    if (!this.idb) return;
    try { const tx = this.idb.transaction('kv', 'readwrite'); const st = tx.objectStore('kv'); val === undefined ? st.delete(path) : st.put(val, path); } catch (e) { }
  }
  async get(path) { const v = this.mem.get(path); return v === undefined ? null : clone(v); }
  async set(path, data) { this.mem.set(path, clone(data)); this._persist(path, clone(data)); }
  async update(path, partial) { const cur = this.mem.get(path) || {}; const v = deepMerge(cur, partial); this.mem.set(path, v); this._persist(path, clone(v)); }
  async delete(path) { this.mem.delete(path); this._persist(path, undefined); }
  async list(col) { const out = []; const pre = col + '/'; for (const [k, v] of this.mem) { if (k.startsWith(pre) && !k.slice(pre.length).includes('/')) out.push({ id: k.slice(pre.length), data: clone(v) }); } return out; }
  subscribe() { return () => { }; }
  async setMany(entries) { for (const [p, d] of entries) await this.set(p, d); }
  async wipe() { for (const k of [...this.mem.keys()]) await this.delete(k); }
}
class SharedStore {
  constructor(db) { this.db = db; this.kind = 'shared'; this.exists = new Set(); }
  async _retry(fn) { try { return await fn(); } catch (e) { if (e && e.code === 'unavailable') { await sleep(400 + Math.random() * 600); return fn(); } throw e; } }
  async get(path) { const s = await this._retry(() => this.db.doc(path).get()); if (s.exists) { this.exists.add(path); return clone(s.data()); } return null; }
  async set(path, data) { await this._retry(() => this.db.doc(path).set(clone(data))); this.exists.add(path); }
  async update(path, partial) {
    if (!this.exists.has(path)) { const cur = await this.get(path); if (!cur) return this.set(path, deepMerge({}, partial)); }
    try { await this._retry(() => this.db.doc(path).update(clone(partial))); }
    catch (e) { if (e && e.code === 'invalid_argument') { const cur = await this.get(path); await this.set(path, deepMerge(cur || {}, partial)); } else throw e; }
  }
  async delete(path) { await this._retry(() => this.db.doc(path).delete()); this.exists.delete(path); }
  async list(col) { const q = await this._retry(() => this.db.collection(col).get()); return q.docs.map(d => { this.exists.add(col + '/' + d.id); return { id: d.id, data: clone(d.data()) }; }); }
  async setMany(entries) { for (const [p, d] of entries) await this.set(p, d); }
  subscribe(col, cb) {
    try { return this.db.collection(col).onSnapshot(snap => { if (snap.metadata && snap.metadata.hasPendingWrites) return; cb(snap.docs.map(d => ({ id: d.id, data: d.data() }))); }, () => { }); }
    catch (e) { return () => { }; }
  }
}

/* ---------------- État global ---------------- */
const S = {
  store: null, mode: 'local', ready: false,
  settings: { ...clone(DEFAULT_SETTINGS), logo: DEFAULT_LOGO }, subjects: [], teachers: [], rooms: [], classes: {}, evals: {}, security: {},
  caps: { downloads: null, user: null, userName: '' },
  ui: { level: lsGet('level', null), view: 'accueil', role: 'secretariat', unlocked: false, filters: {}, sel: {} }
};
const subjByCode = c => S.subjects.find(s => s.code === c) || { code: c, abbr: c, nom: 'Matière ' + c };
const teacherById = id => S.teachers.find(t => t.id === id);
const teacherName = id => { const t = teacherById(id); return t ? `${t.civ ? t.civ + ' ' : ''}${upperName(t.nom)} ${capName(t.prenom || '')}`.trim() : ''; };
const classesOf = levelId => Object.values(S.classes).filter(c => c.level === levelId).sort((a, b) => a.rang - b.rang);
const evalsOf = levelId => Object.values(S.evals).filter(e => e.level === levelId);
const studentsOf = cls => (cls.students || []).filter(s => s.statut !== 'parti').sort((a, b) => fullName(a).localeCompare(fullName(b), 'fr'));
const findStudent = sid => { for (const c of Object.values(S.classes)) { const s = (c.students || []).find(x => x.id === sid); if (s) return { st: s, cls: c }; } return null; };
const roomById = id => S.rooms.find(r => r.id === id);

const STATUS = {
  planifiee: { l: 'Planifiée', c: 'info', step: 1 },
  preparee: { l: 'Codes générés', c: 'accent', step: 2 },
  composee: { l: 'Composée', c: 'warn', step: 3 },
  saisie: { l: 'Saisie en cours', c: 'warn', step: 3 },
  desanonymisee: { l: 'Désanonymisée', c: 'ok', step: 4 },
  cloturee: { l: 'Clôturée', c: 'ok', step: 5 }
};
const statusPill = st => { const s = STATUS[st] || STATUS.planifiee; return `<span class="pill ${s.c}">${s.l}</span>`; };
const trimOfSit = s => Math.ceil(s / 2);

/* ---------------- Journal d'audit ---------------- */
async function audit(action, detail = '', level = '') {
  const day = todayISO().replace(/-/g, '');
  const key = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const who = S.mode === 'cloud' ? (S.caps.userName || 'Utilisateur') : (S.ui.role === 'coordination' ? 'Coordination' : 'Secrétariat');
  try { await S.store.update('logs/' + day, { day: todayISO(), entries: { [key]: { at: Date.now(), who, uid: S.caps.userId || null, role: S.ui.role, action, detail: String(detail).slice(0, 400), level: level || S.ui.level || '' } } }); } catch (e) { }
}

/* ---------------- Chargement / initialisation ---------------- */
async function loadAll() {
  const st = S.store;
  const [settings, subjects, teachers, rooms, security, classes, evals] = await Promise.all([
    st.get('cfg/settings'), st.get('cfg/subjects'), st.get('cfg/teachers'), st.get('cfg/rooms'), st.get('cfg/security'), st.list('classes'), st.list('evals')
  ]);
  S.initialized = !!settings;
  S.settings = deepMerge(clone(DEFAULT_SETTINGS), settings || {});
  if (!S.settings.logo) S.settings.logo = DEFAULT_LOGO;
  S.subjects = (subjects && subjects.list) || (settings ? [] : clone(DEFAULT_SUBJECTS));
  S.teachers = (teachers && teachers.list) || [];
  S.rooms = (rooms && rooms.list) || [];
  S.security = security || {};
  S.classes = {}; classes.forEach(c => S.classes[c.id] = c.data);
  S.evals = {}; evals.forEach(e => S.evals[e.id] = e.data);
}
function buildDefaultClasses() {
  const out = {};
  for (const [lv, pole, names] of DEFAULT_CLASSES) {
    for (const n of names) {
      const rang = Object.values(out).filter(c => c.level === lv).length + 1;
      const id = 'c_' + n.toLowerCase();
      out[id] = { id, level: lv, nom: n, pole, rang, titulaire: '', students: [], subjects: defaultSubjectsFor(lv, pole, n) };
    }
  }
  return out;
}
async function initStructure() {
  const st = S.store;
  await st.set('cfg/settings', clone(DEFAULT_SETTINGS));
  await st.set('cfg/subjects', { list: clone(DEFAULT_SUBJECTS) });
  await st.set('cfg/teachers', { list: [] });
  await st.set('cfg/rooms', { list: [] });
  const cls = buildDefaultClasses();
  await st.setMany(Object.values(cls).map(c => ['classes/' + c.id, c]));
  await audit('Initialisation', 'Structure 2026-2027 : 29 classes, ' + DEFAULT_SUBJECTS.length + ' matières');
  await loadAll();
}
const saveSettings = () => S.store.set('cfg/settings', S.settings);
const saveSubjects = () => S.store.set('cfg/subjects', { list: S.subjects });
const saveTeachers = () => S.store.set('cfg/teachers', { list: S.teachers });
const saveRooms = () => S.store.set('cfg/rooms', { list: S.rooms });
const saveClass = c => S.store.set('classes/' + c.id, c);
const saveEval = e => { e.updatedAt = Date.now(); return S.store.set('evals/' + e.id, e); };

/* ---------------- Jeu de démonstration (données fictives) ---------------- */
const DEMO_NOMS = ['MBARGA', 'NGONO', 'ESSOMBA', 'ATANGANA', 'FOUDA', 'OWONA', 'NKODO', 'ABENA', 'BELINGA', 'ETOA', 'MANGA', 'NDZANA', 'ONANA', 'ZANGA', 'EKANI', 'MBALLA', 'NGUEMA', 'TSALA', 'AMBASSA', 'KAMGA', 'FOTSO', 'NJOYA', 'KENGNE', 'TAGNE', 'DJOMO', 'MOUNA', 'EBOGO', 'NDONGO', 'MVONDO', 'ELLA', 'NANGA', 'ABOMO', 'MEKA', 'ESSAMA', 'NOAH', 'BIWOLE', 'TCHAMENI', 'WANDJI', 'NOUMSSI', 'SIMO', 'YOUMBI', 'EYEBE', 'AYISSI', 'MESSI', 'OBAMA', 'ENOW', 'TABI', 'NKWETTA', 'EBANGA', 'MINKO'];
const DEMO_PRENOMS_F = ['Marie-Claire', 'Christelle', 'Larissa', 'Murielle', 'Sandrine', 'Danielle', 'Josiane', 'Laure', 'Carine', 'Grâce', 'Ornella', 'Merveille', 'Rosine', 'Pauline', 'Inès', 'Audrey', 'Brenda', 'Estelle', 'Flore', 'Gaëlle', 'Hélène', 'Irène', 'Joëlle', 'Kelly', 'Lydie', 'Michelle', 'Nadège', 'Prisca', 'Raïssa', 'Stéphanie'];
const DEMO_PRENOMS_M = ['Jean-Paul', 'Boris', 'Ulrich', 'Brice', 'Franck', 'Yannick', 'Hervé', 'Arnaud', 'Steve', 'Junior', 'Kévin', 'Emmanuel', 'Cédric', 'Daniel', 'Patrick', 'Aurélien', 'Bertrand', 'Christian', 'Didier', 'Éric', 'Fabrice', 'Gilles', 'Hugues', 'Ivan', 'Joël', 'Landry', 'Martial', 'Nathan', 'Olivier', 'Romaric'];
async function buildDemo() {
  const st = S.store; await st.wipe();
  const rnd = seededRandom(20262027);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const settings = clone(DEFAULT_SETTINGS);
  settings.prefets = { '2nde': 'M. EXEMPLE Préfet 2nde', '1ere': 'Mme EXEMPLE Préfète 1re', 'tle': 'M. EXEMPLE Préfet Tle' };
  settings.trimCourant = 1; settings.sitCourante = 2;
  await st.set('cfg/settings', settings);
  await st.set('cfg/subjects', { list: clone(DEFAULT_SUBJECTS) });
  const teachers = [];
  for (let i = 0; i < 46; i++) { const f = rnd() < .45; teachers.push({ id: 'p' + pad(i + 1, 3), civ: f ? 'Mme' : 'M.', nom: pick(DEMO_NOMS), prenom: pick(f ? DEMO_PRENOMS_F : DEMO_PRENOMS_M), tel: '6' + Math.floor(70000000 + rnd() * 29999999), matieres: [] }); }
  const rooms = []; const roomsByLevel = {};
  ['A', 'B', 'C'].forEach((b, bi) => { roomsByLevel[LEVELS[bi].id] = []; for (let i = 1; i <= 13; i++) { const r = { id: 'r' + b + pad(i, 2), nom: `Salle ${b}${i}`, capacite: [44, 46, 48, 50][(i + bi) % 4], batiment: 'Bâtiment ' + b }; rooms.push(r); roomsByLevel[LEVELS[bi].id].push(r.id); } });
  await st.set('cfg/rooms', { list: rooms });
  const cls = buildDefaultClasses();
  let tIdx = 0; let mat = 1;
  for (const c of Object.values(cls)) {
    const n = c.pole === 'EG_GROUPE' ? 52 + Math.floor(rnd() * 14) : 34 + Math.floor(rnd() * 14);
    for (let i = 0; i < n; i++) { const f = rnd() < .52; c.students.push({ id: 's' + pad(mat, 5), mat: '26V' + pad(mat, 4), nom: pick(DEMO_NOMS), prenom: pick(f ? DEMO_PRENOMS_F : DEMO_PRENOMS_M) + (rnd() < .3 ? ' ' + pick(f ? DEMO_PRENOMS_F : DEMO_PRENOMS_M) : ''), sexe: f ? 'F' : 'M', dn: `${2008 + ['2nde', '1ere', 'tle'].indexOf(c.level) * -1 + Math.floor(rnd() * 2)}-${pad(1 + Math.floor(rnd() * 12), 2)}-${pad(1 + Math.floor(rnd() * 28), 2)}`, statut: rnd() < .08 ? 'redoublant' : 'nouveau' }); mat++; }
    c.subjects.forEach(s => { const t = teachers[tIdx++ % teachers.length]; s.prof = t.id; if (!t.matieres.includes(s.m)) t.matieres.push(s.m); });
    c.titulaire = teachers[(tIdx * 7) % teachers.length].id;
    await st.set('classes/' + c.id, c);
  }
  await st.set('cfg/teachers', { list: teachers });
  S.settings = settings; S.subjects = clone(DEFAULT_SUBJECTS); S.teachers = teachers; S.rooms = rooms; S.classes = cls; S.evals = {};
  // Situation 1 (composée, désanonymisée) et situation 2 (en cours) pour quelques matières
  const planS1 = ['03', '01', '02', '04', '06', '07', '11', '13', '19', '17', '10'];
  const day0 = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
  const slots = [['07:30', '09:30'], ['10:00', '12:00'], ['13:00', '15:00']];
  for (const lv of LEVELS) {
    const lc = classesOf(lv.id);
    let k = 0;
    for (const m of planS1) {
      const classes = lc.filter(c => c.subjects.some(s => s.m === m)).map(c => c.id); if (!classes.length) continue;
      const slot = slots[k % 3]; const date = day0[Math.floor(k / 3) % 5]; k++;
      const e = newEval({ level: lv.id, subj: m, trim: 1, sit: 1, date, start: slot[0], end: slot[1], classes });
      autoPlace(e, 'brassage', roomsByLevel[lv.id]);
      e.status = 'desanonymisee'; e.marks = {};
      const lvlBias = (rnd() - .5) * 2;
      e.placement.list.forEach(([sid, cid, table]) => { const r = rnd(); if (r < .03) e.marks[pad(table, 3)] = { st: 'ABS', at: Date.now() }; else { let v = 10.6 + lvlBias + (cid.charCodeAt(cid.length - 1) % 5 - 2) * .6 + gaussian(rnd) * 3.4; v = Math.max(0, Math.min(20, Math.round(v * 4) / 4)); e.marks[pad(table, 3)] = { n: v, st: 'P', at: Date.now(), by: 'Démo' }; } });
      e.anon = { lifted: true, at: Date.parse(addDays(date, 9) + 'T10:00:00'), by: 'Coordination (démo)' };
      e.deadline = addDays(date, 7);
      S.evals[e.id] = e; await st.set('evals/' + e.id, e);
    }
    // Situation 2 : semaine du 9 novembre 2026
    const planS2 = [['03', '2026-11-09', 0], ['01', '2026-11-09', 1], ['02', '2026-11-10', 0], ['07', '2026-11-10', 1], ['04', '2026-11-11', 0], ['11', '2026-11-11', 1], ['06', '2026-11-12', 0], ['13', '2026-11-12', 1], ['19', '2026-11-13', 0], ['17', '2026-11-13', 1], ['10', '2026-11-13', 2]];
    for (const [m, date, si] of planS2) {
      const classes = lc.filter(c => c.subjects.some(s => s.m === m)).map(c => c.id); if (!classes.length) continue;
      const e = newEval({ level: lv.id, subj: m, trim: 1, sit: 2, date, start: slots[si][0], end: slots[si][1], classes });
      if (m === '03' || m === '01') { autoPlace(e, 'brassage', roomsByLevel[lv.id]); e.status = 'preparee'; }
      S.evals[e.id] = e; await st.set('evals/' + e.id, e);
    }
  }
  // Une épreuve composée en cours de saisie (Informatique 1re, situation 2 anticipée)
  const lv = '1ere'; const classes = classesOf(lv).filter(c => c.subjects.some(s => s.m === '18')).map(c => c.id);
  if (classes.length) {
    const e = newEval({ level: lv, subj: '18', trim: 1, sit: 2, date: '2026-10-30', start: '10:00', end: '12:00', classes });
    autoPlace(e, 'classe', roomsByLevel[lv]); e.status = 'saisie'; e.marks = {};
    e.placement.list.forEach(([sid, cid, table], i) => { if (i % 3 !== 0) e.marks[pad(table, 3)] = { n: Math.max(0, Math.min(20, Math.round((11 + gaussian(rnd) * 3) * 4) / 4)), st: 'P', at: Date.now(), by: 'Démo' }; });
    e.deadline = '2026-11-06'; S.evals[e.id] = e; await st.set('evals/' + e.id, e);
  }
  await audit('Démonstration', 'Jeu de données fictives généré');
}
function gaussian(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* =====================================================================
   Modèle : évaluations, répartition en salles, codes-barres, statistiques
   ===================================================================== */
function newEval({ level, subj, trim, sit, date, start, end, classes, bareme = 20, double = false, consignes = '' }) {
  return {
    id: uid('e'), level, subj, trim: +trim, sit: +sit, date, start, end, classes: classes.slice(),
    bareme: +bareme || 20, double: !!double, consignes, status: 'planifiee',
    placement: null, marks: {}, anon: { lifted: false },
    deadline: addDays(date, +(S.settings.delaiSaisie || 7)), createdAt: Date.now(), updatedAt: Date.now()
  };
}
const evalLabel = e => `${subjByCode(e.subj).nom} · T${e.trim} · S${e.sit}`;
const evalShort = e => `${subjByCode(e.subj).abbr} T${e.trim}S${e.sit}`;
const evalClassNames = e => e.classes.map(id => S.classes[id]?.nom || '?').join(', ');

/* ---------- Code-barres : N CC MM T S TTT KK (12 chiffres, Code 128 jeu C) ---------- */
function mod97Key(base10) { const n = Number(base10); return 98 - ((n * 100) % 97); }
function makeCode(levelCode, classRang, subj, trim, sit, table) {
  const base = `${levelCode}${pad(classRang, 2)}${pad(subj, 2)}${trim}${sit}${pad(table, 3)}`;
  return base + pad(mod97Key(base), 2);
}
function codeOf(e, cid, table) { const c = S.classes[cid]; return makeCode(levelById(e.level).code, c ? c.rang : 0, e.subj, e.trim, e.sit, table); }
const fmtCode = c => c ? `${c.slice(0, 1)} ${c.slice(1, 3)} ${c.slice(3, 5)} ${c.slice(5, 7)} ${c.slice(7, 10)} ${c.slice(10)}` : '';
/* Douchette réglée en QWERTY sur un clavier AZERTY : « &é"'(-è_çà » au lieu de « 1234567890 » */
const AZERTY_DIGITS = { '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5', '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0' };
function scanDigits(raw) { let s = String(raw || ''); if (!/\d/.test(s) && /[&é"'(è_çà]/.test(s)) s = s.replace(/[&é"'(\-è_çà]/g, c => AZERTY_DIGITS[c]); return s.replace(/\D/g, ''); }
function parseCode(raw) {
  const d = scanDigits(raw);
  if (d.length !== 12) return { ok: false, err: `Le code doit compter 12 chiffres (lu : ${d.length}).`, digits: d };
  const base = d.slice(0, 10), key = +d.slice(10);
  const ok = ((Number(base) * 100 + key) % 97) === 1;
  const r = { digits: d, N: +d[0], CC: +d.slice(1, 3), MM: d.slice(3, 5), T: +d[5], S: +d[6], TTT: +d.slice(7, 10), KK: key, ok };
  if (!ok) r.err = 'Clé de contrôle invalide : code mal lu ou mal saisi.';
  r.level = levelByCode(r.N); r.subject = subjByCode(r.MM);
  r.cls = Object.values(S.classes).find(c => r.level && c.level === r.level.id && c.rang === r.CC);
  return r;
}
function locateCode(raw, preferEval) {
  const p = parseCode(raw); if (!p.ok) return { p };
  const cands = Object.values(S.evals).filter(e => p.level && e.level === p.level.id && e.subj === p.MM && e.trim === p.T && e.sit === p.S && e.placement);
  if (preferEval) cands.sort((a, b) => (b.id === preferEval.id) - (a.id === preferEval.id));
  for (const e of cands) {
    const entry = e.placement.list.find(x => x[2] === p.TTT);
    if (entry && S.classes[entry[1]] && S.classes[entry[1]].rang === p.CC) return { p, e, entry, cls: S.classes[entry[1]] };
  }
  return { p, err: 'Aucune copie ne correspond à ce code dans les épreuves enregistrées.' };
}
const markKey = table => pad(table, 3);

/* ---------- Répartition des élèves dans les salles ---------- */
const PLACE_MODES = {
  brassage: 'Brassage alterné des classes (anti-fraude)',
  classe: 'Classe par classe, ordre alphabétique',
  alpha: 'Ordre alphabétique sur tout le niveau',
  aleatoire: 'Tirage aléatoire reproductible'
};
function candidatesOf(e) {
  const out = [];
  e.classes.map(id => S.classes[id]).filter(Boolean).sort((a, b) => a.rang - b.rang).forEach(c => studentsOf(c).forEach(s => out.push({ sid: s.id, cid: c.id, name: fullName(s) })));
  return out;
}
function autoPlace(e, mode, roomIds, opts = {}) {
  const cand = candidatesOf(e);
  let ordered;
  if (mode === 'alpha') ordered = cand.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  else if (mode === 'aleatoire') { const seed = opts.seed || Math.floor(Math.random() * 1e6); opts.seed = seed; ordered = shuffle(cand, seededRandom(seed)); }
  else if (mode === 'brassage') {
    const by = {}; cand.forEach(x => (by[x.cid] = by[x.cid] || []).push(x));
    const queues = Object.values(by); ordered = [];
    const max = Math.max(0, ...queues.map(q => q.length));
    for (let i = 0; i < max; i++) queues.forEach(q => { if (q[i]) ordered.push(q[i]); });
  } else ordered = cand;
  const rooms = roomIds.map(roomById).filter(Boolean);
  const total = ordered.length;
  const cap = rooms.reduce((a, r) => a + (+r.capacite || 0), 0);
  if (!rooms.length) throw new Error('Sélectionnez au moins une salle de composition.');
  if (cap < total) throw new Error(`Capacité insuffisante : ${cap} places pour ${total} élèves. Ajoutez des salles.`);
  if (total > 999) throw new Error('Le numéro de table est limité à 999 par épreuve.');
  const list = []; const rr = []; let t = 1; let i = 0;
  const per = opts.equilibrer ? Math.ceil(total / rooms.length) : null;
  for (const r of rooms) {
    if (i >= total) break;
    const n = Math.min(per ? Math.min(per, +r.capacite) : +r.capacite, total - i);
    const from = t;
    for (let k = 0; k < n; k++, i++, t++) { const x = ordered[i]; list.push([x.sid, x.cid, t, x.name]); }
    rr.push({ id: r.id, nom: r.nom, from, to: t - 1, surv: [] });
  }
  if (i < total) return autoPlace(e, mode, roomIds, { ...opts, equilibrer: false }); // salle trop petite pour l'équilibrage : remplissage simple
  const prevSurv = {}; (e.placement?.rooms || []).forEach(r => prevSurv[r.id] = r.surv || []);
  rr.forEach(r => r.surv = prevSurv[r.id] || []);
  e.placement = { mode, seed: opts.seed || null, at: Date.now(), by: S.caps.userName || 'Secrétariat', list, rooms: rr };
  if (e.status === 'planifiee') e.status = 'preparee';
  return e;
}
const roomOfTable = (e, table) => (e.placement?.rooms || []).find(r => table >= r.from && table <= r.to);
function autoSurveillants(e, perRoom = 2) {
  if (!e.placement) return;
  const busy = new Set(Object.values(S.evals).filter(o => o.id !== e.id && o.date === e.date && overlap(o, e) && o.placement).flatMap(o => o.placement.rooms.flatMap(r => r.surv || [])));
  const subjTeachers = new Set(e.classes.map(cid => S.classes[cid]?.subjects.find(s => s.m === e.subj)?.prof).filter(Boolean));
  const pool = S.teachers.filter(t => !busy.has(t.id) && !subjTeachers.has(t.id)).map(t => t.id);
  const rnd = seededRandom(Date.now() % 100000);
  const sh = shuffle(pool, rnd); let k = 0;
  e.placement.rooms.forEach(r => { r.surv = []; for (let j = 0; j < perRoom && k < sh.length; j++) r.surv.push(sh[k++]); });
  return sh.length >= perRoom * e.placement.rooms.length;
}
const overlap = (a, b) => a.date === b.date && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);

/* ---------- Notes ---------- */
function finalMark(m, e) {
  if (!m || m.st === 'ABS' || m.st === 'DISP' || m.st === 'FRAUDE') return null;
  if (m.n === null || m.n === undefined || m.n === '') return null;
  let v = +m.n;
  if (e && e.double) { if (m.n3 !== undefined && m.n3 !== null && m.n3 !== '') v = +m.n3; else if (m.n2 !== undefined && m.n2 !== null && m.n2 !== '') v = (+m.n + +m.n2) / 2; else return null; }
  const bar = e ? (+e.bareme || 20) : 20;
  return bar === 20 ? v : v * 20 / bar;
}
function markDone(m, e) { if (!m) return false; if (['ABS', 'DISP', 'FRAUDE'].includes(m.st)) return true; return finalMark(m, e) !== null; }
function needsArbitration(m, e) { return e.double && m && m.n !== undefined && m.n !== null && m.n !== '' && m.n2 !== undefined && m.n2 !== null && m.n2 !== '' && Math.abs(m.n - m.n2) >= (+S.settings.ecartDouble || 3) && (m.n3 === undefined || m.n3 === null || m.n3 === ''); }
function progressOf(e) {
  const total = e.placement ? e.placement.list.length : 0;
  let done = 0, abs = 0, arb = 0;
  if (e.placement) e.placement.list.forEach(([, , t]) => { const m = e.marks?.[markKey(t)]; if (markDone(m, e)) done++; if (m && m.st === 'ABS') abs++; if (needsArbitration(m, e)) arb++; });
  return { total, done, abs, arb, pct: total ? Math.round(done * 100 / total) : 0, missing: total - done };
}
function statsOf(vals) {
  const v = vals.filter(x => x !== null && !isNaN(x)).map(Number).sort((a, b) => a - b);
  const n = v.length; const seuil = +S.settings.seuilReussite || 10;
  if (!n) return { n: 0, mean: null, min: null, max: null, sd: null, med: null, pass: 0, rate: null, bins: [0, 0, 0, 0, 0, 0, 0] };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const pass = v.filter(x => x >= seuil).length;
  const edges = [5, 8, 10, 12, 14, 16]; const bins = [0, 0, 0, 0, 0, 0, 0];
  v.forEach(x => { let k = edges.findIndex(ed => x < ed); if (k < 0) k = 6; bins[k]++; });
  return { n, mean, min: v[0], max: v[n - 1], sd, med, pass, rate: pass * 100 / n, bins };
}
const BIN_LABELS = ['[0 ; 5[', '[5 ; 8[', '[8 ; 10[', '[10 ; 12[', '[12 ; 14[', '[14 ; 16[', '[16 ; 20]'];
function appreciation(n) { if (n === null || n === undefined) return ''; if (n < 5) return 'Très insuffisant'; if (n < 8) return 'Insuffisant'; if (n < 10) return 'Médiocre'; if (n < 12) return 'Passable'; if (n < 14) return 'Assez bien'; if (n < 16) return 'Bien'; if (n < 18) return 'Très bien'; return 'Excellent'; }
/* Résultats désanonymisés par classe */
function resultsByClass(e) {
  const out = {};
  e.classes.forEach(cid => out[cid] = []);
  (e.placement?.list || []).forEach(([sid, cid, t, name]) => {
    const m = e.marks?.[markKey(t)] || null; const f = finalMark(m, e);
    const fs = findStudent(sid); const st = fs ? fs.st : null;
    (out[cid] = out[cid] || []).push({ sid, cid, table: t, name: st ? fullName(st) : name, mat: st?.mat || '', sexe: st?.sexe || '', mark: m, note: f, st: m?.st || (f === null ? '—' : 'P') });
  });
  Object.values(out).forEach(a => a.sort((x, y) => x.name.localeCompare(y.name, 'fr')));
  return out;
}
/* Rang dans la classe */
function withRanks(rows) {
  const sorted = rows.filter(r => r.note !== null).slice().sort((a, b) => b.note - a.note);
  const rank = {}; sorted.forEach((r, i) => { rank[r.sid] = (i > 0 && sorted[i - 1].note === r.note) ? rank[sorted[i - 1].sid] : i + 1; });
  return rows.map(r => ({ ...r, rang: rank[r.sid] || null }));
}

/* ---------- Contrôles de cohérence ---------- */
function conflictsOf(levelId) {
  const out = [];
  const evs = Object.values(S.evals);
  const mine = levelId ? evs.filter(e => e.level === levelId) : evs;
  for (const e of mine) {
    for (const o of evs) {
      if (o.id <= e.id && (levelId ? o.level === levelId : true)) continue;
      if (!overlap(e, o)) continue;
      const common = e.classes.filter(c => o.classes.includes(c));
      if (common.length) out.push({ sev: 'bad', e, msg: `Chevauchement le ${fmtDate(e.date, 'dm')} : ${evalShort(e)} et ${evalShort(o)} pour ${common.map(c => S.classes[c]?.nom).join(', ')}.` });
      if (e.placement && o.placement) {
        const rs = e.placement.rooms.map(r => r.id).filter(r => o.placement.rooms.some(x => x.id === r));
        if (rs.length) out.push({ sev: 'bad', e, msg: `Salle occupée deux fois le ${fmtDate(e.date, 'dm')} (${rs.slice(0, 4).map(r => roomById(r)?.nom || r).join(', ')}${rs.length > 4 ? ` et ${rs.length - 4} autre(s)` : ''}) : ${evalShort(e)} ${levelById(e.level).roman} et ${evalShort(o)} ${levelById(o.level).roman}.` });
      }
    }
    e.classes.forEach(cid => { const c = S.classes[cid]; if (!c) return; if (!studentsOf(c).length) out.push({ sev: 'warn', e, msg: `${c.nom} n’a aucun élève enregistré (${evalShort(e)}).` }); const sj = c.subjects.find(s => s.m === e.subj); if (!sj) out.push({ sev: 'warn', e, msg: `${subjByCode(e.subj).nom} n’est pas au programme de ${c.nom}.` }); else if (!sj.prof) out.push({ sev: 'info', e, msg: `Pas d’enseignant de ${subjByCode(e.subj).abbr} associé à ${c.nom}.` }); });
    if (e.placement) {
      const cur = new Set(candidatesOf(e).map(x => x.sid)); const placed = new Set(e.placement.list.map(x => x[0]));
      const added = [...cur].filter(x => !placed.has(x)).length;
      if (added && !e.anon?.lifted) out.push({ sev: 'warn', e, msg: `${evalShort(e)} (${fmtDate(e.date, 'dm')}) : ${added} élève(s) inscrit(s) après la génération des codes. Regénérez la répartition.` });
    }
    const pr = progressOf(e);
    if (e.placement && ['composee', 'saisie'].includes(e.status) && e.deadline && e.deadline < todayISO() && pr.missing) out.push({ sev: 'warn', e, msg: `Saisie en retard : ${evalShort(e)} ${levelById(e.level).roman}, ${pr.missing} copie(s) sans note (échéance ${fmtDate(e.deadline, 'short')}).` });
    if (e.status === 'planifiee' && e.date <= addDays(todayISO(), 2) && e.date >= todayISO()) out.push({ sev: 'warn', e, msg: `${evalShort(e)} ${levelById(e.level).roman} a lieu le ${fmtDate(e.date, 'dm')} et ses codes-barres ne sont pas générés.` });
  }
  return out;
}
/* État d'une cellule classe × matière pour une situation */
function cellState(cid, subj, trim, sit) {
  const e = Object.values(S.evals).find(x => x.subj === subj && x.trim === trim && x.sit === sit && x.classes.includes(cid));
  if (!e) return { s: 0, e: null };
  if (['desanonymisee', 'cloturee'].includes(e.status)) { const rows = resultsByClass(e)[cid] || []; const st = statsOf(rows.map(r => r.note)); return { s: 4, e, mean: st.mean }; }
  if (['composee', 'saisie'].includes(e.status)) { const rows = (e.placement?.list || []).filter(x => x[1] === cid); const done = rows.filter(x => markDone(e.marks?.[markKey(x[2])], e)).length; return { s: 3, e, pct: rows.length ? Math.round(done * 100 / rows.length) : 0 }; }
  if (e.status === 'preparee') return { s: 2, e };
  return { s: 1, e };
}

/* =====================================================================
   Éditions PDF (jsPDF + AutoTable) — toujours un seul fichier par export
   ===================================================================== */
const C_ACCENT = [29, 59, 139], C_GOLD = [184, 134, 11], C_INK = [18, 26, 46], C_MUTED = [100, 110, 130], C_LINE = [196, 203, 217], C_SOFT = [234, 238, 246];
const pt = s => String(s ?? '').replace(/[  ]/g, ' ').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[ ]/g, ' ');

function pdfNew(orient = 'p') {
  if (!window.jspdf) throw new Error('La bibliothèque PDF n’est pas chargée. Vérifiez la connexion puis rechargez la page.');
  const doc = new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: 'a4', compress: true });
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
  doc.__ctx = { used: false, confidential: false };
  doc.setProperties({ title: 'AI721_ASTRA_LUZ_2.0', creator: 'AI721_ASTRA_LUZ_2.0', author: S.settings.etab });
  return doc;
}
const pw = doc => doc.internal.pageSize.getWidth();
const ph = doc => doc.internal.pageSize.getHeight();
function newSection(doc, orient) { if (doc.__ctx.used) doc.addPage('a4', orient || (pw(doc) > ph(doc) ? 'l' : 'p')); doc.__ctx.used = true; doc.__ctx.sectionStart = doc.internal.getNumberOfPages(); }

/* Barres vectorielles Code 128 (jeu C) */
const _bcCache = new Map();
function bcBits(code) {
  if (_bcCache.has(code)) return _bcCache.get(code);
  const o = {}; window.JsBarcode(o, code, { format: 'CODE128C', displayValue: false });
  const bits = (o.encodings || []).map(x => x.data).join('');
  _bcCache.set(code, bits); return bits;
}
function drawBarcode(doc, code, x, y, opt = {}) {
  const bits = bcBits(code); const mw = opt.module || 0.3; const h = opt.h || 9;
  const w = bits.length * mw;
  const x0 = opt.center ? x - w / 2 : x;
  doc.setFillColor(0, 0, 0);
  let i = 0;
  while (i < bits.length) { if (bits[i] === '1') { let j = i; while (j < bits.length && bits[j] === '1') j++; doc.rect(x0 + i * mw, y, (j - i) * mw, h, 'F'); i = j; } else i++; }
  if (opt.text !== false) { doc.setFont('courier', 'bold'); doc.setFontSize(opt.fs || 7.5); doc.setTextColor(0, 0, 0); doc.text(fmtCode(code), x0 + w / 2, y + h + (opt.fs || 7.5) * 0.36 + 0.4, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK); }
  return w;
}

/* En-tête « établissement » (modèle habituel du collège) : tableau encadré établissement | logo | année */
function logoFit(doc, x, y, w, h) {
  const st = S.settings; if (!st.logo) return;
  try { const p = doc.getImageProperties(st.logo); const r = Math.min(w / p.width, h / p.height); const iw = p.width * r, ih = p.height * r; doc.addImage(st.logo, st.logo.includes('image/jpeg') ? 'JPEG' : 'PNG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); } catch (e) { drawMonogram(doc, x + w / 2, y + h / 2); }
}
function pdfHeaderEtab(doc, title, sub) {
  const W = pw(doc), st = S.settings, x0 = 12, w = W - 24, top = 9, h1 = 23, h2 = 12, h3 = 5.5;
  const a1 = w * .36, a2 = w * .28, b1 = w * .27, b2 = w * .46;
  const lvl = doc.__ctx.level || ''; const lvId = LEVELS.find(l => l.pref === lvl)?.id;
  doc.setTextColor(...C_INK);
  doc.setFont('times', 'bold'); doc.setFontSize(10.5);
  const el = doc.splitTextToSize(pt(st.etab).toUpperCase(), a1 - 6); let y = top + h1 / 2 - (el.length * 4.3 + 5) / 2 + 3.6;
  el.forEach(l => { doc.text(l, x0 + a1 / 2, y, { align: 'center' }); y += 4.3; });
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.3); doc.setTextColor(...C_MUTED);
  doc.splitTextToSize(pt(st.tutelle), a1 - 6).slice(0, 2).forEach(l => { doc.text(l, x0 + a1 / 2, y + .6, { align: 'center' }); y += 2.7; });
  logoFit(doc, x0 + a1 + 2, top + 1.5, a2 - 4, h1 - 3);
  doc.setTextColor(...C_INK); doc.setFont('times', 'bold'); doc.setFontSize(10.5);
  doc.text('ANNÉE SCOLAIRE', x0 + a1 + a2 + (w - a1 - a2) / 2, top + h1 / 2 - 1, { align: 'center' });
  doc.setFontSize(12); doc.text(pt(st.annee), x0 + a1 + a2 + (w - a1 - a2) / 2, top + h1 / 2 + 5, { align: 'center' });
  const r2 = top + h1;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.text(lvl ? 'Préfecture :' : 'Service :', x0 + 2, r2 + 4.2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(doc.splitTextToSize(pt(lvl ? lvl.replace('Préfecture de ', '') : st.departement), b1 - 4)[0], x0 + 2, r2 + 9.2);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(...C_MUTED); doc.text('SECRÉTARIAT DES ÉVALUATIONS · SECOND CYCLE', x0 + b1 + b2 / 2, r2 + 3.4, { align: 'center' });
  doc.setTextColor(...C_INK); doc.setFont('helvetica', 'bold'); let tf = 11; doc.setFontSize(tf);
  let tl = doc.splitTextToSize(pt(title), b2 - 4); if (tl.length > 1) { tf = 9; doc.setFontSize(tf); tl = doc.splitTextToSize(pt(title), b2 - 4); }
  tl.slice(0, 2).forEach((l, i) => doc.text(l, x0 + b1 + b2 / 2, r2 + (tl.length > 1 ? 6.8 + i * 3.8 : 8.4), { align: 'center' }));
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.text('Date d’édition :', x0 + b1 + b2 + 2, r2 + 4.2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(new Date().toLocaleDateString('fr-FR'), x0 + b1 + b2 + 2, r2 + 9.2);
  const r3 = r2 + h2; doc.setFillColor(242, 242, 242); doc.rect(x0, r3, w, h3, 'F');
  const resp = lvId && st.prefets?.[lvId] ? `Préfet des études : ${st.prefets[lvId]}` : `Coordonnateur : ${st.coordo}`;
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); doc.text(pt(resp), x0 + w - 2, r3 + 3.8, { align: 'right' });
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(.2);
  doc.line(x0, r2, x0 + w, r2); doc.line(x0, r3, x0 + w, r3);
  doc.line(x0 + a1, top, x0 + a1, r2); doc.line(x0 + a1 + a2, top, x0 + a1 + a2, r2);
  doc.line(x0 + b1, r2, x0 + b1, r3); doc.line(x0 + b1 + b2, r2, x0 + b1 + b2, r3);
  doc.setLineWidth(.8); doc.rect(x0, top, w, h1 + h2 + h3);
  y = r3 + h3 + 5.5;
  if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C_MUTED); doc.splitTextToSize(pt(sub), W - 30).forEach(l => { doc.text(l, W / 2, y, { align: 'center' }); y += 4; }); }
  doc.setTextColor(...C_INK); doc.setFont('helvetica', 'normal');
  return y + 1;
}
/* En-tête officiel bilingue */
function pdfHeader(doc, title, sub) {
  if (S.settings.pdfStyle !== 'officiel') return pdfHeaderEtab(doc, title, sub);
  const W = pw(doc); const st = S.settings; const top = 9;
  const colW = (W - 24 - 30) / 2;
  const lines = (txt) => String(txt || '').split('\n').filter(Boolean);
  const drawCol = (arr, cx) => { let y = top + 2; arr.forEach((l, i) => { const bold = i === 0 || i === arr.length - 1; doc.setFont('helvetica', bold ? 'bold' : (i === 1 ? 'italic' : 'normal')); doc.setFontSize(i === 0 ? 8 : 7); const wrapped = doc.splitTextToSize(pt(l), colW); wrapped.forEach(wl => { doc.text(wl, cx, y, { align: 'center' }); y += 3.1; }); if (i < arr.length - 1) { doc.setFontSize(5); doc.text('* * *', cx, y - 0.6, { align: 'center' }); y += 1.6; } }); return y; };
  doc.setTextColor(...C_INK);
  const y1 = drawCol(lines(st.enteteFR), 12 + colW / 2);
  const y2 = drawCol(lines(st.enteteEN), W - 12 - colW / 2);
  const lx = W / 2 - 12, ly = top;
  if (st.logo) { try { doc.addImage(st.logo, st.logo.includes('image/jpeg') ? 'JPEG' : 'PNG', lx, ly, 24, 24); } catch (e) { drawMonogram(doc, W / 2, ly + 12); } }
  else drawMonogram(doc, W / 2, ly + 12);
  let y = Math.max(y1, y2, ly + 26) + 1.5;
  doc.setDrawColor(...C_ACCENT); doc.setLineWidth(0.6); doc.line(12, y, W - 12, y);
  doc.setDrawColor(...C_GOLD); doc.setLineWidth(0.25); doc.line(12, y + 0.9, W - 12, y + 0.9);
  y += 6.5;
  if (title) { doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C_ACCENT); doc.text(pt(title), W / 2, y, { align: 'center' }); y += 5.2; }
  if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C_MUTED); doc.splitTextToSize(pt(sub), W - 30).forEach(l => { doc.text(l, W / 2, y, { align: 'center' }); y += 4; }); }
  doc.setTextColor(...C_INK);
  return y + 1.5;
}
function drawMonogram(doc, cx, cy) {
  doc.setDrawColor(...C_ACCENT); doc.setLineWidth(0.5); doc.circle(cx, cy, 11.5); doc.setLineWidth(0.2); doc.circle(cx, cy, 10.3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C_ACCENT);
  const sig = pt(S.settings.sigle || 'LOGO').split(' ');
  sig.forEach((w, i) => doc.text(w, cx, cy - (sig.length - 1) * 1.6 + i * 3.4 + 1, { align: 'center' }));
  doc.setTextColor(...C_INK); doc.setFont('helvetica', 'normal');
}
function runningHeader(doc, txt) {
  const W = pw(doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C_MUTED);
  doc.text(pt(`${S.settings.etab} · ${txt}`), 12, 10); doc.text(pt(`Année scolaire ${S.settings.annee}`), W - 12, 10, { align: 'right' });
  doc.setDrawColor(...C_LINE); doc.setLineWidth(0.2); doc.line(12, 12, W - 12, 12); doc.setTextColor(...C_INK);
}
function pdfFooters(doc, label) {
  const n = doc.internal.getNumberOfPages(); const now = new Date().toLocaleString('fr-FR');
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); const W = pw(doc), H = ph(doc);
    if (S.settings.pdfStyle !== 'officiel') {
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); doc.setLineDashPattern([2.2, 1.4], 0); doc.line(12, H - 12, W - 12, H - 12); doc.setLineDashPattern([], 0);
      doc.setTextColor(...C_INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); const t1 = 'Page ', t2 = ` ${i} `, t3 = 'sur', t4 = ` ${n}`;
      const wt = doc.getTextWidth(t1) + doc.getTextWidth(t3); doc.setFont('helvetica', 'normal'); const wn = doc.getTextWidth(t2) + doc.getTextWidth(t4); let xx = W / 2 - (wt + wn) / 2;
      doc.setFont('helvetica', 'bold'); doc.text(t1, xx, H - 7.5); xx += doc.getTextWidth(t1); doc.setFont('helvetica', 'normal'); doc.text(t2, xx, H - 7.5); xx += doc.getTextWidth(t2); doc.setFont('helvetica', 'bold'); doc.text(t3, xx, H - 7.5); xx += doc.getTextWidth(t3); doc.setFont('helvetica', 'normal'); doc.text(t4, xx, H - 7.5);
      doc.setFontSize(6.5); doc.setTextColor(...C_MUTED); doc.text(pt(`${APP.name} · ${label || ''} · ${now}`), 12, H - 4.5);
    } else {
    doc.setDrawColor(...C_LINE); doc.setLineWidth(0.2); doc.line(12, H - 11, W - 12, H - 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C_MUTED);
    doc.text(pt(`${APP.name} · ${label || ''} · édité le ${now}`), 12, H - 7);
    doc.text(`Page ${i} / ${n}`, W - 12, H - 7, { align: 'right' }); }
    if (doc.__ctx.confidential) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C_GOLD); doc.text('CONFIDENTIEL', W - 12, H - 7.5, { align: 'right' }); }
  }
  doc.setTextColor(...C_INK);
}
function metaGrid(doc, y, pairs, cols = 3) {
  const W = pw(doc); const x0 = 12, w = (W - 24) / cols; const rowH = 9.2;
  const rows = Math.ceil(pairs.length / cols);
  doc.setFillColor(...C_SOFT); doc.setDrawColor(...C_LINE); doc.setLineWidth(0.15); doc.roundedRect(x0, y, W - 24, rows * rowH + 1.5, 1.5, 1.5, 'FD');
  pairs.forEach(([k, v], i) => { const cx = x0 + 3 + (i % cols) * w, cy = y + 4 + Math.floor(i / cols) * rowH; doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...C_MUTED); doc.text(pt(k).toUpperCase(), cx, cy); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C_INK); doc.text(doc.splitTextToSize(pt(v || '—'), w - 5)[0], cx, cy + 4.2); });
  doc.setFont('helvetica', 'normal');
  return y + rows * rowH + 5;
}
function signatures(doc, y, labels) {
  const W = pw(doc), H = ph(doc); if (y > H - 40) { doc.addPage(); runningHeader(doc, 'Signatures'); y = 22; }
  const w = (W - 24) / labels.length; doc.setFontSize(8.5);
  labels.forEach((l, i) => { const cx = 12 + i * w + w / 2; doc.setFont('helvetica', 'bold'); doc.text(pt(l), cx, y + 4, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.setDrawColor(...C_LINE); doc.line(cx - w / 2 + 8, y + 22, cx + w / 2 - 8, y + 22); });
  return y + 28;
}
const tableBase = (doc) => ({
  theme: 'grid', rowPageBreak: 'avoid', styles: { font: 'helvetica', fontSize: 8.4, cellPadding: 1.5, lineColor: C_LINE, lineWidth: 0.12, textColor: C_INK, valign: 'middle', overflow: 'linebreak' },
  headStyles: { fillColor: C_ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
  alternateRowStyles: { fillColor: [247, 248, 252] }, margin: { left: 12, right: 12, top: 17, bottom: 16 }
});
function autoT(doc, opts, runLabel) {
  const start = doc.internal.getNumberOfPages();
  doc.autoTable({ ...tableBase(doc), ...opts, didDrawPage: d => { if (doc.internal.getCurrentPageInfo().pageNumber > start) runningHeader(doc, runLabel); if (opts.didDrawPage) opts.didDrawPage(d); } });
  return doc.lastAutoTable.finalY;
}
const teacherOf = (cid, subj) => teacherName(S.classes[cid]?.subjects.find(s => s.m === subj)?.prof);
const evalMeta = (e, cls) => [
  ['Niveau', levelById(e.level).nom], ['Classe(s)', cls ? cls.nom : evalClassNames(e)], ['Matière', subjByCode(e.subj).nom],
  ['Trimestre / situation', `Trimestre ${e.trim} · Situation ${e.sit}`], ['Date', fmtDate(e.date)], ['Créneau', `${fmtTime(e.start)} – ${fmtTime(e.end)} (${duree(e.start, e.end)})`]
];
const sortEvals = evs => evs.slice().sort((a, b) => (a.date + a.start + a.level).localeCompare(b.date + b.start + b.level) || subjByCode(a.subj).nom.localeCompare(subjByCode(b.subj).nom));
function needPlacement(evs) { const miss = evs.filter(e => !e.placement); if (miss.length) throw new Error(`Codes non générés pour : ${miss.map(e => evalShort(e) + ' ' + levelById(e.level).roman).join(', ')}. Générez d’abord la répartition.`); }

/* 1. Listes de classe avec codes-barres (toutes les classes du niveau, même matière, même date) */
function addListesClasse(doc, evs) {
  needPlacement(evs);
  for (const e of sortEvals(evs)) {
    for (const cid of e.classes.slice().sort((a, b) => (S.classes[a]?.rang || 0) - (S.classes[b]?.rang || 0))) {
      const cls = S.classes[cid]; if (!cls) continue;
      const rows = e.placement.list.filter(x => x[1] === cid).map(x => { const fs = findStudent(x[0]); return { st: fs?.st, name: fs ? fullName(fs.st) : x[3], table: x[2], code: codeOf(e, cid, x[2]), room: roomOfTable(e, x[2])?.nom || '' }; }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      newSection(doc, 'p');
      doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, 'LISTE DE CLASSE · ÉPREUVE ANONYME', `${cls.nom} · ${subjByCode(e.subj).nom} · Trimestre ${e.trim}, situation ${e.sit}`);
      y = metaGrid(doc, y, [...evalMeta(e, cls), ['Enseignant', teacherOf(cid, e.subj)], ['Effectif', String(rows.length)], ['Préfet des études', S.settings.prefets?.[e.level] || '']]);
      autoT(doc, {
        startY: y, head: [['N°', 'Matricule', 'Noms et prénoms', 'S', 'Salle', 'Table', 'Code-barres', 'Émargement']],
        body: rows.map((r, i) => [i + 1, r.st?.mat || '', r.name, r.st?.sexe || '', r.room, pad(r.table, 3), '', '']),
        columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 19, fontSize: 7.5 }, 2: { cellWidth: 52 }, 3: { halign: 'center', cellWidth: 6 }, 4: { cellWidth: 16, fontSize: 7.5 }, 5: { halign: 'center', cellWidth: 11, font: 'courier', fontStyle: 'bold' }, 6: { cellWidth: 44, minCellHeight: 14.5 }, 7: { cellWidth: 30 } },
        didDrawCell: d => { if (d.section === 'body' && d.column.index === 6) { const r = rows[d.row.index]; if (!r) return; drawBarcode(doc, r.code, d.cell.x + d.cell.width / 2, d.cell.y + 1.6, { center: true, h: 8.4, module: 0.31, fs: 6.8 }); } }
      }, `${cls.nom} · ${subjByCode(e.subj).abbr} · T${e.trim}S${e.sit}`);
      signatures(doc, doc.lastAutoTable.finalY + 6, ['Le Secrétariat des évaluations', 'Le Préfet des études']);
    }
  }
}
/* 2. Listes d'émargement par salle + procès-verbal de salle */
function addEmargement(doc, evs) {
  needPlacement(evs);
  for (const e of sortEvals(evs)) {
    for (const r of e.placement.rooms) {
      const rows = e.placement.list.filter(x => x[2] >= r.from && x[2] <= r.to).sort((a, b) => a[2] - b[2]);
      newSection(doc, 'p');
      doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, `LISTE D’ÉMARGEMENT · ${pt(r.nom).toUpperCase()}`, `${levelById(e.level).nom} · ${subjByCode(e.subj).nom} · T${e.trim} S${e.sit} · tables ${pad(r.from, 3)} à ${pad(r.to, 3)}`);
      y = metaGrid(doc, y, [...evalMeta(e), ['Salle', r.nom], ['Tables', `${pad(r.from, 3)} – ${pad(r.to, 3)} (${rows.length} places)`], ['Surveillants', (r.surv || []).map(teacherName).join(' ; ') || 'À désigner']]);
      autoT(doc, {
        startY: y, head: [['Table', 'Code-barres', 'Noms et prénoms', 'Classe', 'Sign. entrée', 'Feuilles', 'Sign. remise']],
        body: rows.map(x => [pad(x[2], 3), '', (findStudent(x[0]) ? fullName(findStudent(x[0]).st) : x[3]), S.classes[x[1]]?.nom || '', '', '', '']),
        columnStyles: { 0: { halign: 'center', cellWidth: 11, font: 'courier', fontStyle: 'bold' }, 1: { cellWidth: 42, minCellHeight: 13.5 }, 2: { cellWidth: 52 }, 3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 25 }, 5: { cellWidth: 14 }, 6: { cellWidth: 28 } },
        didDrawCell: d => { if (d.section === 'body' && d.column.index === 1) { const x = rows[d.row.index]; if (!x) return; drawBarcode(doc, codeOf(e, x[1], x[2]), d.cell.x + d.cell.width / 2, d.cell.y + 1.5, { center: true, h: 7.8, module: 0.3, fs: 6.5 }); } }
      }, `Émargement ${r.nom} · ${subjByCode(e.subj).abbr}`);
      let yy = doc.lastAutoTable.finalY + 5; if (yy > ph(doc) - 62) { doc.addPage(); runningHeader(doc, `PV ${r.nom}`); yy = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_ACCENT); doc.text('PROCÈS-VERBAL DE SALLE', 12, yy); doc.setTextColor(...C_INK);
      autoT(doc, { startY: yy + 2, head: [['Inscrits', 'Présents', 'Absents', 'Copies remises', 'Heure de début', 'Heure de fin']], body: [[String(rows.length), '', '', '', fmtTime(e.start), fmtTime(e.end)]], bodyStyles: { minCellHeight: 9, halign: 'center' } }, 'PV');
      let y3 = doc.lastAutoTable.finalY + 4; doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.text('Incidents / observations :', 12, y3); doc.setDrawColor(...C_LINE); for (let k = 1; k <= 3; k++) doc.line(12, y3 + k * 6, pw(doc) - 12, y3 + k * 6);
      signatures(doc, y3 + 21, ['Surveillant 1', 'Surveillant 2', 'Chef de centre']);
    }
  }
}
/* 3. Planches d'étiquettes adhésives */
const LABEL_FORMATS = {
  '3x8': { l: 'A4 · 3 × 8 étiquettes (70 × 37 mm)', cols: 3, rows: 8, w: 70, h: 37.125, mt: 0, ml: 0, gx: 0, gy: 0 },
  '3x7': { l: 'A4 · 3 × 7 étiquettes (70 × 42,4 mm)', cols: 3, rows: 7, w: 70, h: 42.4, mt: 0, ml: 0, gx: 0, gy: 0 },
  '2x8': { l: 'A4 · 2 × 8 étiquettes (99,1 × 33,9 mm)', cols: 2, rows: 8, w: 99.1, h: 33.9, mt: 13, ml: 4.65, gx: 2.5, gy: 0 },
  '3x10': { l: 'A4 · 3 × 10 étiquettes (63,5 × 25,4 mm)', cols: 3, rows: 10, w: 63.5, h: 25.4, mt: 21.5, ml: 7.2, gx: 2.5, gy: 0 }
};
function addEtiquettes(doc, evs, type = 'paire', fmtKey = '3x8', cut = true) {
  needPlacement(evs);
  const F = LABEL_FORMATS[fmtKey] || LABEL_FORMATS['3x8'];
  const items = [];
  for (const e of sortEvals(evs)) for (const x of e.placement.list.slice().sort((a, b) => a[2] - b[2])) {
    const fs = findStudent(x[0]); const name = fs ? fullName(fs.st) : x[3]; const code = codeOf(e, x[1], x[2]); const room = roomOfTable(e, x[2])?.nom || '';
    const base = { e, code, name, cls: S.classes[x[1]]?.nom || '', room, table: x[2] };
    if (type === 'paire' || type === 'nominative') items.push({ ...base, kind: 'nom' });
    if (type === 'paire' || type === 'anonyme') items.push({ ...base, kind: 'anon' });
  }
  const per = F.cols * F.rows;
  for (let p = 0; p * per < items.length; p++) {
    newSection(doc, 'p');
    items.slice(p * per, p * per + per).forEach((it, k) => {
      const c = k % F.cols, r = Math.floor(k / F.cols);
      const x = F.ml + c * (F.w + F.gx), y = F.mt + r * (F.h + F.gy);
      if (cut) { doc.setDrawColor(220, 224, 232); doc.setLineWidth(0.1); doc.rect(x + 0.5, y + 0.5, F.w - 1, F.h - 1); }
      const cx = x + F.w / 2; const small = F.h < 30;
      const mod = Math.min(0.33, (F.w - 10) / 101);
      doc.setTextColor(...C_INK);
      if (it.kind === 'nom') {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(small ? 7 : 8); doc.text(doc.splitTextToSize(pt(it.name), F.w - 6)[0], cx, y + (small ? 4 : 5.2), { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(small ? 6 : 6.8); doc.text(pt(`${it.cls} · ${it.room} · Table ${pad(it.table, 3)}`), cx, y + (small ? 7 : 8.8), { align: 'center' });
        drawBarcode(doc, it.code, cx, y + (small ? 8.2 : 10.5), { center: true, h: small ? 9 : Math.min(13, F.h - 21), module: mod, fs: small ? 6 : 7 });
        doc.setFontSize(small ? 5.5 : 6.2); doc.setTextColor(...C_MUTED); doc.text(pt(`${subjByCode(it.e.subj).abbr} · T${it.e.trim} S${it.e.sit} · ${fmtDate(it.e.date, 'short')} · EN-TÊTE`), cx, y + F.h - 2.2, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(small ? 7 : 8); doc.setTextColor(...C_ACCENT); doc.text(pt(`${subjByCode(it.e.subj).abbr} · ${levelById(it.e.level).nom} · T${it.e.trim} S${it.e.sit}`), cx, y + (small ? 4 : 5.2), { align: 'center' });
        doc.setTextColor(...C_INK);
        drawBarcode(doc, it.code, cx, y + (small ? 6 : 8), { center: true, h: small ? 11 : Math.min(15, F.h - 18), module: mod, fs: small ? 6.5 : 7.5 });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(small ? 5.5 : 6.2); doc.setTextColor(...C_MUTED); doc.text(pt(`Copie anonyme · ${fmtDate(it.e.date, 'short')}`), cx, y + F.h - 2.2, { align: 'center' });
      }
      doc.setTextColor(...C_INK);
    });
  }
  doc.__ctx.noFooter = true;
}
/* 4. Bordereaux de notation anonymes, par salle et par lot */
function addBordereaux(doc, evs, lot) {
  needPlacement(evs); lot = +lot || +S.settings.tailleLot || 25;
  for (const e of sortEvals(evs)) {
    const all = e.placement.list.slice().sort((a, b) => a[2] - b[2]);
    const lots = []; for (let i = 0; i < all.length; i += lot) lots.push(all.slice(i, i + lot));
    lots.forEach((rows, li) => {
      newSection(doc, 'p');
      doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, 'BORDEREAU DE NOTATION ANONYME', `${levelById(e.level).nom} · ${subjByCode(e.subj).nom} · T${e.trim} S${e.sit} · lot ${li + 1} sur ${lots.length}`);
      y = metaGrid(doc, y, [['Matière', subjByCode(e.subj).nom], ['Niveau', levelById(e.level).nom], ['Trimestre / situation', `T${e.trim} · S${e.sit}`], ['Date de l’épreuve', fmtDate(e.date, 'short')], ['Tables', `${pad(rows[0][2], 3)} – ${pad(rows[rows.length - 1][2], 3)}`], ['Barème', `Note sur ${e.bareme || 20}`]]);
      const head = e.double ? [['N°', 'Code-barres', 'Note 1re corr.', 'Note 2e corr.', 'Observations']] : [['N°', 'Code-barres', 'Note', 'Observations']];
      autoT(doc, {
        startY: y, head, body: rows.map((x, i) => e.double ? [i + 1, '', '', '', ''] : [i + 1, '', '', '']),
        columnStyles: e.double ? { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 52, minCellHeight: 13 }, 2: { cellWidth: 26 }, 3: { cellWidth: 26 }, 4: {} } : { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 56, minCellHeight: 13 }, 2: { cellWidth: 30 }, 3: {} },
        didDrawCell: d => { if (d.section === 'body' && d.column.index === 1) { const x = rows[d.row.index]; if (!x) return; drawBarcode(doc, codeOf(e, x[1], x[2]), d.cell.x + d.cell.width / 2, d.cell.y + 1.4, { center: true, h: 7.6, module: 0.3, fs: 6.5 }); } }
      }, `Bordereau ${subjByCode(e.subj).abbr} · lot ${li + 1}`);
      signatures(doc, doc.lastAutoTable.finalY + 6, ['Correcteur (nom et signature)', 'Date de remise', 'Reçu par le Secrétariat']);
    });
  }
}
/* 5. Table de correspondance (sous pli scellé) */
function addCorrespondance(doc, evs) {
  needPlacement(evs); doc.__ctx.confidential = true;
  for (const e of sortEvals(evs)) {
    newSection(doc, 'p');
    doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, 'TABLE DE CORRESPONDANCE CODE ↔ ÉLÈVE'.replace('↔', '/'), `À conserver sous pli scellé jusqu’à la levée d’anonymat · ${levelById(e.level).nom} · ${subjByCode(e.subj).nom} · T${e.trim} S${e.sit}`);
    y = metaGrid(doc, y, evalMeta(e));
    const rows = e.placement.list.slice().sort((a, b) => a[2] - b[2]);
    autoT(doc, { startY: y, head: [['Table', 'Code', 'Salle', 'Classe', 'Matricule', 'Noms et prénoms']], body: rows.map(x => { const fs = findStudent(x[0]); return [pad(x[2], 3), fmtCode(codeOf(e, x[1], x[2])), roomOfTable(e, x[2])?.nom || '', S.classes[x[1]]?.nom || '', fs?.st.mat || '', fs ? fullName(fs.st) : x[3]]; }), columnStyles: { 0: { halign: 'center', cellWidth: 12, font: 'courier' }, 1: { font: 'courier', cellWidth: 38 }, 2: { cellWidth: 20 }, 3: { cellWidth: 16 }, 4: { cellWidth: 22 } } }, `Correspondance ${subjByCode(e.subj).abbr}`);
    signatures(doc, doc.lastAutoTable.finalY + 6, ['Scellé par (Secrétariat)', 'Ouvert par (Coordination)', 'Témoin']);
  }
}
/* 6. Relevés de notes désanonymisés */
function addReleves(doc, evs) {
  const ok = evs.filter(e => e.anon?.lifted);
  if (!ok.length) throw new Error('Aucune des épreuves choisies n’a été désanonymisée.');
  for (const e of sortEvals(ok)) {
    const res = resultsByClass(e);
    for (const cid of e.classes.slice().sort((a, b) => (S.classes[a]?.rang || 0) - (S.classes[b]?.rang || 0))) {
      const cls = S.classes[cid]; if (!cls) continue;
      const rows = withRanks(res[cid] || []); const st = statsOf(rows.map(r => r.note));
      const sj = cls.subjects.find(s => s.m === e.subj);
      newSection(doc, 'p');
      doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, `RELEVÉ DE NOTES · ${cls.nom}`, `${subjByCode(e.subj).nom} · Trimestre ${e.trim}, situation ${e.sit} · épreuve du ${fmtDate(e.date)}`);
      y = metaGrid(doc, y, [['Classe', cls.nom], ['Matière', subjByCode(e.subj).nom], ['Coefficient', String(sj?.coef ?? '—')], ['Enseignant', teacherOf(cid, e.subj)], ['Effectif', String(rows.length)], ['Anonymat levé le', fmtDT(e.anon.at)]]);
      autoT(doc, {
        startY: y, head: [['N°', 'Matricule', 'Noms et prénoms', 'S', 'Note / 20', 'Rang', 'Appréciation']],
        body: rows.map((r, i) => [i + 1, r.mat, r.name, r.sexe, r.note === null ? (r.st === 'ABS' ? 'ABS' : r.st === 'DISP' ? 'DISP' : r.st === 'FRAUDE' ? 'FRAUDE' : '—') : fmtNote(r.note), r.rang ? (r.rang === 1 ? '1er' : r.rang + 'e') : '', appreciation(r.note)]),
        columnStyles: { 0: { halign: 'center', cellWidth: 9 }, 1: { cellWidth: 22 }, 2: { cellWidth: 66 }, 3: { halign: 'center', cellWidth: 7 }, 4: { halign: 'center', cellWidth: 19, fontStyle: 'bold' }, 5: { halign: 'center', cellWidth: 13 }, 6: {} },
        didParseCell: d => { if (d.section === 'body' && d.column.index === 4) { const r = rows[d.row.index]; if (r && r.note !== null && r.note < (+S.settings.seuilReussite || 10)) d.cell.styles.textColor = [179, 38, 30]; } }
      }, `Relevé ${cls.nom} · ${subjByCode(e.subj).abbr}`);
      let y2 = doc.lastAutoTable.finalY + 5; if (y2 > ph(doc) - 70) { doc.addPage(); runningHeader(doc, `Statistiques ${cls.nom}`); y2 = 20; }
      const abs = rows.filter(r => r.st === 'ABS').length;
      autoT(doc, { startY: y2, head: [['Présents', 'Absents', 'Moyenne', 'Note mini', 'Note maxi', 'Écart-type', `Notes >= ${S.settings.seuilReussite}`, 'Taux de réussite']], body: [[st.n, abs, fmtNote(st.mean), fmtNote(st.min), fmtNote(st.max), fmtNote(st.sd), st.pass, st.rate === null ? '—' : fmtNote(st.rate) + ' %']], bodyStyles: { halign: 'center', fontStyle: 'bold' }, headStyles: { fillColor: C_GOLD, textColor: 255, fontSize: 7.5, halign: 'center' } }, 'Statistiques');
      autoT(doc, { startY: doc.lastAutoTable.finalY + 2, head: [BIN_LABELS], body: [st.bins.map(String)], bodyStyles: { halign: 'center' }, headStyles: { fillColor: [70, 80, 106], textColor: 255, fontSize: 7.5, halign: 'center' } }, 'Répartition');
      signatures(doc, doc.lastAutoTable.finalY + 6, ['L’Enseignant', 'Le Préfet des études', 'Le Coordonnateur']);
    }
  }
}
/* 7. Planning des évaluations */
function addPlanning(doc, levelIds, filt = {}) {
  for (const lv of levelIds) {
    let evs = sortEvals(evalsOf(lv).filter(e => (!filt.trim || e.trim === +filt.trim) && (!filt.sit || e.sit === +filt.sit) && (!filt.from || e.date >= filt.from) && (!filt.to || e.date <= filt.to)));
    newSection(doc, 'l');
    doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, `PLANNING DES ÉVALUATIONS · ${levelById(lv).pref.toUpperCase()}`, [filt.trim ? `Trimestre ${filt.trim}` : '', filt.sit ? `Situation ${filt.sit}` : '', filt.from ? `du ${fmtDate(filt.from, 'short')}` : '', filt.to ? `au ${fmtDate(filt.to, 'short')}` : ''].filter(Boolean).join(' · ') || 'Toutes les évaluations enregistrées');
    if (!evs.length) { doc.setFontSize(10); doc.text('Aucune évaluation planifiée pour ces critères.', 12, y + 6); continue; }
    autoT(doc, { startY: y, head: [['Date', 'Créneau', 'Durée', 'T / S', 'Matière', 'Classes', 'Effectif', 'Salles', 'Statut']], body: evs.map(e => [fmtDate(e.date, 'dm'), `${fmtTime(e.start)} – ${fmtTime(e.end)}`, duree(e.start, e.end), `T${e.trim} S${e.sit}`, subjByCode(e.subj).nom, evalClassNames(e), String(candidatesOf(e).length), (e.placement?.rooms || []).map(r => r.nom).join(', ') || '—', STATUS[e.status]?.l || '']), columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 28 }, 2: { cellWidth: 15 }, 3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 40 }, 6: { cellWidth: 16, halign: 'center' }, 8: { cellWidth: 26 } } }, `Planning ${levelById(lv).nom}`);
    signatures(doc, doc.lastAutoTable.finalY + 6, ['Le Préfet des études', 'Le Coordonnateur', 'Visa du Censeur']);
  }
}
/* 8. Rapport statistique */
function addStats(doc, evs) {
  const ok = sortEvals(evs.filter(e => e.anon?.lifted));
  if (!ok.length) throw new Error('Les statistiques nominatives exigent des épreuves désanonymisées.');
  for (const e of ok) {
    const res = resultsByClass(e);
    newSection(doc, 'p');
    doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, 'RAPPORT STATISTIQUE D’ÉPREUVE', `${levelById(e.level).nom} · ${subjByCode(e.subj).nom} · T${e.trim} S${e.sit} · ${fmtDate(e.date)}`);
    const rowsAll = Object.values(res).flat(); const g = statsOf(rowsAll.map(r => r.note));
    y = metaGrid(doc, y, [['Présents', String(g.n)], ['Moyenne du niveau', fmtNote(g.mean)], ['Taux de réussite', g.rate === null ? '—' : fmtNote(g.rate) + ' %'], ['Note mini / maxi', `${fmtNote(g.min)} / ${fmtNote(g.max)}`], ['Écart-type', fmtNote(g.sd)], ['Médiane', fmtNote(g.med)]]);
    const per = e.classes.map(cid => { const r = res[cid] || []; return { cls: S.classes[cid], st: statsOf(r.map(x => x.note)), abs: r.filter(x => x.st === 'ABS').length, eff: r.length }; }).filter(x => x.cls).sort((a, b) => a.cls.rang - b.cls.rang);
    autoT(doc, { startY: y, head: [['Classe', 'Enseignant', 'Eff.', 'Prés.', 'Abs.', 'Moy.', 'Mini', 'Maxi', 'É.-type', 'Réussite']], body: per.map(p => [p.cls.nom, teacherOf(p.cls.id, e.subj), p.eff, p.st.n, p.abs, fmtNote(p.st.mean), fmtNote(p.st.min), fmtNote(p.st.max), fmtNote(p.st.sd), p.st.rate === null ? '—' : fmtNote(p.st.rate) + ' %']), columnStyles: { 0: { fontStyle: 'bold', cellWidth: 16 }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold' }, 6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' }, 9: { halign: 'center' } } }, 'Statistiques');
    let yy = doc.lastAutoTable.finalY + 8; if (yy > ph(doc) - 90) { doc.addPage(); runningHeader(doc, 'Graphiques'); yy = 20; }
    yy = pdfBarChart(doc, 12, yy, pw(doc) - 24, 52, per.map(p => ({ l: p.cls.nom, v: p.st.mean })), 'Moyenne par classe (sur 20)', 20, +S.settings.seuilReussite || 10);
    yy = pdfBarChart(doc, 12, yy + 6, pw(doc) - 24, 46, BIN_LABELS.map((l, i) => ({ l, v: g.bins[i] })), 'Répartition des notes du niveau (nombre d’élèves)', null, null);
    const top = rowsAll.filter(r => r.note !== null).sort((a, b) => b.note - a.note).slice(0, 10);
    if (top.length) { let y3 = yy + 4; if (y3 > ph(doc) - 60) { doc.addPage(); runningHeader(doc, 'Palmarès'); y3 = 20; } autoT(doc, { startY: y3, head: [['Rang', 'Noms et prénoms', 'Classe', 'Note / 20']], body: top.map((r, i) => [i + 1, r.name, S.classes[r.cid]?.nom || '', fmtNote(r.note)]), headStyles: { fillColor: C_GOLD, textColor: 255 }, columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 3: { halign: 'center', fontStyle: 'bold', cellWidth: 24 } } }, 'Palmarès'); }
  }
}
function pdfBarChart(doc, x, y, w, h, data, title, maxV, ref) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C_INK); doc.text(pt(title), x, y); y += 3;
  const max = maxV || Math.ceil(Math.max(1, ...data.map(d => d.v || 0)) * 1.15); const ch = h - 10; const n = data.length; const bw = Math.min(16, (w - 10) / n * 0.62); const step = (w - 10) / n;
  doc.setDrawColor(...C_LINE); doc.setLineWidth(0.15);
  for (let k = 0; k <= 4; k++) { const yy = y + ch - ch * k / 4; doc.line(x + 8, yy, x + w, yy); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C_MUTED); doc.text(String(Math.round(max * k / 4 * 10) / 10).replace('.', ','), x + 6.5, yy + 1, { align: 'right' }); }
  data.forEach((d, i) => { const v = d.v || 0; const bh = ch * v / max; const bx = x + 8 + i * step + (step - bw) / 2; doc.setFillColor(...C_ACCENT); if (bh > 0) doc.rect(bx, y + ch - bh, bw, bh, 'F'); doc.setFontSize(6.5); doc.setTextColor(...C_INK); if (d.v !== null && d.v !== undefined) doc.text(maxV ? fmtNote(d.v) : String(d.v), bx + bw / 2, y + ch - bh - 1, { align: 'center' }); doc.setTextColor(...C_MUTED); doc.text(pt(d.l), bx + bw / 2, y + ch + 3.5, { align: 'center' }); });
  if (ref) { const yy = y + ch - ch * ref / max; doc.setDrawColor(...C_GOLD); doc.setLineWidth(0.4); doc.setLineDashPattern([1.5, 1], 0); doc.line(x + 8, yy, x + w, yy); doc.setLineDashPattern([], 0); doc.setFontSize(6.5); doc.setTextColor(...C_GOLD); doc.text(`seuil ${ref}`, x + w, yy - 1, { align: 'right' }); }
  doc.setTextColor(...C_INK); return y + h;
}
/* 9. Procès-verbal de levée d'anonymat */
function addPV(doc, e) {
  newSection(doc, 'p'); const pr = progressOf(e);
  doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, 'PROCÈS-VERBAL DE LEVÉE D’ANONYMAT', `${levelById(e.level).nom} · ${subjByCode(e.subj).nom} · Trimestre ${e.trim}, situation ${e.sit}`);
  y = metaGrid(doc, y, [...evalMeta(e), ['Copies attendues', String(pr.total)], ['Copies notées', String(pr.done - pr.abs)], ['Absents', String(pr.abs)]]);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const txt = `Le ${fmtDate(new Date(e.anon?.at || Date.now()).toISOString().slice(0, 10))}, l’anonymat des copies de l’épreuve de ${subjByCode(e.subj).nom} (${levelById(e.level).nom}, trimestre ${e.trim}, situation ${e.sit}) composée le ${fmtDate(e.date)} a été levé par ${e.anon?.by || '…'} au moyen de l’application ${APP.name}. ${pr.total} copies étaient attendues ; ${pr.done - pr.abs} ont été notées et ${pr.abs} élève(s) ont été déclaré(s) absent(s). Les notes saisies sous code ont été rattachées aux élèves à partir de la table de correspondance générée le ${fmtDT(e.placement?.at)}. Aucune note n’a été modifiée après la levée d’anonymat sans mention au journal d’audit.`;
  doc.splitTextToSize(pt(txt), pw(doc) - 24).forEach(l => { doc.text(l, 12, y); y += 5; });
  signatures(doc, y + 8, ['Le Secrétariat des évaluations', 'Le Préfet des études', 'Le Coordonnateur']);
}
/* 10. Fiche de suivi d'un élève */
function addFicheEleve(doc, sid) {
  const fs = findStudent(sid); if (!fs) throw new Error('Élève introuvable.');
  newSection(doc, 'p');
  doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, 'FICHE DE SUIVI DES ÉVALUATIONS', `${fullName(fs.st)} · ${fs.cls.nom} · année scolaire ${S.settings.annee}`);
  y = metaGrid(doc, y, [['Noms et prénoms', fullName(fs.st)], ['Matricule', fs.st.mat], ['Classe', fs.cls.nom], ['Sexe', fs.st.sexe], ['Date de naissance', fs.st.dn ? fmtDate(fs.st.dn, 'short') : ''], ['Statut', fs.st.statut || '']]);
  const evs = sortEvals(Object.values(S.evals).filter(e => e.anon?.lifted && e.placement?.list.some(x => x[0] === sid)));
  const body = evs.map(e => { const x = e.placement.list.find(z => z[0] === sid); const m = e.marks?.[markKey(x[2])]; const f = finalMark(m, e); const res = resultsByClass(e)[fs.cls.id] || []; const st = statsOf(res.map(r => r.note)); return [fmtDate(e.date, 'short'), `T${e.trim} S${e.sit}`, subjByCode(e.subj).nom, f === null ? (m?.st || '—') : fmtNote(f), fmtNote(st.mean), appreciation(f)]; });
  autoT(doc, { startY: y, head: [['Date', 'T / S', 'Matière', 'Note / 20', 'Moy. classe', 'Appréciation']], body: body.length ? body : [['', '', 'Aucune note désanonymisée pour le moment', '', '', '']], columnStyles: { 3: { halign: 'center', fontStyle: 'bold' }, 4: { halign: 'center' } } }, `Fiche ${fullName(fs.st)}`);
}
/* Dossier complet d'une journée (un seul fichier) */
function addDossierJournee(doc, evs, opts) {
  const sorted = sortEvals(evs);
  newSection(doc, 'p');
  doc.__ctx.level = (typeof e !== 'undefined' && e && e.level) ? levelById(e.level).pref : ((typeof lv !== 'undefined' && levelById(lv)) ? levelById(lv).pref : ''); let y = pdfHeader(doc, 'DOSSIER DES ÉPREUVES DU JOUR', `${fmtDate(sorted[0].date)} · ${[...new Set(sorted.map(e => levelById(e.level).nom))].join(', ')}`);
  autoT(doc, { startY: y, head: [['Créneau', 'Niveau', 'Matière', 'T / S', 'Classes', 'Salles', 'Effectif']], body: sorted.map(e => [`${fmtTime(e.start)} – ${fmtTime(e.end)}`, levelById(e.level).nom, subjByCode(e.subj).nom, `T${e.trim} S${e.sit}`, evalClassNames(e), (e.placement?.rooms || []).map(r => r.nom).join(', ') || 'non réparti', String(e.placement?.list.length || candidatesOf(e).length)]) }, 'Sommaire du jour');
  let y2 = doc.lastAutoTable.finalY + 6; doc.setFontSize(8.5); doc.setTextColor(...C_MUTED);
  const parts = ['Contenu : sommaire', opts.emarg && 'listes d’émargement par salle', opts.listes && 'listes de classe avec codes-barres', opts.bord && 'bordereaux de notation anonymes', opts.corr && 'tables de correspondance (confidentiel)'].filter(Boolean).join(' ; ');
  doc.text(doc.splitTextToSize(pt(parts + '.'), pw(doc) - 24), 12, y2); doc.setTextColor(...C_INK);
  if (opts.emarg) addEmargement(doc, sorted);
  if (opts.listes) addListesClasse(doc, sorted);
  if (opts.bord) addBordereaux(doc, sorted);
  if (opts.corr) addCorrespondance(doc, sorted);
}

/* ---------- Enregistrement des fichiers ---------- */
async function saveBlob(filename, blob) {
  if (S.caps.downloads) {
    try { await S.caps.downloads.save({ filename, data: blob }); toast(`Fichier enregistré : ${filename}`, 'ok'); return true; }
    catch (e) { if (e && e.code === 'declined') { toast('Enregistrement annulé.'); return false; } if (e && (e.code === 'rejected_extension' || e.code === 'too_large')) { toast(`Enregistrement refusé (${e.code}).`, 'bad'); return false; } }
  }
  try {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 20000);
    toast(`Fichier généré : ${filename}`, 'ok'); return true;
  } catch (e) { toast('Le navigateur a bloqué le téléchargement.', 'bad'); return false; }
}
async function runPdf(filename, label, build, orient = 'p') {
  await withBusy('Génération du PDF…', async () => {
    await ensurePdfLibs();
    const doc = pdfNew(orient); build(doc);
    if (!doc.__ctx.noFooter) pdfFooters(doc, label);
    const pages = doc.internal.getNumberOfPages();
    const blob = doc.output('blob');
    await saveBlob(filename, blob);
    audit('Édition PDF', `${label} (${pages} p.) : ${filename}`);
  });
}
const fileSafe = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/* =====================================================================
   Interface : icônes, fenêtres, notifications, composants
   ===================================================================== */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><path d="M16 4.8a3 3 0 0 1 0 6"/><path d="M18 14.8c1.7.7 2.7 2.4 3 5.2"/>',
  book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/>',
  door: '<path d="M5 21V4.5C5 3.7 5.7 3 6.5 3h11c.8 0 1.5.7 1.5 1.5V21"/><path d="M3 21h18"/><circle cx="15" cy="12.5" r="1"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  barcode: '<path d="M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14"/>',
  scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M7 12h10"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.7-1.5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  log: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/>',
  file: '<path d="M14 3H6.5C5.7 3 5 3.7 5 4.5v15c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
  shuffle: '<path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c1.6 0 2.8-1.6 3.8-3.6M14 7h7M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
};
const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

function logoHTML(cls = 'logo') {
  if (S.settings.logo) return `<img class="${cls}" src="${esc(S.settings.logo)}" alt="Logo ${esc(S.settings.sigle)}" style="object-fit:contain;border-radius:8px;background:#fff">`;
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-label="Emblème ASTRA LUZ"><circle cx="24" cy="24" r="22" fill="var(--accent)"/><circle cx="24" cy="24" r="18.5" fill="none" stroke="var(--gold)" stroke-width="1"/><path d="m24 9 3.2 9.6H37l-8 5.9 3.1 9.6L24 28.2l-8.1 5.9L19 24.5l-8-5.9h9.8z" fill="var(--gold)"/></svg>`;
}

/* Notifications */
function toast(msg, kind = '') {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6500 : 3800);
}
async function withBusy(label, fn) {
  const b = document.createElement('div'); b.className = 'busy'; b.innerHTML = `<div><span class="spin"></span>${esc(label)}</div>`; document.body.appendChild(b);
  await sleep(30);
  try { return await fn(); } catch (e) { console.error(e); toast(e.message || String(e), 'bad'); } finally { b.remove(); }
}
/* Fenêtres modales (les boîtes natives sont bloquées dans l'artefact) */
function openModal({ title, body, wide = false, actions = [], onOpen }) {
  const back = document.createElement('div'); back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="btn ghost sm" data-x aria-label="Fermer">${ic('x')}</button></header><div class="body">${body}</div>${actions.length ? `<footer></footer>` : ''}</div>`;
  const m = back.firstElementChild; const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = ev => { if (ev.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', ev => { if (ev.target === back) close(); });
  $('[data-x]', m).onclick = close;
  const ft = $('footer', m);
  actions.forEach(a => { const b = document.createElement('button'); b.className = 'btn ' + (a.cls || ''); b.innerHTML = a.label; b.onclick = async () => { if (a.onClick) { const r = await a.onClick(close, m); if (r === false) return; } else close(); }; ft.appendChild(b); });
  document.body.appendChild(back);
  if (onOpen) onOpen(m, close);
  const f = $('input:not([type=hidden]):not([type=checkbox]),select,textarea', $('.body', m)); if (f) setTimeout(() => f.focus(), 30);
  return { close, el: m };
}
function confirmBox(title, msg, okLabel = 'Confirmer', danger = false) {
  return new Promise(res => { let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    const md = openModal({ title, body: `<p>${msg}</p>`, actions: [{ label: 'Annuler', onClick: c => { fin(false); c(); } }, { label: okLabel, cls: danger ? 'danger' : 'primary', onClick: c => { fin(true); c(); } }] });
    const obs = new MutationObserver(() => { if (!document.body.contains(md.el)) { fin(false); obs.disconnect(); } }); obs.observe(document.body, { childList: true });
  });
}
async function requireCoord(reason) {
  if (S.mode === 'cloud') { if (CLOUD.profile?.role === 'coordination') return true; toast('Action réservée au compte de coordination.', 'bad'); return false; }
  if (S.ui.role === 'coordination' && S.ui.unlocked) return true;
  if (!S.security.pinHash) { S.ui.role = 'coordination'; S.ui.unlocked = true; toast('Aucun code PIN défini : action autorisée. Définissez un PIN dans les paramètres.', ''); renderTop(); return true; }
  return new Promise(res => { let ok = false;
    openModal({ title: 'Code PIN de la coordination', body: `<p class="muted">${esc(reason || 'Cette action est réservée à la coordination.')}</p><label class="f">Code PIN<input class="in mono" id="pin-in" type="password" inputmode="numeric" autocomplete="off"></label><p class="small" id="pin-err" style="color:var(--bad)"></p>`,
      actions: [{ label: 'Annuler', onClick: c => { c(); res(false); } }, { label: 'Valider', cls: 'primary', onClick: async (c, m) => { const v = $('#pin-in', m).value; if (await sha256('astraluz:' + v) === S.security.pinHash) { S.ui.role = 'coordination'; S.ui.unlocked = true; ok = true; c(); renderTop(); audit('Accès coordination', 'Déverrouillage par PIN'); res(true); } else { $('#pin-err', m).textContent = 'Code incorrect.'; return false; } } }],
      onOpen: m => $('#pin-in', m).addEventListener('keydown', ev => { if (ev.key === 'Enter') $('footer .primary', m).click(); }) });
  });
}

/* Codes-barres à l'écran */
function bcSvg(code, opt = {}) {
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    window.JsBarcode(svg, code, { format: 'CODE128C', width: opt.w || 1.6, height: opt.h || 46, displayValue: opt.text !== false, text: fmtCode(code), font: 'monospace', fontSize: opt.fs || 13, margin: opt.m ?? 8, background: '#ffffff', lineColor: '#000000' });
    return svg.outerHTML;
  } catch (e) { return `<span class="mono">${fmtCode(code)}</span>`; }
}

/* Petits graphiques SVG (une série : pas de légende, valeurs au survol) */
function barChartSvg(data, { max = null, ref = null, h = 180, fmt = v => fmtNote(v), unit = '' } = {}) {
  if (!data.length) return '<div class="empty small">Aucune donnée à représenter.</div>';
  const n = data.length; const W = Math.max(320, n * 54 + 40); const top = 18, bottom = 26, left = 32; const ch = h - top - bottom;
  const M = max || Math.max(1, ...data.map(d => d.v || 0));
  const step = (W - left - 8) / n; const bw = Math.min(30, step * 0.62);
  let s = `<svg viewBox="0 0 ${W} ${h}" role="img" style="width:100%;min-width:${Math.min(W, n * 42 + 40)}px;height:auto;max-height:${h + 40}px" preserveAspectRatio="xMinYMin meet">`;
  for (let k = 0; k <= 4; k++) { const y = top + ch - ch * k / 4; s += `<line class="grid-l" x1="${left}" x2="${W - 4}" y1="${y}" y2="${y}"/><text x="${left - 6}" y="${y + 3.5}" text-anchor="end">${String(Math.round(M * k / 4 * 10) / 10).replace('.', ',')}</text>`; }
  data.forEach((d, i) => { const v = d.v || 0; const bh = Math.max(0, ch * v / M); const x = left + i * step + (step - bw) / 2; const y = top + ch - bh;
    const r = Math.min(4, bw / 2, bh);
    s += `<g><title>${esc(d.l)} : ${d.v === null || d.v === undefined ? 'pas de donnée' : esc(fmt(d.v)) + unit}</title>${bh > 0 ? `<path class="bar-m" d="M${x},${top + ch} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${top + ch} Z"/>` : ''}${d.v !== null && d.v !== undefined ? `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${esc(fmt(d.v))}</text>` : ''}<text x="${x + bw / 2}" y="${h - 8}" text-anchor="middle">${esc(d.l)}</text></g>`; });
  if (ref !== null) { const y = top + ch - ch * ref / M; s += `<line class="ref" x1="${left}" x2="${W - 4}" y1="${y}" y2="${y}"/><text x="${W - 6}" y="${y - 4}" text-anchor="end" style="fill:var(--gold)">seuil ${String(ref).replace('.', ',')}</text>`; }
  return `<div class="chart">${s}</svg></div>`;
}
const kpi = (v, l, s = '') => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;
const progressBar = (pct, cls = '') => `<div class="bar ${cls}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const optList = (arr, sel) => arr.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');
const levelOpts = sel => optList(LEVELS.map(l => [l.id, l.nom]), sel);
const subjOpts = (sel, list) => optList((list || S.subjects).map(s => [s.code, `${s.abbr} · ${s.nom}`]), sel);
const teacherOpts = sel => '<option value="">— non attribué —</option>' + optList(S.teachers.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map(t => [t.id, teacherName(t.id)]), sel);
const tsLabel = (t, s) => `Trimestre ${t} · Situation ${s}`;
function sitOpts(sel) { let o = ''; for (let s = 1; s <= 6; s++) o += `<option value="${s}" ${+sel === s ? 'selected' : ''}>Situation ${s} (T${trimOfSit(s)})</option>`; return o; }

/* Lecture de fichiers Excel / CSV */
async function readSheet(file) {
  await ensureXlsx();
  return new Promise((res, rej) => {
    if (!window.XLSX) return rej(new Error('Le module Excel n’est pas chargé.'));
    const fr = new FileReader();
    fr.onload = () => { try { const wb = window.XLSX.read(fr.result, { type: 'array', cellDates: true }); const sh = wb.Sheets[wb.SheetNames[0]]; const rows = window.XLSX.utils.sheet_to_json(sh, { defval: '', raw: false }); res({ rows, sheets: wb.SheetNames, wb }); } catch (e) { rej(new Error('Fichier illisible : ' + e.message)); } };
    fr.onerror = () => rej(new Error('Lecture du fichier impossible.'));
    fr.readAsArrayBuffer(file);
  });
}
const pickCol = (row, names) => { const keys = Object.keys(row); for (const n of names) { const k = keys.find(k => norm(k).replace(/[^a-z0-9]/g, '') === n); if (k !== undefined) return String(row[k] ?? '').trim(); } return ''; };
async function xlsxSave(filename, sheets) {
  try { await ensureXlsx(); } catch (e) { }
  if (!window.XLSX) { toast('Le module Excel n’est pas chargé.', 'bad'); return; }
  const wb = window.XLSX.utils.book_new();
  sheets.forEach(({ name, rows, cols }) => { const ws = window.XLSX.utils.aoa_to_sheet(rows); if (cols) ws['!cols'] = cols.map(w => ({ wch: w })); window.XLSX.utils.book_append_sheet(wb, ws, String(name).slice(0, 31).replace(/[\\/?*\[\]:]/g, '-')); });
  const out = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return saveBlob(filename, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

/* =====================================================================
   Coquille de l'application : accueil, navigation, barre supérieure
   ===================================================================== */
const NAV = [
  { grp: 'Pilotage', items: [['tableau', 'Tableau de bord', 'dash'], ['planning', 'Planning des évaluations', 'cal']] },
  { grp: 'Référentiels', items: [['eleves', 'Élèves et classes', 'users'], ['matieres', 'Matières et enseignants', 'book'], ['salles', 'Salles de composition', 'door']] },
  { grp: 'Épreuves', items: [['epreuves', 'Préparation et codes-barres', 'barcode'], ['saisie', 'Saisie anonyme des notes', 'scan'], ['resultats', 'Désanonymat et résultats', 'unlock']] },
  { grp: 'Analyse et éditions', items: [['statistiques', 'Statistiques', 'chart'], ['editions', 'Centre d’impression', 'print']] },
  { grp: 'Système', items: [['journal', 'Journal d’audit', 'log'], ['utilisateurs', 'Utilisateurs et rôles', 'user'], ['parametres', 'Paramètres et sauvegarde', 'gear']] }
];
const VIEW_IDS = NAV.flatMap(g => g.items.map(i => i[0]));
const V = {}; // fonctions de rendu des vues
let starAnim = null;

function curSit() { return +(S.ui.sit || S.settings.sitCourante || 1); }
function curTrim() { return trimOfSit(curSit()); }
function levelsInScope() { return S.ui.level && S.ui.level !== 'all' ? [S.ui.level] : LEVELS.map(l => l.id); }
const scopeLabel = () => S.ui.level === 'all' ? 'Coordination du second cycle' : (levelById(S.ui.level)?.pref || '');
const modeLabel = () => ({ shared: 'Base partagée', cloud: 'Base en ligne', local: 'Base locale (ce navigateur)', demo: 'Démonstration' })[S.mode];

function go(view) { if (location.hash !== '#' + view) location.hash = view; else render(); }
function route() {
  const h = (location.hash || '').replace('#', '');
  if (h === 'accueil' || !h || !S.ui.level) { S.ui.view = 'accueil'; }
  else if (VIEW_IDS.includes(h)) S.ui.view = h;
  else S.ui.view = 'tableau';
  render();
}
function render() {
  if (starAnim) { cancelAnimationFrame(starAnim); starAnim = null; }
  const app = $('#app');
  if (S.ui.view === 'accueil') { app.innerHTML = renderHome(); bindHome(); return; }
  if (!$('.shell', app)) { app.innerHTML = renderShellHTML(); }
  renderSide(); renderTop();
  const host = $('#view'); const el = document.createElement('div'); el.className = 'stack'; el.style.gap = '16px';
  host.replaceChildren(el);
  try { (V[S.ui.view] || V.tableau)(el); } catch (e) { console.error(e); el.innerHTML = `<div class="callout bad">Erreur d’affichage : ${esc(e.message)}</div>`; }
  $('.side')?.classList.remove('open'); $('.scrim')?.remove();
  window.scrollTo(0, 0);
}
const rerender = debounce(() => { if (S.ui.view !== 'accueil' && !S.ui.busyForm) { const y = window.scrollY; render(); window.scrollTo(0, y); } }, 250);

/* ---------- Accueil ---------- */
function homeCounts(lv) {
  const cls = classesOf(lv); const st = cls.reduce((a, c) => a + studentsOf(c).length, 0);
  const evs = evalsOf(lv); const up = evs.filter(e => e.date >= todayISO() && !['desanonymisee', 'cloturee'].includes(e.status)).length;
  return { cls, st, evs: evs.length, up };
}
function renderHome() {
  const st = S.settings;
  const cards = LEVELS.map(l => { const c = homeCounts(l.id); return `
    <button class="pref" data-level="${l.id}">
      <div class="row between"><span class="num-l">${l.roman}</span><span class="eyebrow">${esc(st.prefets?.[l.id] || 'Préfet à renseigner')}</span></div>
      <h2>${l.pref}</h2>
      <div class="cls">${c.cls.map(x => `<span>${esc(x.nom)}</span>`).join('') || '<span>aucune classe</span>'}</div>
      <div class="stats"><div><b>${c.cls.length}</b><span>classes</span></div><div><b>${c.st}</b><span>élèves</span></div><div><b>${c.up}</b><span>épreuves à venir</span></div></div>
      <div class="go">Ouvrir le tableau de bord ${ic('dash')}</div>
    </button>`; }).join('');
  const all = LEVELS.map(l => homeCounts(l.id));
  const coord = `<button class="pref coord" data-level="all"><div class="row between"><span class="num-l">2<sup style="font-size:.45em">nd</sup></span><span class="eyebrow">${esc(st.coordo)}</span></div><h2>Coordination du second cycle</h2><p class="muted small">Vue consolidée des trois préfectures : planning croisé, conflits de salles, avancement de la saisie et désanonymats en attente.</p><div class="stats"><div><b>${all.reduce((a, c) => a + c.cls.length, 0)}</b><span>classes</span></div><div><b>${all.reduce((a, c) => a + c.st, 0)}</b><span>élèves</span></div><div><b>${Object.keys(S.evals).length}</b><span>épreuves</span></div></div><div class="go">Vue de coordination ${ic('dash')}</div></button>`;
  const upcoming = Object.values(S.evals).filter(e => e.date >= todayISO() && e.date <= addDays(todayISO(), 10)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 7);
  const init = !S.initialized ? `<div class="callout warn"><b>Base vide.</b> Initialisez la structure 2026-2027 (29 classes réparties en trois préfectures, catalogue de ${DEFAULT_SUBJECTS.length} matières) pour commencer, ou explorez l’application avec des données fictives.</div><div class="row"><button class="btn primary" data-act="init">${ic('check')}Initialiser la structure 2026-2027</button></div>` : '';
  return `<div class="home">
    ${S.mode === 'demo' ? '<div class="demo-band">MODE DÉMONSTRATION : toutes les données affichées sont fictives et restent dans ce navigateur</div>' : ''}
    <section class="hero"><canvas id="sky" aria-hidden="true"></canvas><div class="in-hero">
      <div class="bar-top"><div class="inst">${logoHTML()}<div><b>${esc(st.etab)}</b><span>${esc(st.tutelle)} · ${esc(st.ville)}</span></div></div><span class="modechip">${esc(modeLabel())}</span></div>
      <div class="ttl"><div class="eyebrow">Secrétariat des évaluations · second cycle · année scolaire ${esc(st.annee)}</div>
        <h1>AI721 <em>ASTRA LUZ</em> 2.0</h1>
        <p>Planification des épreuves, répartition des élèves en salles, anonymat des copies par code-barres, saisie des notes à la douchette et levée d’anonymat contrôlée, de la situation 1 à la situation 6.</p></div>
      <div class="codeline" aria-label="Structure du code-barres"><span><b>1</b> niveau</span><span><b>03</b> classe</span><span><b>03</b> matière</span><span><b>12</b> trimestre · situation</span><span><b>047</b> table</span><span><b>38</b> clé</span></div>
    </div></section>
    <div class="prefs">${cards}${coord}</div>
    <div class="home-foot">
      <div class="panel"><header><h3>Circuit d’une épreuve</h3></header><div class="flow">
        <div><b>1. Planifier</b><span>Date, créneau, classes</span></div><div><b>2. Répartir</b><span>Salles et numéros de table</span></div><div><b>3. Imprimer</b><span>Listes, étiquettes, bordereaux</span></div><div><b>4. Saisir</b><span>Notes lues au code-barres</span></div><div><b>5. Lever l’anonymat</b><span>PIN de la coordination</span></div><div><b>6. Publier</b><span>Relevés, statistiques</span></div></div></div>
      <div class="panel"><header><h3>Dans les dix prochains jours</h3></header>${upcoming.length ? `<div class="timeline">${upcoming.map(e => `<div class="it"><span class="d">${fmtDate(e.date, 'dm')}<br>${e.start}</span><span><b>${esc(subjByCode(e.subj).nom)}</b> · ${levelById(e.level).nom}<br><span class="small muted">${esc(evalClassNames(e))}</span></span></div>`).join('')}</div>` : '<p class="muted">Aucune épreuve planifiée sur cette période.</p>'}</div>
      <div class="panel"><header><h3>Base de données</h3><span class="pill ${['shared', 'cloud'].includes(S.mode) ? 'ok' : S.mode === 'demo' ? 'gold' : 'info'}">${esc(modeLabel())}</span></header><div class="stack">
        <p class="small muted">${S.mode === 'cloud' ? 'Les données sont enregistrées dans la base en ligne Firebase du collège, partagées en temps réel et protégées par des comptes nominatifs.' : S.mode === 'shared' ? 'Les données sont enregistrées sur claude.ai et partagées avec les membres du secrétariat qui ont accès à cette application.' : S.mode === 'demo' ? 'Jeu fictif de 29 classes et environ 1 400 élèves pour la formation. Rien n’est écrit dans la base réelle.' : 'Les données restent dans ce navigateur. Faites une sauvegarde régulière depuis Paramètres.'}</p>
        ${init}
        <div class="row">${S.mode === 'demo' ? `<button class="btn" data-act="leave-demo">${ic('x')}Quitter la démonstration</button>` : `<button class="btn" data-act="demo">${ic('star')}Explorer avec des données fictives</button>`}</div>
      </div></div>
    </div></div>`;
}
function bindHome() {
  $$('.pref').forEach(b => b.onclick = () => { S.ui.level = b.dataset.level; lsSet('level', S.ui.level); go('tableau'); if (location.hash === '#tableau') route(); });
  $$('[data-act]').forEach(b => b.onclick = async () => {
    const a = b.dataset.act;
    if (a === 'init') await withBusy('Création de la structure…', async () => { await initStructure(); toast('Structure 2026-2027 créée.', 'ok'); render(); });
    if (a === 'demo') await switchMode('demo');
    if (a === 'leave-demo') await switchMode('real');
  });
  drawSky();
}
function drawSky() {
  const cv = $('#sky'); if (!cv) return; const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; };
  size(); const rnd = seededRandom(721);
  const stars = Array.from({ length: 150 }, () => ({ x: rnd(), y: rnd(), r: rnd() * 1.3 + .25, p: rnd() * 6.28, s: .4 + rnd() * 1.2 }));
  const cons = [[.62, .18], [.68, .3], [.75, .26], [.81, .38], [.88, .33], [.84, .52], [.92, .6]];
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = t => {
    if (!document.body.contains(cv)) return;
    if (cv.width !== cv.clientWidth * dpr) size();
    const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(231,190,90,.28)'; ctx.lineWidth = 1 * dpr; ctx.beginPath(); cons.forEach(([x, y], i) => i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)); ctx.stroke();
    cons.forEach(([x, y]) => { ctx.fillStyle = 'rgba(231,190,90,.9)'; ctx.beginPath(); ctx.arc(x * W, y * H, 2.2 * dpr, 0, 6.29); ctx.fill(); });
    stars.forEach(s => { const a = reduce ? .7 : .45 + .45 * Math.sin(s.p + t / 1000 * s.s); ctx.fillStyle = `rgba(230,236,255,${a})`; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * dpr, 0, 6.29); ctx.fill(); });
    if (!reduce) starAnim = requestAnimationFrame(frame);
  };
  frame(0);
}

/* ---------- Coquille ---------- */
function renderShellHTML() {
  return `${S.mode === 'demo' ? '<div class="demo-band">MODE DÉMONSTRATION : données fictives, sans effet sur la base réelle</div>' : ''}
  <div class="shell"><aside class="side" id="side"></aside><div class="main"><div class="top" id="top"></div><main class="content" id="view"></main></div></div>`;
}
function renderSide() {
  const side = $('#side'); if (!side) return;
  const lv = S.ui.level; const evs = Object.values(S.evals).filter(e => lv === 'all' || e.level === lv);
  const cnt = { saisie: evs.filter(e => ['composee', 'saisie'].includes(e.status)).length, resultats: evs.filter(e => ['composee', 'saisie'].includes(e.status) && progressOf(e).missing === 0 && !e.anon?.lifted).length, epreuves: evs.filter(e => e.status === 'planifiee' && e.date >= todayISO()).length };
  side.innerHTML = `<div class="brand" data-home title="Retour à l’accueil">${logoHTML()}<div><b>ASTRA LUZ 2.0</b><span>${esc(scopeLabel())}</span></div></div>
    <nav aria-label="Navigation principale">${NAV.map(g => `<div class="grp">${g.grp}</div>${g.items.filter(([id]) => id !== 'utilisateurs' || (S.mode === 'cloud' && CLOUD.profile?.role === 'coordination')).map(([id, l, i]) => `<a href="#${id}" class="${S.ui.view === id ? 'on' : ''}">${ic(i)}<span>${l}</span>${cnt[id] ? `<span class="cnt">${cnt[id]}</span>` : ''}</a>`).join('')}`).join('')}</nav>
    <div class="foot">${esc(S.settings.sigle)} · ${esc(S.settings.annee)}<br>${APP.name} · v${APP.version}</div>`;
  $('[data-home]', side).onclick = () => go('accueil');
}
function renderTop() {
  const top = $('#top'); if (!top) return;
  top.innerHTML = `<button class="btn ghost menu-btn" data-menu aria-label="Menu">${ic('menu')}</button>
    <div class="lvl" role="tablist" aria-label="Préfecture">${LEVELS.map(l => `<button role="tab" data-lv="${l.id}" class="${S.ui.level === l.id ? 'on' : ''}" title="${l.pref}">${l.roman}</button>`).join('')}<button role="tab" data-lv="all" class="${S.ui.level === 'all' ? 'on' : ''}" title="Coordination du second cycle">Coord.</button></div>
    <select class="in" id="sit-sel" style="width:auto" aria-label="Situation courante">${sitOpts(curSit())}</select>
    <div class="search">${ic('search')}<input class="in" id="q" placeholder="Élève, matricule ou code-barres" autocomplete="off"><div id="q-res" class="panel" hidden style="position:absolute;top:110%;left:0;right:0;z-index:20;padding:6px;max-height:60vh;overflow:auto"></div></div>
    <span class="spacer"></span>
    <span class="pill ${['shared', 'cloud'].includes(S.mode) ? 'ok' : S.mode === 'demo' ? 'gold' : 'info'}" title="Stockage des données">${esc(modeLabel())}</span>
    ${S.mode === 'cloud' ? `<button class="btn sm ${S.ui.role === 'coordination' ? 'gold' : ''}" data-user title="Mon compte">${ic('user')}${esc((CLOUD.profile?.name || '').split(' ').slice(0, 3).join(' ') || 'Mon compte')} · ${esc((ROLES[CLOUD.profile?.role] || '').split(' ')[0])}</button>` : `<button class="btn sm ${S.ui.role === 'coordination' ? 'gold' : ''}" data-role title="Profil de session">${ic(S.ui.role === 'coordination' ? 'unlock' : 'lock')}${S.ui.role === 'coordination' ? 'Coordination' : 'Secrétariat'}</button>`}`;
  $$('[data-lv]', top).forEach(b => b.onclick = () => { S.ui.level = b.dataset.lv; lsSet('level', S.ui.level); render(); });
  $('#sit-sel', top).onchange = ev => { S.ui.sit = +ev.target.value; lsSet('sit', S.ui.sit); render(); };
  $('[data-menu]', top).onclick = () => { const sd = $('#side'); sd.classList.add('open'); const sc = document.createElement('div'); sc.className = 'scrim'; sc.onclick = () => { sd.classList.remove('open'); sc.remove(); }; document.body.appendChild(sc); };
  if ($('[data-user]', top)) $('[data-user]', top).onclick = userMenu;
  if ($('[data-role]', top)) $('[data-role]', top).onclick = async () => { if (S.ui.role === 'coordination') { S.ui.role = 'secretariat'; S.ui.unlocked = false; toast('Profil Secrétariat : les actions sensibles sont verrouillées.'); render(); } else { if (await requireCoord('Passer en profil Coordination (levée d’anonymat, corrections, suppressions).')) render(); } };
  bindSearch($('#q', top), $('#q-res', top));
}
function bindSearch(inp, res) {
  const run = () => {
    const q = inp.value.trim(); if (q.length < 2) { res.hidden = true; return; }
    const digits = scanDigits(q);
    let html = '';
    if (digits.length >= 10 && (/^[\d\s]+$/.test(q) || !/\d/.test(q))) html += `<button class="btn ghost" style="width:100%;justify-content:flex-start" data-code="${digits}">${ic('barcode')}Décoder le code ${esc(fmtCode(digits) || digits)}</button>`;
    const nq = norm(q); const out = [];
    for (const c of Object.values(S.classes)) for (const s of c.students || []) { if (norm(fullName(s)).includes(nq) || norm(s.mat).includes(nq)) out.push({ s, c }); if (out.length > 14) break; }
    html += out.map(({ s, c }) => `<button class="btn ghost" style="width:100%;justify-content:flex-start" data-sid="${s.id}">${ic('user')}<span><b>${esc(fullName(s))}</b> <span class="muted small">${esc(c.nom)} · ${esc(s.mat || '')}</span></span></button>`).join('');
    res.innerHTML = html || '<p class="muted small" style="padding:6px">Aucun résultat.</p>'; res.hidden = false;
    $$('[data-sid]', res).forEach(b => b.onclick = () => { res.hidden = true; inp.value = ''; showStudent(b.dataset.sid); });
    $$('[data-code]', res).forEach(b => b.onclick = () => { res.hidden = true; inp.value = ''; showDecoder(b.dataset.code); });
  };
  inp.addEventListener('input', debounce(run, 120));
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const d = scanDigits(inp.value); if (d.length === 12) { res.hidden = true; inp.value = ''; showDecoder(d); } else run(); } if (ev.key === 'Escape') res.hidden = true; });
  document.addEventListener('click', ev => { if (!res.contains(ev.target) && ev.target !== inp) res.hidden = true; });
}
function showDecoder(code) {
  const L = locateCode(code); const p = L.p;
  const showName = L.e && (L.e.anon?.lifted || S.ui.role === 'coordination');
  const m = L.e ? L.e.marks?.[markKey(p.TTT)] : null;
  openModal({ title: 'Décodage d’un code-barres', body: `
    <div class="bc" style="align-self:center">${p.digits.length === 12 ? bcSvg(p.digits) : ''}</div>
    ${p.ok ? '<div class="callout ok">Clé de contrôle valide.</div>' : `<div class="callout bad">${esc(p.err)}</div>`}
    <div class="copy-card"><div><span>Niveau</span><b>${esc(p.level?.nom || p.N || '?')}</b></div><div><span>Classe</span><b>${esc(p.cls?.nom || p.CC || '?')}</b></div><div><span>Matière</span><b>${esc(p.subject?.abbr || p.MM || '?')}</b></div><div><span>Trim. / sit.</span><b>T${p.T ?? '?'} · S${p.S ?? '?'}</b></div><div><span>Table</span><b>${p.TTT !== undefined ? pad(p.TTT, 3) : '?'}</b></div><div><span>Clé</span><b>${p.KK !== undefined ? pad(p.KK, 2) : '?'}</b></div></div>
    ${L.e ? `<div class="stack small"><div>Épreuve : <b>${esc(evalLabel(L.e))}</b> du ${fmtDate(L.e.date)} · ${statusPill(L.e.status)}</div><div>Salle : <b>${esc(roomOfTable(L.e, p.TTT)?.nom || '—')}</b></div><div>Note enregistrée : <b>${m ? (m.st && m.st !== 'P' ? m.st : fmtNote(finalMark(m, L.e)) || 'en attente') : 'aucune'}</b></div><div>Élève : <b>${showName ? esc(L.entry[3]) : 'masqué tant que l’anonymat n’est pas levé'}</b></div></div>` : (p.ok ? `<div class="callout warn">${esc(L.err || '')}</div>` : '')}`,
    actions: [{ label: 'Fermer' }] });
}
function showStudent(sid) {
  const fs = findStudent(sid); if (!fs) return;
  const evs = sortEvals(Object.values(S.evals).filter(e => e.placement?.list.some(x => x[0] === sid)));
  const rows = evs.map(e => { const x = e.placement.list.find(z => z[0] === sid); const m = e.marks?.[markKey(x[2])]; const lifted = e.anon?.lifted; const f = finalMark(m, e);
    return `<tr><td>${fmtDate(e.date, 'short')}</td><td>T${e.trim} S${e.sit}</td><td>${esc(subjByCode(e.subj).nom)}</td><td class="mono">${S.ui.role === 'coordination' || lifted ? esc(fmtCode(codeOf(e, x[1], x[2]))) : '•••'}</td><td class="r"><b>${lifted ? (f === null ? esc(m?.st || '—') : fmtNote(f)) : '<span class="muted">anonyme</span>'}</b></td></tr>`; }).join('');
  openModal({ title: fullName(fs.st), wide: true, body: `
    <div class="copy-card"><div><span>Classe</span><b>${esc(fs.cls.nom)}</b></div><div><span>Matricule</span><b>${esc(fs.st.mat || '—')}</b></div><div><span>Sexe</span><b>${esc(fs.st.sexe || '—')}</b></div><div><span>Naissance</span><b>${fs.st.dn ? fmtDate(fs.st.dn, 'short') : '—'}</b></div><div><span>Statut</span><b>${esc(fs.st.statut || '—')}</b></div></div>
    <div class="tw"><table class="t"><thead><tr><th>Date</th><th>T / S</th><th>Matière</th><th>Code</th><th class="r">Note / 20</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Aucune épreuve pour cet élève.</td></tr>'}</tbody></table></div>`,
    actions: [{ label: `${ic('print')}Fiche de suivi PDF`, cls: 'primary', onClick: () => { runPdf(`fiche-suivi-${fileSafe(fullName(fs.st))}.pdf`, 'Fiche de suivi', doc => addFicheEleve(doc, sid)); return false; } }, { label: 'Fermer' }] });
}
const pageHead = (title, sub, actions = '') => `<div class="pagehead"><div class="t"><div class="eyebrow">${esc(scopeLabel())} · ${tsLabel(curTrim(), curSit())}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row">${actions}</div></div>`;
function levelPicker(id = 'lv-pick') { return S.ui.level === 'all' ? `<label class="f">Niveau<select class="in" id="${id}">${levelOpts(LEVELS[0].id)}</select></label>` : ''; }
const pickedLevel = (root, id = 'lv-pick') => S.ui.level === 'all' ? ($('#' + id, root)?.value || LEVELS[0].id) : S.ui.level;

async function switchMode(target) {
  await withBusy(target === 'demo' ? 'Préparation des données fictives…' : 'Retour à la base réelle…', async () => {
    if (target === 'demo') { S.realStore = S.realStore || S.store; S.realMode = S.realMode || S.mode; const st = await new LocalStore('demo').open(); S.store = st; S.mode = 'demo'; await loadAll(); if (!S.initialized || !Object.keys(S.evals).length) { await buildDemo(); await loadAll(); } lsSet('demo', true); }
    else { lsSet('demo', false); if (S.cloudDemo || !S.realStore) { location.hash = ''; location.reload(); return; } S.store = S.realStore || S.store; S.mode = S.realMode || 'local'; S.realStore = null; await loadAll(); }
    S.ui.view = 'accueil'; location.hash = 'accueil'; render();
  });
}

/* =====================================================================
   Tableau de bord (préfecture) et vue de coordination
   ===================================================================== */
V.tableau = el => {
  const lvIds = levelsInScope(); const T = curTrim(), Sit = curSit();
  const cls = lvIds.flatMap(classesOf); const nSt = cls.reduce((a, c) => a + studentsOf(c).length, 0);
  const nF = cls.reduce((a, c) => a + studentsOf(c).filter(s => s.sexe === 'F').length, 0);
  const evs = Object.values(S.evals).filter(e => lvIds.includes(e.level));
  const evSit = evs.filter(e => e.sit === Sit);
  let copies = 0, done = 0; evSit.forEach(e => { const p = progressOf(e); copies += p.total; done += p.done; });
  const lifted = evSit.filter(e => e.anon?.lifted).length;
  const alerts = S.ui.level === 'all' ? conflictsOf(null) : conflictsOf(S.ui.level);
  const pref = S.ui.level !== 'all' ? S.settings.prefets?.[S.ui.level] : S.settings.coordo;
  el.innerHTML = pageHead(S.ui.level === 'all' ? 'Coordination du second cycle' : esc(levelById(S.ui.level).pref), `${pref ? esc(pref) + ' · ' : ''}année scolaire ${esc(S.settings.annee)}. Le tableau suit la situation choisie en haut de l’écran.`,
    `<button class="btn" data-go="eleves">${ic('upload')}Importer des élèves</button><button class="btn" data-go="planning">${ic('cal')}Planifier</button><button class="btn primary" data-go="editions">${ic('print')}Centre d’impression</button>`) + `
    <div class="grid g4">
      ${kpi(cls.length, 'Classes', lvIds.length > 1 ? 'trois préfectures' : POLES_SUMMARY(cls))}
      ${kpi(nSt.toLocaleString('fr-FR'), 'Élèves inscrits', nSt ? `${nF} filles · ${nSt - nF} garçons` : 'listes à importer')}
      ${kpi(`${evSit.length}`, `Épreuves de la situation ${Sit}`, `${evSit.filter(e => e.placement).length} avec codes-barres`)}
      ${kpi(copies ? Math.round(done * 100 / copies) + ' %' : '—', 'Copies notées', copies ? `${done.toLocaleString('fr-FR')} sur ${copies.toLocaleString('fr-FR')}` : 'aucune copie attendue')}
      ${kpi(`${lifted} / ${evSit.length}`, 'Anonymats levés', 'pour la situation en cours')}
      ${kpi(alerts.length, 'Points d’attention', alerts.filter(a => a.sev === 'bad').length + ' bloquant(s)')}
    </div>
    ${S.ui.level === 'all' ? coordCards() : ''}
    <div class="panel"><header><h3>Matrice de suivi · situation ${Sit}</h3><div class="legend"><span><i style="background:var(--surface-2)"></i>non planifiée</span><span><i style="background:var(--info-soft)"></i>planifiée</span><span><i style="background:var(--accent-soft)"></i>codes générés</span><span><i style="background:var(--warn-soft)"></i>saisie (%)</span><span><i style="background:var(--ok-soft)"></i>moyenne après levée</span></div></header>
      <div style="overflow-x:auto">${lvIds.map(lv => matrixHTML(lv, T, Sit)).join('')}</div></div>
    <div class="grid g2">
      <div class="panel"><header><h3>Prochaines épreuves</h3><button class="btn sm" data-go="planning">Planning complet</button></header>${upcomingHTML(evs)}</div>
      <div class="panel"><header><h3>Points d’attention</h3><span class="pill ${alerts.length ? 'warn' : 'ok'}">${alerts.length ? alerts.length + ' à traiter' : 'rien à signaler'}</span></header>${alertsHTML(alerts)}</div>
    </div>
    <div class="grid g2">
      <div class="panel"><header><h3>Saisie en cours</h3><button class="btn sm" data-go="saisie">${ic('scan')}Saisir</button></header>${saisieHTML(evs)}</div>
      <div class="panel"><header><h3>Moyennes par classe · situation ${Sit}</h3></header>${classMeansChart(lvIds, Sit)}</div>
    </div>`;
  $$('[data-go]', el).forEach(b => b.onclick = () => go(b.dataset.go));
  $$('[data-cell]', el).forEach(td => td.onclick = () => { const [cid, m, eid] = td.dataset.cell.split('|'); if (eid) openEvalDetail(eid); else { const c = S.classes[cid]; openEvalForm(null, { level: c.level, subj: m, sit: Sit, classes: classesOf(c.level).filter(x => x.subjects.some(s => s.m === m)).map(x => x.id) }); } });
  $$('[data-eval]', el).forEach(b => b.onclick = () => openEvalDetail(b.dataset.eval));
};
function POLES_SUMMARY(cls) { const g = cls.filter(c => c.pole === 'EG_GROUPE').length; return `${g} en groupe, ${cls.length - g} en solo`; }
function coordCards() {
  return `<div class="grid g3">${LEVELS.map(l => { const evs = evalsOf(l.id).filter(e => e.sit === curSit()); let t = 0, d = 0; evs.forEach(e => { const p = progressOf(e); t += p.total; d += p.done; }); const pct = t ? Math.round(d * 100 / t) : 0;
    return `<div class="panel"><header><h3>${l.pref}</h3><button class="btn sm" data-lvjump="${l.id}">Ouvrir</button></header><div class="stack small"><div class="row between"><span>Épreuves de la situation ${curSit()}</span><b>${evs.length}</b></div><div class="row between"><span>Codes générés</span><b>${evs.filter(e => e.placement).length}</b></div><div class="row between"><span>Copies notées</span><b>${d} / ${t}</b></div>${progressBar(pct, pct === 100 ? 'ok' : '')}<div class="row between"><span>Anonymats levés</span><b>${evs.filter(e => e.anon?.lifted).length}</b></div></div></div>`; }).join('')}</div>`;
}
document.addEventListener('click', ev => { const b = ev.target.closest('[data-lvjump]'); if (b) { S.ui.level = b.dataset.lvjump; lsSet('level', S.ui.level); render(); } });
function matrixHTML(lv, T, Sit) {
  const cls = classesOf(lv); if (!cls.length) return `<p class="muted">Aucune classe en ${levelById(lv).nom}.</p>`;
  const subs = S.subjects.filter(s => cls.some(c => c.subjects.some(x => x.m === s.code)));
  return `<table class="mx" style="margin-bottom:10px"><thead><tr><th class="cl">${levelById(lv).roman}</th>${subs.map(s => `<th title="${esc(s.nom)}">${esc(s.abbr)}</th>`).join('')}</tr></thead><tbody>${cls.map(c => `<tr><th class="cl">${esc(c.nom)}</th>${subs.map(s => {
    if (!c.subjects.some(x => x.m === s.code)) return '<td class="na"></td>';
    const st = cellState(c.id, s.code, T, Sit);
    const lab = st.s === 0 ? '·' : st.s === 1 ? `${fmtDate(st.e.date, 'short').slice(0, 5)}<small>planifiée</small>` : st.s === 2 ? `${fmtDate(st.e.date, 'short').slice(0, 5)}<small>codes</small>` : st.s === 3 ? `${st.pct} %<small>saisie</small>` : `${st.mean === null ? '—' : fmtNote(st.mean)}<small>moy.</small>`;
    return `<td class="s${st.s}" data-cell="${c.id}|${s.code}|${st.e ? st.e.id : ''}" title="${esc(c.nom)} · ${esc(s.nom)}">${lab}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
function upcomingHTML(evs) {
  const up = evs.filter(e => e.date >= todayISO()).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 8);
  if (!up.length) return '<div class="empty small">Aucune épreuve à venir. Programmez la prochaine situation depuis le planning.</div>';
  return `<div class="timeline">${up.map(e => `<div class="it"><span class="d">${fmtDate(e.date, 'dm')}<br>${e.start}–${e.end}</span><span class="row between" style="align-items:flex-start"><span><b>${esc(subjByCode(e.subj).nom)}</b> · ${levelById(e.level).roman} · T${e.trim} S${e.sit}<br><span class="small muted">${esc(evalClassNames(e))}</span></span><span class="row">${statusPill(e.status)}<button class="btn sm" data-eval="${e.id}">Ouvrir</button></span></span></div>`).join('')}</div>`;
}
function alertsHTML(alerts) {
  if (!alerts.length) return '<div class="empty small">Aucun chevauchement, aucune salle en double, aucune saisie en retard.</div>';
  return `<div class="stack" style="gap:6px;max-height:330px;overflow:auto">${alerts.slice(0, 40).map(a => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="pill ${a.sev}" style="flex:none">${a.sev === 'bad' ? 'bloquant' : a.sev === 'warn' ? 'à vérifier' : 'info'}</span><span class="small" style="flex:1">${esc(a.msg)}</span>${a.e ? `<button class="btn sm ghost" data-eval="${a.e.id}">Voir</button>` : ''}</div>`).join('')}</div>`;
}
function saisieHTML(evs) {
  const cur = evs.filter(e => e.placement && !e.anon?.lifted && ['composee', 'saisie', 'preparee'].includes(e.status) && e.date <= todayISO()).sort((a, b) => a.date.localeCompare(b.date));
  if (!cur.length) return '<div class="empty small">Aucune épreuve composée en attente de notes.</div>';
  return `<div class="stack">${cur.map(e => { const p = progressOf(e); return `<div class="stack" style="gap:5px"><div class="row between"><span><b>${esc(subjByCode(e.subj).nom)}</b> · ${levelById(e.level).roman} · ${fmtDate(e.date, 'dm')}</span><span class="small num">${p.done} / ${p.total}${p.arb ? ` · <span style="color:var(--warn)">${p.arb} arbitrage(s)</span>` : ''}</span></div>${progressBar(p.pct, p.pct === 100 ? 'ok' : '')}<div class="row small muted">Échéance ${fmtDate(e.deadline, 'short')}${e.deadline < todayISO() && p.missing ? ' · <b style="color:var(--bad)">en retard</b>' : ''}<span class="spacer"></span><button class="btn sm" data-eval="${e.id}">Détails</button></div></div>`; }).join('')}</div>`;
}
function classMeansChart(lvIds, Sit) {
  const data = [];
  lvIds.forEach(lv => classesOf(lv).forEach(c => { const vals = []; Object.values(S.evals).filter(e => e.sit === Sit && e.anon?.lifted && e.classes.includes(c.id)).forEach(e => (resultsByClass(e)[c.id] || []).forEach(r => { if (r.note !== null) vals.push(r.note); })); const st = statsOf(vals); if (st.n) data.push({ l: c.nom, v: st.mean }); }));
  if (!data.length) return '<div class="empty small">Les moyennes apparaissent après la levée d’anonymat des épreuves de la situation.</div>';
  return barChartSvg(data, { max: 20, ref: +S.settings.seuilReussite || 10, h: 200 }) + '<p class="tiny muted">Moyenne de toutes les notes désanonymisées de la classe pour la situation, toutes matières confondues, sans coefficient.</p>';
}

/* =====================================================================
   Référentiels : élèves et classes, matières et enseignants, salles
   ===================================================================== */
V.eleves = el => {
  const lvIds = levelsInScope();
  const all = lvIds.flatMap(classesOf);
  if (!all.length) { el.innerHTML = pageHead('Élèves et classes') + '<div class="panel empty"><h3>Aucune classe</h3><p>Initialisez la structure depuis l’accueil.</p></div>'; return; }
  let cid = S.ui.sel.cls; if (!cid || !all.some(c => c.id === cid)) cid = all[0].id; S.ui.sel.cls = cid;
  const c = S.classes[cid]; const list = studentsOf(c); const q = S.ui.filters.st || '';
  const shown = q ? list.filter(s => norm(fullName(s) + ' ' + s.mat).includes(norm(q))) : list;
  const gone = (c.students || []).filter(s => s.statut === 'parti');
  el.innerHTML = pageHead('Élèves et classes', 'Chargez les listes par classe ou en une fois pour tout le niveau : une colonne « Classe » dans le fichier répartit les élèves automatiquement.',
    `<button class="btn" data-act="tpl">${ic('download')}Modèle Excel</button><button class="btn primary" data-act="import">${ic('upload')}Importer des listes</button>`) + `
  <div class="grid" style="grid-template-columns:minmax(200px,260px) minmax(0,1fr);align-items:start" id="el-grid">
    <div class="panel" style="padding:8px"><div class="stack" style="gap:2px">${lvIds.map(lv => `<div class="eyebrow" style="padding:8px 8px 2px">${levelById(lv).nom}</div>${classesOf(lv).map(x => `<button class="btn ghost" style="justify-content:space-between;width:100%;${x.id === cid ? 'background:var(--accent-soft);color:var(--accent)' : ''}" data-cls="${x.id}"><span class="mono">${esc(x.nom)}</span><span class="small muted num">${studentsOf(x).length}</span></button>`).join('')}`).join('')}</div></div>
    <div class="stack" style="min-width:0">
      <div class="panel"><header><h3>${esc(c.nom)} <span class="muted small" style="font-family:var(--f-body);font-weight:500">· ${esc(POLES[c.pole] || '')} · rang ${pad(c.rang, 2)} dans le code</span></h3>
        <button class="btn sm" data-act="add">${ic('plus')}Ajouter un élève</button><button class="btn sm" data-act="export">${ic('download')}Excel</button><button class="btn sm danger" data-act="clear">${ic('trash')}Vider</button></header>
        <div class="fgrid"><label class="f">Effectif<input class="in" value="${list.length} élèves · ${list.filter(s => s.sexe === 'F').length} F / ${list.filter(s => s.sexe === 'M').length} G" disabled></label>
          <label class="f">Professeur principal<select class="in" id="tit">${teacherOpts(c.titulaire)}</select></label>
          <label class="f">Rechercher dans la classe<input class="in" id="stq" value="${esc(q)}" placeholder="Nom ou matricule"></label></div></div>
      <div class="tw"><table class="t"><thead><tr><th>N°</th><th>Matricule</th><th>Noms et prénoms</th><th class="c">Sexe</th><th>Naissance</th><th>Statut</th><th></th></tr></thead><tbody>
        ${shown.map((s, i) => `<tr><td class="num muted">${i + 1}</td><td class="mono small">${esc(s.mat)}</td><td><b>${esc(upperName(s.nom))}</b> ${esc(capName(s.prenom))}</td><td class="c">${esc(s.sexe)}</td><td class="small">${s.dn ? fmtDate(s.dn, 'short') : ''}</td><td>${s.statut === 'redoublant' ? '<span class="pill warn plain">redoublant</span>' : '<span class="pill neutral plain">nouveau</span>'}</td><td class="r"><button class="btn sm ghost" data-ed="${s.id}" aria-label="Modifier">${ic('edit')}</button><button class="btn sm ghost" data-fiche="${s.id}" aria-label="Fiche">${ic('eye')}</button></td></tr>`).join('') || `<tr><td colspan="7"><div class="empty"><h3>Liste vide</h3><p>Importez un fichier Excel ou CSV, ou ajoutez les élèves un par un.</p></div></td></tr>`}
      </tbody></table></div>
      ${gone.length ? `<p class="small muted">${gone.length} élève(s) sorti(s) de la classe conservé(s) pour l’historique.</p>` : ''}
    </div></div>`;
  if (window.innerWidth < 760) $('#el-grid', el).style.gridTemplateColumns = 'minmax(0,1fr)';
  $$('[data-cls]', el).forEach(b => b.onclick = () => { S.ui.sel.cls = b.dataset.cls; S.ui.filters.st = ''; render(); });
  $('#stq', el).oninput = debounce(ev => { S.ui.filters.st = ev.target.value; render(); setTimeout(() => { const i = $('#stq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 300);
  $('#tit', el).onchange = async ev => { c.titulaire = ev.target.value; await saveClass(c); toast('Professeur principal enregistré.', 'ok'); };
  $$('[data-ed]', el).forEach(b => b.onclick = () => studentForm(c, (c.students || []).find(s => s.id === b.dataset.ed)));
  $$('[data-fiche]', el).forEach(b => b.onclick = () => showStudent(b.dataset.fiche));
  $$('[data-act]', el).forEach(b => b.onclick = async () => {
    const a = b.dataset.act;
    if (a === 'add') studentForm(c, null);
    if (a === 'import') importStudents(c);
    if (a === 'tpl') xlsxSave('modele-import-eleves.xlsx', [{ name: 'Élèves', rows: [['Matricule', 'Nom', 'Prénoms', 'Sexe', 'Date de naissance', 'Classe', 'Statut'], ['26V0001', 'NOM', 'Prénom', 'F', '2010-03-14', c.nom, 'nouveau']], cols: [12, 22, 26, 6, 16, 10, 12] }]);
    if (a === 'export') xlsxSave(`liste-${fileSafe(c.nom)}.xlsx`, [{ name: c.nom, rows: [['N°', 'Matricule', 'Nom', 'Prénoms', 'Sexe', 'Date de naissance', 'Statut'], ...list.map((s, i) => [i + 1, s.mat, upperName(s.nom), capName(s.prenom), s.sexe, s.dn, s.statut])], cols: [5, 12, 22, 26, 6, 14, 12] }]);
    if (a === 'clear') { if (!(await requireCoord('Vider la liste d’une classe.'))) return; if (await confirmBox('Vider la classe', `Supprimer les ${list.length} élèves de ${esc(c.nom)} ? Les épreuves déjà réparties gardent leur table de correspondance.`, 'Vider la classe', true)) { c.students = []; await saveClass(c); audit('Élèves', `Classe ${c.nom} vidée`); render(); } }
  });
};
function studentForm(c, s) {
  const isNew = !s; s = s || { id: uid('s'), mat: '', nom: '', prenom: '', sexe: 'F', dn: '', statut: 'nouveau' };
  const lvCls = Object.values(S.classes).sort((a, b) => (a.level + pad(a.rang, 2)).localeCompare(b.level + pad(b.rang, 2)));
  openModal({ title: isNew ? `Nouvel élève · ${c.nom}` : fullName(s), body: `<div class="fgrid">
    <label class="f">Matricule<input class="in mono" id="f-mat" value="${esc(s.mat)}"></label>
    <label class="f">Nom<input class="in" id="f-nom" value="${esc(s.nom)}"></label>
    <label class="f">Prénoms<input class="in" id="f-pre" value="${esc(s.prenom)}"></label>
    <label class="f">Sexe<select class="in" id="f-sx">${optList([['F', 'Féminin'], ['M', 'Masculin']], s.sexe)}</select></label>
    <label class="f">Date de naissance<input class="in" type="date" id="f-dn" value="${esc(s.dn)}"></label>
    <label class="f">Statut<select class="in" id="f-st">${optList([['nouveau', 'Nouveau'], ['redoublant', 'Redoublant'], ['parti', 'Sorti de la classe']], s.statut)}</select></label>
    <label class="f">Classe<select class="in" id="f-cl">${optList(lvCls.map(x => [x.id, `${levelById(x.level).roman} · ${x.nom}`]), c.id)}</select></label></div>`,
    actions: [...(isNew ? [] : [{ label: `${ic('trash')}Supprimer`, cls: 'danger', onClick: async close => { if (!(await requireCoord('Supprimer un élève.'))) return false; c.students = c.students.filter(x => x.id !== s.id); await saveClass(c); audit('Élèves', `Suppression de ${fullName(s)} (${c.nom})`); close(); render(); } }]),
      { label: 'Annuler' }, { label: 'Enregistrer', cls: 'primary', onClick: async (close, m) => {
        const v = id => $(id, m).value.trim();
        if (!v('#f-nom')) { toast('Le nom est obligatoire.', 'bad'); return false; }
        Object.assign(s, { mat: v('#f-mat'), nom: upperName(v('#f-nom')), prenom: capName(v('#f-pre')), sexe: v('#f-sx'), dn: v('#f-dn'), statut: v('#f-st') });
        const dest = S.classes[v('#f-cl')];
        if (dest.id !== c.id) { c.students = (c.students || []).filter(x => x.id !== s.id); dest.students = [...(dest.students || []), s]; await saveClass(c); await saveClass(dest); audit('Élèves', `${fullName(s)} transféré de ${c.nom} vers ${dest.nom}`); }
        else { if (isNew) c.students = [...(c.students || []), s]; await saveClass(c); audit('Élèves', `${isNew ? 'Ajout' : 'Modification'} : ${fullName(s)} (${c.nom})`); }
        close(); render(); } }] });
}
function importStudents(c) {
  let parsed = null;
  const md = openModal({ title: 'Importer des listes d’élèves', wide: true, body: `
    <p class="small muted">Formats acceptés : .xlsx, .xls, .csv. Colonnes reconnues : Matricule, Nom, Prénoms, Sexe, Date de naissance, Classe, Statut. Sans colonne « Classe », tout va dans <b>${esc(c.nom)}</b>. Une colonne unique « Noms et prénoms » est aussi acceptée.</p>
    <input type="file" class="in" id="imp-file" accept=".xlsx,.xls,.csv,.ods">
    <div class="row"><label class="check"><input type="radio" name="imp-mode" value="add" checked> Ajouter aux listes existantes</label><label class="check"><input type="radio" name="imp-mode" value="replace"> Remplacer les listes des classes concernées</label></div>
    <div id="imp-prev"></div>`,
    actions: [{ label: 'Annuler' }, { label: `${ic('upload')}Importer`, cls: 'primary', onClick: async (close, m) => {
      if (!parsed || !parsed.ok.length) { toast('Aucune ligne valide à importer.', 'bad'); return false; }
      const mode = $('input[name=imp-mode]:checked', m).value; const touched = new Set();
      await withBusy('Import en cours…', async () => {
        for (const r of parsed.ok) { const cl = S.classes[r.cid]; if (mode === 'replace' && !touched.has(cl.id)) { cl.students = []; } touched.add(cl.id);
          const dup = (cl.students || []).find(x => (r.mat && x.mat === r.mat) || (norm(fullName(x)) === norm(fullName(r)) && (x.dn || '') === (r.dn || '')));
          if (dup) Object.assign(dup, { ...r, id: dup.id, cid: undefined }); else cl.students = [...(cl.students || []), { id: uid('s'), mat: r.mat, nom: r.nom, prenom: r.prenom, sexe: r.sexe, dn: r.dn, statut: r.statut }];
          (cl.students || []).forEach(x => delete x.cid); }
        for (const id of touched) await saveClass(S.classes[id]);
        audit('Import élèves', `${parsed.ok.length} ligne(s) dans ${[...touched].map(id => S.classes[id].nom).join(', ')} (${mode === 'replace' ? 'remplacement' : 'ajout'})`);
      });
      toast(`${parsed.ok.length} élève(s) importé(s).`, 'ok'); close(); render(); } }] });
  $('#imp-file', md.el).onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const { rows } = await readSheet(f); const ok = [], bad = [];
      const clsByName = {}; Object.values(S.classes).forEach(x => clsByName[norm(x.nom).replace(/\s/g, '')] = x);
      rows.forEach((row, i) => {
        let nom = pickCol(row, ['nom', 'noms', 'name']); let prenom = pickCol(row, ['prenom', 'prenoms', 'prenomss', 'firstname']);
        const full = pickCol(row, ['nomsetprenoms', 'nometprenoms', 'nomprenoms', 'nomcomplet', 'eleve']);
        if (!nom && full) { const parts = full.trim().split(/\s+/); const up = parts.filter(p => p === p.toUpperCase() && /\p{L}/u.test(p)); if (up.length && up.length < parts.length) { nom = up.join(' '); prenom = parts.filter(p => !up.includes(p)).join(' '); } else { nom = parts[0]; prenom = parts.slice(1).join(' '); } }
        if (!nom) { if (Object.values(row).some(v => String(v).trim())) bad.push(`Ligne ${i + 2} : nom manquant`); return; }
        const cname = pickCol(row, ['classe', 'class', 'division']);
        let cl = c; if (cname) { cl = clsByName[norm(cname).replace(/\s/g, '')]; if (!cl) { bad.push(`Ligne ${i + 2} : classe « ${cname} » inconnue`); return; } }
        let sx = pickCol(row, ['sexe', 'genre', 's']).toUpperCase(); sx = sx.startsWith('F') ? 'F' : (sx.startsWith('M') || sx.startsWith('G') ? 'M' : '');
        let dn = pickCol(row, ['datedenaissance', 'naissance', 'datenaissance', 'ne', 'nele', 'dn']);
        const mDn = dn.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if (mDn) dn = `${mDn[3].length === 2 ? '20' + mDn[3] : mDn[3]}-${pad(mDn[2], 2)}-${pad(mDn[1], 2)}`; else if (!/^\d{4}-\d{2}-\d{2}/.test(dn)) dn = ''; else dn = dn.slice(0, 10);
        const statut = /redoubl/i.test(pickCol(row, ['statut', 'redoublant', 'status'])) ? 'redoublant' : 'nouveau';
        ok.push({ cid: cl.id, mat: pickCol(row, ['matricule', 'mat', 'numero', 'id']), nom: upperName(nom), prenom: capName(prenom), sexe: sx, dn, statut });
      });
      parsed = { ok, bad };
      const by = {}; ok.forEach(r => by[r.cid] = (by[r.cid] || 0) + 1);
      $('#imp-prev', md.el).innerHTML = `<div class="callout ${bad.length ? 'warn' : 'ok'}">${ok.length} ligne(s) valide(s) réparties ainsi : ${Object.entries(by).map(([k, n]) => `<b>${esc(S.classes[k].nom)}</b> ${n}`).join(' · ') || '—'}${bad.length ? `<br>${bad.length} ligne(s) écartée(s) : ${esc(bad.slice(0, 6).join(' ; '))}${bad.length > 6 ? '…' : ''}` : ''}</div>
        <div class="tw" style="max-height:260px;overflow:auto"><table class="t"><thead><tr><th>Classe</th><th>Matricule</th><th>Nom</th><th>Prénoms</th><th>S</th><th>Naissance</th></tr></thead><tbody>${ok.slice(0, 40).map(r => `<tr><td class="mono">${esc(S.classes[r.cid].nom)}</td><td class="mono small">${esc(r.mat)}</td><td>${esc(r.nom)}</td><td>${esc(r.prenom)}</td><td>${esc(r.sexe)}</td><td class="small">${esc(r.dn)}</td></tr>`).join('')}</tbody></table></div>`;
    } catch (e) { $('#imp-prev', md.el).innerHTML = `<div class="callout bad">${esc(e.message)}</div>`; }
  };
}

/* ---------- Matières et enseignants ---------- */
V.matieres = el => {
  const tab = S.ui.sel.mtab || 'programme';
  el.innerHTML = pageHead('Matières et enseignants', 'Programme de chaque classe, coefficients et enseignant responsable. Le code à deux chiffres de chaque matière est inscrit dans le code-barres.') +
    `<div class="tabs">${[['programme', 'Programme des classes'], ['vue', 'Vue d’ensemble'], ['enseignants', 'Enseignants'], ['catalogue', 'Catalogue des matières']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="mt-body" class="stack"></div>`;
  $$('[data-tab]', el).forEach(b => b.onclick = () => { S.ui.sel.mtab = b.dataset.tab; render(); });
  const body = $('#mt-body', el);
  ({ programme: tabProgramme, vue: tabVue, enseignants: tabEnseignants, catalogue: tabCatalogue })[tab](body);
};
function tabProgramme(body) {
  const lvIds = levelsInScope(); const all = lvIds.flatMap(classesOf); if (!all.length) { body.innerHTML = '<div class="empty">Aucune classe.</div>'; return; }
  let cid = S.ui.sel.pcls; if (!all.some(c => c.id === cid)) cid = all[0].id; S.ui.sel.pcls = cid; const c = S.classes[cid];
  body.innerHTML = `<div class="panel"><header><label class="f" style="flex-direction:row;align-items:center;gap:8px">Classe <select class="in" id="pc" style="width:auto">${optList(all.map(x => [x.id, `${levelById(x.level).roman} · ${x.nom}`]), cid)}</select></label><span class="spacer"></span>
    <button class="btn sm" data-act="copy">Appliquer ce programme à tout le pôle</button><button class="btn sm primary" data-act="save">${ic('check')}Enregistrer</button></header>
    <div class="tw"><table class="t"><thead><tr><th class="c">Au programme</th><th>Code</th><th>Matière</th><th class="c">Coef.</th><th>Enseignant</th></tr></thead><tbody>${S.subjects.map(s => { const a = c.subjects.find(x => x.m === s.code); return `<tr data-m="${s.code}"><td class="c"><input type="checkbox" class="pm" ${a ? 'checked' : ''} aria-label="${esc(s.nom)}"></td><td class="mono">${s.code}</td><td><b>${esc(s.abbr)}</b> · ${esc(s.nom)}</td><td class="c"><input class="in pcoef num" type="number" min="0" max="10" step="0.5" value="${a ? a.coef : 2}" style="width:70px"></td><td><select class="in pprof">${teacherOpts(a?.prof)}</select></td></tr>`; }).join('')}</tbody></table></div></div>`;
  $('#pc', body).onchange = ev => { S.ui.sel.pcls = ev.target.value; render(); };
  const collect = () => $$('tr[data-m]', body).filter(tr => $('.pm', tr).checked).map(tr => ({ m: tr.dataset.m, coef: +$('.pcoef', tr).value || 0, prof: $('.pprof', tr).value }));
  $('[data-act=save]', body).onclick = async () => { c.subjects = collect(); await saveClass(c); audit('Programme', `${c.nom} : ${c.subjects.length} matières`); toast('Programme enregistré.', 'ok'); };
  $('[data-act=copy]', body).onclick = async () => { const same = Object.values(S.classes).filter(x => x.level === c.level && x.pole === c.pole && x.id !== c.id); if (!(await confirmBox('Appliquer au pôle', `Copier la liste des matières et les coefficients de ${esc(c.nom)} vers ${same.map(x => esc(x.nom)).join(', ') || 'aucune autre classe'} ? Les enseignants déjà attribués sont conservés.`))) return; const src = collect(); c.subjects = src; await saveClass(c); for (const x of same) { x.subjects = src.map(s => ({ ...s, prof: x.subjects.find(y => y.m === s.m)?.prof || '' })); await saveClass(x); } audit('Programme', `Programme de ${c.nom} appliqué à ${same.length} classe(s)`); toast('Programme appliqué.', 'ok'); };
}
function tabVue(body) {
  const lvIds = levelsInScope();
  body.innerHTML = lvIds.map(lv => { const cls = classesOf(lv); const subs = S.subjects.filter(s => cls.some(c => c.subjects.some(x => x.m === s.code)));
    return `<div class="panel"><header><h3>${levelById(lv).nom}</h3><span class="small muted">enseignant et coefficient par classe</span></header><div class="tw"><table class="t"><thead><tr><th>Matière</th>${cls.map(c => `<th class="c mono">${esc(c.nom)}</th>`).join('')}</tr></thead><tbody>${subs.map(s => `<tr><td><b>${esc(s.abbr)}</b></td>${cls.map(c => { const a = c.subjects.find(x => x.m === s.code); return `<td class="c small">${a ? `${a.prof ? esc(teacherById(a.prof)?.nom || '?') : '<span style="color:var(--warn)">à pourvoir</span>'}<br><span class="muted">coef. ${a.coef}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></div>`; }).join('');
}
function tabEnseignants(body) {
  const load = {}; Object.values(S.classes).forEach(c => c.subjects.forEach(s => { if (s.prof) { (load[s.prof] = load[s.prof] || []).push(`${subjByCode(s.m).abbr} ${c.nom}`); } }));
  body.innerHTML = `<div class="panel"><header><h3>${S.teachers.length} enseignant(s)</h3><button class="btn sm" data-act="tpl">${ic('download')}Modèle</button><button class="btn sm" data-act="imp">${ic('upload')}Importer</button><button class="btn sm primary" data-act="add">${ic('plus')}Ajouter</button></header>
    <div class="tw"><table class="t"><thead><tr><th>Enseignant</th><th>Téléphone</th><th>Classes et matières</th><th></th></tr></thead><tbody>${S.teachers.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map(t => `<tr><td><b>${esc(teacherName(t.id))}</b></td><td class="mono small">${esc(t.tel || '')}</td><td class="small">${esc((load[t.id] || []).join(', ')) || '<span class="muted">aucune attribution</span>'}</td><td class="r"><button class="btn sm ghost" data-ed="${t.id}">${ic('edit')}</button></td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">Aucun enseignant enregistré. Ajoutez-les ou importez un fichier (Civilité, Nom, Prénoms, Téléphone).</div></td></tr>'}</tbody></table></div></div>`;
  const form = t => { const isNew = !t; t = t || { id: uid('p'), civ: 'M.', nom: '', prenom: '', tel: '' };
    openModal({ title: isNew ? 'Nouvel enseignant' : teacherName(t.id), body: `<div class="fgrid"><label class="f">Civilité<select class="in" id="t-civ">${optList([['M.', 'M.'], ['Mme', 'Mme'], ['Mlle', 'Mlle'], ['Abbé', 'Abbé'], ['Sr', 'Sœur'], ['Fr', 'Frère'], ['Dr', 'Dr']], t.civ)}</select></label><label class="f">Nom<input class="in" id="t-nom" value="${esc(t.nom)}"></label><label class="f">Prénoms<input class="in" id="t-pre" value="${esc(t.prenom)}"></label><label class="f">Téléphone<input class="in" id="t-tel" value="${esc(t.tel || '')}"></label></div>`,
      actions: [...(isNew ? [] : [{ label: 'Supprimer', cls: 'danger', onClick: async close => { if (load[t.id]?.length && !(await confirmBox('Enseignant attribué', `${esc(teacherName(t.id))} est attribué à ${load[t.id].length} classe(s). Les attributions seront vidées.`, 'Supprimer', true))) return false; S.teachers = S.teachers.filter(x => x.id !== t.id); for (const c of Object.values(S.classes)) { let ch = false; c.subjects.forEach(s => { if (s.prof === t.id) { s.prof = ''; ch = true; } }); if (c.titulaire === t.id) { c.titulaire = ''; ch = true; } if (ch) await saveClass(c); } await saveTeachers(); close(); render(); } }]),
        { label: 'Annuler' }, { label: 'Enregistrer', cls: 'primary', onClick: async (close, m) => { t.civ = $('#t-civ', m).value; t.nom = upperName($('#t-nom', m).value); t.prenom = capName($('#t-pre', m).value); t.tel = $('#t-tel', m).value.trim(); if (!t.nom) { toast('Nom obligatoire.', 'bad'); return false; } if (isNew) S.teachers.push(t); await saveTeachers(); audit('Enseignants', (isNew ? 'Ajout ' : 'Modification ') + teacherName(t.id)); close(); render(); } }] }); };
  $('[data-act=add]', body).onclick = () => form(null);
  $$('[data-ed]', body).forEach(b => b.onclick = () => form(teacherById(b.dataset.ed)));
  $('[data-act=tpl]', body).onclick = () => xlsxSave('modele-enseignants.xlsx', [{ name: 'Enseignants', rows: [['Civilité', 'Nom', 'Prénoms', 'Téléphone'], ['M.', 'NOM', 'Prénom', '6XXXXXXXX']], cols: [10, 22, 24, 14] }]);
  $('[data-act=imp]', body).onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv,.ods'; inp.onchange = async () => { try { const { rows } = await readSheet(inp.files[0]); let n = 0; rows.forEach(r => { const nom = upperName(pickCol(r, ['nom', 'noms'])); if (!nom) return; const prenom = capName(pickCol(r, ['prenom', 'prenoms'])); if (S.teachers.some(t => t.nom === nom && norm(t.prenom) === norm(prenom))) return; S.teachers.push({ id: uid('p'), civ: pickCol(r, ['civilite', 'civ', 'titre']) || 'M.', nom, prenom, tel: pickCol(r, ['telephone', 'tel', 'contact']) }); n++; }); await saveTeachers(); audit('Enseignants', `Import de ${n} enseignant(s)`); toast(`${n} enseignant(s) ajouté(s).`, 'ok'); render(); } catch (e) { toast(e.message, 'bad'); } }; inp.click(); };
}
function tabCatalogue(body) {
  const used = new Set(Object.values(S.classes).flatMap(c => c.subjects.map(s => s.m)));
  body.innerHTML = `<div class="callout">Le code à deux chiffres entre dans chaque code-barres. Ne le modifiez pas en cours d’année pour une matière déjà évaluée.</div>
  <div class="panel"><header><h3>${S.subjects.length} matières</h3><button class="btn sm" data-act="add">${ic('plus')}Ajouter</button><button class="btn sm primary" data-act="save">${ic('check')}Enregistrer</button></header>
  <div class="tw"><table class="t"><thead><tr><th>Code</th><th>Abréviation</th><th>Intitulé</th><th>Utilisation</th><th></th></tr></thead><tbody>${S.subjects.map((s, i) => `<tr data-i="${i}"><td><input class="in mono sc" value="${esc(s.code)}" maxlength="2" style="width:60px"></td><td><input class="in sa" value="${esc(s.abbr)}" style="width:110px"></td><td><input class="in sn" value="${esc(s.nom)}"></td><td class="small">${used.has(s.code) ? '<span class="pill ok plain">au programme</span>' : '<span class="muted">non utilisée</span>'}</td><td class="r">${used.has(s.code) ? '' : `<button class="btn sm ghost" data-del="${i}" aria-label="Supprimer">${ic('trash')}</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('[data-act=add]', body).onclick = () => { const codes = S.subjects.map(s => +s.code); let n = 1; while (codes.includes(n)) n++; S.subjects.push({ code: pad(n, 2), abbr: 'NOUV', nom: 'Nouvelle matière' }); render(); };
  $$('[data-del]', body).forEach(b => b.onclick = async () => { S.subjects.splice(+b.dataset.del, 1); await saveSubjects(); render(); });
  $('[data-act=save]', body).onclick = async () => {
    const next = $$('tr[data-i]', body).map(tr => ({ code: pad(($('.sc', tr).value || '').replace(/\D/g, ''), 2), abbr: $('.sa', tr).value.trim().toUpperCase(), nom: $('.sn', tr).value.trim() }));
    const dup = next.map(s => s.code).filter((c, i, a) => a.indexOf(c) !== i);
    if (dup.length || next.some(s => s.code === '00' || !s.abbr)) { toast('Codes en double, nuls ou abréviation vide : corrigez avant d’enregistrer.', 'bad'); return; }
    S.subjects = next.sort((a, b) => a.code.localeCompare(b.code)); await saveSubjects(); audit('Catalogue', 'Catalogue des matières modifié'); toast('Catalogue enregistré.', 'ok'); render(); };
}

/* ---------- Salles ---------- */
V.salles = el => {
  const cap = S.rooms.reduce((a, r) => a + (+r.capacite || 0), 0);
  const upcoming = Object.values(S.evals).filter(e => e.placement && e.date >= addDays(todayISO(), -1)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 30);
  el.innerHTML = pageHead('Salles de composition', 'Les salles servent à répartir les élèves et à numéroter les tables. Elles sont communes aux trois préfectures ; l’application signale une salle réservée deux fois sur le même créneau.',
    `<button class="btn" data-act="imp">${ic('upload')}Importer</button><button class="btn primary" data-act="add">${ic('plus')}Ajouter une salle</button>`) + `
    <div class="grid g4">${kpi(S.rooms.length, 'Salles')}${kpi(cap.toLocaleString('fr-FR'), 'Places au total')}${LEVELS.map(l => { const n = classesOf(l.id).reduce((a, c) => a + studentsOf(c).length, 0); return kpi(n, `Élèves de ${l.nom}`, n > cap ? '<span style="color:var(--bad)">capacité insuffisante pour une épreuve commune</span>' : `${cap ? Math.round(n * 100 / cap) : 0} % de la capacité`); }).join('')}</div>
    <div class="grid g2"><div class="tw"><table class="t"><thead><tr><th>Salle</th><th>Bâtiment</th><th class="r">Capacité</th><th></th></tr></thead><tbody>${S.rooms.map(r => `<tr><td><b>${esc(r.nom)}</b></td><td>${esc(r.batiment || '')}</td><td class="r num">${r.capacite}</td><td class="r"><button class="btn sm ghost" data-ed="${r.id}">${ic('edit')}</button></td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">Aucune salle. Ajoutez les salles de composition avec leur nombre de places.</div></td></tr>'}</tbody></table></div>
    <div class="panel"><header><h3>Occupation à venir</h3></header>${upcoming.length ? `<div class="timeline">${upcoming.map(e => `<div class="it"><span class="d">${fmtDate(e.date, 'dm')}<br>${e.start}–${e.end}</span><span><b>${esc(subjByCode(e.subj).abbr)}</b> ${levelById(e.level).roman} · <span class="small">${e.placement.rooms.map(r => esc(r.nom)).join(', ')}</span></span></div>`).join('')}</div>` : '<p class="muted small">Aucune salle réservée.</p>'}</div></div>`;
  const form = r => { const isNew = !r; r = r || { id: uid('r'), nom: '', capacite: 40, batiment: '' };
    openModal({ title: isNew ? 'Nouvelle salle' : r.nom, body: `<div class="fgrid"><label class="f">Nom<input class="in" id="r-n" value="${esc(r.nom)}" placeholder="Salle B4"></label><label class="f">Capacité (places assises)<input class="in num" type="number" min="1" id="r-c" value="${r.capacite}"></label><label class="f">Bâtiment<input class="in" id="r-b" value="${esc(r.batiment || '')}"></label></div>`,
      actions: [...(isNew ? [] : [{ label: 'Supprimer', cls: 'danger', onClick: async close => { S.rooms = S.rooms.filter(x => x.id !== r.id); await saveRooms(); close(); render(); } }]), { label: 'Annuler' }, { label: 'Enregistrer', cls: 'primary', onClick: async (close, m) => { r.nom = $('#r-n', m).value.trim(); r.capacite = +$('#r-c', m).value || 0; r.batiment = $('#r-b', m).value.trim(); if (!r.nom || !r.capacite) { toast('Nom et capacité obligatoires.', 'bad'); return false; } if (isNew) S.rooms.push(r); S.rooms.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true })); await saveRooms(); audit('Salles', (isNew ? 'Ajout ' : 'Modification ') + r.nom); close(); render(); } }] }); };
  $('[data-act=add]', el).onclick = () => form(null);
  $$('[data-ed]', el).forEach(b => b.onclick = () => form(roomById(b.dataset.ed)));
  $('[data-act=imp]', el).onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv,.ods'; inp.onchange = async () => { try { const { rows } = await readSheet(inp.files[0]); let n = 0; rows.forEach(x => { const nom = pickCol(x, ['salle', 'nom']); const cap = +pickCol(x, ['capacite', 'places']); if (!nom || !cap || S.rooms.some(r => norm(r.nom) === norm(nom))) return; S.rooms.push({ id: uid('r'), nom, capacite: cap, batiment: pickCol(x, ['batiment', 'bloc']) }); n++; }); await saveRooms(); toast(`${n} salle(s) ajoutée(s).`, 'ok'); render(); } catch (e) { toast(e.message, 'bad'); } }; inp.click(); };
};

/* =====================================================================
   Planning des évaluations : liste, calendrier, programmation, import
   ===================================================================== */
V.planning = el => {
  const lvIds = levelsInScope(); const pv = S.ui.sel.pview || 'liste'; const fs = S.ui.sel.psit ?? curSit();
  let evs = Object.values(S.evals).filter(e => lvIds.includes(e.level) && (!fs || e.sit === +fs));
  evs = sortEvals(evs);
  el.innerHTML = pageHead('Planning des évaluations', 'Chaque évaluation fixe le trimestre, la situation, la matière, les classes, la date et le créneau. Les chevauchements de classes et de salles sont contrôlés.',
    `<button class="btn" data-act="tpl">${ic('download')}Modèle</button><button class="btn" data-act="imp">${ic('upload')}Importer</button><button class="btn" data-act="wiz">${ic('cal')}Programmer une situation</button><button class="btn primary" data-act="new">${ic('plus')}Nouvelle évaluation</button>`) + `
    <div class="row"><div class="lvl tabs" style="border:0">${[['liste', 'Liste'], ['cal', 'Calendrier']].map(([k, l]) => `<button data-pv="${k}" class="${pv === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="spacer"></span>
      <label class="f" style="flex-direction:row;align-items:center;gap:6px">Situation<select class="in" id="psit" style="width:auto"><option value="0" ${!+fs ? 'selected' : ''}>Toutes</option>${sitOpts(fs)}</select></label>
      <button class="btn" data-act="pdf">${ic('print')}Planning PDF</button></div>
    <div id="pl-body"></div>`;
  const body = $('#pl-body', el);
  if (pv === 'cal') body.innerHTML = calendarHTML(evs);
  else if (!evs.length) body.innerHTML = `<div class="panel empty"><h3>Aucune évaluation pour ce filtre</h3><p>Programmez toute une situation en une fois, importez un planning Excel ou créez une évaluation.</p><button class="btn primary" data-act="wiz">${ic('cal')}Programmer la situation ${fs || curSit()}</button></div>`;
  else {
    const byDate = {}; evs.forEach(e => (byDate[e.date] = byDate[e.date] || []).push(e));
    body.innerHTML = Object.entries(byDate).map(([d, list]) => `<div class="stack" style="gap:6px;margin-bottom:14px"><h3 class="cap">${fmtDate(d)}</h3><div class="tw"><table class="t"><thead><tr><th>Créneau</th><th>Durée</th><th>Niveau</th><th>T / S</th><th>Matière</th><th>Classes</th><th class="r">Élèves</th><th>Salles</th><th>Statut</th><th></th></tr></thead><tbody>${list.map(e => `<tr><td class="mono small">${e.start} – ${e.end}</td><td class="small">${duree(e.start, e.end)}</td><td>${levelById(e.level).roman}</td><td class="small">T${e.trim} S${e.sit}</td><td><b>${esc(subjByCode(e.subj).nom)}</b></td><td class="small">${esc(evalClassNames(e))}</td><td class="r num">${e.placement ? e.placement.list.length : candidatesOf(e).length}</td><td class="small">${e.placement ? e.placement.rooms.map(r => esc(r.nom)).join(', ') : '<span class="muted">non réparti</span>'}</td><td>${statusPill(e.status)}</td><td class="r"><button class="btn sm" data-eval="${e.id}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div></div>`).join('');
  }
  $$('[data-pv]', el).forEach(b => b.onclick = () => { S.ui.sel.pview = b.dataset.pv; render(); });
  $('#psit', el).onchange = ev => { S.ui.sel.psit = +ev.target.value; render(); };
  $$('[data-eval]', el).forEach(b => b.onclick = () => openEvalDetail(b.dataset.eval));
  $$('[data-mo]', el).forEach(b => b.onclick = () => { S.ui.sel.month = b.dataset.mo; render(); });
  $$('[data-act]', el).forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'new') openEvalForm(null, { sit: fs || curSit() });
    if (a === 'wiz') situationWizard(+fs || curSit());
    if (a === 'imp') importPlanning();
    if (a === 'tpl') xlsxSave('modele-planning.xlsx', [{ name: 'Planning', rows: [['Niveau', 'Situation', 'Matière', 'Classes', 'Date', 'Début', 'Fin'], ['Seconde', 2, 'MATH', 'Toutes', '2026-11-09', '07:30', '09:30'], ['Première', 2, 'FRAN', 'PC1, PC2, PD1', '2026-11-09', '10:00', '12:00']], cols: [12, 10, 12, 26, 12, 8, 8] }]);
    if (a === 'pdf') runPdf(`planning-${fileSafe(scopeLabel())}.pdf`, 'Planning des évaluations', doc => addPlanning(doc, lvIds, { sit: +fs || null }), 'l');
  });
};
function calendarHTML(evs) {
  const ref = S.ui.sel.month || (evs[0]?.date || todayISO()).slice(0, 7);
  const [y, m] = ref.split('-').map(Number); const first = new Date(y, m - 1, 1); const startDow = (first.getDay() + 6) % 7;
  const prev = `${m === 1 ? y - 1 : y}-${pad(m === 1 ? 12 : m - 1, 2)}`, next = `${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1, 2)}`;
  const cells = []; for (let i = 0; i < 42; i++) { const d = new Date(y, m - 1, 1 - startDow + i); cells.push(`${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`); }
  const all = Object.values(S.evals).filter(e => levelsInScope().includes(e.level));
  return `<div class="panel"><header><button class="btn sm" data-mo="${prev}">‹</button><h3 class="cap" style="text-align:center">${first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3><button class="btn sm" data-mo="${next}">›</button></header><div style="overflow-x:auto"><div class="cal" style="min-width:640px">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => `<div class="h">${d}</div>`).join('')}${cells.map(d => { const list = all.filter(e => e.date === d).sort((a, b) => a.start.localeCompare(b.start)); return `<div class="d ${d.slice(0, 7) !== ref ? 'out' : ''} ${d === todayISO() ? 'today' : ''}"><span class="n">${+d.slice(8)}</span>${list.slice(0, 5).map(e => `<span class="ev" data-eval="${e.id}" title="${esc(evalLabel(e))} · ${esc(evalClassNames(e))}">${e.start} ${esc(subjByCode(e.subj).abbr)} ${levelById(e.level).roman}</span>`).join('')}${list.length > 5 ? `<span class="muted">+${list.length - 5}</span>` : ''}</div>`; }).join('')}</div></div></div>`;
}
function openEvalForm(e, preset = {}) {
  const isNew = !e; const lv0 = e?.level || preset.level || (S.ui.level !== 'all' ? S.ui.level : LEVELS[0].id);
  const d = e || { level: lv0, subj: preset.subj || '', sit: preset.sit || curSit(), date: preset.date || todayISO(), start: '07:30', end: '09:30', classes: preset.classes || [], bareme: 20, double: false, consignes: '', deadline: '' };
  const hasMarks = e && Object.keys(e.marks || {}).length > 0;
  const md = openModal({ title: isNew ? 'Nouvelle évaluation' : `Modifier · ${evalLabel(e)}`, wide: true, body: `
    ${hasMarks ? '<div class="callout warn">Des notes sont déjà saisies : la matière, la situation et les classes sont verrouillées.</div>' : ''}
    <div class="fgrid">
      <label class="f">Niveau<select class="in" id="e-lv" ${e ? 'disabled' : ''}>${levelOpts(d.level)}</select></label>
      <label class="f">Situation<select class="in" id="e-sit" ${hasMarks ? 'disabled' : ''}>${sitOpts(d.sit)}</select></label>
      <label class="f">Matière<select class="in" id="e-subj" ${hasMarks ? 'disabled' : ''}></select></label>
      <label class="f">Date<input class="in" type="date" id="e-date" value="${d.date}"></label>
      <label class="f">Début<input class="in" type="time" id="e-start" value="${d.start}"></label>
      <label class="f">Fin<input class="in" type="time" id="e-end" value="${d.end}"></label>
      <label class="f">Barème<select class="in" id="e-bar">${optList([[20, 'Sur 20'], [10, 'Sur 10'], [40, 'Sur 40'], [100, 'Sur 100']], d.bareme)}</select></label>
      <label class="f">Échéance de saisie<input class="in" type="date" id="e-dl" value="${d.deadline || ''}"></label>
    </div>
    <label class="check"><input type="checkbox" id="e-dbl" ${d.double ? 'checked' : ''}> Double correction (deux notes par copie, arbitrage si l’écart atteint ${S.settings.ecartDouble} points)</label>
    <div><div class="row between"><b>Classes concernées</b><span class="row"><button class="btn sm" data-all>Toutes celles qui ont la matière</button><button class="btn sm ghost" data-none>Aucune</button></span></div><div id="e-cls" class="row" style="margin-top:8px"></div></div>
    <label class="f">Consignes pour les surveillants<textarea class="in" id="e-cons" placeholder="Documents autorisés, calculatrice, papier fourni…">${esc(d.consignes || '')}</textarea></label>
    <p class="small muted" id="e-warn"></p>`,
    actions: [{ label: 'Annuler' }, { label: isNew ? 'Créer l’évaluation' : 'Enregistrer', cls: 'primary', onClick: async (close, m) => {
      const lv = $('#e-lv', m).value, subj = $('#e-subj', m).value, sit = +$('#e-sit', m).value;
      const classes = $$('#e-cls input:checked', m).map(i => i.value);
      const date = $('#e-date', m).value, start = $('#e-start', m).value, end = $('#e-end', m).value;
      if (!subj || !classes.length || !date || !start || !end) { toast('Matière, classes, date et créneau sont obligatoires.', 'bad'); return false; }
      if (minutes(end) <= minutes(start)) { toast('L’heure de fin doit suivre l’heure de début.', 'bad'); return false; }
      const probe = { id: e?.id || '_new', date, start, end, classes };
      const clash = Object.values(S.evals).filter(o => o.id !== probe.id && overlap(o, probe) && o.classes.some(c => classes.includes(c)));
      if (clash.length) { toast(`Conflit : ${clash.map(o => evalShort(o) + ' (' + o.start + ')').join(', ')} occupe déjà une de ces classes.`, 'bad'); return false; }
      if (isNew) { const ne = newEval({ level: lv, subj, trim: trimOfSit(sit), sit, date, start, end, classes, bareme: $('#e-bar', m).value, double: $('#e-dbl', m).checked, consignes: $('#e-cons', m).value }); if ($('#e-dl', m).value) ne.deadline = $('#e-dl', m).value; S.evals[ne.id] = ne; await saveEval(ne); audit('Planning', `Création ${evalShort(ne)} ${levelById(lv).roman} le ${date}`, lv); }
      else {
        const changedCls = classes.join() !== e.classes.join();
        if (!hasMarks) { e.subj = subj; e.sit = sit; e.trim = trimOfSit(sit); if (changedCls && e.placement) { e.placement = null; e.status = 'planifiee'; toast('Classes modifiées : la répartition et les codes doivent être regénérés.'); } e.classes = classes; }
        Object.assign(e, { date, start, end, bareme: +$('#e-bar', m).value, double: $('#e-dbl', m).checked, consignes: $('#e-cons', m).value, deadline: $('#e-dl', m).value || addDays(date, +S.settings.delaiSaisie || 7) });
        await saveEval(e); audit('Planning', `Modification ${evalShort(e)} ${levelById(e.level).roman}`, e.level);
      }
      close(); render(); } }] });
  const m = md.el;
  const fillSubj = () => { const lv = $('#e-lv', m).value; const cls = classesOf(lv); const subs = S.subjects.filter(s => cls.some(c => c.subjects.some(x => x.m === s.code))); $('#e-subj', m).innerHTML = '<option value="">— choisir —</option>' + subjOpts(d.subj, subs); };
  const fillCls = (auto) => { const lv = $('#e-lv', m).value; const subj = $('#e-subj', m).value; const cur = auto ? null : new Set($$('#e-cls input:checked', m).map(i => i.value)); $('#e-cls', m).innerHTML = classesOf(lv).map(c => { const has = c.subjects.some(x => x.m === subj); const on = cur ? cur.has(c.id) : (d.classes.length ? d.classes.includes(c.id) : has); return `<label class="check pill ${has ? 'neutral' : 'warn'} plain" style="padding:4px 10px"><input type="checkbox" value="${c.id}" ${on ? 'checked' : ''} ${hasMarks ? 'disabled' : ''}> <span class="mono">${esc(c.nom)}</span> <span class="tiny muted">${studentsOf(c).length}</span></label>`; }).join(''); };
  fillSubj(); fillCls(false);
  $('#e-lv', m).onchange = () => { d.classes = []; fillSubj(); fillCls(true); };
  $('#e-subj', m).onchange = () => { d.classes = []; fillCls(true); const s = $('#e-subj', m).value; const lv = $('#e-lv', m).value; const miss = classesOf(lv).filter(c => !c.subjects.some(x => x.m === s)); $('#e-warn', m).textContent = miss.length && s ? `Classes sans cette matière au programme : ${miss.map(c => c.nom).join(', ')}.` : ''; };
  $('[data-all]', m).onclick = () => { const s = $('#e-subj', m).value; $$('#e-cls input', m).forEach(i => i.checked = S.classes[i.value].subjects.some(x => x.m === s)); };
  $('[data-none]', m).onclick = () => $$('#e-cls input', m).forEach(i => i.checked = false);
}
function openEvalDetail(eid) {
  const e = S.evals[eid]; if (!e) return; const p = progressOf(e);
  openModal({ title: `${evalLabel(e)} · ${levelById(e.level).nom}`, wide: true, body: `
    <div class="row">${statusPill(e.status)}${e.double ? '<span class="pill neutral plain">double correction</span>' : ''}<span class="pill neutral plain">barème /${e.bareme}</span>${e.anon?.lifted ? `<span class="pill ok plain">anonymat levé le ${fmtDT(e.anon.at)}</span>` : '<span class="pill accent plain">copies anonymes</span>'}</div>
    <div class="copy-card"><div><span>Date</span><b style="font-size:14px">${fmtDate(e.date)}</b></div><div><span>Créneau</span><b>${e.start}–${e.end}</b></div><div><span>Durée</span><b>${duree(e.start, e.end)}</b></div><div><span>Élèves</span><b>${e.placement ? p.total : candidatesOf(e).length}</b></div><div><span>Notes saisies</span><b>${p.done}/${p.total}</b></div><div><span>Échéance</span><b style="font-size:14px">${fmtDate(e.deadline, 'short')}</b></div></div>
    <div><b>Classes :</b> ${esc(evalClassNames(e))}</div>
    <div class="tw"><table class="t"><thead><tr><th>Classe</th><th>Enseignant</th><th class="r">Effectif</th></tr></thead><tbody>${e.classes.map(cid => `<tr><td class="mono">${esc(S.classes[cid]?.nom)}</td><td>${esc(teacherOf(cid, e.subj)) || '<span class="muted">non attribué</span>'}</td><td class="r num">${S.classes[cid] ? studentsOf(S.classes[cid]).length : 0}</td></tr>`).join('')}</tbody></table></div>
    ${e.placement ? `<div><b>Salles :</b> ${e.placement.rooms.map(r => `${esc(r.nom)} (tables ${pad(r.from, 3)}–${pad(r.to, 3)})`).join(' · ')}</div>` : '<div class="callout warn">Répartition en salles et codes-barres pas encore générés.</div>'}
    ${e.consignes ? `<div class="callout">${esc(e.consignes)}</div>` : ''}`,
    actions: [
      { label: `${ic('trash')}Supprimer`, cls: 'danger', onClick: async close => { if (Object.keys(e.marks || {}).length && !(await requireCoord('Supprimer une épreuve qui contient des notes.'))) return false; if (!(await confirmBox('Supprimer l’évaluation', `Supprimer définitivement ${esc(evalLabel(e))} (${levelById(e.level).nom}) ?`, 'Supprimer', true))) return false; await S.store.delete('evals/' + e.id); delete S.evals[e.id]; audit('Planning', `Suppression ${evalShort(e)} ${levelById(e.level).roman}`, e.level); close(); render(); } },
      { label: `${ic('edit')}Modifier`, onClick: close => { close(); openEvalForm(e); } },
      { label: `${ic('barcode')}Préparer`, onClick: close => { close(); S.ui.sel.eval = e.id; if (S.ui.level !== 'all' && S.ui.level !== e.level) S.ui.level = e.level; go('epreuves'); } },
      { label: `${ic('scan')}Saisir`, onClick: close => { close(); S.ui.sel.seval = e.id; go('saisie'); } },
      { label: `${ic('unlock')}Résultats`, cls: 'primary', onClick: close => { close(); S.ui.sel.reval = e.id; go('resultats'); } }] });
}
function situationWizard(sit) {
  const lv0 = S.ui.level !== 'all' ? S.ui.level : LEVELS[0].id;
  const slots = [['07:30', '09:30'], ['10:00', '12:00'], ['13:00', '15:00'], ['15:15', '17:15']];
  const md = openModal({ title: 'Programmer une situation complète', wide: true, body: `
    <p class="small muted">Une ligne par matière : l’évaluation est créée pour toutes les classes du niveau qui ont cette matière au programme. Les dates se remplissent automatiquement à partir du premier jour, en sautant samedi et dimanche.</p>
    <div class="fgrid"><label class="f">Niveau<select class="in" id="w-lv">${levelOpts(lv0)}</select></label><label class="f">Situation<select class="in" id="w-sit">${sitOpts(sit)}</select></label><label class="f">Premier jour<input class="in" type="date" id="w-d0" value="${addDays(todayISO(), 7)}"></label><label class="f">Épreuves par jour<select class="in" id="w-n">${optList([[2, '2 (matin)'], [3, '3'], [4, '4']], 3)}</select></label></div>
    <div class="row"><button class="btn sm" data-fill>${ic('refresh')}Remplir les dates</button></div>
    <div class="tw" style="max-height:48vh;overflow:auto"><table class="t" id="w-t"><thead><tr><th class="c">Créer</th><th>Matière</th><th>Classes</th><th>Date</th><th>Début</th><th>Fin</th></tr></thead><tbody></tbody></table></div>`,
    actions: [{ label: 'Annuler' }, { label: 'Créer les évaluations', cls: 'primary', onClick: async (close, m) => {
      const lv = $('#w-lv', m).value, s = +$('#w-sit', m).value; let n = 0, skipped = 0;
      await withBusy('Création…', async () => { for (const tr of $$('#w-t tbody tr', m)) { if (!$('.w-on', tr).checked) continue; const subj = tr.dataset.m; const classes = classesOf(lv).filter(c => c.subjects.some(x => x.m === subj)).map(c => c.id); if (Object.values(S.evals).some(o => o.level === lv && o.subj === subj && o.sit === s)) { skipped++; continue; } const ne = newEval({ level: lv, subj, trim: trimOfSit(s), sit: s, date: $('.w-d', tr).value, start: $('.w-s', tr).value, end: $('.w-e', tr).value, classes }); S.evals[ne.id] = ne; await saveEval(ne); n++; } });
      audit('Planning', `Situation ${s} programmée : ${n} évaluation(s)`, lv); toast(`${n} évaluation(s) créée(s)${skipped ? `, ${skipped} déjà existante(s) ignorée(s)` : ''}.`, 'ok'); close(); render(); } }] });
  const m = md.el;
  const build = () => { const lv = $('#w-lv', m).value; const cls = classesOf(lv); const subs = S.subjects.filter(s => cls.some(c => c.subjects.some(x => x.m === s.code)));
    $('#w-t tbody', m).innerHTML = subs.map(s => `<tr data-m="${s.code}"><td class="c"><input type="checkbox" class="w-on" ${s.code === '12' ? '' : 'checked'}></td><td><b>${esc(s.abbr)}</b> <span class="small muted">${esc(s.nom)}</span></td><td class="small">${cls.filter(c => c.subjects.some(x => x.m === s.code)).map(c => esc(c.nom)).join(', ')}</td><td><input type="date" class="in w-d"></td><td><input type="time" class="in w-s" style="width:105px"></td><td><input type="time" class="in w-e" style="width:105px"></td></tr>`).join(''); fill(); };
  const fill = () => { let d = $('#w-d0', m).value || todayISO(); const per = +$('#w-n', m).value; let k = 0; const skipWE = x => { while ([0, 6].includes(isoToDate(x).getDay())) x = addDays(x, 1); return x; }; d = skipWE(d);
    $$('#w-t tbody tr', m).forEach(tr => { if (!$('.w-on', tr).checked) return; if (k && k % per === 0) d = skipWE(addDays(d, 1)); const sl = slots[k % per]; $('.w-d', tr).value = d; $('.w-s', tr).value = sl[0]; $('.w-e', tr).value = sl[1]; k++; }); };
  $('#w-lv', m).onchange = build; $('[data-fill]', m).onclick = fill; build();
}
function importPlanning() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv,.ods';
  inp.onchange = async () => { try {
    const { rows } = await readSheet(inp.files[0]); let n = 0; const errs = [];
    for (const [i, r] of rows.entries()) {
      const lvTxt = norm(pickCol(r, ['niveau', 'prefecture'])); const lv = LEVELS.find(l => norm(l.nom) === lvTxt || norm(l.id) === lvTxt || norm(l.roman) === lvTxt || (lvTxt.startsWith('2') && l.id === '2nde') || (lvTxt.startsWith('1') && l.id === '1ere') || (lvTxt.startsWith('t') && l.id === 'tle'));
      const sit = +pickCol(r, ['situation', 'sit', 'sequence']); const mt = norm(pickCol(r, ['matiere', 'discipline']));
      const subj = S.subjects.find(s => norm(s.code) === mt || norm(s.abbr) === mt || norm(s.nom) === mt || pad(mt, 2) === s.code);
      let date = pickCol(r, ['date']); const md2 = date.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if (md2) date = `${md2[3].length === 2 ? '20' + md2[3] : md2[3]}-${pad(md2[2], 2)}-${pad(md2[1], 2)}`; date = date.slice(0, 10);
      const start = (pickCol(r, ['debut', 'heuredebut', 'de']) || '').replace('h', ':').slice(0, 5), end = (pickCol(r, ['fin', 'heurefin', 'a']) || '').replace('h', ':').slice(0, 5);
      if (!lv || !sit || sit > 6 || !subj || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) { errs.push(`ligne ${i + 2}`); continue; }
      const ct = pickCol(r, ['classes', 'classe']); let classes;
      if (!ct || /tout/i.test(ct)) classes = classesOf(lv.id).filter(c => c.subjects.some(x => x.m === subj.code)).map(c => c.id);
      else classes = ct.split(/[,;\s]+/).map(x => classesOf(lv.id).find(c => norm(c.nom) === norm(x))).filter(Boolean).map(c => c.id);
      if (!classes.length) { errs.push(`ligne ${i + 2} (classes)`); continue; }
      const ne = newEval({ level: lv.id, subj: subj.code, trim: trimOfSit(sit), sit, date, start: start.padStart(5, '0'), end: end.padStart(5, '0'), classes }); S.evals[ne.id] = ne; await saveEval(ne); n++;
    }
    audit('Planning', `Import de ${n} évaluation(s)`); toast(`${n} évaluation(s) importée(s)${errs.length ? ` ; ${errs.length} ligne(s) rejetée(s) : ${errs.slice(0, 5).join(', ')}` : ''}.`, errs.length ? '' : 'ok'); render();
  } catch (e) { toast(e.message, 'bad'); } };
  inp.click();
}

/* =====================================================================
   Épreuves : préparation (salles, codes), saisie anonyme, désanonymat
   ===================================================================== */
function evalPicker(list, selId, id) {
  return `<select class="in" id="${id}" style="max-width:100%">${list.map(e => `<option value="${e.id}" ${e.id === selId ? 'selected' : ''}>${fmtDate(e.date, 'short')} · ${levelById(e.level).roman} · ${esc(subjByCode(e.subj).nom)} · T${e.trim} S${e.sit} · ${STATUS[e.status]?.l}</option>`).join('')}</select>`;
}
function scopeEvals(filterFn) { const lv = levelsInScope(); return sortEvals(Object.values(S.evals).filter(e => lv.includes(e.level) && (!filterFn || filterFn(e)))); }

/* ---------- Préparation et codes-barres ---------- */
V.epreuves = el => {
  const sit = curSit(); const list = scopeEvals(e => e.sit === sit);
  if (!list.length) { el.innerHTML = pageHead('Préparation et codes-barres') + `<div class="panel empty"><h3>Aucune épreuve pour la situation ${sit}</h3><p>Planifiez d’abord les évaluations.</p><button class="btn primary" onclick="go('planning')">${ic('cal')}Aller au planning</button></div>`; return; }
  let e = S.evals[S.ui.sel.eval]; if (!e || !list.includes(e)) e = list.find(x => !x.placement) || list[0]; S.ui.sel.eval = e.id;
  const cand = candidatesOf(e); const busyRooms = new Set(Object.values(S.evals).filter(o => o.id !== e.id && o.placement && overlap(o, e)).flatMap(o => o.placement.rooms.map(r => r.id)));
  const chosen = new Set(e.placement ? e.placement.rooms.map(r => r.id) : S.rooms.filter(r => !busyRooms.has(r.id)).map(r => r.id));
  const locked = Object.keys(e.marks || {}).length > 0;
  el.innerHTML = pageHead('Préparation et codes-barres', 'Répartition des élèves dans les salles, numéros de table et codes-barres d’anonymat. Les éditions sortent en un seul PDF par type.') + `
    <div class="panel"><div class="row"><label class="f" style="flex:1;min-width:260px">Épreuve de la situation ${sit}${evalPicker(list, e.id, 'ep-sel')}</label><button class="btn" data-act="detail">${ic('eye')}Fiche</button><button class="btn" data-act="edit">${ic('edit')}Modifier</button></div>
      <div class="row" style="margin-top:10px">${statusPill(e.status)}<span class="small">${fmtDate(e.date)} · ${e.start}–${e.end} · ${esc(evalClassNames(e))} · <b>${cand.length}</b> élèves</span></div></div>
    <div class="grid g2">
      <div class="panel"><header><h3>1. Répartition en salles</h3>${e.placement ? `<span class="pill ok">générée le ${fmtDT(e.placement.at)}</span>` : '<span class="pill warn">à faire</span>'}</header>
        ${S.rooms.length ? `<div class="stack" style="gap:6px;max-height:240px;overflow:auto">${S.rooms.map(r => `<label class="check" style="justify-content:space-between;width:100%"><span><input type="checkbox" class="rm" value="${r.id}" ${chosen.has(r.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}> ${esc(r.nom)} <span class="tiny muted">${esc(r.batiment || '')}</span></span><span class="small num">${busyRooms.has(r.id) ? '<span class="pill bad plain">occupée</span> ' : ''}${r.capacite} pl.</span></label>`).join('')}</div>
        <div class="fgrid" style="margin-top:10px"><label class="f">Mode de placement<select class="in" id="pm" ${locked ? 'disabled' : ''}>${optList(Object.entries(PLACE_MODES), e.placement?.mode || 'brassage')}</select></label><label class="check" style="align-self:end"><input type="checkbox" id="peq" ${locked ? 'disabled' : ''}> Équilibrer les salles</label></div>
        <p class="small" id="capinfo"></p>
        <div class="row"><button class="btn primary" data-act="place" ${locked ? 'disabled' : ''}>${ic('shuffle')}${e.placement ? 'Regénérer' : 'Générer'} la répartition et les codes</button></div>
        ${locked ? '<p class="small muted">Des notes sont enregistrées : la répartition est figée pour préserver la correspondance des codes.</p>' : ''}` : `<div class="empty small">Aucune salle enregistrée.<button class="btn" onclick="go('salles')">${ic('door')}Créer les salles</button></div>`}
      </div>
      <div class="panel"><header><h3>2. Salles et surveillants</h3>${e.placement ? `<button class="btn sm" data-act="surv">${ic('users')}Désigner automatiquement</button>` : ''}</header>
        ${e.placement ? `<div class="tw"><table class="t"><thead><tr><th>Salle</th><th>Tables</th><th class="r">Élèves</th><th>Surveillants</th></tr></thead><tbody>${e.placement.rooms.map((r, i) => `<tr><td><b>${esc(r.nom)}</b></td><td class="mono small">${pad(r.from, 3)}–${pad(r.to, 3)}</td><td class="r num">${r.to - r.from + 1}</td><td><div class="row" style="flex-wrap:nowrap">${[0, 1].map(k => `<select class="in sv" data-r="${i}" data-k="${k}" style="min-width:130px">${teacherOpts(r.surv?.[k])}</select>`).join('')}</div></td></tr>`).join('')}</tbody></table></div><p class="tiny muted">La désignation automatique écarte les enseignants de la matière évaluée et ceux qui surveillent déjà sur le même créneau.</p>` : '<div class="empty small">Générez d’abord la répartition.</div>'}
      </div></div>
    ${e.placement ? `<div class="panel"><header><h3>3. Éditions de l’épreuve</h3><span class="small muted">chaque bouton produit un seul fichier PDF</span></header><div class="row">
      <button class="btn" data-pdf="listes">${ic('file')}Listes de classe avec codes-barres</button>
      <button class="btn" data-pdf="emarg">${ic('file')}Émargement et PV par salle</button>
      <button class="btn" data-pdf="etiq">${ic('barcode')}Étiquettes adhésives</button>
      <button class="btn" data-pdf="bord">${ic('file')}Bordereaux de notation</button>
      <button class="btn" data-pdf="corr">${ic('lock')}Table de correspondance</button>
      <button class="btn primary" data-pdf="dossier">${ic('print')}Dossier complet</button></div></div>
    <div class="grid g2"><div class="panel"><header><h3>4. Jour de l’épreuve</h3>${statusPill(e.status)}</header><div class="stack">
      <label class="f">Absent : scanner le code ou saisir le numéro de table<input class="in mono" id="abs-in" placeholder="Code-barres ou n° de table puis Entrée" autocomplete="off"></label>
      <div class="small">Absents enregistrés : ${Object.entries(e.marks || {}).filter(([, m]) => m.st === 'ABS').map(([k]) => `<span class="pill bad plain mono">${k}</span>`).join(' ') || '<span class="muted">aucun</span>'}</div>
      <div class="row"><button class="btn" data-act="composee" ${['preparee', 'planifiee'].includes(e.status) ? '' : 'disabled'}>${ic('check')}Marquer l’épreuve comme composée</button></div></div></div>
      <div class="panel"><header><h3>Contrôle d’un code</h3></header><p class="small muted">Scannez une étiquette pour vérifier sa lecture par la douchette avant l’impression en série.</p><input class="in mono scan-input" id="chk-in" placeholder="Scanner ici" autocomplete="off" style="font-size:18px"><div id="chk-out"></div></div></div>
    <div class="panel"><header><h3>Répartition détaillée</h3><input class="in" id="pf" placeholder="Filtrer : nom, classe, salle, table" style="max-width:280px"></header><div id="plist"></div></div>` : ''}`;
  const sel = $('#ep-sel', el); sel.onchange = () => { S.ui.sel.eval = sel.value; render(); };
  const capInfo = () => { const ids = $$('.rm:checked', el).map(i => i.value); const cap = ids.reduce((a, id) => a + (+roomById(id)?.capacite || 0), 0); const ci = $('#capinfo', el); if (ci) ci.innerHTML = `Capacité sélectionnée : <b>${cap}</b> places pour <b>${cand.length}</b> élèves ${cap >= cand.length ? '<span class="pill ok plain">suffisant</span>' : `<span class="pill bad plain">manque ${cand.length - cap}</span>`}`; };
  $$('.rm', el).forEach(i => i.onchange = capInfo); capInfo();
  $$('[data-act]', el).forEach(b => b.onclick = async () => {
    const a = b.dataset.act;
    if (a === 'detail') openEvalDetail(e.id);
    if (a === 'edit') openEvalForm(e);
    if (a === 'place') {
      if (e.placement && !(await confirmBox('Regénérer la répartition', 'Les numéros de table et les codes déjà imprimés deviendront faux. Continuer ?', 'Regénérer', true))) return;
      try { autoPlace(e, $('#pm', el).value, $$('.rm:checked', el).map(i => i.value), { equilibrer: $('#peq', el).checked }); await saveEval(e); audit('Répartition', `${evalShort(e)} ${levelById(e.level).roman} : ${e.placement.list.length} élèves dans ${e.placement.rooms.length} salle(s), mode ${e.placement.mode}`, e.level); toast('Répartition et codes générés.', 'ok'); render(); } catch (err) { toast(err.message, 'bad'); }
    }
    if (a === 'surv') { const ok = autoSurveillants(e); await saveEval(e); toast(ok ? 'Surveillants désignés.' : 'Enseignants disponibles insuffisants : complétez à la main.', ok ? 'ok' : ''); render(); }
    if (a === 'composee') { e.status = 'composee'; await saveEval(e); audit('Épreuve', `${evalShort(e)} ${levelById(e.level).roman} marquée composée`, e.level); render(); }
  });
  $$('.sv', el).forEach(s => s.onchange = async () => { const r = e.placement.rooms[+s.dataset.r]; r.surv = r.surv || []; r.surv[+s.dataset.k] = s.value; r.surv = r.surv.filter((x, i) => x || i === 0); await saveEval(e); toast('Surveillant enregistré.', 'ok'); });
  const base = `${fileSafe(subjByCode(e.subj).abbr)}-${e.level}-t${e.trim}s${e.sit}-${e.date}`;
  $$('[data-pdf]', el).forEach(b => b.onclick = async () => {
    const k = b.dataset.pdf;
    if (k === 'listes') runPdf(`listes-classe-${base}.pdf`, 'Listes de classe', doc => addListesClasse(doc, [e]));
    if (k === 'emarg') runPdf(`emargement-${base}.pdf`, 'Émargement', doc => addEmargement(doc, [e]));
    if (k === 'bord') runPdf(`bordereaux-${base}.pdf`, 'Bordereaux de notation', doc => addBordereaux(doc, [e]));
    if (k === 'corr') { if (await requireCoord('La table de correspondance relie chaque code à un élève.')) runPdf(`correspondance-${base}.pdf`, 'Table de correspondance', doc => addCorrespondance(doc, [e])); }
    if (k === 'etiq') labelDialog([e], base);
    if (k === 'dossier') runPdf(`dossier-${base}.pdf`, 'Dossier de l’épreuve', doc => addDossierJournee(doc, [e], { emarg: true, listes: true, bord: true }));
  });
  const absIn = $('#abs-in', el);
  if (absIn) absIn.addEventListener('keydown', async ev => { if (ev.key !== 'Enter') return; const v = absIn.value.trim(); absIn.value = ''; let t = null; if (scanDigits(v).length === 12) { const L = locateCode(v, e); if (L.e && L.e.id === e.id) t = L.p.TTT; else { toast(L.p.err || 'Ce code n’appartient pas à cette épreuve.', 'bad'); return; } } else t = +v; if (!e.placement.list.some(x => x[2] === t)) { toast('Numéro de table inconnu.', 'bad'); return; } const k = markKey(t); const cur = e.marks?.[k]; const next = cur?.st === 'ABS' ? { st: 'P', n: null, at: Date.now() } : { st: 'ABS', n: null, at: Date.now(), by: S.caps.userName || 'Secrétariat' }; e.marks = e.marks || {}; e.marks[k] = next; await S.store.update('evals/' + e.id, { marks: { [k]: next }, updatedAt: Date.now() }); audit('Absence', `${evalShort(e)} table ${k} ${next.st === 'ABS' ? 'absent' : 'présent'}`, e.level); render(); setTimeout(() => $('#abs-in')?.focus(), 50); });
  const chk = $('#chk-in', el);
  if (chk) chk.addEventListener('keydown', ev => { if (ev.key !== 'Enter') return; const L = locateCode(chk.value, e); chk.value = ''; $('#chk-out', el).innerHTML = L.p.ok ? `<div class="callout ${L.e?.id === e.id ? 'ok' : 'warn'}">Lecture correcte : ${esc(L.p.level?.nom || '')} · ${esc(L.p.cls?.nom || '')} · ${esc(L.p.subject?.abbr || '')} · T${L.p.T} S${L.p.S} · table ${pad(L.p.TTT, 3)}${L.e?.id === e.id ? '' : '<br>Ce code ne correspond pas à l’épreuve affichée.'}</div>` : `<div class="callout bad">${esc(L.p.err)}</div>`; });
  if (e.placement) {
    const draw = () => { const q = norm($('#pf', el).value); const rows = e.placement.list.filter(x => !q || norm(`${x[3]} ${S.classes[x[1]]?.nom} ${roomOfTable(e, x[2])?.nom} ${pad(x[2], 3)}`).includes(q)).sort((a, b) => a[2] - b[2]);
      $('#plist', el).innerHTML = `<div class="tw"><table class="t"><thead><tr><th>Table</th><th>Salle</th><th>Classe</th><th>Élève</th><th>Code-barres</th></tr></thead><tbody>${rows.slice(0, 40).map(x => `<tr><td class="mono"><b>${pad(x[2], 3)}</b></td><td>${esc(roomOfTable(e, x[2])?.nom || '')}</td><td class="mono">${esc(S.classes[x[1]]?.nom || '')}</td><td>${esc(x[3])}</td><td class="bc" style="background:#fff;width:200px">${bcSvg(codeOf(e, x[1], x[2]), { h: 34, w: 1.3, fs: 11, m: 4 })}</td></tr>`).join('')}</tbody></table></div>${rows.length > 40 ? `<p class="small muted">${rows.length - 40} ligne(s) supplémentaire(s) : affinez le filtre ou éditez les listes en PDF.</p>` : ''}`; };
    $('#pf', el).oninput = debounce(draw, 200); draw();
  }
};
function labelDialog(evs, base) {
  openModal({ title: 'Étiquettes adhésives', body: `<div class="fgrid"><label class="f">Contenu<select class="in" id="lb-t">${optList([['paire', 'Paire par élève : en-tête nominatif + copie anonyme'], ['anonyme', 'Copie anonyme seulement'], ['nominative', 'En-tête nominatif seulement']], 'paire')}</select></label><label class="f">Format de planche<select class="in" id="lb-f">${optList(Object.entries(LABEL_FORMATS).map(([k, v]) => [k, v.l]), '3x8')}</select></label></div><label class="check"><input type="checkbox" id="lb-c" checked> Tracer les contours (désactiver pour les planches prédécoupées)</label><p class="small muted">L’étiquette nominative se colle sur la partie détachable de la copie, l’étiquette anonyme sur la copie elle-même. Imprimez à 100 %, sans ajustement à la page.</p>`,
    actions: [{ label: 'Annuler' }, { label: `${ic('print')}Générer le PDF`, cls: 'primary', onClick: (close, m) => { const t = $('#lb-t', m).value, f = $('#lb-f', m).value, c = $('#lb-c', m).checked; close(); runPdf(`etiquettes-${t}-${base}.pdf`, 'Étiquettes', doc => addEtiquettes(doc, evs, t, f, c)); } }] });
}

/* ---------- Saisie anonyme ---------- */
V.saisie = el => {
  const list = scopeEvals(e => e.placement && (!e.anon?.lifted || S.ui.role === 'coordination') && e.status !== 'cloturee');
  if (!list.length) { el.innerHTML = pageHead('Saisie anonyme des notes') + `<div class="panel empty"><h3>Aucune épreuve prête pour la saisie</h3><p>Une épreuve devient saisissable dès que ses codes-barres sont générés.</p></div>`; return; }
  let e = S.evals[S.ui.sel.seval]; if (!e || !list.includes(e)) e = list.find(x => ['composee', 'saisie'].includes(x.status)) || list[list.length - 1]; S.ui.sel.seval = e.id;
  const mode = S.ui.sel.smode || 'scan'; const p = progressOf(e);
  el.innerHTML = pageHead('Saisie anonyme des notes', 'Aucun nom n’apparaît pendant la saisie. La douchette lit le code, la note se tape au clavier, la touche Entrée enregistre et rend la main au lecteur.') + `
    <div class="panel"><div class="row"><label class="f" style="flex:1;min-width:260px">Épreuve${evalPicker(list, e.id, 'sv-sel')}</label><div class="lvl tabs" style="border:0">${[['scan', 'Douchette'], ['grille', 'Bordereau']].map(([k, l]) => `<button data-sm="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="stack" style="gap:5px;margin-top:10px"><div class="row between small"><span>${statusPill(e.status)} ${e.double ? '<span class="pill neutral plain">double correction</span>' : ''} barème /${e.bareme}</span><span class="num"><b>${p.done}</b> / ${p.total} copies traitées · ${p.abs} absent(s)${p.arb ? ` · <b style="color:var(--warn)">${p.arb} arbitrage(s)</b>` : ''}</span></div>${progressBar(p.pct, p.pct === 100 ? 'ok' : '')}</div>
      ${e.anon?.lifted ? '<div class="callout warn" style="margin-top:10px">Anonymat déjà levé : toute modification est tracée au journal avec son motif.</div>' : ''}</div>
    <div id="sv-body" class="stack"></div>`;
  $('#sv-sel', el).onchange = ev => { S.ui.sel.seval = ev.target.value; render(); };
  $$('[data-sm]', el).forEach(b => b.onclick = () => { S.ui.sel.smode = b.dataset.sm; render(); });
  (mode === 'scan' ? saisieScan : saisieGrille)($('#sv-body', el), e);
};
async function storeMark(e, table, mark, reason) {
  const k = markKey(table); mark.at = Date.now(); mark.by = S.caps.userName || (S.ui.role === 'coordination' ? 'Coordination' : 'Secrétariat');
  if (e.anon?.lifted) { if (!(await requireCoord('Modifier une note après la levée d’anonymat.'))) return false; mark.corr = reason || 'correction'; }
  e.marks = e.marks || {}; const prev = e.marks[k]; e.marks[k] = mark;
  const patch = { marks: { [k]: mark }, updatedAt: Date.now() };
  if (['preparee', 'composee', 'planifiee'].includes(e.status)) { e.status = 'saisie'; patch.status = 'saisie'; }
  await S.store.update('evals/' + e.id, patch);
  if (e.anon?.lifted || (prev && markDone(prev, e))) audit('Note modifiée', `${evalShort(e)} table ${k} : ${prev ? (prev.st !== 'P' ? prev.st : fmtNote(prev.n)) : '—'} → ${mark.st !== 'P' ? mark.st : fmtNote(mark.n)}${reason ? ' · motif : ' + reason : ''}`, e.level);
  return true;
}
function parseMarkInput(v, bar) {
  const t = String(v).trim().toLowerCase(); if (!t) return null;
  if (['a', 'abs', 'absent'].includes(t)) return { st: 'ABS', n: null };
  if (['d', 'disp', 'dispense'].includes(t)) return { st: 'DISP', n: null };
  if (['f', 'fraude'].includes(t)) return { st: 'FRAUDE', n: null };
  const n = Number(t.replace(',', '.')); if (isNaN(n) || n < 0 || n > bar) return { err: `Note invalide : saisir un nombre entre 0 et ${bar}, ou A (absent), D (dispensé), F (fraude).` };
  return { st: 'P', n: Math.round(n * 100) / 100 };
}
function saisieScan(box, e) {
  const recent = S.ui.recent?.[e.id] || [];
  box.innerHTML = `<div class="grid g2"><div class="scan-zone" id="sz">
      <label class="f">1. Code-barres de la copie<input class="in scan-input" id="code-in" inputmode="numeric" autocomplete="off" placeholder="Scanner la copie"></label>
      <div id="copy"></div>
      <div id="mark-zone" hidden><div class="row" style="align-items:flex-end">${e.double ? `<label class="f">Note 1<input class="in mark-input" id="n1" autocomplete="off"></label><label class="f">Note 2<input class="in mark-input" id="n2" autocomplete="off"></label><label class="f" id="n3w" hidden>Arbitrage<input class="in mark-input" id="n3" autocomplete="off"></label>` : `<label class="f">2. Note sur ${e.bareme}<input class="in mark-input" id="n1" autocomplete="off"></label>`}<button class="btn primary" id="save-mark">${ic('check')}Enregistrer <span class="kbd">Entrée</span></button></div>
        <p class="tiny muted">A = absent · D = dispensé · F = fraude · Échap = annuler</p></div>
      <p class="small muted">Astuce : la douchette envoie le code suivi de Entrée. Pas de douchette ? Tapez les 12 chiffres puis Entrée.</p></div>
    <div class="panel"><header><h3>Dernières saisies</h3><span class="small muted">session en cours</span></header><div id="recent">${recent.length ? `<div class="tw"><table class="t"><thead><tr><th>Heure</th><th>Code</th><th class="r">Note</th></tr></thead><tbody>${recent.slice(0, 12).map(r => `<tr><td class="small">${new Date(r.at).toLocaleTimeString('fr-FR')}</td><td class="mono small">${esc(fmtCode(r.code))}</td><td class="r"><b>${esc(r.lab)}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty small">Les copies enregistrées s’affichent ici.</div>'}</div></div></div>
    <div class="panel"><header><h3>Copies sans note</h3><span class="small muted">par salle, sans nom</span></header>${missingHTML(e)}</div>`;
  const ci = $('#code-in', box), mz = $('#mark-zone', box), cp = $('#copy', box); let cur = null;
  const reset = () => { cur = null; mz.hidden = true; cp.innerHTML = ''; ci.value = ''; ci.focus(); };
  const flash = ok => { const z = $('#sz', box); z.classList.remove('flash-ok', 'flash-bad'); void z.offsetWidth; z.classList.add(ok ? 'flash-ok' : 'flash-bad'); };
  ci.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return; ev.preventDefault();
    const L = locateCode(ci.value, e);
    if (!L.p.ok) { flash(false); cp.innerHTML = `<div class="callout bad">${esc(L.p.err)}</div>`; ci.select(); return; }
    if (!L.e || L.e.id !== e.id) { flash(false); cp.innerHTML = `<div class="callout bad">Cette copie appartient à une autre épreuve${L.e ? ` : ${esc(evalLabel(L.e))} (${levelById(L.e.level).roman})` : ''}. Changez d’épreuve ou mettez la copie de côté.</div>`; ci.select(); return; }
    cur = L; const m = e.marks?.[markKey(L.p.TTT)];
    cp.innerHTML = `<div class="copy-card"><div><span>Matière</span><b>${esc(subjByCode(e.subj).abbr)}</b></div><div><span>Trim. / sit.</span><b>T${e.trim} S${e.sit}</b></div><div><span>Table</span><b>${pad(L.p.TTT, 3)}</b></div><div><span>Salle</span><b style="font-size:14px">${esc(roomOfTable(e, L.p.TTT)?.nom || '')}</b></div><div><span>Note actuelle</span><b>${m ? (m.st !== 'P' ? m.st : (fmtNote(m.n) || '—') + (e.double && m.n2 !== undefined && m.n2 !== null ? ' / ' + fmtNote(m.n2) : '')) : '—'}</b></div></div>`;
    mz.hidden = false; $('#n1', box).value = m && m.st === 'P' && m.n !== null && m.n !== undefined ? String(m.n).replace('.', ',') : (m && m.st !== 'P' ? m.st[0] : '');
    if (e.double) { $('#n2', box).value = m?.n2 ?? ''; $('#n3w', box).hidden = !(m && needsArbitration(m, e)) && !(m && m.n3 !== undefined && m.n3 !== null); $('#n3', box).value = m?.n3 ?? ''; }
    flash(true); $('#n1', box).focus(); $('#n1', box).select();
  });
  const save = async () => {
    if (!cur) return; const bar = +e.bareme || 20;
    const a = parseMarkInput($('#n1', box).value, bar); if (!a) { toast('Saisissez une note.', 'bad'); return; } if (a.err) { toast(a.err, 'bad'); flash(false); return; }
    const mark = { ...a };
    if (e.double && a.st === 'P') { const b = parseMarkInput($('#n2', box).value, bar); if (b && b.err) { toast(b.err, 'bad'); return; } mark.n2 = b && b.st === 'P' ? b.n : null; const c = !$('#n3w', box).hidden ? parseMarkInput($('#n3', box).value, bar) : null; if (c && c.err) { toast(c.err, 'bad'); return; } mark.n3 = c && c.st === 'P' ? c.n : null; }
    let reason = ''; if (e.anon?.lifted) { reason = await askReason(); if (!reason) return; }
    if (!(await storeMark(e, cur.p.TTT, mark, reason))) return;
    S.ui.recent = S.ui.recent || {}; (S.ui.recent[e.id] = S.ui.recent[e.id] || []).unshift({ at: Date.now(), code: cur.p.digits, lab: mark.st !== 'P' ? mark.st : fmtNote(mark.n) + (e.double && mark.n2 !== null && mark.n2 !== undefined ? ' / ' + fmtNote(mark.n2) : '') });
    if (e.double && needsArbitration(mark, e)) toast(`Écart de ${fmtNote(Math.abs(mark.n - mark.n2))} points : cette copie demande une troisième correction.`, '');
    else toast(`Table ${pad(cur.p.TTT, 3)} : ${mark.st !== 'P' ? mark.st : fmtNote(mark.n)} enregistré.`, 'ok');
    const y = window.scrollY; render(); window.scrollTo(0, y); setTimeout(() => $('#code-in')?.focus(), 30);
  };
  $('#save-mark', box).onclick = save;
  $$('.mark-input', box).forEach((inp, i, arr) => inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); const nxt = arr.slice(i + 1).find(x => !x.closest('[hidden]')); if (nxt && e.double && $('#n1', box).value && !/^[adf]/i.test($('#n1', box).value)) nxt.focus(); else save(); } if (ev.key === 'Escape') reset(); }));
  setTimeout(() => ci.focus(), 50);
}
function askReason() {
  return new Promise(res => { let done = false; const md = openModal({ title: 'Motif de la modification', body: '<label class="f">Motif (réclamation, erreur de report…)<input class="in" id="rs-in"></label>', actions: [{ label: 'Annuler', onClick: c => { done = true; c(); res(''); } }, { label: 'Valider', cls: 'primary', onClick: (c, m) => { const v = $('#rs-in', m).value.trim(); if (!v) { toast('Le motif est obligatoire.', 'bad'); return false; } done = true; c(); res(v); } }] }); const obs = new MutationObserver(() => { if (!document.body.contains(md.el)) { obs.disconnect(); if (!done) res(''); } }); obs.observe(document.body, { childList: true }); });
}
function missingHTML(e) {
  const miss = e.placement.list.filter(x => !markDone(e.marks?.[markKey(x[2])], e)).sort((a, b) => a[2] - b[2]);
  if (!miss.length) return '<div class="callout ok">Toutes les copies sont traitées. L’épreuve peut passer au désanonymat.</div>';
  const byRoom = {}; miss.forEach(x => { const r = roomOfTable(e, x[2])?.nom || '?'; (byRoom[r] = byRoom[r] || []).push(x); });
  return `<div class="stack" style="gap:8px">${Object.entries(byRoom).map(([r, xs]) => `<div><b>${esc(r)}</b> <span class="small muted">${xs.length} copie(s)</span><div class="row" style="gap:4px;margin-top:4px">${xs.map(x => `<span class="pill ${needsArbitration(e.marks?.[markKey(x[2])], e) ? 'warn' : 'neutral'} plain mono" title="${esc(fmtCode(codeOf(e, x[1], x[2])))}">${pad(x[2], 3)}</span>`).join('')}</div></div>`).join('')}</div>`;
}
function saisieGrille(box, e) {
  const lot = +S.settings.tailleLot || 25; const all = e.placement.list.slice().sort((a, b) => a[2] - b[2]);
  const nl = Math.ceil(all.length / lot); let li = Math.min(S.ui.sel.lot || 0, nl - 1); const rows = all.slice(li * lot, li * lot + lot);
  box.innerHTML = `<div class="panel"><header><h3>Saisie depuis un bordereau</h3><label class="f" style="flex-direction:row;align-items:center;gap:6px">Lot<select class="in" id="lot" style="width:auto">${Array.from({ length: nl }, (_, i) => `<option value="${i}" ${i === li ? 'selected' : ''}>${i + 1} · tables ${pad(all[i * lot][2], 3)}–${pad(all[Math.min(all.length, (i + 1) * lot) - 1][2], 3)}</option>`).join('')}</select></label><button class="btn primary" id="save-lot">${ic('check')}Enregistrer le lot</button></header>
    <p class="small muted">Recopiez les notes du bordereau papier dans l’ordre des numéros. Tabulation ou Entrée pour passer à la ligne suivante.</p>
    <div class="tw"><table class="t"><thead><tr><th>N°</th><th>Table</th><th>Code</th><th>${e.double ? 'Note 1' : 'Note / ' + e.bareme}</th>${e.double ? '<th>Note 2</th><th>Arbitrage</th>' : ''}<th>Finale / 20</th></tr></thead><tbody>${rows.map((x, i) => { const m = e.marks?.[markKey(x[2])]; const v = k => m && m.st === 'P' && m[k] !== null && m[k] !== undefined ? String(m[k]).replace('.', ',') : (k === 'n' && m && m.st !== 'P' ? m.st[0] : ''); return `<tr data-t="${x[2]}"><td class="muted num">${i + 1}</td><td class="mono"><b>${pad(x[2], 3)}</b></td><td class="mono small">${esc(fmtCode(codeOf(e, x[1], x[2])))}</td><td><input class="in g1 num" value="${esc(v('n'))}" style="width:90px"></td>${e.double ? `<td><input class="in g2 num" value="${esc(v('n2'))}" style="width:90px"></td><td><input class="in g3 num" value="${esc(v('n3'))}" style="width:90px"></td>` : ''}<td class="num"><b>${fmtNote(finalMark(m, e))}</b>${needsArbitration(m, e) ? ' <span class="pill warn plain">arbitrage</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  $('#lot', box).onchange = ev => { S.ui.sel.lot = +ev.target.value; render(); };
  const inputs = $$('input.in', box); inputs.forEach((inp, i) => inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); (inputs[i + 1] || $('#save-lot', box)).focus(); } }));
  $('#save-lot', box).onclick = async () => {
    const bar = +e.bareme || 20; const patch = {}; let errs = 0; let reason = '';
    for (const tr of $$('tr[data-t]', box)) { const t = +tr.dataset.t; const a = parseMarkInput($('.g1', tr).value, bar); if (!a) continue; if (a.err) { errs++; $('.g1', tr).style.borderColor = 'var(--bad)'; continue; } const mk = { ...a }; if (e.double && a.st === 'P') { const b = parseMarkInput($('.g2', tr).value, bar); const c = parseMarkInput($('.g3', tr).value, bar); if ((b && b.err) || (c && c.err)) { errs++; continue; } mk.n2 = b && b.st === 'P' ? b.n : null; mk.n3 = c && c.st === 'P' ? c.n : null; } const old = e.marks?.[markKey(t)]; if (old && old.st === mk.st && old.n === mk.n && (old.n2 ?? null) === (mk.n2 ?? null) && (old.n3 ?? null) === (mk.n3 ?? null)) continue; mk.at = Date.now(); mk.by = S.caps.userName || 'Secrétariat'; patch[markKey(t)] = mk; }
    if (errs) { toast(`${errs} note(s) invalide(s) : corrigez les cases en rouge.`, 'bad'); return; }
    const n = Object.keys(patch).length; if (!n) { toast('Aucun changement à enregistrer.'); return; }
    if (e.anon?.lifted) { if (!(await requireCoord('Modifier des notes après la levée d’anonymat.'))) return; reason = await askReason(); if (!reason) return; Object.values(patch).forEach(m => m.corr = reason); }
    e.marks = { ...(e.marks || {}), ...patch }; const up = { marks: patch, updatedAt: Date.now() }; if (['preparee', 'composee', 'planifiee'].includes(e.status)) { e.status = 'saisie'; up.status = 'saisie'; }
    await withBusy('Enregistrement…', () => S.store.update('evals/' + e.id, up)); audit('Saisie par bordereau', `${evalShort(e)} ${levelById(e.level).roman} lot ${li + 1} : ${n} note(s)${reason ? ' · motif : ' + reason : ''}`, e.level);
    toast(`${n} note(s) enregistrée(s).`, 'ok'); if (li < nl - 1) S.ui.sel.lot = li + 1; render();
  };
}

/* ---------- Désanonymat et résultats ---------- */
V.resultats = el => {
  const list = scopeEvals(e => !!e.placement);
  if (!list.length) { el.innerHTML = pageHead('Désanonymat et résultats') + '<div class="panel empty"><h3>Aucune épreuve avec codes</h3></div>'; return; }
  let e = S.evals[S.ui.sel.reval]; if (!e || !list.includes(e)) e = list.find(x => !x.anon?.lifted && progressOf(x).missing === 0) || list.filter(x => x.anon?.lifted).pop() || list[0]; S.ui.sel.reval = e.id;
  const p = progressOf(e); const lifted = !!e.anon?.lifted;
  el.innerHTML = pageHead('Désanonymat et résultats', 'La levée d’anonymat rattache chaque note à son élève grâce à la table de correspondance. Elle est réservée à la coordination et inscrite au journal.') + `
    <div class="panel"><div class="row"><label class="f" style="flex:1;min-width:260px">Épreuve${evalPicker(list, e.id, 'rs-sel')}</label></div></div>
    ${lifted ? '' : `<div class="panel"><header><h3>Contrôles avant levée</h3></header><div class="stack small">
      <div class="row">${p.missing === 0 ? '<span class="pill ok">conforme</span>' : '<span class="pill bad">incomplet</span>'} Copies traitées : <b>${p.done} / ${p.total}</b>${p.missing ? ` · ${p.missing} sans note` : ''}</div>
      <div class="row">${p.arb === 0 ? '<span class="pill ok">conforme</span>' : '<span class="pill warn">à arbitrer</span>'} Double correction : ${e.double ? `${p.arb} copie(s) en attente de troisième note` : 'non requise'}</div>
      <div class="row"><span class="pill ${S.ui.role === 'coordination' ? 'ok' : 'neutral'}">${S.ui.role === 'coordination' ? 'déverrouillé' : 'PIN requis'}</span> Profil coordination</div>
      <div class="row" style="margin-top:6px"><button class="btn gold" data-act="lift">${ic('unlock')}Lever l’anonymat</button></div></div></div>`}
    <div id="res-body" class="stack"></div>`;
  $('#rs-sel', el).onchange = ev => { S.ui.sel.reval = ev.target.value; render(); };
  const lift = $('[data-act=lift]', el);
  if (lift) lift.onclick = async () => {
    if (!(await requireCoord('Lever l’anonymat d’une épreuve.'))) return;
    const force = p.missing > 0 || p.arb > 0;
    if (!(await confirmBox('Lever l’anonymat', `${esc(evalLabel(e))} · ${levelById(e.level).nom}<br><br>${p.done} copie(s) traitée(s) sur ${p.total}.${force ? `<br><b style="color:var(--bad)">${p.missing} copie(s) sans note finale : elles apparaîtront comme non rendues.</b>` : ''}<br><br>Les noms deviendront visibles pour tous les utilisateurs de la base.`, force ? 'Lever malgré tout' : 'Lever l’anonymat', force))) return;
    e.anon = { lifted: true, at: Date.now(), by: S.caps.userName || 'Coordination', forced: force, missing: p.missing };
    e.status = 'desanonymisee'; await saveEval(e); audit('Levée d’anonymat', `${evalShort(e)} ${levelById(e.level).roman} : ${p.done}/${p.total} copies${force ? ' (forcée)' : ''}`, e.level);
    toast('Anonymat levé.', 'ok'); render();
  };
  const body = $('#res-body', el);
  if (!lifted) { body.innerHTML = `<div class="panel empty"><h3>Résultats masqués</h3><p>Les notes restent liées à des codes tant que l’anonymat n’est pas levé.</p></div>`; return; }
  const res = resultsByClass(e); const cids = e.classes.filter(c => S.classes[c]).sort((a, b) => S.classes[a].rang - S.classes[b].rang);
  let cid = S.ui.sel.rcls; if (!cids.includes(cid)) cid = cids[0]; S.ui.sel.rcls = cid;
  const rows = withRanks(res[cid] || []); const st = statsOf(rows.map(r => r.note)); const g = statsOf(Object.values(res).flat().map(r => r.note));
  body.innerHTML = `<div class="panel"><header><h3>Éditions</h3>${e.status === 'cloturee' ? '<span class="pill ok">clôturée</span>' : ''}</header><div class="row">
      <button class="btn primary" data-x="releves">${ic('print')}Relevés de toutes les classes (1 PDF)</button><button class="btn" data-x="pv">${ic('file')}Procès-verbal</button><button class="btn" data-x="stats">${ic('chart')}Rapport statistique</button><button class="btn" data-x="xlsx">${ic('download')}Excel</button>
      ${e.status !== 'cloturee' ? `<button class="btn" data-x="close">${ic('lock')}Clôturer</button>` : ''}</div></div>
    <div class="grid g4">${kpi(fmtNote(g.mean), 'Moyenne du niveau', `${g.n} copies notées`)}${kpi(g.rate === null ? '—' : fmtNote(g.rate) + ' %', 'Taux de réussite', `notes ≥ ${S.settings.seuilReussite}`)}${kpi(`${fmtNote(g.min)} · ${fmtNote(g.max)}`, 'Note mini · maxi')}${kpi(fmtNote(g.sd), 'Écart-type')}</div>
    <div class="tabs">${cids.map(c => `<button data-c="${c}" class="${c === cid ? 'on' : ''}">${esc(S.classes[c].nom)}</button>`).join('')}</div>
    <div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:start" id="rs-grid">
      <div class="tw"><table class="t"><thead><tr><th>N°</th><th>Noms et prénoms</th><th>Matricule</th><th class="c">Table</th><th class="r">Note / 20</th><th class="c">Rang</th><th>Appréciation</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td class="muted num">${i + 1}</td><td><b>${esc(r.name)}</b></td><td class="mono small">${esc(r.mat)}</td><td class="c mono small">${pad(r.table, 3)}</td><td class="r num"><b style="color:${r.note !== null && r.note < (+S.settings.seuilReussite || 10) ? 'var(--bad)' : 'inherit'}">${r.note === null ? esc(r.st === 'P' ? 'non rendue' : r.st) : fmtNote(r.note)}</b>${r.mark?.corr ? ' <span class="pill warn plain" title="' + esc(r.mark.corr) + '">corrigée</span>' : ''}</td><td class="c num">${r.rang || ''}</td><td class="small">${appreciation(r.note)}</td></tr>`).join('')}</tbody></table></div>
      <div class="stack"><div class="panel"><header><h3>${esc(S.classes[cid].nom)}</h3><span class="small muted">${esc(teacherOf(cid, e.subj))}</span></header><div class="grid g2" style="grid-template-columns:1fr 1fr">${kpi(fmtNote(st.mean), 'Moyenne')}${kpi(st.rate === null ? '—' : fmtNote(st.rate) + ' %', 'Réussite')}</div></div>
        <div class="panel"><header><h3>Répartition des notes</h3></header>${barChartSvg(BIN_LABELS.map((l, i) => ({ l: l.replace(/[\[\]]/g, '').replace(' ; ', '–'), v: st.bins[i] })), { fmt: v => String(v), h: 170 })}</div></div></div>`;
  if (window.innerWidth < 900) $('#rs-grid', body).style.gridTemplateColumns = 'minmax(0,1fr)';
  $$('[data-c]', body).forEach(b => b.onclick = () => { S.ui.sel.rcls = b.dataset.c; render(); });
  const base = `${fileSafe(subjByCode(e.subj).abbr)}-${e.level}-t${e.trim}s${e.sit}`;
  $$('[data-x]', body).forEach(b => b.onclick = async () => {
    const k = b.dataset.x;
    if (k === 'releves') runPdf(`releves-${base}.pdf`, 'Relevés de notes', doc => addReleves(doc, [e]));
    if (k === 'pv') runPdf(`pv-levee-anonymat-${base}.pdf`, 'PV de levée d’anonymat', doc => addPV(doc, e));
    if (k === 'stats') runPdf(`statistiques-${base}.pdf`, 'Rapport statistique', doc => addStats(doc, [e]));
    if (k === 'xlsx') xlsxSave(`notes-${base}.xlsx`, cids.map(c => ({ name: S.classes[c].nom, rows: [[`${subjByCode(e.subj).nom} · T${e.trim} S${e.sit} · ${fmtDate(e.date, 'short')}`], ['N°', 'Matricule', 'Noms et prénoms', 'Sexe', 'Note /20', 'Rang', 'Appréciation'], ...withRanks(res[c] || []).map((r, i) => [i + 1, r.mat, r.name, r.sexe, r.note === null ? r.st : Math.round(r.note * 100) / 100, r.rang || '', appreciation(r.note)])], cols: [5, 12, 34, 6, 9, 6, 16] })));
    if (k === 'close') { if (!(await requireCoord('Clôturer l’épreuve : plus aucune note ne pourra être modifiée.'))) return; if (await confirmBox('Clôturer l’épreuve', 'Après clôture, les notes sont figées.', 'Clôturer')) { e.status = 'cloturee'; await saveEval(e); audit('Clôture', `${evalShort(e)} ${levelById(e.level).roman}`, e.level); render(); } }
  });
};

/* =====================================================================
   Statistiques, centre d'impression, journal, paramètres
   ===================================================================== */
V.statistiques = el => {
  const lvIds = levelsInScope(); const sit = +(S.ui.sel.ssit ?? curSit());
  const evs = Object.values(S.evals).filter(e => lvIds.includes(e.level) && e.anon?.lifted && (!sit || e.sit === sit));
  el.innerHTML = pageHead('Statistiques', 'Calculées sur les épreuves dont l’anonymat est levé. Moyennes brutes sur 20, sans coefficient.',
    `<label class="f" style="flex-direction:row;align-items:center;gap:6px">Situation<select class="in" id="ss" style="width:auto"><option value="0" ${!sit ? 'selected' : ''}>Toutes</option>${sitOpts(sit)}</select></label><button class="btn" data-act="xlsx">${ic('download')}Excel</button><button class="btn primary" data-act="pdf">${ic('print')}Rapport PDF</button>`) +
    (evs.length ? lvIds.map(lv => statsLevel(lv, evs.filter(e => e.level === lv))).join('') : '<div class="panel empty"><h3>Pas encore de résultats</h3><p>Les tableaux apparaissent après la première levée d’anonymat.</p></div>');
  $('#ss', el).onchange = ev => { S.ui.sel.ssit = +ev.target.value; render(); };
  $('[data-act=pdf]', el).onclick = () => evs.length ? runPdf(`rapport-statistique-${sit ? 's' + sit : 'annee'}.pdf`, 'Rapport statistique', doc => addStats(doc, evs)) : toast('Aucune épreuve désanonymisée.', 'bad');
  $('[data-act=xlsx]', el).onclick = () => { if (!evs.length) return toast('Aucune donnée.', 'bad'); xlsxSave(`statistiques-${sit ? 's' + sit : 'annee'}.xlsx`, lvIds.map(lv => { const t = crossTable(lv, evs.filter(e => e.level === lv)); return { name: levelById(lv).nom, rows: [['Matière', ...t.cls.map(c => c.nom), 'Niveau'], ...t.subs.map(s => [s.nom, ...t.cls.map(c => t.cell[s.code + c.id] ?? ''), t.rowMean[s.code] ?? '']), ['Moyenne', ...t.cls.map(c => t.colMean[c.id] ?? ''), '']] }; })); };
  $$('[data-subj-chart]', el).forEach(s => s.onchange = () => { S.ui.sel['sc_' + s.dataset.subjChart] = s.value; render(); });
};
function crossTable(lv, evs) {
  const cls = classesOf(lv); const subs = S.subjects.filter(s => evs.some(e => e.subj === s.code)); const cell = {}, rowMean = {}, colVals = {};
  subs.forEach(s => { const all = []; cls.forEach(c => { const vals = []; evs.filter(e => e.subj === s.code && e.classes.includes(c.id)).forEach(e => (resultsByClass(e)[c.id] || []).forEach(r => r.note !== null && vals.push(r.note))); if (vals.length) { const m = statsOf(vals).mean; cell[s.code + c.id] = Math.round(m * 100) / 100; (colVals[c.id] = colVals[c.id] || []).push(...vals); all.push(...vals); } }); if (all.length) rowMean[s.code] = Math.round(statsOf(all).mean * 100) / 100; });
  const colMean = {}; Object.entries(colVals).forEach(([k, v]) => colMean[k] = Math.round(statsOf(v).mean * 100) / 100);
  return { cls, subs, cell, rowMean, colMean };
}
function statsLevel(lv, evs) {
  if (!evs.length) return `<div class="panel"><header><h3>${levelById(lv).nom}</h3></header><p class="muted small">Aucune épreuve désanonymisée.</p></div>`;
  const t = crossTable(lv, evs); const seuil = +S.settings.seuilReussite || 10;
  const color = v => v === undefined ? '' : v < seuil - 2 ? 'background:var(--bad-soft);color:var(--bad)' : v < seuil ? 'background:var(--warn-soft);color:var(--warn)' : v >= seuil + 3 ? 'background:var(--ok-soft);color:var(--ok)' : '';
  const sc = S.ui.sel['sc_' + lv] || t.subs[0]?.code;
  const chartData = t.cls.map(c => ({ l: c.nom, v: t.cell[sc + c.id] ?? null })).filter(d => d.v !== null);
  return `<div class="panel"><header><h3>${levelById(lv).nom} · moyennes par matière et par classe</h3><div class="legend"><span><i style="background:var(--bad-soft)"></i>&lt; ${seuil - 2}</span><span><i style="background:var(--warn-soft)"></i>&lt; ${seuil}</span><span><i style="background:var(--ok-soft)"></i>≥ ${seuil + 3}</span></div></header>
    <div class="tw"><table class="t"><thead><tr><th>Matière</th>${t.cls.map(c => `<th class="c mono">${esc(c.nom)}</th>`).join('')}<th class="c">Niveau</th></tr></thead><tbody>${t.subs.map(s => `<tr><td><b>${esc(s.abbr)}</b> <span class="small muted">${esc(s.nom)}</span></td>${t.cls.map(c => { const v = t.cell[s.code + c.id]; return `<td class="c num" style="${color(v)}">${v === undefined ? '' : fmtNote(v)}</td>`; }).join('')}<td class="c num"><b>${fmtNote(t.rowMean[s.code])}</b></td></tr>`).join('')}<tr><td><b>Toutes matières</b></td>${t.cls.map(c => `<td class="c num"><b>${fmtNote(t.colMean[c.id])}</b></td>`).join('')}<td></td></tr></tbody></table></div>
    <div class="row" style="margin-top:14px"><b>Comparaison des classes en</b><select class="in" data-subj-chart="${lv}" style="width:auto">${subjOpts(sc, t.subs)}</select></div>${barChartSvg(chartData, { max: 20, ref: seuil, h: 200 })}</div>`;
}

/* ---------- Centre d'impression ---------- */
V.editions = el => {
  const lvIds = levelsInScope(); const all = scopeEvals(e => !!e.placement);
  const dates = [...new Set(all.map(e => e.date))].sort();
  const dSel = S.ui.sel.pdate && dates.includes(S.ui.sel.pdate) ? S.ui.sel.pdate : (dates.find(d => d >= todayISO()) || dates[dates.length - 1] || todayISO()); S.ui.sel.pdate = dSel;
  const ofDate = all.filter(e => e.date === dSel);
  const sit = curSit(); const ofSit = scopeEvals(e => e.sit === sit);
  el.innerHTML = pageHead('Centre d’impression', 'Chaque édition regroupe toutes les classes, salles ou épreuves choisies dans un seul fichier PDF, prêt à imprimer en une fois.') + `
    <div class="panel"><header><h3>Éditions par date d’épreuve</h3></header>
      ${dates.length ? `<div class="fgrid"><label class="f">Date<select class="in" id="pd">${optList(dates.map(d => [d, fmtDate(d)]), dSel)}</select></label></div>
      <div class="stack" style="margin-top:12px"><b class="small">Épreuves de ce jour (cochez celles à éditer)</b><div class="row" id="pev">${ofDate.map(e => `<label class="check pill neutral plain" style="padding:4px 10px"><input type="checkbox" value="${e.id}" checked> ${levelById(e.level).roman} · ${esc(subjByCode(e.subj).abbr)} · ${e.start}</label>`).join('')}</div></div>
      <div class="grid g3" style="margin-top:14px">
        ${printCard('listes', 'Listes de classe avec codes-barres', 'Toutes les classes du niveau pour la même matière et la même date, une classe par page, émargement compris.')}
        ${printCard('emarg', 'Émargement et PV de salle', 'Une liste par salle triée par numéro de table, avec le procès-verbal de salle à signer.')}
        ${printCard('etiq', 'Étiquettes adhésives', 'Planches A4 : étiquette nominative pour l’en-tête détachable et étiquette anonyme pour la copie.')}
        ${printCard('bord', 'Bordereaux de notation', `Lots de ${S.settings.tailleLot} copies anonymes, avec cases de note, à remettre aux correcteurs.`)}
        ${printCard('corr', 'Tables de correspondance', 'Code ↔ élève, à placer sous pli scellé. Réservé à la coordination.')}
        ${printCard('dossier', 'Dossier complet du jour', 'Sommaire, émargements, listes de classe et bordereaux de toutes les épreuves cochées.', true)}
      </div>` : '<div class="empty small">Aucune épreuve n’a encore ses codes-barres. Générez une répartition depuis « Préparation et codes-barres ».</div>'}</div>
    <div class="panel"><header><h3>Éditions de la situation ${sit}</h3><span class="small muted">${ofSit.length} épreuve(s)</span></header><div class="grid g3">
      ${printCard('planning', 'Planning de la situation', 'Tableau paysage par préfecture : dates, créneaux, classes, salles, statut.')}
      ${printCard('releves', 'Relevés de notes', 'Toutes les épreuves désanonymisées de la situation, une classe par page.')}
      ${printCard('stats', 'Rapport statistique', 'Moyennes, taux de réussite, répartition et palmarès par épreuve.')}
      ${printCard('xlsx', 'Notes en Excel', 'Un classeur : une feuille par classe, une colonne par matière.')}
    </div></div>
    <div class="panel"><header><h3>Fiches de suivi des élèves</h3></header><div class="row"><select class="in" id="fcls" style="width:auto">${optList(lvIds.flatMap(classesOf).map(c => [c.id, c.nom]), '')}</select><button class="btn" data-p="fiches">${ic('print')}Fiches de toute la classe (1 PDF)</button></div></div>`;
  $('#pd', el)?.addEventListener('change', ev => { S.ui.sel.pdate = ev.target.value; render(); });
  const chosen = () => $$('#pev input:checked', el).map(i => S.evals[i.value]);
  const tag = `${dSel}-${fileSafe(scopeLabel())}`;
  $$('[data-p]', el).forEach(b => b.onclick = async () => {
    const k = b.dataset.p; const evs = chosen();
    const needEv = ['listes', 'emarg', 'etiq', 'bord', 'corr', 'dossier'].includes(k);
    if (needEv && !evs.length) return toast('Cochez au moins une épreuve.', 'bad');
    if (k === 'listes') runPdf(`listes-classe-${tag}.pdf`, 'Listes de classe', doc => addListesClasse(doc, evs));
    if (k === 'emarg') runPdf(`emargement-${tag}.pdf`, 'Émargement', doc => addEmargement(doc, evs));
    if (k === 'etiq') labelDialog(evs, tag);
    if (k === 'bord') runPdf(`bordereaux-${tag}.pdf`, 'Bordereaux', doc => addBordereaux(doc, evs));
    if (k === 'corr') { if (await requireCoord('Éditer les tables de correspondance.')) runPdf(`correspondance-${tag}.pdf`, 'Correspondance', doc => addCorrespondance(doc, evs)); }
    if (k === 'dossier') dossierDialog(evs, tag);
    if (k === 'planning') runPdf(`planning-s${sit}-${fileSafe(scopeLabel())}.pdf`, 'Planning', doc => addPlanning(doc, lvIds, { sit }), 'l');
    if (k === 'releves') { const l = ofSit.filter(e => e.anon?.lifted); l.length ? runPdf(`releves-s${sit}-${fileSafe(scopeLabel())}.pdf`, 'Relevés de notes', doc => addReleves(doc, l)) : toast('Aucune épreuve désanonymisée dans cette situation.', 'bad'); }
    if (k === 'stats') { const l = ofSit.filter(e => e.anon?.lifted); l.length ? runPdf(`statistiques-s${sit}.pdf`, 'Rapport statistique', doc => addStats(doc, l)) : toast('Aucune épreuve désanonymisée.', 'bad'); }
    if (k === 'xlsx') exportSitXlsx(lvIds, ofSit.filter(e => e.anon?.lifted), sit);
    if (k === 'fiches') { const c = S.classes[$('#fcls', el).value]; if (c) runPdf(`fiches-suivi-${fileSafe(c.nom)}.pdf`, 'Fiches de suivi', doc => studentsOf(c).forEach(s => addFicheEleve(doc, s.id))); }
  });
};
const printCard = (k, t, d, primary) => `<div class="panel flat" style="background:var(--surface-2);display:flex;flex-direction:column;gap:8px"><h4>${t}</h4><p class="small muted" style="flex:1">${d}</p><div><button class="btn sm ${primary ? 'primary' : ''}" data-p="${k}">${ic('print')}Générer</button></div></div>`;
function dossierDialog(evs, tag) {
  openModal({ title: 'Dossier complet du jour', body: `<p class="small muted">${evs.length} épreuve(s). Tout sort dans un seul PDF, dans l’ordre ci-dessous.</p><label class="check"><input type="checkbox" id="d1" checked> Listes d’émargement et PV par salle</label><label class="check"><input type="checkbox" id="d2" checked> Listes de classe avec codes-barres</label><label class="check"><input type="checkbox" id="d3" checked> Bordereaux de notation anonymes</label><label class="check"><input type="checkbox" id="d4"> Tables de correspondance (coordination)</label>`,
    actions: [{ label: 'Annuler' }, { label: `${ic('print')}Générer`, cls: 'primary', onClick: async (close, m) => { const o = { emarg: $('#d1', m).checked, listes: $('#d2', m).checked, bord: $('#d3', m).checked, corr: $('#d4', m).checked }; close(); if (o.corr && !(await requireCoord('Inclure les tables de correspondance.'))) o.corr = false; runPdf(`dossier-${tag}.pdf`, 'Dossier du jour', doc => addDossierJournee(doc, evs, o)); } }] });
}
function exportSitXlsx(lvIds, evs, sit) {
  if (!evs.length) return toast('Aucune épreuve désanonymisée dans cette situation.', 'bad');
  const sheets = [];
  lvIds.forEach(lv => classesOf(lv).forEach(c => { const es = evs.filter(e => e.classes.includes(c.id)).sort((a, b) => a.subj.localeCompare(b.subj)); if (!es.length) return;
    const res = es.map(e => resultsByClass(e)[c.id] || []);
    const rows = [['Matricule', 'Noms et prénoms', 'Sexe', ...es.map(e => `${subjByCode(e.subj).abbr} (coef ${c.subjects.find(s => s.m === e.subj)?.coef ?? '?'})`)]];
    studentsOf(c).forEach(s => rows.push([s.mat, fullName(s), s.sexe, ...res.map(r => { const x = r.find(z => z.sid === s.id); return x ? (x.note === null ? x.st : Math.round(x.note * 100) / 100) : ''; })]));
    sheets.push({ name: c.nom, rows, cols: [12, 34, 6, ...es.map(() => 12)] }); }));
  xlsxSave(`notes-situation-${sit}.xlsx`, sheets);
}

/* ---------- Journal d'audit ---------- */
V.journal = el => {
  el.innerHTML = pageHead('Journal d’audit', 'Chaque action sensible est horodatée : imports, répartitions, notes modifiées, levées d’anonymat, éditions.', `<button class="btn" data-act="csv">${ic('download')}Exporter (Excel)</button>`) + '<div id="jl" class="panel"><div class="row"><span class="spin"></span>Chargement…</div></div>';
  (async () => {
    const days = await S.store.list('logs'); const entries = [];
    days.forEach(d => Object.values(d.data.entries || {}).forEach(x => entries.push(x)));
    entries.sort((a, b) => b.at - a.at);
    const lvIds = levelsInScope(); const shown = entries.filter(x => S.ui.level === 'all' || !x.level || lvIds.includes(x.level) || x.level === 'all').slice(0, 400);
    const names = {}; const ids = [...new Set(shown.map(x => x.uid).filter(Boolean))];
    if (ids.length && S.caps.user) { try { const ps = await S.caps.user.profiles(ids); Object.entries(ps || {}).forEach(([k, p]) => { if (p && p.name) names[k] = p.name; }); } catch (e) { } }
    const box = $('#jl', el); if (!box) return;
    box.outerHTML = `<div class="tw"><table class="t"><thead><tr><th>Date et heure</th><th>Utilisateur</th><th>Action</th><th>Détail</th></tr></thead><tbody>${shown.map(x => `<tr><td class="small mono">${fmtDT(x.at)}</td><td class="small">${esc(names[x.uid] || x.who)}${x.role === 'coordination' ? ' <span class="pill gold plain">coord.</span>' : ''}</td><td><b>${esc(x.action)}</b></td><td class="small">${esc(x.detail)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">Journal vide.</div></td></tr>'}</tbody></table></div>`;
    $('[data-act=csv]', el).onclick = () => xlsxSave('journal-audit.xlsx', [{ name: 'Journal', rows: [['Date', 'Utilisateur', 'Profil', 'Niveau', 'Action', 'Détail'], ...entries.map(x => [fmtDT(x.at), names[x.uid] || x.who, x.role, x.level, x.action, x.detail])], cols: [18, 22, 12, 8, 22, 80] }]);
  })();
};

/* ---------- Paramètres ---------- */
V.parametres = el => {
  const st = S.settings;
  el.innerHTML = pageHead('Paramètres et sauvegarde', 'Identité de l’établissement, en-têtes des documents, règles de saisie, sécurité et sauvegardes.') + `
  <div class="grid g2">
    <div class="panel"><header><h3>Établissement</h3></header><div class="stack">
      <div class="fgrid"><label class="f">Nom<input class="in" id="p-etab" value="${esc(st.etab)}"></label><label class="f">Sigle<input class="in" id="p-sigle" value="${esc(st.sigle)}"></label><label class="f">Ville<input class="in" id="p-ville" value="${esc(st.ville)}"></label><label class="f">Année scolaire<input class="in" id="p-annee" value="${esc(st.annee)}"></label></div>
      <label class="f">Tutelle<input class="in" id="p-tut" value="${esc(st.tutelle)}"></label>
      <div class="fgrid"><label class="f">Coordonnateur<input class="in" id="p-coord" value="${esc(st.coordo)}"></label><label class="f">Fonction<input class="in" id="p-coordt" value="${esc(st.coordoTitre)}"></label></div>
      <div class="fgrid">${LEVELS.map(l => `<label class="f">Préfet de ${l.nom}<input class="in" data-pref="${l.id}" value="${esc(st.prefets?.[l.id] || '')}"></label>`).join('')}</div>
      <div class="row" style="align-items:center">${logoHTML('logo')}<style>.panel .logo{width:64px;height:64px}</style><label class="btn">${ic('upload')}Charger le logo<input type="file" id="p-logo" accept="image/png,image/jpeg" hidden></label>${st.logo && st.logo !== DEFAULT_LOGO ? `<button class="btn ghost" data-act="nologo">Revenir au logo du collège</button>` : '<span class="small muted">Logo du Collège François-Xavier Vogt utilisé par défaut.</span>'}</div>
    </div></div>
    <div class="panel"><header><h3>En-tête des PDF</h3></header><div class="fgrid" style="margin-bottom:10px"><label class="f">Modèle d’en-tête<select class="in" id="p-style">${optList([['etablissement', 'Établissement : tableau encadré avec logo (modèle du collège)'], ['officiel', 'Officiel bilingue : République du Cameroun']], st.pdfStyle)}</select></label><label class="f">Service (modèle établissement)<input class="in" id="p-dep" value="${esc(st.departement || '')}"></label></div><div class="fgrid"><label class="f">Colonne française<textarea class="in" id="p-fr" rows="6">${esc(st.enteteFR)}</textarea></label><label class="f">Colonne anglaise<textarea class="in" id="p-en" rows="6">${esc(st.enteteEN)}</textarea></label></div><p class="small muted">Une ligne par niveau hiérarchique. Le logo s’insère au centre.</p></div>
    <div class="panel"><header><h3>Règles d’évaluation</h3></header><div class="fgrid">
      <label class="f">Situation courante par défaut<select class="in" id="p-sit">${sitOpts(st.sitCourante)}</select></label>
      <label class="f">Seuil de réussite (/20)<input class="in num" type="number" step="0.5" id="p-seuil" value="${st.seuilReussite}"></label>
      <label class="f">Délai de saisie (jours)<input class="in num" type="number" id="p-delai" value="${st.delaiSaisie}"></label>
      <label class="f">Copies par bordereau<input class="in num" type="number" id="p-lot" value="${st.tailleLot}"></label>
      <label class="f">Écart déclenchant un arbitrage<input class="in num" type="number" step="0.5" id="p-ecart" value="${st.ecartDouble}"></label></div></div>
    <div class="panel"><header><h3>Sécurité</h3></header><div class="stack">
      <p class="small">${S.security.pinHash ? '<span class="pill ok">PIN défini</span> Les actions sensibles demandent le PIN de la coordination.' : '<span class="pill warn">aucun PIN</span> Définissez un PIN pour protéger la levée d’anonymat, les corrections et les suppressions.'}</p>
      <div class="fgrid"><label class="f">Nouveau PIN (4 à 8 chiffres)<input class="in mono" type="password" id="p-pin" inputmode="numeric" autocomplete="new-password"></label><label class="f">Confirmation<input class="in mono" type="password" id="p-pin2" inputmode="numeric" autocomplete="new-password"></label></div>
      <div class="row"><button class="btn" data-act="pin">${ic('lock')}Enregistrer le PIN</button>${S.security.pinHash ? `<button class="btn ghost" data-act="pinreset">PIN oublié</button>` : ''}</div>
      <p class="tiny muted">Le PIN est stocké sous forme d’empreinte SHA-256. Il protège l’interface ; la confidentialité repose aussi sur la liste des personnes qui ont accès à l’application.</p></div></div>
  </div>
  <div class="row"><button class="btn primary" data-act="save">${ic('check')}Enregistrer les paramètres</button></div>
  ${cloudPanelHTML()}
  <div class="grid g2">
    <div class="panel"><header><h3>Sauvegarde et restauration</h3><span class="pill ${['shared', 'cloud'].includes(S.mode) ? 'ok' : 'info'}">${esc(modeLabel())}</span></header><div class="stack">
      <p class="small muted">La sauvegarde contient toute la base : paramètres, classes, élèves, enseignants, salles, épreuves et notes. Conservez-la sur une clé USB après chaque séance de saisie.</p>
      <div class="row"><button class="btn" data-act="backup">${ic('download')}Télécharger la sauvegarde (.json)</button><label class="btn">${ic('upload')}Restaurer<input type="file" id="p-restore" accept=".json,application/json" hidden></label></div></div></div>
    <div class="panel"><header><h3>Zone sensible</h3></header><div class="stack">
      <p class="small muted">Nouvelle année : archive d’abord la base, puis efface épreuves et notes en gardant classes, matières, enseignants et salles.</p>
      <div class="row"><button class="btn danger" data-act="newyear">${ic('refresh')}Préparer une nouvelle année</button><button class="btn danger" data-act="wipe">${ic('trash')}Tout effacer</button></div></div></div></div>
  <p class="tiny muted">${APP.name} · version ${APP.version} · proposé par ${esc(st.coordo)}, ${esc(st.coordoTitre)}.</p>`;
  bindCloudPanel(el);
  $('#p-logo', el).onchange = ev => { const f = ev.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = async () => { const c = document.createElement('canvas'); const k = Math.min(1, 320 / Math.max(img.width, img.height)); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); S.settings.logo = c.toDataURL('image/png'); await saveSettings(); audit('Paramètres', 'Logo mis à jour'); toast('Logo enregistré.', 'ok'); render(); }; img.src = fr.result; }; fr.readAsDataURL(f); };
  $$('[data-act]', el).forEach(b => b.onclick = async () => {
    const a = b.dataset.act;
    if (a === 'nologo') { S.settings.logo = ''; await saveSettings(); render(); }
    if (a === 'save') { const v = id => $(id, el).value; Object.assign(S.settings, { etab: v('#p-etab'), sigle: v('#p-sigle'), ville: v('#p-ville'), annee: v('#p-annee'), tutelle: v('#p-tut'), coordo: v('#p-coord'), coordoTitre: v('#p-coordt'), enteteFR: v('#p-fr'), enteteEN: v('#p-en'), pdfStyle: v('#p-style'), departement: v('#p-dep'), sitCourante: +v('#p-sit'), trimCourant: trimOfSit(+v('#p-sit')), seuilReussite: +v('#p-seuil') || 10, delaiSaisie: +v('#p-delai') || 7, tailleLot: +v('#p-lot') || 25, ecartDouble: +v('#p-ecart') || 3 }); S.settings.prefets = {}; $$('[data-pref]', el).forEach(i => S.settings.prefets[i.dataset.pref] = i.value.trim()); await saveSettings(); audit('Paramètres', 'Paramètres modifiés'); toast('Paramètres enregistrés.', 'ok'); render(); }
    if (a === 'pin') { const p1 = $('#p-pin', el).value, p2 = $('#p-pin2', el).value; if (!/^\d{4,8}$/.test(p1) || p1 !== p2) return toast('PIN de 4 à 8 chiffres, identique dans les deux champs.', 'bad'); if (S.security.pinHash && !(await requireCoord('Changer le PIN.'))) return; S.security.pinHash = await sha256('astraluz:' + p1); await S.store.set('cfg/security', S.security); audit('Sécurité', 'PIN de la coordination défini'); toast('PIN enregistré.', 'ok'); render(); }
    if (a === 'pinreset') { const allowed = S.mode === 'shared' ? !!(await S.caps.user?.isOwner?.()) : true; if (!allowed) return toast('Seul le propriétaire de l’application peut effacer le PIN.', 'bad'); if (!(await confirmBox('Effacer le PIN', 'Le PIN de la coordination sera supprimé. Définissez-en un nouveau aussitôt après.', 'Effacer le PIN', true))) return; S.security = {}; await S.store.set('cfg/security', {}); S.ui.role = 'secretariat'; S.ui.unlocked = false; audit('Sécurité', 'PIN effacé (PIN oublié)'); toast('PIN effacé.', 'ok'); render(); }
    if (a === 'backup') { const logs = await S.store.list('logs'); const dump = { app: APP.name, version: APP.version, at: new Date().toISOString(), mode: S.mode, settings: S.settings, subjects: S.subjects, teachers: S.teachers, rooms: S.rooms, classes: S.classes, evals: S.evals, logs }; saveBlob(`sauvegarde-astraluz-${todayISO()}.json`, new Blob([JSON.stringify(dump)], { type: 'application/json' })); audit('Sauvegarde', 'Export complet de la base'); }
    if (a === 'newyear') { if (!(await requireCoord('Préparer une nouvelle année.'))) return; if (!(await confirmBox('Nouvelle année', 'Toutes les épreuves et toutes les notes seront effacées. Avez-vous téléchargé la sauvegarde de l’année ?', 'Effacer épreuves et notes', true))) return; await withBusy('Nettoyage…', async () => { for (const id of Object.keys(S.evals)) await S.store.delete('evals/' + id); S.evals = {}; }); audit('Nouvelle année', 'Épreuves et notes effacées'); render(); }
    if (a === 'wipe') { if (!(await requireCoord('Tout effacer.'))) return; if (!(await confirmBox('Tout effacer', 'La base sera entièrement vidée. Cette opération est irréversible sans sauvegarde.', 'Tout effacer', true))) return; await withBusy('Effacement…', async () => { const paths = ['cfg/settings', 'cfg/subjects', 'cfg/teachers', 'cfg/rooms', 'cfg/security', ...Object.keys(S.classes).map(k => 'classes/' + k), ...Object.keys(S.evals).map(k => 'evals/' + k), ...(await S.store.list('logs')).map(d => 'logs/' + d.id)]; for (const p of paths) await S.store.delete(p); await loadAll(); }); S.ui.view = 'accueil'; location.hash = 'accueil'; render(); }
  });
  $('#p-restore', el).onchange = async ev => { const f = ev.target.files[0]; if (!f) return; if (!(await requireCoord('Restaurer une sauvegarde.'))) return; try { const d = JSON.parse(await f.text()); if (!d.settings || !d.classes) throw new Error('Fichier de sauvegarde non reconnu.'); if (!(await confirmBox('Restaurer', `Remplacer la base actuelle par la sauvegarde du ${esc(fmtDT(Date.parse(d.at)))} (${Object.keys(d.classes).length} classes, ${Object.keys(d.evals || {}).length} épreuves) ?`, 'Restaurer', true))) return; await withBusy('Restauration…', async () => { for (const k of Object.keys(S.evals)) if (!(d.evals || {})[k]) await S.store.delete('evals/' + k); for (const k of Object.keys(S.classes)) if (!d.classes[k]) await S.store.delete('classes/' + k); await S.store.set('cfg/settings', d.settings); await S.store.set('cfg/subjects', { list: d.subjects || [] }); await S.store.set('cfg/teachers', { list: d.teachers || [] }); await S.store.set('cfg/rooms', { list: d.rooms || [] }); await S.store.setMany([...Object.values(d.classes).map(c => ['classes/' + c.id, c]), ...Object.values(d.evals || {}).map(e => ['evals/' + e.id, e])]); await loadAll(); }); audit('Restauration', `Sauvegarde du ${d.at}`); toast('Base restaurée.', 'ok'); render(); } catch (e) { toast(e.message, 'bad'); } };
};

/* =====================================================================
   Base en ligne Firebase : stockage partagé, comptes nominatifs, rôles
   ===================================================================== */
const CLOUD = { db: null, auth: null, user: null, profile: null, cfg: null };
const ROLES = {
  coordination: 'Coordination', prefet: 'Préfet des études', secretariat: 'Secrétariat des évaluations',
  lecture: 'Lecture seule', attente: 'En attente de validation', desactive: 'Compte désactivé'
};
const LIBS = {
  jspdf: 'vendor/jspdf.umd.min.js', autotable: 'vendor/jspdf.plugin.autotable.min.js', xlsx: 'vendor/xlsx.full.min.js',
  fbapp: 'vendor/firebase-app-compat.js', fbauth: 'vendor/firebase-auth-compat.js', fbstore: 'vendor/firebase-firestore-compat.js'
};
const _loaded = {};
function loadScript(src) {
  if (_loaded[src]) return _loaded[src];
  _loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete _loaded[src]; rej(new Error('Chargement impossible : ' + src + '. Vérifiez la connexion.')); }; document.head.appendChild(s); });
  return _loaded[src];
}
async function ensurePdfLibs() { if (!window.jspdf) await loadScript(LIBS.jspdf); if (!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) await loadScript(LIBS.autotable); }
async function ensureXlsx() { if (!window.XLSX) await loadScript(LIBS.xlsx); }

/* Firestore refuse les tableaux imbriqués : [[a,b],[c,d]] devient [{__a:[a,b]},{__a:[c,d]}] */
function fbEncode(v) {
  if (Array.isArray(v)) return v.map(x => Array.isArray(x) ? { __a: fbEncode(x) } : fbEncode(x));
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = fbEncode(x); return o; }
  return v;
}
function fbDecode(v) {
  if (Array.isArray(v)) return v.map(fbDecode);
  if (v && typeof v === 'object') { const ks = Object.keys(v); if (ks.length === 1 && ks[0] === '__a' && Array.isArray(v.__a)) return fbDecode(v.__a); const o = {}; for (const [k, x] of Object.entries(v)) o[k] = fbDecode(x); return o; }
  return v;
}
function fbErr(e) {
  const c = String((e && e.code) || '');
  if (c.includes('permission-denied')) return 'Votre profil ne permet pas cette opération.';
  if (c.includes('unavailable')) return 'Base en ligne injoignable : la modification partira au retour de la connexion.';
  if (c.includes('resource-exhausted')) return 'Quota gratuit du jour atteint. Réessayez demain.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-login')) return 'Adresse e-mail ou mot de passe incorrect.';
  if (c.includes('email-already-in-use')) return 'Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ».';
  if (c.includes('weak-password')) return 'Mot de passe trop court : 8 caractères au moins.';
  if (c.includes('invalid-email')) return 'Adresse e-mail invalide.';
  if (c.includes('too-many-requests')) return 'Trop de tentatives. Patientez quelques minutes.';
  if (c.includes('network-request-failed')) return 'Pas de connexion Internet.';
  if (c.includes('operation-not-allowed')) return 'La connexion par e-mail n’est pas activée dans le projet Firebase (Authentication › Sign-in method).';
  return (e && e.message) || String(e);
}
class CloudStore {
  constructor(db) { this.db = db; this.kind = 'cloud'; }
  /* N'attend pas l'accusé du serveur au-delà de 2,5 s : hors connexion, l'écriture reste en file et part plus tard */
  async _w(p, ms = 2500) {
    let err = null; const done = p.then(() => true, e => { err = e; return true; });
    const ok = await Promise.race([done, sleep(ms).then(() => false)]);
    if (err) { toast(fbErr(err), 'bad'); return false; }
    if (!ok) p.catch(e => toast(fbErr(e), 'bad'));
    return true;
  }
  async get(path) { try { const s = await this.db.doc(path).get(); return s.exists ? fbDecode(s.data()) : null; } catch (e) { return null; } }
  async set(path, data) { return this._w(this.db.doc(path).set(fbEncode(clone(data)))); }
  async update(path, partial) { return this._w(this.db.doc(path).set(fbEncode(clone(partial)), { merge: true })); }
  async delete(path) { return this._w(this.db.doc(path).delete()); }
  /* Écritures groupées : lots de 40 documents au plus, 8 Mo au plus par lot */
  async setMany(entries) {
    let b = this.db.batch(), n = 0, size = 0; const commits = [];
    for (const [p, d] of entries) { const enc = fbEncode(clone(d)); const sz = JSON.stringify(enc).length; if (n && (n >= 40 || size + sz > 8e6)) { commits.push(b.commit()); b = this.db.batch(); n = 0; size = 0; } b.set(this.db.doc(p), enc); n++; size += sz; }
    if (n) commits.push(b.commit());
    return this._w(Promise.all(commits), 180000);
  }
  async list(col) { try { const q = await this.db.collection(col).get(); return q.docs.map(d => ({ id: d.id, data: fbDecode(d.data()) })); } catch (e) { return []; } }
  subscribe(col, cb) { try { return this.db.collection(col).onSnapshot(snap => { if (snap.metadata.hasPendingWrites) return; cb(snap.docs.map(d => ({ id: d.id, data: fbDecode(d.data()) }))); }, e => console.warn(col, e)); } catch (e) { return () => { }; } }
}

function cloudConfig() { return window.ASTRA_FIREBASE_CONFIG || lsGet('fbcfg', null); }
function parseFirebaseConfig(txt) {
  const o = {}; String(txt || '').replace(/["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g, (m, k, v) => { o[k] = v; return m; });
  if (!o.apiKey || !o.projectId || !o.appId) return null;
  if (!o.authDomain) o.authDomain = o.projectId + '.firebaseapp.com';
  return { apiKey: o.apiKey, authDomain: o.authDomain, projectId: o.projectId, storageBucket: o.storageBucket || '', messagingSenderId: o.messagingSenderId || '', appId: o.appId };
}
async function cloudBoot(cfg) {
  await loadScript(LIBS.fbapp); await Promise.all([loadScript(LIBS.fbauth), loadScript(LIBS.fbstore)]);
  const fb = window.firebase; fb.initializeApp(cfg);
  CLOUD.cfg = cfg; CLOUD.auth = fb.auth(); CLOUD.db = fb.firestore();
  try { CLOUD.db.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) { }
  if (window.ASTRA_EMULATOR) { CLOUD.auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true }); CLOUD.db.useEmulator('127.0.0.1', 8080); }
  else { try { await CLOUD.db.enablePersistence({ synchronizeTabs: true }); } catch (e) { } }
  return new Promise(res => {
    let first = true;
    CLOUD.auth.onAuthStateChanged(async u => {
      CLOUD.user = u;
      try { if (!u) { S.mode = 'cloud'; renderLogin(); } else await cloudEnter(u); } catch (e) { console.error(e); renderBlocked('Ouverture impossible : ' + fbErr(e)); }
      if (first) { first = false; res(); }
    });
  });
}
async function cloudEnter(u) {
  $('#app').innerHTML = splashHTML('Ouverture de votre espace…');
  const db = CLOUD.db; let prof = null;
  try { const s = await db.doc('users/' + u.uid).get(); prof = s.exists ? s.data() : null; } catch (e) { }
  if (!prof) {
    let owner = null; try { const o = await db.doc('cfg/owner').get(); owner = o.exists ? o.data() : null; } catch (e) { }
    const name = (lsGet('pendingName', '') || u.displayName || u.email.split('@')[0]).trim();
    if (!owner) {
      prof = { name, email: u.email, role: 'coordination', levels: [], createdAt: Date.now(), lastSeen: Date.now() };
      const b = db.batch(); b.set(db.doc('cfg/owner'), { uid: u.uid, email: u.email, at: Date.now() }); b.set(db.doc('users/' + u.uid), prof);
      try { await b.commit(); } catch (e) { return renderBlocked('Création du compte de coordination impossible : ' + fbErr(e) + ' Vérifiez que les règles de sécurité Firestore ont été publiées.'); }
      setTimeout(() => toast('Premier compte de cette base : vous êtes la coordination. Les comptes suivants attendront votre validation.', 'ok'), 600);
    } else {
      prof = { name, email: u.email, role: 'attente', levels: [], createdAt: Date.now(), lastSeen: Date.now() };
      try { await db.doc('users/' + u.uid).set(prof); } catch (e) { }
    }
  }
  CLOUD.profile = prof;
  if (prof.role === 'attente') return renderBlocked('Votre compte est créé. La coordination doit maintenant lui attribuer un rôle ; rechargez la page une fois prévenu.');
  if (prof.role === 'desactive') return renderBlocked('Ce compte est désactivé. Adressez-vous à la coordination du second cycle.');
  db.doc('users/' + u.uid).set({ lastSeen: Date.now(), email: u.email }, { merge: true }).catch(() => { });
  S.store = new CloudStore(db); S.mode = 'cloud';
  S.ui.role = prof.role === 'coordination' ? 'coordination' : 'secretariat'; S.ui.unlocked = prof.role === 'coordination';
  S.caps.userId = u.uid; S.caps.userName = prof.name || u.email;
  if (prof.role === 'prefet' && prof.levels?.length && (!S.ui.level || !prof.levels.includes(S.ui.level))) S.ui.level = prof.levels[0];
  await loadAll(); subscribeShared();
  if (!S.ui.sit) S.ui.sit = S.settings.sitCourante || 1;
  route();
}
const canWriteRole = () => S.mode !== 'cloud' || ['coordination', 'prefet', 'secretariat'].includes(CLOUD.profile?.role);
function splashHTML(msg) { return `<div class="home"><section class="hero" style="padding-bottom:60px"><div class="in-hero"><div class="bar-top"><div class="inst">${logoHTML()}<div><b>${esc(S.settings.etab)}</b><span>${esc(S.settings.tutelle)}</span></div></div></div><div class="ttl"><div class="eyebrow">Secrétariat des évaluations</div><h1>AI721 <em>ASTRA LUZ</em> 2.0</h1><p>${esc(msg)}</p></div></div></section></div>`; }
function renderBlocked(msg) {
  $('#app').innerHTML = `<div class="home"><section class="hero" style="padding-bottom:40px"><div class="in-hero"><div class="bar-top"><div class="inst">${logoHTML()}<div><b>${esc(S.settings.etab)}</b><span>AI721 ASTRA LUZ 2.0</span></div></div></div></div></section>
    <div class="prefs" style="margin-top:-20px;grid-template-columns:minmax(0,560px);justify-content:center"><div class="panel stack"><h2>Accès en attente</h2><p>${esc(msg)}</p><p class="small muted">Compte : ${esc(CLOUD.user?.email || '')}</p><div class="row"><button class="btn" id="bl-reload">${ic('refresh')}Recharger</button><button class="btn ghost" id="bl-out">Se déconnecter</button></div></div></div></div>`;
  $('#bl-reload').onclick = () => location.reload();
  $('#bl-out').onclick = () => CLOUD.auth.signOut();
}
function renderLogin() {
  const st = S.settings;
  $('#app').innerHTML = `<div class="home">
    <section class="hero" style="padding-bottom:110px"><canvas id="sky" aria-hidden="true"></canvas><div class="in-hero">
      <div class="bar-top"><div class="inst">${logoHTML()}<div><b>${esc(st.etab)}</b><span>${esc(st.tutelle)} · ${esc(st.ville)}</span></div></div><span class="modechip">Base en ligne sécurisée</span></div>
      <div class="ttl"><div class="eyebrow">Secrétariat des évaluations · second cycle · année scolaire ${esc(st.annee)}</div><h1>AI721 <em>ASTRA LUZ</em> 2.0</h1><p>Connectez-vous avec le compte nominatif que la coordination a validé. Chaque action est enregistrée sous votre nom au journal d’audit.</p></div>
    </div></section>
    <div class="prefs" style="grid-template-columns:minmax(0,440px);justify-content:center">
      <form class="panel stack" id="lg-form" autocomplete="on" style="padding:22px">
        <div class="tabs" role="tablist"><button type="button" class="on" data-lt="in">Se connecter</button><button type="button" data-lt="up">Créer un compte</button></div>
        <label class="f" id="lg-name-w" hidden>Nom et prénom<input class="in" id="lg-name" autocomplete="name" placeholder="M. NOM Prénom"></label>
        <label class="f">Adresse e-mail<input class="in" id="lg-email" type="email" autocomplete="username" required></label>
        <label class="f">Mot de passe<input class="in" id="lg-pw" type="password" autocomplete="current-password" required minlength="8"></label>
        <p class="small" id="lg-err" style="color:var(--bad);min-height:1.2em"></p>
        <button class="btn primary" id="lg-go" type="submit" style="justify-content:center">${ic('unlock')}Se connecter</button>
        <div class="row between small"><button type="button" class="btn ghost sm" id="lg-reset">Mot de passe oublié</button><button type="button" class="btn ghost sm" id="lg-demo">${ic('star')}Démonstration sans compte</button></div>
        <p class="tiny muted">Un nouveau compte reste en attente jusqu’à ce que la coordination lui attribue un rôle. Le tout premier compte créé sur une base vide devient le compte de coordination.</p>
      </form></div></div>`;
  drawSky();
  let mode = 'in'; const err = m => $('#lg-err').textContent = m || '';
  $$('[data-lt]').forEach(b => b.onclick = () => { mode = b.dataset.lt; $$('[data-lt]').forEach(x => x.classList.toggle('on', x === b)); $('#lg-name-w').hidden = mode !== 'up'; $('#lg-go').innerHTML = mode === 'up' ? `${ic('plus')}Créer mon compte` : `${ic('unlock')}Se connecter`; $('#lg-pw').autocomplete = mode === 'up' ? 'new-password' : 'current-password'; err(''); });
  $('#lg-form').onsubmit = async ev => {
    ev.preventDefault(); err(''); const email = $('#lg-email').value.trim(), pw = $('#lg-pw').value;
    const btn = $('#lg-go'); btn.disabled = true;
    try {
      if (mode === 'up') { const name = $('#lg-name').value.trim(); if (name.length < 3) { err('Indiquez votre nom et votre prénom.'); btn.disabled = false; return; } if (pw.length < 8) { err('Mot de passe trop court : 8 caractères au moins.'); btn.disabled = false; return; } lsSet('pendingName', name); const r = await CLOUD.auth.createUserWithEmailAndPassword(email, pw); try { await r.user.updateProfile({ displayName: name }); } catch (e) { } }
      else await CLOUD.auth.signInWithEmailAndPassword(email, pw);
    } catch (e) { err(fbErr(e)); btn.disabled = false; }
  };
  $('#lg-reset').onclick = async () => { const email = $('#lg-email').value.trim(); if (!email) return err('Saisissez d’abord votre adresse e-mail.'); try { await CLOUD.auth.sendPasswordResetEmail(email); toast('Lien de réinitialisation envoyé à ' + email + '. Pensez aux courriers indésirables.', 'ok'); } catch (e) { err(fbErr(e)); } };
  $('#lg-demo').onclick = async () => { lsSet('demo', true); S.cloudDemo = true; await switchMode('demo'); };
}
function userMenu() {
  const p = CLOUD.profile || {};
  openModal({ title: p.name || 'Mon compte', body: `<div class="copy-card"><div><span>Adresse</span><b style="font-size:13px">${esc(CLOUD.user?.email || '')}</b></div><div><span>Rôle</span><b style="font-size:13px">${esc(ROLES[p.role] || p.role)}</b></div>${p.levels?.length ? `<div><span>Préfecture</span><b style="font-size:13px">${p.levels.map(l => levelById(l)?.nom).join(', ')}</b></div>` : ''}</div><p class="small muted">Base en ligne : projet ${esc(CLOUD.cfg?.projectId || '')}.</p>`,
    actions: [{ label: 'Changer mon mot de passe', onClick: async () => { try { await CLOUD.auth.sendPasswordResetEmail(CLOUD.user.email); toast('Lien envoyé à ' + CLOUD.user.email + '.', 'ok'); } catch (e) { toast(fbErr(e), 'bad'); } return false; } }, { label: `${ic('x')}Se déconnecter`, cls: 'danger', onClick: async c => { c(); await CLOUD.auth.signOut(); location.hash = ''; } }] });
}

/* ---------- Écran : utilisateurs et rôles (coordination) ---------- */
V.utilisateurs = el => {
  if (S.mode !== 'cloud') { el.innerHTML = pageHead('Utilisateurs et rôles') + '<div class="panel empty"><h3>Comptes disponibles avec la base en ligne</h3><p>Connectez une base Firebase dans Paramètres pour gérer des comptes nominatifs.</p></div>'; return; }
  if (CLOUD.profile?.role !== 'coordination') { el.innerHTML = pageHead('Utilisateurs et rôles') + '<div class="panel empty"><h3>Écran réservé à la coordination</h3></div>'; return; }
  el.innerHTML = pageHead('Utilisateurs et rôles', 'Chaque personne crée son compte depuis la page de connexion. Le compte reste en attente jusqu’à ce que vous lui attribuiez un rôle ici. Les droits sont vérifiés par le serveur, pas seulement par l’écran.') +
    `<div class="tw"><table class="t"><thead><tr><th>Nom</th><th>Adresse e-mail</th><th>Rôle</th><th>Préfecture(s)</th><th>Dernière connexion</th><th></th></tr></thead><tbody id="us-body"><tr><td colspan="6"><span class="spin"></span></td></tr></tbody></table></div>
    <div class="panel"><header><h3>Ce que permet chaque rôle</h3></header><div class="tw"><table class="t"><thead><tr><th>Rôle</th><th>Droits</th></tr></thead><tbody>
      <tr><td><b>Coordination</b></td><td>Tout, dont la levée d’anonymat, les corrections après levée, la clôture, les suppressions, la restauration, les paramètres et la gestion des comptes.</td></tr>
      <tr><td><b>Préfet des études</b></td><td>Tout le travail du secrétariat, la modification des paramètres de l’établissement ; ouvre par défaut sa préfecture.</td></tr>
      <tr><td><b>Secrétariat des évaluations</b></td><td>Imports, planning, répartition, éditions, absences, saisie des notes sous code.</td></tr>
      <tr><td><b>Lecture seule</b></td><td>Consultation des plannings et des résultats désanonymisés, éditions PDF ; aucune écriture.</td></tr>
      <tr><td><b>Compte désactivé</b></td><td>Plus aucun accès ; l’historique du journal est conservé.</td></tr></tbody></table></div></div>`;
  (async () => {
    let users = []; try { const q = await CLOUD.db.collection('users').get(); users = q.docs.map(d => ({ uid: d.id, ...d.data() })); } catch (e) { toast(fbErr(e), 'bad'); }
    users.sort((a, b) => ((a.role === 'attente') ? -1 : 0) - ((b.role === 'attente') ? -1 : 0) || String(a.name).localeCompare(String(b.name), 'fr'));
    const body = $('#us-body', el); if (!body) return;
    body.innerHTML = users.map(u => `<tr data-uid="${esc(u.uid)}"><td><b>${esc(u.name || '')}</b>${u.uid === CLOUD.user.uid ? ' <span class="pill gold plain">vous</span>' : ''}${u.role === 'attente' ? ' <span class="pill warn">à valider</span>' : ''}</td><td class="small">${esc(u.email || '')}</td><td><select class="in us-role" ${u.uid === CLOUD.user.uid ? 'disabled' : ''}>${optList(Object.entries(ROLES), u.role)}</select></td><td><div class="row" style="gap:6px">${LEVELS.map(l => `<label class="check small"><input type="checkbox" class="us-lv" value="${l.id}" ${u.levels?.includes(l.id) ? 'checked' : ''}> ${l.roman}</label>`).join('')}</div></td><td class="small">${fmtDT(u.lastSeen)}</td><td class="r"><button class="btn sm primary us-save">Enregistrer</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun compte.</td></tr>';
    $$('.us-save', body).forEach(b => b.onclick = async () => { const tr = b.closest('tr'); const uid = tr.dataset.uid; const role = $('.us-role', tr).value; const levels = $$('.us-lv:checked', tr).map(i => i.value); try { await CLOUD.db.doc('users/' + uid).set({ role, levels }, { merge: true }); audit('Comptes', `${$('td b', tr).textContent} : rôle ${ROLES[role]}${levels.length ? ' (' + levels.join(', ') + ')' : ''}`); toast('Compte mis à jour.', 'ok'); } catch (e) { toast(fbErr(e), 'bad'); } });
  })();
};

/* ---------- Paramètres : connexion à la base en ligne ---------- */
function cloudPanelHTML() {
  if (S.mode === 'shared' || (!window.ASTRA_WEB && S.mode !== 'cloud')) return '';
  if (S.mode === 'cloud') return `<div class="panel"><header><h3>Base en ligne</h3><span class="pill ok">connectée</span></header><div class="fgrid"><label class="f">Projet Firebase<input class="in mono" value="${esc(CLOUD.cfg?.projectId || '')}" disabled></label><label class="f">Compte<input class="in" value="${esc(CLOUD.user?.email || '')}" disabled></label><label class="f">Rôle<input class="in" value="${esc(ROLES[CLOUD.profile?.role] || '')}" disabled></label></div><p class="small muted" style="margin-top:8px">Données hébergées par Google Firebase (offre gratuite Spark), synchronisées en temps réel et conservées sur chaque poste pour le travail hors connexion. ${CLOUD.profile?.role === 'coordination' ? 'Les comptes se gèrent dans « Utilisateurs et rôles ».' : ''}</p></div>`;
  const ls = lsGet('fbcfg', null);
  return `<div class="panel"><header><h3>Base en ligne (Firebase)</h3><span class="pill ${ls ? 'info' : 'neutral'}">${ls ? 'configurée sur ce poste' : 'non connectée'}</span></header><div class="stack">
    <p class="small">Pour partager les données entre tous les postes avec des comptes nominatifs, créez un projet Firebase gratuit (manuel, chapitre « Mise en ligne »), puis collez ici le bloc <span class="mono">firebaseConfig</span> affiché par la console Firebase.</p>
    <textarea class="in mono" id="fb-cfg" rows="7" placeholder="const firebaseConfig = {\n  apiKey: &quot;…&quot;,\n  authDomain: &quot;…&quot;,\n  projectId: &quot;…&quot;,\n  appId: &quot;…&quot;\n};">${ls ? esc(JSON.stringify(ls, null, 2)) : ''}</textarea>
    <div class="row"><button class="btn primary" data-fb="save">${ic('check')}Connecter ce poste à la base en ligne</button>${ls ? `<button class="btn ghost" data-fb="clear">Déconnecter ce poste</button>` : ''}</div>
    <p class="tiny muted">Avant de basculer, téléchargez une sauvegarde de la base locale : après la création du compte de coordination, restaurez-la dans la base en ligne.</p></div></div>`;
}
function bindCloudPanel(el) {
  const b = $('[data-fb=save]', el); if (b) b.onclick = () => { const c = parseFirebaseConfig($('#fb-cfg', el).value); if (!c) return toast('Configuration incomplète : apiKey, projectId et appId sont attendus.', 'bad'); lsSet('fbcfg', c); lsSet('demo', false); toast('Configuration enregistrée. Rechargement…', 'ok'); setTimeout(() => { location.hash = ''; location.reload(); }, 800); };
  const c = $('[data-fb=clear]', el); if (c) c.onclick = () => { try { localStorage.removeItem('astraluz:fbcfg'); } catch (e) { } location.reload(); };
}

/* =====================================================================
   Démarrage : choix du stockage, chargement, synchronisation
   ===================================================================== */
const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => null)]);
async function boot() {
  S.ui.sit = lsGet('sit', null);
  $('#app').innerHTML = `<div class="home"><section class="hero" style="padding-bottom:60px"><div class="in-hero"><div class="ttl"><div class="eyebrow">Secrétariat des évaluations</div><h1>AI721 <em>ASTRA LUZ</em> 2.0</h1><p>Ouverture de la base de données…</p></div></div></section></div>`;
  let db = null;
  if (window.claude && typeof window.claude.use === 'function') {
    const [d, dl, u] = await Promise.all([withTimeout(window.claude.use('db').catch(() => null), 9000), withTimeout(window.claude.use('downloads').catch(() => null), 9000), withTimeout(window.claude.use('user').catch(() => null), 9000)]);
    db = d; S.caps.downloads = dl; S.caps.user = u;
    if (u) { try { S.caps.userId = await u.id(); } catch (e) { } }
  }
  const fcfg = !db && typeof cloudConfig === 'function' ? cloudConfig() : null;
  if (fcfg && !lsGet('demo', false)) {
    window.addEventListener('hashchange', () => { if (S.mode === 'cloud' && CLOUD.profile) route(); });
    registerSW();
    try { await cloudBoot(fcfg); return; }
    catch (e) { console.error(e); setTimeout(() => toast('Base en ligne indisponible (' + (e.message || e) + ') : ouverture en base locale.', 'bad'), 400); }
  }
  if (fcfg && lsGet('demo', false)) S.cloudDemo = true;
  if (db) {
    S.store = new SharedStore(db); S.mode = 'shared';
    try { const ok = await Promise.race([loadAll().then(() => true), sleep(15000).then(() => false)]); if (!ok) throw new Error('délai dépassé'); }
    catch (e) { console.warn(e); S.store = await new LocalStore('reel').open(); S.mode = 'local'; await loadAll(); setTimeout(() => toast('Base partagée injoignable : travail en base locale. Pensez à sauvegarder.', 'bad'), 400); }
  } else { S.store = await new LocalStore('reel').open(); S.mode = 'local'; await loadAll(); }
  if (S.store.volatile) setTimeout(() => toast('Ce navigateur bloque le stockage local : les données seront perdues à la fermeture. Sauvegardez régulièrement.', 'bad'), 600);
  if (S.mode === 'shared') subscribeShared();
  if (lsGet('demo', false)) { S.realStore = S.store; S.realMode = S.mode; const st = await new LocalStore('demo').open(); S.store = st; S.mode = 'demo'; await loadAll(); if (!Object.keys(S.evals).length) { await buildDemo(); await loadAll(); } }
  if (!S.ui.sit) S.ui.sit = S.settings.sitCourante || 1;
  if (S.ui.level && S.ui.level !== 'all' && !levelById(S.ui.level)) S.ui.level = null;
  window.addEventListener('hashchange', route);
  registerSW();
  route();
}
/* Application installable (PWA) : uniquement sur le site hébergé */
function registerSW() {
  try { if (!window.ASTRA_WEB || !('serviceWorker' in navigator) || location.protocol !== 'https:' || registerSW.done) return; registerSW.done = true; navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { }
}
function subscribeShared() {
  const st = S.store;
  st.subscribe('classes', docs => { if (S.store !== st) return; S.classes = {}; docs.forEach(d => S.classes[d.id] = clone(d.data)); rerender(); });
  st.subscribe('evals', docs => { if (S.store !== st) return; const next = {}; docs.forEach(d => next[d.id] = clone(d.data)); S.evals = next; rerender(); });
  st.subscribe('cfg', docs => { if (S.store !== st) return; docs.forEach(d => { const v = clone(d.data); if (d.id === 'settings') { S.settings = deepMerge(clone(DEFAULT_SETTINGS), v); if (!S.settings.logo) S.settings.logo = DEFAULT_LOGO; } if (d.id === 'subjects') S.subjects = v.list || []; if (d.id === 'teachers') S.teachers = v.list || []; if (d.id === 'rooms') S.rooms = v.list || []; if (d.id === 'security') S.security = v; }); if (docs.some(d => d.id === 'settings')) S.initialized = true; rerender(); });
}
/* Ne pas redessiner sous les doigts de l'utilisateur pendant une saisie */
document.addEventListener('focusin', ev => { S.ui.busyForm = !!ev.target.closest('.scan-zone, .modal, #sv-body, form, #mt-body'); });
document.addEventListener('focusout', () => { setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) S.ui.busyForm = false; }, 50); });
boot().catch(e => { console.error(e); $('#app').innerHTML = `<div style="padding:24px"><h2>Démarrage impossible</h2><p>${esc(e.message)}</p></div>`; });
