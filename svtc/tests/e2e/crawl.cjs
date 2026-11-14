// Parcourt toutes les pages de chaque espace, signale les erreurs HTTP/console et enregistre des captures.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = process.env.OUT || 'tests/e2e/output';
const ROLES = {
  admin: { login: '/admin/connexion', user: process.env.ADMIN_USER || 'admin', pass: process.env.ADMIN_PASS || 'Admin@2026', pages: (process.env.ADMIN_PAGES || '/admin,/admin/parametres,/admin/classes,/admin/matieres,/admin/salles,/admin/eleves,/admin/parents,/admin/encadreurs,/admin/attributions,/admin/planning,/admin/seances,/admin/presences,/admin/notes,/admin/documents,/admin/paiements,/admin/impayes,/admin/depenses,/admin/caisse,/admin/location,/admin/salaires,/admin/messages,/admin/comptes,/admin/journal,/admin/sauvegarde,/admin/compte').split(',') },
  encadreur: { login: '/encadreur/connexion', user: 'paul.ndjock', pass: 'Demo@2026', pages: (process.env.TUTOR_PAGES || '/encadreur').split(',') },
  parent: { login: '/parent/connexion', user: '690000001', pass: 'Demo@2026', pages: (process.env.PARENT_PAGES || '/parent').split(',') },
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let failures = 0;
  for (const [role, cfg] of Object.entries(ROLES)) {
    if (process.env.ONLY && process.env.ONLY !== role) continue;
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 300)));
    await page.goto(BASE + cfg.login);
    await page.fill('#username', cfg.user);
    await page.fill('#password', cfg.pass);
    await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/connexion'), { timeout: 30000 }).catch(() => {}), page.click('button[type=submit]')]);
    console.log(`[${role}] connecté → ${page.url()}`);
    if (page.url().includes('/connexion')) { console.log('✗ échec de connexion', await page.locator('#login-error').allInnerTexts()); failures++; }
    for (const p of cfg.pages) {
      errors.length = 0;
      const res = await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 });
      const status = res ? res.status() : 0;
      const bodyText = await page.locator('body').innerText();
      const crashed = /Application error|Unhandled Runtime Error|Une erreur inattendue|Internal Server Error/.test(bodyText) || (page.url().includes('/connexion') && !p.includes('/connexion'));
      const name = p.replace(/[/?=&]/g, '_').replace(/^_/, '') || 'root';
      await page.screenshot({ path: `${OUT}/${role}-${name}.png`, fullPage: false });
      const bad = status >= 400 || crashed || errors.length;
      if (bad) failures++;
      console.log(`${bad ? '✗' : '✓'} ${status} ${p}${errors.length ? '  ' + errors.join(' | ') : ''}${crashed ? '  [page en erreur]' : ''}`);
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
