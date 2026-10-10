<script setup lang="ts">
import { dismiss, toasts } from '../composables/toast'
import Icon from './Icon.vue'
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 pt-safe sm:items-end" aria-live="polite" role="status">
    <TransitionGroup name="slide">
      <div v-for="t in toasts" :key="t.id" class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white p-4 shadow-pop"
        :class="t.kind === 'error' ? 'border-red-200' : t.kind === 'success' ? 'border-emerald-200' : 'border-navy-100'">
        <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          :class="t.kind === 'error' ? 'bg-red-100 text-red-700' : t.kind === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-navy-100 text-navy-700'">
          <Icon :name="t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'" :size="16" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-navy-900">{{ t.title }}</p>
          <p v-if="t.text" class="mt-0.5 text-[13px] leading-snug text-slate-600">{{ t.text }}</p>
        </div>
        <button class="-m-1 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Fermer" @click="dismiss(t.id)"><Icon name="x" :size="16" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>
