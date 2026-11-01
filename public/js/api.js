// Client HTTP : cookie de session HttpOnly + en-tête anti-CSRF, gestion uniforme des erreurs.
// La base de l'API dépend de l'interface : /console/api (AI721) ou /e/<code>/api (établissement).
export class ApiError extends Error { constructor(status, message, data) { super(message); this.status = status; this.data = data; } }
let BASE = '/console/api';
export const setBase = (b) => { BASE = b; };
export const apiUrl = (path) => `${BASE}${path}`;
let onAuthLost = () => {}, onMustChange = () => {}, onSubscription = () => {};
export const setHandlers = (h) => { onAuthLost = h.onAuthLost || onAuthLost; onMustChange = h.onMustChange || onMustChange; onSubscription = h.onSubscription || onSubscription; };

export async function api(path, { method = 'GET', body, raw = false, base } = {}) {
  let res;
  try {
    res = await fetch(`${base ?? BASE}${path}`, {
      method, credentials: 'same-origin',
      headers: { 'X-Requested-With': 'EduGest', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch { throw new ApiError(0, 'Connexion au serveur impossible. Vérifiez votre connexion Internet.'); }
  if (raw && res.ok) return res;
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onAuthLost();
    if (res.status === 428) onMustChange();
    if (res.status === 402 && !path.startsWith('/auth/login')) onSubscription(data?.error);
    throw new ApiError(res.status, data?.error || `Erreur ${res.status}`, data);
  }
  return data;
}
export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: 'POST', body });
export const put = (p, body = {}) => api(p, { method: 'PUT', body });
export const del = (p, body) => api(p, { method: 'DELETE', body });

/** Ouvre un PDF généré par le serveur (GET) dans un nouvel onglet. */
export function openPdf(path) {
  const url = apiUrl(path.startsWith('/pdf') || path.startsWith('/admin') ? path : `/pdf${path}`);
  const w = window.open(url, '_blank', 'noopener');
  if (!w) location.href = url;
}
/** PDF généré à partir d'une requête POST (ex. fiches d'identifiants). */
export async function postPdf(path, body, filename = 'document.pdf') {
  const res = await api(`/pdf${path}`, { method: 'POST', body, raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
