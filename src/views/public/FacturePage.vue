<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../../components/Icon.vue'
import Invoice from '../../components/Invoice.vue'
import { getFacturePack } from '../../api'
import { printElement } from '../../lib/print'
import { t } from '../../lib/i18n'
import { ref } from 'vue'

const props = defineProps<{ code: string }>()
const pack = computed(() => getFacturePack(props.code))
const dup = ref(false)
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <div v-if="!pack" class="card card-pad mx-auto max-w-lg text-center">
      <Icon name="alert" :size="32" class="mx-auto text-amber-600" /><h1 class="mt-3 text-xl">{{ t('inv.notFound') }}</h1>
      <RouterLink :to="{ name: 'verifier' }" class="btn-primary mt-5">{{ t('nav.verify') }}</RouterLink>
    </div>
    <div v-else class="mx-auto max-w-4xl">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 class="text-2xl">{{ t('inv.title') }}</h1><p class="font-mono text-sm text-slate-500">{{ pack.facture.numero }}</p></div>
        <div class="flex gap-2">
          <button class="btn-primary btn-sm" @click="dup = true; $nextTick(() => printElement('#facture-print', 'A5 landscape'))"><Icon name="download" :size="16" />{{ t('inv.duplicata') }}</button>
          <button class="btn-outline btn-sm" @click="dup = false; $nextTick(() => printElement('#facture-print', 'A5 landscape'))"><Icon name="printer" :size="16" />{{ t('conf.print') }}</button>
        </div>
      </div>
      <div id="facture-print" class="overflow-hidden rounded-xl bg-slate-200/60 p-2 sm:p-4">
        <Invoice :facture="pack.facture" :commande="pack.commande" :paiement="pack.paiement" :avoirs="pack.avoirs" :duplicata="dup" />
      </div>
    </div>
  </div>
</template>
