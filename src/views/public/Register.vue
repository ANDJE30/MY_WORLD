<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'
import Stepper from '../../components/Stepper.vue'
import OrderSummary from '../../components/OrderSummary.vue'
import StepOffre from './steps/StepOffre.vue'
import StepParticipant from './steps/StepParticipant.vue'
import StepChoix from './steps/StepChoix.vue'
import StepRecap from './steps/StepRecap.vue'
import { draft, hasDraft, newParticipant, payeurSuggere, resetDraft } from '../../composables/draft'
import { toast } from '../../composables/toast'
import { devis, postCommande, ApiError } from '../../api'
import { fcfa } from '../../lib/money'
import { t } from '../../lib/i18n'
import type { OffreCode } from '../../lib/types'

const route = useRoute()
const router = useRouter()
const pending = ref<OffreCode | ''>('')
const offerError = ref(false)
const busy = ref(false)
const top = ref<HTMLElement | null>(null)
const partRef = ref<InstanceType<typeof StepParticipant> | null>(null)
const choixRef = ref<InstanceType<typeof StepChoix> | null>(null)
const recapRef = ref<InstanceType<typeof StepRecap> | null>(null)

const cur = computed(() => draft.participants[draft.current])
const adding = computed(() => draft.participants.length > 0 && draft.current >= draft.participants.length)
const total = computed(() => devis(draft.participants.filter((p) => p.choix.length)).aPayer)
const isOffer = (v: unknown): v is OffreCode => v === 'CRN' || v === 'SPT' || v === 'INF'

onMounted(() => {
  const q = route.query.offre
  if (!hasDraft() && isOffer(q)) startWith(q)
  else if (hasDraft() && draft.step > 1 && !cur.value) draft.step = 1
  pending.value = cur.value?.offre ?? (isOffer(q) ? q : '')
})

function startWith(o: OffreCode) {
  const prev = [...draft.participants].reverse().find((p) => p.offre === o)
  const p = newParticipant(o)
  // même famille : on reprend les coordonnées du parent et le contact d'urgence
  if (prev && o !== 'INF') Object.assign(p, { parentNom: prev.parentNom, parentTel: prev.parentTel, parentEmail: prev.parentEmail, urgenceNom: prev.urgenceNom, urgenceTel: prev.urgenceTel, nom: prev.nom })
  if (draft.current >= draft.participants.length) { draft.participants.push(p); draft.current = draft.participants.length - 1 }
  else draft.participants[draft.current] = p
  draft.step = 2
}

async function go(step: 1 | 2 | 3 | 4) {
  draft.step = step
  await nextTick()
  top.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function next() {
  if (busy.value) return
  if (draft.step === 1) {
    if (!pending.value) { offerError.value = true; return }
    if (!cur.value || cur.value.offre !== pending.value) startWith(pending.value)
    return go(2)
  }
  if (draft.step === 2) { if (partRef.value?.validate()) go(3); return }
  if (draft.step === 3) {
    if (!choixRef.value?.validate()) return
    if (!draft.payeurTouched) draft.payeur = payeurSuggere(draft.participants[0])
    return go(4)
  }
  if (draft.step === 4) {
    if (!recapRef.value?.validate()) return
    busy.value = true
    try {
      const c = await postCommande({ payeur: { ...draft.payeur }, participants: draft.participants, consentement: { cgu: draft.cgu, donnees: draft.donnees } })
      resetDraft()
      router.push(c.statut === 'LISTE_ATTENTE' ? { name: 'confirmation', params: { id: c.id } } : { name: 'paiement', params: { id: c.id } })
    } catch (e) {
      toast('error', t('err.order'), e instanceof ApiError ? e.message : undefined)
    } finally { busy.value = false }
  }
}

function back() {
  if (draft.step === 4) return go(3)
  if (draft.step === 3) return go(2)
  if (draft.step === 2) { pending.value = cur.value?.offre ?? ''; return go(1) }
  if (adding.value) { draft.current = 0; return go(4) }
  router.push({ name: 'home' })
}

function edit(i: number) { draft.current = i; go(2) }
function remove(i: number) {
  if (!confirm(t('s4.confirmRemove'))) return
  draft.participants.splice(i, 1)
  draft.current = 0
  if (!draft.participants.length) { pending.value = ''; go(1) }
}
function add() { draft.current = draft.participants.length; pending.value = ''; go(1) }
function restart() {
  if (!confirm(t('reg.confirmRestart'))) return
  resetDraft(); pending.value = ''; offerError.value = false
}
const nextLabel = computed(() => (draft.step === 4 ? t('reg.pay') : t('common.continue')))
</script>

<template>
  <div class="container-page py-6 sm:py-10">
    <div ref="top" class="scroll-mt-24" />
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl sm:text-3xl">{{ t('reg.title') }}</h1>
        <p v-if="hasDraft()" class="mt-1 flex items-center gap-1.5 text-[13px] text-slate-500"><Icon name="check" :size="14" class="text-emerald-600" />{{ t('reg.saved') }}</p>
      </div>
      <button v-if="hasDraft()" class="btn-ghost btn-sm text-slate-500" @click="restart"><Icon name="refresh" :size="15" />{{ t('reg.restart') }}</button>
    </div>

    <Stepper :step="draft.step" class="mb-6 sm:mb-8" />

    <div class="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div>
        <div class="card card-pad min-h-[24rem]">
          <Transition name="slide" mode="out-in">
            <div :key="draft.step + '-' + draft.current">
              <StepOffre v-if="draft.step === 1" v-model="pending" :adding="adding" @update:model-value="offerError = false" />
              <StepParticipant v-else-if="draft.step === 2 && cur" ref="partRef" v-model="draft.participants[draft.current]" />
              <StepChoix v-else-if="draft.step === 3 && cur" ref="choixRef" v-model="draft.participants[draft.current]" />
              <StepRecap v-else-if="draft.step === 4" ref="recapRef" @edit="edit" @remove="remove" @add="add" />
            </div>
          </Transition>
          <p v-if="offerError && draft.step === 1" class="error mt-4" role="alert"><Icon name="alert" :size="16" class="mt-px" />{{ t('s1.required') }}</p>
        </div>

        <div class="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 pb-safe backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-card">
          <button class="btn-outline" @click="back"><Icon name="arrow-left" :size="18" /><span class="hidden sm:inline">{{ t('common.back') }}</span></button>
          <div class="ml-auto flex items-center gap-4">
            <p v-if="draft.step > 1" class="text-right leading-tight lg:hidden">
              <span class="block text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('sum.total') }}</span>
              <span class="tabular text-base font-bold text-navy-900">{{ fcfa(total) }}</span>
            </p>
            <button :class="draft.step === 4 ? 'btn-gold btn-lg' : 'btn-primary'" :disabled="busy" @click="next">
              <svg v-if="busy" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
              {{ busy ? t('reg.creating') : nextLabel }}<Icon v-if="!busy" name="arrow-right" :size="18" />
            </button>
          </div>
        </div>
      </div>

      <div class="hidden lg:sticky lg:top-24 lg:block">
        <OrderSummary :participants="draft.participants" />
        <p class="mt-4 flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500"><Icon name="phone" :size="15" class="mt-0.5" />{{ t('reg.help') }}</p>
      </div>
    </div>
  </div>
</template>
