<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../../components/Icon.vue'
import OperatorBadge from '../../components/OperatorBadge.vue'
import { getOffres } from '../../api'
import { fmtDate, t } from '../../lib/i18n'
import { fcfa } from '../../lib/money'
import { hasDraft } from '../../composables/draft'
import type { OffreCode } from '../../lib/types'

const router = useRouter()
type Row = Awaited<ReturnType<typeof getOffres>>[number]
const offres = ref<Row[] | null>(null)
onMounted(async () => (offres.value = await getOffres()))

const META: Record<OffreCode, { icon: string; accent: string; ring: string }> = {
  CRN: { icon: 'book', accent: 'bg-navy-800', ring: 'ring-navy-100' },
  SPT: { icon: 'sport', accent: 'bg-gold-500', ring: 'ring-gold-100' },
  INF: { icon: 'laptop', accent: 'bg-emerald-700', ring: 'ring-emerald-100' },
}
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso + 'T23:59:59').getTime() - Date.now()) / 86400000))
const minPrice = (r: Row) => Math.min(...r.prestations.map((p) => p.tarif))
const pct = (r: Row) => (r.capacite ? Math.round(((r.capacite - r.places) / r.capacite) * 100) : 0)
const nbChoix = computed(() => offres.value?.reduce((a, r) => a + r.prestations.length, 0) ?? 0)
const faqs = ['q1', 'q2', 'q3', 'q4', 'q5']
function go(code: OffreCode) { router.push({ name: 'inscription', query: { offre: code } }) }
</script>

<template>
  <div>
    <!-- HERO -->
    <section class="on-dark relative overflow-hidden bg-navy-900 text-white">
      <div class="absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
      <div class="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-gold-500/20 blur-3xl" aria-hidden="true" />
      <div class="absolute -bottom-40 -left-24 h-[24rem] w-[24rem] rounded-full bg-navy-500/40 blur-3xl" aria-hidden="true" />
      <div class="container-page relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:py-24">
        <div class="animate-rise">
          <p class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-gold-200 backdrop-blur">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{{ t('home.badge') }}
          </p>
          <h1 class="mt-6 text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-[3.4rem]">
            {{ t('home.h1a') }} <span class="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">{{ t('home.h1b') }}</span>
          </h1>
          <p class="mt-5 max-w-xl text-base leading-relaxed text-navy-100 sm:text-lg">{{ t('home.lead') }}</p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <RouterLink :to="{ name: 'inscription' }" class="btn-gold btn-lg">{{ hasDraft() ? t('home.resume') : t('home.cta') }}<Icon name="arrow-right" :size="20" /></RouterLink>
            <a href="#etapes" class="btn btn-lg border border-white/25 text-white hover:bg-white/10">{{ t('home.how') }}</a>
          </div>
          <ul class="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-navy-100">
            <li class="flex items-center gap-2"><OperatorBadge op="MTN" /><OperatorBadge op="ORANGE" /></li>
            <li class="flex items-center gap-2"><Icon name="lock" :size="16" class="text-gold-300" />{{ t('home.secure') }}</li>
            <li class="flex items-center gap-2"><Icon name="clock" :size="16" class="text-gold-300" />{{ t('home.minutes') }}</li>
          </ul>
        </div>

        <!-- Aperçu : confirmation de paiement -->
        <div class="relative mx-auto w-full max-w-sm animate-rise [animation-delay:120ms]" aria-hidden="true">
          <div class="rounded-[2rem] border border-white/10 bg-white p-5 text-slate-800 shadow-pop ring-8 ring-white/5">
            <div class="flex items-center justify-between">
              <span class="chip-green"><Icon name="check" :size="12" />{{ t('home.prev.paid') }}</span>
              <span class="text-xs text-slate-400">MTN MoMo</span>
            </div>
            <p class="mt-5 text-xs font-medium uppercase tracking-wider text-slate-400">{{ t('home.prev.amount') }}</p>
            <p class="text-4xl font-bold tracking-tight text-navy-900">45&nbsp;000 <span class="text-lg font-semibold text-slate-400">FCFA</span></p>
            <div class="mt-5 space-y-2.5 rounded-2xl bg-navy-50 p-4 text-sm">
              <div class="flex justify-between"><span class="text-slate-500">{{ t('home.prev.offer') }}</span><span class="font-semibold text-navy-900">VOGT Sport · U13</span></div>
              <div class="flex justify-between"><span class="text-slate-500">{{ t('home.prev.invoice') }}</span><span class="font-mono text-xs font-semibold text-navy-900">CFXV-2027-SPT-00042</span></div>
              <div class="flex justify-between"><span class="text-slate-500">{{ t('home.prev.number') }}</span><span class="font-semibold text-navy-900">+237 6•• •• •• 56</span></div>
            </div>
            <div class="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-3">
              <div class="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-navy-900 text-white"><Icon name="qr" :size="30" /></div>
              <p class="text-xs leading-snug text-slate-500">{{ t('home.prev.qr') }}</p>
            </div>
          </div>
          <div class="absolute -left-4 -top-5 flex items-center gap-2 rounded-2xl bg-gold-400 px-3.5 py-2 text-xs font-semibold text-navy-950 shadow-pop sm:-left-8">
            <Icon name="bolt" :size="16" />{{ t('home.prev.sms') }}
          </div>
        </div>
      </div>
      <div class="relative border-t border-white/10 bg-navy-950/40">
        <div class="container-page grid grid-cols-3 divide-x divide-white/10 py-5 text-center">
          <div><p class="text-2xl font-bold text-white sm:text-3xl">3</p><p class="text-xs text-navy-200 sm:text-sm">{{ t('home.stat.offers') }}</p></div>
          <div><p class="text-2xl font-bold text-white sm:text-3xl">{{ offres ? nbChoix : '…' }}</p><p class="text-xs text-navy-200 sm:text-sm">{{ t('home.stat.places') }}</p></div>
          <div><p class="text-2xl font-bold text-white sm:text-3xl">24/7</p><p class="text-xs text-navy-200 sm:text-sm">{{ t('home.stat.online') }}</p></div>
        </div>
      </div>
    </section>

    <!-- OFFRES -->
    <section id="offres" class="container-page scroll-mt-20 py-16 sm:py-20">
      <div class="mx-auto max-w-2xl text-center">
        <p class="section-eyebrow">{{ t('home.offers.eyebrow') }}</p>
        <h2 class="mt-2 text-3xl sm:text-4xl">{{ t('home.offers.title') }}</h2>
        <p class="mt-3 text-slate-600">{{ t('home.offers.lead') }}</p>
      </div>
      <div class="mt-12 grid gap-6 lg:grid-cols-3">
        <template v-if="!offres">
          <div v-for="i in 3" :key="i" class="card h-[26rem] animate-pulse bg-slate-100" />
        </template>
        <article v-for="r in offres" v-else :key="r.session.id" class="card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-pop">
          <div class="h-1.5" :class="META[r.session.offre].accent" />
          <div class="flex flex-1 flex-col p-6">
            <div class="flex items-start justify-between gap-3">
              <span class="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-sm" :class="META[r.session.offre].accent"><Icon :name="META[r.session.offre].icon" :size="24" /></span>
              <span class="chip-green"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />{{ t('home.open') }}</span>
            </div>
            <h3 class="mt-5 text-xl">{{ t(`offer.${r.session.offre}.name`) }}</h3>
            <p class="mt-1 text-sm font-medium text-gold-700">{{ t(`offer.${r.session.offre}.who`) }}</p>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">{{ t(`offer.${r.session.offre}.desc`) }}</p>
            <dl class="mt-5 space-y-2.5 border-t border-slate-100 pt-5 text-sm">
              <div class="flex items-center justify-between gap-3"><dt class="flex items-center gap-2 text-slate-500"><Icon name="calendar" :size="16" />{{ t('home.session') }}</dt><dd class="font-medium text-navy-900">{{ fmtDate(r.session.debut, { day: 'numeric', month: 'short', year: 'numeric' }) }}</dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="flex items-center gap-2 text-slate-500"><Icon name="clock" :size="16" />{{ t('home.deadline') }}</dt><dd class="font-medium text-navy-900">{{ fmtDate(r.session.limite, { day: 'numeric', month: 'short', year: 'numeric' }) }} <span class="text-xs font-normal text-slate-400">· {{ t('home.daysLeft', { n: daysLeft(r.session.limite) }) }}</span></dd></div>
              <div class="flex items-center justify-between gap-3"><dt class="flex items-center gap-2 text-slate-500"><Icon name="wallet" :size="16" />{{ t('home.from') }}</dt><dd class="font-semibold text-navy-900">{{ fcfa(minPrice(r)) }}</dd></div>
            </dl>
            <div class="mt-5">
              <div class="mb-1.5 flex items-center justify-between text-xs"><span class="font-medium text-slate-600">{{ t('home.seats') }}</span><span class="font-semibold" :class="pct(r) > 80 ? 'text-red-700' : 'text-navy-800'">{{ r.places }} / {{ r.capacite }}</span></div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" :aria-valuenow="pct(r)" aria-valuemin="0" aria-valuemax="100" :aria-label="t('home.seats')">
                <div class="h-full rounded-full transition-all duration-700" :class="pct(r) > 80 ? 'bg-red-500' : pct(r) > 55 ? 'bg-gold-500' : 'bg-emerald-500'" :style="{ width: `${pct(r)}%` }" />
              </div>
            </div>
            <button class="btn-primary mt-6 w-full group-hover:bg-navy-700" @click="go(r.session.offre)">{{ t('home.register') }}<Icon name="arrow-right" :size="18" /></button>
          </div>
        </article>
      </div>
    </section>

    <!-- ÉTAPES -->
    <section id="etapes" class="scroll-mt-20 bg-white py-16 sm:py-20">
      <div class="container-page">
        <div class="mx-auto max-w-2xl text-center">
          <p class="section-eyebrow">{{ t('home.steps.eyebrow') }}</p>
          <h2 class="mt-2 text-3xl sm:text-4xl">{{ t('home.steps.title') }}</h2>
        </div>
        <ol class="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          <div class="absolute left-[10%] right-[10%] top-7 hidden h-px bg-gradient-to-r from-transparent via-navy-200 to-transparent lg:block" aria-hidden="true" />
          <li v-for="n in 5" :key="n" class="relative text-center">
            <span class="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy-900 text-lg font-bold text-gold-300 shadow-card ring-4 ring-white">{{ n }}</span>
            <h3 class="mt-4 text-base">{{ t(`home.step${n}.t`) }}</h3>
            <p class="mx-auto mt-1.5 max-w-[15rem] text-sm leading-relaxed text-slate-600">{{ t(`home.step${n}.d`) }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- GARANTIES -->
    <section class="container-page py-16 sm:py-20">
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="f in [{ i: 'phone', k: 'a' }, { i: 'shield', k: 'b' }, { i: 'receipt', k: 'c' }, { i: 'message', k: 'd' }]" :key="f.k" class="card p-6">
          <span class="grid h-11 w-11 place-items-center rounded-xl bg-gold-100 text-gold-800"><Icon :name="f.i" :size="22" /></span>
          <h3 class="mt-4 text-base">{{ t(`home.feat.${f.k}.t`) }}</h3>
          <p class="mt-1.5 text-sm leading-relaxed text-slate-600">{{ t(`home.feat.${f.k}.d`) }}</p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="container-page scroll-mt-20 pb-16">
      <div class="mx-auto max-w-3xl">
        <div class="text-center">
          <p class="section-eyebrow">{{ t('home.faq.eyebrow') }}</p>
          <h2 class="mt-2 text-3xl sm:text-4xl">{{ t('home.faq.title') }}</h2>
        </div>
        <div class="mt-10 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <details v-for="q in faqs" :key="q" class="group">
            <summary class="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-navy-900 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              {{ t(`home.faq.${q}.q`) }}
              <Icon name="chevron-down" class="text-slate-400 transition group-open:rotate-180" />
            </summary>
            <p class="px-5 pb-5 text-sm leading-relaxed text-slate-600">{{ t(`home.faq.${q}.a`) }}</p>
          </details>
        </div>
      </div>
    </section>

    <section class="container-page">
      <div class="on-dark relative overflow-hidden rounded-3xl bg-navy-900 px-6 py-12 text-center sm:px-12">
        <div class="absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
        <div class="relative">
          <h2 class="text-2xl text-white sm:text-3xl">{{ t('home.final.t') }}</h2>
          <p class="mx-auto mt-3 max-w-xl text-navy-100">{{ t('home.final.d') }}</p>
          <RouterLink :to="{ name: 'inscription' }" class="btn-gold btn-lg mt-7">{{ t('home.cta') }}<Icon name="arrow-right" :size="20" /></RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
