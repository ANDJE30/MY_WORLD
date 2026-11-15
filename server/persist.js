// Sauvegarde externe automatique de toute la plateforme (console AI721 + tous les établissements) vers un stockage
// compatible S3 : Backblaze B2, Cloudflare R2, Supabase Storage, MinIO, Amazon S3…
//
// Pourquoi : sur un hébergement au disque éphémère (Render gratuit), le dossier des données est effacé à chaque mise à jour
// et à chaque mise en veille. La plateforme y dépose donc, après chaque modification, un instantané chiffré de toutes ses
// données, et le restaure au démarrage lorsque le disque est vide : la base est conservée d'une mise à jour à l'autre.
//
// Sans dépendance : signature AWS SigV4 (node:crypto), copie cohérente des bases (VACUUM INTO), archive maison, gzip,
// chiffrement AES-256-GCM avec une clé dérivée de VAULT_KEY (sans cette clé, les instantanés sont illisibles).
// Configuration : S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (+ S3_REGION, S3_PREFIX facultatifs), VAULT_KEY.
// Ce module n'importe aucun autre module de l'application : db.js l'appelle avant d'ouvrir la moindre base.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';

const MAGIC = Buffer.from('SXB1');          // fichier chiffré
const ARCHIVE = Buffer.from('SXSNAP1\n');   // archive en clair (avant gzip)
const DELAY_MS = Number(process.env.S3_DELAY_MS) || 60_000;   // au plus une minute de modifications non sauvegardées
const RETRY_MS = 5 * 60_000;
const KEEP_LAST = 48, KEEP_DAYS = 14;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Configuration ---------------- */
export function s3Config(e = process.env) {
  const raw = String(e.S3_ENDPOINT || '').trim().replace(/\/+$/, '');
  if (!raw || !e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) return null;
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  const h = url.hostname;
  const region = String(e.S3_REGION || '').trim() || /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(h)?.[1]
    || (/\.r2\.cloudflarestorage\.com$/.test(h) ? 'auto' : /^s3[.-]([a-z0-9-]+)\.amazonaws\.com$/.exec(h)?.[1]) || 'us-east-1';
  return { url, host: url.host, basePath: url.pathname.replace(/\/+$/, ''), bucket: String(e.S3_BUCKET).trim(), region,
    accessKey: String(e.S3_ACCESS_KEY_ID).trim(), secret: String(e.S3_SECRET_ACCESS_KEY).trim(),
    prefix: String(e.S3_PREFIX || 'ai721-schoolx').trim().replace(/^\/+|\/+$/g, '') || 'ai721-schoolx' };
}
/** Clé de chiffrement des instantanés, dérivée de VAULT_KEY (jamais du fichier vault.key, effacé avec le disque). */
export function snapshotKey(e = process.env) {
  const v = String(e.VAULT_KEY || '').trim();
  if (!v) return null;
  let k = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, 'hex') : Buffer.from(v, 'base64');
  if (k.length !== 32) k = crypto.createHash('sha256').update(v).digest();
  return crypto.createHmac('sha256', k).update('schoolx:sauvegarde-externe:v1').digest();
}

/* ---------------- Signature AWS SigV4 ---------------- */
const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const uriEncode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export const canonicalPath = (p) => p.split('/').map(uriEncode).join('/');
export const canonicalQuery = (q) => Object.keys(q).sort().map((k) => `${uriEncode(k)}=${uriEncode(String(q[k]))}`).join('&');
/** En-têtes signés (dont Authorization) d'une requête S3. `path` est le chemin non encodé. */
export function signV4({ method, host, path: p, query = {}, headers = {}, payloadHash, region, accessKey, secret, date = new Date(), service = 's3' }) {
  const amzDate = date.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const h = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  const names = Object.keys(h).sort();
  const canonical = [method, canonicalPath(p), canonicalQuery(query), names.map((n) => `${n}:${h[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const signature = crypto.createHmac('sha256', hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), service), 'aws4_request')).update(toSign).digest('hex');
  return { headers: { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope},SignedHeaders=${names.join(';')},Signature=${signature}` }, signature };
}
async function s3(cfg, method, key, { body, query = {} } = {}) {
  const p = `${cfg.basePath}/${cfg.bucket}${key ? `/${key}` : ''}`;
  const payload = body || Buffer.alloc(0);
  const { headers } = signV4({ method, host: cfg.host, path: p, query, headers: body ? { 'content-type': 'application/octet-stream' } : {},
    payloadHash: sha256hex(payload), region: cfg.region, accessKey: cfg.accessKey, secret: cfg.secret });
  delete headers.host; // posé par fetch d'après l'adresse (identique)
  const qs = canonicalQuery(query);
  const res = await fetch(`${cfg.url.protocol}//${cfg.host}${canonicalPath(p)}${qs ? `?${qs}` : ''}`, { method, headers, body: body || undefined, signal: AbortSignal.timeout(120_000) });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) {
    const code = /<Code>([^<]+)<\/Code>/.exec(buf.toString())?.[1] || '';
    throw new Error(`stockage S3 : ${method} ${res.status}${code ? ` ${code}` : ''}`);
  }
  return buf;
}
async function listSnapshots(cfg) {
  const keys = []; let token;
  do {
    const xml = (await s3(cfg, 'GET', '', { query: { 'list-type': 2, prefix: `${cfg.prefix}/snapshots/`, ...(token ? { 'continuation-token': token } : {}) } }))?.toString() || '';
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, '&'));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] : null;
  } while (token);
  return keys.filter((k) => k.endsWith('.sxb')).sort();
}

/* ---------------- Instantané : archive, compression, chiffrement ---------------- */
// Exclus : clé du coffre (jamais à côté des données), journaux SQLite (copie cohérente par VACUUM INTO), sauvegardes locales tournantes.
const excluded = (rel) => rel === 'vault.key' || /(^|\/)backups(\/|$)/.test(rel) || /-(wal|shm|journal)$/.test(rel) || /\.(tmp|part)$/.test(rel);
function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name), rel = path.relative(base, abs).split(path.sep).join('/');
    if (excluded(rel)) continue;
    if (e.isDirectory()) walk(abs, base, out); else if (e.isFile()) out.push({ abs, rel });
  }
  return out;
}
/** Copie cohérente d'une base SQLite ouverte (y compris son journal WAL), lue par une connexion séparée. */
function dbCopy(abs) {
  const tmp = path.join(os.tmpdir(), `sx-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);
  const conn = new DatabaseSync(abs);
  try { conn.prepare('VACUUM INTO ?').run(tmp); return fs.readFileSync(tmp); } finally { conn.close(); fs.rmSync(tmp, { force: true }); }
}
export function buildSnapshot(dataDir, key) {
  const files = walk(dataDir).map(({ abs, rel }) => {
    const data = rel.endsWith('.db') ? dbCopy(abs) : fs.readFileSync(abs);
    return { p: rel, n: data.length, sha: sha256hex(data), data };
  });
  const manifest = Buffer.from(JSON.stringify({ version: 1, app: 'AI721 SchoolX CM', created: new Date().toISOString(), files: files.map(({ p, n, sha }) => ({ p, n, sha })) }));
  const len = Buffer.alloc(4); len.writeUInt32BE(manifest.length);
  const gz = zlib.gzipSync(Buffer.concat([ARCHIVE, len, manifest, ...files.map((f) => f.data)]), { level: 6 });
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(gz), c.final()]);
  return { blob: Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]), files: files.length, bytes: files.reduce((a, f) => a + f.n, 0) };
}
/** Déchiffre et vérifie un instantané ; renvoie ses fichiers. Lève une erreur explicite si la clé ne correspond pas. */
export function openSnapshot(blob, key) {
  if (blob.length < 33 || !blob.subarray(0, 4).equals(MAGIC)) throw new Error('fichier qui n\'est pas une sauvegarde AI721 SchoolX CM');
  let gz;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(4, 16)); d.setAuthTag(blob.subarray(16, 32));
    gz = Buffer.concat([d.update(blob.subarray(32)), d.final()]);
  } catch { throw new Error('sauvegarde illisible : VAULT_KEY ne correspond pas à la clé utilisée pour la chiffrer (ou fichier endommagé)'); }
  const raw = zlib.gunzipSync(gz);
  if (!raw.subarray(0, 8).equals(ARCHIVE)) throw new Error('archive de sauvegarde invalide');
  const mlen = raw.readUInt32BE(8), manifest = JSON.parse(raw.subarray(12, 12 + mlen).toString());
  let off = 12 + mlen;
  return manifest.files.map((f) => {
    const data = raw.subarray(off, off + f.n); off += f.n;
    if (data.length !== f.n || sha256hex(data) !== f.sha) throw new Error(`sauvegarde endommagée (${f.p})`);
    if (f.p.split('/').some((s) => s === '..' || s === '') || path.isAbsolute(f.p)) throw new Error(`chemin refusé dans la sauvegarde (${f.p})`);
    return { p: f.p, data };
  });
}

/* ---------------- État, restauration au démarrage, envois ---------------- */
export const state = { configured: false, enabled: false, status: 'inactive', error: null, provider: null, bucket: null, region: null, prefix: null,
  keyMissing: false, restored: null, last: null, pending: false };
let cfg = null, key = null, dataDir = null, dirty = false, timer = null, running = null, lastPrune = 0;

async function withRetry(fn, tries = 4) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries - 1) throw e; await sleep(1000 * 2 ** i); }
  }
}
/**
 * Appelée par db.js avant l'ouverture des bases. Disque vide + instantané distant : restauration (le plus récent lisible).
 * Données locales présentes : elles font foi (serveur à disque durable). Instantané distant illisible : arrêt, pour ne
 * jamais remplacer de bonnes sauvegardes par une plateforme vide.
 */
export async function restoreAtBoot(dir, e = process.env) {
  dataDir = dir; cfg = s3Config(e);
  if (!cfg) return state;
  Object.assign(state, { configured: true, provider: cfg.host, bucket: cfg.bucket, region: cfg.region, prefix: cfg.prefix });
  key = snapshotKey(e);
  if (!key) {
    Object.assign(state, { keyMissing: true, status: 'erreur', error: 'VAULT_KEY absente : la sauvegarde externe est désactivée (sans clé stable, les sauvegardes seraient illisibles après un redémarrage).' });
    console.error(`[sauvegarde externe] ${state.error}`);
    return state;
  }
  if (fs.existsSync(path.join(dir, 'platform.db'))) { Object.assign(state, { enabled: true, status: 'active', restored: { from: 'disque local' } }); return state; }
  const keys = await withRetry(() => listSnapshots(cfg)).catch((err) => {
    console.error(`[sauvegarde externe] stockage injoignable au démarrage (${err.message}) : arrêt pour ne pas démarrer sans les données.`);
    throw err;
  });
  if (!keys.length) {
    Object.assign(state, { enabled: true, status: 'active', restored: { from: 'aucune (première mise en service)' } });
    dirty = true; // instantané initial dès le démarrage
    return state;
  }
  let lastErr;
  for (const k of keys.slice(-3).reverse()) {
    try {
      const blob = await withRetry(() => s3(cfg, 'GET', k));
      if (!blob) throw new Error('instantané introuvable');
      const files = openSnapshot(blob, key);
      for (const f of files) { const abs = path.join(dir, ...f.p.split('/')); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, f.data); }
      Object.assign(state, { enabled: true, status: 'active', restored: { from: k.split('/').pop(), at: new Date().toISOString(), files: files.length } });
      console.log(`[sauvegarde externe] données restaurées depuis ${k} (${files.length} fichiers).`);
      return state;
    } catch (err) { lastErr = err; console.error(`[sauvegarde externe] ${k} : ${err.message}`); }
  }
  console.error('[sauvegarde externe] aucune sauvegarde distante lisible : démarrage refusé pour protéger les sauvegardes existantes. '
    + 'Vérifiez VAULT_KEY (elle doit être celle utilisée à la création des sauvegardes).');
  throw lastErr;
}

/** À appeler après chaque modification réussie : un instantané part au plus DELAY_MS plus tard. */
export function markDirty() {
  if (!state.enabled) return;
  dirty = true; state.pending = true;
  if (!timer && !running) timer = setTimeout(() => { timer = null; snapshotNow('auto').catch(() => {}); }, DELAY_MS);
}
async function prune() {
  if (Date.now() - lastPrune < 3600_000) return;
  lastPrune = Date.now();
  const keys = await listSnapshots(cfg);
  const keep = new Set(keys.slice(-KEEP_LAST));
  const byDay = new Map(); for (const k of keys) byDay.set(k.split('/').pop().slice(0, 10), k);
  [...byDay.values()].slice(-KEEP_DAYS).forEach((k) => keep.add(k));
  for (const k of keys) if (!keep.has(k)) await s3(cfg, 'DELETE', k).catch(() => {});
}
/** Instantané immédiat (attend la fin d'un envoi en cours, puis renvoie si de nouvelles modifications sont arrivées). */
export async function snapshotNow(reason = 'manuel') {
  if (!state.enabled) throw new Error(state.error || 'Sauvegarde externe non configurée.');
  if (running) { await running.catch(() => {}); if (!dirty) return state.last; }
  if (timer) { clearTimeout(timer); timer = null; }
  dirty = false; state.pending = false;
  running = (async () => {
    const t0 = Date.now();
    const { blob, files, bytes } = buildSnapshot(dataDir, key);
    const k = `${cfg.prefix}/snapshots/${new Date().toISOString().replace(/[:.]/g, '-')}.sxb`;
    await withRetry(() => s3(cfg, 'PUT', k, { body: blob }), 3);
    state.last = { key: k.split('/').pop(), at: new Date().toISOString(), size: blob.length, files, bytes, ms: Date.now() - t0, reason };
    Object.assign(state, { status: 'active', error: null });
    await prune().catch(() => {});
    return state.last;
  })();
  try { return await running; } catch (err) {
    dirty = true; state.pending = true; Object.assign(state, { status: 'erreur', error: err.message });
    console.error(`[sauvegarde externe] envoi impossible : ${err.message}`);
    if (!timer) timer = setTimeout(() => { timer = null; snapshotNow('reprise').catch(() => {}); }, RETRY_MS);
    throw err;
  } finally { running = null; if (dirty && !timer && state.status === 'active') timer = setTimeout(() => { timer = null; snapshotNow('auto').catch(() => {}); }, DELAY_MS); }
}
/** Premier instantané d'un stockage vide, une fois la plateforme initialisée. */
export function afterBoot() { if (state.enabled && dirty) snapshotNow('mise en service').catch(() => {}); }
/** Arrêt (mise à jour, mise en veille) : dernier instantané avant de quitter, 25 s au plus. */
export async function flushBeforeExit() {
  if (!state.enabled || (!dirty && !running)) return;
  await Promise.race([(async () => { if (running) await running.catch(() => {}); if (dirty) await snapshotNow('arrêt').catch(() => {}); })(), sleep(25_000)]);
}
