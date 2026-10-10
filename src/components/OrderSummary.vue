<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { devis } from '../api'
import { fcfa } from '../lib/money'
import { t } from '../lib/i18n'
import type { Participant } from '../lib/types'

const props = defineProps<{ participants: Participant[] }>()
const d = computed(() => devis(props.participants.filter((p) => p.choix.length)))
const groups = computed(() => {
  const m = new Map<string, typeof d.value.lignes>()
  for (const l of d.value.lignes) m.set(l.participantId, [...(m.get(l.participantId) ?? []), l])
  return [...m.entries()].map(([id, lignes]) => ({ id, nom: lignes[0].participantNom, lignes }))
})
</script>

<template>
  <aside class="card overflow-hidden" :aria-label="t('sum.title')">
    <div class="flex items-center justify-between border-b border-slate-100 bg-navy-900 px-5 py-4 text-white">
      <h2 class="text-base !text-white">{{ t('sum.title') }}</h2>
      <Icon name="receipt" :size="20" class="text-gold-300" />
    </div>
    <div class="p-5">
      <p v-if="!groups.length && !d.attente.length" class="py-6 text-center text-sm text-slate-500">{{ t('sum.empty') }}</p>
      <div v-for="g in groups" :key="g.id" class="mb-4 last:mb-0">
        <p class="text-[13px] font-semibold text-navy-900">{{ g.nom }}</p>
        <ul class="mt-1.5 space-y-1">
          <li v-for="(l, i) in g.lignes" :key="i" class="flex justify-between gap-3 text-[13px]" :class="l.kind === 'remise' ? 'font-medium text-emerald-700' : 'text-slate-600'">
            <span>{{ l.libelle }}<span v-if="l.detail" class="text-slate-400"> · {{ l.detail }}</span></span>
            <span class="tabular whitespace-nowrap">{{ l.montant < 0 ? '− ' : '' }}{{ fcfa(Math.abs(l.montant)) }}</span>
          </li>
        </ul>
      </div>
      <div v-if="d.attente.length" class="mb-4 rounded-xl bg-gold-50 p-3 text-[13px] text-gold-900">
        <p class="font-semibold">{{ t('sum.waiting', { n: d.attente.length }) }}</p>
        <p class="mt-0.5 text-gold-800">{{ t('sum.waitingNote') }}</p>
      </div>
      <dl class="space-y-1.5 border-t border-dashed border-slate-200 pt-4 text-sm">
        <div v-if="d.frais" class="flex justify-between text-slate-600"><dt>{{ t('sum.fees') }}</dt><dd class="tabular">{{ fcfa(d.frais) }}</dd></div>
        <div class="flex items-baseline justify-between"><dt class="font-semibold text-navy-900">{{ t('sum.total') }}</dt><dd class="tabular text-2xl font-bold text-navy-900">{{ fcfa(d.aPayer) }}</dd></div>
      </dl>
      <p class="mt-4 flex items-start gap-2 rounded-xl bg-navy-50 p-3 text-xs leading-snug text-navy-800"><Icon name="lock" :size="15" class="mt-px" />{{ t('sum.secure') }}</p>
    </div>
  </aside>
</template>
