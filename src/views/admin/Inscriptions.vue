<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import Modal from '../../components/Modal.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import OperatorBadge from '../../components/OperatorBadge.vue'
import { db, log } from '../../api'
import { lignes, type Ligne } from '../../api/queries'
import { adminState, offresVisibles } from '../../composables/adminAuth'
import { exportCsv, exportExcel } from '../../lib/export'
import { fcfa } from '../../lib/money'
import { formatPhone, nationalDigits } from '../../lib/phone'
import { fmtDateTime } from '../../lib/i18n'
import { toast } from '../../composables/toast'
import { OFFRES } from '../../lib/types'

const q = ref('')
const offre = ref('')
const statut = ref('')
const page = ref(1)
const PER = 12
const sel = ref<Ligne | null>(null)

const all = computed(() => lignes(offresVisibles.value))
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  const digits = s.replace(/\D/g, '')
  return all.value.filter((l) => {
    if (offre.value && l.offre !== offre.value) return false
    if (statut.value && l.ins.statut !== statut.value) return false
    if (!s) return true
    return (
      l.nom.toLowerCase().includes(s) ||
      (digits.length >= 3 && (nationalDigits(l.commande.payeur.tel).includes(digits) || nationalDigits(l.participant.parentTel || '').includes(digits))) ||
      !!l.facture?.numero.toLowerCase().includes(s) ||
      !!l.paiement?.referenceInterne.toLowerCase().includes(s) ||
      !!l.paiement?.referenceOperateur?.toLowerCase().includes(s) ||
      l.commande.payeur.nom.toLowerCase().includes(s)
    )
  })
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER)))
const rows = computed(() => filtered.value.slice((page.value - 1) * PER, page.value * PER))
watch([q, offre, statut], () => (page.value = 1))

function data() {
  return filtered.value.map((l) => [l.facture?.numero ?? '', l.nom, OFFRES[l.offre].libelle, l.groupeLabel, l.commande.payeur.nom, formatPhone(l.commande.payeur.tel), l.ins.prix, l.ins.statut, new Date(l.ins.creeLe).toLocaleString('fr-FR')])
}
const HEAD = ['Facture', 'Participant', 'Offre', 'Groupe', 'Payeur', 'Téléphone', 'Prix (XAF)', 'Statut', 'Date']
function exp(kind: 'csv' | 'xls') {
  kind === 'csv' ? exportCsv('inscriptions', HEAD, data()) : exportExcel('inscriptions', HEAD, data())
  log(db, adminState.user?.nom ?? '?', 'EXPORT', `Inscriptions (${kind.toUpperCase()}) · ${filtered.value.length} lignes`)
  toast('success', 'Export prêt', `${filtered.value.length} lignes exportées.`)
}
const detailAge = (l: Ligne) => l.participant.naissance || '—'
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-5">
    <div class="card p-4 sm:p-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="relative flex-1">
          <Icon name="search" :size="18" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="q" type="search" class="input pl-11" placeholder="Rechercher par nom, téléphone, n° de facture ou référence de paiement" aria-label="Rechercher une inscription" />
        </div>
        <select v-model="offre" class="input lg:w-52" aria-label="Offre"><option value="">Toutes les offres</option><option v-for="o in offresVisibles" :key="o" :value="o">{{ OFFRES[o].libelle }}</option></select>
        <select v-model="statut" class="input lg:w-48" aria-label="Statut"><option value="">Tous les statuts</option><option value="CONFIRMEE">Confirmées</option><option value="RESERVEE">Réservées</option><option value="LISTE_ATTENTE">Liste d’attente</option><option value="LIBEREE">Libérées</option><option value="ANNULEE">Annulées</option></select>
        <div class="flex gap-2"><button class="btn-outline btn-sm" @click="exp('csv')"><Icon name="download" :size="16" />CSV</button><button class="btn-outline btn-sm" @click="exp('xls')"><Icon name="download" :size="16" />Excel</button></div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="tbl min-w-[860px]">
          <thead><tr><th>Participant</th><th>Offre et groupe</th><th>Payeur</th><th class="text-right">Prix</th><th>Statut</th><th>Facture</th><th><span class="sr-only">Détail</span></th></tr></thead>
          <tbody>
            <tr v-for="l in rows" :key="l.ins.id" class="cursor-pointer" tabindex="0" @click="sel = l" @keydown.enter="sel = l">
              <td><p class="font-medium text-navy-900">{{ l.nom }}</p><p class="text-xs text-slate-500">{{ fmtDateTime(l.ins.creeLe) }}</p></td>
              <td><span class="chip-navy">{{ l.offre }}</span> <span class="ml-1 text-slate-700">{{ l.groupeLabel }}</span><span v-if="l.ins.doublon" class="chip-amber ml-2">Doublon ?</span></td>
              <td><p class="text-slate-800">{{ l.commande.payeur.nom }}</p><p class="text-xs text-slate-500">{{ formatPhone(l.commande.payeur.tel) }}</p></td>
              <td class="tabular text-right font-medium">{{ fcfa(l.ins.prix) }}</td>
              <td><StatusBadge :s="l.ins.statut" /></td>
              <td class="font-mono text-xs text-slate-600">{{ l.facture?.numero ?? '—' }}</td>
              <td class="text-right text-slate-400"><Icon name="chevron-right" :size="18" /></td>
            </tr>
            <tr v-if="!rows.length"><td colspan="7" class="py-16 text-center text-slate-500"><Icon name="search" :size="28" class="mx-auto mb-2 text-slate-300" />Aucune inscription ne correspond à votre recherche.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
        <p>{{ filtered.length }} inscription{{ filtered.length > 1 ? 's' : '' }}</p>
        <div class="flex items-center gap-2"><button class="btn-outline btn-sm" :disabled="page <= 1" @click="page--">Précédent</button><span class="tabular px-1">{{ page }} / {{ pages }}</span><button class="btn-outline btn-sm" :disabled="page >= pages" @click="page++">Suivant</button></div>
      </div>
    </div>

    <Modal :open="!!sel" :title="sel ? sel.nom : ''" wide @close="sel = null">
      <div v-if="sel" class="grid gap-6 sm:grid-cols-2">
        <section><h3 class="mb-3 text-sm uppercase tracking-wider text-gold-700">Participant</h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Offre</dt><dd class="font-medium">{{ OFFRES[sel.offre].libelle }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Groupe</dt><dd class="font-medium">{{ sel.groupeLabel }}</dd></div>
            <div v-if="sel.offre !== 'INF'" class="flex justify-between gap-4"><dt class="text-slate-500">Naissance</dt><dd>{{ detailAge(sel) }}</dd></div>
            <div v-if="sel.participant.classePrecedente" class="flex justify-between gap-4"><dt class="text-slate-500">Classe écoulée</dt><dd>{{ sel.participant.classePrecedente }}</dd></div>
            <div v-if="sel.participant.etablissement" class="flex justify-between gap-4"><dt class="text-slate-500">Établissement</dt><dd>{{ sel.participant.etablissement }}</dd></div>
            <div v-if="sel.participant.profession" class="flex justify-between gap-4"><dt class="text-slate-500">Profession</dt><dd class="capitalize">{{ sel.participant.profession }}</dd></div>
            <div v-if="sel.participant.urgenceNom" class="flex justify-between gap-4"><dt class="text-slate-500">Contact d’urgence</dt><dd class="text-right">{{ sel.participant.urgenceNom }}<br /><span class="text-slate-500">{{ formatPhone('+237' + sel.participant.urgenceTel) }}</span></dd></div>
            <div v-if="sel.participant.autorisation" class="flex justify-between gap-4"><dt class="text-slate-500">Autorisation parentale</dt><dd><span class="chip-green">Horodatée {{ fmtDateTime(sel.commande.consentement.horodatage) }}</span></dd></div>
          </dl>
        </section>
        <section><h3 class="mb-3 text-sm uppercase tracking-wider text-gold-700">Payeur et paiement</h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Payeur</dt><dd class="font-medium">{{ sel.commande.payeur.nom }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Téléphone</dt><dd>{{ formatPhone(sel.commande.payeur.tel) }}</dd></div>
            <div v-if="sel.commande.payeur.email" class="flex justify-between gap-4"><dt class="text-slate-500">E-mail</dt><dd>{{ sel.commande.payeur.email }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Statut</dt><dd><StatusBadge :s="sel.ins.statut" /></dd></div>
            <template v-if="sel.paiement">
              <div class="flex items-center justify-between gap-4"><dt class="text-slate-500">Opérateur</dt><dd><OperatorBadge :op="sel.paiement.operateur" /></dd></div>
              <div class="flex justify-between gap-4"><dt class="text-slate-500">Référence interne</dt><dd class="font-mono text-xs">{{ sel.paiement.referenceInterne }}</dd></div>
              <div v-if="sel.paiement.referenceOperateur" class="flex justify-between gap-4"><dt class="text-slate-500">Réf. opérateur</dt><dd class="font-mono text-xs">{{ sel.paiement.referenceOperateur }}</dd></div>
            </template>
            <div v-if="sel.facture" class="flex justify-between gap-4"><dt class="text-slate-500">Facture</dt><dd><RouterLink :to="{ name: 'facture', params: { code: sel.facture.code } }" class="font-mono text-xs font-semibold text-navy-700 underline">{{ sel.facture.numero }}</RouterLink></dd></div>
            <div class="flex justify-between gap-4 border-t border-dashed border-slate-200 pt-2"><dt class="font-semibold">Prix appliqué</dt><dd class="tabular font-bold">{{ fcfa(sel.ins.prix) }}</dd></div>
          </dl>
        </section>
      </div>
      <template #footer><button class="btn-primary" @click="sel = null">Fermer</button></template>
    </Modal>
  </div>
</template>
