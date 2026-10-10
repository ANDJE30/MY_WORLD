<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Avoir, Commande, Facture, Paiement } from '../lib/types'
import { OFFRES } from '../lib/types'
import { nombre, phrase } from '../lib/money'
import { maskPhone } from '../lib/phone'
import { qrSvg } from '../lib/qr'
import { SITE } from '../api/domain'
import { CLASSES_INF } from '../data/catalog'
import { fmtDate } from '../lib/i18n'
import { categorieParticipant } from '../lib/rules'
import { db } from '../api/db'
import { catalogueOf } from '../api/domain'

const props = defineProps<{ facture: Facture; commande: Commande; paiement: Paiement; avoirs?: Avoir[]; duplicata?: boolean }>()

const wrap = ref<HTMLElement | null>(null)
const scale = ref(1)
let ro: ResizeObserver | null = null
const PX = 210 * 3.7795275591 // 210 mm en pixels CSS
onMounted(() => {
  const upd = () => { if (wrap.value) scale.value = Math.min(1, Math.max(0.72, wrap.value.clientWidth / PX)) }
  upd()
  ro = new ResizeObserver(upd)
  if (wrap.value) ro.observe(wrap.value)
})
onBeforeUnmount(() => ro?.disconnect())

const lien = computed(() => `${location.origin}/verifier/${props.facture.code}`)
const qr = computed(() => qrSvg(lien.value, 4))
const lignes = computed(() => props.commande.devis.lignes)
const density = computed(() => (lignes.value.length > 13 ? 'xs' : lignes.value.length > 9 ? 'sm' : 'md'))
const cat = computed(() => catalogueOf(db))

const participants = computed(() =>
  props.commande.participants.map((p) => {
    const session = db.sessions.find((s) => s.offre === p.offre)
    let detail = ''
    if (p.offre === 'CRN') detail = p.classePreparee ?? ''
    if (p.offre === 'SPT') detail = categorieParticipant(p, session, cat.value)?.categorie?.code ?? ''
    if (p.offre === 'INF') detail = ({ eleve: 'Élève', etudiant: 'Étudiant', enseignant: 'Enseignant', autre: 'Autre' } as Record<string, string>)[p.profession || 'autre']
    return { id: p.id, nom: `${p.nom.toUpperCase()} ${p.prenoms}`, detail, offre: p.offre }
  }),
)
void CLASSES_INF
const offres = computed(() => props.commande.offres.map((o) => OFFRES[o].libelle).join(' · '))
const sessionLabel = computed(() => props.commande.sessionIds.map((id) => db.sessions.find((s) => s.id === id)?.intitule).filter(Boolean).join(' · '))
const nomOp = computed(() => (props.paiement.operateur === 'MTN' ? 'MTN Mobile Money' : 'Orange Money'))
const dt = computed(() => new Date(props.facture.date))
const dateStr = computed(() => fmtDate(props.facture.date, { day: '2-digit', month: '2-digit', year: 'numeric' }))
const heureStr = computed(() => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' }).format(dt.value))
void dt
</script>

<template>
  <div ref="wrap" class="w-full">
    <div class="invoice-scale-wrap" :style="{ height: `${148 * 3.7795275591 * scale}px` }" tabindex="0" role="group" aria-label="Facture, faire défiler horizontalement sur petit écran">
      <div class="invoice-scale" :style="{ transform: `scale(${scale})`, marginRight: `${-(1 - scale) * 210 * 3.7795275591}px` }">
        <article class="invoice-box" :class="`d-${density}`" aria-label="Facture">
          <div v-if="duplicata" class="watermark" aria-hidden="true">DUPLICATA</div>

          <header class="inv-head">
            <div class="brand">
              <svg viewBox="0 0 64 64" class="crest" aria-hidden="true">
                <path d="M32 3 57 12v21c0 15-11 25-25 29C18 58 7 48 7 33V12z" fill="#0d2145" />
                <path d="M32 7 53 14.500V33c0 12.500-9 21-21 24.500C20 54 11 45.500 11 33V14.500z" fill="none" stroke="#d4a02a" stroke-width="2" />
                <path d="M20 20h7l5 15 5-15h7L35 46h-6z" fill="#fff" />
                <path d="m32 11 1.600 3.300 3.600.5-2.600 2.500.6 3.600L32 19l-3.200 1.900.6-3.600-2.600-2.500 3.600-.5z" fill="#d4a02a" />
              </svg>
              <div>
                <p class="school">{{ SITE.nom }}</p>
                <p class="muted">{{ SITE.bp }} · {{ SITE.tel }}</p>
                <p class="muted">{{ SITE.email }} · NIU {{ SITE.niu }}</p>
              </div>
            </div>
            <div class="title-block">
              <p class="word">FACTURE<span v-if="duplicata" class="dup"> · DUPLICATA</span></p>
              <p class="num">N° {{ facture.numero }}</p>
              <p class="muted">Émise le {{ dateStr }} à {{ heureStr }}</p>
              <p class="paid">PAYÉE</p>
            </div>
          </header>

          <section class="parties">
            <div>
              <p class="cap">Payeur</p>
              <p class="strong">{{ commande.payeur.nom }}</p>
              <p class="muted">{{ maskPhone(commande.payeur.tel) }}<span v-if="commande.payeur.email"> · {{ commande.payeur.email }}</span></p>
            </div>
            <div>
              <p class="cap">Participant{{ participants.length > 1 ? 's' : '' }} · {{ offres }}</p>
              <p class="strong clamp">
                <template v-for="(p, i) in participants" :key="p.id">{{ p.nom }}<span class="muted"> ({{ p.detail }})</span><template v-if="i < participants.length - 1">, </template></template>
              </p>
              <p class="muted clamp">{{ sessionLabel }}</p>
            </div>
          </section>

          <table class="lines">
            <thead>
              <tr><th class="c-n">N°</th><th>Désignation</th><th class="c-q">Qté</th><th class="c-r">Prix unitaire</th><th class="c-r">Montant</th></tr>
            </thead>
            <tbody>
              <tr v-for="(l, i) in lignes" :key="i" :class="{ neg: l.montant < 0 }">
                <td class="c-n">{{ i + 1 }}</td>
                <td class="des"><span>{{ l.libelle }}</span><span v-if="l.detail" class="muted"> · {{ l.detail }}</span><span class="muted"> — {{ l.participantNom }}</span></td>
                <td class="c-q">{{ l.qte }}</td>
                <td class="c-r tab">{{ nombre(l.pu) }}</td>
                <td class="c-r tab">{{ nombre(l.montant) }}</td>
              </tr>
            </tbody>
          </table>

          <section class="bottom">
            <div class="pay">
              <div class="qr" v-html="qr" role="img" :aria-label="`Code QR de vérification de la facture ${facture.numero}`" />
              <dl>
                <div><dt>Opérateur</dt><dd>{{ nomOp }}</dd></div>
                <div><dt>Numéro débité</dt><dd>{{ maskPhone(paiement.numero) }}</dd></div>
                <div><dt>Date et heure</dt><dd>{{ dateStr }} {{ heureStr }}</dd></div>
                <div><dt>Réf. opérateur</dt><dd class="mono">{{ paiement.referenceOperateur }}</dd></div>
                <div><dt>Réf. interne</dt><dd class="mono">{{ paiement.referenceInterne }}</dd></div>
                <div><dt>Code de vérification</dt><dd class="mono">{{ facture.code }}</dd></div>
              </dl>
            </div>
            <div class="tot">
              <div v-if="commande.devis.remises > 0 || commande.devis.frais > 0" class="sub">
                <p v-if="commande.devis.remises > 0"><span>Remises et forfaits incluses</span><span class="tab">− {{ nombre(commande.devis.remises) }}</span></p>
                <p v-if="commande.devis.frais > 0"><span>Frais de transaction</span><span class="tab">{{ nombre(commande.devis.frais) }}</span></p>
              </div>
              <p class="total"><span>Total payé</span><span class="tab">{{ nombre(facture.montant) }} <small>FCFA</small></span></p>
              <p class="words">{{ phrase(facture.montant) }}</p>
            </div>
          </section>

          <footer class="inv-foot">
            <span>Facture acquittée, générée électroniquement. Aucune signature requise. Vérification : {{ lien.replace(/^https?:\/\//, '') }}</span>
            <span>
              <template v-if="avoirs?.length">Avoirs liés : {{ avoirs.map((a) => a.numero).join(', ') }} · </template>
              Toute correction passe par un avoir · Page 1/1
            </span>
          </footer>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invoice-scale-wrap { width: 100%; overflow-x: auto; overflow-y: hidden; }
.invoice-scale { width: 210mm; height: 148mm; transform-origin: top left; }
.invoice-box {
  position: relative; width: 210mm; height: 148mm; box-sizing: border-box; padding: 7.5mm; background: #fff; color: #0f172a;
  font-family: 'Poppins', sans-serif; font-size: 7.6pt; line-height: 1.35; display: flex; flex-direction: column; gap: 2.2mm;
  box-shadow: 0 1px 2px rgba(13,33,69,.08), 0 18px 40px -14px rgba(13,33,69,.28); border-top: 1.6mm solid #0d2145; overflow: hidden;
}
.invoice-box::after { content: ''; position: absolute; left: 0; right: 0; top: -1.6mm; height: 1.6mm; background: linear-gradient(90deg, #0d2145 70%, #d4a02a 70%); }
.watermark { position: absolute; inset: 0; display: grid; place-items: center; font-size: 56pt; font-weight: 700; letter-spacing: .1em; color: rgba(13,33,69,.07); transform: rotate(-18deg); pointer-events: none; }
.muted { color: #64748b; font-size: .92em; }
.strong { font-weight: 600; }
.tab { font-variant-numeric: tabular-nums; }
.mono { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: .95em; }
.inv-head { display: flex; justify-content: space-between; gap: 6mm; }
.brand { display: flex; gap: 3mm; align-items: center; min-width: 0; }
.crest { width: 12mm; height: 12mm; flex: none; }
.school { font-size: 10pt; font-weight: 700; color: #0d2145; line-height: 1.15; }
.title-block { text-align: right; flex: none; }
.word { font-size: 15pt; font-weight: 700; letter-spacing: .08em; color: #0d2145; line-height: 1; }
.dup { color: #b57f1f; }
.num { font-weight: 600; font-size: 8.6pt; margin-top: .8mm; }
.paid { display: inline-block; margin-top: 1mm; border: .35mm solid #047857; color: #047857; font-weight: 700; letter-spacing: .14em; padding: .2mm 2.2mm; border-radius: 1mm; font-size: 8pt; transform: rotate(-3deg); }
.parties { display: grid; grid-template-columns: 1fr 1.4fr; gap: 4mm; padding: 2mm 3mm; background: #f1f5fb; border-left: .8mm solid #d4a02a; border-radius: 1.2mm; }
.cap { font-size: 6pt; text-transform: uppercase; letter-spacing: .12em; font-weight: 600; color: #8f5f1d; }
.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.lines { width: 100%; border-collapse: collapse; }
.lines th { text-align: left; font-size: 6.2pt; text-transform: uppercase; letter-spacing: .08em; color: #fff; background: #0d2145; padding: 1mm 2mm; font-weight: 600; }
.lines td { padding: .9mm 2mm; border-bottom: .2mm solid #e2e8f0; }
.lines tr.neg td { color: #047857; }
.lines .c-n { width: 7mm; text-align: center; } .lines .c-q { width: 10mm; text-align: center; } .lines .c-r { width: 26mm; text-align: right; }
.des { max-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.d-sm .lines td { padding: .45mm 2mm; font-size: 7pt; } .d-xs .lines td { padding: .2mm 2mm; font-size: 6.4pt; } .d-xs, .d-sm { gap: 1.6mm; }
.bottom { margin-top: auto; display: grid; grid-template-columns: 1.25fr 1fr; gap: 5mm; align-items: end; }
.pay { display: flex; gap: 3mm; align-items: center; }
.qr { width: 22mm; height: 22mm; flex: none; padding: 1mm; border: .25mm solid #cbd5e1; border-radius: 1.2mm; }
.qr :deep(svg) { width: 100%; height: 100%; display: block; }
dl { display: grid; grid-template-columns: 1fr 1fr; gap: .4mm 3mm; min-width: 0; }
dt { font-size: 5.6pt; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
dd { font-size: 7pt; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tot .sub p { display: flex; justify-content: space-between; color: #475569; }
.total { display: flex; justify-content: space-between; align-items: baseline; background: #0d2145; color: #fff; padding: 1.6mm 3mm; border-radius: 1.4mm; font-weight: 600; font-size: 8.6pt; margin-top: .8mm; }
.total .tab { font-size: 14pt; font-weight: 700; color: #f5e09b; } .total small { font-size: 7pt; font-weight: 600; }
.words { margin-top: 1mm; font-style: italic; color: #334155; font-size: 7pt; }
.inv-foot { display: flex; justify-content: space-between; gap: 4mm; border-top: .25mm solid #cbd5e1; padding-top: 1mm; font-size: 5.8pt; color: #64748b; }
</style>
