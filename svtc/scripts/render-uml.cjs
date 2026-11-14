// Rend les diagrammes Mermaid (docs/uml/*.mmd) en PNG haute définition aux couleurs SVTC.
// Usage : node scripts/render-uml.cjs <chemin/vers/mermaid.min.js>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'docs', 'uml');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 2400, height: 1600 } });
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="out" style="display:inline-block;padding:18px;background:#fff"></div></body></html>');
  await page.addScriptTag({ path: process.argv[2] });
  await page.evaluate(() => mermaid.initialize({
    startOnLoad: false, theme: 'base', securityLevel: 'strict',
    themeVariables: {
      primaryColor: '#eef3ff', primaryBorderColor: '#1d42ad', primaryTextColor: '#0a163a', lineColor: '#475569', secondaryColor: '#fff3c4',
      tertiaryColor: '#f8fafc', fontFamily: 'Poppins, Helvetica, Arial, sans-serif', fontSize: '15px', actorBkg: '#0a163a', actorTextColor: '#ffffff',
      actorBorder: '#f2c318', noteBkgColor: '#fff3c4', noteBorderColor: '#dba90b', signalColor: '#1a1a2e', labelBoxBkgColor: '#eef3ff',
      clusterBkg: '#f8faff', clusterBorder: '#8eaaff', edgeLabelBackground: '#ffffff',
    },
    flowchart: { curve: 'basis', htmlLabels: true, padding: 14 }, sequence: { mirrorActors: false, actorMargin: 60 }, er: { layoutDirection: 'TB' },
  }));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mmd')).sort()) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await page.evaluate(async (c) => {
        const { svg } = await mermaid.render('d' + Math.random().toString(36).slice(2), c);
        const o = document.getElementById('out');
        o.innerHTML = svg;
        const el = o.querySelector('svg');
        const vb = el.viewBox.baseVal;
        el.style.maxWidth = 'none';
        el.setAttribute('width', vb.width);
        el.setAttribute('height', vb.height);
      }, code);
      const el = await page.$('#out');
      await el.screenshot({ path: path.join(dir, f.replace('.mmd', '.png')) });
      const box = await el.boundingBox();
      console.log('OK', f, Math.round(box.width) + 'x' + Math.round(box.height));
    } catch (e) {
      console.log('ERREUR', f, e.message.split('\n')[0]);
    }
  }
  await browser.close();
})();
