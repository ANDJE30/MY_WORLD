<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import FormField from '../../../components/FormField.vue'
import PhoneInput from '../../../components/PhoneInput.vue'
import DateInput from '../../../components/DateInput.vue'
import Segmented from '../../../components/Segmented.vue'
import Icon from '../../../components/Icon.vue'
import { db } from '../../../api'
import { catalogueOf, SITE } from '../../../api/domain'
import { doublon } from '../../../api'
import { CLASSES, CLASSES_INF, classeSuivante } from '../../../data/catalog'
import { validerParticipant } from '../../../lib/validate'
import { categorieParticipant, sessionDe } from '../../../lib/rules'
import { fmtDate, t } from '../../../lib/i18n'
import type { Participant } from '../../../lib/types'

const p = defineModel<Participant>({ required: true })
const touched = reactive<Record<string, boolean>>({})
const submitted = ref(false)
const cat = computed(() => catalogueOf(db))
const session = computed(() => sessionDe(cat.value, p.value.offre))
const all = computed(() => validerParticipant(p.value, cat.value, t))
const err = (k: string) => (submitted.value || touched[k] ? all.value[k] : undefined)
const touch = (k: string) => (touched[k] = true)
void SITE

const info = computed(() => (p.value.offre === 'SPT' ? categorieParticipant(p.value, session.value, cat.value) : null))
const ageCRN = computed(() => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(p.value.naissance)
  if (!m) return null
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
  if (d.getUTCDate() !== +m[1] || d.getTime() > Date.now()) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000))
})
const dup = computed(() => (p.value.offre !== 'INF' && p.value.nom && p.value.prenoms && p.value.naissance.length === 10 ? doublon(p.value) : false))

// Classe préparée proposée d'office (classe suivante), modifiable en cas de redoublement.
watch(() => p.value.classePrecedente, (c, old) => {
  if (!c) return
  if (!p.value.classePreparee || p.value.classePreparee === classeSuivante(old ?? '')) p.value.classePreparee = classeSuivante(c)
})
watch(() => p.value.classePreparee, () => { p.value.choix = [] })

function upper(e: Event, k: 'nom' | 'parentNom' | 'urgenceNom') {
  const el = e.target as HTMLInputElement
  el.value = el.value.toUpperCase()
  ;(p.value[k] as string) = el.value
}

const certErr = ref('')
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  certErr.value = ''
  if (!f) return
  if (!/^(application\/pdf|image\/(jpeg|png|webp|heic))$/.test(f.type)) { certErr.value = t('err.fileType'); return }
  if (f.size > 2 * 1024 * 1024) { certErr.value = t('err.fileSize'); return }
  p.value.certificat = { nom: f.name, taille: f.size }
  touch('certificat')
}

const profs = computed(() => ['eleve', 'etudiant', 'enseignant', 'autre'].map((v) => ({ value: v, label: t(`prof.${v}`) })))
const yesNo = computed(() => [{ value: 'oui', label: t('common.yes') }, { value: 'non', label: t('common.no') }])
const sexes = computed(() => [{ value: 'F', label: t('s2.female') }, { value: 'M', label: t('s2.male') }])

function validate(): boolean {
  submitted.value = true
  const keys = Object.keys(all.value)
  if (keys.length) {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${keys[0]}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLElement>('input,select,textarea,button')?.focus({ preventScroll: true })
    })
  }
  return keys.length === 0
}
defineExpose({ validate })
const title = computed(() => t(`s2.title.${p.value.offre}`))
</script>

<template>
  <section>
    <h2 class="text-2xl">{{ title }}</h2>
    <p class="mt-1.5 text-slate-600">{{ t(`s2.lead.${p.offre}`) }}</p>

    <form class="mt-7 space-y-8" novalidate @submit.prevent>
      <!-- Identité -->
      <fieldset class="space-y-5">
        <legend class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-700"><Icon name="user" :size="16" />{{ t('s2.identity') }}</legend>
        <div class="grid gap-5 sm:grid-cols-2">
          <FormField v-slot="s" :label="t('f.nom')" name="nom" :error="err('nom')" required>
            <input :id="s.id" :value="p.nom" class="input uppercase" autocomplete="family-name" autocapitalize="characters" maxlength="50" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @input="upper($event, 'nom')" @blur="touch('nom')" />
          </FormField>
          <FormField v-slot="s" :label="t('f.prenoms')" name="prenoms" :error="err('prenoms')" required>
            <input :id="s.id" v-model="p.prenoms" class="input" autocomplete="given-name" maxlength="60" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('prenoms')" />
          </FormField>
        </div>

        <div v-if="p.offre !== 'INF'" class="grid gap-5 sm:grid-cols-2">
          <FormField v-slot="s" :label="t('f.sexe')" name="sexe" group :error="err('sexe')" required>
            <Segmented v-model="p.sexe" name="sexe" :options="sexes" :invalid="s.invalid" :labelledby="s.labelledby" @blur="touch('sexe')" />
          </FormField>
          <FormField v-slot="s" :label="t('f.naissance')" name="naissance" :error="err('naissance')" :hint="p.offre === 'SPT' ? t('s2.dobHintSPT') : t('s2.dobHint')" required>
            <DateInput :id="s.id" v-model="p.naissance" :invalid="s.invalid" :describedby="s.describedby" @blur="touch('naissance')" />
          </FormField>
        </div>

        <Transition name="slide">
          <div v-if="p.offre === 'SPT' && info && info.categorie && !all.naissance" class="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status">
            <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-lg font-bold text-white">{{ info.categorie.code }}</span>
            <div>
              <p class="font-semibold text-emerald-900">{{ t('s2.catFound', { age: info.age, cat: info.categorie.code }) }}</p>
              <p class="text-sm text-emerald-800">{{ t('s2.catRef', { d: session ? fmtDate(session.debut) : '' }) }}</p>
            </div>
          </div>
          <p v-else-if="p.offre === 'CRN' && ageCRN !== null && !all.naissance" class="flex items-center gap-2 text-sm text-slate-600" role="status"><Icon name="info" :size="16" class="text-navy-600" />{{ t('s2.ageShown', { n: ageCRN }) }}</p>
        </Transition>
        <div v-if="dup" class="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <Icon name="alert" :size="20" class="mt-0.5 shrink-0" /><p>{{ t('s2.duplicate') }}</p>
        </div>
      </fieldset>

      <!-- CRN -->
      <fieldset v-if="p.offre === 'CRN'" class="space-y-5">
        <legend class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-700"><Icon name="book" :size="16" />{{ t('s2.school') }}</legend>
        <FormField v-slot="s" :label="t('f.eleveCollege')" name="eleveCollege" group :error="err('eleveCollege')" required>
          <Segmented v-model="p.eleveCollege as string" name="eleveCollege" :options="yesNo" :invalid="s.invalid" :labelledby="s.labelledby" @blur="touch('eleveCollege')" />
        </FormField>
        <FormField v-if="p.eleveCollege === 'oui'" v-slot="s" :label="t('f.matricule')" name="matricule" optional :optional-text="t('common.optional')">
          <input :id="s.id" v-model="p.matricule" class="input uppercase" maxlength="20" autocapitalize="characters" />
        </FormField>
        <FormField v-if="p.eleveCollege === 'non'" v-slot="s" :label="t('f.etablissementOrigine')" name="etablissement" :error="err('etablissement')" required>
          <input :id="s.id" v-model="p.etablissement" class="input" maxlength="100" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('etablissement')" />
        </FormField>
        <div class="grid gap-5 sm:grid-cols-2">
          <FormField v-slot="s" :label="t('f.classePrecedente')" name="classePrecedente" :error="err('classePrecedente')" required>
            <select :id="s.id" v-model="p.classePrecedente" class="input" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('classePrecedente')">
              <option value="" disabled>{{ t('common.select') }}</option>
              <option v-for="c in CLASSES" :key="c" :value="c">{{ c }}</option>
            </select>
          </FormField>
          <FormField v-slot="s" :label="t('f.classePreparee')" name="classePreparee" :error="err('classePreparee')" :hint="t('s2.prepHint')" required>
            <select :id="s.id" v-model="p.classePreparee" class="input" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('classePreparee')">
              <option value="" disabled>{{ t('common.select') }}</option>
              <option v-for="c in CLASSES" :key="c" :value="c">{{ c }}</option>
            </select>
          </FormField>
        </div>
        <FormField v-slot="s" :label="t('f.observations')" name="observations" :error="err('observations')" optional :optional-text="t('common.optional')">
          <textarea :id="s.id" v-model="p.observations" rows="3" maxlength="320" class="input resize-none" :placeholder="t('f.observationsPh')" :aria-invalid="s.invalid" />
          <p class="mt-1 text-right text-xs tabular" :class="(p.observations?.length ?? 0) > 300 ? 'text-red-600' : 'text-slate-400'">{{ p.observations?.length ?? 0 }}/300</p>
        </FormField>
      </fieldset>

      <!-- INF -->
      <fieldset v-if="p.offre === 'INF'" class="space-y-5">
        <legend class="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-700"><Icon name="laptop" :size="16" />{{ t('s2.contact') }}</legend>
        <div class="grid gap-5 sm:grid-cols-2">
          <FormField v-slot="s" :label="t('f.tel')" name="tel" :error="err('tel')" :hint="t('f.telHint')" required>
            <PhoneInput :id="s.id" v-model="p.tel as string" show-operator :invalid="s.invalid" :describedby="s.describedby" @blur="touch('tel')" />
          </FormField>
          <FormField v-slot="s" :label="t('f.email')" name="email" :error="err('email')" :hint="t('f.emailInvoice')" optional :optional-text="t('common.optional')">
            <input :id="s.id" v-model="p.email" type="email" inputmode="email" autocomplete="email" class="input" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('email')" />
          </FormField>
        </div>
        <FormField v-slot="s" :label="t('f.profession')" name="profession" group :error="err('profession')" required>
          <Segmented v-model="p.profession as string" name="profession" :options="profs" :invalid="s.invalid" :labelledby="s.labelledby" @blur="touch('profession')" />
        </FormField>
        <Transition name="slide" mode="out-in">
          <div :key="p.profession" class="space-y-5">
            <template v-if="p.profession === 'eleve'">
              <div class="grid gap-5 sm:grid-cols-2">
                <FormField v-slot="s" :label="t('f.classe')" name="classe" :error="err('classe')" required>
                  <select :id="s.id" v-model="p.classe" class="input" :aria-invalid="s.invalid" @blur="touch('classe')">
                    <option value="" disabled>{{ t('common.select') }}</option>
                    <option v-for="c in CLASSES_INF" :key="c" :value="c">{{ c }}</option>
                  </select>
                </FormField>
                <FormField v-slot="s" :label="t('f.etablissement')" name="etablissement" :error="err('etablissement')" required>
                  <input :id="s.id" v-model="p.etablissement" class="input" :aria-invalid="s.invalid" @blur="touch('etablissement')" />
                </FormField>
              </div>
            </template>
            <template v-else-if="p.profession === 'etudiant'">
              <FormField v-slot="s" :label="t('f.etablissement')" name="etablissement" :error="err('etablissement')" required>
                <input :id="s.id" v-model="p.etablissement" class="input" :aria-invalid="s.invalid" @blur="touch('etablissement')" />
              </FormField>
            </template>
            <template v-else-if="p.profession === 'enseignant'">
              <div class="grid gap-5 sm:grid-cols-2">
                <FormField v-slot="s" :label="t('f.etablissement')" name="etablissement" :error="err('etablissement')" required>
                  <input :id="s.id" v-model="p.etablissement" class="input" :aria-invalid="s.invalid" @blur="touch('etablissement')" />
                </FormField>
                <FormField v-slot="s" :label="t('f.discipline')" name="discipline" optional :optional-text="t('common.optional')">
                  <input :id="s.id" v-model="p.discipline" class="input" />
                </FormField>
              </div>
            </template>
            <template v-else-if="p.profession === 'autre'">
              <FormField v-slot="s" :label="t('f.professionExercee')" name="professionExercee" :error="err('professionExercee')" required>
                <input :id="s.id" v-model="p.professionExercee" class="input" :aria-invalid="s.invalid" @blur="touch('professionExercee')" />
              </FormField>
            </template>
          </div>
        </Transition>
      </fieldset>

      <!-- Parent / tuteur -->
      <fieldset v-if="p.offre !== 'INF' || p.profession === 'eleve'" class="space-y-5">
        <legend class="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-700"><Icon name="users" :size="16" />{{ t('s2.parent') }}</legend>
        <p v-if="p.offre === 'INF'" class="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">{{ t('s2.parentPayer') }}</p>
        <div class="grid gap-5 sm:grid-cols-2">
          <FormField v-slot="s" :label="t('f.parentNom')" name="parentNom" :error="err('parentNom')" required>
            <input :id="s.id" :value="p.parentNom" class="input" autocomplete="name" maxlength="80" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @input="(e) => (p.parentNom = (e.target as HTMLInputElement).value)" @blur="touch('parentNom')" />
          </FormField>
          <FormField v-slot="s" :label="t('f.parentTel')" name="parentTel" :error="err('parentTel')" :hint="t('f.telHint')" required>
            <PhoneInput :id="s.id" v-model="p.parentTel" show-operator :invalid="s.invalid" :describedby="s.describedby" @blur="touch('parentTel')" />
          </FormField>
        </div>
        <FormField v-slot="s" :label="t('f.parentEmail')" name="parentEmail" :error="err('parentEmail')" :hint="t('f.emailInvoice')" optional :optional-text="t('common.optional')">
          <input :id="s.id" v-model="p.parentEmail" type="email" inputmode="email" autocomplete="email" class="input sm:max-w-md" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @blur="touch('parentEmail')" />
        </FormField>
      </fieldset>

      <!-- SPT : urgence, autorisation, certificat -->
      <template v-if="p.offre === 'SPT'">
        <fieldset class="space-y-5">
          <legend class="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-700"><Icon name="heart" :size="16" />{{ t('s2.emergency') }}</legend>
          <p class="text-sm text-slate-600">{{ t('s2.emergencyLead') }}</p>
          <div class="grid gap-5 sm:grid-cols-2">
            <FormField v-slot="s" :label="t('f.urgenceNom')" name="urgenceNom" :error="err('urgenceNom')" required>
              <input :id="s.id" :value="p.urgenceNom" class="input" maxlength="80" :aria-invalid="s.invalid" :aria-describedby="s.describedby" @input="(e) => (p.urgenceNom = (e.target as HTMLInputElement).value)" @blur="touch('urgenceNom')" />
            </FormField>
            <FormField v-slot="s" :label="t('f.urgenceTel')" name="urgenceTel" :error="err('urgenceTel')" required>
              <PhoneInput :id="s.id" v-model="p.urgenceTel as string" :invalid="s.invalid" :describedby="s.describedby" @blur="touch('urgenceTel')" />
            </FormField>
          </div>
        </fieldset>

        <fieldset class="space-y-5">
          <legend class="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-navy-700"><Icon name="shield" :size="16" />{{ t('s2.authorizations') }}</legend>
          <FormField v-if="cat.params.certificatMedical" :label="t('f.certificat')" name="certificat" :error="err('certificat') || certErr" :hint="t('f.certificatHint')" required>
            <div v-if="p.certificat" class="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <span class="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 text-white"><Icon name="receipt" :size="20" /></span>
              <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-emerald-900">{{ p.certificat.nom }}</p><p class="text-xs text-emerald-800">{{ Math.max(1, Math.round(p.certificat.taille / 1024)) }} Ko</p></div>
              <button type="button" class="btn-ghost btn-sm" @click="p.certificat = null"><Icon name="trash" :size="16" />{{ t('common.remove') }}</button>
            </div>
            <label v-else class="flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition hover:border-navy-400 hover:bg-navy-50/50 focus-within:ring-2 focus-within:ring-navy-600"
              :class="err('certificat') || certErr ? 'border-red-400 bg-red-50/40' : 'border-slate-300'">
              <Icon name="upload" :size="24" class="text-navy-600" />
              <span class="text-sm font-semibold text-navy-800">{{ t('f.certificatDrop') }}</span>
              <span class="text-xs text-slate-500">PDF, JPG, PNG · 2 Mo</span>
              <input id="f-certificat" type="file" accept="application/pdf,image/*" class="sr-only" @change="onFile" />
            </label>
          </FormField>
          <FormField :label="t('f.autorisation')" name="autorisation" :error="err('autorisation')">
            <label class="flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition hover:border-navy-300" :class="err('autorisation') ? 'border-red-400' : p.autorisation ? 'border-navy-600 bg-navy-50/50' : 'border-slate-300'">
              <input id="f-autorisation" v-model="p.autorisation" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-navy-800" @change="touch('autorisation')" />
              <span class="text-sm leading-relaxed text-slate-700">{{ t('f.autorisationText') }}<span class="mt-1 block text-xs text-slate-500">{{ t('f.autorisationNote') }}</span></span>
            </label>
          </FormField>
        </fieldset>
      </template>
    </form>
  </section>
</template>
