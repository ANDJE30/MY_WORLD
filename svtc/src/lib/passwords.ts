import 'server-only';
import { randomBytes, randomInt, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Hachage scrypt salé : « scrypt$N$r$p$sel$hash » (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64url');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64url'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hachage factice utilisé pour égaliser le temps de réponse quand l'identifiant n'existe pas. */
export const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);

// Mots simples, sans accents ni lettres ambiguës, faciles à dicter au téléphone.
const WORDS = [
  'Baobab', 'Soleil', 'Lion', 'Etoile', 'Savane', 'Manguier', 'Fleuve', 'Colline', 'Ananas', 'Papaye', 'Cacao', 'Palmier',
  'Tigre', 'Panda', 'Zebre', 'Gazelle', 'Aigle', 'Faucon', 'Dauphin', 'Girafe', 'Cobra', 'Jaguar', 'Orchidee', 'Bambou',
  'Montagne', 'Cascade', 'Planete', 'Galaxie', 'Comete', 'Fusee', 'Robot', 'Pixel', 'Octet', 'Reseau', 'Serveur', 'Clavier',
  'Souris', 'Ecran', 'Algo', 'Python', 'Java', 'Binaire', 'Logique', 'Victoire', 'Courage', 'Sagesse', 'Lumiere', 'Avenir',
  'Mangue', 'Goyave', 'Sanaga', 'Mefou', 'Mvog', 'Nyong', 'Wouri', 'Ebolowa', 'Kribi', 'Limbe', 'Bafia', 'Akwa',
];
const SYMBOLS = ['@', '#', '*', '!', '+'];

/** Mot de passe facile à retenir : « Baobab@4827 » (mot + symbole + 4 chiffres). */
export function easyPassword(): string {
  const w = WORDS[randomInt(WORDS.length)];
  const s = SYMBOLS[randomInt(SYMBOLS.length)];
  return `${w}${s}${String(randomInt(1000, 10000))}`;
}

/** Identifiant lisible : « prenom.nom » sans accents. */
export function slugUsername(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 16);
  const first = clean(firstName.split(/\s+/)[0] ?? '');
  const last = clean(lastName.split(/\s+/)[0] ?? '');
  return [first, last].filter(Boolean).join('.') || 'utilisateur';
}

export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (pw.length > 128) return 'Le mot de passe est trop long (128 caractères au maximum).';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  return null;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(len = 10): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}
