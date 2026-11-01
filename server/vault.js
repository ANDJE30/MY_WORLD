// Coffre des accès : chiffrement AES-256-GCM des mots de passe GÉNÉRÉS (jamais ceux choisis par les utilisateurs),
// pour permettre au super admin et aux administrateurs d'intervenir en cas d'oubli.
// Clé : variable VAULT_KEY (32 octets en base64 ou hex) ou fichier DATA_DIR/vault.key créé au premier démarrage.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';

function loadKey() {
  const env = process.env.VAULT_KEY;
  if (env) {
    const k = /^[0-9a-f]{64}$/i.test(env) ? Buffer.from(env, 'hex') : Buffer.from(env, 'base64');
    if (k.length !== 32) throw new Error('VAULT_KEY doit contenir 32 octets (64 caractères hexadécimaux ou base64).');
    return k;
  }
  const file = path.join(DATA_DIR, 'vault.key');
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  const k = crypto.randomBytes(32);
  fs.writeFileSync(file, k.toString('base64'), { mode: 0o600 });
  return k;
}
const KEY = loadKey();

export function seal(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}
export function unseal(blob) {
  if (!blob) return null;
  try {
    const [v, iv, tag, ct] = blob.split(':');
    if (v !== 'v1') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}
