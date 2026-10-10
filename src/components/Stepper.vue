<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { t } from '../lib/i18n'

const props = defineProps<{ step: number }>()
const labels = computed(() => [t('step.1'), t('step.2'), t('step.3'), t('step.4'), t('step.5')])
</script>

<template>
  <nav :aria-label="t('step.aria')">
    <!-- mobile -->
    <div class="sm:hidden">
      <div class="flex items-baseline justify-between">
        <p class="text-sm font-semibold text-navy-900">{{ t('step.of', { n: step, total: 5 }) }}</p>
        <p class="text-sm text-slate-500">{{ labels[step - 1] }}</p>
      </div>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" :aria-valuenow="step" aria-valuemin="1" aria-valuemax="5">
        <div class="h-full rounded-full bg-gradient-to-r from-navy-700 to-gold-500 transition-all duration-500" :style="{ width: `${(step / 5) * 100}%` }" />
      </div>
    </div>
    <!-- desktop -->
    <ol class="hidden items-center sm:flex">
      <li v-for="(l, i) in labels" :key="i" class="flex flex-1 items-center last:flex-none" :aria-current="step === i + 1 ? 'step' : undefined">
        <span class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition"
            :class="step > i + 1 ? 'bg-emerald-600 text-white' : step === i + 1 ? 'bg-navy-800 text-white ring-4 ring-navy-800/15' : 'bg-slate-200 text-slate-500'">
            <Icon v-if="step > i + 1" name="check" :size="17" :stroke="2.6" /><template v-else>{{ i + 1 }}</template>
          </span>
          <span class="text-sm font-medium" :class="step === i + 1 ? 'text-navy-900' : step > i + 1 ? 'text-slate-700' : 'text-slate-400'">{{ l }}</span>
        </span>
        <span v-if="i < 4" class="mx-3 h-0.5 flex-1 rounded-full transition" :class="step > i + 1 ? 'bg-emerald-500' : 'bg-slate-200'" />
      </li>
    </ol>
  </nav>
</template>
