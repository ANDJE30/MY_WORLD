<script setup lang="ts">
defineProps<{ modelValue: string; options: { value: string; label: string }[]; name: string; invalid?: boolean; labelledby?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string]; blur: [] }>()
</script>

<template>
  <div role="radiogroup" :aria-labelledby="labelledby" class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }">
    <label v-for="o in options" :key="o.value" class="relative cursor-pointer">
      <input type="radio" :name="name" :value="o.value" :checked="modelValue === o.value" class="peer sr-only" @change="emit('update:modelValue', o.value)" @blur="emit('blur')" />
      <span class="flex min-h-[48px] items-center justify-center rounded-xl border bg-white px-3 text-center text-[15px] font-medium text-slate-700 transition hover:border-navy-300 peer-checked:border-navy-700 peer-checked:bg-navy-800 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-navy-600 peer-focus-visible:ring-offset-2"
        :class="invalid ? 'border-red-400' : 'border-slate-300'">{{ o.label }}</span>
    </label>
  </div>
</template>
