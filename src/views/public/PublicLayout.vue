<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import LegalModal from '../../components/LegalModal.vue'
import { locale, setLocale, t } from '../../lib/i18n'
import { resetDemo } from '../../api'
import { resetDraft } from '../../composables/draft'
import { toast } from '../../composables/toast'

const open = ref(false)
const legal = ref<'cgu' | 'donnees' | null>(null)
const route = useRoute()
watch(() => route.fullPath, () => (open.value = false))

function reset() {
  if (!confirm(t('demo.confirmReset'))) return
  resetDemo(); resetDraft(); toast('success', t('demo.resetDone'))
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg pt-safe">
      <div class="container-page flex h-16 items-center justify-between gap-4">
        <RouterLink to="/" aria-label="Accueil"><Logo /></RouterLink>
        <nav class="hidden items-center gap-1 lg:flex" :aria-label="t('nav.main')">
          <RouterLink :to="{ name: 'home', hash: '#offres' }" class="btn-ghost btn-sm">{{ t('nav.offers') }}</RouterLink>
          <RouterLink :to="{ name: 'home', hash: '#etapes' }" class="btn-ghost btn-sm">{{ t('nav.how') }}</RouterLink>
          <RouterLink :to="{ name: 'home', hash: '#faq' }" class="btn-ghost btn-sm">{{ t('nav.faq') }}</RouterLink>
          <RouterLink :to="{ name: 'espace' }" class="btn-ghost btn-sm"><Icon name="user" :size="16" />{{ t('nav.space') }}</RouterLink>
          <RouterLink :to="{ name: 'verifier' }" class="btn-ghost btn-sm"><Icon name="qr" :size="16" />{{ t('nav.verify') }}</RouterLink>
        </nav>
        <div class="flex items-center gap-2">
          <div class="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold" role="group" :aria-label="t('nav.language')">
            <button v-for="l in (['fr', 'en'] as const)" :key="l" class="min-h-[34px] min-w-[40px] rounded-lg px-2 uppercase transition"
              :class="locale === l ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-800'" :aria-pressed="locale === l" @click="setLocale(l)">{{ l }}</button>
          </div>
          <RouterLink :to="{ name: 'inscription' }" class="btn-primary btn-sm hidden sm:inline-flex">{{ t('nav.register') }}</RouterLink>
          <button class="btn-ghost btn-sm !px-2.5 lg:hidden" :aria-expanded="open" aria-controls="menu-mobile" :aria-label="t('nav.menu')" @click="open = !open">
            <Icon :name="open ? 'x' : 'menu'" :size="22" />
          </button>
        </div>
      </div>
      <Transition name="slide">
        <nav v-if="open" id="menu-mobile" class="border-t border-slate-100 bg-white lg:hidden" :aria-label="t('nav.main')">
          <div class="container-page grid gap-1 py-3">
            <RouterLink :to="{ name: 'home', hash: '#offres' }" class="btn-ghost justify-start">{{ t('nav.offers') }}</RouterLink>
            <RouterLink :to="{ name: 'home', hash: '#etapes' }" class="btn-ghost justify-start">{{ t('nav.how') }}</RouterLink>
            <RouterLink :to="{ name: 'home', hash: '#faq' }" class="btn-ghost justify-start">{{ t('nav.faq') }}</RouterLink>
            <RouterLink :to="{ name: 'espace' }" class="btn-ghost justify-start">{{ t('nav.space') }}</RouterLink>
            <RouterLink :to="{ name: 'verifier' }" class="btn-ghost justify-start">{{ t('nav.verify') }}</RouterLink>
            <RouterLink :to="{ name: 'inscription' }" class="btn-primary mt-1">{{ t('nav.register') }}</RouterLink>
          </div>
        </nav>
      </Transition>
    </header>

    <main id="contenu" class="flex-1"><RouterView /></main>

    <footer class="on-dark mt-16 bg-navy-950 text-navy-200 screen-only">
      <div class="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-navy-300">{{ t('footer.about') }}</p>
          <p class="mt-5 font-medium italic text-gold-300">Per ardua ad astra</p>
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wider text-white">{{ t('footer.contact') }}</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li class="flex gap-2.5"><Icon name="pin" :size="17" class="mt-0.5 text-gold-400" />B.P. 703 Yaoundé, Cameroun</li>
            <li class="flex gap-2.5"><Icon name="phone" :size="17" class="mt-0.5 text-gold-400" />+237 222 00 00 00</li>
            <li class="flex gap-2.5"><Icon name="mail" :size="17" class="mt-0.5 text-gold-400" />inscriptions@collegevogt.cm</li>
          </ul>
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wider text-white">{{ t('footer.useful') }}</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><RouterLink :to="{ name: 'espace' }" class="hover:text-white">{{ t('nav.space') }}</RouterLink></li>
            <li><RouterLink :to="{ name: 'verifier' }" class="hover:text-white">{{ t('nav.verify') }}</RouterLink></li>
            <li><button class="hover:text-white" @click="legal = 'cgu'">{{ t('legal.cguTitle') }}</button></li>
            <li><button class="hover:text-white" @click="legal = 'donnees'">{{ t('legal.dataTitle') }}</button></li>
            <li><RouterLink :to="{ name: 'admin-login' }" class="hover:text-white">{{ t('footer.admin') }}</RouterLink></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <div class="container-page flex flex-col items-start justify-between gap-3 py-5 text-xs text-navy-400 sm:flex-row sm:items-center">
          <p>© 2026 {{ t('footer.rights') }}</p>
          <button class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-navy-300 hover:bg-white/5 hover:text-white" @click="reset"><Icon name="refresh" :size="14" />{{ t('demo.reset') }}</button>
        </div>
      </div>
    </footer>
    <LegalModal :kind="legal" @close="legal = null" />
  </div>
</template>
