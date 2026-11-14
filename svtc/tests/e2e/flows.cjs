/**
 * Tests de bout en bout des parcours principaux (administrateur, encadreur, parent) et des contrôles de sécurité.
 * Prérequis : application démarrée (BASE, défaut http://localhost:3100) avec le jeu de démonstration
 *   npx tsx --conditions=react-server scripts/seed-demo.ts --reset
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3100';
const ADMIN = { user: process.env.ADMIN_USER || 'admin', pass: process.env.ADMIN_PASS || 'Admin@2026' };
const FIX = path.join(__dirname, 'fixtures');

let passed = 0;
let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function toast(page, re, timeout = 20000) {
  const loc = page.locator('[data-sonner-toast]').filter({ hasText: re }).first();
  await loc.waitFor({ timeout });
  return loc.innerText();
}
async function login(page, portal, user, pass) {
  await page.goto(`${BASE}/${portal}/connexion`);
  await page.fill('#username', user);
  await page.fill('#password', pass);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/connexion'), { timeout: 30000 }), page.click('button[type=submit]')]);
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());

(async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const admin = await ctxA.newPage();
  admin.on('dialog', (d) => d.accept());
  let parentPassword = '';

  console.log('Administrateur');
  await step('connexion administrateur', async () => login(admin, 'admin', ADMIN.user, ADMIN.pass));
  await step('mise à jour de l’identité du centre', async () => {
    await admin.goto(`${BASE}/admin/parametres`);
    await admin.fill('input[name=directorName]', 'M. NDJOCK Paul');
    await admin.getByRole('button', { name: /Enregistrer l.identité/ }).click();
    await toast(admin, /Identité du centre enregistrée/);
  });
  await step('ajout d’une classe (Seconde TI)', async () => {
    await admin.goto(`${BASE}/admin/classes`);
    await admin.getByRole('button', { name: 'Ajouter une classe' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('input[name=code]').fill('STI');
    await dlg.locator('input[name=name]').fill('Seconde TI');
    await dlg.locator('input[name=monthlyFee]').fill('9000');
    await dlg.getByRole('button', { name: 'Ajouter la classe' }).click();
    await toast(admin, /Classe Seconde TI ajoutée/);
  });
  await step('inscription d’un élève avec création automatique du parent', async () => {
    await admin.goto(`${BASE}/admin/eleves`);
    await admin.getByRole('button', { name: 'Inscrire un élève' }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('input[name=lastName]').fill('TESTEUR');
    await dlg.locator('input[name=firstName]').fill('Junior');
    await dlg.locator('select[name=classId]').selectOption({ label: 'Seconde TI' });
    await dlg.locator('input[name=parentName]').fill('M. TESTEUR Albert');
    await dlg.locator('input[name=parentPhone]').fill('699 12 34 56');
    await dlg.getByRole('button', { name: "Inscrire l'élève" }).click();
    await toast(admin, /est inscrit/);
    await admin.goto(`${BASE}/admin/eleves?q=TESTEUR`);
    assert(await admin.getByText('TESTEUR Junior').count(), 'élève absent de la liste');
  });
  await step('génération du compte parent (identifiant = téléphone)', async () => {
    await admin.goto(`${BASE}/admin/parents?q=TESTEUR`);
    await admin.getByRole('button', { name: /Créer l.accès/ }).first().click();
    const overlay = admin.getByText('Identifiants générés');
    await overlay.waitFor();
    const txt = await admin.locator('.font-mono').filter({ hasText: '699123456' }).first().innerText();
    parentPassword = txt.split('·')[1].trim();
    assert(/^[A-Za-z]+[@#*!+]\d{4}$/.test(parentPassword), `mot de passe inattendu : ${parentPassword}`);
    const pdf = await admin.request.post(`${BASE}/api/pdf/acces`, { data: { creds: [{ name: 'M. TESTEUR Albert', role: 'PARENT', username: '699123456', password: parentPassword }] }, headers: { origin: BASE } });
    assert(pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === '%PDF', 'fiche d’accès PDF invalide');
    await admin.getByRole('button', { name: 'Fermer' }).first().click();
  });
  await step('encaissement d’un paiement et reçu PDF avec QR code', async () => {
    await admin.goto(`${BASE}/admin/paiements?nouveau=1`);
    const dlg = admin.locator('dialog[open]');
    await dlg.getByPlaceholder(/Tapez un nom/).fill('TESTEUR');
    await dlg.locator('select[name=studentId]').selectOption({ index: 1 });
    await dlg.locator('input[name=amount]').fill('14000');
    await dlg.getByRole('button', { name: 'Enregistrer le paiement' }).click();
    await toast(admin, /Paiement enregistré/);
    const href = await dlg.getByRole('link', { name: /Imprimer le reçu/ }).getAttribute('href');
    const r = await admin.request.get(BASE + href);
    assert(r.status() === 200 && (await r.body()).subarray(0, 4).toString() === '%PDF', 'reçu PDF invalide');
  });
  await step('ajout d’une séance du jour pour l’encadreur Paul NDJOCK', async () => {
    await admin.goto(`${BASE}/admin/seances`);
    await admin.getByRole('button', { name: /Séance ponctuelle/ }).click();
    const dlg = admin.locator('dialog[open]');
    await dlg.locator('input[name=date]').fill(today);
    await dlg.locator('input[name=startTime]').fill('00:05');
    await dlg.locator('input[name=endTime]').fill('23:55');
    await dlg.locator('select[name=classId]').selectOption({ label: 'Terminale' });
    await dlg.locator('select[name=subjectId]').selectOption({ label: 'Algorithmique et programmation' });
    await dlg.locator('select[name=tutorId]').selectOption({ label: 'Paul NDJOCK' });
    await dlg.locator('select[name=roomId]').selectOption({ label: 'Salle A' });
    await dlg.getByRole('button', { name: 'Ajouter' }).click();
    await toast(admin, /Séance ajoutée/);
  });
  await step('message aux parents d’une classe (personnalisé)', async () => {
    await admin.goto(`${BASE}/admin/messages`);
    await admin.getByText('Par classe', { exact: true }).click();
    await admin.locator('label.chip').filter({ hasText: 'Seconde TI' }).click();
    await admin.getByRole('button', { name: /Envoyer le message/ }).click();
    await admin.getByText(/Message déposé dans l’espace de \d+ destinataire/).first().waitFor({ timeout: 20000 });
    assert(await admin.getByRole('link', { name: /WhatsApp/ }).count() >= 1, 'lien WhatsApp absent');
  });
  await step('paiement des salaires d’octobre (au prorata des heures)', async () => {
    await admin.goto(`${BASE}/admin/salaires?mois=2026-10`);
    await admin.getByRole('button', { name: 'Tout payer' }).click();
    await toast(admin, /salaire\(s\) payé\(s\)/, 60000);
    await admin.goto(`${BASE}/admin/salaires?mois=2026-10`);
    assert((await admin.locator('.badge', { hasText: 'Payé' }).count()) >= 6, 'salaires non marqués payés');
    const pdf = await admin.request.get(`${BASE}/api/pdf/salaires?mois=2026-10`);
    assert(pdf.status() === 200, 'PDF salaires');
  });
  await step('règlement de la location des salles d’octobre', async () => {
    await admin.goto(`${BASE}/admin/location?mois=2026-10`);
    await admin.getByRole('button', { name: 'Marquer comme réglé' }).click();
    await toast(admin, /Location de octobre 2026 réglée/);
  });
  await step('approbation d’un document pédagogique', async () => {
    await admin.goto(`${BASE}/admin/documents?statut=SOUMIS`);
    await admin.getByRole('button', { name: /Examiner/ }).first().click();
    await admin.locator('dialog[open]').getByRole('button', { name: 'Enregistrer' }).click();
    await toast(admin, /Document approuvé/);
  });
  await step('état de caisse PDF', async () => {
    const r = await admin.request.get(`${BASE}/api/pdf/caisse?du=2026-10-01&au=${today}`);
    assert(r.status() === 200, 'état de caisse');
  });

  console.log('Encadreur');
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const tutor = await ctxB.newPage();
  tutor.on('dialog', (d) => d.accept());
  await step('connexion encadreur (smartphone)', async () => login(tutor, 'encadreur', 'paul.ndjock', 'Demo@2026'));
  await step('démarrage de la séance du jour', async () => {
    await tutor.goto(`${BASE}/encadreur`);
    await tutor.getByRole('button', { name: /Démarrer la séance/ }).first().click();
    await toast(tutor, /Séance démarrée/);
  });
  let seanceUrl = '';
  await step('appel des élèves', async () => {
    await tutor.goto(`${BASE}/encadreur`);
    await tutor.getByRole('link', { name: /Faire l.appel/ }).first().click();
    await tutor.waitForURL(/\/encadreur\/seances\/\d+/);
    seanceUrl = tutor.url().split('#')[0];
    await tutor.getByRole('button', { name: 'Tous présents' }).click();
    await tutor.locator('label[title=Absent]').nth(1).click();
    await tutor.getByRole('button', { name: /Enregistrer l.appel/ }).click();
    const t = await toast(tutor, /Appel enregistré/);
    assert(/1 absent/.test(t), t);
  });
  await step('fin de séance', async () => {
    await tutor.goto(seanceUrl);
    await tutor.getByRole('button', { name: /Terminer la séance/ }).click();
    await toast(tutor, /Séance terminée/);
  });
  await step('dépôt d’une fiche de TD (PDF) et refus d’un faux PDF', async () => {
    await tutor.goto(seanceUrl);
    const form = tutor.locator('form').filter({ has: tutor.locator('input[name=file]') });
    await form.locator('input[name=file]').setInputFiles(path.join(FIX, 'faux.pdf'));
    await form.getByRole('button', { name: /Déposer la fiche/ }).click();
    await toast(tutor, /document PDF valide/);
    await form.locator('input[name=file]').setInputFiles(path.join(FIX, 'fiche-td.pdf'));
    await form.getByRole('button', { name: /Déposer la fiche/ }).click();
    await toast(tutor, /Document déposé/);
  });
  await step('création d’une évaluation et saisie des notes', async () => {
    await tutor.goto(seanceUrl);
    await tutor.getByRole('link', { name: /Saisir les notes/ }).click();
    const dlg = tutor.locator('dialog[open]');
    await dlg.locator('input[name=title]').fill('Interrogation E2E');
    await dlg.getByRole('button', { name: /Créer et saisir/ }).click();
    await tutor.waitForURL(/\/encadreur\/notes\/\d+/);
    const inputs = tutor.locator('input[name^=g_]');
    await inputs.nth(0).fill('15,5');
    await inputs.nth(1).fill('abs');
    await inputs.nth(2).fill('12');
    await tutor.getByRole('button', { name: 'Enregistrer les notes' }).click();
    await toast(tutor, /3 note\(s\) enregistrée/);
    await inputs.nth(0).fill('25');
    await tutor.getByRole('button', { name: 'Enregistrer les notes' }).click();
    await toast(tutor, /Note invalide/);
  });
  await step('envoi de l’état de suivi au parent', async () => {
    await tutor.goto(`${BASE}/encadreur/eleves`);
    await tutor.locator('a[href^="/encadreur/eleves/"]').first().click();
    await tutor.getByRole('button', { name: /Envoyer au parent/ }).click();
    await toast(tutor, /État de suivi envoyé/);
  });
  await step('cloisonnement : un encadreur ne peut pas ouvrir l’administration', async () => {
    await tutor.goto(`${BASE}/admin/paiements`);
    assert(new URL(tutor.url()).pathname === '/encadreur', `redirigé vers ${tutor.url()}`);
    const r = await tutor.request.get(`${BASE}/api/pdf/salaires?mois=2026-10`);
    assert(r.status() === 403, `PDF salaires accessible (${r.status()})`);
    const e = await tutor.request.get(`${BASE}/api/export/sauvegarde`);
    assert(e.status() === 403, 'export accessible');
  });

  console.log('Parent');
  const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const parent = await ctxC.newPage();
  await step('connexion du nouveau parent avec le numéro de téléphone', async () => login(parent, 'parent', '699 12 34 56', parentPassword));
  await step('tableau de bord : enfant, solde, prochaine séance', async () => {
    await parent.goto(`${BASE}/parent`);
    await parent.getByText('Junior TESTEUR').waitFor();
  });
  await step('messages reçus et marquage comme lus', async () => {
    await parent.goto(`${BASE}/parent/messages`);
    await parent.getByText('Rappel de paiement').first().waitFor();
    await parent.getByRole('button', { name: /Tout marquer comme lu/ }).click();
    await toast(parent, /marqués comme lus/);
  });
  await step('état de suivi et reçu de son enfant (PDF)', async () => {
    await parent.goto(`${BASE}/parent/paiements`);
    const href = await parent.getByRole('link', { name: /Reçu/ }).first().getAttribute('href');
    const r = await parent.request.get(BASE + href);
    assert(r.status() === 200, 'reçu');
    const kid = await parent.getByRole('link', { name: /Paiements/ }).first().getAttribute('href');
    const kidId = new URL(BASE + kid).searchParams.get('enfant');
    const s = await parent.request.get(`${BASE}/api/pdf/suivi/${kidId}`);
    assert(s.status() === 200, `suivi ${s.status()}`);
  });
  await step('cloisonnement : un parent ne voit pas les documents d’un autre enfant', async () => {
    const r = await parent.request.get(`${BASE}/api/pdf/suivi/1`);
    assert(r.status() === 403, `suivi d’un autre élève accessible (${r.status()})`);
    const r2 = await parent.request.get(`${BASE}/api/pdf/recu/1`);
    assert(r2.status() === 403, 'reçu d’un autre élève accessible');
    await parent.goto(`${BASE}/encadreur`);
    assert(new URL(parent.url()).pathname === '/parent', 'espace encadreur accessible');
  });

  console.log('Sécurité');
  const ctxD = await browser.newContext();
  const intruder = await ctxD.newPage();
  await step('verrouillage du compte après 5 mots de passe erronés', async () => {
    let msg = '';
    for (let i = 0; i < 5; i++) {
      await intruder.goto(`${BASE}/encadreur/connexion`);
      await intruder.fill('#username', 'aline.mekongo');
      await intruder.fill('#password', `Mauvais${i}x`);
      await intruder.click('button[type=submit]');
      msg = await intruder.locator('#login-error').innerText({ timeout: 15000 });
    }
    assert(/verrouillé/.test(msg), msg);
    await intruder.fill('#password', 'Demo@2026');
    await intruder.click('button[type=submit]');
    await intruder.locator('#login-error', { hasText: 'temporairement verrouillé' }).waitFor({ timeout: 15000 }).catch(async (e) => {
      throw new Error(`${e.message.split('\n')[0]} — message affiché : ${await intruder.locator('#login-error').allInnerTexts()} — url ${intruder.url()}`);
    });
    assert(intruder.url().endsWith('/encadreur/connexion'), 'connexion possible malgré le verrouillage');
  });
  await step('mauvais espace : un parent refusé sur la connexion encadreur', async () => {
    await intruder.goto(`${BASE}/encadreur/connexion`);
    await intruder.fill('#username', '690000001');
    await intruder.fill('#password', 'Demo@2026');
    await intruder.click('button[type=submit]');
    assert(/n'appartient pas à cet espace/.test(await intruder.locator('#login-error').innerText({ timeout: 15000 })), 'message attendu');
  });
  await step('en-têtes de sécurité (CSP avec nonce, HSTS, anti-clickjacking)', async () => {
    const r = await intruder.request.get(`${BASE}/connexion`);
    const h = r.headers();
    assert(/script-src 'self' 'nonce-/.test(h['content-security-policy'] || ''), 'CSP absente');
    assert(h['x-content-type-options'] === 'nosniff', 'nosniff');
    assert(/max-age/.test(h['strict-transport-security'] || ''), 'HSTS');
    assert(!h['x-powered-by'], 'x-powered-by exposé');
  });
  await step('accès anonyme refusé aux fichiers et PDF', async () => {
    assert((await intruder.request.get(`${BASE}/api/pdf/caisse`)).status() === 401, 'caisse');
    assert((await intruder.request.get(`${BASE}/api/export/eleves`)).status() === 403, 'export');
  });

  await browser.close();
  console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
  process.exit(failed ? 1 : 0);
})();
