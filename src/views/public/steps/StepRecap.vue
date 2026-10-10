<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import FormField from '../../../components/FormField.vue'
import PhoneInput from '../../../components/PhoneInput.vue'
import LegalModal from '../../../components/LegalModal.vue'
import Icon from '../../../components/Icon.vue'
import { devis } from '../../../api'
import { draft } from '../../../composables/draft'
import { validerPayeur } from '../../../lib/validate'
import { fcfa, nombre } from '../../../lib/money'
import { printElement } from '../../../lib/print'
import { nomComplet } from '../../../lib/rules'
import { fmtDate, t } from '../../../lib/i18n'
import { OFFRES } from '../../../lib/types'

const emit = defineEmits<{ edit: [number]; remove: [number]; add: [] }>()
const d = computed(() => devis(draft.participants))
const submitted = ref(false)
const touched = reactive<Record<string, boolean>>({})
const legal = ref<'cgu' | 'donnees' | null>(null)
const errs = computed(() => validerPayeur(draft.payeur, t))
const err = (k: string) => (submitted.value || touched[k] ? errs.value[k] : undefined)
const consentErr = computed(() => submitted.value && (!draft.cgu || !draft.donnees))
const touch = (k: string) => { touched[k] = true; draft.payeurTouched = true }

function lignesDe(id: string) { return d.value.lignes.filter((l) => l.participantId === id) }
function attenteDe(id: string) { return d.value.attente.filter((l) => l.participantId === id) }
const mineur = computed(() => draft.participants.some((p) => p.offre !== 'INF' || p.profession === 'eleve'))

function validate(): boolean {
  submitted.value = true
  const ok = Object.keys(errs.value).length === 0 && draft.cgu && draft.donnees
  if (!ok) {
    requestAnimationFrame(() => {
      const first = Object.keys(errs.value)[0]
      const el = document.querySelector<HTMLElement>(first ? `[data-field="${first}"]` : '#consent')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
    })
  }
  return ok
}
defineExpose({ validate })
const today = new Date().toISOString()
</script>

<template>
  <section>
    <h2 class="text-2xl">{{ t('s4.title') }}</h2>
    <p class="mt-1.5 text-slate-600">{{ t('s4.lead') }}</p>

    <div class="mt-6 space-y-3">
      <article v-for="(p, i) in draft.participants" :key="p.id" class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <span class="chip-navy">{{ OFFRES[p.offre].libelle }}</span>
            <h3 class="mt-2 truncate text-base">{{ nomComplet(p) }}</h3>
            <p class="text-[13px] text-slate-500">
              <template v-if="p.offre === 'CRN'">{{ p.classePrecedente }} → {{ p.classePreparee }}</template>
              <template v-else-if="p.offre === 'SPT'">{{ p.naissance }}</template>
              <template v-else>{{ t(`prof.${p.profession || 'autre'}`) }}</template>
            </p>
          </div>
          <div class="flex shrink-0 gap-1">
            <button class="btn-ghost btn-sm !px-2.5" :aria-label="t('common.edit') + ' ' + nomComplet(p)" @click="emit('edit', i)"><Icon name="edit" :size="17" /><span class="hidden sm:inline">{{ t('common.edit') }}</span></button>
            <button v-if="draft.participants.length > 1" class="btn-ghost btn-sm !px-2.5 text-red-700 hover:!bg-red-50" :aria-label="t('common.remove') + ' ' + nomComplet(p)" @click="emit('remove', i)"><Icon name="trash" :size="17" /></button>
          </div>
        </div>
        <ul class="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-sm">
          <li v-for="(l, k) in lignesDe(p.id)" :key="k" class="flex justify-between gap-3 py-2" :class="l.kind === 'remise' ? 'font-medium text-emerald-700' : ''">
            <span>{{ l.libelle }}<span v-if="l.detail" class="text-slate-400"> · {{ l.detail }}</span></span>
            <span class="tabular whitespace-nowrap">{{ l.montant < 0 ? '− ' : '' }}{{ fcfa(Math.abs(l.montant)) }}</span>
          </li>
          <li v-for="(l, k) in attenteDe(p.id)" :key="'w' + k" class="flex justify-between gap-3 py-2 text-gold-800">
            <span>{{ l.libelle }} <span class="chip-gold ml-1">{{ t('s3.waitlist') }}</span></span><span class="text-xs">{{ t('s4.noPay') }}</span>
          </li>
        </ul>
      </article>
    </div>
    <button class="btn-outline mt-3 w-full border-dashed" @click="emit('add')"><Icon name="plus" :size="18" />{{ t('s4.addParticipant') }}</button>

    <!-- Payeur -->
    <fieldset class="mt-9 space-y-5">
      <legend class="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-700"><Icon name="wallet" :size="16" />{{ t('s4.payer') }}</legend>
      <p class="text-sm text-slate-600">{{ t('s4.payerLead') }}</p>
      <div class="grid gap-5 sm:grid-cols-2">
        <FormField v-slot="s" :label="t('f.payerNom')" name="nom" :error="err('nom')" required>
          <input :id="s.id" v-model="draft.payeur.nom" class="input" autocomplete="name" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('nom')" />
        </FormField>
        <FormField v-slot="s" :label="t('f.payerTel')" name="tel" :error="err('tel')" :hint="t('f.payerTelHint')" required>
          <PhoneInput :id="s.id" v-model="draft.payeur.tel" show-operator :invalid="s.invalid" :describedby="s.describedby" @blur="touch('tel')" />
        </FormField>
      </div>
      <FormField v-slot="s" :label="t('f.email')" name="email" :error="err('email')" :hint="t('f.emailInvoice')" optional :optional-text="t('common.optional')">
        <input :id="s.id" v-model="draft.payeur.email" type="email" inputmode="email" autocomplete="email" class="input sm:max-w-md" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('email')" />
      </FormField>
    </fieldset>

    <!-- Total -->
    <div class="mt-8 overflow-hidden rounded-2xl bg-navy-900 text-white">
      <dl class="space-y-2 p-5 text-sm">
        <div class="flex justify-between text-navy-200"><dt>{{ t('s4.subtotal') }}</dt><dd class="tabular">{{ fcfa(d.sousTotal) }}</dd></div>
        <div v-if="d.remises" class="flex justify-between text-emerald-300"><dt>{{ t('s4.discounts') }}</dt><dd class="tabular">− {{ fcfa(d.remises) }}</dd></div>
        <div v-if="d.frais" class="flex justify-between text-navy-200"><dt>{{ t('sum.fees') }}</dt><dd class="tabular">{{ fcfa(d.frais) }}</dd></div>
      </dl>
      <div class="flex items-baseline justify-between bg-white/5 px-5 py-4">
        <span class="font-medium">{{ t('s4.toPay') }}</span>
        <span class="tabular text-3xl font-bold text-gold-300">{{ fcfa(d.aPayer) }}</span>
      </div>
    </div>
    <button class="btn-ghost mt-2 w-full sm:w-auto" @click="printElement('#devis-print', 'A4 portrait')"><Icon name="download" :size="17" />{{ t('s4.download') }}</button>

    <!-- Consentements -->
    <fieldset id="consent" class="mt-6 space-y-3">
      <legend class="sr-only">{{ t('s4.consents') }}</legend>
      <label class="flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition hover:border-navy-300" :class="submitted && !draft.cgu ? 'border-red-400' : 'border-slate-300'">
        <input v-model="draft.cgu" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-navy-800" />
        <span class="text-sm leading-relaxed text-slate-700">{{ t('s4.cguA') }} <button type="button" class="font-semibold text-navy-700 underline underline-offset-2" @click.prevent="legal = 'cgu'">{{ t('legal.cguTitle') }}</button>.</span>
      </label>
      <label class="flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition hover:border-navy-300" :class="submitted && !draft.donnees ? 'border-red-400' : 'border-slate-300'">
        <input v-model="draft.donnees" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-navy-800" />
        <span class="text-sm leading-relaxed text-slate-700">{{ mineur ? t('s4.dataMinor') : t('s4.data') }} <button type="button" class="font-semibold text-navy-700 underline underline-offset-2" @click.prevent="legal = 'donnees'">{{ t('legal.dataTitle') }}</button>.</span>
      </label>
      <p v-if="consentErr" class="error" role="alert"><Icon name="alert" :size="16" class="mt-px" />{{ t('err.consent') }}</p>
    </fieldset>
    <LegalModal :kind="legal" @close="legal = null" />

    <!-- Devis imprimable -->
    <div id="devis-print" class="print-only" style="font-family: Poppins, sans-serif; color: #0f172a">
      <h1 style="font-size: 20px; margin: 0">{{ t('s4.quote') }} · Collège Mgr François-Xavier Vogt</h1>
      <p style="margin: 4px 0 16px; color: #64748b; font-size: 12px">{{ fmtDate(today) }} — {{ t('s4.quoteNote') }}</p>
      <p style="font-size: 13px"><strong>{{ t('s4.payer') }} :</strong> {{ draft.payeur.nom }} · {{ draft.payeur.tel ? '+237 ' + draft.payeur.tel : '' }}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px">
        <thead><tr style="background: #0d2145; color: #fff"><th style="text-align: left; padding: 6px 8px">{{ t('s4.line') }}</th><th style="text-align: left; padding: 6px 8px">{{ t('s4.participant') }}</th><th style="text-align: right; padding: 6px 8px">FCFA</th></tr></thead>
        <tbody>
          <tr v-for="(l, i) in d.lignes" :key="i" style="border-bottom: 1px solid #e2e8f0"><td style="padding: 6px 8px">{{ l.libelle }} {{ l.detail ? '· ' + l.detail : '' }}</td><td style="padding: 6px 8px">{{ l.participantNom }}</td><td style="padding: 6px 8px; text-align: right">{{ nombre(l.montant) }}</td></tr>
        </tbody>
        <tfoot><tr><td colspan="2" style="padding: 10px 8px; text-align: right; font-weight: 700">{{ t('s4.toPay') }}</td><td style="padding: 10px 8px; text-align: right; font-weight: 700">{{ nombre(d.aPayer) }}</td></tr></tfoot>
      </table>
    </div>
  </section>
</template>
