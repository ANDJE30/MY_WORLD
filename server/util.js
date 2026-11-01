// Validation stricte des entrées et utilitaires HTTP.
export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export const bad = (msg) => new HttpError(400, msg);

export const str = (v, { max = 200, required = false, label = 'Champ' } = {}) => {
  if (v == null || v === '') { if (required) throw bad(`${label} obligatoire`); return null; }
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${label} invalide`);
  const s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (required && !s) throw bad(`${label} obligatoire`);
  if (s.length > max) throw bad(`${label} : ${max} caractères maximum`);
  return s || null;
};
export const num = (v, { min = -Infinity, max = Infinity, required = false, label = 'Valeur', int = false } = {}) => {
  if (v == null || v === '') { if (required) throw bad(`${label} obligatoire`); return null; }
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n) || (int && !Number.isInteger(n))) throw bad(`${label} invalide`);
  if (n < min || n > max) throw bad(`${label} doit être entre ${min} et ${max}`);
  return n;
};
export const id = (v, label = 'Identifiant') => num(v, { min: 1, max: 1e12, int: true, required: true, label });
export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
export const date = (v, label = 'Date') => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad(`${label} invalide (AAAA-MM-JJ)`);
  return v;
};
export const oneOf = (v, list, label = 'Valeur') => { if (!list.includes(v)) throw bad(`${label} invalide`); return v; };
export const seqParam = (v) => num(v, { min: 1, max: 6, int: true, required: true, label: 'Séquence' });
