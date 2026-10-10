import { createRouter, createWebHistory } from 'vue-router'
import { adminState } from './composables/adminAuth'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, _from, saved) => saved ?? (to.hash ? { el: to.hash, behavior: 'smooth', top: 80 } : { top: 0 }),
  routes: [
    {
      path: '/',
      component: () => import('./views/public/PublicLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('./views/public/Home.vue') },
        { path: 'inscription', name: 'inscription', component: () => import('./views/public/Register.vue') },
        { path: 'commande/:id/paiement', name: 'paiement', component: () => import('./views/public/Paiement.vue'), props: true },
        { path: 'commande/:id/confirmation', name: 'confirmation', component: () => import('./views/public/Confirmation.vue'), props: true },
        { path: 'facture/:code', name: 'facture', component: () => import('./views/public/FacturePage.vue'), props: true },
        { path: 'verifier/:code?', name: 'verifier', component: () => import('./views/public/Verifier.vue'), props: true },
        { path: 'espace', name: 'espace', component: () => import('./views/public/Espace.vue') },
        { path: ':pathMatch(.*)*', name: '404', component: () => import('./views/public/NotFound.vue') },
      ],
    },
    { path: '/admin/connexion', name: 'admin-login', component: () => import('./views/admin/Login.vue') },
    {
      path: '/admin',
      component: () => import('./views/admin/AdminLayout.vue'),
      meta: { auth: true },
      children: [
        { path: '', name: 'admin-dashboard', component: () => import('./views/admin/Dashboard.vue') },
        { path: 'inscriptions', name: 'admin-inscriptions', component: () => import('./views/admin/Inscriptions.vue') },
        { path: 'listes', name: 'admin-listes', component: () => import('./views/admin/Listes.vue') },
        { path: 'encaissements', name: 'admin-encaissements', component: () => import('./views/admin/Encaissements.vue'), meta: { need: 'finances' } },
        { path: 'tarifs', name: 'admin-tarifs', component: () => import('./views/admin/Tarifs.vue'), meta: { need: 'parametrer' } },
        { path: 'messages', name: 'admin-messages', component: () => import('./views/admin/Messages.vue'), meta: { need: 'sms' } },
        { path: 'utilisateurs', name: 'admin-users', component: () => import('./views/admin/Utilisateurs.vue'), meta: { need: 'utilisateurs' } },
        { path: 'audit', name: 'admin-audit', component: () => import('./views/admin/Audit.vue'), meta: { need: 'audit' } },
      ],
    },
  ],
})

router.beforeEach((to) => {
  if (to.matched.some((r) => r.meta.auth) && !adminState.user) return { name: 'admin-login', query: { redirect: to.fullPath } }
  return true
})
router.afterEach((to) => {
  const base = 'Inscriptions en ligne · Collège Vogt'
  document.title = to.meta.title ? `${to.meta.title} · ${base}` : base
})
