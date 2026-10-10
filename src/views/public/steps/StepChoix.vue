<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../../../components/Icon.vue'
import { db, disponibilite } from '../../../api'
import { catalogueOf } from '../../../api/domain'
import { conflitsCreneau, prerequisManquants, prestationsPour, sessionDe, categorieParticipant } from '../../../lib/rules'
import { validerChoix } from '../../../lib/validate'
import { fcfa } from '../../../lib/money'
import { t } from '../../../lib/i18n'
import type { Participant, Prestation } from '../../../lib/types'

const p = defineModel<Participant>({ required: true })
const cat = computed(() => catalogueOf(db))
const session = computed(() => sessionDe(cat.value, p.value.offre))
const items = computed(() => prestationsPour(p.value, cat.value, session.value))
const submitted = ref(false)
const blocked = ref('')
const errs = computed(() => validerChoix(p.value, cat.value, t))
const dispo = (pr: Prestation) => disponibilite(pr.id, p.value)
const selected = (id: string) => p.value.choix.includes(id)
const multi = computed(() => p.value.offre !== 'SPT')

function conflictWith(pr: Prestation): Prestation | undefined {
  if (!pr.creneau || selected(pr.id)) return undefined
  return items.value.find((o) => o.id !== pr.id && selected(o.id) && o.creneau === pr.creneau)
}

function toggle(pr: Prestation) {
  blocked.value = ''
  if (!multi.value) { p.value.choix = [pr.id]; return }
  if (selected(pr.id)) { p.value.choix = p.value.choix.filter((x) => x !== pr.id); return }
  const c = conflictWith(pr)
  if (c) { blocked.value = t('err.creneau', { a: pr.libelle, b: c.libelle }); return }
  p.value.choix = [...p.value.choix, pr.id]
}

const subtotal = computed(() => p.value.choix.reduce((a, id) => a + (cat.value.prestations.find((x) => x.id === id)?.tarif ?? 0), 0))
const plafond = computed(() => cat.value.params.forfaitPlafondCRN)
const remise = computed(() => cat.value.params.remiseINF)
const warnings = computed(() => (p.value.offre === 'INF' ? prerequisManquants(p.value.choix, cat.value) : []))
const cible = computed(() => {
  if (p.value.offre === 'CRN') return p.value.classePreparee
  if (p.value.offre === 'SPT') return categorieParticipant(p.value, session.value, cat.value)?.categorie?.code
  return ''
})

function validate(): boolean {
  submitted.value = true
  if (conflitsCreneau(p.value.choix, cat.value).length) blocked.value = errs.value.creneau ?? ''
  return Object.keys(errs.value).length === 0
}
defineExpose({ validate })
</script>

<template>
  <section>
    <h2 id="s3-title" class="text-2xl">{{ t(`s3.title.${p.offre}`) }}</h2>
    <p class="mt-1.5 text-slate-600">
      {{ t(`s3.lead.${p.offre}`) }}
      <span v-if="cible" class="chip-navy ml-1 align-middle">{{ cible }}</span>
    </p>

    <!-- Aides tarifaires -->
    <div v-if="p.offre === 'CRN'" class="mt-5 rounded-2xl bg-navy-50 p-4">
      <div class="flex items-center justify-between text-sm"><span class="font-medium text-navy-800">{{ t('s3.cap') }}</span><span class="tabular font-semibold text-navy-900">{{ fcfa(Math.min(subtotal, plafond)) }} / {{ fcfa(plafond) }}</span></div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-white"><div class="h-full rounded-full bg-gradient-to-r from-navy-600 to-gold-500 transition-all duration-500" :style="{ width: `${Math.min(100, (subtotal / plafond) * 100)}%` }" /></div>
      <p class="mt-2 text-xs text-navy-700">{{ subtotal > plafond ? t('s3.capReached', { n: fcfa(subtotal - plafond) }) : t('s3.capHint', { n: fcfa(plafond) }) }}</p>
    </div>
    <div v-if="p.offre === 'INF' && remise.pct > 0" class="mt-5 flex items-center gap-3 rounded-2xl p-4 text-sm" :class="p.choix.length >= remise.minModules ? 'bg-emerald-50 text-emerald-900' : 'bg-gold-50 text-gold-900'">
      <Icon :name="p.choix.length >= remise.minModules ? 'check' : 'star'" :size="20" class="shrink-0" />
      <p>{{ p.choix.length >= remise.minModules ? t('s3.discountOn', { pct: remise.pct }) : t('s3.discountHint', { n: remise.minModules, pct: remise.pct, left: remise.minModules - p.choix.length }) }}</p>
    </div>

    <div v-if="blocked" class="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <Icon name="alert" :size="20" class="mt-0.5 shrink-0" /><p>{{ blocked }}</p>
    </div>

    <p v-if="!items.length" class="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">{{ t('s3.none') }}</p>

    <div class="mt-6 grid gap-3 sm:grid-cols-2" :role="multi ? 'group' : 'radiogroup'" aria-labelledby="s3-title" data-field="choix">
      <label v-for="pr in items" :key="pr.id" class="relative block cursor-pointer">
        <input :type="multi ? 'checkbox' : 'radio'" name="choix" class="peer sr-only" :checked="selected(pr.id)" @change="toggle(pr)" @click="blocked = ''" />
        <div class="flex h-full flex-col rounded-2xl border-2 bg-white p-4 transition hover:border-navy-300 peer-focus-visible:ring-2 peer-focus-visible:ring-navy-600 peer-focus-visible:ring-offset-2"
          :class="[selected(pr.id) ? 'border-navy-700 bg-navy-50/60 shadow-card' : conflictWith(pr) ? 'border-slate-200 opacity-60' : 'border-slate-200', submitted && errs.choix ? 'border-red-300' : '']">
          <div class="flex items-start gap-3">
            <span class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center border-2 transition" :class="[multi ? 'rounded-md' : 'rounded-full', selected(pr.id) ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300 text-transparent']"><Icon name="check" :size="14" :stroke="3" /></span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold leading-snug text-navy-900">{{ pr.libelle }}</p>
              <p v-if="pr.description" class="mt-0.5 text-[13px] leading-snug text-slate-500">{{ pr.description }}</p>
            </div>
            <p class="tabular whitespace-nowrap text-sm font-bold text-navy-900">{{ fcfa(pr.tarif) }}</p>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-1.5 pl-9">
            <span v-if="pr.duree" class="chip-slate"><Icon name="clock" :size="12" />{{ pr.duree }} h</span>
            <span v-if="pr.creneauLibelle" class="chip-slate"><Icon name="calendar" :size="12" />{{ pr.creneauLibelle }}</span>
            <span v-if="dispo(pr).complet" class="chip-gold">{{ t('s3.waitlist') }}</span>
            <span v-else-if="dispo(pr).restantes <= 5" class="chip-red">{{ t('s1.few', { n: dispo(pr).restantes }) }}</span>
            <span v-else class="chip-green">{{ t('s1.seats', { n: dispo(pr).restantes }) }}</span>
            <span v-if="pr.prerequis" class="chip-amber">{{ t('s3.prereq', { m: cat.prestations.find((x) => x.id === pr.prerequis)?.libelle ?? '' }) }}</span>
          </div>
          <p v-if="conflictWith(pr)" class="mt-2 pl-9 text-xs font-medium text-red-700">{{ t('s3.conflict', { m: conflictWith(pr)?.libelle ?? '' }) }}</p>
          <p v-if="selected(pr.id) && dispo(pr).complet" class="mt-2 pl-9 text-xs font-medium text-gold-800">{{ t('s3.waitlistNote') }}</p>
        </div>
      </label>
    </div>

    <p v-if="submitted && errs.choix" class="error mt-4" role="alert"><Icon name="alert" :size="16" class="mt-px" />{{ errs.choix }}</p>

    <div v-for="w in warnings" :key="w.module.id" class="mt-4 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      <Icon name="alert" :size="20" class="mt-0.5 shrink-0" /><p>{{ t('s3.prereqWarn', { m: w.module.libelle, p: w.prerequis.libelle }) }}</p>
    </div>
  </section>
</template>
