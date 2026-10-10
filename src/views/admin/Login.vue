<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import { ApiError, DEMO_TOTP, adminLogin } from '../../api'
import { DEMO_USERS } from '../../api/seed'
import { setAdmin } from '../../composables/adminAuth'

const router = useRouter()
const route = useRoute()
const email = ref('')
const pwd = ref('')
const otp = ref('')
const err = ref('')
const busy = ref(false)
const show = ref(false)

async function submit() {
  err.value = ''
  busy.value = true
  try {
    const u = await adminLogin(email.value, pwd.value, otp.value)
    setAdmin(u)
    router.replace((route.query.redirect as string) || { name: 'admin-dashboard' })
  } catch (e) { err.value = e instanceof ApiError ? e.message : 'Erreur de connexion.' }
  busy.value = false
}
function fill(u: (typeof DEMO_USERS)[number]) { email.value = u.email; pwd.value = u.motDePasse; otp.value = DEMO_TOTP }
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
    <aside class="on-dark relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div class="absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
      <div class="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-gold-500/20 blur-3xl" aria-hidden="true" />
      <Logo dark class="relative" />
      <div class="relative max-w-md">
        <h1 class="text-4xl font-bold leading-tight !text-white">Pilotez les inscriptions et les encaissements du collège.</h1>
        <ul class="mt-8 space-y-4 text-navy-100">
          <li class="flex gap-3"><Icon name="list" class="mt-0.5 text-gold-300" />Listes par classe, catégorie et module, prêtes à exporter</li>
          <li class="flex gap-3"><Icon name="wallet" class="mt-0.5 text-gold-300" />Encaissements MTN et Orange rapprochés chaque nuit</li>
          <li class="flex gap-3"><Icon name="shield" class="mt-0.5 text-gold-300" />Comptes nominatifs, double authentification, journal d’audit</li>
        </ul>
      </div>
      <p class="relative text-sm italic text-gold-300">Per ardua ad astra</p>
    </aside>

    <main class="flex items-center justify-center px-5 py-10 sm:px-10">
      <div class="w-full max-w-md">
        <Logo class="mb-8 lg:hidden" />
        <h2 class="text-3xl">Espace d’administration</h2>
        <p class="mt-2 text-slate-600">Connexion réservée au personnel habilité.</p>
        <form class="mt-8 space-y-5" novalidate @submit.prevent="submit">
          <div><label for="em" class="label">Adresse e-mail</label><input id="em" v-model="email" type="email" autocomplete="username" class="input" required /></div>
          <div>
            <label for="pw" class="label">Mot de passe</label>
            <div class="relative"><input id="pw" v-model="pwd" :type="show ? 'text' : 'password'" autocomplete="current-password" class="input pr-12" required />
              <button type="button" class="absolute inset-y-0 right-1.5 grid w-10 place-items-center text-slate-400 hover:text-slate-700" :aria-label="show ? 'Masquer' : 'Afficher'" @click="show = !show"><Icon name="eye" :size="19" /></button></div>
          </div>
          <div>
            <label for="otp" class="label">Code de double authentification</label>
            <input id="otp" v-model="otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="input font-mono tracking-[.4em]" placeholder="••••••" aria-describedby="otp-h" />
            <p id="otp-h" class="hint">Code à 6 chiffres de votre application d’authentification. Sans ce second facteur, l’accès est refusé.</p>
          </div>
          <p v-if="err" class="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert"><Icon name="alert" :size="18" class="mt-0.5 shrink-0" />{{ err }}</p>
          <button class="btn-primary btn-lg w-full" :disabled="busy">{{ busy ? 'Vérification…' : 'Se connecter' }}</button>
        </form>

        <div class="mt-8 rounded-2xl border border-dashed border-gold-400 bg-gold-50/60 p-4">
          <p class="flex items-center gap-2 text-sm font-semibold text-navy-900"><Icon name="bolt" :size="16" />Comptes de démonstration</p>
          <p class="mt-1 text-xs text-gold-900">Cliquez pour préremplir (code 2FA : {{ DEMO_TOTP }}).</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button v-for="u in DEMO_USERS" :key="u.id" type="button" class="rounded-lg border border-gold-300 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-800 hover:bg-gold-100" @click="fill(u)">{{ u.nom.split(' · ')[0] }}</button>
          </div>
        </div>
        <RouterLink :to="{ name: 'home' }" class="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-700 hover:underline"><Icon name="arrow-left" :size="16" />Retour au site public</RouterLink>
      </div>
    </main>
  </div>
</template>
