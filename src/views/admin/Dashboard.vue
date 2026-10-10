<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { db } from '../../api'
import { groupes, lignes, recettes, startOfDay } from '../../api/queries'
import { offresVisibles } from '../../composables/adminAuth'
import { fcfa, nombre } from '../../lib/money'
import { fmtDateTime } from '../../lib/i18n'
import { OFFRES } from '../../lib/types'
import type { OffreCode } from '../../lib/types'

const COLOR: Record<OffreCode, string> = { CRN: '#1c3b6b', SPT: '#d4a02a', INF: '#059669' }
const periode = ref<'jour' | 'session'>('session')
const offres = computed(() => offresVisibles.value)

const conf = computed(() => lignes(offres.value).filter((l) => l.ins.statut === 'CONFIRMEE'))
const rec = computed(() => recettes(offres.value))
const today = startOfDay()
const inscJour = computed(() => new Set(conf.value.filter((l) => new Date(l.ins.creeLe) >= today).map((l) => l.participant.id + l.commande.id)).size)
const inscTot = computed(() => new Set(conf.value.map((l) => l.participant.id + l.commande.id)).size)
const recJour = computed(() => rec.value.filter((r) => r.date >= today).reduce((a, r) => a + r.montant, 0))
const recTot = computed(() => rec.value.reduce((a, r) => a + r.montant, 0))
const echecs = computed(() => db.paiements.filter((p) => (p.statut === 'ECHOUEE' || p.statut === 'EXPIREE') && db.commandes.find((c) => c.id === p.commandeId)?.offres.some((o) => offres.value.includes(o))).length)
const attente = computed(() => lignes(offres.value).filter((l) => l.ins.statut === 'LISTE_ATTENTE').length)

// Encaissements des 14 derniers jours
const days = computed(() => {
  const out: { d: Date; label: string; v: Record<OffreCode, number>; total: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(new Date(Date.now() - i * 86400000))
    const next = new Date(d.getTime() + 86400000)
    const v = { CRN: 0, SPT: 0, INF: 0 } as Record<OffreCode, number>
    for (const r of rec.value) if (r.date >= d && r.date < next) v[r.offre] += r.montant
    out.push({ d, label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), v, total: v.CRN + v.SPT + v.INF })
  }
  return out
})
const max = computed(() => Math.max(1, ...days.value.map((d) => d.total)))
const niceMax = computed(() => { const m = max.value; const p = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / p) * p })
const hover = ref<number | null>(null)

const parOffre = computed(() => offres.value.map((o) => ({ o, v: rec.value.filter((r) => r.offre === o).reduce((a, r) => a + r.montant, 0), n: new Set(conf.value.filter((l) => l.offre === o).map((l) => l.participant.id + l.commande.id)).size })))
const parOp = computed(() => (['MTN', 'ORANGE'] as const).map((op) => ({ op, v: rec.value.filter((r) => r.operateur === op).reduce((a, r) => a + r.montant, 0) })))
const totOp = computed(() => Math.max(1, parOp.value.reduce((a, b) => a + b.v, 0)))

const critiques = computed(() => offres.value.flatMap((o) => groupes(o)).filter((g) => g.used / g.max >= 0.85).sort((a, b) => b.used / b.max - a.used / a.max).slice(0, 6))
const recents = computed(() => lignes(offres.value).slice(0, 7))

// Donut
const R = 52, C = 2 * Math.PI * R
const arcs = computed(() => {
  const tot = Math.max(1, parOffre.value.reduce((a, b) => a + b.v, 0)); let acc = 0
  return parOffre.value.map((p) => { const len = (p.v / tot) * C; const a = { ...p, len, off: -acc }; acc += len; return a })
})
void periode
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="k in [
        { l: 'Inscriptions du jour', v: inscJour, s: `${inscTot} sur la session`, i: 'users', c: 'bg-navy-100 text-navy-800' },
        { l: 'Encaissements du jour', v: fcfa(recJour), s: `${fcfa(recTot)} sur la session`, i: 'wallet', c: 'bg-gold-100 text-gold-800' },
        { l: 'Paiements non aboutis', v: echecs, s: 'échecs et expirations', i: 'alert', c: 'bg-red-100 text-red-700' },
        { l: 'Listes d’attente', v: attente, s: 'demandes en attente d’une place', i: 'clock', c: 'bg-emerald-100 text-emerald-700' },
      ]" :key="k.l" class="card p-5">
        <div class="flex items-start justify-between"><p class="text-sm font-medium text-slate-500">{{ k.l }}</p><span class="grid h-10 w-10 place-items-center rounded-xl" :class="k.c"><Icon :name="k.i" :size="20" /></span></div>
        <p class="tabular mt-3 text-3xl font-bold tracking-tight text-navy-900">{{ k.v }}</p>
        <p class="mt-1 text-xs text-slate-500">{{ k.s }}</p>
      </article>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
      <section class="card p-5 sm:p-6" aria-labelledby="ch1">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="ch1" class="text-base">Encaissements des 14 derniers jours</h2><p class="text-sm text-slate-500">En FCFA, par offre</p></div>
          <ul class="flex gap-4 text-xs text-slate-600"><li v-for="o in offres" :key="o" class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" :style="{ background: COLOR[o] }" />{{ o }}</li></ul>
        </div>
        <div class="relative mt-6">
          <svg viewBox="0 0 700 250" class="h-auto w-full" role="img" :aria-label="`Encaissements quotidiens, total ${fcfa(days.reduce((a, d) => a + d.total, 0))}`">
            <g v-for="i in 5" :key="i"><line x1="52" x2="700" :y1="20 + (i - 1) * 50" :y2="20 + (i - 1) * 50" stroke="#e2e8f0" stroke-dasharray="3 4" />
              <text x="44" :y="24 + (i - 1) * 50" text-anchor="end" font-size="10" fill="#64748b">{{ nombre((niceMax / 4) * (5 - i)) }}</text></g>
            <g v-for="(d, i) in days" :key="i" @mouseenter="hover = i" @mouseleave="hover = null" @focus="hover = i" @blur="hover = null" tabindex="0" :aria-label="`${d.label} : ${fcfa(d.total)}`">
              <rect :x="52 + i * 46" y="20" width="46" height="200" fill="transparent" />
              <template v-for="(o, k) in offres" :key="o">
                <rect :x="60 + i * 46" :width="30" :y="220 - ((offres.slice(0, k + 1).reduce((a, x) => a + d.v[x], 0)) / niceMax) * 200" :height="(d.v[o] / niceMax) * 200" :fill="COLOR[o]" :opacity="hover === null || hover === i ? 1 : 0.35" :rx="k === offres.length - 1 ? 3 : 0" />
              </template>
              <text :x="75 + i * 46" y="238" text-anchor="middle" font-size="10" fill="#64748b">{{ d.label }}</text>
            </g>
          </svg>
          <div v-if="hover !== null" class="pointer-events-none absolute top-0 rounded-xl bg-navy-900 px-3 py-2 text-xs text-white shadow-pop" :style="{ left: `calc(${((75 + hover * 46) / 700) * 100}% - 70px)` }">
            <p class="font-semibold">{{ days[hover].d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</p>
            <p v-for="o in offres" :key="o" class="mt-0.5 flex items-center gap-1.5"><span class="h-2 w-2 rounded-sm" :style="{ background: COLOR[o] }" />{{ o }} : {{ fcfa(days[hover].v[o]) }}</p>
            <p class="mt-1 border-t border-white/20 pt-1 font-semibold text-gold-300">Total : {{ fcfa(days[hover].total) }}</p>
          </div>
        </div>
      </section>

      <section class="card p-5 sm:p-6" aria-labelledby="ch2">
        <h2 id="ch2" class="text-base">Répartition par offre</h2>
        <div class="mt-4 flex items-center gap-5">
          <svg viewBox="0 0 140 140" class="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label="Répartition des encaissements par offre">
            <circle cx="70" cy="70" :r="R" fill="none" stroke="#f1f5f9" stroke-width="18" />
            <circle v-for="a in arcs" :key="a.o" cx="70" cy="70" :r="R" fill="none" :stroke="COLOR[a.o]" stroke-width="18" :stroke-dasharray="`${Math.max(0, a.len - 2)} ${C}`" :stroke-dashoffset="a.off" />
          </svg>
          <ul class="min-w-0 flex-1 space-y-3 text-sm">
            <li v-for="p in parOffre" :key="p.o"><div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-sm" :style="{ background: COLOR[p.o] }" /><span class="truncate font-medium text-navy-900">{{ OFFRES[p.o].libelle }}</span></div><p class="tabular pl-4.5 text-xs text-slate-500" style="padding-left: 1.125rem">{{ fcfa(p.v) }} · {{ p.n }} inscr.</p></li>
          </ul>
        </div>
        <h3 class="mt-6 text-sm">Par opérateur</h3>
        <div class="mt-3 space-y-3">
          <div v-for="o in parOp" :key="o.op"><div class="mb-1 flex justify-between text-xs"><span class="font-medium text-slate-700">{{ o.op === 'MTN' ? 'MTN Mobile Money' : 'Orange Money' }}</span><span class="tabular text-slate-500">{{ fcfa(o.v) }} · {{ Math.round((o.v / totOp) * 100) }} %</span></div>
            <div class="h-2.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full" :class="o.op === 'MTN' ? 'bg-mtn' : 'bg-orange-om'" :style="{ width: `${(o.v / totOp) * 100}%` }" /></div></div>
        </div>
      </section>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="card overflow-hidden" aria-labelledby="ch3">
        <div class="flex items-center justify-between border-b border-slate-100 p-5"><h2 id="ch3" class="text-base">Groupes presque complets</h2><RouterLink :to="{ name: 'admin-listes' }" class="text-sm font-medium text-navy-700 hover:underline">Voir les listes</RouterLink></div>
        <ul class="divide-y divide-slate-100">
          <li v-for="g in critiques" :key="g.key" class="flex items-center gap-4 px-5 py-3.5">
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-navy-900">{{ g.label }}</p>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full" :class="g.used >= g.max ? 'bg-red-500' : 'bg-gold-500'" :style="{ width: `${Math.min(100, (g.used / g.max) * 100)}%` }" /></div></div>
            <span class="tabular text-sm font-semibold" :class="g.used >= g.max ? 'text-red-700' : 'text-navy-800'">{{ g.used }}/{{ g.max }}</span>
            <span v-if="g.used >= g.max" class="chip-red">Complet</span>
          </li>
          <li v-if="!critiques.length" class="p-8 text-center text-sm text-slate-500">Aucun groupe proche de la limite.</li>
        </ul>
      </section>

      <section class="card overflow-hidden" aria-labelledby="ch4">
        <div class="flex items-center justify-between border-b border-slate-100 p-5"><h2 id="ch4" class="text-base">Dernières inscriptions</h2><RouterLink :to="{ name: 'admin-inscriptions' }" class="text-sm font-medium text-navy-700 hover:underline">Tout voir</RouterLink></div>
        <ul class="divide-y divide-slate-100">
          <li v-for="l in recents" :key="l.ins.id" class="flex items-center gap-3 px-5 py-3">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" :style="{ background: COLOR[l.offre] }">{{ l.offre }}</span>
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium text-navy-900">{{ l.nom }}</p><p class="truncate text-xs text-slate-500">{{ l.groupeLabel }} · {{ fmtDateTime(l.ins.creeLe) }}</p></div>
            <StatusBadge :s="l.ins.statut" />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
