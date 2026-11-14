// Captures d'écran pour le manuel (application démarrée avec le jeu de démonstration).
// Usage : BASE=http://localhost:3200 node scripts/captures.cjs docs/captures
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3200';
const OUT = process.argv[2] || 'docs/captures';
fs.mkdirSync(OUT, { recursive: true });

async function login(page, portal, user, pass) {
  await page.goto(`${BASE}/${portal}/connexion`);
  await page.fill('#username', user);
  await page.fill('#password', pass);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/connexion')), page.click('button[type=submit]')]);
}
async function shot(page, name, url, opts = {}) {
  if (url) await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (opts.before) await opts.before(page);
  await page.waitForTimeout(opts.wait ?? 400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.full });
  console.log('✓', name);
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());

(async () => {
  const browser = await chromium.launch();
  const desk = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };

  // Public
  const pub = await browser.newContext(desk);
  const p = await pub.newPage();
  await shot(p, '01_accueil_site', '/');
  await shot(p, '02_connexion_admin', '/admin/connexion');
  await shot(p, '03_connexion_encadreur', '/encadreur/connexion');
  const pubM = await browser.newContext({ ...devices['iPhone 13'] });
  const pm = await pubM.newPage();
  await shot(pm, '04_mobile_choix_espace', '/connexion');
  await shot(pm, '05_mobile_connexion_parent', '/parent/connexion');

  // Administration
  const a = await (await browser.newContext(desk)).newPage();
  a.on('dialog', (d) => d.accept());
  await login(a, 'admin', process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASS || 'Admin@2026');
  // Séance du jour (pour illustrer l'espace encadreur)
  await a.goto(`${BASE}/admin/seances`);
  await a.getByRole('button', { name: /Séance ponctuelle/ }).click();
  const dlg = a.locator('dialog[open]');
  await dlg.locator('input[name=date]').fill(today);
  await dlg.locator('input[name=startTime]').fill('00:05');
  await dlg.locator('input[name=endTime]').fill('23:55');
  await dlg.locator('select[name=classId]').selectOption({ label: 'Terminale' });
  await dlg.locator('select[name=subjectId]').selectOption({ label: 'Algorithmique et programmation' });
  await dlg.locator('select[name=tutorId]').selectOption({ label: 'Paul NDJOCK' });
  await dlg.locator('select[name=roomId]').selectOption({ label: 'Salle A' });
  await dlg.locator('input[name=topic]').fill('Les fonctions et procédures');
  await dlg.getByRole('button', { name: 'Ajouter' }).click();
  await a.waitForTimeout(1500);

  await shot(a, '10_admin_tableau_de_bord', '/admin');
  await shot(a, '11_admin_palette', '/admin', { before: async (pg) => { await pg.keyboard.press('Control+k'); await pg.keyboard.type('sal'); } });
  await shot(a, '12_admin_parametres', '/admin/parametres');
  await shot(a, '12b_admin_parametres_horaires', '/admin/parametres', { before: async (pg) => pg.getByText('Jours, horaires et créneaux').scrollIntoViewIfNeeded() });
  await shot(a, '13_admin_classes', '/admin/classes');
  await shot(a, '14_admin_matieres', '/admin/matieres');
  await shot(a, '15_admin_salles', '/admin/salles');
  await shot(a, '16_admin_eleves', '/admin/eleves');
  await shot(a, '16b_admin_eleve_formulaire', '/admin/eleves', { before: async (pg) => pg.getByRole('button', { name: 'Inscrire un élève' }).click() });
  await shot(a, '16c_admin_import', '/admin/eleves', { before: async (pg) => pg.getByRole('button', { name: 'Importer' }).click() });
  await a.goto(`${BASE}/admin/eleves`);
  const firstStudent = await a.locator('a[href^="/admin/eleves/"]').first().getAttribute('href');
  await shot(a, '17_admin_fiche_eleve', firstStudent);
  await shot(a, '18_admin_parents', '/admin/parents');
  await shot(a, '18b_admin_identifiants', '/admin/parents', { before: async (pg) => { await pg.getByRole('button', { name: /Réinitialiser/ }).first().click(); await pg.getByText('Identifiants générés').waitFor(); } });
  await shot(a, '19_admin_encadreurs', '/admin/encadreurs');
  await shot(a, '20_admin_attributions', '/admin/attributions');
  await shot(a, '21_admin_planning', '/admin/planning');
  await shot(a, '22_admin_seances', '/admin/seances');
  await shot(a, '22b_admin_seances_a_valider', '/admin/seances?statut=AVALIDER');
  await shot(a, '23_admin_presences', '/admin/presences?classe=9');
  await shot(a, '24_admin_notes', '/admin/notes?classe=9');
  await shot(a, '25_admin_documents', '/admin/documents');
  await shot(a, '26_admin_paiements', '/admin/paiements?du=2026-10-01');
  await shot(a, '26b_admin_encaisser', '/admin/paiements?nouveau=1', { before: async (pg) => { const d = pg.locator('dialog[open]'); await d.locator('select[name=studentId]').selectOption({ index: 3 }); } });
  await shot(a, '27_admin_impayes', '/admin/impayes');
  await shot(a, '28_admin_depenses', '/admin/depenses?du=2026-10-01');
  await shot(a, '29_admin_caisse', '/admin/caisse?du=2026-10-01');
  await shot(a, '30_admin_location', '/admin/location?mois=2026-10');
  await shot(a, '31_admin_salaires', '/admin/salaires?mois=2026-10');
  await shot(a, '32_admin_messages', '/admin/messages');
  await shot(a, '33_admin_comptes', '/admin/comptes');
  await shot(a, '34_admin_journal', '/admin/journal');
  await shot(a, '35_admin_sauvegarde', '/admin/sauvegarde');
  const tab = await browser.newContext({ ...devices['iPad (gen 7)'] });
  const at = await tab.newPage();
  await login(at, 'admin', process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASS || 'Admin@2026');
  await shot(at, '36_tablette_admin', '/admin');
  const am = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  await login(am, 'admin', process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASS || 'Admin@2026');
  await shot(am, '37_mobile_admin', '/admin');
  await shot(am, '38_mobile_admin_menu', '/admin', { before: async (pg) => pg.getByRole('button', { name: 'Ouvrir le menu' }).click() });

  // Encadreur
  const t = await (await browser.newContext(desk)).newPage();
  t.on('dialog', (d) => d.accept());
  await login(t, 'encadreur', 'paul.ndjock', 'Demo@2026');
  await t.getByRole('button', { name: /Démarrer la séance/ }).first().click();
  await t.waitForTimeout(65000); // une minute de séance pour le chronomètre
  await shot(t, '40_encadreur_accueil', '/encadreur');
  await t.getByRole('link', { name: /Faire l.appel/ }).first().click();
  await t.waitForURL(/seances\/\d+/);
  const seanceUrl = new URL(t.url()).pathname;
  await shot(t, '41_encadreur_seance', seanceUrl);
  await shot(t, '42_encadreur_seances', '/encadreur/seances');
  await shot(t, '43_encadreur_eleves', '/encadreur/eleves');
  const st = await t.locator('a[href^="/encadreur/eleves/"]').first().getAttribute('href');
  await shot(t, '44_encadreur_suivi_eleve', st);
  await shot(t, '45_encadreur_notes', '/encadreur/notes');
  const ev = await t.locator('a[href^="/encadreur/notes/"]').first().getAttribute('href');
  await shot(t, '46_encadreur_saisie_notes', ev);
  await shot(t, '47_encadreur_documents', '/encadreur/documents');
  await shot(t, '48_encadreur_heures', '/encadreur/heures?mois=2026-10');
  const tm = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  await login(tm, 'encadreur', 'paul.ndjock', 'Demo@2026');
  await shot(tm, '49_mobile_encadreur_accueil', '/encadreur');
  await shot(tm, '50_mobile_encadreur_appel', `${seanceUrl}#appel`, { before: async (pg) => pg.locator('#appel').scrollIntoViewIfNeeded() });
  await shot(tm, '51_mobile_encadreur_menu', '/encadreur', { before: async (pg) => pg.getByRole('button', { name: 'Plus' }).click() });

  // Parent
  const pa = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  await login(pa, 'parent', '690000001', 'Demo@2026');
  await shot(pa, '60_mobile_parent_accueil', '/parent');
  await shot(pa, '61_mobile_parent_planning', '/parent/planning');
  const ps = await pa.locator('a[href^="/parent/seances/"]').first().getAttribute('href');
  await shot(pa, '62_mobile_parent_seance', ps);
  await shot(pa, '63_mobile_parent_suivi', '/parent/suivi');
  await shot(pa, '64_mobile_parent_messages', '/parent/messages');
  await shot(pa, '65_mobile_parent_paiements', '/parent/paiements');
  const pd = await (await browser.newContext(desk)).newPage();
  await login(pd, 'parent', '690000001', 'Demo@2026');
  await shot(pd, '66_parent_accueil_ordinateur', '/parent');
  await shot(pd, '67_parent_suivi_ordinateur', '/parent/suivi');

  // PDF (enregistrés pour conversion en images)
  const pdfs = { planning: '/api/pdf/planning', planning_classe: '/api/pdf/planning?classe=9', salaires: '/api/pdf/salaires?mois=2026-10', location: '/api/pdf/location?mois=2026-10', caisse: `/api/pdf/caisse?du=2026-10-01&au=${today}`, recu: '/api/pdf/recu/1', suivi: '/api/pdf/suivi/60', seances: '/api/pdf/seances?mois=2026-11', impayes: '/api/pdf/impayes' };
  for (const [k, u] of Object.entries(pdfs)) {
    const r = await a.request.get(BASE + u);
    fs.writeFileSync(path.join(OUT, `pdf_${k}.pdf`), await r.body());
  }
  const r = await a.request.post(`${BASE}/api/pdf/acces`, { data: { creds: [{ name: 'Paul NDJOCK', role: 'ENCADREUR', username: 'paul.ndjock', password: 'Baobab@4827' }, { name: 'Mme MBALLA Christine', role: 'PARENT', username: '690000001', password: 'Soleil#1234' }] }, headers: { origin: BASE } });
  fs.writeFileSync(path.join(OUT, 'pdf_acces.pdf'), await r.body());
  console.log('✓ PDF');
  await browser.close();
})();
