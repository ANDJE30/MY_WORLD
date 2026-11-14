// Graphiques SVG légers rendus côté serveur (aucune bibliothèque, aucun script).
import { num } from '@/lib/format';

export function BarChart({
  data, series, height = 220, format = (v: number) => num(v),
}: {
  data: { label: string; values: number[] }[];
  series: { name: string; color: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const W = 640;
  const H = height;
  const padL = 8;
  const padB = 28;
  const padT = 18;
  const groupW = (W - padL * 2) / Math.max(1, data.length);
  const barW = Math.min(30, (groupW * 0.7) / series.length);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Graphique en barres">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padL} x2={W - padL} y1={padT + (H - padT - padB) * (1 - f)} y2={padT + (H - padT - padB) * (1 - f)} stroke="#e6ebf6" strokeDasharray="4 4" />
        ))}
        {data.map((d, i) => {
          const gx = padL + i * groupW + (groupW - barW * series.length - (series.length - 1) * 4) / 2;
          return (
            <g key={d.label}>
              {d.values.map((v, j) => {
                const h = ((H - padT - padB) * v) / max;
                const x = gx + j * (barW + 4);
                const y = H - padB - h;
                return (
                  <g key={j}>
                    <rect x={x} y={y} width={barW} height={Math.max(h, v > 0 ? 2 : 0)} rx={5} fill={series[j].color}>
                      <title>{`${d.label} — ${series[j].name} : ${format(v)}`}</title>
                    </rect>
                    {v > 0 && data.length <= 8 && (
                      <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#475569">{format(v)}</text>
                    )}
                  </g>
                );
              })}
              <text x={padL + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="11.5" fill="#64748b">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Donut({ value, label, color = '#2453d6', size = 120 }: { value: number | null; label?: string; color?: string; size?: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label ?? ''} ${Math.round(v)} %`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2fb" strokeWidth="11" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y={label ? 50 : 55} textAnchor="middle" fontSize="19" fontWeight="600" fill="#0a163a">{value === null ? '—' : `${Math.round(v)}%`}</text>
      {label && <text x="50" y="65" textAnchor="middle" fontSize="8.5" fill="#64748b">{label}</text>}
    </svg>
  );
}

export function LineChart({ points, max = 20, height = 200, color = '#2453d6', threshold = 10 }: { points: { label: string; value: number }[]; max?: number; height?: number; color?: string; threshold?: number }) {
  const W = 640;
  const H = height;
  const pad = { l: 30, r: 12, t: 14, b: 26 };
  if (points.length === 0) return <p className="py-8 text-center text-sm text-slate-500">Pas encore de notes.</p>;
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Évolution des notes">
      <defs>
        <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient>
      </defs>
      {[0, 5, 10, 15, 20].filter((v) => v <= max).map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === threshold ? '#f2c318' : '#e6ebf6'} strokeDasharray={v === threshold ? '0' : '4 4'} />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{v}</text>
        </g>
      ))}
      <path d={area} fill="url(#lg)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="4.5" fill="#fff" stroke={p.value < threshold ? '#e11d48' : color} strokeWidth="2.5"><title>{`${p.label} : ${num(p.value, 2)}/20`}</title></circle>
          {points.length <= 12 && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{p.label}</text>}
        </g>
      ))}
    </svg>
  );
}

export function HBar({ items, format = (v: number) => num(v) }: { items: { label: string; value: number; color?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between text-[13px]"><span className="truncate text-navy-800">{i.label}</span><span className="font-medium text-navy-950">{format(i.value)}</span></div>
          <div className="h-2 rounded-full bg-navy-50"><div className="h-2 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? '#2453d6' }} /></div>
        </li>
      ))}
    </ul>
  );
}
