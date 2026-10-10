<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { verifier } from '../../api'
import { fcfa } from '../../lib/money'
import { fmtDateTime, t } from '../../lib/i18n'

const props = defineProps<{ code?: string }>()
const input = ref(props.code ?? '')
const loading = ref(false)
type R = Awaited<ReturnType<typeof verifier>>
const res = ref<R | undefined>(undefined)
const searched = ref(false)

async function check() {
  if (!input.value.trim()) return
  loading.value = true; searched.value = true
  res.value = await verifier(input.value)
  loading.value = false
}
onMounted(() => { if (props.code) check() })
</script>

<template>
  <div class="container-page py-10 sm:py-16">
    <div class="mx-auto max-w-xl">
      <div class="text-center">
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy-900 text-gold-300"><Icon name="qr" :size="28" /></span>
        <h1 class="mt-4 text-3xl">{{ t('ver.title') }}</h1>
        <p class="mt-2 text-slate-600">{{ t('ver.lead') }}</p>
      </div>
      <form class="card card-pad mt-8" @submit.prevent="check">
        <label for="code" class="label">{{ t('ver.label') }}</label>
        <div class="flex flex-col gap-3 sm:flex-row">
          <input id="code" v-model="input" class="input font-mono uppercase" autocomplete="off" autocapitalize="characters" placeholder="CFXV-2026-CRN-00001" />
          <button class="btn-primary shrink-0" :disabled="loading || !input.trim()">{{ loading ? t('ver.checking') : t('ver.check') }}</button>
        </div>
        <p class="hint">{{ t('ver.hint') }}</p>
      </form>

      <Transition name="slide" mode="out-in">
        <div v-if="searched && !loading" :key="res ? res.numero : 'none'" class="mt-6" aria-live="polite">
          <div v-if="res" class="card overflow-hidden">
            <div class="flex items-center gap-4 p-5" :class="res.statut === 'PAYEE' ? 'bg-emerald-50' : 'bg-amber-50'">
              <span class="grid h-14 w-14 place-items-center rounded-full text-white" :class="res.statut === 'PAYEE' ? 'bg-emerald-600' : 'bg-amber-600'"><Icon :name="res.statut === 'PAYEE' ? 'check' : 'alert'" :size="28" :stroke="2.6" /></span>
              <div><p class="text-lg font-bold" :class="res.statut === 'PAYEE' ? 'text-emerald-900' : 'text-amber-900'">{{ res.statut === 'PAYEE' ? t('ver.valid') : t('ver.refunded') }}</p><p class="text-sm" :class="res.statut === 'PAYEE' ? 'text-emerald-800' : 'text-amber-800'">{{ t('ver.authentic') }}</p></div>
            </div>
            <dl class="divide-y divide-slate-100 text-sm">
              <div class="flex justify-between gap-4 px-5 py-3.5"><dt class="text-slate-500">{{ t('ver.number') }}</dt><dd class="font-mono font-semibold text-navy-900">{{ res.numero }}</dd></div>
              <div class="flex justify-between gap-4 px-5 py-3.5"><dt class="text-slate-500">{{ t('ver.date') }}</dt><dd class="font-medium text-navy-900">{{ fmtDateTime(res.date) }}</dd></div>
              <div class="flex justify-between gap-4 px-5 py-3.5"><dt class="text-slate-500">{{ t('ver.amount') }}</dt><dd class="tabular font-bold text-navy-900">{{ fcfa(res.montant) }}</dd></div>
              <div class="flex justify-between gap-4 px-5 py-3.5"><dt class="text-slate-500">{{ t('ver.status') }}</dt><dd><span :class="res.statut === 'PAYEE' ? 'chip-green' : 'chip-amber'">{{ res.statut === 'PAYEE' ? t('ver.paid') : t('ver.refundedShort') }}</span></dd></div>
            </dl>
            <p class="bg-slate-50 px-5 py-3 text-xs text-slate-500">{{ t('ver.privacy') }}</p>
          </div>
          <div v-else class="card flex items-center gap-4 border-red-200 bg-red-50 p-5">
            <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-red-600 text-white"><Icon name="x" :size="28" :stroke="2.6" /></span>
            <div><p class="text-lg font-bold text-red-900">{{ t('ver.unknown') }}</p><p class="text-sm text-red-800">{{ t('ver.unknownText') }}</p></div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
