<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import { adminState, can, setAdmin } from '../../composables/adminAuth'
import { ROLE_LABEL } from '../../api'

const route = useRoute()
const router = useRouter()
const open = ref(false)
watch(() => route.fullPath, () => (open.value = false))

const items = computed(() => [
  { to: 'admin-dashboard', label: 'Tableau de bord', icon: 'dashboard', ok: true },
  { to: 'admin-inscriptions', label: 'Inscriptions', icon: 'users', ok: true },
  { to: 'admin-listes', label: 'Listes et groupes', icon: 'list', ok: can.listes() },
  { to: 'admin-encaissements', label: 'Encaissements', icon: 'wallet', ok: can.finances() },
  { to: 'admin-tarifs', label: 'Sessions et tarifs', icon: 'settings', ok: can.parametrer() },
  { to: 'admin-messages', label: 'SMS groupés', icon: 'message', ok: can.sms() },
  { to: 'admin-users', label: 'Comptes et droits', icon: 'lock', ok: can.utilisateurs() },
  { to: 'admin-audit', label: 'Journal d’audit', icon: 'history', ok: can.audit() },
].filter((i) => i.ok))

function logout() { setAdmin(null); router.replace({ name: 'admin-login' }) }
const current = computed(() => items.value.find((i) => i.to === route.name)?.label ?? '')
const initials = computed(() => (adminState.user?.nom ?? '?').split(/[\s·]+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase())
</script>

<template>
  <div class="flex min-h-dvh bg-slate-100/70">
    <div v-if="open" class="fixed inset-0 z-40 bg-navy-950/50 backdrop-blur-sm lg:hidden" @click="open = false" />
    <aside class="on-dark fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col bg-navy-900 text-navy-100 transition-transform duration-200 lg:translate-x-0" :class="{ '!translate-x-0': open }" aria-label="Navigation du back-office">
      <div class="flex h-16 items-center justify-between px-5"><Logo dark /><button class="rounded-lg p-2 text-navy-300 hover:bg-white/10 lg:hidden" aria-label="Fermer le menu" @click="open = false"><Icon name="x" /></button></div>
      <nav class="mt-2 flex-1 space-y-1 overflow-y-auto px-3 scrollbar-thin">
        <RouterLink v-for="i in items" :key="i.to" :to="{ name: i.to }" class="group flex min-h-[46px] items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium transition hover:bg-white/10" active-class="!bg-white/10 !text-white" exact-active-class="" :class="route.name === i.to ? 'bg-white/10 text-white shadow-inner' : ''">
          <Icon :name="i.icon" :size="19" :class="route.name === i.to ? 'text-gold-300' : 'text-navy-300 group-hover:text-gold-300'" />{{ i.label }}
          <span v-if="route.name === i.to" class="ml-auto h-1.5 w-1.5 rounded-full bg-gold-400" />
        </RouterLink>
      </nav>
      <div class="m-3 rounded-2xl bg-white/5 p-3.5">
        <div class="flex items-center gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-400 text-sm font-bold text-navy-950">{{ initials }}</span>
          <div class="min-w-0"><p class="truncate text-sm font-semibold text-white">{{ adminState.user?.nom }}</p><p class="truncate text-xs text-navy-300">{{ adminState.user ? ROLE_LABEL[adminState.user.role] : '' }}</p></div>
        </div>
        <button class="btn mt-3 min-h-[40px] w-full justify-start gap-2 !px-3 text-sm text-navy-200 hover:bg-white/10" @click="logout"><Icon name="logout" :size="17" />Se déconnecter</button>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col lg:pl-72">
      <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-8 pt-safe">
        <button class="btn-ghost btn-sm !px-2.5 lg:hidden" aria-label="Ouvrir le menu" @click="open = true"><Icon name="menu" :size="22" /></button>
        <h1 class="text-lg font-semibold text-navy-900">{{ current }}</h1>
        <div class="ml-auto flex items-center gap-2">
          <RouterLink :to="{ name: 'home' }" class="btn-outline btn-sm"><Icon name="globe" :size="16" /><span class="hidden sm:inline">Site public</span></RouterLink>
        </div>
      </header>
      <main id="contenu" class="flex-1 p-4 sm:p-8">
        <RouterView v-slot="{ Component }"><Transition name="fade" mode="out-in"><component :is="Component" /></Transition></RouterView>
      </main>
    </div>
  </div>
</template>
