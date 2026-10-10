<script setup lang="ts">
defineProps<{ op: 'MTN' | 'ORANGE'; size?: 'sm' | 'md' }>()
</script>

<template>
  <span class="inline-flex items-center justify-center rounded-lg font-bold leading-none"
    :class="[op === 'MTN' ? 'bg-mtn text-navy-950' : 'bg-orange-om text-white', size === 'md' ? 'h-9 px-3 text-sm' : 'h-6 px-2 text-[11px]']">
    {{ op === 'MTN' ? 'MTN MoMo' : 'Orange Money' }}
  </span>
</template>
