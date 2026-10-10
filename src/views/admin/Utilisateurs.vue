<script setup lang="ts">
import { reactive, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import Modal from '../../components/Modal.vue'
import { ROLE_LABEL, db, log } from '../../api'
import { adminState } from '../../composables/adminAuth'
import { fmtDateTime } from '../../lib/i18n'
import { toast } from '../../composables/toast'
import type { Role } from '../../lib/types'

const open = ref(false)
const f = reactive({ nom: '', email: '', role: 'resp_crn' as Role })
const err = ref('')
const who = () => adminState.user?.nom ?? '?'
function add() {
  err.value = ''
  if (!f.nom.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) { err.value = 'Nom et adresse e-mail valides requis.'; return }
  if (db.utilisateurs.some((u) => u.email === f.email.toLowerCase())) { err.value = 'Cette adresse est déjà utilisée.'; return }
  db.utilisateurs.push({ id: `u${Date.now()}`, nom: f.nom.trim(), email: f.email.toLowerCase(), role: f.role, actif: true, motDePasse: 'Temp#2026' })
  log(db, who(), 'COMPTE_CREE', f.email, undefined, ROLE_LABEL[f.role])
  toast('success', 'Compte créé', 'Un lien d’activation et la configuration du second facteur sont envoyés à l’intéressé.')
  open.value = false; f.nom = ''; f.email = ''
}
function toggle(id: string) {
  const u = db.utilisateurs.find((x) => x.id === id)!
  if (u.id === adminState.user?.id) return toast('error', 'Action impossible', 'Vous ne pouvez pas désactiver votre propre compte.')
  u.actif = !u.actif
  log(db, who(), u.actif ? 'COMPTE_ACTIVE' : 'COMPTE_DESACTIVE', u.email)
}
function role(id: string, r: Role) {
  const u = db.utilisateurs.find((x) => x.id === id)!
  log(db, who(), 'ROLE_MODIFIE', u.email, ROLE_LABEL[u.role], ROLE_LABEL[r]); u.role = r
}
const DROITS: Record<Role, string> = {
  admin: 'Paramétrage, comptes, droits, journal d’audit',
  economat: 'Encaissements, rapprochement, avoirs, duplicata',
  resp_crn: 'Listes et SMS des cours de remise à niveau',
  resp_spt: 'Listes, contacts d’urgence et SMS de VOGT Sport',
  resp_inf: 'Listes et SMS de la formation en informatique',
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3"><p class="text-sm text-slate-600">Comptes nominatifs, double authentification obligatoire. Chaque compte ne voit que les offres qui le concernent.</p><button class="btn-primary btn-sm" @click="open = true"><Icon name="plus" :size="16" />Nouveau compte</button></div>
    <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl min-w-[800px]">
      <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Droits</th><th>Dernière connexion</th><th>Actif</th></tr></thead>
      <tbody><tr v-for="u in db.utilisateurs" :key="u.id">
        <td><div class="flex items-center gap-3"><span class="grid h-9 w-9 place-items-center rounded-full bg-navy-100 text-xs font-bold text-navy-800">{{ u.nom.split(/[\s·]+/).slice(0, 2).map((s) => s[0]).join('') }}</span><div><p class="font-medium text-navy-900">{{ u.nom }}</p><p class="text-xs text-slate-500">{{ u.email }}</p></div></div></td>
        <td><select :value="u.role" class="input !min-h-[40px] w-52 text-sm" :aria-label="`Rôle de ${u.nom}`" @change="role(u.id, ($event.target as HTMLSelectElement).value as Role)"><option v-for="(l, r) in ROLE_LABEL" :key="r" :value="r">{{ l }}</option></select></td>
        <td class="max-w-[16rem] text-xs text-slate-600">{{ DROITS[u.role] }}</td>
        <td class="whitespace-nowrap text-xs text-slate-500">{{ u.derniereConnexion ? fmtDateTime(u.derniereConnexion) : '—' }}</td>
        <td><button role="switch" :aria-checked="u.actif" :aria-label="`Compte de ${u.nom}`" class="relative h-7 w-12 rounded-full transition" :class="u.actif ? 'bg-emerald-500' : 'bg-slate-300'" @click="toggle(u.id)"><span class="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform" :class="u.actif ? 'translate-x-5' : ''" /></button></td></tr></tbody></table></div></div>
    <Modal :open="open" title="Nouveau compte" @close="open = false">
      <div class="space-y-4"><div><label for="un" class="label">Nom complet</label><input id="un" v-model="f.nom" class="input" /></div><div><label for="ue" class="label">Adresse e-mail</label><input id="ue" v-model="f.email" type="email" class="input" /></div>
        <div><label for="ur" class="label">Rôle</label><select id="ur" v-model="f.role" class="input"><option v-for="(l, r) in ROLE_LABEL" :key="r" :value="r">{{ l }}</option></select><p class="hint">{{ DROITS[f.role] }}</p></div>
        <p v-if="err" class="error" role="alert"><Icon name="alert" :size="16" class="mt-px" />{{ err }}</p></div>
      <template #footer><button class="btn-outline" @click="open = false">Annuler</button><button class="btn-primary" @click="add">Créer le compte</button></template>
    </Modal>
  </div>
</template>
