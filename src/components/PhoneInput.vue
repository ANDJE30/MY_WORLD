<script setup lang="ts">
import { computed } from 'vue'
import { groupNational, nationalDigits, suggestOperator } from '../lib/phone'

const props = defineProps<{ modelValue: string; id: string; describedby?: string; invalid?: boolean; showOperator?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string]; blur: [] }>()
const shown = computed(() => groupNational(props.modelValue))
const op = computed(() => (props.showOperator ? suggestOperator(props.modelValue) : null))
function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const v = nationalDigits(el.value)
  emit('update:modelValue', v)
  el.value = groupNational(v)
}
</script>

<template>
  <div class="relative">
    <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-2 pl-3.5 text-base font-medium text-slate-600">
      <span aria-hidden="true">🇨🇲</span>+237
    </span>
    <input
      :id="id" type="tel" inputmode="numeric" autocomplete="tel-national" class="input pl-[5.25rem] tabular" :class="op ? 'pr-24' : ''"
      :value="shown" :placeholder="placeholder ?? '6 77 12 34 56'" :aria-invalid="invalid" :aria-describedby="describedby"
      @input="onInput" @blur="emit('blur')"
    />
    <span v-if="op" class="absolute inset-y-0 right-2.5 flex items-center">
      <span class="chip" :class="op === 'MTN' ? 'bg-mtn text-navy-950' : 'bg-orange-om text-white'">{{ op === 'MTN' ? 'MTN' : 'Orange' }}</span>
    </span>
  </div>
</template>
