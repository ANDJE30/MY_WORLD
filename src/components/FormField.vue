<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ label: string; name: string; error?: string; hint?: string; required?: boolean; optional?: boolean; optionalText?: string; group?: boolean }>()
const id = computed(() => `f-${props.name}`)
const describedby = computed(() => [props.error ? `${id.value}-err` : '', props.hint ? `${id.value}-hint` : ''].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div :data-field="name" :data-invalid="error ? 'true' : undefined">
    <component :is="group ? 'p' : 'label'" :id="group ? `${id}-label` : undefined" :for="group ? undefined : id" class="label">
      {{ label }}
      <span v-if="required" class="text-red-600" aria-hidden="true"> *</span>
      <span v-else-if="optional" class="ml-1 text-xs font-normal text-slate-400">({{ optionalText ?? 'facultatif' }})</span>
    </component>
    <slot :id="id" :describedby="describedby" :invalid="!!error" :labelledby="`${id}-label`" />
    <p v-if="hint && !error" :id="`${id}-hint`" class="hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-err`" class="error" role="alert"><Icon name="alert" :size="16" class="mt-px" />{{ error }}</p>
  </div>
</template>
