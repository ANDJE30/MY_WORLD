import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

// Hébergeurs à faible mémoire (Render gratuit : 512 Mo) : un seul processus de compilation,
// vérification des types faite en amont (npm run typecheck et tests) plutôt que pendant le build.
const lowMemory = process.env.LOW_MEMORY_BUILD === '1';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@react-pdf/renderer', 'postgres'],
  outputFileTracingIncludes: {
    '/api/pdf/**': ['./src/assets/pdf/**/*'],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4.4mb' },
    ...(lowMemory ? { cpus: 1, workerThreads: false, webpackMemoryOptimizations: true } : {}),
  },
  ...(lowMemory ? { typescript: { ignoreBuildErrors: true } } : {}),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
