'use client';

import { useState } from 'react';
import { ActionForm, SubmitButton, type Result } from './forms';

type Act = (fd: FormData) => Promise<Result>;

export function ImportStudentsForm({ action, classes }: { action: Act; classes: { id: number; name: string }[] }) {
  const [errors, setErrors] = useState<string[]>([]);
  const sample = 'nom;prenom;sexe;classe;date_naissance;etablissement;parent;telephone_parent;lien\nMBALLA;Jean Paul;M;PTI;12/03/2009;Lycée Technique de Nkolbisson;MBALLA Pierre;677123456;Père';
  return (
    <ActionForm action={action} closeOnSuccess={false} onSuccess={(r) => setErrors(Array.isArray(r?.data) ? (r!.data as string[]) : [])} className="space-y-4">
      <div className="rounded-xl bg-navy-50/60 p-3 text-xs text-navy-700">
        <p className="font-semibold">Format attendu (CSV séparé par « ; » ou « , », ou copier-coller depuis Excel)</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre text-[11px]">{sample}</pre>
        <p className="mt-2">Colonnes reconnues : nom, prenom, sexe, classe (code ou nom), date_naissance, etablissement, telephone_eleve, parent, telephone_parent, lien. Les parents sont créés automatiquement (un même numéro = un même parent).</p>
        <a className="mt-2 inline-block text-royal-700 underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + sample)}`} download="modele_import_eleves.csv">Télécharger le modèle CSV</a>
      </div>
      <label className="block"><span className="label">Fichier CSV</span><input type="file" name="file" accept=".csv,text/csv,text/plain" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-royal-50 file:px-3 file:py-2 file:text-royal-700" /></label>
      <label className="block"><span className="label">… ou collez la liste ici</span><textarea name="text" className="input font-mono text-xs" rows={6} placeholder={sample} /></label>
      <label className="block"><span className="label">Classe par défaut (si la colonne « classe » est absente)</span>
        <select name="classId" className="input" defaultValue=""><option value="">—</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <SubmitButton pendingText="Import en cours…">Importer</SubmitButton>
      {errors.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}
    </ActionForm>
  );
}
