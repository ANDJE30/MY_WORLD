import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand';
import { adminExists } from '@/lib/bootstrap';
import { InstallForm } from './form';

export const metadata = { title: 'Installation' };

export default async function Install() {
  if (await adminExists()) redirect('/admin/connexion');
  return (
    <main className="circuit-bg flex min-h-dvh items-center justify-center bg-navy-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="-mx-6 -mt-6 mb-6 rounded-t-3xl bg-navy-950 p-5 sm:-mx-8 sm:-mt-8"><Logo className="mx-auto h-20 w-auto" /></div>
        <h1 className="text-xl font-semibold text-navy-950">Installation de SVTC Répétitions</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Créez le compte administrateur principal. Les classes, matières, salles et horaires du centre sont déjà préparés : vous pourrez les modifier ensuite.</p>
        <InstallForm />
      </div>
    </main>
  );
}
