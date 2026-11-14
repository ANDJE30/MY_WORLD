import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SVTC Répétitions — Silicon Valley Training Center',
    short_name: 'SVTC',
    description: 'Gestion des cours de répétitions en informatique : planning, présences, notes, paiements et suivi des élèves.',
    start_url: '/connexion',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a163a',
    theme_color: '#0a163a',
    lang: 'fr',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
