// Stockage compatible S3 minimal, en mémoire, pour les tests : PUT, GET, DELETE, ListObjectsV2 (style chemin),
// avec vérification de la signature SigV4 de chaque requête (même secret, recalculée côté serveur).
import http from 'node:http';
import crypto from 'node:crypto';
import { signV4 } from '../../server/persist.js';

export function startS3Mock({ bucket = 'sauvegardes', accessKey = 'TESTKEY', secret = 'TESTSECRET', region = 'us-east-1' } = {}) {
  const objects = new Map(); const log = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://x');
    const query = Object.fromEntries(url.searchParams);
    const amz = req.headers['x-amz-date'];
    const date = amz ? new Date(`${amz.slice(0, 4)}-${amz.slice(4, 6)}-${amz.slice(6, 8)}T${amz.slice(9, 11)}:${amz.slice(11, 13)}:${amz.slice(13, 15)}Z`) : new Date(0);
    const extra = req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {};
    const want = signV4({ method: req.method, host: req.headers.host, path: decodeURIComponent(url.pathname), query, headers: extra,
      payloadHash: crypto.createHash('sha256').update(body).digest('hex'), region, accessKey, secret, date }).headers.authorization;
    log.push({ method: req.method, path: url.pathname, query, ok: req.headers.authorization === want });
    if (req.headers.authorization !== want) { res.writeHead(403); return res.end('<Error><Code>SignatureDoesNotMatch</Code></Error>'); }
    const [, b, ...rest] = decodeURIComponent(url.pathname).split('/'); const key = rest.join('/');
    if (b !== bucket) { res.writeHead(404); return res.end('<Error><Code>NoSuchBucket</Code></Error>'); }
    if (req.method === 'GET' && !key) {
      const keys = [...objects.keys()].filter((k) => k.startsWith(query.prefix || '')).sort();
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end(`<?xml version="1.0"?><ListBucketResult>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`);
    }
    if (req.method === 'PUT') { objects.set(key, body); res.writeHead(200); return res.end(); }
    if (req.method === 'GET') { if (!objects.has(key)) { res.writeHead(404); return res.end('<Error><Code>NoSuchKey</Code></Error>'); } res.writeHead(200); return res.end(objects.get(key)); }
    if (req.method === 'DELETE') { objects.delete(key); res.writeHead(204); return res.end(); }
    res.writeHead(405); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    objects, log, endpoint: `http://127.0.0.1:${server.address().port}`, env: { S3_ENDPOINT: `http://127.0.0.1:${server.address().port}`, S3_BUCKET: bucket, S3_ACCESS_KEY_ID: accessKey, S3_SECRET_ACCESS_KEY: secret, S3_REGION: region },
    close: () => new Promise((r) => server.close(r))
  })));
}
