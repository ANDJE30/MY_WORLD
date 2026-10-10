<script setup lang="ts">
import { computed } from 'vue'
import Modal from './Modal.vue'
import { t } from '../lib/i18n'

const props = defineProps<{ kind: 'cgu' | 'donnees' | null }>()
const emit = defineEmits<{ close: [] }>()
const title = computed(() => (props.kind === 'cgu' ? t('legal.cguTitle') : t('legal.dataTitle')))
</script>

<template>
  <Modal :open="!!kind" :title="title" @close="emit('close')">
    <div v-if="kind === 'cgu'" class="space-y-3 text-sm leading-relaxed text-slate-700">
      <p>{{ t('legal.cgu1') }}</p>
      <p>{{ t('legal.cgu2') }}</p>
      <p>{{ t('legal.cgu3') }}</p>
      <p>{{ t('legal.cgu4') }}</p>
    </div>
    <div v-else class="space-y-3 text-sm leading-relaxed text-slate-700">
      <p>{{ t('legal.data1') }}</p>
      <p>{{ t('legal.data2') }}</p>
      <p>{{ t('legal.data3') }}</p>
      <p>{{ t('legal.data4') }}</p>
    </div>
    <template #footer><button class="btn-primary" @click="emit('close')">{{ t('common.understood') }}</button></template>
  </Modal>
</template>
