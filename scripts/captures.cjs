// Parcours de bout en bout + captures d'écran du manuel (Playwright).
// Usage : DEMO=1 npm start (dossier de données vide)  puis  LANG=fr_FR.UTF-8 node scripts/captures.cjs [url]   (LANG : dates au format jj/mm/aaaa)
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:4100', OUT = path.join(__dirname, '..', 'docs', 'captures') + '/';
const errs = [];
async function ctxFor(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, isMobile: vp.width < 500, hasTouch: vp.width < 500, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/40[23]/.test(m.text())) errs.push('console: ' + m.text()); });
  // erreurs HTTP inattendues (le refus volontaire d'un compte sur une autre interface est attendu)
  page.on('response', (r) => { if (r.status() >= 400 && r.status() !== 402 && !/\/auth\/login$/.test(r.url())) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  return { ctx, page };
}
async function login(page, portal, u, p) {
  await page.goto(BASE + portal); await page.waitForSelector('#u'); await page.fill('#u', u); await page.fill('#p', p); await page.click('button[type=submit]');
  try { await page.waitForSelector('.app', { timeout: 10000 }); }
  catch (e) { console.log('Échec de connexion', u, ':', await page.locator('#loginErr').innerText().catch(() => '?')); throw e; }
}
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(450);
  if (!full) return page.screenshot({ path: OUT + name + '.png' });
  const vp = page.viewportSize(); const hgt = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, hgt) }); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + name + '.png' }); await page.setViewportSize(vp);
};
const visit = async (page, portal, hash, name, full) => { await page.goto(`${BASE}${portal}#/${hash}`); await page.waitForSelector('#view > *:not(.empty)'); await shot(page, name, full); };
(async () => {
  const browser = await chromium.launch();
  const D = { width: 1440, height: 900 }, M = { width: 390, height: 844 }, T = { width: 1024, height: 1300 };
  let { ctx, page } = await ctxFor(browser, D);
  // ---- Plateforme : site, choix d'espace, 4 interfaces de connexion
  await page.goto(BASE); await page.waitForSelector('.lp-hero'); await shot(page, '00_site_presentation', true);
  await page.goto(BASE + '/e/lpey'); await page.waitForSelector('.chooser'); await shot(page, '00b_choix_espace');
  await page.goto(BASE + '/console'); await page.waitForSelector('#u'); await shot(page, '01_connexion_console');
  await page.goto(BASE + '/e/lpey/admin'); await page.waitForSelector('#u'); await shot(page, '01b_connexion_admin');
  await page.goto(BASE + '/e/lpey/enseignant'); await page.waitForSelector('#u'); await shot(page, '01c_connexion_enseignant');
  await page.goto(BASE + '/e/lpey/discipline'); await page.waitForSelector('#u'); await shot(page, '01d_connexion_discipline');
  await page.goto(BASE + '/e/cetbafoussam/admin'); await page.waitForSelector('#u'); await shot(page, '01e_abonnement_expire');
  // mauvais espace : un enseignant sur l'interface Administration
  await page.goto(BASE + '/e/lpey/admin'); await page.fill('#u', 'mbargajp'); await page.fill('#p', 'Prof@2026'); await page.click('button[type=submit]');
  await page.waitForSelector('#loginErr:not(.hidden)'); await shot(page, '01f_mauvaise_interface');
  // ---- Console AI721
  await login(page, '/console', 'AI721', 'Ai721@2026');
  await visit(page, '/console', 'dashboard', '40_console_tableau_de_bord', true);
  await visit(page, '/console', 'etablissements', '41_console_etablissements');
  await visit(page, '/console', 'etablissement?id=1', '42_console_fiche', true);
  await page.click('[data-acc]'); await page.waitForSelector('.modal .cred'); await shot(page, '43_console_acces'); await page.click('.modal [data-close]');
  await page.goto(`${BASE}/console#/etablissements`); await page.waitForSelector('[data-new]'); await page.click('[data-new]'); await page.waitForSelector('.modal [name=name]');
  await page.fill('.modal [name=name]', 'Lycée Technique Démo de Kribi'); await page.fill('.modal [name=sigle]', 'LTK'); await page.waitForTimeout(700);
  await page.selectOption('.modal [name=region]', 'Sud'); await page.fill('.modal [name=ville]', 'Kribi'); await page.fill('.modal [name=contact_nom]', 'M. ELLA Martin');
  await page.fill('.modal [name=contact_tel]', '699887766'); await page.selectOption('.modal [name=mode]', 'Mobile Money'); await page.fill('.modal [name=reference]', 'MOMO-778899');
  await shot(page, '44_console_nouvel_etablissement');
  await page.click('.modal [data-submit]'); await page.waitForSelector('.modal .cred'); await shot(page, '44b_console_acces_generes');
  console.log('Accès générés :', (await page.locator('.modal .cred').allInnerTexts()).slice(0, 2).map((c) => c.replace(/\s+/g, ' ')).join(' | '));
  await page.click('.modal [data-close]');
  await visit(page, '/console', 'abonnements', '45_console_abonnements');
  await visit(page, '/console', 'parametres', '46_console_parametres', true);
  await ctx.close();
  // ---- Administrateur de l'établissement
  ({ ctx, page } = await ctxFor(browser, D));
  await login(page, '/e/lpey/admin', 'admin', 'Admin@2026');
  const pages = [['dashboard', '02_admin_tableau_de_bord', true], ['etablissement', '03_admin_etablissement'], ['etablissement?tab=fonctions', '03b_admin_fonctions', true], ['etablissement?tab=horaires', '04_admin_horaires'],
    ['calendrier', '05_admin_calendrier', true], ['classes', '06_admin_classes'], ['matieres', '07_admin_matieres'], ['matieres?tab=groupes', '07c_admin_groupes'], ['matieres?tab=types', '07d_admin_types'],
    ['attributions', '08_admin_attributions'], ['eleves?class=1', '09_admin_eleves'], ['enseignants', '10_admin_enseignants'], ['responsables', '11_admin_responsables'],
    ['acces', '11b_admin_coffre'], ['edt?class=1', '12_admin_edt'], ['suivi?period=S2', '13_admin_suivi'], ['suivi?period=T1', '13b_admin_suivi_trimestre'],
    ['resultats?class=1&period=T1', '14_admin_resultats'], ['statistiques?period=T1', '15_admin_statistiques'],
    ['annonces', '16_admin_annonces'], ['audit', '17_admin_audit'], ['sauvegarde', '18_admin_sauvegarde']];
  for (const [p, n, full] of pages) await visit(page, '/e/lpey/admin', p, n, !!full);
  // coffre : afficher un mot de passe puis la fenêtre d'envoi
  await page.goto(`${BASE}/e/lpey/admin#/acces`); await page.waitForSelector('[data-reveal]'); await page.click('[data-reveal] >> nth=0'); await page.waitForTimeout(500);
  await shot(page, '11c_admin_coffre_affiche'); await page.click('[data-send] >> nth=1'); await page.waitForSelector('.modal .cred'); await shot(page, '19_admin_identifiants'); await page.click('.modal [data-close]');
  // matière : groupe et type indépendants, type créé à la volée
  await page.goto(`${BASE}/e/lpey/admin#/matieres`); await page.waitForSelector('[data-edit]');
  await page.click('[data-add]'); await page.fill('[name=name]', 'Électrotechnique'); await page.fill('[name=code]', 'ELEC');
  await page.selectOption('[name=group_id]', { index: 2 }); await page.selectOption('[name=type_id]', '__new__');
  await page.waitForFunction(() => document.querySelectorAll('.modal-root').length === 2);
  await page.fill('.modal-root:last-child [name=name]', 'Matière technique'); await shot(page, '07e_admin_type_a_la_volee');
  await page.click('.modal-root:last-child [data-submit]'); await page.waitForFunction(() => document.querySelectorAll('.modal-root').length === 1);
  await shot(page, '07b_admin_matiere_formulaire'); await page.click('.modal [data-close]');
  await page.goto(`${BASE}/e/lpey/admin#/calendrier`); await page.waitForSelector('[data-close="2"]'); await page.click('[data-close="2"]'); await page.waitForSelector('.modal'); await shot(page, '20_admin_cloture'); await page.click('.modal [data-close]');
  await page.click('[data-close-year]'); await page.waitForSelector('.modal'); await shot(page, '20b_admin_cloture_annee'); await page.click('.modal [data-close]');
  await page.goto(`${BASE}/e/lpey/admin#/edt?class=1`); await page.waitForTimeout(500); await page.click('td.cell.editable >> nth=3'); await page.waitForSelector('.modal'); await shot(page, '21_admin_edt_case'); await page.click('.modal [data-close]');
  // ---- Dossier administratif des enseignants (v3.0)
  await visit(page, '/e/lpey/admin', 'assiduite', '47_admin_assiduite', true);
  const yest = await page.evaluate(() => { const d = new Date(); do { d.setDate(d.getDate() - 1); } while ([0, 6].includes(d.getDay())); return d.toISOString().slice(0, 10); });
  await page.goto(`${BASE}/e/lpey/admin#/assiduite?tab=pointage&date=${yest}`); await page.waitForSelector('[data-save]'); await page.waitForTimeout(300);
  if (await page.locator('[data-st$=":absence"]').count()) {
    await page.locator('[data-st$=":absence"]').nth(2).click(); await page.locator('[data-st$=":retard"]').nth(4).click();
    await page.fill('[data-motif] >> nth=0', 'Absent sans préavis'); await page.click('[data-save]'); await page.waitForTimeout(500);
  }
  await shot(page, '48_admin_pointage');
  await visit(page, '/e/lpey/admin', 'assiduite?tab=absences', '49_admin_absences');
  await visit(page, '/e/lpey/admin', 'assiduite?tab=feries', '50_admin_jours_non_ouvres');
  await visit(page, '/e/lpey/admin', 'dossier?id=13', '51_admin_dossier_enseignant', true);
  await visit(page, '/e/lpey/admin', 'documents-rh', '52_admin_documents', true);
  await page.click('[data-new]'); await page.click('.doc-menu [data-t=demande_explication]'); await page.waitForSelector('.modal [data-teacher]');
  await page.selectOption('.modal [data-teacher]', '13'); await page.waitForSelector('.modal [data-fact]'); await page.click('.modal [data-fact] >> nth=0'); await page.click('.modal [data-motif] >> nth=7');
  await shot(page, '53_admin_nouveau_document');
  await page.click('.modal [data-submit]'); await page.waitForSelector('.modal [data-open]'); await shot(page, '54_admin_document_emis'); await page.click('.modal [data-close]');
  await page.goto(`${BASE}/e/lpey/admin#/documents-rh?type=demande_explication&status=clos`); await page.waitForSelector('[data-view]'); await page.click('[data-view] >> nth=0');
  await page.waitForSelector('.modal [data-act=pdf]'); await shot(page, '55_admin_document_fiche'); await page.click('.modal [data-close]');
  await page.goto(`${BASE}/e/lpey/admin#/documents-rh`); await page.waitForSelector('[data-new]'); await page.click('[data-new]'); await page.click('.doc-menu [data-t=presence]');
  await page.waitForSelector('.modal [name=period]'); await page.selectOption('.modal [data-teacher]', '3'); await page.waitForTimeout(500);
  await page.selectOption('.modal [name=period]', 'T1'); await page.waitForTimeout(700); await shot(page, '56_admin_presence_effective'); await page.click('.modal [data-close]');
  // ---- Messages aux parents (v3.2)
  await page.goto(`${BASE}/e/lpey/admin#/parents`); await page.waitForSelector('[data-preview] [data-send]'); await page.waitForTimeout(500); await shot(page, '61_admin_messages_parents', true);
  await page.selectOption('[data-modele]', 'reunion'); await page.waitForSelector('#pv_objet'); await page.fill('#pv_objet', 'bilan du premier trimestre et calendrier des examens');
  await page.click('[data-cls] >> nth=0'); await page.waitForTimeout(800); await shot(page, '62_admin_message_reunion');
  await page.click('[data-send]'); await page.waitForSelector('.modal [data-ok]'); await page.click('.modal [data-ok]'); await page.waitForTimeout(1500);
  await page.waitForSelector('.modal [data-csv]'); await shot(page, '63_admin_envoi_sms'); await page.click('.modal-root:last-child .modal-f [data-close]');
  await page.waitForTimeout(600);
  await page.selectOption('[data-modele]', 'bulletins'); await page.waitForTimeout(300); await page.click('[data-canal=manuel]'); await page.click('[data-cls] >> nth=1'); await page.waitForTimeout(800);
  await page.click('[data-send]'); await page.waitForSelector('.modal [data-ok]'); await page.click('.modal [data-ok]'); await page.waitForSelector('.modal [data-sent]'); await page.waitForTimeout(400);
  await shot(page, '64_admin_envoi_manuel'); await page.click('.modal-root:last-child .modal-f [data-close]'); await page.waitForTimeout(600);
  // ---- Chronogramme des dépôts (v3.3) : page, import d'un chronogramme PDF, modèles Word, dépôt
  const noToast = () => page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await page.goto(`${BASE}/e/lpey/admin#/chronogramme`); await page.waitForSelector('[data-depot]'); await noToast(); await shot(page, '66_admin_chronogramme');
  await page.setInputFiles('[data-import]', path.join(__dirname, '..', 'docs', 'exemples', 'Chronogramme_exemple_2026-2027.pdf'));
  await page.waitForSelector('.modal [data-save]'); await page.waitForTimeout(400); await noToast(); await shot(page, '67_admin_import_chronogramme');
  await page.click('.modal-f [data-close]'); await page.waitForTimeout(600);
  await page.click('[data-models]'); await page.waitForSelector('.mod-menu'); await noToast(); await shot(page, '68_admin_modeles_word'); await page.keyboard.press('Escape'); await page.mouse.click(5, 890);
  await page.goto(`${BASE}/e/lpey/admin#/chronogramme`); await page.waitForSelector('[data-depot]'); await page.click('[data-depot] >> nth=0'); await page.waitForSelector('.modal #dp_o');
  await page.fill('#dp_o', 'Remis au secrétariat de la DDES contre décharge'); await noToast(); await shot(page, '69_admin_depot'); await page.click('.modal-f [data-close]');
  // ---- Appellations « Situation » et « Titulaire » (v3.2), puis retour aux valeurs par défaut
  await page.goto(`${BASE}/e/lpey/admin#/etablissement?tab=fonctions`); await page.waitForSelector('[name=terme_sequence]');
  await page.selectOption('[name=terme_sequence]', 'Situation'); await page.selectOption('[name=terme_pp]', 'Titulaire'); await page.click('[data-save]'); await page.waitForTimeout(2500);
  await visit(page, '/e/lpey/admin', 'calendrier', '65_admin_mode_situation');
  await page.goto(`${BASE}/e/lpey/admin#/etablissement?tab=fonctions`); await page.waitForSelector('[name=terme_sequence]');
  await page.selectOption('[name=terme_sequence]', 'Séquence'); await page.selectOption('[name=terme_pp]', 'Professeur Principal'); await page.click('[data-save]'); await page.waitForTimeout(2500);
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, T)); await login(page, '/e/lpey/admin', 'admin', 'Admin@2026'); await page.waitForTimeout(600); await shot(page, '22_tablette_admin'); await ctx.close();
  // ---- Enseignant
  ({ ctx, page } = await ctxFor(browser, D)); await login(page, '/e/lpey/enseignant', 'mbargajp', 'Prof@2026');
  await page.waitForTimeout(600); await shot(page, '23_enseignant_accueil', true);
  await page.goto(`${BASE}/e/lpey/enseignant#/saisie?period=S2`); await page.waitForSelector('.note-input');
  const first = page.locator('.note-input:not([disabled])').first(); await first.click(); await first.fill('15,5'); await page.keyboard.press('Enter');
  await page.keyboard.type('8'); await page.keyboard.press('Enter'); await page.keyboard.type('a');
  await page.waitForSelector('[data-savebar]:not(.hidden)'); await shot(page, '24_enseignant_saisie');
  await page.waitForFunction(() => /Toutes les modifications sont enregistr/.test(document.querySelector('[data-savebar] .msg')?.innerText || ''), null, { timeout: 10000 });
  console.log('Enregistrement auto :', await page.locator('[data-savebar] .msg').innerText());
  await page.goto(`${BASE}/e/lpey/enseignant#/saisie?period=T1`); await page.waitForSelector('.tri-cols'); await shot(page, '24b_enseignant_saisie_trimestre');
  await visit(page, '/e/lpey/enseignant', 'progression', '25_enseignant_progression');
  await visit(page, '/e/lpey/enseignant', 'releves', '26_enseignant_releves');
  await visit(page, '/e/lpey/enseignant', 'edt', '27_enseignant_edt');
  await visit(page, '/e/lpey/enseignant', 'documents', '57_enseignant_documents', true);
  await page.click('[data-rep] >> nth=0'); await page.waitForSelector('#rep');
  await page.fill('#rep', "Monsieur le Proviseur,\nJ'ai l'honneur de vous informer que j'étais retenu, à la date indiquée, par la correction des épreuves du BEPC blanc régional, sur convocation de l'Inspection pédagogique (copie jointe). Je n'ai pas pu prévenir le conseil d'enseignement à temps et vous prie de bien vouloir m'en excuser.\nVeuillez agréer, Monsieur le Proviseur, l'expression de ma haute considération.");
  await shot(page, '58_enseignant_reponse'); await page.click('.modal [data-close]');
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, M)); await login(page, '/e/lpey/enseignant', 'mbargajp', 'Prof@2026'); await page.waitForTimeout(600); await shot(page, '28_mobile_enseignant_accueil');
  await page.goto(`${BASE}/e/lpey/enseignant#/saisie?period=S2`); await page.waitForSelector('.note-input'); await shot(page, '29_mobile_saisie_notes');
  await page.click('.bottombar [data-menu]'); await page.waitForTimeout(400); await shot(page, '30_mobile_menu');
  await page.goto(`${BASE}/e/lpey/enseignant#/documents`); await page.waitForSelector('[data-pdf]'); await page.waitForTimeout(400); await shot(page, '60_mobile_enseignant_documents');
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, M)); await login(page, '/e/lpey/admin', 'admin', 'Admin@2026');
  await page.goto(`${BASE}/e/lpey/admin#/assiduite?tab=pointage`); await page.waitForSelector('[data-save]'); await page.waitForTimeout(400); await shot(page, '59_mobile_pointage');
  await page.goto(`${BASE}/e/lpey/admin#/chronogramme`); await page.waitForSelector('[data-depot]'); await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())); await shot(page, '70_mobile_chronogramme'); await ctx.close();
  // ---- Responsable disciplinaire
  ({ ctx, page } = await ctxFor(browser, D)); await login(page, '/e/lpey/discipline', 'sg.nguemap', 'Disc@2026'); await page.waitForTimeout(600); await shot(page, '31_discipline_accueil');
  await page.goto(`${BASE}/e/lpey/discipline#/saisie?period=S2`); await page.waitForSelector('[data-k=abs_nj]');
  await page.locator('[data-k=abs_nj]').first().fill('3'); await page.waitForTimeout(300); await shot(page, '32_discipline_saisie');
  await page.click('[data-incident]'); await page.waitForSelector('.modal'); await page.selectOption('[name=student_id]', { index: 2 }); await page.selectOption('[name=type]', { index: 3 });
  await page.fill('[name=sanction]', 'Consigne 2 h'); await shot(page, '33_discipline_incident'); await page.click('[data-submit]'); await page.waitForTimeout(800);
  await page.goto(`${BASE}/e/lpey/discipline#/saisie?period=T1`); await page.waitForSelector('[data-k=abs_nj]'); await shot(page, '32b_discipline_recap_trimestre');
  await visit(page, '/e/lpey/discipline', 'incidents', '34_discipline_registre');
  await visit(page, '/e/lpey/discipline', 'fiches', '35_discipline_fiches');
  await ctx.close();
  ({ ctx, page } = await ctxFor(browser, M)); await login(page, '/e/lpey/discipline', 'sg.nguemap', 'Disc@2026');
  await page.goto(`${BASE}/e/lpey/discipline#/saisie?period=S2`); await page.waitForSelector('[data-k=abs_nj]'); await shot(page, '36_mobile_discipline');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await shot(page, '37_mobile_mode_sombre'); await ctx.close();
  ({ ctx, page } = await ctxFor(browser, M)); await page.goto(BASE + '/console'); await page.waitForSelector('#u'); await shot(page, '38_mobile_connexion_console');
  await login(page, '/console', 'AI721', 'Ai721@2026'); await page.waitForTimeout(700); await shot(page, '39_mobile_console'); await ctx.close();
  console.log('Erreurs :', errs.length ? errs : 'aucune');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
