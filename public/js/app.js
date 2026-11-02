// Point d'entrée : détection de l'interface (site, console AI721, établissement), connexion, coque responsive, routeur.
import { h, raw, mount, $, $$, icon, toast, modal, initials, ROLE_LABEL, debounce, setTerms, terms } from './ui.js';
import { get, post, setHandlers, setBase } from './api.js';

export const state = { user: null, school: null, periods: [], current: 1, incidentTypes: [], ctx: null };
const root = document.getElementById('root');
let routes = [];

/* ---------- Interface d'après l'adresse ----------
   /                         site de présentation AI721 TECH STUFF
   /console                  console du super administrateur
   /e/<code>                 choix de l'espace de l'établissement
   /e/<code>/admin           connexion Administration
   /e/<code>/enseignant      connexion Enseignants
   /e/<code>/discipline      connexion Vie scolaire */
const SLUG_ROLE = { admin: 'admin', enseignant: 'teacher', discipline: 'discipline' };
export const ROLE_SLUG = { admin: 'admin', teacher: 'enseignant', discipline: 'discipline' };
function detect() {
  const p = location.pathname.replace(/\/+$/, '') || '/';
  if (p === '/console') return { kind: 'console', portal: 'superadmin', base: '/console/api', home: '/console' };
  const m = /^\/e\/([a-z0-9][a-z0-9-]{1,29})(?:\/(admin|enseignant|discipline))?$/.exec(p);
  if (m && m[2]) return { kind: 'tenant', code: m[1], portal: SLUG_ROLE[m[2]], slug: m[2], base: `/e/${m[1]}/api`, home: `/e/${m[1]}/${m[2]}` };
  if (m) return { kind: 'chooser', code: m[1], base: `/e/${m[1]}/api`, home: `/e/${m[1]}` };
  return { kind: 'landing', base: '/console/api', home: '/' };
}
const ctx = state.ctx = detect();
setBase(ctx.base);
document.body.dataset.portal = ctx.portal || 'landing';
// manifeste PWA propre à l'interface : l'application installée s'ouvre directement sur la bonne page
$('link[rel=manifest]')?.setAttribute('href', `/manifest.webmanifest?p=${encodeURIComponent(ctx.home)}`);

/* Présentation de chaque interface de connexion (couleurs, textes, icône) */
export const PORTALS = {
  superadmin: { name: 'Console AI721', role: 'Super administrateur', icon: 'shield', h1: 'Pilotez la plateforme et vos établissements abonnés.',
    p: "Abonnements annuels, paiements, comptes des administrateurs d'établissement, coffre des accès et suivi de l'activité.",
    feats: [['building', 'Établissements', 'Création, suspension, renouvellement'], ['database', 'Abonnements', 'Septembre → août, reçus PDF'],
      ['key', "Coffre des accès", 'Identifiants et liens des administrateurs'], ['chart', 'Tableau de bord', 'Recettes, élèves gérés, échéances']] },
  admin: { name: 'Administration', role: "Administrateur de l'établissement", icon: 'building', h1: 'Pilotez votre établissement en toute simplicité.',
    p: 'Paramètres, comptes du personnel, emplois du temps, clôtures par séquence et par trimestre, bulletins, statistiques, assiduité et documents administratifs des enseignants.',
    feats: [['users', 'Personnel & élèves', 'Comptes, coffre des accès, imports'], ['file', 'Dossier du personnel', 'Assiduité, attestations, courriers'],
      ['trophy', 'Bulletins & PV', 'Clôtures et documents officiels'], ['chart', 'Statistiques', 'Exportables en PDF']] },
  teacher: { name: 'Espace Enseignants', role: 'Enseignant', icon: 'teacher', h1: 'Vos notes, où que vous soyez.',
    p: 'Saisie des notes par séquence ou par trimestre, progression annuelle et relevés PDF, sur ordinateur, tablette ou smartphone.',
    feats: [['edit', 'Saisie rapide', 'Clavier, collage Excel, hors ligne'], ['layers', 'Par trimestre', 'Deux séquences côte à côte'],
      ['target', 'Progression', 'Leçons prévues et faites'], ['file', 'Mes documents', 'Assiduité, courriers, réponses en ligne']] },
  discipline: { name: 'Vie scolaire', role: 'Responsable disciplinaire', icon: 'shield', h1: 'Le suivi disciplinaire en temps réel.',
    p: 'Absences, retards, consignes, sanctions et registre des incidents de vos classes, avec fiches PDF officielles.',
    feats: [['clock', 'Absences & retards', 'Par séquence et par trimestre'], ['flag', 'Incidents', 'Registre et historique'],
      ['checkCircle', 'Validation', 'Fiches prêtes pour la clôture'], ['pdf', 'Fiches PDF', 'Classe et individuelles']] }
};

/* ---------- Thème ---------- */
const applyTheme = (t) => { document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
applyTheme(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

/* ---------- Démarrage ---------- */
setHandlers({
  onAuthLost: () => { if (state.user) { state.user = null; toast('Votre session a expiré. Veuillez vous reconnecter.', 'warn'); renderLogin(); } },
  onMustChange: () => forcePasswordChange(),
  onSubscription: (msg) => { state.user = null; if (state.school?.subscription) state.school.subscription = { valid: false, message: msg }; renderLogin(); }
});

async function boot() {
  if (ctx.kind === 'landing') return (await import('./landing.js')).renderLanding(root);
  state.school = await get('/auth/public').catch((e) => ({ error: e.message, status: e.status }));
  if (state.school.error) return renderUnknown(state.school.error);
  setTerms(state.school.termes);
  if (ctx.kind === 'chooser') return renderChooser();
  document.title = `${PORTALS[ctx.portal].name} — ${ctx.kind === 'console' ? 'AI721 TECH STUFF' : (state.school.nom_court || state.school.nom)}`;
  // abonnement expiré, impayé ou établissement suspendu : seule la page de connexion (avec le message) est affichée
  if (state.school.subscription && !state.school.subscription.valid) return renderLogin();
  try { const { user } = await get('/auth/me'); state.user = user || null; } catch { state.user = null; }
  if (!state.user) return renderLogin();
  if (state.user.must_change) return forcePasswordChange();
  await startApp();
}

export const companyLogo = (cls = '') => h`<div class="logo co ${cls}">AI</div>`;
export const schoolLogo = (cls = '') => (ctx.kind === 'console' ? companyLogo(cls) : state.school?.logo
  ? h`<div class="logo ${cls}"><img src="${state.school.logo}" alt="Logo"></div>`
  : h`<div class="logo ${cls}">${initials(state.school?.nom_court || state.school?.nom || 'SX')}</div>`);

function renderUnknown(msg) {
  mount(root, h`<div class="splash"><div class="card" style="max-width:460px;margin:16px"><div class="empty">${icon('alert')}<h4>Établissement introuvable</h4>
    <div class="small">${msg}</div><div class="mt"><a class="btn btn-primary" href="/">${icon('home')} Accueil AI721 SchoolX CM</a></div></div></div></div>`);
}

/* ---------- Choix de l'espace d'un établissement ---------- */
function renderChooser() {
  const s = state.school, sub = s.subscription || {};
  document.title = `${s.nom_court || s.nom} — AI721 SchoolX CM`;
  const card = (slug, role) => { const P = PORTALS[role]; return h`<a class="portal-card" data-p="${role}" href="/e/${s.code}/${slug}">
    <div class="pc-ico">${icon(P.icon, 'lg')}</div><div><b>${P.name}</b><div class="small muted">${P.role}</div></div>${icon('arrowRight')}</a>`; };
  mount(root, h`<div class="chooser">
    <div class="chooser-card">
      <div class="school">${schoolLogo('lg')}<div><h2 style="margin:0">${s.nom}</h2><div class="muted small">Année scolaire ${s.annee_scolaire}${s.ville ? ' • ' + s.ville : ''}</div></div></div>
      ${!sub.valid ? h`<div class="alert danger mt">${icon('lock')}<div>${sub.message}</div></div>` : ''}
      <p class="muted mt">Choisissez votre espace de connexion :</p>
      <div class="stack">${card('admin', 'admin')}${card('enseignant', 'teacher')}${card('discipline', 'discipline')}</div>
      <p class="small muted mt" style="text-align:center">AI721 SchoolX CM — une solution ${s.societe || 'AI721 TECH STUFF'}</p>
    </div></div>`);
}

/* ---------- Connexion (une page distincte par interface) ---------- */
function renderLogin(notice) {
  const s = state.school || {}, P = PORTALS[ctx.portal], isConsole = ctx.kind === 'console';
  const sub = s.subscription;
  const demo = s.demo?.[ctx.portal];
  mount(root, h`<div class="login">
    <section class="login-hero">
      <div class="brand">${isConsole ? companyLogo() : h`<div class="logo">${icon('school')}</div>`}<div><div>${isConsole ? s.societe || 'AI721 TECH STUFF' : 'AI721 SchoolX CM'}</div>
        <div class="small" style="opacity:.75;font-weight:400">${isConsole ? 'Éditeur de la plateforme AI721 SchoolX CM' : `Une solution ${s.societe || 'AI721 TECH STUFF'}`}</div></div></div>
      <div>
        <div class="portal-badge">${icon(P.icon, 'sm')} ${P.name}</div>
        <h1>${P.h1}</h1>
        <p>${terms(P.p)}</p>
        <div class="hero-feats">${P.feats.map(([ic, t, d]) => h`<div class="hero-feat">${icon(ic)}<div><b>${t}</b><br>${terms(d)}</div></div>`)}</div>
      </div>
      <div class="small hero-foot" style="opacity:.6">© ${new Date().getFullYear()} ${s.societe || 'AI721 TECH STUFF'} • Connexion chiffrée • Accès réservé</div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <div class="school">${schoolLogo('lg')}<div><b>${isConsole ? s.societe : s.nom || 'Établissement'}</b><div class="small muted">${isConsole ? 'Console de super administration' : `Année scolaire ${s.annee_scolaire || ''}`}</div></div></div>
        <div class="portal-pill">${icon(P.icon, 'sm')} ${P.name}</div>
        <h2>Connexion</h2>
        <p class="muted">${isConsole ? 'Accès réservé au super administrateur.' : `Espace réservé : ${P.role.toLowerCase()}.`}</p>
        ${sub && !sub.valid ? h`<div class="alert danger mb">${icon('lock')}<div><b>Accès indisponible.</b> ${sub.message}${s.societe_tel ? h`<br>Contact : ${s.societe_tel}` : ''}</div></div>` : ''}
        ${notice ? h`<div class="alert warn mb">${icon('info')}<div>${notice}</div></div>` : ''}
        <form id="loginForm" class="stack" novalidate>
          <div class="field"><label for="u">Identifiant</label><div class="input-icon">${icon('user', 'sm')}<input class="input" id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div></div>
          <div class="field"><label for="p">Mot de passe</label><div class="input-icon rel">${icon('lock', 'sm')}<input class="input" id="p" name="password" type="password" autocomplete="current-password" required>
            <button type="button" class="btn btn-ghost btn-sm btn-icon pw-toggle" aria-label="Afficher le mot de passe">${icon('eye', 'sm')}</button></div></div>
          <div class="alert danger hidden" id="loginErr" role="alert"></div>
          <button class="btn btn-primary btn-block" style="min-height:46px" type="submit">${icon('arrowRight')} Se connecter</button>
        </form>
        <p class="small muted mt">${isConsole ? 'Mot de passe oublié : réinitialisation sur le serveur (variable SUPERADMIN_PASSWORD).'
    : ctx.portal === 'admin' ? `Identifiants oubliés ? Contactez ${s.societe || 'AI721 TECH STUFF'}${s.societe_tel ? ' (' + s.societe_tel + ')' : ''}.`
      : "Identifiants oubliés ? L'administrateur de votre établissement les retrouve dans son coffre des accès."}</p>
        ${!isConsole ? h`<p class="small" style="text-align:center"><a href="/e/${s.code}">${icon('swap', 'sm')} Changer d'espace</a></p>` : ''}
        ${demo ? h`<div class="demo-box"><b>Mode démonstration</b> — cliquez pour remplir :<button type="button" data-u="${demo.u}" data-p="${demo.p}"><span>${P.role}</span><code>${demo.u} / ${demo.p}</code></button></div>` : ''}
      </div>
    </section></div>`);
  const form = $('#loginForm'), err = $('#loginErr');
  $('.pw-toggle').onclick = () => { const p = $('#p'); p.type = p.type === 'password' ? 'text' : 'password'; };
  $$('.demo-box button').forEach((b) => (b.onclick = () => { $('#u').value = b.dataset.u; $('#p').value = b.dataset.p; }));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    const username = $('#u').value.trim(), password = $('#p').value;
    if (!username || !password) { err.textContent = 'Saisissez votre identifiant et votre mot de passe.'; err.classList.remove('hidden'); return; }
    btn.disabled = true; err.classList.add('hidden');
    try {
      const { user } = await post('/auth/login', { username, password, portal: ctx.portal });
      state.user = user;
      if (user.must_change) return forcePasswordChange();
      await startApp();
    } catch (ex) {
      mount(err, ex.data?.redirect ? h`${ex.message} <a href="${ex.data.redirect}">Ouvrir cette interface</a>` : h`${ex.message}`);
      err.classList.remove('hidden'); btn.disabled = false; $('#p').select();
    }
  };
  // focus initial seulement si l'utilisateur n'a encore rien commencé (pas de saut pendant la saisie)
  setTimeout(() => { const u = $('#u'); if (u && !u.value && (document.activeElement === document.body || !document.activeElement)) u.focus(); }, 50);
}

/* ---------- Mot de passe ---------- */
function pwStrength(pw) {
  let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/\d/.test(pw) && /[a-z]/i.test(pw)) s++; if (/[^a-z0-9]/i.test(pw)) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  return Math.min(4, s);
}
export function passwordForm({ forced = false } = {}) {
  const vaultNote = ctx.kind === 'tenant' && state.user?.role !== 'admin'
    ? "Après ce changement, l'administrateur ne pourra plus vous rappeler votre mot de passe : en cas d'oubli, il en générera un nouveau."
    : ctx.kind === 'tenant' ? `Après ce changement, ${state.school?.societe || 'AI721 TECH STUFF'} ne pourra plus vous rappeler votre mot de passe : en cas d'oubli, un nouveau sera généré.` : '';
  return modal({
    title: forced ? 'Choisissez votre mot de passe personnel' : 'Changer mon mot de passe', size: 'sm', dismissible: !forced,
    body: h`${forced ? h`<div class="alert info mb">${icon('info')}<div>Pour votre sécurité, remplacez le mot de passe provisoire par un mot de passe personnel.</div></div>` : ''}
      ${vaultNote ? h`<div class="alert warn mb">${icon('key')}<div class="small">${vaultNote}</div></div>` : ''}
      <form class="stack" novalidate>
        <div class="field"><label>Mot de passe actuel</label><input class="input" type="password" name="current" autocomplete="current-password"></div>
        <div class="field"><label>Nouveau mot de passe</label><input class="input" type="password" name="next" autocomplete="new-password">
          <div class="progress" data-strength><span style="width:0"></span></div><span class="hint">8 caractères minimum, avec au moins une lettre et un chiffre. Astuce : une courte phrase facile à retenir.</span></div>
        <div class="field"><label>Confirmer le nouveau mot de passe</label><input class="input" type="password" name="confirm" autocomplete="new-password"></div>
        <div class="alert danger hidden" data-err></div>
      </form>`,
    footer: h`${forced ? h`<button class="btn btn-ghost" data-logout>${icon('logout')} Déconnexion</button>` : h`<button class="btn btn-outline" data-close>Annuler</button>`}<button class="btn btn-primary" data-ok>${icon('check')} Valider</button>`,
    onOpen: ({ root: r, close }) => {
      const err = $('[data-err]', r), bar = $('[data-strength] span', r);
      $('[name=next]', r).oninput = (e) => { const s = pwStrength(e.target.value); bar.style.width = `${s * 25}%`; bar.parentElement.className = `progress ${s < 2 ? 'red' : s < 3 ? 'gold' : ''}`; };
      $('[data-logout]', r)?.addEventListener('click', logout);
      const submit = async (e) => {
        e?.preventDefault();
        const current = $('[name=current]', r).value, next = $('[name=next]', r).value, confirm = $('[name=confirm]', r).value;
        if (next !== confirm) { err.textContent = 'Les deux mots de passe ne correspondent pas.'; err.classList.remove('hidden'); return; }
        try { await post('/auth/password', { current, next }); toast('Mot de passe modifié avec succès'); close(true); }
        catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
      };
      $('[data-ok]', r).onclick = submit; $('form', r).onsubmit = submit;
    }
  });
}
async function forcePasswordChange() {
  if ($('.modal-root')) return;
  mount(root, h`<div class="splash"></div>`);
  const ok = await passwordForm({ forced: true });
  if (ok) { state.user.must_change = false; await startApp(); }
}
export async function logout() {
  try { await post('/auth/logout'); } catch { /* ignore */ }
  state.user = null; $$('.modal-root').forEach((m) => m.remove());
  history.replaceState(null, '', location.pathname); renderLogin();
}

/* ---------- Application ---------- */
async function startApp() {
  const role = state.user.role;
  // une session ouverte dans un autre espace du même établissement : on oriente vers le bon
  if (ctx.kind === 'tenant' && role !== ctx.portal) {
    mount(root, h`<div class="splash"><div class="card" style="max-width:480px;margin:16px"><div class="empty">${icon('info')}
      <h4>Vous êtes connecté en tant que ${ROLE_LABEL[role].toLowerCase()}</h4><div class="small">Cette page est l'interface « ${PORTALS[ctx.portal].name} ».</div>
      <div class="mt row" style="justify-content:center"><a class="btn btn-primary" href="/e/${ctx.code}/${ROLE_SLUG[role]}">${icon('arrowRight')} Aller à mon espace</a>
      <button class="btn btn-outline" data-out>${icon('logout')} Me déconnecter</button></div></div></div></div>`);
    $('[data-out]').onclick = logout; return;
  }
  let mod;
  if (ctx.kind === 'console') mod = await import('./console.js');
  else {
    const p = await get('/periods');
    state.periods = p.periods; state.current = p.current; state.incidentTypes = p.incidentTypes;
    mod = role === 'admin' ? await import('./admin.js') : role === 'teacher' ? await import('./teacher.js') : await import('./discipline.js');
  }
  const shared = await import('./shared.js');
  routes = [...mod.routes, ...shared.commonRoutes(role)];
  renderShell();
  window.onhashchange = route;
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/' + routes[0].path;
  else route();
}
export async function refreshPeriods() {
  const p = await get('/periods'); state.periods = p.periods; state.current = p.current; renderRibbon();
}

function renderShell() {
  const u = state.user, s = state.school, isConsole = ctx.kind === 'console';
  const groups = [...new Set(routes.filter((r) => r.nav !== false).map((r) => r.group || ''))];
  mount(root, h`<div class="app" id="app">
    <aside class="sidebar" aria-label="Navigation principale">
      <div class="sb-brand">${schoolLogo()}<div class="txt"><div class="t1">${isConsole ? 'Console AI721' : s.nom_court || s.nom}</div><div class="t2">${isConsole ? s.societe : `${PORTALS[ctx.portal].name} • ${s.annee_scolaire}`}</div></div></div>
      <nav class="sb-nav">${groups.map((g) => h`${g ? h`<div class="sb-group">${g}</div>` : ''}${routes.filter((r) => r.nav !== false && (r.group || '') === g)
        .map((r) => h`<a class="sb-link" href="#/${r.path}" data-path="${r.path}" title="${r.title}">${icon(r.icon)}<span>${r.title}</span></a>`)}`)}</nav>
      <div class="sb-foot"><div class="sb-user"><div class="avatar gold">${initials(u.full_name)}</div><div class="meta" style="min-width:0"><div class="n">${u.full_name}</div><div class="r">${ROLE_LABEL[u.role]}</div></div></div>
        ${!isConsole ? h`<div class="sb-powered">AI721 SchoolX CM • ${s.societe || 'AI721 TECH STUFF'}</div>` : ''}</div>
    </aside>
    <div class="scrim" data-scrim></div>
    <div class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon menu-btn" data-menu aria-label="Menu">${icon('menu')}</button>
        <div class="title"><div class="crumb" data-crumb></div><h1 data-title>AI721 SchoolX CM</h1></div>
        <div class="spacer"></div>
        ${u.role === 'admin' ? h`<div class="search-box hide-mobile"><div class="input-icon">${icon('search', 'sm')}<input class="input" style="min-height:38px" placeholder="Rechercher élève, enseignant, classe…" data-search aria-label="Recherche globale"></div><div class="search-results hidden" data-results></div></div>` : ''}
        ${!isConsole ? h`<div class="seq-ribbon" data-ribbon title="Calendrier des séquences"></div>` : ''}
        ${s.subscription?.code === 'expire_bientot' && u.role === 'admin' ? h`<span class="badge amber hide-mobile" title="${s.subscription.message}">${icon('clock', 'sm')} ${s.subscription.label}</span>` : ''}
        <button class="btn btn-ghost btn-icon" data-theme-toggle aria-label="Changer de thème">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
        <div class="rel"><button class="btn btn-ghost btn-icon" data-usermenu aria-label="Mon compte"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(u.full_name)}</div></button>
          <div class="menu hidden" data-menu-pop>
            <div style="padding:8px 10px"><b>${u.full_name}</b><div class="small muted">${ROLE_LABEL[u.role]} • ${u.username}</div></div><hr>
            <a href="#/profil">${icon('user')} Mon profil</a>
            <button data-pw>${icon('key')} Changer mon mot de passe</button>
            ${!isConsole ? h`<a href="#/annonces">${icon('megaphone')} Annonces</a>` : ''}<hr>
            <button data-logout style="color:var(--red-600)">${icon('logout')} Se déconnecter</button>
          </div></div>
      </header>
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="bottombar" aria-label="Navigation rapide">${routes.filter((r) => r.mobile).slice(0, 4).map((r) => h`<a href="#/${r.path}" data-path="${r.path}">${icon(r.icon)}<span>${r.short || r.title}</span></a>`)}
      <a href="#" data-menu>${icon('menu')}<span>Menu</span></a></nav>
  </div>`);
  const app = $('#app');
  $$('[data-menu]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); app.classList.toggle('nav-open'); }));
  $('[data-scrim]').onclick = () => app.classList.remove('nav-open');
  $('[data-theme-toggle]').onclick = (e) => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); mount(e.currentTarget, icon(t === 'dark' ? 'sun' : 'moon')); };
  const pop = $('[data-menu-pop]');
  $('[data-usermenu]').onclick = (e) => { e.stopPropagation(); pop.classList.toggle('hidden'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-menu-pop]')) pop.classList.add('hidden'); if (!e.target.closest('.search-box')) $('[data-results]')?.classList.add('hidden'); });
  $('[data-logout]').onclick = logout;
  $('[data-pw]').onclick = () => { pop.classList.add('hidden'); passwordForm(); };
  const search = $('[data-search]');
  if (search) {
    const res = $('[data-results]');
    search.oninput = debounce(async () => {
      const q = search.value.trim(); if (q.length < 2) { res.classList.add('hidden'); return; }
      const r = await get(`/search?q=${encodeURIComponent(q)}`).catch(() => null); if (!r) return;
      const none = !r.students.length && !r.users.length && !r.classes.length;
      mount(res, none ? h`<div class="small muted" style="padding:10px">Aucun résultat</div>` : h`
        ${r.students.length ? h`<div class="grp">Élèves</div>${r.students.map((x) => h`<a href="#/eleves?q=${encodeURIComponent(x.matricule)}">${x.nom} ${x.prenom} <span class="muted small">— ${x.classe || 'sans classe'} • ${x.matricule}</span></a>`)}` : ''}
        ${r.users.length ? h`<div class="grp">Personnel</div>${r.users.map((x) => h`<a href="#/${x.role === 'discipline' ? 'responsables' : x.role === 'teacher' ? 'enseignants' : 'profil'}?q=${encodeURIComponent(x.username)}">${x.full_name} <span class="muted small">— ${ROLE_LABEL[x.role]}</span></a>`)}` : ''}
        ${r.classes.length ? h`<div class="grp">Classes</div>${r.classes.map((c) => h`<a href="#/resultats?class=${c.id}">${c.name}</a>`)}` : ''}`);
      res.classList.remove('hidden');
    }, 250);
    res.onclick = () => { res.classList.add('hidden'); search.value = ''; };
  }
  renderRibbon();
}

function renderRibbon() {
  const el = $('[data-ribbon]'); if (!el) return;
  mount(el, h`<span class="lbl">Séquences</span>${state.periods.map((p) => h`<span class="seq-dot ${p.status === 'closed' ? 'closed' : ''} ${p.seq === state.current && p.status !== 'closed' ? 'current' : ''} ${p.seq % 2 === 1 && p.seq > 1 ? 'tri' : ''}"
    title="Séquence ${p.seq} (T${Math.ceil(p.seq / 2)}) : ${p.status === 'closed' ? 'clôturée' : p.seq === state.current ? 'en cours' : 'ouverte'} (${p.start_date} → ${p.end_date})">${p.status === 'closed' ? raw('&#10003;') : `S${p.seq}`}</span>`)}`);
}

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { path: path || '', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export function go(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  const target = `#/${path}${qs ? '?' + qs : ''}`;
  if (location.hash === target) route(); else location.hash = target;
}
/** Met à jour la query string sans relancer le rendu. */
export function setParams(params) {
  const { path, params: cur } = parseHash();
  const qs = new URLSearchParams(Object.entries({ ...cur, ...params }).filter(([, v]) => v != null && v !== '')).toString();
  history.replaceState(null, '', `#/${path}${qs ? '?' + qs : ''}`);
}

let guard = null; // fonction retournant un message si des modifications non enregistrées existent
export const setLeaveGuard = (fn) => { guard = fn; };
window.addEventListener('beforeunload', (e) => { if (guard?.()) { e.preventDefault(); e.returnValue = ''; } });

let lastHash = location.hash;
async function route() {
  if (guard?.() && !confirm(guard())) { history.replaceState(null, '', lastHash); return; }
  guard = null; lastHash = location.hash;
  const { path, params } = parseHash();
  const r = routes.find((x) => x.path === path) || routes[0];
  $('#app')?.classList.remove('nav-open');
  $$('[data-path]').forEach((a) => a.classList.toggle('active', a.dataset.path === r.path));
  $('[data-title]').textContent = r.title;
  $('[data-crumb]').textContent = r.group || 'Accueil';
  document.title = `${r.title} — ${ctx.kind === 'console' ? 'Console AI721' : state.school.nom_court || state.school.nom}`;
  // conteneur neuf à chaque navigation : aucun écouteur d'une page précédente ne survit
  const prev = $('#view'); const view = prev.cloneNode(false); prev.replaceWith(view);
  mount(view, h`<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);
  try { await r.render(view, params); }
  catch (ex) {
    if (ex.status === 401 || ex.status === 428 || ex.status === 402) return;
    mount(view, h`<div class="card"><div class="empty">${icon('alert')}<h4>Impossible d'afficher cette page</h4><div class="small">${ex.message}</div>
      <div class="mt"><button class="btn btn-outline" data-reload>${icon('refresh')} Réessayer</button></div></div></div>`);
    $('[data-reload]', view)?.addEventListener('click', () => location.reload());
    console.error(ex);
  }
  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
export const rerender = () => route();

// Service worker (PWA installable, coquille hors ligne)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});

boot().catch((e) => { mount(root, h`<div class="empty">${icon('alert')}<h4>Erreur de démarrage</h4><div>${e.message}</div></div>`); });
