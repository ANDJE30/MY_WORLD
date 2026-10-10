<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'
import Stepper from '../../components/Stepper.vue'
import PhoneInput from '../../components/PhoneInput.vue'
import OperatorBadge from '../../components/OperatorBadge.vue'
import FormField from '../../components/FormField.vue'
import { ApiError, db, getCommande, getPaiement, postPaiement, sandboxOperateur, sandboxWebhook } from '../../api'
import { fcfa } from '../../lib/money'
import { isValidMobile, maskPhone, nationalDigits, suggestOperator, toE164 } from '../../lib/phone'
import { fmtDate, t } from '../../lib/i18n'
import { toast } from '../../composables/toast'
import type { Operateur } from '../../lib/types'

const props = defineProps<{ id: string }>()
const router = useRouter()
const commande = computed(() => db.commandes.find((c) => c.id === props.id))
const now = ref(Date.now())
const operateur = ref<Operateur | ''>('')
const manual = ref(false)
const numero = ref('')
const numErr = ref('')
const busy = ref(false)
const apiErr = ref('')
const paiementId = ref('')
const sandboxOpen = ref(true)
const sandboxBusy = ref(false)
const sandboxMsg = ref('')
const reason = ref('Solde insuffisant.')
let timer = 0

const paiement = computed(() => db.paiements.find((p) => p.id === paiementId.value))
const phase = computed<'choose' | 'pending' | 'failed' | 'expired'>(() => {
  const p = paiement.value
  if (!p) return 'choose'
  if (p.statut === 'EN_ATTENTE') return 'pending'
  if (p.statut === 'ECHOUEE') return 'failed'
  if (p.statut === 'EXPIREE') return 'expired'
  return 'choose'
})

onMounted(() => {
  getCommande(props.id)
  const c = commande.value
  if (c) {
    numero.value = nationalDigits(c.payeur.tel)
    operateur.value = suggestOperator(numero.value) ?? ''
    const existing = db.paiements.find((p) => p.commandeId === c.id && p.statut === 'EN_ATTENTE')
    if (existing) paiementId.value = existing.id
    if (c.statut === 'CONFIRMEE') router.replace({ name: 'confirmation', params: { id: c.id } })
  }
  timer = window.setInterval(() => {
    now.value = Date.now()
    if (paiementId.value) getPaiement(paiementId.value)
    else getCommande(props.id)
  }, 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))

watch(numero, (n) => {
  numErr.value = ''
  if (!manual.value) operateur.value = suggestOperator(n) ?? operateur.value
})
watch(() => paiement.value?.statut, (s) => {
  if (s === 'REUSSIE') router.replace({ name: 'confirmation', params: { id: props.id } })
})

const holdLeft = computed(() => (commande.value ? Math.max(0, Math.floor((new Date(commande.value.expireLe).getTime() - now.value) / 1000)) : 0))
const payLeft = computed(() => (paiement.value ? Math.max(0, Math.floor((new Date(paiement.value.expireLe).getTime() - now.value) / 1000)) : 0))
const payTotal = computed(() => (db.params.delaiPaiementMin || 5) * 60)
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const R = 54
const dash = computed(() => 2 * Math.PI * R)
const offset = computed(() => dash.value * (1 - Math.min(1, payLeft.value / payTotal.value)))
const expiredOrder = computed(() => commande.value && commande.value.statut === 'EXPIREE')

function pick(o: Operateur) { operateur.value = o; manual.value = true }

async function pay() {
  apiErr.value = ''
  if (!isValidMobile(numero.value)) { numErr.value = t('err.phone'); return }
  if (!operateur.value) { apiErr.value = t('pay.chooseOp'); return }
  busy.value = true
  try {
    const p = await postPaiement(props.id, operateur.value, toE164(numero.value))
    paiementId.value = p.id
    sandboxMsg.value = ''
  } catch (e) {
    apiErr.value = e instanceof ApiError ? e.message : t('err.generic')
  } finally { busy.value = false }
}

function retry() { paiementId.value = ''; apiErr.value = '' }

async function sim(action: 'accept' | 'refuse' | 'ignore') {
  if (!paiement.value) return
  sandboxBusy.value = true
  await sandboxOperateur(paiement.value.id, action, reason.value)
  sandboxBusy.value = false
}
async function forged() {
  if (!paiement.value) return
  sandboxBusy.value = true
  const r = await sandboxWebhook(paiement.value.id, 'falsifie')
  sandboxMsg.value = r.message
  sandboxBusy.value = false
  toast('info', t('sbx.forgedTitle'), r.message)
}
</script>

<template>
  <div class="container-page py-6 sm:py-10">
    <h1 class="mb-6 text-2xl sm:text-3xl">{{ t('reg.title') }}</h1>
    <Stepper :step="5" class="mb-8" />

    <div v-if="!commande" class="card card-pad mx-auto max-w-lg text-center">
      <Icon name="alert" :size="32" class="mx-auto text-amber-600" />
      <h2 class="mt-3 text-xl">{{ t('pay.notFound') }}</h2>
      <RouterLink :to="{ name: 'inscription' }" class="btn-primary mt-5">{{ t('pay.newReg') }}</RouterLink>
    </div>

    <div v-else class="mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="space-y-5">
        <!-- CHOIX / NUMÉRO -->
        <div v-if="phase === 'choose' || phase === 'failed' || phase === 'expired'" class="card card-pad">
          <div v-if="phase === 'failed'" class="mb-6 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
            <Icon name="alert" :size="22" class="mt-0.5 shrink-0 text-red-600" />
            <div><p class="font-semibold text-red-900">{{ t('pay.failedTitle') }}</p><p class="mt-0.5 text-sm text-red-800">{{ paiement?.motifEchec }} {{ t('pay.noDebit') }}</p><button class="btn-sm btn-outline mt-3 bg-white" @click="retry">{{ t('pay.retry') }}</button></div>
          </div>
          <div v-if="phase === 'expired'" class="mb-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4" role="alert">
            <Icon name="clock" :size="22" class="mt-0.5 shrink-0 text-amber-700" />
            <div><p class="font-semibold text-amber-900">{{ t('pay.expiredTitle') }}</p><p class="mt-0.5 text-sm text-amber-800">{{ t('pay.expiredText') }}</p><button class="btn-sm btn-outline mt-3 bg-white" @click="retry">{{ t('pay.retry') }}</button></div>
          </div>

          <template v-if="phase === 'choose'">
            <h2 class="text-2xl">{{ t('pay.title') }}</h2>
            <p class="mt-1.5 text-slate-600">{{ t('pay.lead') }}</p>

            <div v-if="commande.statut === 'EN_ATTENTE_PAIEMENT' && holdLeft > 0" class="mt-5 flex items-center gap-3 rounded-2xl bg-gold-50 px-4 py-3 text-sm text-gold-900">
              <Icon name="clock" :size="18" /><p>{{ t('pay.hold') }} <strong class="tabular">{{ mmss(holdLeft) }}</strong></p>
            </div>
            <div v-if="expiredOrder" class="mt-5 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              <Icon name="info" :size="18" /><p>{{ t('pay.holdExpired') }}</p>
            </div>

            <fieldset class="mt-7">
              <legend class="label">{{ t('pay.operator') }}</legend>
              <div class="grid gap-3 sm:grid-cols-2" role="radiogroup">
                <label v-for="o in (['MTN', 'ORANGE'] as const)" :key="o" class="relative cursor-pointer">
                  <input type="radio" name="op" class="peer sr-only" :checked="operateur === o" @change="pick(o)" />
                  <div class="flex items-center gap-3 rounded-2xl border-2 bg-white p-4 transition hover:border-navy-300 peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-navy-600 peer-focus-visible:ring-offset-2"
                    :class="operateur === o ? (o === 'MTN' ? 'border-mtn bg-yellow-50' : 'border-orange-om bg-orange-50') : 'border-slate-200'">
                    <span class="grid h-12 w-12 place-items-center rounded-xl text-sm font-extrabold" :class="o === 'MTN' ? 'bg-mtn text-navy-950' : 'bg-orange-om text-white'">{{ o === 'MTN' ? 'MTN' : 'OM' }}</span>
                    <div class="flex-1"><p class="font-semibold text-navy-900">{{ o === 'MTN' ? 'MTN Mobile Money' : 'Orange Money' }}</p>
                      <p class="text-xs text-slate-500">{{ suggestOperator(numero) === o && !manual ? t('pay.suggested') : t('pay.opHint') }}</p></div>
                    <span class="grid h-6 w-6 place-items-center rounded-full border-2 transition" :class="operateur === o ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300 text-transparent'"><Icon name="check" :size="14" :stroke="3" /></span>
                  </div>
                </label>
              </div>
            </fieldset>

            <div class="mt-6 max-w-md">
              <FormField v-slot="s" :label="t('pay.number')" name="numero" :error="numErr" :hint="t('pay.numberHint')" required>
                <PhoneInput :id="s.id" v-model="numero" :invalid="s.invalid" :describedby="s.describedby" />
              </FormField>
            </div>
            <p v-if="apiErr" class="error mt-4" role="alert"><Icon name="alert" :size="16" class="mt-px" />{{ apiErr }}</p>

            <button class="btn-gold btn-lg mt-8 w-full sm:w-auto" :disabled="busy || (commande.statut === 'EXPIREE' && false)" @click="pay">
              <svg v-if="busy" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity=".25" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
              <Icon v-else name="lock" :size="19" />{{ busy ? t('pay.sending') : t('pay.cta', { n: fcfa(commande.devis.aPayer) }) }}
            </button>
            <p class="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><Icon name="shield" :size="15" class="mt-0.5 shrink-0" />{{ t('pay.secure') }}</p>
          </template>
        </div>

        <!-- EN ATTENTE -->
        <div v-else-if="phase === 'pending' && paiement" class="card card-pad text-center" aria-live="polite">
          <div class="relative mx-auto h-36 w-36">
            <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
              <circle cx="60" cy="60" :r="R" fill="none" stroke="#e2e8f0" stroke-width="8" />
              <circle cx="60" cy="60" :r="R" fill="none" :stroke="payLeft < 60 ? '#dc2626' : '#d4a02a'" stroke-width="8" stroke-linecap="round" :stroke-dasharray="dash" :stroke-dashoffset="offset" class="transition-all duration-1000 ease-linear" />
            </svg>
            <div class="absolute inset-0 grid place-items-center"><div><p class="tabular text-3xl font-bold text-navy-900">{{ mmss(payLeft) }}</p><p class="text-[11px] uppercase tracking-wider text-slate-500">{{ t('pay.remaining') }}</p></div></div>
          </div>
          <h2 class="mt-5 text-2xl">{{ t('pay.waitTitle') }}</h2>
          <p class="mx-auto mt-2 max-w-md text-slate-600">{{ t('pay.waitText', { n: maskPhone(paiement.numero) }) }}</p>
          <div class="mt-2"><OperatorBadge :op="paiement.operateur" size="md" /></div>
          <ol class="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm">
            <li v-for="n in 3" :key="n" class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy-100 text-xs font-bold text-navy-800">{{ n }}</span><span class="text-slate-700">{{ t(`pay.wait${n}`) }}</span></li>
          </ol>
          <p class="mt-6 rounded-xl bg-navy-50 p-3 text-xs leading-relaxed text-navy-800"><Icon name="lock" :size="14" class="mr-1 inline align-[-2px]" />{{ t('pay.neverCode') }}</p>
          <p class="mt-4 text-xs text-slate-400">{{ t('pay.ref') }} <span class="font-mono">{{ paiement.referenceInterne }}</span></p>
        </div>

        <!-- Bac à sable -->
        <div v-if="phase === 'pending' && paiement" class="overflow-hidden rounded-2xl border-2 border-dashed border-gold-400 bg-gold-50/60">
          <button class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left" :aria-expanded="sandboxOpen" @click="sandboxOpen = !sandboxOpen">
            <span class="flex items-center gap-3"><span class="grid h-9 w-9 place-items-center rounded-lg bg-gold-400 text-navy-950"><Icon name="bolt" :size="18" /></span>
              <span><span class="block text-sm font-semibold text-navy-900">{{ t('sbx.title') }}</span><span class="block text-xs text-gold-900">{{ t('sbx.sub') }}</span></span></span>
            <Icon name="chevron-down" class="transition" :class="sandboxOpen ? 'rotate-180' : ''" />
          </button>
          <div v-show="sandboxOpen" class="space-y-3 border-t border-gold-300 px-5 pb-5 pt-4">
            <div class="grid gap-2 sm:grid-cols-3">
              <button class="btn-primary btn-sm" :disabled="sandboxBusy" @click="sim('accept')"><Icon name="check" :size="16" />{{ t('sbx.accept') }}</button>
              <button class="btn-outline btn-sm" :disabled="sandboxBusy" @click="sim('refuse')"><Icon name="x" :size="16" />{{ t('sbx.refuse') }}</button>
              <button class="btn-outline btn-sm" :disabled="sandboxBusy" @click="sim('ignore')"><Icon name="clock" :size="16" />{{ t('sbx.ignore') }}</button>
            </div>
            <label class="block text-xs font-medium text-slate-600">{{ t('sbx.reason') }}
              <select v-model="reason" class="input mt-1 !min-h-[40px] text-sm"><option>Solde insuffisant.</option><option>Code secret erroné.</option><option>Plafond de transaction atteint.</option></select>
            </label>
            <button class="btn-ghost btn-sm w-full border border-dashed border-gold-400" :disabled="sandboxBusy" @click="forged"><Icon name="shield" :size="16" />{{ t('sbx.forged') }}</button>
            <p v-if="sandboxMsg" class="rounded-lg bg-white p-3 text-xs text-slate-700">{{ sandboxMsg }}</p>
          </div>
        </div>
      </div>

      <!-- Récapitulatif -->
      <aside class="card overflow-hidden lg:sticky lg:top-24">
        <div class="bg-navy-900 px-5 py-4 text-white"><p class="text-xs uppercase tracking-wider text-navy-200">{{ t('pay.toPay') }}</p><p class="tabular mt-0.5 text-3xl font-bold text-gold-300">{{ fcfa(commande.devis.aPayer) }}</p></div>
        <div class="space-y-3 p-5 text-sm">
          <div v-for="l in commande.devis.lignes" :key="l.participantId + l.libelle" class="flex justify-between gap-3" :class="l.kind === 'remise' ? 'text-emerald-700' : 'text-slate-600'">
            <span>{{ l.libelle }}<span class="block text-xs text-slate-400">{{ l.participantNom }}</span></span><span class="tabular whitespace-nowrap">{{ l.montant < 0 ? '− ' : '' }}{{ fcfa(Math.abs(l.montant)) }}</span>
          </div>
          <div v-if="commande.devis.frais" class="flex justify-between text-slate-600"><span>{{ t('sum.fees') }}</span><span class="tabular">{{ fcfa(commande.devis.frais) }}</span></div>
          <div class="border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500">
            <p>{{ t('pay.payer') }} : <strong class="text-slate-700">{{ commande.payeur.nom }}</strong></p>
            <p>{{ t('pay.created', { d: fmtDate(commande.creeLe, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) }) }}</p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
