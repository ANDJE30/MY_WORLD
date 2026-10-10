<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ s: string }>()
const MAP: Record<string, [string, string]> = {
  INITIEE: ['Initiée', 'chip-slate'], EN_ATTENTE: ['En attente', 'chip-amber'], REUSSIE: ['Réussie', 'chip-green'],
  ECHOUEE: ['Échouée', 'chip-red'], EXPIREE: ['Expirée', 'chip-slate'], REMBOURSEE: ['Remboursée', 'chip-navy'],
  CONFIRMEE: ['Confirmée', 'chip-green'], RESERVEE: ['Réservée', 'chip-amber'], LISTE_ATTENTE: ['Liste d’attente', 'chip-gold'],
  LIBEREE: ['Libérée', 'chip-slate'], ANNULEE: ['Annulée', 'chip-red'], EN_ATTENTE_PAIEMENT: ['À payer', 'chip-amber'],
  PAYEE: ['Payée', 'chip-green'], ouverte: ['Ouverte', 'chip-green'], fermee: ['Fermée', 'chip-slate'], brouillon: ['Brouillon', 'chip-amber'],
}
const v = computed(() => MAP[props.s] ?? [props.s, 'chip-slate'])
</script>

<template><span :class="v[1]">{{ v[0] }}</span></template>
