'use client';

import { useEffect } from 'react';
import { Toaster } from 'sonner';

export function AppProviders(_props: { nonce?: string }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'Poppins, sans-serif' } }} />;
}
