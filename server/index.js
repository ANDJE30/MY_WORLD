// AI721 SchoolX CM — plateforme SaaS AI721 TECH STUFF (Express 5).
//   /                       site de présentation
//   /console                console du super administrateur (AI721)            API : /console/api
//   /e/<code>/admin         interface de connexion de l'administrateur          API : /e/<code>/api
//   /e/<code>/enseignant    interface de connexion des enseignants
//   /e/<code>/discipline    interface de connexion des responsables disciplinaires
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, getSettings, applyTerms } from './db.js';
import { withDb } from './context.js';
import { getSession, purgeSessions, rateLimit } from './security.js';
import { pdb, initPlatform, getTenantByCode, tenantHandle, subscriptionStatus, inPlatform, inTenant, TENANTS_DIR, COMPANY } from './platform.js';
import authRoutes, { COOKIE } from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import workRoutes from './routes/work.js';
import commonRoutes from './routes/common.js';
import pdfRoutes from './routes/pdfRoutes.js';
import staffRoutes from './routes/staff.js';
import parentsRoutes from './routes/parents.js';
import platformRoutes from './routes/platform.js';
import { HttpError } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

// Démarrage : super admin, migration éventuelle d'une installation 1.x, démonstration
initPlatform();
if (process.env.DEMO === '1' && !pdb.prepare('SELECT 1 FROM tenants').get()) {
  const { seedPlatformDemo } = await import('./seed.js');
  seedPlatformDemo();
  console.log('Mode démonstration : console AI721 / Ai721@2026 ; établissement de démonstration /e/lpey');
}

export const app = express();
app.disable('x-powered-by');
// Derrière un proxy (Render, Caddy, Nginx) : 1. Exposé directement sur Internet : TRUST_PROXY=0
const tp = process.env.TRUST_PROXY ?? '1';
app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp);

// En-têtes de sécurité (équivalent Helmet)
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; " +
      "font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Manifeste PWA propre à chaque interface (l'application installée s'ouvre sur la bonne page de connexion)
app.get('/manifest.webmanifest', (req, res) => {
  const p = String(req.query.p || '/');
  const m = /^\/(?:console|e\/([a-z0-9][a-z0-9-]{1,29})(?:\/(admin|enseignant|discipline))?)?\/?$/.exec(p);
  const start = m ? p : '/';
  const t = m?.[1] ? getTenantByCode(m[1]) : null;
  const role = { admin: 'Administration', enseignant: 'Enseignant', discipline: 'Discipline' }[m?.[2]];
  const name = p.startsWith('/console') ? `Console ${COMPANY}` : t ? `${t.sigle || t.name}${role ? ' — ' + role : ''}` : 'AI721 SchoolX CM';
  res.type('application/manifest+json').json({
    name: `${name} · AI721 SchoolX CM`, short_name: (t?.sigle || 'SchoolX').slice(0, 12), lang: 'fr', start_url: start, scope: '/', display: 'standalone',
    background_color: '#f3f6f5', theme_color: '#0b5d4b',
    icons: [{ src: '/img/icon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
  });
});

// Fichiers statiques (SPA)
app.use(express.static(PUBLIC, { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('index.html') || p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));

/* ---------------- Middlewares communs des API ---------------- */
// Le corps JSON est lu AVANT d'entrer dans le contexte de l'établissement (lecture asynchrone du flux)
const bodyParser = (req, res, next) => express.json({ limit: req.path === '/admin/restore' ? '50mb' : '2mb' })(req, res, next);
function sessionAndCsrf(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const raw = req.headers.cookie || '';
  const m = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  req.sessionToken = m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
  req.user = getSession(req.sessionToken);
  // Protection CSRF : en-tête personnalisé + vérification de l'origine pour toute requête d'écriture
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.get('X-Requested-With') !== 'EduGest') throw new HttpError(403, 'Requête refusée (CSRF).');
    const origin = req.get('origin');
    if (origin && new URL(origin).host !== req.get('host')) throw new HttpError(403, 'Origine refusée.');
  }
  if (req.user?.must_change && !req.path.startsWith('/auth/')) throw new HttpError(428, 'Vous devez changer votre mot de passe.');
  next();
}
// limite large : un établissement entier peut partager une même IP publique (NAT)
const apiRate = rateLimit({ windowMs: 60_000, max: 3000 });
const notFound = () => { throw new HttpError(404, 'Ressource introuvable'); };

/* ---------------- Console du super administrateur ---------------- */
const consoleApi = express.Router();
consoleApi.use(apiRate, sessionAndCsrf);
consoleApi.use('/auth', authRoutes);
consoleApi.use('/', platformRoutes);
consoleApi.use(notFound);
app.use('/console/api', bodyParser, (req, _res, next) => { req.cookiePath = '/console'; inPlatform(next); }, consoleApi);

/* ---------------- API d'un établissement ---------------- */
const tenantApi = express.Router();
tenantApi.use(apiRate, sessionAndCsrf, (req, _res, next) => {
  // Contrôle de l'abonnement (1er septembre → 31 août) et de la suspension
  if (req.path !== '/auth/public' && req.path !== '/auth/logout') {
    const st = inPlatform(() => subscriptionStatus(req.tenant));
    if (!st.valid) throw new HttpError(402, st.message);
  }
  next();
});
tenantApi.use('/auth', authRoutes);
tenantApi.use('/admin/parents', parentsRoutes);
tenantApi.use('/admin', adminRoutes);
tenantApi.use('/pdf', pdfRoutes);
tenantApi.use('/', commonRoutes);
tenantApi.use('/', workRoutes);
tenantApi.use('/', staffRoutes);
tenantApi.use(notFound);
app.use('/e/:code/api', (req, _res, next) => {
  const t = getTenantByCode(req.params.code);
  if (!t) throw new HttpError(404, 'Établissement introuvable. Vérifiez le lien fourni par votre établissement.');
  req.tenant = t; req.cookiePath = `/e/${t.code}/`; req.portalBase = `/e/${t.code}`;
  next();
}, bodyParser, (req, _res, next) => withDb(tenantHandle(req.tenant), next, { tenant: req.tenant }), tenantApi);

app.use('/api', notFound); // ancienne API mono-établissement retirée

// SPA : toutes les autres pages (/, /console, /e/<code>/…)
app.use((req, res) => { if (req.method !== 'GET') throw new HttpError(404, 'Ressource introuvable'); res.sendFile(path.join(PUBLIC, 'index.html')); });

// Gestion centralisée des erreurs (aucune fuite d'information interne)
app.use((err, req, res, _next) => {
  let status = err.status || err.statusCode || 500, message = err.message;
  if (err.type === 'entity.parse.failed') { status = 400; message = 'JSON invalide'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Données trop volumineuses'; }
  else if (/UNIQUE constraint failed/.test(err.message || '')) {
    status = 409;
    const f = /UNIQUE constraint failed: \w+\.(\w+)/.exec(err.message)?.[1];
    message = { username: 'Cet identifiant existe déjà.', matricule: 'Ce matricule existe déjà.', name: 'Ce nom existe déjà.', code: 'Ce code est déjà utilisé.',
      annee: 'Un abonnement existe déjà pour cette année scolaire.' }[f] || 'Cet élément existe déjà.';
  } else if (/FOREIGN KEY constraint failed/.test(err.message || '')) { status = 400; message = 'Référence invalide (élément lié inexistant).'; }
  else if (/CHECK constraint failed/.test(err.message || '')) { status = 400; message = 'Valeur hors limites.'; }
  if (status >= 500) {
    const ref = crypto.randomBytes(4).toString('hex');
    console.error(`[${ref}]`, err);
    message = `Erreur interne (réf. ${ref}). Réessayez ou contactez l'administrateur.`;
  }
  if (res.headersSent) return res.end();
  // messages formulés avec les appellations de l'établissement (« situation », « titulaire »)
  let problems = err.problems;
  if (req.tenant && status < 500) {
    try { const s = inTenant(req.tenant, getSettings); message = applyTerms(message, s); problems = problems?.map((p) => applyTerms(p, s)); } catch { /* message d'origine */ }
  }
  res.status(status).json({ error: message, ...(problems ? { problems } : {}), ...(err.redirect ? { redirect: err.redirect } : {}) });
});

/* ---------------- Tâches de fond ---------------- */
const allTenants = () => pdb.prepare('SELECT * FROM tenants').all();
setInterval(() => { inPlatform(purgeSessions); for (const t of allTenants()) inTenant(t, purgeSessions); }, 3600_000).unref();

// Sauvegardes automatiques (instantané cohérent via VACUUM INTO) de chaque base, 14 jours conservés
function snapshot(dir, prefix) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${prefix}-${new Date().toISOString().slice(0, 10)}.db`);
  if (!fs.existsSync(file)) db.prepare('VACUUM INTO ?').run(file);
  const re = new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}\\.db$`);
  const all = fs.readdirSync(dir).filter((f) => re.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.unlinkSync(path.join(dir, old));
  return file;
}
export function autoBackup() {
  if (process.env.AUTO_BACKUP === '0') return;
  try { inPlatform(() => snapshot(path.join(path.dirname(TENANTS_DIR), 'backups'), 'platform')); } catch (e) { console.error('Sauvegarde plateforme impossible :', e.message); }
  for (const t of allTenants()) {
    try { inTenant(t, () => snapshot(path.join(TENANTS_DIR, t.code, 'backups'), 'edugest')); } catch (e) { console.error(`Sauvegarde ${t.code} impossible :`, e.message); }
  }
}
autoBackup();
setInterval(autoBackup, 6 * 3600_000).unref();

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  app.listen(PORT, () => console.log(`AI721 SchoolX CM (${COMPANY}) démarré sur http://localhost:${PORT}`));
}
