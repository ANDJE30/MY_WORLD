<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import Modal from '../../components/Modal.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { db, log } from '../../api'
import { adminState } from '../../composables/adminAuth'
import { fcfa } from '../../lib/money'
import { fmtDate, fmtDateTime } from '../../lib/i18n'
import { toast } from '../../composables/toast'
import { OFFRES } from '../../lib/types'
import type { OffreCode, Prestation, Session } from '../../lib/types'

const who = () => adminState.user?.nom ?? '?'
const onglet = ref<'sessions' | 'tarifs' | 'regles' | 'categories'>('tarifs')
const offre = ref<OffreCode>('CRN')
const ses = computed(() => db.sessions.find((s) => s.offre === offre.value))
const items = computed(() => db.prestations.filter((p) => p.sessionId === ses.value?.id))

// Prestation
const pOpen = ref(false)
const pEdit = reactive({ id: '', libelle: '', tarif: 0, places: 0 })
function editP(p: Prestation) { Object.assign(pEdit, { id: p.id, libelle: p.libelle, tarif: p.tarif, places: p.places }); pOpen.value = true }
function saveP() {
  const p = db.prestations.find((x) => x.id === pEdit.id)!
  if (pEdit.tarif < 0 || pEdit.places < 1) return toast('error', 'Valeurs invalides')
  if (p.tarif !== pEdit.tarif) {
    db.tarifs.unshift({ prestationId: p.id, ancien: p.tarif, nouveau: pEdit.tarif, date: new Date().toISOString(), utilisateur: who() })
    log(db, who(), 'TARIF_MODIFIE', `${p.libelle} (${offre.value})`, fcfa(p.tarif), fcfa(pEdit.tarif))
  }
  if (p.places !== pEdit.places) log(db, who(), 'EFFECTIF_MODIFIE', p.libelle, String(p.places), String(pEdit.places))
  p.tarif = pEdit.tarif; p.places = pEdit.places
  pOpen.value = false
  toast('success', 'Modifications enregistrées', 'Elles s’appliquent aussitôt sur le site, hors commandes déjà créées (RG-02).')
}

// Session
const sOpen = ref(false)
const sEdit = reactive<Session>({ id: '', offre: 'CRN', intitule: '', debut: '', fin: '', limite: '', statut: 'ouverte' })
function editS(s: Session) { Object.assign(sEdit, s); sOpen.value = true }
function saveS() {
  if (!sEdit.debut || !sEdit.fin || !sEdit.limite || sEdit.limite > sEdit.debut) return toast('error', 'Dates incohérentes', 'La date limite doit précéder le début de la session.')
  const s = db.sessions.find((x) => x.id === sEdit.id)!
  log(db, who(), 'SESSION_MODIFIEE', s.intitule, `${s.debut} → ${s.limite} (${s.statut})`, `${sEdit.debut} → ${sEdit.limite} (${sEdit.statut})`)
  Object.assign(s, { ...sEdit })
  sOpen.value = false
  toast('success', 'Session mise à jour')
}

const prm = computed(() => db.params)
function savePrm() { log(db, who(), 'PARAMETRES_MODIFIES', 'Règles tarifaires'); toast('success', 'Paramètres enregistrés') }
const hist = computed(() => db.tarifs.filter((h) => items.value.some((p) => p.id === h.prestationId)))
const libelle = (id: string) => db.prestations.find((p) => p.id === id)?.libelle ?? id
const unit = (o: OffreCode) => (o === 'CRN' ? 'Matière' : o === 'SPT' ? 'Activité' : 'Module')
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <div class="card overflow-hidden">
      <div class="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2" role="tablist">
        <button v-for="o in [['tarifs', 'Tarifs et effectifs'], ['sessions', 'Sessions'], ['regles', 'Règles et frais'], ['categories', 'Catégories d’âge']] as const" :key="o[0]" role="tab" :aria-selected="onglet === o[0]" class="relative whitespace-nowrap px-4 py-3 text-sm font-semibold" :class="onglet === o[0] ? 'text-navy-900' : 'text-slate-500 hover:text-navy-800'" @click="onglet = o[0]">{{ o[1] }}<span v-if="onglet === o[0]" class="absolute inset-x-3 -bottom-px h-0.5 rounded bg-gold-500" /></button>
      </div>

      <div v-if="onglet === 'tarifs'">
        <div class="flex flex-wrap gap-2 p-4"><button v-for="o in (['CRN', 'SPT', 'INF'] as const)" :key="o" class="btn btn-sm" :class="offre === o ? 'bg-navy-800 text-white' : 'border border-slate-300 bg-white text-navy-800 hover:bg-navy-50'" @click="offre = o">{{ OFFRES[o].libelle }}</button></div>
        <div class="overflow-x-auto"><table class="tbl min-w-[640px]">
          <thead><tr><th>{{ unit(offre) }}</th><th class="text-right">Tarif</th><th class="text-right">Effectif max.</th><th>Détail</th><th><span class="sr-only">Modifier</span></th></tr></thead>
          <tbody><tr v-for="p in items" :key="p.id">
            <td class="font-medium text-navy-900">{{ p.libelle }}</td><td class="tabular text-right font-semibold">{{ fcfa(p.tarif) }}</td><td class="tabular text-right">{{ p.places }}</td>
            <td class="text-xs text-slate-500">{{ p.creneauLibelle ?? (p.categories ? p.categories.join(', ') : p.niveaux ? `${p.niveaux.length} classes` : '') }}</td>
            <td class="text-right"><button class="btn-outline btn-sm" @click="editP(p)"><Icon name="edit" :size="15" />Modifier</button></td></tr></tbody></table></div>
        <div class="border-t border-slate-100 p-5"><h3 class="flex items-center gap-2 text-sm"><Icon name="history" :size="16" />Historique des tarifs</h3>
          <ul v-if="hist.length" class="mt-3 space-y-2 text-sm"><li v-for="(h, i) in hist" :key="i" class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-4 py-2.5"><span class="font-medium text-navy-900">{{ libelle(h.prestationId) }}</span><span class="tabular text-slate-500 line-through">{{ fcfa(h.ancien) }}</span><Icon name="arrow-right" :size="14" class="text-slate-400" /><span class="tabular font-semibold">{{ fcfa(h.nouveau) }}</span><span class="ml-auto text-xs text-slate-500">{{ fmtDateTime(h.date) }} · {{ h.utilisateur }}</span></li></ul>
          <p v-else class="mt-2 text-sm text-slate-500">Aucune modification de tarif pour cette offre.</p></div>
      </div>

      <div v-else-if="onglet === 'sessions'" class="overflow-x-auto"><table class="tbl min-w-[760px]">
        <thead><tr><th>Session</th><th>Début</th><th>Fin</th><th>Date limite</th><th>Statut</th><th><span class="sr-only">Modifier</span></th></tr></thead>
        <tbody><tr v-for="s in db.sessions" :key="s.id"><td><p class="font-medium text-navy-900">{{ s.intitule }}</p><p class="text-xs text-slate-500">{{ OFFRES[s.offre].libelle }}</p></td><td>{{ fmtDate(s.debut, { day: '2-digit', month: 'short', year: 'numeric' }) }}</td><td>{{ fmtDate(s.fin, { day: '2-digit', month: 'short', year: 'numeric' }) }}</td><td>{{ fmtDate(s.limite, { day: '2-digit', month: 'short', year: 'numeric' }) }}</td><td><StatusBadge :s="s.statut" /></td><td class="text-right"><button class="btn-outline btn-sm" @click="editS(s)"><Icon name="edit" :size="15" />Modifier</button></td></tr></tbody></table></div>

      <form v-else-if="onglet === 'regles'" class="grid gap-6 p-5 sm:p-6 lg:grid-cols-2" @submit.prevent="savePrm">
        <div><label for="pl" class="label">Forfait plafond CRN (FCFA)</label><input id="pl" v-model.number="prm.forfaitPlafondCRN" type="number" min="0" class="input" /><p class="hint">Un élève inscrit dans beaucoup de matières ne paie jamais plus que ce forfait (EF-09).</p></div>
        <div class="grid grid-cols-2 gap-4"><div><label for="rm" class="label">Remise informatique à partir de</label><input id="rm" v-model.number="prm.remiseINF.minModules" type="number" min="2" class="input" /><p class="hint">modules</p></div><div><label for="rp" class="label">Taux de remise</label><input id="rp" v-model.number="prm.remiseINF.pct" type="number" min="0" max="100" class="input" /><p class="hint">en %</p></div></div>
        <fieldset><legend class="label">Frais de transaction du prestataire</legend>
          <div class="grid gap-2 sm:grid-cols-2"><label v-for="m in [['absorbes', 'Absorbés par le collège'], ['ajoutes', 'Ajoutés au montant payé']] as const" :key="m[0]" class="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-4" :class="prm.frais.mode === m[0] ? 'border-navy-700 bg-navy-50' : 'border-slate-300'"><input v-model="prm.frais.mode" type="radio" name="frais" :value="m[0]" class="accent-navy-800" /><span class="text-sm">{{ m[1] }}</span></label></div>
          <div v-if="prm.frais.mode === 'ajoutes'" class="mt-3 max-w-[10rem]"><label for="fp" class="label">Taux (%)</label><input id="fp" v-model.number="prm.frais.pct" type="number" step="0.1" min="0" class="input" /></div></fieldset>
        <div><label class="label" for="dp">Délai de confirmation du paiement (min)</label><input id="dp" v-model.number="prm.delaiPaiementMin" type="number" min="1" max="15" class="input" /><p class="hint">Passé ce délai, la transaction expire (5 par défaut).</p>
          <label class="label mt-5" for="rs">Réservation d’une place (min)</label><input id="rs" v-model.number="prm.reservationMin" type="number" min="5" max="60" class="input" /></div>
        <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-4 lg:col-span-2"><input v-model="prm.certificatMedical" type="checkbox" class="mt-0.5 h-5 w-5 accent-navy-800" /><span class="text-sm"><span class="block font-semibold text-navy-900">Exiger le certificat médical d’aptitude (VOGT Sport)</span><span class="text-slate-500">Activé par la coordination sportive ; le justificatif est alors obligatoire à l’inscription.</span></span></label>
        <div class="lg:col-span-2"><button class="btn-primary">Enregistrer les paramètres</button></div>
      </form>

      <div v-else class="overflow-x-auto"><table class="tbl min-w-[560px]">
        <thead><tr><th>Code</th><th>Libellé</th><th>Âge min.</th><th>Âge max.</th></tr></thead>
        <tbody><tr v-for="c in db.categories" :key="c.code"><td class="font-bold text-navy-900">{{ c.code }}</td><td><input v-model="c.libelle" class="input !min-h-[40px] text-sm" :aria-label="`Libellé ${c.code}`" /></td><td><input v-model.number="c.min" type="number" min="3" class="input !min-h-[40px] w-24 text-sm" :aria-label="`Âge minimal ${c.code}`" /></td><td><input v-model.number="c.max" type="number" min="3" class="input !min-h-[40px] w-24 text-sm" :aria-label="`Âge maximal ${c.code}`" /></td></tr></tbody></table>
        <p class="border-t border-slate-100 p-4 text-sm text-slate-500">Âge révolu au premier jour de la session (RG-04). Les tranches sont une proposition à valider par la coordination sportive.</p></div>
    </div>

    <Modal :open="pOpen" :title="`Modifier · ${pEdit.libelle}`" @close="pOpen = false">
      <div class="space-y-4"><div><label for="pt" class="label">Tarif (FCFA)</label><input id="pt" v-model.number="pEdit.tarif" type="number" min="0" class="input" /></div><div><label for="pp" class="label">Effectif maximal par groupe</label><input id="pp" v-model.number="pEdit.places" type="number" min="1" class="input" /></div>
        <p class="rounded-xl bg-navy-50 p-3 text-xs text-navy-800">Le tarif en vigueur à la création d’une commande lui reste appliqué ; la modification est tracée dans l’historique et le journal d’audit.</p></div>
      <template #footer><button class="btn-outline" @click="pOpen = false">Annuler</button><button class="btn-primary" @click="saveP">Enregistrer</button></template>
    </Modal>
    <Modal :open="sOpen" :title="sEdit.intitule" @close="sOpen = false">
      <div class="space-y-4"><div class="grid gap-4 sm:grid-cols-2"><div><label for="sd" class="label">Début</label><input id="sd" v-model="sEdit.debut" type="date" class="input" /></div><div><label for="sf" class="label">Fin</label><input id="sf" v-model="sEdit.fin" type="date" class="input" /></div></div>
        <div><label for="sl" class="label">Date limite d’inscription</label><input id="sl" v-model="sEdit.limite" type="date" class="input" /></div>
        <div><label for="ss" class="label">Statut</label><select id="ss" v-model="sEdit.statut" class="input"><option value="ouverte">Ouverte</option><option value="fermee">Fermée</option><option value="brouillon">Brouillon</option></select></div></div>
      <template #footer><button class="btn-outline" @click="sOpen = false">Annuler</button><button class="btn-primary" @click="saveS">Enregistrer</button></template>
    </Modal>
  </div>
</template>
