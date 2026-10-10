<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { db, log } from '../../api'
import { sms as sendSms } from '../../api/domain'
import { groupes, lignes } from '../../api/queries'
import { adminState, offresVisibles } from '../../composables/adminAuth'
import { fmtDateTime } from '../../lib/i18n'
import { formatPhone } from '../../lib/phone'
import { toast } from '../../composables/toast'
import { OFFRES } from '../../lib/types'
import type { OffreCode } from '../../lib/types'

const offre = ref<OffreCode>(offresVisibles.value[0] ?? 'CRN')
const key = ref('all')
const message = ref('')
const gs = computed(() => groupes(offre.value))
watch(offre, () => (key.value = 'all'))
const dest = computed(() => {
  const set = new Map<string, string>()
  for (const l of lignes([offre.value])) if (l.ins.statut === 'CONFIRMEE' && (key.value === 'all' || l.ins.groupe === key.value)) set.set(l.commande.payeur.tel, l.commande.payeur.nom)
  return [...set.entries()]
})
const parts = computed(() => Math.max(1, Math.ceil(message.value.length / 160)))
const MODELES = [
  'Collège Vogt : changement d’horaire, les cours de ce samedi débuteront à 9 h.',
  'Collège Vogt : rappel, la session débute lundi. Merci de vous présenter avec votre facture.',
]
const sent = computed(() => db.messages.filter((m) => m.canal === 'SMS').slice(0, 8))
const confirmOpen = ref(false)
function envoyer() {
  dest.value.forEach(([tel]) => sendSms(db, 'SMS', tel, message.value))
  log(db, adminState.user?.nom ?? '?', 'SMS_GROUPE', `${OFFRES[offre.value].libelle} · ${dest.value.length} destinataires`, undefined, message.value.slice(0, 80))
  toast('success', 'SMS envoyés', `${dest.value.length} payeur${dest.value.length > 1 ? 's' : ''} prévenu${dest.value.length > 1 ? 's' : ''}.`)
  message.value = ''; confirmOpen.value = false
}
</script>

<template>
  <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
    <section class="card card-pad">
      <h2 class="text-xl">Envoyer un SMS groupé</h2>
      <p class="mt-1 text-sm text-slate-600">Changement d’horaire, rappel… Le message part aux payeurs des inscriptions confirmées de la liste choisie.</p>
      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div><label for="mo" class="label">Offre</label><select id="mo" v-model="offre" class="input"><option v-for="o in offresVisibles" :key="o" :value="o">{{ OFFRES[o].libelle }}</option></select></div>
        <div><label for="mg" class="label">Liste</label><select id="mg" v-model="key" class="input"><option value="all">Toute l’offre</option><option v-for="g in gs.filter((x) => x.used > 0)" :key="g.key" :value="g.key">{{ g.label }}</option></select></div>
      </div>
      <div class="mt-5">
        <label for="mm" class="label">Message</label>
        <textarea id="mm" v-model="message" rows="5" maxlength="480" class="input resize-none" placeholder="Rédigez votre message…" />
        <div class="mt-1.5 flex justify-between text-xs text-slate-500"><span>{{ parts }} SMS</span><span class="tabular">{{ message.length }}/480</span></div>
        <div class="mt-3 flex flex-wrap gap-2"><button v-for="m in MODELES" :key="m" type="button" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-left text-xs text-slate-600 hover:border-navy-300 hover:bg-navy-50" @click="message = m">{{ m.slice(0, 48) }}…</button></div>
      </div>
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-50 p-4">
        <p class="flex items-center gap-2 text-sm text-navy-800"><Icon name="users" :size="18" /><strong class="tabular">{{ dest.length }}</strong> destinataire{{ dest.length > 1 ? 's' : '' }}</p>
        <button class="btn-primary" :disabled="!message.trim() || !dest.length" @click="confirmOpen = true"><Icon name="send" :size="17" />Envoyer</button>
      </div>
      <div v-if="confirmOpen" class="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4" role="alertdialog" aria-label="Confirmation d’envoi">
        <p class="text-sm font-semibold text-amber-900">Envoyer ce message à {{ dest.length }} destinataire(s) ?</p>
        <p class="mt-1 rounded-lg bg-white p-3 text-sm text-slate-700">{{ message }}</p>
        <div class="mt-3 flex gap-2"><button class="btn-primary btn-sm" @click="envoyer">Confirmer l’envoi</button><button class="btn-outline btn-sm bg-white" @click="confirmOpen = false">Annuler</button></div>
      </div>
    </section>
    <aside class="space-y-4">
      <div class="card p-5"><h3 class="text-sm uppercase tracking-wider text-gold-700">Aperçu sur téléphone</h3>
        <div class="mt-3 rounded-3xl bg-slate-100 p-4"><div class="max-w-[85%] rounded-2xl rounded-bl-md bg-white p-3 text-sm leading-snug text-slate-800 shadow-sm">{{ message || 'Votre message apparaîtra ici.' }}</div><p class="mt-1 pl-1 text-[11px] text-slate-400">Collège Vogt · maintenant</p></div></div>
      <div class="card overflow-hidden"><h3 class="border-b border-slate-100 p-4 text-sm">Derniers SMS</h3>
        <ul class="max-h-80 divide-y divide-slate-100 overflow-y-auto"><li v-for="m in sent" :key="m.id" class="px-4 py-3 text-xs"><p class="flex justify-between text-slate-500"><span>{{ formatPhone(m.destinataire) }}</span><span>{{ fmtDateTime(m.date) }}</span></p><p class="mt-1 line-clamp-2 text-slate-700">{{ m.message }}</p></li></ul></div>
    </aside>
  </div>
</template>
