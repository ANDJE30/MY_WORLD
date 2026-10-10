<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Icon from '../../../components/Icon.vue'
import { getOffres } from '../../../api'
import { fmtDate, t } from '../../../lib/i18n'
import type { OffreCode } from '../../../lib/types'

defineProps<{ modelValue: OffreCode | ''; adding?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [OffreCode] }>()
type Row = Awaited<ReturnType<typeof getOffres>>[number]
const rows = ref<Row[] | null>(null)
onMounted(async () => (rows.value = await getOffres()))
const ICON: Record<OffreCode, string> = { CRN: 'book', SPT: 'sport', INF: 'laptop' }
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso + 'T23:59:59').getTime() - Date.now()) / 86400000))
</script>

<template>
  <section>
    <h2 id="s1-title" class="text-2xl">{{ adding ? t('s1.titleAdd') : t('s1.title') }}</h2>
    <p class="mt-1.5 text-slate-600">{{ t('s1.lead') }}</p>
    <div class="mt-6 grid gap-3" role="radiogroup" aria-labelledby="s1-title">
      <template v-if="!rows"><div v-for="i in 3" :key="i" class="h-36 animate-pulse rounded-2xl bg-slate-100" /></template>
      <label v-for="r in rows" v-else :key="r.session.id" class="relative block cursor-pointer">
        <input type="radio" name="offre" class="peer sr-only" :value="r.session.offre" :checked="modelValue === r.session.offre" @change="emit('update:modelValue', r.session.offre)" />
        <div class="flex gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 transition hover:border-navy-300 peer-checked:border-navy-700 peer-checked:bg-navy-50/60 peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-navy-600 peer-focus-visible:ring-offset-2 sm:p-5">
          <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy-800 text-white sm:h-14 sm:w-14"><Icon :name="ICON[r.session.offre]" :size="26" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 class="text-base sm:text-lg">{{ t(`offer.${r.session.offre}.name`) }}</h3>
              <span v-if="r.places === 0" class="chip-gold">{{ t('s1.full') }}</span>
              <span v-else-if="r.places / r.capacite < 0.15" class="chip-red">{{ t('s1.few', { n: r.places }) }}</span>
              <span v-else class="chip-green">{{ t('s1.seats', { n: r.places }) }}</span>
            </div>
            <p class="mt-0.5 text-sm text-slate-600">{{ t(`offer.${r.session.offre}.who`) }}</p>
            <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
              <span class="inline-flex items-center gap-1.5"><Icon name="calendar" :size="14" />{{ fmtDate(r.session.debut, { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
              <span class="inline-flex items-center gap-1.5"><Icon name="clock" :size="14" />{{ t('s1.until', { d: fmtDate(r.session.limite, { day: 'numeric', month: 'short' }), n: daysLeft(r.session.limite) }) }}</span>
            </p>
          </div>
          <span class="mt-1 hidden h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition sm:grid" :class="modelValue === r.session.offre ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300 text-transparent'" aria-hidden="true">
            <Icon name="check" :size="14" :stroke="3" />
          </span>
        </div>
      </label>
    </div>
  </section>
</template>
