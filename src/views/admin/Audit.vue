<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { db } from '../../api'
import { fmtDateTime } from '../../lib/i18n'

const q = ref('')
const action = ref('')
const actions = computed(() => [...new Set(db.audit.map((a) => a.action))].sort())
const rows = computed(() => db.audit.filter((a) => (!action.value || a.action === action.value) && (!q.value || `${a.utilisateur} ${a.objet} ${a.avant ?? ''} ${a.apres ?? ''}`.toLowerCase().includes(q.value.toLowerCase()))).slice(0, 150))
const TONE = (a: string) => (/REJETE|ECHEC|DESACTIVE/.test(a) ? 'chip-red' : /AVOIR|TARIF|ROLE|EXPORT/.test(a) ? 'chip-gold' : 'chip-navy')
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <div class="card flex flex-col gap-3 p-4 sm:flex-row"><div class="relative flex-1"><Icon name="search" :size="18" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="q" class="input pl-11" placeholder="Rechercher un utilisateur, un objet…" aria-label="Rechercher" /></div>
      <select v-model="action" class="input sm:w-64" aria-label="Action"><option value="">Toutes les actions</option><option v-for="a in actions" :key="a" :value="a">{{ a }}</option></select></div>
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl min-w-[800px]">
      <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Objet</th><th>Avant → après</th></tr></thead>
      <tbody><tr v-for="a in rows" :key="a.id"><td class="whitespace-nowrap text-slate-600">{{ fmtDateTime(a.date) }}</td><td>{{ a.utilisateur }}</td><td><span :class="TONE(a.action)">{{ a.action }}</span></td><td class="text-slate-800">{{ a.objet }}</td>
        <td class="text-xs text-slate-600"><template v-if="a.avant || a.apres"><span class="line-through opacity-70">{{ a.avant }}</span><template v-if="a.avant && a.apres"> → </template>{{ a.apres }}</template><template v-else>—</template></td></tr>
        <tr v-if="!rows.length"><td colspan="5" class="py-14 text-center text-slate-500">Aucune entrée.</td></tr></tbody></table></div>
      <p class="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Journal conservé un an ; l’horloge du serveur est synchronisée (NTP) — ENF-11.</p></div>
  </div>
</template>
