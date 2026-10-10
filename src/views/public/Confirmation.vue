<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import Invoice from '../../components/Invoice.vue'
import { db, getCommande, sandboxWebhook } from '../../api'
import { fcfa } from '../../lib/money'
import { printElement } from '../../lib/print'
import { maskPhone } from '../../lib/phone'
import { fmtDate, t } from '../../lib/i18n'
import { OFFRES } from '../../lib/types'

const props = defineProps<{ id: string }>()
onMounted(() => getCommande(props.id))
const commande = computed(() => db.commandes.find((c) => c.id === props.id))
const paiement = computed(() => db.paiements.find((p) => p.commandeId === props.id && p.statut === 'REUSSIE' || p.commandeId === props.id && p.statut === 'REMBOURSEE'))
const facture = computed(() => db.factures.find((f) => f.commandeId === props.id))
const avoirs = computed(() => db.avoirs.filter((a) => a.factureNumero === facture.value?.numero))
const messages = computed(() => db.messages.filter((m) => m.message.includes(facture.value?.numero ?? '§')).slice(0, 2))
const waiting = computed(() => commande.value?.statut === 'LISTE_ATTENTE')
const replayMsg = ref('')
async function replay() {
  if (!paiement.value) return
  replayMsg.value = (await sandboxWebhook(paiement.value.id, 'rejeu')).message
}
const lien = computed(() => (facture.value ? `${location.origin}/facture/${facture.value.code}` : ''))
const copied = ref(false)
async function copy() {
  try { await navigator.clipboard.writeText(lien.value); copied.value = true; setTimeout(() => (copied.value = false), 2000) } catch { /* ignore */ }
}
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <div v-if="!commande" class="card card-pad mx-auto max-w-lg text-center">
      <Icon name="alert" :size="32" class="mx-auto text-amber-600" /><h1 class="mt-3 text-xl">{{ t('pay.notFound') }}</h1>
      <RouterLink :to="{ name: 'home' }" class="btn-primary mt-5">{{ t('common.home') }}</RouterLink>
    </div>

    <!-- Liste d'attente -->
    <div v-else-if="waiting" class="mx-auto max-w-2xl">
      <div class="card card-pad text-center">
        <span class="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold-100 text-gold-700"><Icon name="clock" :size="38" /></span>
        <h1 class="mt-5 text-3xl">{{ t('conf.waitTitle') }}</h1>
        <p class="mx-auto mt-3 max-w-md text-slate-600">{{ t('conf.waitText') }}</p>
        <ul class="mx-auto mt-6 max-w-sm divide-y divide-slate-100 rounded-2xl border border-slate-200 text-left text-sm">
          <li v-for="l in commande.devis.attente" :key="l.participantId + l.libelle" class="flex justify-between gap-3 p-3"><span>{{ l.libelle }}<span class="block text-xs text-slate-500">{{ l.participantNom }}</span></span><span class="chip-gold self-center">{{ t('s3.waitlist') }}</span></li>
        </ul>
        <p class="mt-4 text-sm text-slate-500">{{ t('conf.waitSms', { n: maskPhone(commande.payeur.tel) }) }}</p>
        <RouterLink :to="{ name: 'home' }" class="btn-primary mt-6">{{ t('common.home') }}</RouterLink>
      </div>
    </div>

    <!-- En attente de confirmation -->
    <div v-else-if="!facture" class="card card-pad mx-auto max-w-lg text-center">
      <Icon name="clock" :size="32" class="mx-auto text-amber-600" /><h1 class="mt-3 text-xl">{{ t('conf.notPaid') }}</h1>
      <RouterLink :to="{ name: 'paiement', params: { id: commande.id } }" class="btn-gold mt-5">{{ t('conf.goPay') }}</RouterLink>
    </div>

    <template v-else>
      <div class="mx-auto max-w-3xl text-center">
        <span class="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-100">
          <span class="absolute inset-0 animate-ping rounded-full bg-emerald-200/60 [animation-iteration-count:2]" />
          <span class="relative grid h-[4.5rem] w-[4.5rem] animate-pop place-items-center rounded-full bg-emerald-600 text-white shadow-lg">
            <svg viewBox="0 0 24 24" class="h-10 w-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.500l4.500 4.500L19 7.500" stroke-dasharray="26" stroke-dashoffset="26" class="animate-draw" /></svg>
          </span>
        </span>
        <h1 class="mt-6 text-3xl sm:text-4xl">{{ t('conf.title') }}</h1>
        <p class="mx-auto mt-3 max-w-xl text-slate-600">{{ t('conf.lead', { amount: fcfa(facture.montant) }) }}</p>
        <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span v-for="o in commande.offres" :key="o" class="chip-navy">{{ OFFRES[o].libelle }}</span>
          <span class="chip-green"><Icon name="check" :size="12" />{{ t('conf.confirmed') }}</span>
        </div>
      </div>

      <div class="mx-auto mt-9 grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="inv-h" class="min-w-0">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div><h2 id="inv-h" class="text-lg">{{ t('conf.invoice') }}</h2><p class="font-mono text-sm text-slate-500">{{ facture.numero }}</p></div>
            <div class="flex gap-2">
              <button class="btn-primary btn-sm" @click="printElement('#facture-print', 'A5 landscape')"><Icon name="download" :size="16" />{{ t('conf.download') }}</button>
              <button class="btn-outline btn-sm" @click="printElement('#facture-print', 'A5 landscape')"><Icon name="printer" :size="16" />{{ t('conf.print') }}</button>
            </div>
          </div>
          <div id="facture-print" class="overflow-hidden rounded-xl bg-slate-200/60 p-2 sm:p-4">
            <Invoice v-if="paiement" :facture="facture" :commande="commande" :paiement="paiement" :avoirs="avoirs" />
          </div>
          <p class="mt-3 text-xs text-slate-500">{{ t('conf.pdfNote') }}</p>
        </section>

        <div class="space-y-4">
          <div class="card p-5">
            <h2 class="flex items-center gap-2 text-base"><Icon name="message" :size="18" class="text-navy-600" />{{ t('conf.sent') }}</h2>
            <ul class="mt-3 space-y-3 text-sm">
              <li class="flex gap-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><Icon name="phone" :size="16" /></span><span class="text-slate-600">SMS · {{ maskPhone(commande.payeur.tel) }}</span></li>
              <li v-if="commande.payeur.email" class="flex gap-3"><span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><Icon name="mail" :size="16" /></span><span class="min-w-0 truncate text-slate-600">E-mail · {{ commande.payeur.email }}</span></li>
            </ul>
            <div v-if="messages[0]" class="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><p class="mb-1 font-semibold text-slate-500">{{ t('conf.smsPreview') }}</p>{{ messages[0].message }}</div>
            <button class="btn-outline btn-sm mt-4 w-full" @click="copy"><Icon :name="copied ? 'check' : 'receipt'" :size="16" />{{ copied ? t('conf.copied') : t('conf.copy') }}</button>
          </div>

          <div class="card p-5">
            <h2 class="flex items-center gap-2 text-base"><Icon name="calendar" :size="18" class="text-navy-600" />{{ t('conf.next') }}</h2>
            <ul class="mt-3 space-y-3 text-sm text-slate-600">
              <li v-for="o in commande.offres" :key="o" class="flex gap-3"><Icon name="check" :size="16" class="mt-0.5 text-emerald-600" /><span>{{ t(`conf.next.${o}`, { d: fmtDate(db.sessions.find((s) => s.offre === o)?.debut ?? '') }) }}</span></li>
            </ul>
          </div>

          <div class="flex gap-2">
            <RouterLink :to="{ name: 'espace' }" class="btn-outline flex-1"><Icon name="user" :size="17" />{{ t('nav.space') }}</RouterLink>
            <RouterLink :to="{ name: 'inscription' }" class="btn-primary flex-1"><Icon name="plus" :size="17" />{{ t('conf.another') }}</RouterLink>
          </div>

          <details class="rounded-2xl border border-dashed border-gold-400 bg-gold-50/60 p-4 text-sm">
            <summary class="cursor-pointer font-semibold text-navy-900">{{ t('sbx.title') }}</summary>
            <p class="mt-2 text-xs text-gold-900">{{ t('sbx.replayText') }}</p>
            <button class="btn-outline btn-sm mt-3 w-full bg-white" @click="replay"><Icon name="refresh" :size="16" />{{ t('sbx.replay') }}</button>
            <p v-if="replayMsg" class="mt-2 rounded-lg bg-white p-3 text-xs text-slate-700">{{ replayMsg }}</p>
          </details>
        </div>
      </div>
    </template>
  </div>
</template>
