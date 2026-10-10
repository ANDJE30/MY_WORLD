<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ open: boolean; title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
let previous: HTMLElement | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'Tab' && panel.value) {
    const f = panel.value.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')
    if (!f.length) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}
watch(() => props.open, async (o) => {
  if (o) {
    previous = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    await nextTick()
    panel.value?.focus()
  } else {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', onKey)
    previous?.focus()
  }
})
onBeforeUnmount(() => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey) })
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" @mousedown.self="emit('close')">
        <Transition name="pop" appear>
          <div v-if="open" ref="panel" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1"
            class="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-3xl" :class="wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'">
            <header class="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 class="text-lg">{{ title }}</h2>
              <button class="btn-ghost btn-sm -mr-2 !px-2" :aria-label="'Fermer'" @click="emit('close')"><Icon name="x" /></button>
            </header>
            <div class="overflow-y-auto px-5 py-5 sm:px-6"><slot /></div>
            <footer v-if="$slots.footer" class="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><slot name="footer" /></footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
