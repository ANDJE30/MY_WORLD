// EduGest CM — serveur HTTP (Express 5).
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { getSession, purgeSessions, rateLimit, hashPassword, genPassword } from './security.js';
import authRoutes, { COOKIE } from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import workRoutes from './routes/work.js';
import commonRoutes from './routes/common.js';
import pdfRoutes from './routes/pdfRoutes.js';
import { HttpError } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// Mode démonstration : base pré-remplie (établissement fictif) si elle est vide
if (process.env.DEMO === '1' && !db.prepare('SELECT 1 FROM classes').get()) {
  const { seedDemo } = await import('./seed.js');
  seedDemo();
  console.log('Mode démonstration : base initialisée (admin / Admin@2026).');
}

// Premier démarrage : création du compte administrateur
if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
  const pw = process.env.ADMIN_PASSWORD || genPassword();
  db.prepare("INSERT INTO users(role, username, pass_hash, full_name, must_change) VALUES('admin', ?, ?, 'Administrateur', ?)")
    .run(process.env.ADMIN_USERNAME || 'admin', hashPassword(pw), process.env.ADMIN_PASSWORD ? 0 : 1);
  console.log('\n=============================================================');
  console.log(' Compte administrateur créé');
  console.log(`   Identifiant : ${process.env.ADMIN_USERNAME || 'admin'}`);
  console.log(`   Mot de passe : ${process.env.ADMIN_PASSWORD ? '(défini par ADMIN_PASSWORD)' : pw}`);
  console.log('=============================================================\n');
}

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : 1);

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

// Fichiers statiques (SPA)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('index.html') || p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); }
}));

// API
const api = express.Router();
api.use(rateLimit({ windowMs: 60_000, max: 600 }));
api.use((req, _res, next) => { if (req.path === '/admin/restore') return next(); express.json({ limit: '2mb' })(req, _res, next); });
api.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // Session depuis le cookie HttpOnly
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
  // Changement de mot de passe obligatoire avant tout accès
  if (req.user?.must_change && !req.path.startsWith('/auth/')) throw new HttpError(428, 'Vous devez changer votre mot de passe.');
  next();
});
api.use('/auth', authRoutes);
api.use('/admin', adminRoutes);
api.use('/pdf', pdfRoutes);
api.use('/', commonRoutes);
api.use('/', workRoutes);
api.use((_req, _res) => { throw new HttpError(404, 'Ressource introuvable'); });
app.use('/api', api);

// SPA fallback
app.use((req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// Gestion centralisée des erreurs (aucune fuite d'information interne)
app.use((err, req, res, _next) => {
  let status = err.status || err.statusCode || 500, message = err.message;
  if (err.type === 'entity.parse.failed') { status = 400; message = 'JSON invalide'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Données trop volumineuses'; }
  else if (/UNIQUE constraint failed/.test(err.message || '')) {
    status = 409;
    const f = /UNIQUE constraint failed: \w+\.(\w+)/.exec(err.message)?.[1];
    message = { username: 'Cet identifiant existe déjà.', matricule: 'Ce matricule existe déjà.', name: 'Ce nom existe déjà.' }[f] || 'Cet élément existe déjà.';
  } else if (/FOREIGN KEY constraint failed/.test(err.message || '')) { status = 400; message = 'Référence invalide (élément lié inexistant).'; }
  else if (/CHECK constraint failed/.test(err.message || '')) { status = 400; message = 'Valeur hors limites.'; }
  if (status >= 500) {
    const ref = crypto.randomBytes(4).toString('hex');
    console.error(`[${ref}]`, err);
    message = `Erreur interne (réf. ${ref}). Réessayez ou contactez l'administrateur.`;
  }
  if (res.headersSent) return res.end();
  res.status(status).json({ error: message, ...(err.problems ? { problems: err.problems } : {}) });
});

setInterval(purgeSessions, 3600_000).unref();

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  app.listen(PORT, () => console.log(`EduGest CM démarré sur http://localhost:${PORT}`));
}
