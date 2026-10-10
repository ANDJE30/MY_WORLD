<script setup lang="ts">
import { maskDate } from '../lib/age'

defineProps<{ modelValue: string; id: string; describedby?: string; invalid?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string]; blur: [] }>()
function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const v = maskDate(el.value)
  el.value = v
  emit('update:modelValue', v)
}
</script>

<template>
  <input
    :id="id" type="text" inputmode="numeric" autocomplete="bday" class="input tabular" maxlength="10" placeholder="JJ/MM/AAAA"
    :value="modelValue" :aria-invalid="invalid" :aria-describedby="describedby" @input="onInput" @blur="emit('blur')"
  />
</template>
