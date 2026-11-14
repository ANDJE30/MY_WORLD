import { DatabaseBackup, FileSpreadsheet, ShieldCheck, Download } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

export const metadata = { title: 'Sauvegarde & export' };

const EXPORTS = [
  ['eleves', 'Élèves et parents'], ['paiements', 'Paiements'], ['depenses', 'Dépenses'], ['seances', 'Séances et heures'],
  ['presences', 'Présences'], ['notes', 'Notes'], ['encadreurs', 'Encadreurs'], ['salaires', 'États de salaires enregistrés'],
];

export default function BackupPage() {
  return (
    <div className="space-y-6">
      <PageHeader kicker="Sécurité" title="Sauvegarde & export" subtitle="Exportez vos données à tout moment : elles vous appartiennent." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><DatabaseBackup size={18} className="text-royal-600" /> Sauvegarde complète</span>}>
          <p className="text-sm text-slate-600">Fichier JSON contenant toutes les données métier (hors fichiers PDF et mots de passe). À conserver sur une clé USB ou un drive après chaque fin de mois.</p>
          <a href="/api/export/sauvegarde" className="btn btn-gold mt-4"><Download size={16} /> Télécharger la sauvegarde (JSON)</a>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-navy-50/60 p-3 text-xs text-slate-600"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-royal-600" /> Selon l’offre de l’hébergeur de la base (Render payant, Neon), des sauvegardes automatiques s’ajoutent à cet export.</p>
        </Card>
        <Card title={<span className="flex items-center gap-2"><FileSpreadsheet size={18} className="text-royal-600" /> Exports Excel (CSV)</span>}>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXPORTS.map(([k, v]) => <a key={k} href={`/api/export/${k}`} className="btn btn-ghost justify-start"><Download size={15} /> {v}</a>)}
          </div>
          <p className="hint mt-3">Fichiers CSV (séparateur « ; », encodage UTF-8) directement lisibles dans Excel ou LibreOffice.</p>
        </Card>
      </div>
    </div>
  );
}
