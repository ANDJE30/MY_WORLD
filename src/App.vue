<script setup lang="ts">
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <a href="#contenu" class="sr-only z-[70] rounded-lg bg-white px-4 py-2 font-semibold text-navy-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Aller au contenu</a>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in"><component :is="Component" /></Transition>
  </RouterView>
  <ToastHost />
</template>
