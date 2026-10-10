<script setup lang="ts">
withDefaults(defineProps<{ dark?: boolean; compact?: boolean }>(), { dark: false, compact: false })
</script>

<template>
  <span class="inline-flex items-center gap-3">
    <svg viewBox="0 0 64 64" class="h-10 w-10 shrink-0 drop-shadow-sm" aria-hidden="true">
      <path d="M32 3 57 12v21c0 15-11 25-25 29C18 58 7 48 7 33V12z" :fill="dark ? '#fff' : '#0d2145'" />
      <path d="M32 7 53 14.500V33c0 12.500-9 21-21 24.500C20 54 11 45.500 11 33V14.500z" fill="none" stroke="#d4a02a" stroke-width="2" />
      <path d="M20 20h7l5 15 5-15h7L35 46h-6z" :fill="dark ? '#0d2145' : '#fff'" />
      <path d="m32 11 1.600 3.300 3.600.5-2.600 2.500.6 3.600L32 19l-3.200 1.900.6-3.600-2.600-2.500 3.600-.5z" fill="#d4a02a" />
    </svg>
    <span v-if="!compact" class="leading-tight">
      <span class="block text-[15px] font-semibold tracking-tight" :class="dark ? 'text-white' : 'text-navy-900'">Collège Vogt</span>
      <span class="block text-[11px] font-medium uppercase tracking-[.12em]" :class="dark ? 'text-gold-300' : 'text-gold-700'">Inscriptions en ligne</span>
    </span>
  </span>
</template>
