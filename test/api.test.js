// Tests d'intégration de l'API (plateforme de démonstration dans un dossier temporaire).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'edugest-test-'));
process.env.DATA_DIR = DATA;
process.env.DEMO = '1';
process.env.AUTO_BACKUP = '0';
process.env.SUPERADMIN_PASSWORD = 'Ai721@2026'; // la démonstration n'a plus de mot de passe AI721 fixe : celui-ci est imposé pour les tests
const { app } = await import('../server/index.js');

let server, base;
before(async () => { server = app.listen(0); await new Promise((r) => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => { server.close(); fs.rmSync(DATA, { recursive: true, force: true }); });

// interface de connexion déduite de l'identifiant de démonstration (ou imposée)
const portalOf = (u) => (u === 'admin' || /^admin\./.test(u) ? 'admin' : /^sg\./.test(u) ? 'discipline' : 'teacher');
function client(apiBase = '/e/lpey/api') {
  let cookie = '';
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + apiBase + path, {
      method, headers: { 'X-Requested-With': 'EduGest', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, ct, data: ct.includes('json') ? await res.json() : await res.arrayBuffer() };
  };
  return { get: (p) => call('GET', p), post: (p, b = {}, h) => call('POST', p, b, h), put: (p, b = {}) => call('PUT', p, b), del: (p, b) => call('DELETE', p, b),
    login: async (u, pw, portal) => call('POST', '/auth/login', { username: u, password: pw, portal: portal || portalOf(u) }) };
}

let adminClient;
const admin = async () => { if (!adminClient) { adminClient = client(); await adminClient.login('admin', 'Admin@2026'); } return adminClient; };

test('connexion : échec puis succès, cookie HttpOnly', async () => {
  const c = client();
  assert.equal((await c.login('admin', 'mauvais')).status, 401);
  const r = await c.login('admin', 'Admin@2026');
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'admin');
  assert.equal((await c.get('/auth/me')).status, 200);
});

test('CSRF : requête d\'écriture sans en-tête refusée', async () => {
  const res = await fetch(base + '/e/lpey/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin@2026' }) });
  assert.equal(res.status, 403);
  const res2 = await fetch(base + '/e/lpey/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'EduGest', Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(res2.status, 403);
});

test('en-têtes de sécurité présents', async () => {
  const res = await fetch(base + '/');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('cloisonnement des rôles', async () => {
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  assert.equal((await t.get('/admin/dashboard')).status, 403);
  assert.equal((await t.get('/discipline/classes')).status, 403);
  const { data } = await t.get('/teacher/assignments');
  assert.ok(data.assignments.length > 0);
  // un enseignant ne peut pas lire une attribution qui n'est pas la sienne
  const a = await admin();
  const all = (await a.get('/admin/class-subjects')).data;
  const foreign = all.find((x) => x.teacher !== 'MBARGA Jean-Paul');
  assert.equal((await t.get(`/notes/grid?cs=${foreign.id}&seq=2`)).status, 403);
  const d = client(); await d.login('sg.nguemap', 'Disc@2026');
  assert.equal((await d.get('/teacher/assignments')).status, 403);
  assert.equal((await d.get('/pdf/bulletins?class_id=1&period=S1')).status, 403);
  assert.equal((await client().get('/periods')).status, 401);
});

test('verrouillage après 5 échecs', async () => {
  const a = await admin();
  const u = (await a.post('/admin/users', { role: 'teacher', full_name: 'TEST Verrou' })).data;
  const c = client();
  for (let i = 0; i < 5; i++) await c.login(u.username, 'faux-mot-de-passe');
  const r = await c.login(u.username, u.password);
  assert.equal(r.status, 423);
  await a.post(`/admin/users/${u.id}/toggle`); await a.post(`/admin/users/${u.id}/toggle`); // déverrouillage par l'admin
  assert.equal((await c.login(u.username, u.password)).status, 200);
});

test('compte généré : identifiant lisible, coffre des accès, lien de connexion', async () => {
  const a = await admin();
  const r = await a.post('/admin/users', { role: 'discipline', full_name: 'NDJOCK Emmanuel Marc', class_ids: [1, 2] });
  assert.equal(r.status, 201);
  assert.match(r.data.username, /^sg\.ndjockem/);
  assert.match(r.data.password, /^[a-z]+-[a-z]+-\d{3}$/);
  assert.match(r.data.link, /\/e\/lpey\/discipline$/);
  // l'administrateur retrouve le mot de passe généré dans le coffre
  const v = (await a.post(`/admin/users/${r.data.id}/reveal`)).data;
  assert.equal(v.password, r.data.password);
  // le mot de passe généré reste utilisable (pas de changement imposé)
  const u = client(); await u.login(r.data.username, r.data.password);
  const cls = (await u.get('/discipline/classes')).data.classes;
  assert.deepEqual(cls.map((c) => c.id).sort(), [1, 2]);
  assert.equal((await u.post('/auth/password', { current: r.data.password, next: 'court' })).status, 400);
  assert.equal((await u.post('/auth/password', { current: r.data.password, next: 'Ma phrase secrète 2026' })).status, 200);
  // mot de passe personnel : jamais conservé en clair, le coffre l'indique
  const v2 = (await a.post(`/admin/users/${r.data.id}/reveal`)).data;
  assert.equal(v2.password, null); assert.equal(v2.changed_by_user, true);
  const list = (await a.get('/admin/acces')).data;
  assert.ok(list.users.find((x) => x.id === r.data.id).pw_user_changed_at);
  assert.match(list.links.teacher, /\/e\/lpey\/enseignant$/);
});

test('saisie des notes : validation, bornes, verrou de séquence clôturée', async () => {
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  const { assignments } = (await t.get('/teacher/assignments')).data;
  const cs = assignments[0].id;
  const grid = (await t.get(`/notes/grid?cs=${cs}&seq=2`)).data;
  const s0 = grid.students[0].id;
  assert.equal((await t.put('/notes/grid', { cs, seq: 2, entries: [{ student_id: s0, value: 21 }] })).status, 400);
  assert.equal((await t.put('/notes/grid', { cs, seq: 2, entries: [{ student_id: s0, value: 12.555 }] })).status, 400);
  assert.equal((await t.put('/notes/grid', { cs, seq: 2, entries: [{ student_id: 999999, value: 12 }] })).status, 400);
  const entries = grid.students.map((s, i) => (i === 1 ? { student_id: s.id, absent: true } : { student_id: s.id, value: '13,5' }));
  assert.equal((await t.put('/notes/grid', { cs, seq: 2, entries })).status, 200);
  assert.equal((await t.post('/notes/validate', { cs, seq: 2 })).status, 200);
  const after = (await t.get(`/notes/grid?cs=${cs}&seq=2`)).data;
  assert.equal(after.students[0].value, 13.5);
  assert.equal(after.students[1].absent, 1);
  assert.ok(after.validated_at);
  // séquence 1 clôturée : écriture refusée
  assert.equal((await t.put('/notes/grid', { cs, seq: 1, entries: [{ student_id: s0, value: 10 }] })).status, 423);
});

test('discipline : saisie, incident, validation', async () => {
  const d = client(); await d.login('sg.nguemap', 'Disc@2026');
  const { classes } = (await d.get('/discipline/classes')).data;
  const cid = classes[0].id;
  const sheet = (await d.get(`/discipline/sheet?class_id=${cid}&seq=2`)).data;
  const st = sheet.students[0];
  assert.equal((await d.put('/discipline/sheet', { class_id: cid, seq: 2, entries: [{ student_id: st.id, abs_nj: 4, retards: 2, avertissement: true, observation: '<script>alert(1)</script>' }] })).status, 200);
  assert.equal((await d.post('/discipline/incidents', { student_id: st.id, seq: 2, date: '2026-10-25', type: 'Retard répété', gravite: 'mineure', sanction: 'Consigne 2 h' })).status, 201);
  assert.equal((await d.post('/discipline/validate', { class_id: cid, seq: 2 })).status, 200);
  const hist = (await d.get(`/discipline/student/${st.id}`)).data;
  assert.equal(hist.records.find((r) => r.seq === 2).abs_nj, 4);
  // classe non attribuée
  assert.equal((await d.get('/discipline/sheet?class_id=6&seq=2')).status, 403);
});

test('clôture : refus si incomplet, forçage avec mot de passe, ordre chronologique', async () => {
  const a = await admin();
  assert.equal((await a.post('/admin/periods/3/close', {})).status, 400); // S2 encore ouverte
  const r = await a.post('/admin/periods/2/close', {});
  assert.equal(r.status, 409);
  assert.equal((await a.post('/admin/periods/2/close', { force: true, password: 'faux' })).status, 403);
  assert.equal((await a.post('/admin/periods/2/close', { force: true, password: 'Admin@2026' })).status, 200);
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  const cs = (await t.get('/teacher/assignments')).data.assignments[0].id;
  assert.equal((await t.put('/notes/grid', { cs, seq: 2, entries: [] })).status, 423);
  assert.equal((await a.post('/admin/periods/2/reopen', { password: 'Admin@2026' })).status, 200);
});

test('résultats : moyennes pondérées et rangs cohérents', async () => {
  const a = await admin();
  const r = (await a.get('/admin/results?class_id=1&period=S1')).data;
  for (const x of r.results) {
    const lines = x.lines.filter((l) => l.avg != null);
    const exp = lines.reduce((s, l) => s + l.avg * l.coef, 0) / lines.reduce((s, l) => s + l.coef, 0);
    assert.ok(Math.abs(exp - x.general) < 0.011);
  }
  for (let i = 1; i < r.results.length; i++) assert.ok(r.results[i - 1].general >= r.results[i].general);
  assert.equal(r.results[0].rang, 1);
});

test('emploi du temps : conflit enseignant détecté', async () => {
  const a = await admin();
  const tt1 = (await a.get('/admin/timetable/1')).data;
  const busy = tt1.cells.find((c) => c.teacher_id);
  // chercher une autre classe où ce même enseignant enseigne
  const css = (await a.get(`/admin/class-subjects?teacher_id=${busy.teacher_id}`)).data.filter((x) => x.class_id !== 1);
  if (css.length) {
    const r = await a.put('/admin/timetable', { class_id: css[0].class_id, day: busy.day, slot: busy.slot, class_subject_id: css[0].id });
    assert.equal(r.status, 409);
  }
  assert.equal((await a.put('/admin/timetable', { class_id: 1, day: 1, slot: 2, class_subject_id: tt1.subjects[0].id })).status, 400); // créneau de pause
});

test('import CSV des élèves', async () => {
  const a = await admin();
  const r = await a.post('/admin/students/import', { rows: [
    { nom: 'Kouam', prenom: 'Alice', sexe: 'F', date_naissance: '12/05/2012', classe: '6e A' },
    { nom: 'Tchami', prenom: 'Paul', sexe: 'M', classe: 'Classe inexistante' }] });
  assert.equal(r.data.created, 1);
  assert.equal(r.data.errors.length, 1);
  const s = (await a.get('/admin/students?q=KOUAM')).data[0];
  assert.equal(s.date_naissance, '2012-05-12');
  assert.match(s.matricule, /LPEY\d{4}$/);
});

test('génération de tous les documents PDF', async () => {
  const a = await admin();
  for (const p of ['/pdf/bulletins?class_id=1&period=S1', '/pdf/bulletins?class_id=2&period=T1', '/pdf/pv?class_id=1&period=A', '/pdf/liste?class_id=1',
    '/pdf/timetable?class_id=1', '/pdf/timetable?teacher_id=2', '/pdf/releve?cs=1&period=T1', '/pdf/discipline?class_id=1&period=S1',
    '/pdf/discipline-eleve?student_id=1', '/pdf/progression?teacher_id=2']) {
    const r = await a.get(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.ct, 'application/pdf', p);
    assert.equal(Buffer.from(r.data).subarray(0, 4).toString(), '%PDF', p);
  }
  const r = await a.post('/pdf/credentials', { items: [{ full_name: 'X', username: 'x', password: 'lion-mangue-123', role: 'teacher' }] });
  assert.equal(r.ct, 'application/pdf');
});

test('sauvegarde puis restauration', async () => {
  const a = await admin();
  const dump = (await a.get('/admin/backup')).data;
  assert.ok(dump.tables.students.length > 100);
  assert.equal((await a.post('/admin/restore', { dump, password: 'Admin@2026' })).status, 200);
  adminClient = null; // la restauration ferme toutes les sessions
  const b = await admin();
  assert.equal((await b.get('/admin/students')).data.length, dump.tables.students.length);
});

test('groupes et types de matières : référentiels administrables et dissociés', async () => {
  const a = await admin();
  const groups = (await a.get('/admin/subject-groups')).data, types = (await a.get('/admin/subject-types')).data;
  assert.deepEqual(groups.map((g) => g.name), ['Groupe 1', 'Groupe 2', 'Groupe 3']);
  assert.ok(types.some((t) => t.name === 'Matière littéraire') && types.some((t) => t.name === 'Matière scientifique'));
  // ajout d'un groupe et d'un type
  const g4 = (await a.post('/admin/subject-groups', { name: 'Groupe 4 — Professionnel', ordre: 4 })).data;
  const tech = (await a.post('/admin/subject-types', { name: 'Matière technique' })).data;
  assert.ok(g4.id && tech.id);
  assert.equal((await a.post('/admin/subject-types', { name: 'matière TECHNIQUE' })).status, 409); // doublon (insensible à la casse)
  // une matière combine librement groupe et type
  const sub = await a.post('/admin/subjects', { name: 'Électronique', code: 'ELN', group_id: g4.id, type_id: tech.id });
  assert.equal(sub.status, 201);
  assert.equal((await a.post('/admin/subjects', { name: 'Sans type', group_id: g4.id })).status, 400);
  assert.equal((await a.post('/admin/subjects', { name: 'Type fantôme', group_id: g4.id, type_id: 99999 })).status, 400);
  const lit = types.find((t) => t.name === 'Matière littéraire');
  assert.equal((await a.put(`/admin/subjects/${sub.data.id}`, { name: 'Électronique', code: 'ELN', group_id: groups[1].id, type_id: lit.id })).status, 200);
  const s = (await a.get('/admin/subjects')).data.find((x) => x.id === sub.data.id);
  assert.equal(s.group_name, 'Groupe 2'); assert.equal(s.type_name, 'Matière littéraire');
  // suppression refusée tant qu'utilisé, autorisée ensuite ; renommage
  assert.equal((await a.del(`/admin/subject-types/${lit.id}`)).status, 400);
  assert.equal((await a.put(`/admin/subject-groups/${g4.id}`, { name: 'Groupe 4', ordre: 5 })).status, 200);
  assert.equal((await a.del(`/admin/subject-groups/${g4.id}`)).status, 200);
  await a.del(`/admin/subjects/${sub.data.id}`);
  assert.equal((await a.del(`/admin/subject-types/${tech.id}`)).status, 200);
  // les statistiques sont ventilées par type
  const st = (await a.get('/admin/stats?period=S1')).data;
  assert.ok(st.types.find((t) => t.type === 'Matière scientifique').n > 0);
  // le bulletin regroupe toujours les matières par groupe
  const r = (await a.get('/admin/results?class_id=1&period=S1')).data;
  assert.ok(r.results[0].lines.every((l) => l.group_name && l.type_name));
});

test('restauration d\'une sauvegarde de l\'ancienne version (champ « groupe » unique)', async () => {
  const a = await admin();
  const dump = (await a.get('/admin/backup')).data;
  const before = (await a.get('/admin/subjects')).data;
  // simulation du format historique : pas de référentiels, un seul champ « groupe »
  const ordreOf = Object.fromEntries((await a.get('/admin/subject-groups')).data.map((g) => [g.id, g.ordre]));
  dump.tables.subjects = dump.tables.subjects.map(({ group_id, type_id, ...x }) => ({ ...x, groupe: ordreOf[group_id] }));
  delete dump.tables.subject_groups; delete dump.tables.subject_types;
  assert.equal((await a.post('/admin/restore', { dump, password: 'Admin@2026' })).status, 200);
  adminClient = null;
  const b = await admin();
  const after = (await b.get('/admin/subjects')).data;
  for (const s of before) {
    const x = after.find((y) => y.id === s.id);
    assert.equal(x.group_name, s.group_name, s.name);
    assert.equal(x.type_name, s.type_name, s.name);
  }
});

test('migration automatique d\'une installation 1.x (base unique) vers la plateforme', async () => {
  const { execFileSync } = await import('node:child_process');
  const { DatabaseSync } = await import('node:sqlite');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edugest-migr-'));
  const old = new DatabaseSync(path.join(dir, 'edugest.db'));
  old.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO settings VALUES ('nom', '"Lycée Ancien de Test"'), ('nom_court', '"LAT"');
    CREATE TABLE subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, code TEXT, groupe INTEGER NOT NULL DEFAULT 1);
    INSERT INTO subjects(name, code, groupe) VALUES ('Français','FRA',1), ('Mathématiques','MATH',2), ('EPS','EPS',3);`);
  old.close();
  const href = (f) => JSON.stringify(new URL(`../server/${f}`, import.meta.url).href);
  const out = execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', `
    const P = await import(${href('platform.js')}); const { db } = await import(${href('db.js')});
    P.initPlatform();
    const t = P.pdb.prepare('SELECT * FROM tenants').get();
    const st = P.subscriptionStatus(t);
    const r = P.inTenant(t, () => ({ cols: db.prepare('PRAGMA table_info(subjects)').all().map((c) => c.name),
      rows: db.prepare('SELECT s.name, g.name g, t.name t FROM subjects s JOIN subject_groups g ON g.id = s.group_id JOIN subject_types t ON t.id = s.type_id ORDER BY s.id').all() }));
    console.log(JSON.stringify({ code: t.code, valid: st.valid, ...r }));`],
  { env: { ...process.env, DEMO: '', DATA_DIR: dir } }).toString();
  const res = JSON.parse(out.trim().split('\n').pop());
  assert.equal(res.code, 'lat');
  assert.equal(res.valid, true); // abonnement de l'année en cours créé automatiquement
  assert.ok(!fs.existsSync(path.join(dir, 'edugest.db')) && fs.existsSync(path.join(dir, 'tenants', 'lat', 'edugest.db')));
  assert.ok(!res.cols.includes('groupe') && res.cols.includes('group_id') && res.cols.includes('type_id'));
  assert.deepEqual(res.rows.map((r) => `${r.name}|${r.g}|${r.t}`), ['Français|Groupe 1|Matière littéraire', 'Mathématiques|Groupe 2|Matière scientifique', 'EPS|Groupe 3|Autre matière']);
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ===================== Plateforme AI721 TECH STUFF (multi-établissements) ===================== */
let consoleClient;
const ai721 = async () => { if (!consoleClient) { consoleClient = client('/console/api'); await consoleClient.login('AI721', 'Ai721@2026'); } return consoleClient; };

test('console : connexion du super admin et tableau de bord', async () => {
  const c = await ai721();
  assert.equal((await c.get('/auth/me')).data.user.role, 'superadmin');
  const d = (await c.get('/dashboard')).data;
  assert.equal(d.kpis.total, 4);
  const byCode = Object.fromEntries(d.tenants.map((t) => [t.code, t.status_code]));
  assert.deepEqual(byCode, { lpey: 'actif', lbdouala: 'actif', cetbafoussam: 'expire', cesgaroua: 'impaye' });
  assert.ok(d.kpis.eleves > 500 && d.kpis.recettes_annee === 350000);
  // un compte d'établissement n'ouvre pas la console, et inversement
  assert.equal((await client('/console/api').login('admin', 'Admin@2026')).status, 401);
  assert.equal((await client().login('AI721', 'Ai721@2026', 'admin')).status, 401);
});

test('quatre interfaces de connexion distinctes : chaque compte n\'ouvre que la sienne', async () => {
  const t = client();
  const r = await t.login('mbargajp', 'Prof@2026', 'admin');
  assert.equal(r.status, 403);
  assert.equal(r.data.redirect, '/e/lpey/enseignant');
  assert.equal((await t.get('/auth/me')).data.user, null); // aucune session ouverte
  assert.equal((await t.login('admin', 'Admin@2026', 'discipline')).status, 403);
  assert.equal((await t.login('mbargajp', 'Prof@2026', 'inconnu')).status, 400);
  assert.equal((await t.login('mbargajp', 'Prof@2026', 'teacher')).status, 200);
});

test('abonnements : accès bloqué si expiré, impayé ou suspendu ; rétabli après paiement', async () => {
  const c = await ai721();
  const pub = (await client('/e/cetbafoussam/api').get('/auth/public')).data;
  assert.equal(pub.subscription.valid, false);
  assert.match(pub.subscription.message, /expiré le 31\/08\//);
  assert.equal((await client('/e/cetbafoussam/api').login('fokoua', 'x', 'teacher')).status, 402);
  // établissement impayé : le paiement rétablit l'accès
  const garoua = (await c.get('/tenants')).data.find((t) => t.code === 'cesgaroua');
  const acc = (await c.post(`/tenants/${garoua.id}/reveal`)).data;
  assert.match(acc.username, /^admin\.cesgaroua$/);
  assert.match(acc.links.admin, /\/e\/cesgaroua\/admin$/);
  const g = client('/e/cesgaroua/api');
  assert.equal((await g.login(acc.username, acc.password, 'admin')).status, 402);
  const sub = (await c.get(`/tenants/${garoua.id}`)).data.subscriptions[0];
  assert.equal((await c.put(`/subscriptions/${sub.id}`, { paid: true, mode: 'Mobile Money', reference: 'MOMO-1' })).status, 200);
  assert.equal((await g.login(acc.username, acc.password, 'admin')).status, 200);
  assert.equal((await g.get('/admin/dashboard')).status, 200);
  // suspension : sessions fermées et connexion refusée ; réactivation
  await c.post(`/tenants/${garoua.id}/toggle`);
  assert.equal((await g.get('/admin/dashboard')).status, 402);
  await c.post(`/tenants/${garoua.id}/toggle`);
  assert.equal((await g.login(acc.username, acc.password, 'admin')).status, 200);
});

test('console : création d\'un établissement, coffre, réinitialisation, renouvellement, suppression', async () => {
  const c = await ai721();
  const r = await c.post('/tenants', { name: 'Lycée de Test de Kribi', sigle: 'LTK', ville: 'Kribi', region: 'Sud', annee: (await c.get('/dashboard')).data.year, montant: 120000, paid: true, mode: 'Espèces' });
  assert.equal(r.status, 201);
  assert.equal(r.data.tenant.code, 'ltk');
  assert.match(r.data.links.teacher, /\/e\/ltk\/enseignant$/);
  const k = client('/e/ltk/api');
  assert.equal((await k.login(r.data.username, r.data.password, 'admin')).status, 200);
  assert.equal((await k.get('/admin/classes')).data.length, 0); // base vierge et isolée
  assert.equal((await c.post(`/tenants/${r.data.tenant.id}/reveal`)).data.password, r.data.password);
  assert.equal((await c.post('/tenants', { name: 'Doublon', code: 'ltk', annee: '2026-2027' })).status, 409);
  // nouveau mot de passe : l'ancien ne fonctionne plus, la session est fermée
  const n = (await c.post(`/tenants/${r.data.tenant.id}/reset-admin`)).data;
  assert.notEqual(n.password, r.data.password);
  assert.equal((await k.get('/admin/classes')).status, 401);
  assert.equal((await client('/e/ltk/api').login(r.data.username, r.data.password, 'admin')).status, 401);
  assert.equal((await client('/e/ltk/api').login(n.username, n.password, 'admin')).status, 200);
  // renouvellement pour l'année suivante, doublon refusé, reçu PDF
  const y = +r.data.tenant.annee.slice(0, 4) + 1;
  assert.equal((await c.post(`/tenants/${r.data.tenant.id}/subscriptions`, { annee: `${y}-${y + 1}`, montant: 120000, paid: false })).status, 201);
  assert.equal((await c.post(`/tenants/${r.data.tenant.id}/subscriptions`, { annee: `${y}-${y + 1}`, montant: 1 })).status, 409);
  for (const p of [`/pdf/acces/${r.data.tenant.id}`, '/pdf/etablissements', `/pdf/recu/${(await c.get(`/tenants/${r.data.tenant.id}`)).data.subscriptions[0].id}`]) {
    const x = await c.get(p); assert.equal(x.ct, 'application/pdf', p);
  }
  // suppression (mot de passe exigé) : établissement inaccessible
  assert.equal((await c.del(`/tenants/${r.data.tenant.id}`, { password: 'faux' })).status, 403);
  assert.equal((await c.del(`/tenants/${r.data.tenant.id}`, { password: 'Ai721@2026' })).status, 200);
  assert.equal((await client('/e/ltk/api').get('/auth/public')).status, 404);
});

test('isolation : une session d\'un établissement n\'ouvre rien dans un autre', async () => {
  const a = await admin();
  const cookieRes = await fetch(base + '/e/lpey/api/auth/login', { method: 'POST', headers: { 'X-Requested-With': 'EduGest', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@2026', portal: 'admin' }) });
  const cookie = cookieRes.headers.get('set-cookie');
  assert.match(cookie, /Path=\/e\/lpey\//); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  const r = await fetch(base + '/e/lbdouala/api/admin/dashboard', { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(r.status, 401);
  assert.equal((await a.get('/admin/dashboard')).status, 200);
});

test('saisie et suivi par trimestre (notes et discipline)', async () => {
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  const cs = (await t.get('/teacher/assignments')).data.assignments[0].id;
  const g = (await t.get(`/notes/grid?cs=${cs}&period=T1`)).data;
  assert.deepEqual(g.seqs, [1, 2]);
  assert.ok(g.locked[1] && !g.locked[2]); // S1 clôturée, S2 ouverte
  const sid = g.students[0].id;
  assert.equal((await t.put('/notes/grid', { cs, entries: [{ student_id: sid, seq: 1, value: 10 }, { student_id: sid, seq: 2, value: 12 }] })).status, 423);
  assert.equal((await t.put('/notes/grid', { cs, entries: g.students.map((st) => ({ student_id: st.id, seq: 2, value: 12.5 })) })).status, 200);
  assert.equal((await t.post('/notes/validate', { cs, seq: 2 })).status, 200);
  assert.equal((await t.get(`/notes/grid?cs=${cs}&period=T1`)).data.students[0].values[2].value, 12.5);
  assert.equal((await t.get(`/notes/grid?cs=${cs}&period=A`)).status, 400);
  const d = client(); await d.login('sg.nguemap', 'Disc@2026');
  const cid = (await d.get('/discipline/classes')).data.classes[0].id;
  const recap = (await d.get(`/discipline/sheet?class_id=${cid}&period=T1`)).data;
  assert.equal(recap.recap, true); assert.deepEqual(recap.period.seqs, [1, 2]); assert.match(recap.locked, /lecture seule/);
  const a = await admin();
  const st = (await a.get('/admin/stats?period=T1')).data;
  assert.equal(st.period, 'T1'); assert.ok(st.global.n > 0);
  const pdf = await a.get('/pdf/stats?period=T1');
  assert.equal(pdf.ct, 'application/pdf');
});

const isPdf = (r) => r.status === 200 && r.ct === 'application/pdf' && Buffer.from(r.data).subarray(0, 4).toString() === '%PDF';

test('nom de la plateforme : AI721 SchoolX CM', async () => {
  const html = await (await fetch(base + '/e/lpey/admin')).text();
  assert.match(html, /<title>AI721 SchoolX CM<\/title>/);
  const mf = await (await fetch(base + '/manifest.webmanifest?p=/e/lpey/admin')).json();
  assert.match(mf.name, /AI721 SchoolX CM/);
  const a = await admin();
  assert.equal((await a.get('/admin/backup')).data.app, 'AI721 SchoolX CM');
});

test('appellations des fonctions : choix dans les paramètres, signatures et fonctions des enseignants', async () => {
  const a = await admin();
  const st = (await a.get('/admin/settings')).data;
  assert.deepEqual(st._fonctions.chef_titre.options, ['Le Proviseur', 'Le Directeur', 'Le Principal']);
  assert.deepEqual(st._fonctions.censeur_titre.options, ['Censeur', 'Préfet', 'Préfet Adjoint']);
  assert.deepEqual(st._fonctions.sg_titre.options, ['Surveillant Général', 'Surveillant Général Adjoint']);
  assert.deepEqual(st._fonctions.ap_titre.options, ['Animateur Pédagogique', 'Coordonnateur']);
  assert.equal(st.censeur_titre, 'Censeur');
  assert.equal((await a.put('/admin/settings', { censeur_titre: 'Directeur des études' })).status, 400);
  assert.equal((await a.put('/admin/settings', { ap_titre: 'Chef de département' })).status, 400);
  const r = await a.put('/admin/settings', { chef_titre: 'Le Principal', censeur_titre: 'Préfet Adjoint', sg_titre: 'Surveillant Général Adjoint', ap_titre: 'Coordonnateur' });
  assert.equal(r.status, 200);
  assert.equal(r.data.censeur_titre, 'Préfet Adjoint');
  assert.ok(r.data._renamed >= 1);
  // la fonction « Animateur Pédagogique de Mathématiques » suit l'appellation
  assert.equal((await a.get('/rh/enseignants/2')).data.agent.fonction, 'Coordonnateur de Mathématiques');
  const pub = (await client().get('/auth/public')).data;
  assert.deepEqual(pub.fonctions, { chef_titre: 'Le Principal', censeur_titre: 'Préfet Adjoint', sg_titre: 'Surveillant Général Adjoint', ap_titre: 'Coordonnateur' });
  // les documents portant les signatures se génèrent avec les nouvelles appellations
  for (const p of ['/pdf/releve?cs=1&period=S1', '/pdf/progression?teacher_id=2', '/pdf/discipline?class_id=1&period=S1', '/pdf/bulletins?class_id=1&period=S1', '/pdf/pv?class_id=1&period=S1', '/pdf/stats?period=S1'])
    assert.ok(isPdf(await a.get(p)), p);
  // retour aux appellations d'origine
  const back = await a.put('/admin/settings', { chef_titre: 'Le Proviseur', censeur_titre: 'Censeur', sg_titre: 'Surveillant Général', ap_titre: 'Animateur Pédagogique' });
  assert.equal(back.status, 200);
  assert.equal((await a.get('/rh/enseignants/2')).data.agent.fonction, 'Animateur Pédagogique de Mathématiques');
  // le responsable adjoint garde sa propre fonction
  assert.ok((await a.get('/admin/users?role=discipline')).data.some((u) => u.specialite === 'Surveillant Général Adjoint'));
});

test('appellations : Séquence/Situation et Professeur Principal/Titulaire', async () => {
  const a = await admin();
  const st = (await a.get('/admin/settings')).data;
  assert.deepEqual(st._termes.terme_sequence.options, ['Séquence', 'Situation']);
  assert.deepEqual(st._termes.terme_pp.options, ['Professeur Principal', 'Titulaire']);
  assert.equal((await a.put('/admin/settings', { terme_sequence: 'Période' })).status, 400);
  assert.equal((await a.put('/admin/settings', { terme_sequence: 'Situation', terme_pp: 'Titulaire' })).status, 200);
  assert.deepEqual((await client().get('/auth/public')).data.termes, { terme_sequence: 'Situation', terme_pp: 'Titulaire' });
  assert.equal((await a.get('/admin/results?class_id=1&period=S1')).data.period.label, 'Situation 1');
  // les messages d'erreur emploient l'appellation choisie
  const err = await a.post('/admin/periods/6/close', { password: 'Admin@2026' });
  assert.ok(err.status >= 400 && /situation/i.test(err.data.error) && !/séquence/i.test(err.data.error), err.data.error);
  for (const p of ['/pdf/bulletins?class_id=1&period=S1', '/pdf/releve?cs=1&period=T1', '/pdf/progression?teacher_id=2']) assert.ok(isPdf(await a.get(p)), p);
  assert.equal((await a.put('/admin/settings', { terme_sequence: 'Séquence', terme_pp: 'Professeur Principal' })).status, 200);
  assert.equal((await a.get('/admin/results?class_id=1&period=S1')).data.period.label, 'Séquence 1');
});

test('progression : leçons digitalisées', async () => {
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  const { assignments } = (await t.get('/teacher/assignments')).data;
  const cs = assignments[0].id;
  const g = (await t.get(`/progression?cs=${cs}`)).data;
  assert.ok('digital' in g.rows[0]);
  const open = g.rows.find((r) => r.status === 'open');
  const row = { seq: open.seq, planned: 10, done: 6, digital: 4, comment: 'Leçons 3 à 6 mises en ligne' };
  assert.equal((await t.put('/progression', { cs, rows: [row] })).status, 200);
  assert.equal((await t.get(`/progression?cs=${cs}`)).data.rows.find((r) => r.seq === open.seq).digital, 4);
  assert.equal((await t.put('/progression', { cs, rows: [{ ...row, digital: 11 }] })).status, 400); // plus que prévu
  assert.equal((await t.put('/progression', { cs, rows: [{ ...row, digital: -1 }] })).status, 400);
  const closed = g.rows.find((r) => r.status === 'closed');
  if (closed) assert.equal((await t.put('/progression', { cs, rows: [{ ...closed, digital: (closed.digital || 0) + 1 }] })).status, 400); // séquence clôturée
  assert.ok((await t.get('/teacher/assignments')).data.assignments.find((x) => x.id === cs).digital >= 4);
  const a = await admin();
  assert.ok((await a.get('/admin/progressions')).data.every((x) => 'digital' in x));
  assert.ok(isPdf(await t.get('/pdf/progression')));
});

test('messages aux parents : numéros, aperçu personnalisé, envoi SMS (simulation) et envoi manuel', async () => {
  const { normalizePhone, smsInfo, gsmify } = await import('../server/sms.js');
  assert.equal(gsmify('Loïc, fête « réunion »'), 'Loic, fete " réunion "');
  assert.equal(normalizePhone('6 99 00 00 00'), '+237699000000');
  assert.equal(normalizePhone('+237 677 12 34 56'), '+237677123456');
  assert.equal(normalizePhone('00237 222 23 45 67'), '+237222234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(smsInfo('a'.repeat(160)).segments, 1);
  assert.equal(smsInfo('a'.repeat(161)).segments, 2);
  assert.equal(smsInfo('Fête').encoding, 'Unicode');
  const a = await admin();
  const ref = (await a.get('/admin/parents/modeles')).data;
  assert.ok(ref.modeles.bulletins && ref.modeles.reunion && ref.passerelle.configured); // simulation en démonstration
  const body = { modele: 'reunion', texte: ref.modeles.reunion.texte, class_ids: [1], regrouper: true,
    variables: { date: '2026-11-21', heure: '09:30', lieu: "dans l'enceinte de l'établissement", objet: 'bilan du premier trimestre' } };
  assert.equal((await a.post('/admin/parents/apercu', { ...body, variables: { ...body.variables, objet: '' } })).status, 400); // ordre du jour manquant
  assert.equal((await a.post('/admin/parents/apercu', { ...body, texte: 'Bonjour {inconnu}' })).status, 400);
  const p = (await a.post('/admin/parents/apercu', body)).data;
  assert.ok(p.destinataires > 0 && p.eleves >= p.destinataires);
  const ex = p.exemples[0];
  assert.ok(ex.message.includes(gsmify(ex.enfants.split(' ; ')[0])), 'le nom de l’enfant figure dans le message');
  assert.match(ex.message, /samedi 21 novembre 2026 à 9 h 30/);
  assert.ok(!/\{\w+\}/.test(ex.message));
  // envoi par la passerelle (simulation)
  const c = await a.post('/admin/parents/campagnes', { ...body, canal: 'sms' });
  assert.equal(c.status, 201);
  assert.equal(c.data.total, p.destinataires);
  assert.equal(c.data.envoyes, c.data.total);
  const det = (await a.get(`/admin/parents/campagnes/${c.data.id}`)).data;
  assert.ok(det.messages.every((m) => m.status === 'simule' && /^\+\d{8,15}$/.test(m.phone)));
  // envoi manuel (WhatsApp / SMS depuis le téléphone)
  const m = await a.post('/admin/parents/campagnes', { modele: 'bulletins', texte: ref.modeles.bulletins.texte, class_ids: [2],
    variables: { periode: ref.periodes[0], date: '2026-12-05', heure: '10:00', lieu: 'au foyer' }, canal: 'manuel' });
  assert.equal(m.status, 201);
  const md = (await a.get(`/admin/parents/campagnes/${m.data.id}`)).data;
  assert.ok(md.messages.every((x) => x.status === 'a_envoyer') && /bulletins du 1er trimestre/.test(md.messages[0].message));
  assert.equal((await a.post(`/admin/parents/messages/${md.messages[0].id}/envoye`, { canal: 'whatsapp' })).status, 200);
  const list = (await a.get('/admin/parents/campagnes')).data;
  assert.equal(list.find((x) => x.id === m.data.id).envoyes, 1);
  // réservé à l'administration ; la passerelle se configure dans la console AI721
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  assert.equal((await t.get('/admin/parents/modeles')).status, 403);
  const k = client('/console/api'); await k.login('AI721', 'Ai721@2026');
  const ps = (await k.get('/settings')).data;
  assert.equal(ps.sms_provider, 'simulation');
  assert.ok(!('sms_secret_enc' in ps));
  assert.equal((await k.put('/settings', { sms_provider: 'pigeon' })).status, 400);
  assert.equal((await k.post('/sms/test', { to: '699000000' })).data.simulated, true);
});

test('assiduité des enseignants : dossier, absences, retards, pointage et taux', async () => {
  const a = await admin();
  const tid = 3; // EKOTO Solange
  const r0 = await a.put(`/rh/enseignants/${tid}`, { grade: 'PLEG', statut_agent: 'Fonctionnaire', date_prise_service: '2015-09-07', acte_affectation: 'la décision n° 0001/MINESEC/CAB du 01/08/2015' });
  assert.equal(r0.status, 200);
  assert.equal(r0.data.grade, 'PLEG');
  assert.equal((await a.put(`/rh/enseignants/${tid}`, { date_prise_service: '07/09/2015' })).status, 400);
  // période de calcul : la séquence 1 (terminée)
  const s1 = (await a.get('/periods')).data.periods[0];
  const q = `from=${s1.start_date}&to=${s1.end_date}`;
  const base0 = (await a.get(`/rh/enseignants/${tid}?${q}`)).data;
  assert.ok(base0.summary.dues > 0, 'heures dues calculées depuis l\'emploi du temps');
  assert.equal(base0.summary.taux, Math.round((base0.summary.faites / base0.summary.dues) * 1000) / 10);
  // un jour de classe sans absence ni retard enregistré, où l'enseignant a cours
  const taken = new Set(base0.summary.records.map((x) => x.date));
  let day = null;
  for (let t = Date.parse(s1.start_date + 'T00:00:00Z'); t <= Date.parse(s1.end_date + 'T00:00:00Z'); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10), wd = new Date(t).getUTCDay() || 7;
    if (base0.load.byDay[wd] > 0 && wd <= 5 && !taken.has(iso)) { day = iso; break; }
  }
  assert.ok(day);
  const wd = new Date(day + 'T00:00:00Z').getUTCDay() || 7;
  const add = await a.post('/rh/absences', { teacher_id: tid, kind: 'absence', date: day, motif: 'Test' });
  assert.equal(add.status, 201);
  let s = (await a.get(`/rh/enseignants/${tid}?${q}`)).data.summary;
  assert.equal(s.abs_nj, Math.round((base0.summary.abs_nj + base0.load.byDay[wd]) * 10) / 10);
  assert.equal(s.faites, Math.round((base0.summary.dues - s.abs_j - s.abs_nj) * 10) / 10);
  const rec = s.records.find((x) => x.date === day && x.kind === 'absence');
  assert.equal((await a.put(`/rh/absences/${rec.id}`, { justified: true, motif: 'Certificat médical' })).status, 200);
  s = (await a.get(`/rh/enseignants/${tid}?${q}`)).data.summary;
  assert.equal(s.abs_nj, base0.summary.abs_nj);
  assert.ok(s.taux_hors_justifiees >= s.taux);
  assert.equal((await a.post('/rh/absences', { teacher_id: tid, kind: 'retard', date: day, minutes: 15 })).status, 201);
  assert.equal((await a.get(`/rh/enseignants/${tid}?${q}`)).data.summary.retards, base0.summary.retards + 1);
  assert.equal((await a.post('/rh/absences', { teacher_id: tid, kind: 'retard', date: day })).status, 400); // durée obligatoire
  assert.equal((await a.post('/rh/absences', { teacher_id: tid, kind: 'absence', date: '2099-01-05' })).status, 400); // date future
  assert.equal((await a.post('/rh/absences', { teacher_id: tid, kind: 'absence', date: day, date_fin: s1.start_date })).status, day === s1.start_date ? 201 : 400);
  for (const x of (await a.get(`/rh/absences?${q}&teacher_id=${tid}`)).data.rows.filter((x) => x.date === day)) assert.equal((await a.del(`/rh/absences/${x.id}`)).status, 200);
  assert.deepEqual((await a.get(`/rh/enseignants/${tid}?${q}`)).data.summary.taux, base0.summary.taux);
  // pointage journalier d'après l'emploi du temps
  const pt = (await a.get(`/rh/pointage?date=${day}`)).data;
  const row = pt.rows.find((x) => x.teacher_id === tid);
  assert.ok(row && row.status === 'present');
  assert.equal((await a.put('/rh/pointage', { date: day, entries: [{ teacher_id: tid, slot: row.slot, status: 'absence', motif: 'Non venu' }] })).status, 200);
  assert.equal((await a.get(`/rh/pointage?date=${day}`)).data.rows.find((x) => x.teacher_id === tid && x.slot === row.slot).status, 'absence');
  assert.equal((await a.get(`/rh/enseignants/${tid}?${q}`)).data.summary.abs_nj, base0.summary.abs_nj + 1);
  assert.equal((await a.put('/rh/pointage', { date: day, entries: [{ teacher_id: tid, slot: 2, status: 'absence' }] })).status, 400); // pas de cours sur ce créneau
  assert.equal((await a.put('/rh/pointage', { date: '2099-01-05', entries: [] })).status, 400);
  assert.equal((await a.put('/rh/pointage', { date: day, entries: [{ teacher_id: tid, slot: row.slot, status: 'present' }] })).status, 200);
  assert.equal((await a.get(`/rh/enseignants/${tid}?${q}`)).data.summary.abs_nj, base0.summary.abs_nj);
  // jours non ouvrés : un jour férié n'est plus dû
  assert.equal((await a.post('/rh/jours-feries', { date: day, label: 'Journée pédagogique' })).status, 201);
  assert.equal((await a.get(`/rh/enseignants/${tid}?${q}`)).data.summary.dues, Math.round((base0.summary.dues - base0.load.byDay[wd]) * 10) / 10);
  assert.equal((await a.del(`/rh/jours-feries/${day}`)).status, 200);
  // tableau d'ensemble et cloisonnement
  const all = (await a.get('/rh/enseignants?period=A')).data;
  assert.ok(all.rows.length >= 12 && all.rows.every((x) => 'taux' in x.assiduite));
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  assert.equal((await t.get('/rh/enseignants')).status, 403);
  assert.equal((await t.post('/rh/absences', { teacher_id: 2, kind: 'retard', date: day, minutes: 5 })).status, 403);
  const mine = await t.get('/mon-assiduite?period=A');
  assert.equal(mine.status, 200);
  assert.equal(mine.data.agent.id, 2);
});

test('documents administratifs : émission, numérotation, réponse, suite, annulation et accès', async () => {
  const a = await admin();
  const DOC = (b) => a.post('/rh/documents', b);
  // certificat de prise de service : la date de prise de service est requise
  await a.put('/rh/enseignants/2', { date_prise_service: '' });
  assert.equal((await DOC({ teacher_id: 2, type: 'prise_service' })).status, 400);
  await a.put('/rh/enseignants/2', { date_prise_service: '2018-09-03' });
  const cps = await DOC({ teacher_id: 2, type: 'prise_service' });
  assert.equal(cps.status, 201);
  assert.match(cps.data.reference, /^N° \d{3}\/\d{2}-\d{2}\/CPS\/MINESEC\/DRES-CE\/DDES-MFDI\/LPEY$/);
  // attestation de présence effective : taux d'assiduité figé dans le document
  const ape = await DOC({ teacher_id: 2, type: 'presence', period: 'S1' });
  assert.equal(ape.status, 201);
  const apeDoc = (await a.get(`/rh/documents/${ape.data.id}`)).data;
  assert.equal(typeof apeDoc.data.assiduite.taux, 'number');
  assert.equal(apeDoc.data.agent.full_name, 'MBARGA Jean-Paul');
  // courriers : faits obligatoires ; numérotation propre à chaque type
  assert.equal((await DOC({ teacher_id: 2, type: 'rappel_ordre', faits: 'court' })).status, 400);
  const nDE = (await a.get('/rh/documents?type=demande_explication')).data.rows.length;
  const de = await DOC({ teacher_id: 2, type: 'demande_explication', faits: 'Absence non justifiée au conseil de classe de la 3e A.', delai_heures: 48 });
  assert.equal(de.status, 201);
  assert.match(de.data.reference, new RegExp(`^N° ${String(nDE + 1).padStart(3, '0')}/`));
  const ro = await DOC({ teacher_id: 2, type: 'rappel_ordre', faits: 'Retards répétés aux premières heures de cours.' });
  assert.equal(ro.status, 201);
  // l'enseignant concerné : lecture, accusé de réception, réponse unique
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  const list = (await t.get('/mes-documents')).data;
  assert.ok(list.rows.some((x) => x.id === de.data.id) && list.a_repondre >= 1);
  assert.equal((await t.get('/rh/documents')).status, 403);
  assert.equal((await t.put(`/mes-documents/${de.data.id}/reponse`, { reponse: 'trop court' })).status, 400);
  assert.equal((await t.put(`/mes-documents/${ro.data.id}/reponse`, { reponse: 'Une réponse suffisamment longue pour être acceptée.' })).status, 400);
  const ack = await t.post(`/mes-documents/${de.data.id}/accuse`);
  assert.equal(ack.data.echeance, ack.data.ack_at + 48 * 3600);
  assert.equal((await a.put(`/rh/documents/${de.data.id}`, { faits: 'Modification après remise du document.' })).status, 400);
  const rep = await t.put(`/mes-documents/${de.data.id}/reponse`, { reponse: "Monsieur le Proviseur, j'étais convoqué à un examen officiel. Veuillez trouver ci-joint la convocation." });
  assert.equal(rep.status, 200);
  assert.equal(rep.data.status, 'repondu');
  assert.equal((await t.put(`/mes-documents/${de.data.id}/reponse`, { reponse: 'Seconde réponse, qui doit être refusée par le serveur.' })).status, 400);
  assert.ok(isPdf(await t.get(`/pdf/document/${de.data.id}`)));
  assert.ok(isPdf(await t.get('/pdf/assiduite-enseignant?period=A')));
  // un autre enseignant n'y a pas accès
  const pw = (await a.post('/admin/users/3/reveal')).data;
  const o = client(); assert.equal((await o.login(pw.username, pw.password)).status, 200);
  assert.equal((await o.get(`/pdf/document/${de.data.id}`)).status, 404);
  assert.equal((await o.post(`/mes-documents/${de.data.id}/accuse`)).status, 404);
  const sg = client(); await sg.login('sg.nguemap', 'Disc@2026');
  assert.equal((await sg.get('/mes-documents')).status, 403);
  // suite réservée, lettre d'observation en référence, annulation
  assert.equal((await a.post(`/rh/documents/${de.data.id}/suite`, { suite: 'Explications non satisfaisantes.' })).status, 200);
  assert.equal((await a.get(`/rh/documents/${de.data.id}`)).data.status, 'clos');
  const lo = await DOC({ teacher_id: 2, type: 'observation', faits: 'Absence non justifiée au conseil de classe de la 3e A.', ref_doc_id: de.data.id });
  assert.equal(lo.status, 201);
  const other = (await a.get('/rh/documents?teacher_id=13')).data.rows[0];
  assert.equal((await DOC({ teacher_id: 2, type: 'observation', faits: 'Référence à un document d’un autre enseignant.', ref_doc_id: other.id })).status, 400);
  assert.equal((await a.post(`/rh/documents/${ro.data.id}/remise`, { date: '2099-01-01' })).status, 400);
  assert.equal((await a.post(`/rh/documents/${ro.data.id}/remise`, {})).status, 200);
  assert.equal((await a.post(`/rh/documents/${ro.data.id}/remise`, {})).status, 400); // déjà remis
  assert.equal((await a.post(`/rh/documents/${ro.data.id}/annuler`, { motif: 'Erreur de destinataire' })).status, 200);
  assert.ok(!(await t.get('/mes-documents')).data.rows.some((x) => x.id === ro.data.id));
  assert.equal((await t.get(`/pdf/document/${ro.data.id}`)).status, 404);
  for (const d of [cps, ape, de, lo, ro]) assert.ok(isPdf(await a.get(`/pdf/document/${d.data.id}`)));
  for (const p of ['/pdf/assiduite?period=A', '/pdf/assiduite?period=T1', '/pdf/assiduite-enseignant?teacher_id=13&period=S1', '/pdf/registre-documents']) assert.ok(isPdf(await a.get(p)), p);
  assert.ok((await a.get('/rh/documents?type=demande_explication')).data.rows.every((x) => x.type === 'demande_explication'));
  // les documents font partie de la sauvegarde ; une sauvegarde « EduGest CM » reste restaurable
  const dump = (await a.get('/admin/backup')).data;
  assert.ok(dump.tables.staff_documents.length >= 10 && dump.tables.staff_attendance.length > 0);
  dump.app = 'EduGest CM';
  assert.equal((await a.post('/admin/restore', { dump, password: 'Admin@2026' })).status, 200);
  adminClient = null;
  assert.equal((await (await admin()).get('/rh/documents')).data.rows.length, dump.tables.staff_documents.filter((x) => x.annee === dump.tables.staff_documents.at(-1).annee).length);
});

test('Word (DOCX) : écriture puis relecture des tableaux et paragraphes', async () => {
  const { buildDocx, readDocx, unzip, p, r, table } = await import('../server/docx.js');
  const buf = buildDocx({ body: [p([r('Rapport de rentrée', { b: true })]), table([['Document', 'Date limite'], ['Effectifs', '20/10/2026'], [{ content: 'Synthèse & « bilan »', b: true }, '']]), p('Fait à Yaoundé')] });
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  const parts = unzip(buf);
  for (const k of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml']) assert.ok(parts.has(k), k);
  const d = readDocx(buf);
  assert.deepEqual(d.tables[0], [['Document', 'Date limite'], ['Effectifs', '20/10/2026'], ['Synthèse & « bilan »', '']]);
  assert.ok(d.paragraphs.includes('Rapport de rentrée') && d.paragraphs.includes('Fait à Yaoundé'));
});

test('chronogramme : lecture des tableaux PDF (cellules sur plusieurs lignes) et repérage des échéances', async () => {
  const { pageRows, extractEcheances, findDates, detectModele } = await import('../server/chrono.js');
  // fragments positionnés comme les restitue pdf.js : n°, intitulé sur 2 lignes, date, destinataire
  const it = (x, y, s) => ({ str: s, transform: [11, 0, 0, 11, x, y], width: s.length * 5, height: 11 });
  const rows = pageRows([it(90, 700, 'N°'), it(150, 700, 'Document à produire'), it(300, 700, 'Date limite'), it(420, 700, 'Destinataire'),
    it(90, 687, '1'), it(150, 687, 'Fiche des effectifs'), it(150, 674, 'par classe'), it(300, 687, '20/10/2026'), it(420, 687, 'DDES'),
    it(90, 661, '2'), it(150, 661, 'Statistiques'), it(150, 648, "d'assiduité du personnel"), it(300, 661, 'le 5 de chaque'), it(300, 648, 'mois'), it(420, 661, 'DDES'),
    it(90, 635, '3'), it(150, 635, 'Rapport de fin'), it(150, 622, "d'année"), it(300, 635, '10 juillet 2027'), it(420, 635, 'DRES'),
    it(90, 590, 'Fait à Bafoussam, le 1er septembre 2026')]);
  assert.deepEqual(rows.slice(0, 4), [['N°', 'Document à produire', 'Date limite', 'Destinataire'], ['1', 'Fiche des effectifs par classe', '20/10/2026', 'DDES'],
    ['2', "Statistiques d'assiduité du personnel", 'le 5 de chaque mois', 'DDES'], ['3', "Rapport de fin d'année", '10 juillet 2027', 'DRES']]);
  const periods = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'].map((m, i) => ({ seq: i + 1, start_date: `${m}-01`, end_date: `${m}-20` }));
  const ech = extractEcheances([...rows, ['4', 'Taux de couverture des programmes', 'dans les 10 jours après chaque séquence', 'IPR'], ['5', 'Procès-verbaux des conseils de classe', 'fin de chaque trimestre', 'DDES']], { y0: 2026, periods });
  const by = (re) => ech.filter((e) => re.test(e.titre));
  assert.deepEqual(by(/^Fiche des effectifs/).map((e) => [e.date_limite, e.destinataire, e.modele]), [['2026-10-20', 'DDES', 'effectifs']]);
  assert.equal(by(/^Rapport de fin/)[0].date_limite, '2027-07-10');
  assert.equal(by(/^Rapport de fin/)[0].modele, 'rapport_annuel');
  const mens = by(/^Statistiques d'assiduité/);
  assert.equal(mens.length, 10); assert.equal(mens[0].date_limite, '2026-10-05'); assert.match(mens[0].titre, /septembre 2026$/); assert.equal(mens[0].modele, 'assiduite_personnel');
  const seq = by(/^Taux de couverture/); assert.equal(seq.length, 6); assert.equal(seq[0].date_limite, '2026-09-30'); assert.equal(seq[0].periodicite, 'sequentiel');
  const tri = by(/^Procès-verbaux/); assert.equal(tri.length, 3); assert.match(tri[0].titre, /1er trimestre$/); assert.equal(tri[0].date_limite, '2026-10-27');
  assert.ok(!ech.some((e) => /^Fait à/.test(e.titre)), 'formule de signature ignorée');
  assert.deepEqual(findDates('avant le 1er oct. et le 15/01', 2026), ['2026-10-01', '2027-01-15']);
  assert.equal(detectModele('Liste des candidats au BEPC'), 'candidats');
});

test('chronogramme des dépôts : import Word/PDF, échéances, modèle Word, dépôt et rappels', async () => {
  const a = await admin();
  const { buildDocx, readDocx, table, p } = await import('../server/docx.js');
  const b64 = (buf) => Buffer.from(buf).toString('base64');
  const word = buildDocx({ body: [p('CHRONOGRAMME DES DÉPÔTS'), table([['N°', 'Document à produire', 'Date limite', 'Destinataire'], ['1', 'État des effectifs par classe', '15/10/2026', 'DDES du Mfoundi'],
    ['2', 'Rapport disciplinaire', 'fin de chaque trimestre', 'DRES du Centre'], ['3', 'Rapport de fin d’année scolaire', '10 juillet 2027', 'DRES du Centre']])] });
  const t = client(); await t.login('mbargajp', 'Prof@2026');
  assert.equal((await t.get('/admin/echeancier')).status, 403);
  // formats refusés
  assert.match((await a.post('/admin/echeancier/chronogrammes', { nom_fichier: 'ancien.doc', data: b64('xx') })).data.error, /\.docx/);
  assert.equal((await a.post('/admin/echeancier/chronogrammes', { nom_fichier: 'faux.pdf', data: b64('pas un pdf') })).status, 400);
  // import Word : propositions vérifiables
  const imp = await a.post('/admin/echeancier/chronogrammes', { titre: 'Chronogramme test', nom_fichier: 'chronogramme_test.docx', data: b64(word) });
  assert.equal(imp.status, 201);
  const props = imp.data.propositions;
  assert.ok(props.find((x) => x.titre === 'État des effectifs par classe' && x.date_limite === '2026-10-15' && x.destinataire === 'DDES du Mfoundi' && x.modele === 'effectifs'));
  assert.equal(props.filter((x) => /^Rapport disciplinaire — /.test(x.titre)).length, 3);
  assert.ok(props.find((x) => x.modele === 'rapport_annuel' && x.date_limite === '2027-07-10'));
  // fichier conservé et relecture
  const f = await a.get(`/admin/echeancier/chronogrammes/${imp.data.id}/fichier`);
  assert.equal(f.status, 200); assert.equal(Buffer.from(f.data).subarray(0, 2).toString(), 'PK');
  assert.equal((await a.post(`/admin/echeancier/chronogrammes/${imp.data.id}/analyser`)).data.propositions.length, props.length);
  // enregistrement des échéances retenues + une échéance déjà dépassée (rappel)
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const cre = await a.post('/admin/echeancier/echeances', { chronogramme_id: imp.data.id, items: [...props, { titre: 'Liste des candidats aux examens', date_limite: hier, destinataire: 'OBC' }] });
  assert.equal(cre.status, 201); assert.equal(cre.data.ids.length, props.length + 1);
  const late = cre.data.ids.at(-1);
  let list = (await a.get('/admin/echeancier')).data;
  const e = list.echeances.find((x) => x.id === late);
  assert.equal(e.etat, 'retard'); assert.equal(e.modele, 'candidats');
  assert.ok((await a.get('/admin/echeancier/rappels')).data.some((x) => x.id === late));
  assert.ok((await a.get('/admin/dashboard')).data.alerts.some((x) => x.link === '#/chronogramme' && /en retard de dépôt/.test(x.text)));
  // modèle Word pré-rempli (en-tête officiel, tableau des candidats)
  const m = await a.get(`/admin/echeancier/echeances/${late}/modele`);
  assert.equal(m.status, 200); assert.match(m.ct, /wordprocessingml/);
  const md = readDocx(Buffer.from(m.data));
  assert.ok(md.tables[0].flat().join(' ').includes('RÉPUBLIQUE DU CAMEROUN'));
  assert.ok(md.paragraphs.some((x) => /Liste des candidats aux examens/i.test(x)));
  for (const type of Object.keys(list.modeles)) assert.equal((await a.get(`/admin/echeancier/modeles/${type}`)).status, 200, type);
  // dépôt avec la pièce déposée, consultation, annulation
  assert.equal((await a.post(`/admin/echeancier/echeances/${late}/depot`, { date: '2999-01-01' })).status, 400);
  const dep = await a.post(`/admin/echeancier/echeances/${late}/depot`, { date: hier, observation: 'Remis contre décharge', nom_fichier: 'candidats.docx', data: b64(Buffer.from(m.data)) });
  assert.equal(dep.status, 200);
  list = (await a.get('/admin/echeancier')).data;
  const d1 = list.echeances.find((x) => x.id === late);
  assert.equal(d1.etat, 'depose'); assert.equal(d1.a_fichier, true); assert.equal(d1.depot_fichier, undefined);
  assert.ok(!(await a.get('/admin/echeancier/rappels')).data.some((x) => x.id === late));
  const got = await a.get(`/admin/echeancier/echeances/${late}/depot`);
  assert.equal(Buffer.compare(Buffer.from(got.data), Buffer.from(m.data)), 0);
  assert.equal((await a.post(`/admin/echeancier/echeances/${late}/annuler-depot`)).status, 200);
  assert.equal((await a.get('/admin/echeancier')).data.echeances.find((x) => x.id === late).etat, 'retard');
  // modification, PDF scanné (sans texte), suppression du chronogramme et de ses échéances non déposées
  assert.equal((await a.put(`/admin/echeancier/echeances/${late}`, { date_limite: '2027-06-30', rappel_jours: 10 })).status, 200);
  const PDFDocument = (await import('pdfkit')).default;
  const scan = await new Promise((res) => { const doc = new PDFDocument(); const ch = []; doc.on('data', (c) => ch.push(c)); doc.on('end', () => res(Buffer.concat(ch))); doc.rect(50, 50, 200, 100).fill('#999'); doc.end(); });
  const sc = await a.post('/admin/echeancier/chronogrammes', { nom_fichier: 'scan.pdf', data: b64(scan) });
  assert.equal(sc.status, 201); assert.equal(sc.data.propositions.length, 0); assert.match(sc.data.message, /scanné/);
  assert.equal((await a.del(`/admin/echeancier/chronogrammes/${imp.data.id}?garder=0`)).status, 200);
  list = (await a.get('/admin/echeancier')).data;
  assert.ok(!list.echeances.some((x) => x.chronogramme_id === imp.data.id));
  assert.ok(!list.chronogrammes.some((x) => x.id === imp.data.id));
});

test('nom de domaine canonique : redirection permanente des autres adresses', async () => {
  // fetch() ignore l'en-tête Host : requête HTTP brute
  const http = await import('node:http');
  const get = (host, p = '/e/lpey/admin?x=1', method = 'GET') => new Promise((res, rej) => {
    const rq = http.request(base + p, { method, headers: { host, 'X-Requested-With': 'EduGest' } }, (r) => { r.resume(); res({ status: r.statusCode, headers: { get: (k) => r.headers[k] } }); });
    rq.on('error', rej); rq.end();
  });
  assert.equal((await get('edugest-cm.onrender.com')).status, 200, 'sans CANONICAL_URL : aucun effet');
  process.env.CANONICAL_URL = 'https://ai721-schoolx.cm';
  try {
    const r1 = await get('edugest-cm.onrender.com');
    assert.equal(r1.status, 301); assert.equal(r1.headers.get('location'), 'https://ai721-schoolx.cm/e/lpey/admin?x=1');
    assert.equal((await get('ai721-schoolx-cm.onrender.com', '/e/lpey/api/auth/login', 'POST')).status, 308);
    assert.equal((await get('ai721-schoolx.cm')).status, 200);
    assert.equal((await get('10.0.0.7:10000', '/healthz')).status, 200);
  } finally { delete process.env.CANONICAL_URL; }
});

test('fin d\'année : clôture avec statistiques annuelles et sauvegarde archivées, puis nouvelle année', async () => {
  const a = await admin();
  const annee = (await a.get('/admin/settings')).data.annee_scolaire;
  const y = +annee.slice(0, 4);
  assert.equal((await a.post('/admin/new-year', { annee_scolaire: `${y + 1}-${y + 2}`, password: 'Admin@2026' })).status, 409); // année non clôturée
  assert.equal((await a.post('/admin/annee/cloturer', { password: 'Admin@2026' })).status, 409); // séquences ouvertes
  const r = await a.post('/admin/annee/cloturer', { password: 'Admin@2026', force: true });
  assert.equal(r.status, 200);
  assert.ok(r.data.global.moyenne > 0);
  assert.equal((await a.post('/admin/annee/cloturer', { password: 'Admin@2026', force: true })).status, 400); // déjà clôturée
  const arch = (await a.get('/admin/archives')).data;
  assert.equal(arch[0].annee, annee);
  assert.equal((await a.get(`/admin/archives/${arch[0].id}/rapport`)).ct, 'application/pdf');
  const bk = await a.get(`/admin/archives/${arch[0].id}/sauvegarde`);
  assert.equal(bk.status, 200);
  assert.ok(fs.existsSync(path.join(DATA, 'tenants', 'lpey', 'archives', `rapport-annuel-${annee}.pdf`)));
  assert.equal((await a.post('/admin/new-year', { annee_scolaire: `${y + 1}-${y + 2}`, password: 'Admin@2026' })).status, 200);
  assert.equal((await a.get('/admin/settings')).data.annee_scolaire, `${y + 1}-${y + 2}`);
});

test('sécurité : aucun identifiant de démonstration exposé, mot de passe AI721 public remplacé', async () => {
  for (const u of ['/console/api/auth/public', '/e/lpey/api/auth/public']) {
    const txt = await (await fetch(base + u)).text();
    assert.ok(!/demo|@2026|mbargajp|sg\.nguemap/i.test(txt), `${u} : ${txt.slice(0, 80)}`);
  }
  const { secureSuperadmin, pdb } = await import('../server/platform.js');
  const { hashPassword } = await import('../server/security.js');
  assert.equal(secureSuperadmin(), null, 'mot de passe désigné explicitement par SUPERADMIN_PASSWORD : conservé');
  delete process.env.SUPERADMIN_PASSWORD;
  try {
    const pw = secureSuperadmin();
    assert.ok(pw && pw !== 'Ai721@2026');
    assert.equal((await client('/console/api').login('AI721', 'Ai721@2026')).status, 401);
    const c = client('/console/api'); assert.equal((await c.login('AI721', pw)).status, 200);
    assert.equal((await c.get('/dashboard')).status, 428, 'nouveau mot de passe à changer à la première connexion');
  } finally {
    process.env.SUPERADMIN_PASSWORD = 'Ai721@2026';
    pdb.prepare("UPDATE users SET pass_hash = ?, must_change = 0 WHERE username = 'AI721'").run(hashPassword('Ai721@2026'));
  }
});

test('cloisonnement : chaque compte n\'ouvre que son interface ; la console est fermée aux établissements', async () => {
  const loginRaw = async (u, p, portal) => {
    const r = await fetch(base + '/e/lpey/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'EduGest' }, body: JSON.stringify({ username: u, password: p, portal }) });
    const cookies = r.headers.getSetCookie();
    return { cookies, jar: cookies.map((c) => c.split(';')[0]).join('; ') };
  };
  const page = (p, jar, extra = {}) => fetch(base + p, { redirect: 'manual', headers: { ...(jar ? { cookie: jar } : {}), ...extra } });
  const t = await loginRaw('mbargajp', 'Prof@2026', 'teacher');
  const mark = t.cookies.find((c) => c.startsWith('sx_esp_lpey='));
  assert.ok(mark && /HttpOnly/i.test(mark) && /Path=\//.test(mark) && /SameSite=Strict/i.test(mark), 'témoin d\'espace HttpOnly');
  // pages : l'enseignant est renvoyé vers son espace
  let r = await page('/e/lpey/admin', t.jar);
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/e/lpey/enseignant?refus=admin');
  assert.equal((await page('/e/lpey/discipline', t.jar)).status, 302);
  assert.equal((await page('/e/lpey/enseignant', t.jar)).status, 200);
  r = await page('/console', t.jar);
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/e/lpey/enseignant?refus=console');
  // console : API fermée (sauf informations publiques de l'accueil), même avec les identifiants AI721
  const k = await fetch(base + '/console/api/auth/login', { method: 'POST', headers: { cookie: t.jar, 'Content-Type': 'application/json', 'X-Requested-With': 'EduGest' }, body: JSON.stringify({ username: 'AI721', password: 'Ai721@2026' }) });
  assert.equal(k.status, 403); assert.equal((await k.json()).redirect, '/e/lpey/enseignant');
  assert.equal((await page('/console/api/auth/public', t.jar)).status, 200);
  // API : l'interface appelante (X-Portal) doit être celle du rôle
  r = await page('/e/lpey/api/classes/mine', t.jar, { 'X-Portal': 'admin' });
  assert.equal(r.status, 403); assert.match((await r.json()).error, /réservée à l'administrateur/);
  assert.equal((await page('/e/lpey/api/classes/mine', t.jar, { 'X-Portal': 'teacher' })).status, 200);
  assert.equal((await page('/e/lpey/api/auth/me', t.jar, { 'X-Portal': 'admin' })).status, 200);
  assert.equal((await page('/e/lpey/api/admin/dashboard', t.jar, { 'X-Portal': 'teacher' })).status, 403);
  // responsable disciplinaire : administration refusée
  const d = await loginRaw('sg.nguemap', 'Disc@2026', 'discipline');
  r = await page('/e/lpey/admin', d.jar);
  assert.equal(r.headers.get('location'), '/e/lpey/discipline?refus=admin');
  assert.equal((await page('/console', d.jar)).status, 302);
  // administrateur : console refusée, son interface ouverte
  const a = await loginRaw('admin', 'Admin@2026', 'admin');
  assert.equal((await page('/console', a.jar)).headers.get('location'), '/e/lpey/admin?refus=console');
  assert.equal((await page('/e/lpey/admin', a.jar)).status, 200);
  // témoin falsifié ou expiré : sans effet
  const [role, exp, sig] = decodeURIComponent(mark.split(';')[0].split('=')[1]).split('.');
  assert.equal((await page('/console', null, { cookie: `sx_esp_lpey=${encodeURIComponent(`admin.${exp}.${sig}`)}` })).status, 200);
  assert.equal((await page('/console', null, { cookie: `sx_esp_lpey=${encodeURIComponent(`${role}.${Date.now() - 1000}.${sig}`)}` })).status, 200);
  // déconnexion : témoin effacé, la console redevient accessible (page de connexion)
  const out = await fetch(base + '/e/lpey/api/auth/logout', { method: 'POST', headers: { cookie: t.jar, 'X-Requested-With': 'EduGest' } });
  assert.ok(out.headers.getSetCookie().some((c) => c.startsWith('sx_esp_lpey=;') && /Expires=Thu, 01 Jan 1970/.test(c)));
  assert.equal((await page('/console')).status, 200);
});

test('limitation de débit : seules les tentatives échouées sont comptées', async () => {
  for (let i = 0; i < 12; i++) assert.equal((await client().login('sg.essomba', 'faux')).status === 429 ? 'bloqué' : 'ok', i < 10 ? 'ok' : 'bloqué');
  // 12 connexions réussies d'un même compte (plusieurs appareils) ne bloquent jamais
  for (let i = 0; i < 12; i++) assert.equal((await client().login('mbargajp', 'Prof@2026')).status, 200, `connexion ${i + 1}`);
});
