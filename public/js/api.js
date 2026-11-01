// Client HTTP : cookie de session HttpOnly + en-tête anti-CSRF, gestion uniforme des erreurs.
export class ApiError extends Error { constructor(status, message, data) { super(message); this.status = status; this.data = data; } }
let onAuthLost = () => {}, onMustChange = () => {};
export const setHandlers = (h) => { onAuthLost = h.onAuthLost || onAuthLost; onMustChange = h.onMustChange || onMustChange; };

export async function api(path, { method = 'GET', body, raw = false } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
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
    throw new ApiError(res.status, data?.error || `Erreur ${res.status}`, data);
  }
  return data;
}
export const get = (p) => api(p);
export const post = (p, body = {}) => api(p, { method: 'POST', body });
export const put = (p, body = {}) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });

/** Ouvre un PDF généré par le serveur (GET) dans un nouvel onglet. */
export function openPdf(path) {
  const w = window.open(`/api/pdf${path}`, '_blank', 'noopener');
  if (!w) location.href = `/api/pdf${path}`;
}
/** PDF généré à partir d'une requête POST (ex. fiches d'identifiants). */
export async function postPdf(path, body, filename = 'document.pdf') {
  const res = await api(`/pdf${path}`, { method: 'POST', body, raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
