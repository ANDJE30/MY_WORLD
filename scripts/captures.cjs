// Parcours de bout en bout + captures d'écran du manuel (Playwright).
// Usage : DEMO=1 npm start  puis  node scripts/captures.cjs [url]
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:4100', OUT = path.join(__dirname, '..', 'docs', 'captures') + '/';
const errs = [];
async function ctxFor(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, isMobile: vp.width < 500, hasTouch: vp.width < 500, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return { ctx, page };
}
async function login(page, u, p) {
  await page.goto(BASE); await page.waitForSelector('#u'); await page.fill('#u', u); await page.fill('#p', p); await page.click('button[type=submit]');
  try { await page.waitForSelector('.app', { timeout: 10000 }); }
  catch (e) { console.log('Échec de connexion', u, ':', await page.locator('#loginErr').innerText().catch(() => '?'), (await page.locator('body').innerText()).slice(0, 200)); throw e; }
}
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(450);
  if (!full) return page.screenshot({ path: OUT + name + '.png' });
  // pleine page : on agrandit la fenêtre pour que la barre latérale couvre toute la hauteur
  const vp = page.viewportSize(); const hgt = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, hgt) }); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + name + '.png' }); await page.setViewportSize(vp);
};
(async () => {
  const browser = await chromium.launch();
  const D = { width: 1440, height: 900 }, M = { width: 390, height: 844 }, T = { width: 1024, height: 1300 };
  let { ctx, page } = await ctxFor(browser, D);
  await page.goto(BASE); await shot(page, '01_connexion');
  await login(page, 'admin', 'Admin@2026');
  const pages = [['dashboard', '02_admin_tableau_de_bord', true], ['etablissement', '03_admin_etablissement'], ['etablissement?tab=horaires', '04_admin_horaires'],
    ['calendrier', '05_admin_calendrier'], ['classes', '06_admin_classes'], ['matieres', '07_admin_matieres'], ['matieres?tab=groupes', '07c_admin_groupes'], ['matieres?tab=types', '07d_admin_types'], ['attributions', '08_admin_attributions'],
    ['eleves?class=1', '09_admin_eleves'], ['enseignants', '10_admin_enseignants'], ['responsables', '11_admin_responsables'], ['edt?class=1', '12_admin_edt'],
    ['suivi?seq=2', '13_admin_suivi'], ['resultats?class=1&period=S1', '14_admin_resultats'], ['statistiques?period=S1', '15_admin_statistiques'],
    ['annonces', '16_admin_annonces'], ['audit', '17_admin_audit'], ['sauvegarde', '18_admin_sauvegarde']];
  for (const [p, n, full] of pages) { await page.goto(`${BASE}/#/${p}`); await page.waitForSelector('#view > *:not(.empty)'); await shot(page, n, !!full); }
  // formulaire de matière : groupe et type indépendants, création d'un type à la volée
  await page.goto(`${BASE}/#/matieres`); await page.waitForSelector('[data-edit]');
  await page.click('[data-add]'); await page.fill('[name=name]', 'Électrotechnique'); await page.fill('[name=code]', 'ELEC');
  await page.selectOption('[name=group_id]', { index: 2 }); await page.selectOption('[name=type_id]', '__new__');
  await page.waitForFunction(() => document.querySelectorAll('.modal-root').length === 2);
  await page.fill('.modal-root:last-child [name=name]', 'Matière technique'); await shot(page, '07e_admin_type_a_la_volee');
  await page.click('.modal-root:last-child [data-submit]'); await page.waitForFunction(() => document.querySelectorAll('.modal-root').length === 1);
  await shot(page, '07b_admin_matiere_formulaire'); await page.click('.modal [data-close]');
  await page.goto(`${BASE}/#/enseignants`); await page.waitForTimeout(500);
  await page.click('[data-add]'); await page.fill('[name=full_name]', 'NANGA Béatrice Odile'); await page.selectOption('[name=sexe]', 'F'); await page.fill('[name=specialite]', 'Anglais');
  await page.click('[data-submit]'); await page.waitForSelector('.cred'); await shot(page, '19_admin_identifiants');
  console.log('Identifiants générés :', (await page.locator('.cred').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ')).join(' | '));
  await page.click('.modal [data-close]');
  await page.goto(`${BASE}/#/calendrier`); await page.waitForTimeout(500); await page.click('[data-close="2"]'); await page.waitForSelector('.modal'); await shot(page, '20_admin_cloture'); await page.click('.modal [data-close]');
  await page.goto(`${BASE}/#/edt?class=1`); await page.waitForTimeout(500); await page.click('td.cell.editable >> nth=3'); await page.waitForSelector('.modal'); await shot(page, '21_admin_edt_case'); await page.click('.modal [data-close]');
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, T)); await login(page, 'admin', 'Admin@2026'); await page.waitForTimeout(600); await shot(page, '22_tablette_admin'); await ctx.close();
  ({ ctx, page } = await ctxFor(browser, D)); await login(page, 'mbargajp', 'Prof@2026');
  await page.waitForTimeout(600); await shot(page, '23_enseignant_accueil', true);
  await page.goto(`${BASE}/#/saisie`); await page.waitForSelector('.note-input');
  const first = page.locator('.note-input:not([disabled])').first(); await first.click(); await first.fill('15,5'); await page.keyboard.press('Enter');
  await page.keyboard.type('8'); await page.keyboard.press('Enter'); await page.keyboard.type('a');
  await page.waitForSelector('[data-savebar]:not(.hidden)'); await shot(page, '24_enseignant_saisie');
  await page.waitForFunction(() => /Toutes les modifications sont enregistr/.test(document.querySelector('[data-savebar] .msg')?.innerText || ''), null, { timeout: 10000 });
  console.log('Enregistrement auto :', await page.locator('[data-savebar] .msg').innerText());
  await page.goto(`${BASE}/#/progression`); await page.waitForSelector('[data-k=planned]'); await shot(page, '25_enseignant_progression');
  await page.goto(`${BASE}/#/releves`); await page.waitForTimeout(500); await shot(page, '26_enseignant_releves');
  await page.goto(`${BASE}/#/edt`); await page.waitForTimeout(600); await shot(page, '27_enseignant_edt');
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, M)); await login(page, 'mbargajp', 'Prof@2026'); await page.waitForTimeout(600); await shot(page, '28_mobile_enseignant_accueil');
  await page.goto(`${BASE}/#/saisie`); await page.waitForSelector('.note-input'); await shot(page, '29_mobile_saisie_notes');
  await page.click('.bottombar [data-menu]'); await page.waitForTimeout(400); await shot(page, '30_mobile_menu');
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, D)); await login(page, 'sg.nguemap', 'Disc@2026'); await page.waitForTimeout(600); await shot(page, '31_discipline_accueil');
  await page.goto(`${BASE}/#/saisie`); await page.waitForSelector('[data-k=abs_nj]');
  await page.locator('[data-k=abs_nj]').first().fill('3'); await page.waitForTimeout(300); await shot(page, '32_discipline_saisie');
  await page.click('[data-incident]'); await page.waitForSelector('.modal'); await page.selectOption('[name=student_id]', { index: 2 }); await page.selectOption('[name=type]', { index: 3 });
  await page.fill('[name=sanction]', 'Consigne 2 h'); await shot(page, '33_discipline_incident'); await page.click('[data-submit]'); await page.waitForTimeout(800);
  await page.goto(`${BASE}/#/incidents`); await page.waitForTimeout(600); await shot(page, '34_discipline_registre');
  await page.goto(`${BASE}/#/fiches`); await page.waitForTimeout(500); await shot(page, '35_discipline_fiches');
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, M)); await login(page, 'sg.nguemap', 'Disc@2026');
  await page.goto(`${BASE}/#/saisie`); await page.waitForSelector('[data-k=abs_nj]'); await shot(page, '36_mobile_discipline');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await shot(page, '37_mobile_mode_sombre'); await ctx.close();
  console.log('Erreurs :', errs.length ? errs : 'aucune');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
