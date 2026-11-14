/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {
  Laptop, Code2, Database, Wrench, ShieldCheck, MapPin, Phone, GraduationCap, Users, ClipboardList, Award,
  ArrowRight, CheckCircle2, CalendarDays, Clock,
} from 'lucide-react';
import { Logo, Motto, CircuitLines } from '@/components/brand';
import { publicSettings, logoUrl } from '@/lib/public-settings';
import { phoneFr, hm } from '@/lib/format';

const DOMAINES = [
  { icon: Laptop, title: 'Informatique générale', text: 'Maîtrisez les bases et outils essentiels.' },
  { icon: Code2, title: 'Algorithmique et programmation', text: 'Apprenez à résoudre des problèmes et à créer des solutions.' },
  { icon: Database, title: "Système d'information", text: "Comprenez la conception et la gestion des systèmes d'information." },
  { icon: Wrench, title: 'Maintenance – Réseau – Création numérique', text: 'Développez des compétences pratiques et techniques.' },
  { icon: ShieldCheck, title: 'Réseau – Internet – Sécurité informatique', text: 'Explorez les réseaux, Internet et la cybersécurité.' },
];

const ATOUTS = [
  { icon: Users, title: 'Formateurs expérimentés', text: 'Encadrement par des professionnels de l’informatique.' },
  { icon: Laptop, title: 'Approche pratique', text: 'Méthodes modernes, pratique orientée projet et résultats.' },
  { icon: ClipboardList, title: 'Suivi personnalisé', text: 'Présences, évaluations régulières et bilans envoyés aux parents.' },
  { icon: Award, title: 'Examens officiels', text: 'Préparation au BEPC, Probatoire et Baccalauréat avec excellence.' },
];

export default async function Home() {
  const s = await publicSettings();
  const id = s.identity;
  return (
    <main className="bg-white">
      {/* En-tête */}
      <section className="circuit-bg relative overflow-hidden bg-navy-950 text-white">
        <CircuitLines className="absolute -left-24 top-0 w-[620px] opacity-50" />
        <CircuitLines className="absolute -right-24 bottom-0 w-[620px] rotate-180 opacity-40" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Logo variant="emblem" className="h-10 w-auto" logoUrl={logoUrl(s)} />
            <span className="hidden text-sm font-semibold tracking-wide sm:inline">{id.shortName} · Répétitions</span>
          </div>
          <Link href="/connexion" className="btn btn-gold btn-sm">Se connecter <ArrowRight size={16} /></Link>
        </nav>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-2 md:pb-24 md:pt-10">
          <div className="animate-fade-up">
            <Logo className="mb-6 h-36 w-auto sm:h-44" logoUrl={logoUrl(s)} />
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">
              COMPRENDRE. <span className="text-gold-400">PRATIQUER.</span> MAÎTRISER.
            </p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-navy-100">{id.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/parent/connexion" className="btn btn-gold">Espace parents</Link>
              <Link href="/encadreur/connexion" className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10">Espace encadreurs</Link>
            </div>
            <p className="mt-6 flex items-start gap-2 text-sm text-navy-100">
              <MapPin size={18} className="mt-0.5 shrink-0 text-gold-400" />
              <span>Au niveau du <strong className="text-white">{id.host}</strong>, {id.city}, {id.address}.</span>
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-gold-400/30 via-sky-400/10 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
              <img src="/brand/hero-students.jpg" alt="Élèves en séance de répétition d'informatique" className="h-72 w-full object-cover sm:h-96" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-navy-950/95 to-transparent p-5">
                <p className="text-lg font-semibold">Réussissez aujourd&apos;hui, brillez demain !</p>
              </div>
            </div>
          </div>
        </div>
        <div className="gold-rule" />
      </section>

      {/* Séances */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="card p-6 md:col-span-1">
            <GraduationCap className="text-royal-600" />
            <h2 className="mt-3 text-lg font-semibold text-navy-950">Cours de répétitions & préparation aux examens officiels</h2>
            <p className="mt-2 text-sm text-slate-600">Pour les élèves de la 6ème en Terminale (dont Première et Terminale TI) dans le domaine de l&apos;informatique.</p>
          </div>
          {s.sessions.days.map((d) => (
            <div key={d.day} className="card flex items-center gap-4 p-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy-950 text-gold-400"><CalendarDays /></div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Séance du</p>
                <p className="text-xl font-semibold text-navy-950">{d.label}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><Clock size={15} /> {hm(d.start)} – {hm(d.end)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Domaines */}
      <section className="bg-navy-50/60 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">Domaines de formation</p>
          <h2 className="mt-2 text-2xl font-semibold text-navy-950">Tout le programme d&apos;informatique, du collège au lycée</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {DOMAINES.map((d) => (
              <div key={d.title} className="card p-5 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500 to-navy-900 text-white"><d.icon size={20} /></div>
                <h3 className="mt-4 text-[15px] font-semibold text-navy-950">{d.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pour qui & atouts */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">Pour qui ?</p>
          <h2 className="mt-2 text-2xl font-semibold text-navy-950">Élèves de la 6ème en Terminale qui souhaitent :</h2>
          <ul className="mt-6 space-y-3">
            {['Renforcer leurs connaissances', 'Rattraper des notions mal comprises', 'Préparer efficacement leurs examens', 'Développer des compétences numériques', 'Se préparer pour l’avenir'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[15px] text-navy-900"><CheckCircle2 className="shrink-0 text-gold-500" size={20} /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ATOUTS.map((a) => (
            <div key={a.title} className="rounded-2xl border border-gold-200 bg-gold-50/50 p-5">
              <a.icon className="text-gold-600" />
              <h3 className="mt-3 font-semibold text-navy-950">{a.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{a.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Espaces */}
      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: '/parent/connexion', title: 'Parents', text: 'Planning, présences, notes, messages et paiements de votre enfant.', cls: 'from-gold-300 to-gold-500 text-navy-950' },
            { href: '/encadreur/connexion', title: 'Encadreurs', text: 'Séances, appel, fiches de TD, notes et états de suivi.', cls: 'from-royal-500 to-royal-800 text-white' },
            { href: '/admin/connexion', title: 'Administration', text: 'Pilotage complet du centre : planning, finances, communication.', cls: 'from-navy-800 to-navy-950 text-white' },
          ].map((p) => (
            <Link key={p.href} href={p.href} className={`group rounded-3xl bg-gradient-to-br p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] ${p.cls}`}>
              <p className="text-xl font-semibold">Espace {p.title}</p>
              <p className="mt-2 text-sm opacity-85">{p.text}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">Accéder <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pied */}
      <footer className="circuit-bg bg-navy-950 text-white">
        <div className="gold-rule" />
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-2">
          <div>
            <Motto className="text-lg text-navy-50" />
            <p className="mt-6 text-sm italic text-gold-300">{id.slogan}</p>
          </div>
          <div className="md:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Contacts utiles</p>
            <div className="mt-3 flex flex-wrap gap-3 md:justify-end">
              {id.phones.map((p) => (
                <a key={p} href={`tel:+237${p}`} className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-lg font-semibold tracking-wide ring-1 ring-white/10 hover:bg-white/10">
                  <Phone size={16} className="text-gold-400" /> {phoneFr(p)}
                </a>
              ))}
            </div>
            <p className="mt-4 text-sm text-navy-200">{id.host} · {id.address}, {id.city} – {id.country}</p>
          </div>
        </div>
        <p className="pb-6 text-center text-xs text-navy-300">© {new Date().getFullYear()} {id.name}. Tous droits réservés.</p>
      </footer>
    </main>
  );
}
