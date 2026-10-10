<script setup lang="ts">
import { t } from '../../lib/i18n'
</script>
<template>
  <div class="container-page py-24 text-center">
    <p class="text-6xl font-bold text-gold-500">404</p>
    <h1 class="mt-4 text-2xl">{{ t('nf.title') }}</h1>
    <p class="mt-2 text-slate-600">{{ t('nf.text') }}</p>
    <RouterLink :to="{ name: 'home' }" class="btn-primary mt-6">{{ t('common.home') }}</RouterLink>
  </div>
</template>
