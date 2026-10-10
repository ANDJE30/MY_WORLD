<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { db, log } from '../../api'
import { sms as smsLog } from '../../api/domain'
import { groupes, lignes } from '../../api/queries'
import { adminState, offresVisibles } from '../../composables/adminAuth'
import { exportCsv, exportExcel } from '../../lib/export'
import { printElement } from '../../lib/print'
import { formatPhone } from '../../lib/phone'
import { toast } from '../../composables/toast'
import { OFFRES } from '../../lib/types'
import type { OffreCode } from '../../lib/types'

const offre = ref<OffreCode>(offresVisibles.value[0] ?? 'CRN')
const key = ref('')
const onglet = ref<'inscrits' | 'attente'>('inscrits')
const gs = computed(() => groupes(offre.value))
watch([gs, offre], () => { if (!gs.value.find((g) => g.key === key.value)) key.value = gs.value.find((g) => g.used > 0)?.key ?? gs.value[0]?.key ?? '' }, { immediate: true })
const g = computed(() => gs.value.find((x) => x.key === key.value))
const q = ref('')
const all = computed(() => lignes([offre.value]).filter((l) => l.ins.groupe === key.value))
const inscrits = computed(() => all.value.filter((l) => l.ins.statut === 'CONFIRMEE'))
const attente = computed(() => all.value.filter((l) => l.ins.statut === 'LISTE_ATTENTE'))
const places = computed(() => (g.value ? g.value.max - g.value.used : 0))
const filteredGroups = computed(() => gs.value.filter((x) => x.label.toLowerCase().includes(q.value.toLowerCase())))
const rows = computed(() => (onglet.value === 'inscrits' ? inscrits.value : attente.value))

const head = computed(() => {
  const base = ['N°', 'Nom et prénoms', 'Sexe', 'Naissance']
  if (offre.value === 'SPT') return [...base, 'Parent', 'Téléphone parent', 'Contact d’urgence', 'Tél. urgence']
  if (offre.value === 'INF') return ['N°', 'Nom et prénoms', 'Profession', 'Téléphone', 'Payeur', 'Téléphone payeur']
  return [...base, 'Parent', 'Téléphone parent', 'Établissement']
})
function tel(v?: string) { return v ? formatPhone(v.startsWith('+') ? v : '+237' + v) : '' }
const data = computed(() => rows.value.map((l, i) => {
  const p = l.participant
  if (offre.value === 'SPT') return [i + 1, l.nom, p.sexe, p.naissance, p.parentNom, tel(p.parentTel), p.urgenceNom ?? '', tel(p.urgenceTel)]
  if (offre.value === 'INF') return [i + 1, l.nom, p.profession ?? '', tel(p.tel), l.commande.payeur.nom, tel(l.commande.payeur.tel)]
  return [i + 1, l.nom, p.sexe, p.naissance, p.parentNom, tel(p.parentTel), p.etablissement || 'Collège Vogt']
}))
function exp(kind: 'csv' | 'xls' | 'pdf') {
  const name = `liste-${(g.value?.label ?? '').replace(/[^\p{L}\d]+/gu, '-')}`
  if (kind === 'csv') exportCsv(name, head.value, data.value)
  else if (kind === 'xls') exportExcel(name, head.value, data.value)
  else printElement('#liste-print', 'A4 landscape')
  log(db, adminState.user?.nom ?? '?', 'EXPORT', `Liste ${g.value?.label} (${kind.toUpperCase()})`)
}
function notifier(l: (typeof attente.value)[number]) {
  if (places.value <= 0) { toast('error', 'Aucune place libre', 'Libérez une place avant de prévenir une personne en liste d’attente.'); return }
  smsLog(db, 'SMS', l.commande.payeur.tel, `Collège Vogt : une place s'est libérée en ${l.groupeLabel} pour ${l.nom}. Finalisez l'inscription sur le site.`)
  l.ins.notifie = true
  log(db, adminState.user?.nom ?? '?', 'LISTE_ATTENTE_NOTIFIEE', `${l.nom} · ${l.groupeLabel}`)
  toast('success', 'SMS envoyé', `${l.commande.payeur.nom} a été prévenu(e).`)
}
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <div class="mb-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Offre">
      <button v-for="o in offresVisibles" :key="o" role="tab" :aria-selected="offre === o" class="btn btn-sm" :class="offre === o ? 'bg-navy-800 text-white' : 'border border-slate-300 bg-white text-navy-800 hover:bg-navy-50'" @click="offre = o">{{ OFFRES[o].libelle }}</button>
    </div>
    <div class="grid gap-5 lg:grid-cols-[19rem_1fr]">
      <aside class="card overflow-hidden lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto">
        <div class="sticky top-0 z-10 border-b border-slate-100 bg-white p-3"><div class="relative"><Icon name="search" :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="q" class="input !min-h-[42px] pl-9 text-sm" placeholder="Filtrer les groupes" aria-label="Filtrer les groupes" /></div></div>
        <ul class="max-h-80 overflow-y-auto lg:max-h-none">
          <li v-for="x in filteredGroups" :key="x.key">
            <button class="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-navy-50" :class="key === x.key ? 'bg-navy-50 shadow-[inset_3px_0_0_#d4a02a]' : ''" @click="key = x.key">
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-navy-900">{{ x.label }}</span>
              <span class="tabular text-xs font-semibold" :class="x.used >= x.max ? 'text-red-700' : 'text-slate-500'">{{ x.used }}/{{ x.max }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <section v-if="g" class="card min-w-0 overflow-hidden">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div><h2 class="text-lg">{{ g.label }}</h2><p class="mt-0.5 text-sm text-slate-500">{{ g.used }} place{{ g.used > 1 ? 's' : '' }} attribuée{{ g.used > 1 ? 's' : '' }} sur {{ g.max }} · <span :class="places <= 0 ? 'font-semibold text-red-700' : ''">{{ places > 0 ? `${places} libre${places > 1 ? 's' : ''}` : 'complet' }}</span></p></div>
          <div class="flex gap-2"><button class="btn-outline btn-sm" @click="exp('csv')"><Icon name="download" :size="16" />CSV</button><button class="btn-outline btn-sm" @click="exp('xls')"><Icon name="download" :size="16" />Excel</button><button class="btn-primary btn-sm" @click="exp('pdf')"><Icon name="printer" :size="16" />PDF</button></div>
        </div>
        <div class="flex gap-1 border-b border-slate-100 px-3 pt-2" role="tablist">
          <button role="tab" :aria-selected="onglet === 'inscrits'" class="relative px-4 py-2.5 text-sm font-semibold" :class="onglet === 'inscrits' ? 'text-navy-900' : 'text-slate-500 hover:text-navy-800'" @click="onglet = 'inscrits'">Inscrits <span class="chip-slate ml-1">{{ inscrits.length }}</span><span v-if="onglet === 'inscrits'" class="absolute inset-x-3 -bottom-px h-0.5 rounded bg-gold-500" /></button>
          <button role="tab" :aria-selected="onglet === 'attente'" class="relative px-4 py-2.5 text-sm font-semibold" :class="onglet === 'attente' ? 'text-navy-900' : 'text-slate-500 hover:text-navy-800'" @click="onglet = 'attente'">Liste d’attente <span class="chip-gold ml-1">{{ attente.length }}</span><span v-if="onglet === 'attente'" class="absolute inset-x-3 -bottom-px h-0.5 rounded bg-gold-500" /></button>
        </div>
        <div id="liste-print" class="overflow-x-auto">
          <h3 class="print-only" style="font: 600 16px Poppins, sans-serif; margin-bottom: 8px">{{ g.label }} — {{ onglet === 'inscrits' ? 'Inscrits' : 'Liste d’attente' }}</h3>
          <table class="tbl min-w-[720px]">
            <thead><tr><th v-for="h in head" :key="h">{{ h }}</th><th v-if="onglet === 'attente'" class="screen-only"><span class="sr-only">Action</span></th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in data" :key="i"><td v-for="(c, k) in r" :key="k" :class="k === 0 ? 'tabular text-slate-400' : k === 1 ? 'font-medium text-navy-900' : 'text-slate-700'">{{ c }}</td>
                <td v-if="onglet === 'attente'" class="screen-only text-right"><span v-if="rows[i].ins.notifie" class="chip-green">Prévenu(e)</span><button v-else class="btn-outline btn-sm" @click="notifier(rows[i])"><Icon name="send" :size="15" />Prévenir</button></td></tr>
              <tr v-if="!data.length"><td :colspan="head.length + 1" class="py-14 text-center text-slate-500">{{ onglet === 'inscrits' ? 'Aucun inscrit dans ce groupe pour le moment.' : 'Aucune demande en liste d’attente.' }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <p v-else class="card p-10 text-center text-slate-500">Sélectionnez un groupe.</p>
    </div>
  </div>
</template>
