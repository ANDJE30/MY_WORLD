import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import '@fontsource/poppins/300.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './globals.css';
import { AppProviders } from '@/components/client/providers';

export const metadata: Metadata = {
  title: { default: 'SVTC Répétitions — Silicon Valley Training Center', template: '%s · SVTC Répétitions' },
  description:
    "Plateforme de gestion des cours de répétitions en informatique de la Silicon Valley Training Center (Yaoundé, Biyem-Assi Lac) : planning, présences, notes, suivi des élèves, paiements et communication avec les parents.",
  applicationName: 'SVTC Répétitions',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/brand/favicon-64.png', type: 'image/png' }], apple: '/brand/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'SVTC', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0a163a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lecture des en-têtes : rendu dynamique obligatoire pour appliquer le nonce CSP à chaque requête.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="fr">
      <body className="min-h-dvh">
        {children}
        <AppProviders nonce={nonce} />
      </body>
    </html>
  );
}
