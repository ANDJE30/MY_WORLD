<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import Modal from '../../components/Modal.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import OperatorBadge from '../../components/OperatorBadge.vue'
import { db, emettreAvoir, log } from '../../api'
import { adminState, can } from '../../composables/adminAuth'
import { exportCsv, exportExcel } from '../../lib/export'
import { fcfa } from '../../lib/money'
import { formatPhone } from '../../lib/phone'
import { fmtDateTime } from '../../lib/i18n'
import { toast } from '../../composables/toast'

const onglet = ref<'paiements' | 'factures' | 'avoirs'>('paiements')
const statut = ref('')
const op = ref('')
const q = ref('')

const paiements = computed(() => db.paiements.filter((p) => (!statut.value || p.statut === statut.value) && (!op.value || p.operateur === op.value) &&
  (!q.value || p.referenceInterne.toLowerCase().includes(q.value.toLowerCase()) || (p.referenceOperateur ?? '').toLowerCase().includes(q.value.toLowerCase()) || db.commandes.find((c) => c.id === p.commandeId)?.payeur.nom.toLowerCase().includes(q.value.toLowerCase()))))
const nomPayeur = (cid: string) => db.commandes.find((c) => c.id === cid)?.payeur
const factureDe = (pid: string) => db.factures.find((f) => f.paiementId === pid)

const encaisse = computed(() => db.paiements.filter((p) => p.statut === 'REUSSIE').reduce((a, p) => a + p.montant, 0))
const rembourse = computed(() => db.avoirs.reduce((a, v) => a + v.montant, 0))
const taux = computed(() => { const t = db.paiements.length || 1; return Math.round((db.paiements.filter((p) => p.statut === 'REUSSIE' || p.statut === 'REMBOURSEE').length / t) * 100) })
const rapp = computed(() => db.rapprochements[0])

const HEAD = ['Date', 'Référence interne', 'Référence opérateur', 'Opérateur', 'Payeur', 'Montant (XAF)', 'Statut']
function exp(kind: 'csv' | 'xls') {
  const rows = paiements.value.map((p) => [new Date(p.creeLe).toLocaleString('fr-FR'), p.referenceInterne, p.referenceOperateur ?? '', p.operateur, nomPayeur(p.commandeId)?.nom ?? '', p.montant, p.statut])
  kind === 'csv' ? exportCsv('encaissements', HEAD, rows) : exportExcel('encaissements', HEAD, rows)
  log(db, adminState.user?.nom ?? '?', 'EXPORT', `Encaissements (${kind.toUpperCase()}) · ${rows.length} lignes`)
  toast('success', 'Export prêt')
}

// Avoirs
const avoirOpen = ref(false)
const numero = ref('')
const montant = ref<number | null>(null)
const motif = ref('')
const err = ref('')
const facturesEligibles = computed(() => db.factures)
const fSel = computed(() => db.factures.find((f) => f.numero === numero.value))
const dejaRembourse = computed(() => db.avoirs.filter((a) => a.factureNumero === numero.value).reduce((s, a) => s + a.montant, 0))
function ouvrirAvoir(n = '') { numero.value = n; montant.value = null; motif.value = ''; err.value = ''; avoirOpen.value = true }
function emettre() {
  err.value = ''
  try {
    const a = emettreAvoir(db, numero.value, Number(montant.value), motif.value, adminState.user?.nom ?? '?')
    toast('success', `Avoir ${a.numero} émis`, 'Le remboursement est effectué hors plateforme par l’économat.')
    avoirOpen.value = false
  } catch (e) { err.value = (e as Error).message }
}
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="card p-5"><p class="text-sm font-medium text-slate-500">Total encaissé</p><p class="tabular mt-2 text-2xl font-bold text-navy-900">{{ fcfa(encaisse) }}</p></article>
      <article class="card p-5"><p class="text-sm font-medium text-slate-500">Avoirs émis</p><p class="tabular mt-2 text-2xl font-bold text-navy-900">{{ fcfa(rembourse) }}</p><p class="text-xs text-slate-500">{{ db.avoirs.length }} avoir(s)</p></article>
      <article class="card p-5"><p class="text-sm font-medium text-slate-500">Taux de réussite</p><p class="tabular mt-2 text-2xl font-bold text-navy-900">{{ taux }} %</p><div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-emerald-500" :style="{ width: `${taux}%` }" /></div></article>
      <article class="card p-5" :class="rapp?.ecarts.length ? 'ring-2 ring-amber-300' : ''">
        <p class="flex items-center gap-2 text-sm font-medium text-slate-500"><Icon name="refresh" :size="15" />Rapprochement de la nuit</p>
        <p class="mt-2 text-2xl font-bold" :class="rapp?.ecarts.length ? 'text-amber-700' : 'text-emerald-700'">{{ rapp?.ecarts.length ? `${rapp.ecarts.length} écart` : 'Aucun écart' }}</p>
        <p class="text-xs text-slate-500">{{ rapp ? `${rapp.transactions} transactions · ${fmtDateTime(rapp.date)}` : 'Pas encore exécuté' }}</p>
      </article>
    </div>

    <div v-if="rapp?.ecarts.length" class="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      <Icon name="alert" :size="20" class="mt-0.5 shrink-0" />
      <div><p class="font-semibold">À vérifier avec le relevé du prestataire</p><ul class="mt-1 list-disc pl-5"><li v-for="e in rapp.ecarts" :key="e.reference"><span class="font-mono text-xs">{{ e.reference }}</span> — {{ e.detail }}</li></ul></div>
    </div>

    <div class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 pt-2">
        <div class="flex" role="tablist">
          <button v-for="o in [['paiements', 'Paiements'], ['factures', 'Factures'], ['avoirs', 'Avoirs']] as const" :key="o[0]" role="tab" :aria-selected="onglet === o[0]" class="relative px-4 py-3 text-sm font-semibold" :class="onglet === o[0] ? 'text-navy-900' : 'text-slate-500 hover:text-navy-800'" @click="onglet = o[0]">{{ o[1] }}<span v-if="onglet === o[0]" class="absolute inset-x-3 -bottom-px h-0.5 rounded bg-gold-500" /></button>
        </div>
        <div class="flex gap-2 pb-2 pr-2"><button v-if="onglet === 'paiements'" class="btn-outline btn-sm" @click="exp('csv')"><Icon name="download" :size="16" />CSV</button><button v-if="onglet === 'paiements'" class="btn-outline btn-sm" @click="exp('xls')"><Icon name="download" :size="16" />Excel</button><button v-if="can.avoirs()" class="btn-primary btn-sm" @click="ouvrirAvoir()"><Icon name="plus" :size="16" />Émettre un avoir</button></div>
      </div>

      <template v-if="onglet === 'paiements'">
        <div class="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1fr_11rem_11rem]">
          <input v-model="q" class="input" placeholder="Référence ou payeur" aria-label="Rechercher" />
          <select v-model="statut" class="input" aria-label="Statut"><option value="">Tous statuts</option><option value="REUSSIE">Réussie</option><option value="ECHOUEE">Échouée</option><option value="EXPIREE">Expirée</option><option value="EN_ATTENTE">En attente</option><option value="REMBOURSEE">Remboursée</option></select>
          <select v-model="op" class="input" aria-label="Opérateur"><option value="">Tous opérateurs</option><option value="MTN">MTN</option><option value="ORANGE">Orange</option></select>
        </div>
        <div class="max-h-[34rem] overflow-auto"><table class="tbl min-w-[860px]">
          <thead class="sticky top-0"><tr><th>Date</th><th>Référence</th><th>Opérateur</th><th>Payeur</th><th class="text-right">Montant</th><th>Statut</th><th>Facture</th></tr></thead>
          <tbody>
            <tr v-for="p in paiements.slice(0, 80)" :key="p.id">
              <td class="whitespace-nowrap text-slate-600">{{ fmtDateTime(p.creeLe) }}</td>
              <td><p class="font-mono text-xs text-navy-900">{{ p.referenceInterne }}</p><p v-if="p.referenceOperateur" class="font-mono text-[11px] text-slate-400">{{ p.referenceOperateur }}</p></td>
              <td><OperatorBadge :op="p.operateur" /></td>
              <td><p>{{ nomPayeur(p.commandeId)?.nom }}</p><p class="text-xs text-slate-500">{{ formatPhone(p.numero) }}</p></td>
              <td class="tabular text-right font-semibold">{{ fcfa(p.montant) }}</td>
              <td><StatusBadge :s="p.statut" /><p v-if="p.motifEchec" class="mt-1 max-w-[12rem] text-xs text-slate-500">{{ p.motifEchec }}</p></td>
              <td class="font-mono text-xs">{{ factureDe(p.id)?.numero ?? '—' }}</td>
            </tr>
            <tr v-if="!paiements.length"><td colspan="7" class="py-14 text-center text-slate-500">Aucun paiement.</td></tr>
          </tbody></table></div>
      </template>

      <div v-else-if="onglet === 'factures'" class="max-h-[34rem] overflow-auto"><table class="tbl min-w-[720px]">
        <thead class="sticky top-0"><tr><th>Numéro</th><th>Date</th><th>Payeur</th><th class="text-right">Montant</th><th>Avoirs</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="f in db.factures.slice(0, 80)" :key="f.id">
            <td class="font-mono text-xs font-semibold text-navy-900">{{ f.numero }}</td><td class="whitespace-nowrap text-slate-600">{{ fmtDateTime(f.date) }}</td>
            <td>{{ nomPayeur(f.commandeId)?.nom }}</td><td class="tabular text-right font-semibold">{{ fcfa(f.montant) }}</td>
            <td><span v-for="a in db.avoirs.filter((x) => x.factureNumero === f.numero)" :key="a.id" class="chip-navy mr-1">{{ a.numero }}</span></td>
            <td class="whitespace-nowrap text-right"><RouterLink :to="{ name: 'facture', params: { code: f.code } }" class="btn-ghost btn-sm">Duplicata</RouterLink><button v-if="can.avoirs()" class="btn-ghost btn-sm" @click="ouvrirAvoir(f.numero)">Avoir</button></td>
          </tr>
        </tbody></table></div>

      <div v-else class="overflow-auto"><table class="tbl min-w-[720px]">
        <thead><tr><th>Avoir</th><th>Facture</th><th>Date</th><th class="text-right">Montant</th><th>Motif</th><th>Émis par</th></tr></thead>
        <tbody>
          <tr v-for="a in db.avoirs" :key="a.id"><td class="font-mono text-xs font-semibold">{{ a.numero }}</td><td class="font-mono text-xs">{{ a.factureNumero }}</td><td class="whitespace-nowrap text-slate-600">{{ fmtDateTime(a.date) }}</td><td class="tabular text-right font-semibold">{{ fcfa(a.montant) }}</td><td>{{ a.motif }}</td><td class="text-slate-600">{{ a.utilisateur }}</td></tr>
          <tr v-if="!db.avoirs.length"><td colspan="6" class="py-14 text-center text-slate-500">Aucun avoir émis.</td></tr>
        </tbody></table></div>
    </div>
    <p v-if="!can.avoirs()" class="flex items-center gap-2 text-sm text-slate-500"><Icon name="lock" :size="15" />L’émission des avoirs est réservée au compte Économat (EF-34).</p>

    <Modal :open="avoirOpen" title="Émettre un avoir" @close="avoirOpen = false">
      <div class="space-y-4">
        <div><label for="av-f" class="label">Facture concernée</label><select id="av-f" v-model="numero" class="input"><option value="" disabled>Choisir…</option><option v-for="f in facturesEligibles" :key="f.id" :value="f.numero">{{ f.numero }} · {{ fcfa(f.montant) }}</option></select>
          <p v-if="fSel" class="hint">Restant remboursable : {{ fcfa(fSel.montant - dejaRembourse) }}</p></div>
        <div><label for="av-m" class="label">Montant (FCFA)</label><input id="av-m" v-model.number="montant" type="number" min="1" inputmode="numeric" class="input" /></div>
        <div><label for="av-o" class="label">Motif</label><textarea id="av-o" v-model="motif" rows="3" class="input resize-none" placeholder="Ex. doublon, désistement…" /></div>
        <p class="rounded-xl bg-navy-50 p-3 text-xs text-navy-800">Le remboursement est décidé par l’économat et effectué hors plateforme ; l’avoir en garde la trace (RG-10, RG-11). Une facture émise n’est jamais modifiée.</p>
        <p v-if="err" class="error" role="alert"><Icon name="alert" :size="16" class="mt-px" />{{ err }}</p>
      </div>
      <template #footer><button class="btn-outline" @click="avoirOpen = false">Annuler</button><button class="btn-primary" @click="emettre">Émettre l’avoir</button></template>
    </Modal>
  </div>
</template>
