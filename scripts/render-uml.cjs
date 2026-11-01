// Rend les diagrammes Mermaid (docs/uml/*.mmd) en PNG haute définition.
// Usage : node scripts/render-uml.cjs <chemin/vers/mermaid.min.js>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'docs', 'uml');
const mermaidJs = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 2400, height: 1600 } });
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="out" style="display:inline-block;padding:16px;background:#fff"></div></body></html>');
  await page.addScriptTag({ path: mermaidJs });
  await page.evaluate(() => mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'strict',
    themeVariables: { primaryColor: '#e8f5f0', primaryBorderColor: '#0b5d4b', primaryTextColor: '#0b2e25', lineColor: '#4b5a55', secondaryColor: '#fbf1db',
      tertiaryColor: '#f8faf9', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '15px', actorBkg: '#e8f5f0', actorBorder: '#0b5d4b', noteBkgColor: '#fbf1db' },
    flowchart: { curve: 'basis', htmlLabels: true }, sequence: { mirrorActors: false }, er: { layoutDirection: 'TB' } }));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mmd')).sort()) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await page.evaluate(async (c) => { const { svg } = await mermaid.render('d' + Math.random().toString(36).slice(2), c); const o = document.getElementById('out'); o.innerHTML = svg;
        const el = o.querySelector('svg'); const vb = el.viewBox.baseVal;
        el.style.maxWidth = 'none'; el.setAttribute('width', vb.width); el.setAttribute('height', vb.height); }, code);
      const el = await page.$('#out');
      await el.screenshot({ path: path.join(dir, f.replace('.mmd', '.png')) });
      const box = await el.boundingBox();
      console.log('OK', f, Math.round(box.width) + 'x' + Math.round(box.height));
    } catch (e) { console.log('ERREUR', f, e.message.split('\n')[0]); }
  }
  await browser.close();
})();
