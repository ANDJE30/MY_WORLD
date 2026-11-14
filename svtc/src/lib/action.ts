import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { AuthError } from './auth';

export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string };

export class UserError extends Error {}

/** Exécute une action serveur et transforme les erreurs en messages compréhensibles (sans fuite technique). */
export async function safe<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof UserError || e instanceof AuthError) return { ok: false, message: e.message };
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return { ok: false, message: first?.message ?? 'Données invalides.' };
    }
    const code = (e as { code?: string })?.code;
    if (code === '23505') return { ok: false, message: 'Cet enregistrement existe déjà (doublon).' };
    if (code === '23503') return { ok: false, message: 'Impossible : cet élément est utilisé ailleurs (supprimez ou modifiez d’abord les éléments liés).' };
    console.error('[action]', e);
    return { ok: false, message: 'Une erreur inattendue est survenue. Réessayez ou contactez l’administrateur.' };
  }
}

/** Convertit un FormData en objet simple (les champs vides deviennent undefined). */
export function formObject(fd: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== 'string' || k.startsWith('$ACTION')) continue;
    const t = v.trim();
    out[k] = t === '' ? undefined : t;
  }
  return out;
}

// Aides de validation (messages en français)
export const zs = {
  text: (label: string, max = 200) => z.string({ error: `${label} : champ obligatoire.` }).trim().min(1, `${label} : champ obligatoire.`).max(max, `${label} : ${max} caractères au maximum.`),
  optText: (max = 500) => z.string().trim().max(max, `${max} caractères au maximum.`).optional(),
  int: (label: string, min = 0, max = 100_000_000) =>
    z.coerce.number({ error: `${label} : nombre invalide.` }).int(`${label} : nombre entier attendu.`).min(min, `${label} : minimum ${min}.`).max(max, `${label} : maximum ${max}.`),
  optInt: (min = 0, max = 100_000_000) => z.coerce.number().int().min(min).max(max).optional(),
  id: (label = 'Identifiant') => z.coerce.number({ error: `${label} invalide.` }).int().positive(`${label} : sélection obligatoire.`),
  date: (label: string) => z.string({ error: `${label} : date obligatoire.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} : date invalide.`),
  time: (label: string) => z.string({ error: `${label} : heure obligatoire.` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} : heure invalide (HH:MM).`),
  period: () => z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Période invalide (AAAA-MM).'),
  bool: () => z.preprocess((v) => v === 'on' || v === 'true' || v === '1' || v === true, z.boolean()),
};
