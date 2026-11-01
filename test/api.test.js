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

test('limitation de débit : seules les tentatives échouées sont comptées', async () => {
  for (let i = 0; i < 12; i++) assert.equal((await client().login('sg.essomba', 'faux')).status === 429 ? 'bloqué' : 'ok', i < 10 ? 'ok' : 'bloqué');
  // 12 connexions réussies d'un même compte (plusieurs appareils) ne bloquent jamais
  for (let i = 0; i < 12; i++) assert.equal((await client().login('mbargajp', 'Prof@2026')).status, 200, `connexion ${i + 1}`);
});
