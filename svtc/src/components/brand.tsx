/* eslint-disable @next/next/no-img-element */
import { cn } from './ui';

export function Logo({ className, variant = 'full', logoUrl }: { className?: string; variant?: 'full' | 'emblem'; logoUrl?: string | null }) {
  const src = logoUrl ?? (variant === 'full' ? '/brand/logo.webp' : '/brand/emblem.webp');
  return <img src={src} alt="Silicon Valley Training Center" className={cn('select-none object-contain', className)} draggable={false} />;
}

export function Motto({ className }: { className?: string }) {
  return (
    <p className={cn('font-serif italic leading-snug', className)}>
      « C&apos;est votre <span className="not-italic font-bold text-gold-400">ATTITUDE</span>, non pas seulement votre aptitude, qui détermine votre{' '}
      <span className="not-italic font-bold text-gold-400">ALTITUDE</span>. »
    </p>
  );
}

export function CircuitLines({ className }: { className?: string }) {
  return (
    <svg className={cn('pointer-events-none', className)} viewBox="0 0 400 200" fill="none" aria-hidden>
      <g stroke="#38bdf8" strokeOpacity=".35" strokeWidth="1.5">
        <path d="M0 30h90l30 30h120l20-20h140" />
        <path d="M0 80h60l25 25h95l30-30h190" />
        <path d="M0 140h130l20 20h70l25-25h155" />
        <path d="M0 180h40l15-15h85" />
      </g>
      <g fill="#38bdf8" fillOpacity=".7">
        <circle cx="240" cy="60" r="4" /><circle cx="180" cy="105" r="4" /><circle cx="220" cy="160" r="4" /><circle cx="140" cy="165" r="3" />
        <circle cx="90" cy="30" r="3" /><circle cx="400" cy="40" r="3" />
      </g>
    </svg>
  );
}
