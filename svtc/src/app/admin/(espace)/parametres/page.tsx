/* eslint-disable @next/next/no-img-element */
import { asc } from 'drizzle-orm';
import { Building2, CalendarClock, Image as ImageIcon, Wallet, MessageSquare, CalendarRange, ShieldCheck } from 'lucide-react';
import { db } from '@/db';
import { academicYears } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { smsConfig } from '@/lib/sms';
import { DAYS, MONTHS, SALARY_MODES } from '@/lib/constants';
import { phoneFr } from '@/lib/format';
import { Badge, Card, PageHeader } from '@/components/ui';
import { ActionButton, ActionForm, Modal, SubmitButton } from '@/components/client/forms';
import { saveIdentity, uploadLogo, resetLogo, saveSessions, saveFinanceSettings, createYear, setCurrentYear } from '@/app/actions/structure';

export const metadata = { title: 'Paramètres du centre' };

export default async function SettingsPage() {
  const s = await getSettings();
  const years = await db.select().from(academicYears).orderBy(asc(academicYears.startDate));
  const sms = smsConfig();
  const id = s.identity;
  const byDay = new Map(s.sessions.days.map((d) => [d.day, d]));
  const schoolMonths = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07', '08'];

  return (
    <div className="space-y-6">
      <PageHeader kicker="Structure" title="Paramètres du centre" subtitle="Identité, logo, horaires des séances, facturation, salaires, SMS et années scolaires." />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title={<span className="flex items-center gap-2"><Building2 size={18} className="text-royal-600" /> Identité de la structure</span>} subtitle="Ces informations apparaissent sur le site, les reçus, les plannings et tous les documents PDF.">
          <ActionForm action={saveIdentity} reset={false} className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="label">Nom complet</span><input name="name" className="input" defaultValue={id.name} required /></label>
            <label><span className="label">Sigle</span><input name="shortName" className="input" defaultValue={id.shortName} required /></label>
            <label><span className="label">Accroche</span><input name="tagline" className="input" defaultValue={id.tagline} /></label>
            <label className="sm:col-span-2"><span className="label">Devise</span><input name="motto" className="input" defaultValue={id.motto} /></label>
            <label className="sm:col-span-2"><span className="label">Slogan</span><input name="slogan" className="input" defaultValue={id.slogan} /></label>
            <label className="sm:col-span-2"><span className="label">Présentation</span><textarea name="description" className="input" defaultValue={id.description} /></label>
            <label><span className="label">Lieu d&apos;accueil</span><input name="host" className="input" defaultValue={id.host} /></label>
            <label><span className="label">Quartier / adresse</span><input name="address" className="input" defaultValue={id.address} /></label>
            <label><span className="label">Ville</span><input name="city" className="input" defaultValue={id.city} /></label>
            <label><span className="label">Pays</span><input name="country" className="input" defaultValue={id.country} /></label>
            {[0, 1, 2].map((i) => (
              <label key={i}><span className="label">Téléphone {i + 1}</span><input name={`phone${i + 1}`} className="input" inputMode="tel" defaultValue={id.phones[i] ? phoneFr(id.phones[i]) : ''} /></label>
            ))}
            <label><span className="label">WhatsApp du centre</span><input name="whatsapp" className="input" inputMode="tel" defaultValue={phoneFr(id.whatsapp)} /></label>
            <label><span className="label">E-mail</span><input name="email" type="email" className="input" defaultValue={id.email} /></label>
            <label><span className="label">Site web</span><input name="website" className="input" defaultValue={id.website} /></label>
            <label><span className="label">Nom du signataire</span><input name="directorName" className="input" defaultValue={id.directorName} placeholder="Ex. : M. NGONO Paul" /></label>
            <label><span className="label">Titre du signataire</span><input name="directorTitle" className="input" defaultValue={id.directorTitle} /></label>
            <div className="sm:col-span-2"><SubmitButton>Enregistrer l&apos;identité</SubmitButton></div>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><ImageIcon size={18} className="text-royal-600" /> Logo & bandeau</span>}>
            <div className="space-y-5">
              <div>
                <div className="flex h-36 items-center justify-center rounded-xl bg-navy-950 p-3">
                  <img src={id.logoFileId ? `/api/fichiers/${id.logoFileId}` : '/brand/logo.webp'} alt="Logo actuel" className="max-h-full max-w-full object-contain" />
                </div>
                <ActionForm action={uploadLogo} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="which" value="logo" />
                  <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-royal-50 file:px-3 file:py-2 file:text-royal-700" />
                  <SubmitButton className="btn btn-primary btn-sm">Changer le logo</SubmitButton>
                  {id.logoFileId && <ActionButton action={resetLogo.bind(null, 'logo')} className="btn btn-ghost btn-sm">Logo d&apos;origine</ActionButton>}
                </ActionForm>
                <p className="hint">PNG (fond transparent conseillé), JPEG ou WebP — 1 Mo maximum.</p>
              </div>
              <div>
                <p className="label">Bandeau d&apos;en-tête des documents PDF</p>
                <img src={id.bannerFileId ? `/api/fichiers/${id.bannerFileId}` : '/brand/bandeau.jpg'} alt="Bandeau" className="w-full rounded-lg border border-navy-100" />
                <ActionForm action={uploadLogo} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="which" value="banner" />
                  <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-royal-50 file:px-3 file:py-2 file:text-royal-700" />
                  <SubmitButton className="btn btn-primary btn-sm">Changer le bandeau</SubmitButton>
                  {id.bannerFileId && <ActionButton action={resetLogo.bind(null, 'banner')} className="btn btn-ghost btn-sm">Bandeau d&apos;origine</ActionButton>}
                </ActionForm>
                <p className="hint">Format paysage conseillé (environ 2480 × 500 pixels), comme le papier en-tête SVTC.</p>
              </div>
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-2"><CalendarRange size={18} className="text-royal-600" /> Années scolaires</span>}
            actions={
              <Modal title="Nouvelle année scolaire" trigger={<button className="btn btn-soft btn-sm">Ajouter</button>} size="sm">
                <ActionForm action={createYear} className="space-y-4">
                  <label className="block"><span className="label">Libellé</span><input name="label" className="input" placeholder="2027-2028" required pattern="\d{4}-\d{4}" /></label>
                  <SubmitButton>Créer</SubmitButton>
                </ActionForm>
              </Modal>
            }>
            <ul className="space-y-2">
              {years.map((y) => (
                <li key={y.id} className="flex items-center justify-between rounded-xl border border-navy-50 px-3 py-2">
                  <span className="text-sm font-medium text-navy-900">{y.label}</span>
                  {y.isCurrent ? <Badge tone="green">Année active</Badge> : <ActionButton action={setCurrentYear.bind(null, y.id)} confirm={`Basculer l'application sur l'année ${y.label} ?`} className="btn btn-ghost btn-sm">Activer</ActionButton>}
                </li>
              ))}
            </ul>
            <p className="hint mt-3">Les élèves, plannings, paiements et séances sont rattachés à une année. Les données des années précédentes restent consultables.</p>
          </Card>
        </div>
      </div>

      <Card title={<span className="flex items-center gap-2"><CalendarClock size={18} className="text-royal-600" /> Jours, horaires et créneaux des séances</span>} subtitle="Par défaut : mercredi 15h30–18h00 et dimanche 10h00–14h00. Les créneaux découpent chaque séance pour le planning automatique.">
        <ActionForm action={saveSessions} reset={false} className="space-y-3">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[640px]">
              <thead><tr><th>Jour</th><th>Début</th><th>Fin</th><th>Créneaux (séparés par ;)</th></tr></thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const cur = byDay.get(d);
                  return (
                    <tr key={d}>
                      <td><label className="flex items-center gap-2 font-medium"><input type="checkbox" className="check" name={`on_${d}`} defaultChecked={!!cur} /> {DAYS[d]}</label></td>
                      <td><input type="time" name={`start_${d}`} className="input w-32" defaultValue={cur?.start ?? '15:30'} /></td>
                      <td><input type="time" name={`end_${d}`} className="input w-32" defaultValue={cur?.end ?? '18:00'} /></td>
                      <td><input name={`slots_${d}`} className="input" defaultValue={cur ? cur.slots.map((x) => `${x.start}-${x.end}`).join(' ; ') : ''} placeholder="15:30-16:45 ; 16:45-18:00" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SubmitButton>Enregistrer les horaires</SubmitButton>
        </ActionForm>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Wallet size={18} className="text-royal-600" /> Facturation, salaires, SMS et sécurité</span>}>
        <ActionForm action={saveFinanceSettings} reset={false} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Frais des élèves</h3>
            <label className="block"><span className="label">Préfixe des reçus</span><input name="receiptPrefix" className="input" defaultValue={s.billing.receiptPrefix} /></label>
            <div>
              <span className="label">Mois facturables (mensualités)</span>
              <div className="flex flex-wrap gap-2">
                {schoolMonths.map((m) => (
                  <label key={m} className="chip cursor-pointer has-[:checked]:border-royal-600 has-[:checked]:bg-royal-600 has-[:checked]:text-white">
                    <input type="checkbox" name="billingMonths" value={m} defaultChecked={s.billing.billingMonths.includes(m)} className="sr-only" />
                    {MONTHS[Number(m) - 1]}
                  </label>
                ))}
              </div>
              <p className="hint">Le montant dû d&apos;un élève = frais d&apos;inscription + mensualité × mois écoulés depuis son inscription.</p>
            </div>
            <label className="block"><span className="label">Base de calcul de la location des salles</span>
              <select name="rentBasis" className="input" defaultValue={s.billing.rentBasis}>
                <option value="PLANNED">Durée prévue des séances tenues (recommandé)</option>
                <option value="ACTUAL">Durée réelle pointée par les encadreurs</option>
                <option value="WINDOW">Plage complète de la séance (salle réservée toute la séance)</option>
              </select>
            </label>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-500">Salaires des encadreurs</h3>
            <label className="block"><span className="label">Mode de calcul</span>
              <select name="salaryMode" className="input" defaultValue={s.salary.mode}>
                {Object.entries(SALARY_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Heures effectuées retenues</span>
              <select name="countBasis" className="input" defaultValue={s.salary.countBasis}>
                <option value="ACTUAL_CAPPED">Durée réelle, plafonnée à la durée prévue (recommandé)</option>
                <option value="ACTUAL">Durée réelle (sans plafond)</option>
                <option value="PLANNED">Durée prévue de chaque séance terminée</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="capAt100" className="check" defaultChecked={s.salary.capAt100} /> Plafonner le pourcentage d&apos;heures à 100 %</label>
            <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-navy-500">SMS & sécurité</h3>
            <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-3 text-sm">
              <p className="flex items-center gap-2"><MessageSquare size={16} className="text-royal-600" /> Passerelle SMS : <strong>{sms.label}</strong> {sms.configured ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Simulation</Badge>}</p>
              <p className="hint">Configurez SMS_PROVIDER et les clés de l&apos;opérateur (Orange, Twilio, Africa&apos;s Talking) dans les variables d&apos;environnement de l&apos;hébergeur. Sans passerelle, utilisez l&apos;envoi WhatsApp ou SMS depuis votre téléphone (gratuit).</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Nom d&apos;expéditeur</span><input name="senderName" maxLength={11} className="input" defaultValue={s.sms.senderName} /></label>
              <label><span className="label">Signature</span><input name="signature" className="input" defaultValue={s.sms.signature} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="forcePasswordChange" className="check" defaultChecked={s.security.forcePasswordChange} /> <ShieldCheck size={15} className="text-royal-600" /> Exiger le changement du mot de passe à la première connexion</label>
          </div>
          <div className="lg:col-span-2"><SubmitButton>Enregistrer</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
