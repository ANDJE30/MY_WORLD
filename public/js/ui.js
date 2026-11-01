// Boîte à outils UI : gabarits sûrs (échappement automatique), icônes, modales, toasts, formulaires, graphiques.

/* ---------- Gabarits HTML sûrs ---------- */
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const render = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(render).join('') : esc(v));
/** Gabarit étiqueté : toute valeur interpolée est échappée sauf si elle provient de h`` ou raw(). */
export function h(strings, ...vals) { let o = ''; strings.forEach((s, i) => { o += s; if (i < vals.length) o += render(vals[i]); }); return new Raw(o); }
export function mount(el, tpl) { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); return el; }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Icônes (tracés SVG maison, style trait) ---------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M2 21h20',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  teacher: 'M2 4h20v12H2zM8 20h8M12 16v4M6 8h7M6 11h4',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  pen: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-4M12 8h.01',
  lock: 'M5 11h14v10H5zM7 11V7a5 5 0 0 1 10 0v4',
  unlock: 'M5 11h14v10H5zM7 11V7a5 5 0 0 1 9.9-1',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 12h18M3 6h18M3 18h18',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.35-4.35',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
  pdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 15h1.5a1.5 1.5 0 0 0 0-3H8v6M14 12v6M14 12h2.5M14 15h2',
  chart: 'M3 3v18h18M7 16v-5M12 16V8M17 16v-9',
  pie: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  database: 'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  history: 'M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8M12 7v5l4 2',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22M14.12 14.12a3 3 0 1 1-4.24-4.24',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  arrowRight: 'M5 12h14M12 5l7 7-7 7',
  chevronDown: 'm6 9 6 6 6-6',
  swap: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  progress: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4',
  clipboard: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9zM9 12l2 2 4-4'
};
export const icon = (name, cls = '') => raw(`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.info}"/></svg>`);

/* ---------- Formatage ---------- */
export const fmtNum = (v, d = 2) => (v == null || v === '' || Number.isNaN(+v) ? '—' : Number(v).toFixed(d).replace('.', ','));
export const fmtDate = (s) => (s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtTs = (ts) => (ts ? new Date(ts * 1000).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const initials = (n) => String(n || '?').replace(/^(Dr|M|Mme|Mlle)\.?\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
export const parseNote = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.').trim()); return Number.isFinite(n) ? n : NaN; };
export function appreciation(a) {
  if (a == null || Number.isNaN(a)) return '—';
  return a >= 18 ? 'Excellent' : a >= 16 ? 'Très bien' : a >= 14 ? 'Bien' : a >= 12 ? 'Assez bien' : a >= 10 ? 'Passable' : a >= 8 ? 'Insuffisant' : a >= 5 ? 'Faible' : 'Très faible';
}
export const noteClass = (v) => (v == null || Number.isNaN(v) ? '' : v < 10 ? 'low' : v >= 14 ? 'good' : '');
export const ROLE_LABEL = { superadmin: 'Super administrateur', admin: 'Administrateur', teacher: 'Enseignant', discipline: 'Responsable disciplinaire' };
export const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const PERIODS = [['S1', 'Séquence 1'], ['S2', 'Séquence 2'], ['T1', 'Trimestre 1'], ['S3', 'Séquence 3'], ['S4', 'Séquence 4'], ['T2', 'Trimestre 2'],
  ['S5', 'Séquence 5'], ['S6', 'Séquence 6'], ['T3', 'Trimestre 3'], ['A', 'Bilan annuel']];
export const seqOptions = (sel) => [1, 2, 3, 4, 5, 6].map((s) => h`<option value="${s}" ${+sel === s ? raw('selected') : ''}>Séquence ${s}</option>`);
export const periodOptions = (sel) => PERIODS.map(([v, l]) => h`<option value="${v}" ${sel === v ? raw('selected') : ''}>${l}</option>`);
// couleur stable par matière (emploi du temps)
const PALETTE = ['#d9f2e8', '#fde9c8', '#dbeafe', '#fce7f3', '#e9e3fd', '#d1f4f6', '#fee2d5', '#e6f2c9', '#f5e1c8', '#e0e7ff', '#ffe4e6', '#dcfce7'];
export const colorFor = (k) => { let x = 0; for (const c of String(k)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[x % PALETTE.length]; };

/* ---------- Toasts ---------- */
export function toast(msg, type = 'ok', ms = 3800) {
  let root = $('.toasts'); if (!root) { root = document.createElement('div'); root.className = 'toasts'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite'); document.body.append(root); }
  const el = document.createElement('div'); el.className = `toast ${type}`;
  mount(el, h`${icon(type === 'ok' ? 'checkCircle' : type === 'warn' ? 'alert' : 'alert')}<div>${msg}</div>`);
  root.append(el); setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, ms);
}

/* ---------- Modales ---------- */
export function modal({ title, body, footer, size = '', onOpen, dismissible = true }) {
  return new Promise((resolve) => {
    const root = document.createElement('div'); root.className = 'modal-root';
    mount(root, h`<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-h"><h3>${title}</h3>${dismissible ? h`<button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Fermer">${icon('x')}</button>` : ''}</div>
      <div class="modal-b">${body}</div>${footer ? h`<div class="modal-f">${footer}</div>` : ''}</div>`);
    const prevFocus = document.activeElement;
    const close = (v) => { root.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); resolve(v); };
    // Échap ne ferme que la fenêtre du dessus (fenêtres imbriquées)
    const onKey = (e) => { if (e.key === 'Escape' && dismissible && root === $$('.modal-root').pop()) close(null); };
    root.addEventListener('click', (e) => { if ((e.target === root && dismissible) || e.target.closest('[data-close]')) close(null); });
    document.addEventListener('keydown', onKey);
    document.body.append(root);
    const ctx = { root, close, el: $('.modal', root) };
    onOpen?.(ctx);
    setTimeout(() => $('input:not([type=hidden]):not([readonly]), select, textarea', root)?.focus(), 50);
  });
}
export function confirmDialog({ title = 'Confirmation', message, okLabel = 'Confirmer', danger = false, requirePassword = false, checkbox }) {
  return modal({
    title, size: 'sm',
    body: h`<p class="mb" style="margin-top:0">${message}</p>
      ${checkbox ? h`<label class="check mb"><input type="checkbox" name="chk"> ${checkbox}</label>` : ''}
      ${requirePassword ? h`<div class="field"><label>Confirmez avec votre mot de passe</label><input class="input" type="password" name="pw" autocomplete="current-password"></div>` : ''}`,
    footer: h`<button class="btn btn-outline" data-close>Annuler</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${okLabel}</button>`,
    onOpen: ({ root, close }) => {
      const ok = () => {
        const pw = $('[name=pw]', root)?.value;
        if (requirePassword && !pw) { $('[name=pw]', root).classList.add('invalid'); return; }
        close({ password: pw, checked: $('[name=chk]', root)?.checked || false });
      };
      $('[data-ok]', root).onclick = ok;
      $('[name=pw]', root)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    }
  });
}

/* ---------- Formulaires déclaratifs ---------- */
// champ : { name, label, type: text|number|date|select|textarea|checkbox|password|email|tel|multiselect, options:[[v,l]], required, full, hint, min, max, step, placeholder }
export function fieldHtml(f, v) {
  const val = v ?? f.value ?? '';
  const req = f.required ? raw('required') : '';
  const common = h`name="${f.name}" id="f_${f.name}" ${req} ${f.readonly ? raw('readonly') : ''}`;
  let input;
  if (f.type === 'select') input = h`<select class="select" ${common}>${f.placeholder !== false ? h`<option value="">${f.placeholder || '— Choisir —'}</option>` : ''}${(f.options || []).map(([ov, ol]) => h`<option value="${ov}" ${String(ov) === String(val) ? raw('selected') : ''}>${ol}</option>`)}</select>`;
  else if (f.type === 'textarea') input = h`<textarea class="textarea" ${common} maxlength="${f.max || 3000}" placeholder="${f.placeholder || ''}">${val}</textarea>`;
  else if (f.type === 'checkbox') return h`<div class="field ${f.full ? 'full' : ''}"><label class="check"><input type="checkbox" ${common} ${val ? raw('checked') : ''}> ${f.label}</label>${f.hint ? h`<span class="hint">${f.hint}</span>` : ''}</div>`;
  else if (f.type === 'multiselect') {
    const set = new Set((val || []).map(String));
    input = h`<div class="chips" style="gap:8px">${(f.options || []).map(([ov, ol]) => h`<label class="check chip" style="padding:6px 10px"><input type="checkbox" name="${f.name}" value="${ov}" ${set.has(String(ov)) ? raw('checked') : ''}> ${ol}</label>`)}</div>`;
  } else input = h`<input class="input" type="${f.type || 'text'}" ${common} value="${val}" ${f.min != null ? raw(`min="${esc(f.min)}"`) : ''} ${f.max != null && f.type === 'number' ? raw(`max="${esc(f.max)}"`) : ''} ${f.step ? raw(`step="${esc(f.step)}"`) : ''} ${f.type !== 'number' && f.type !== 'date' ? raw(`maxlength="${f.maxlength || 200}"`) : ''} placeholder="${f.placeholder || ''}" autocomplete="${f.autocomplete || 'off'}">`;
  return h`<div class="field ${f.full ? 'full' : ''}"><label for="f_${f.name}">${f.label}${f.required ? ' *' : ''}</label>${input}${f.hint ? h`<span class="hint">${f.hint}</span>` : ''}</div>`;
}
export function readForm(root, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'checkbox') out[f.name] = $(`[name="${f.name}"]`, root)?.checked || false;
    else if (f.type === 'multiselect') out[f.name] = $$(`[name="${f.name}"]:checked`, root).map((x) => x.value);
    else out[f.name] = $(`[name="${f.name}"]`, root)?.value?.trim() ?? '';
  }
  return out;
}
/** Ouvre un formulaire modal ; onSubmit(data) peut lever une erreur affichée dans le formulaire. */
export function formModal({ title, fields, values = {}, submitLabel = 'Enregistrer', onSubmit, size = '', intro, onReady }) {
  return modal({
    title, size,
    body: h`${intro || ''}<form class="form-grid" novalidate>${fields.map((f) => fieldHtml(f, values[f.name]))}</form><div class="alert danger mt hidden" data-err></div>`,
    footer: h`<button class="btn btn-outline" data-close>Annuler</button><button class="btn btn-primary" data-submit>${icon('check')} ${submitLabel}</button>`,
    onOpen: ({ root, close }) => {
      const form = $('form', root), btn = $('[data-submit]', root), err = $('[data-err]', root);
      const submit = async (e) => {
        e?.preventDefault();
        const missing = fields.filter((f) => f.required && f.type !== 'checkbox' && !$(`[name="${f.name}"]`, root)?.value?.trim());
        $$('.invalid', root).forEach((x) => x.classList.remove('invalid'));
        if (missing.length) { missing.forEach((f) => $(`[name="${f.name}"]`, root)?.classList.add('invalid')); err.textContent = 'Veuillez remplir les champs obligatoires.'; err.classList.remove('hidden'); return; }
        btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span> Enregistrement…';
        try { const r = await onSubmit(readForm(root, fields)); close(r ?? true); }
        catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); btn.disabled = false; btn.innerHTML = old; }
      };
      form.addEventListener('submit', submit); btn.onclick = submit;
      onReady?.({ root });
    }
  });
}

/* ---------- Composants ---------- */
export const empty = (title, text = '', ic = 'info', action = '') => h`<div class="empty">${icon(ic)}<h4>${title}</h4><div class="small">${text}</div>${action ? h`<div class="mt">${action}</div>` : ''}</div>`;
export const progressBar = (pct, cls = '') => h`<div class="progress ${cls}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></span></div>`;
export const kpi = (ic, value, label, sub = '', tone = '') => h`<div class="card kpi"><div class="ico ${tone}">${icon(ic)}</div><div class="v">${value}</div><div class="l">${label}</div>${sub ? h`<div class="s">${sub}</div>` : ''}</div>`;
export const loading = () => h`<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`;
export function barsH(items, { max = 20, seuil = 10, fmt = (v) => fmtNum(v) } = {}) {
  if (!items.length) return empty('Aucune donnée', 'Les statistiques apparaîtront après la saisie des notes.', 'chart');
  return h`<div class="bars">${items.map((it) => h`<div class="bar-row"><div class="small" title="${it.label}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.label}</div>
    <div class="track"><div class="fill ${it.value != null && it.value < seuil ? 'low' : ''}" style="width:${it.value == null ? 0 : Math.min(100, (it.value / max) * 100)}%"></div>${seuil && max === 20 ? h`<div class="seuil" style="left:${(seuil / max) * 100}%"></div>` : ''}</div>
    <div class="v">${fmt(it.value)}</div></div>`)}</div>`;
}
export function barsV(items, { max = 20, seuil = 10 } = {}) {
  if (!items.length) return empty('Aucune donnée', '', 'chart');
  return h`<div class="vbars">${items.map((it) => h`<div class="vbar" title="${it.label} : ${fmtNum(it.value)}"><div class="col ${it.value != null && it.value < seuil ? 'low' : ''}" style="height:${it.value == null ? 2 : Math.max(3, (it.value / max) * 100)}%"><b>${fmtNum(it.value, 1)}</b></div><div class="x">${it.label}</div></div>`)}</div>`;
}

/* ---------- CSV (import / export) ---------- */
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x.trim()));
  if (!clean.length) return [];
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const head = clean[0].map(norm);
  return clean.slice(1).map((r) => Object.fromEntries(head.map((k, i) => [k, (r[i] || '').trim()])));
}
export function downloadCSV(filename, rows) {
  const s = rows.map((r) => r.map((c) => { const v = c == null ? '' : String(c); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + s], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const readFileText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file, 'utf-8'); });

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copié dans le presse-papiers'); } catch { toast('Copie impossible', 'err'); } }
export async function withBusy(btn, fn) {
  if (!btn) return fn();
  const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${btn.textContent.trim()}`;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}
