<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import FormField from '../../components/FormField.vue'
import PhoneInput from '../../components/PhoneInput.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { ApiError, DEMO_OTP, db, demanderCode, espaceDe, verifierCode } from '../../api'
import { fcfa } from '../../lib/money'
import { isValidMobile, maskPhone, toE164 } from '../../lib/phone'
import { fmtDate, t } from '../../lib/i18n'
import { toast } from '../../composables/toast'
import { OFFRES } from '../../lib/types'

const KEY = 'vogt.espace'
const saved = (() => { try { return sessionStorage.getItem(KEY) } catch { return null } })()
const phase = ref<'phone' | 'code' | 'space'>(saved ? 'space' : 'phone')
const tel = ref(saved ? saved.replace('+237', '') : '')
const code = ref('')
const err = ref('')
const busy = ref(false)
const resend = ref(0)
let timer = 0

const data = computed(() => (phase.value === 'space' ? espaceDe(toE164(tel.value)) : null))

function startTimer() {
  resend.value = 30
  window.clearInterval(timer)
  timer = window.setInterval(() => { resend.value -= 1; if (resend.value <= 0) window.clearInterval(timer) }, 1000)
}
onBeforeUnmount(() => window.clearInterval(timer))

async function send() {
  err.value = ''
  if (!isValidMobile(tel.value)) { err.value = t('err.phone'); return }
  busy.value = true
  await demanderCode(tel.value)
  busy.value = false
  phase.value = 'code'; code.value = ''
  startTimer()
  toast('info', t('esp.smsSent'), t('esp.demoCode', { c: DEMO_OTP }), 9000)
}
async function verify() {
  err.value = ''
  if (!/^\d{6}$/.test(code.value.trim())) { err.value = t('esp.codeFormat'); return }
  busy.value = true
  try {
    await verifierCode(tel.value, code.value)
    try { sessionStorage.setItem(KEY, toE164(tel.value)) } catch { /* ignore */ }
    phase.value = 'space'
  } catch (e) { err.value = e instanceof ApiError ? e.message : t('err.generic') }
  busy.value = false
}
function logout() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  phase.value = 'phone'; tel.value = ''; code.value = ''
}
const factureDe = (cid: string) => db.factures.find((f) => f.commandeId === cid)
</script>

<template>
  <div class="container-page py-10 sm:py-14">
    <div v-if="phase !== 'space'" class="mx-auto max-w-md">
      <div class="text-center">
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy-900 text-gold-300"><Icon name="user" :size="28" /></span>
        <h1 class="mt-4 text-3xl">{{ t('esp.title') }}</h1>
        <p class="mt-2 text-slate-600">{{ phase === 'phone' ? t('esp.lead') : t('esp.codeLead', { n: maskPhone(toE164(tel)) }) }}</p>
      </div>
      <form class="card card-pad mt-8" @submit.prevent="phase === 'phone' ? send() : verify()">
        <FormField v-if="phase === 'phone'" v-slot="s" :label="t('esp.phone')" name="espTel" :error="err" :hint="t('esp.noPassword')">
          <PhoneInput :id="s.id" v-model="tel" :invalid="s.invalid" :describedby="s.describedby" />
        </FormField>
        <FormField v-else v-slot="s" :label="t('esp.code')" name="espCode" :error="err" :hint="t('esp.codeHint')">
          <input :id="s.id" v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="input text-center font-mono text-2xl tracking-[.5em]" :aria-invalid="s.invalid" placeholder="••••••" />
        </FormField>
        <button class="btn-primary btn-lg mt-6 w-full" :disabled="busy">{{ busy ? '…' : phase === 'phone' ? t('esp.sendCode') : t('esp.signIn') }}</button>
        <div v-if="phase === 'code'" class="mt-4 flex items-center justify-between text-sm">
          <button type="button" class="font-medium text-navy-700 hover:underline" @click="phase = 'phone'">{{ t('esp.changeNumber') }}</button>
          <button type="button" class="font-medium text-navy-700 hover:underline disabled:text-slate-400 disabled:no-underline" :disabled="resend > 0" @click="send">{{ resend > 0 ? t('esp.resendIn', { n: resend }) : t('esp.resend') }}</button>
        </div>
      </form>
    </div>

    <div v-else-if="data" class="mx-auto max-w-4xl">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div><p class="section-eyebrow">{{ t('nav.space') }}</p><h1 class="mt-1 text-3xl">{{ t('esp.hello') }}</h1><p class="mt-1 text-slate-600">{{ maskPhone(data.tel) }}</p></div>
        <div class="flex gap-2"><RouterLink :to="{ name: 'inscription' }" class="btn-primary btn-sm"><Icon name="plus" :size="16" />{{ t('conf.another') }}</RouterLink><button class="btn-outline btn-sm" @click="logout"><Icon name="logout" :size="16" />{{ t('esp.logout') }}</button></div>
      </div>

      <div v-if="!data.commandes.length" class="card mt-8 p-10 text-center">
        <Icon name="receipt" :size="36" class="mx-auto text-slate-300" /><h2 class="mt-3 text-lg">{{ t('esp.empty') }}</h2><p class="mt-1 text-sm text-slate-500">{{ t('esp.emptyText') }}</p>
      </div>
      <div class="mt-8 space-y-4">
        <article v-for="c in data.commandes" :key="c.id" class="card overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <div class="flex flex-wrap items-center gap-2"><span v-for="o in c.offres" :key="o" class="chip-navy">{{ OFFRES[o].libelle }}</span><StatusBadge :s="c.statut" /></div>
            <p class="text-xs text-slate-500">{{ fmtDate(c.creeLe, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</p>
          </div>
          <div class="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <ul class="space-y-1.5 text-sm">
              <li v-for="p in c.participants" :key="p.id" class="flex items-center gap-2"><Icon name="user" :size="15" class="text-slate-400" /><span class="font-medium text-navy-900">{{ p.nom }} {{ p.prenoms }}</span><span class="text-slate-500">· {{ p.choix.map((id) => db.prestations.find((x) => x.id === id)?.libelle).filter(Boolean).join(', ') }}</span></li>
            </ul>
            <div class="flex flex-wrap items-center gap-3 sm:justify-end">
              <p class="tabular text-lg font-bold text-navy-900">{{ fcfa(c.devis.aPayer) }}</p>
              <RouterLink v-if="factureDe(c.id)" :to="{ name: 'facture', params: { code: factureDe(c.id)!.code } }" class="btn-primary btn-sm"><Icon name="receipt" :size="16" />{{ factureDe(c.id)!.numero.slice(-14) }}</RouterLink>
              <RouterLink v-else-if="c.statut === 'EN_ATTENTE_PAIEMENT'" :to="{ name: 'paiement', params: { id: c.id } }" class="btn-gold btn-sm">{{ t('conf.goPay') }}</RouterLink>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
