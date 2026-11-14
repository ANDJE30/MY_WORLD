import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import type { ReactNode } from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { Settings } from '../settings-types';
import { dateTimeFr, phoneFr } from '../format';

const ASSETS = path.join(process.cwd(), 'src', 'assets', 'pdf');
const asset = (f: string) => path.join(ASSETS, f);

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: 'Poppins',
    fonts: [
      { src: asset('fonts/Poppins-Regular.ttf'), fontWeight: 400 },
      { src: asset('fonts/Poppins-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
      { src: asset('fonts/Poppins-SemiBold.ttf'), fontWeight: 600 },
      { src: asset('fonts/Poppins-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  fontsReady = true;
}

export const C = {
  navy: '#0a163a',
  navy2: '#112152',
  royal: '#2453d6',
  gold: '#c6a836',
  goldLight: '#fbf3d6',
  text: '#1a1a2e',
  muted: '#64748b',
  line: '#d9e0ef',
  zebra: '#f4f7fd',
  green: '#047857',
  red: '#be123c',
};

export const s = StyleSheet.create({
  page: { fontFamily: 'Poppins', fontSize: 9, color: C.text, paddingHorizontal: 36 },
  title: { fontSize: 15, fontWeight: 700, color: C.navy, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 },
  subtitle: { fontSize: 9.5, color: C.muted, textAlign: 'center', marginTop: 2 },
  h2: { fontSize: 11, fontWeight: 600, color: C.navy, marginTop: 12, marginBottom: 5 },
  small: { fontSize: 7.5, color: C.muted },
  table: { borderWidth: 0.8, borderColor: C.line, borderRadius: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: C.line },
  th: { backgroundColor: C.navy, color: '#ffffff', fontWeight: 600, fontSize: 8, paddingVertical: 4.5, paddingHorizontal: 4 },
  td: { paddingVertical: 3.6, paddingHorizontal: 4, fontSize: 8.4 },
  totalRow: { backgroundColor: C.goldLight, fontWeight: 700 },
});

export type Col = { label: string; width: number; align?: 'left' | 'right' | 'center' };

/** Tableau avec en-tête répété sur chaque page et lignes alternées. */
export function Table({ cols, rows, total, fontSize }: { cols: Col[]; rows: (string | number)[][]; total?: (string | number)[]; fontSize?: number }) {
  return (
    <View style={s.table}>
      <View style={[s.tr, { borderBottomWidth: 0 }]} fixed>
        {cols.map((c, i) => (
          <Text key={i} style={[s.th, { width: `${c.width}%`, textAlign: c.align ?? 'left' }]}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[s.tr, ri % 2 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
          {r.map((v, i) => (
            <Text key={i} style={[s.td, { width: `${cols[i].width}%`, textAlign: cols[i].align ?? 'left' }, fontSize ? { fontSize } : {}]}>{String(v)}</Text>
          ))}
        </View>
      ))}
      {total && (
        <View style={[s.tr, s.totalRow, { borderBottomWidth: 0 }]} wrap={false}>
          {total.map((v, i) => (
            <Text key={i} style={[s.td, { width: `${cols[i].width}%`, textAlign: cols[i].align ?? 'left', fontWeight: 700 }, fontSize ? { fontSize } : {}]}>{String(v)}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function KeyValues({ items, columns = 2 }: { items: [string, string][]; columns?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderWidth: 0.8, borderColor: C.line, borderRadius: 3, padding: 6, marginTop: 8 }}>
      {items.map(([k, v], i) => (
        <View key={i} style={{ width: `${100 / columns}%`, flexDirection: 'row', paddingVertical: 2 }}>
          <Text style={{ fontWeight: 600, color: C.navy, width: 92 }}>{k}</Text>
          <Text style={{ flex: 1 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export function Signatures({ left, right, place }: { left?: string; right?: string; place?: string }) {
  return (
    <View wrap={false} style={{ marginTop: 22 }}>
      {place && <Text style={{ textAlign: 'right', marginBottom: 6 }}>{place}</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: '42%', alignItems: 'center' }}>{left && <><Text style={{ fontWeight: 600, textDecoration: 'underline' }}>{left}</Text><View style={{ height: 50 }} /></>}</View>
        <View style={{ width: '42%', alignItems: 'center' }}>{right && <><Text style={{ fontWeight: 600, textDecoration: 'underline' }}>{right}</Text><View style={{ height: 50 }} /></>}</View>
      </View>
    </View>
  );
}

export async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 0, width: 220, color: { dark: '#0a163a', light: '#ffffff' } });
}

type DocProps = {
  settings: Settings;
  title: string;
  subtitle?: string;
  landscape?: boolean;
  children: ReactNode;
  docTitle?: string;
  bannerOverride?: { data: Buffer; format: 'png' | 'jpg' } | null;
  verifyCode?: string;
  verifyUrl?: string;
  qr?: string;
  size?: 'A4' | 'A5';
};

/** Gabarit commun : bandeau d'en-tête SVTC, filigrane, pied de page aux couleurs du papier en-tête, pagination. */
export function SvtcDoc({ settings, title, subtitle, landscape, children, docTitle, bannerOverride, verifyCode, verifyUrl, qr, size = 'A4' }: DocProps) {
  registerFonts();
  const id = settings.identity;
  const W = landscape ? 842 : size === 'A5' ? 420 : 595;
  const H = landscape ? 595 : size === 'A5' ? 595 : 842;
  const banner = (!landscape && bannerOverride) || { data: fs.readFileSync(asset(landscape ? 'bandeau-centre.jpg' : 'bandeau.jpg')), format: 'jpg' as const };
  const bannerH = landscape ? 78 : (W * 332) / 1654;
  const footer = fs.readFileSync(asset('pied.jpg'));
  const footerH = (W * 119) / 1654;
  const wm = fs.readFileSync(asset('filigrane.png'));
  const contact = [id.phones.map((p) => phoneFr(p)).join(' / '), id.email].filter(Boolean).join(' · ');
  return (
    <Document title={docTitle ?? title} author={id.name} creator="SVTC Répétitions" producer="SVTC Répétitions" language="fr">
      <Page size={size} orientation={landscape ? 'landscape' : 'portrait'} style={[s.page, { paddingTop: bannerH + (landscape ? 22 : 16), paddingBottom: footerH + 36 }]} wrap>
        {/* En-tête */}
        {landscape ? (
          <View fixed style={{ position: 'absolute', top: 0, left: 0, width: W, height: bannerH + 8 }}>
            <View style={{ backgroundColor: '#060d27', height: bannerH, alignItems: 'center' }}>
              <Image src={banner} style={{ height: bannerH, width: (bannerH * 900) / 295 }} />
            </View>
            <View style={{ height: 2.4, backgroundColor: C.gold, marginTop: 1.5 }} />
            <View style={{ height: 1.2, backgroundColor: C.gold, marginTop: 1.5 }} />
          </View>
        ) : (
          <Image fixed src={banner} style={{ position: 'absolute', top: 0, left: 0, width: W, height: bannerH }} />
        )}
        {/* Filigrane */}
        <Image fixed src={{ data: wm, format: 'png' }} style={{ position: 'absolute', width: W * 0.55, left: W * 0.225, top: H * 0.33, opacity: 0.55 }} />
        {/* Pied de page */}
        <Image fixed src={{ data: footer, format: 'jpg' }} style={{ position: 'absolute', bottom: 0, left: 0, width: W, height: footerH }} />
        <View fixed style={{ position: 'absolute', bottom: footerH * 0.22, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#ffffff', fontSize: 6.8, fontWeight: 600, letterSpacing: 0.6 }}>{id.name}  <Text style={{ color: '#f2c318' }}>|</Text>  {id.city} – {id.country}</Text>
          <Text style={{ color: '#f2c318', fontSize: 6.8 }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
        <Text fixed style={{ position: 'absolute', bottom: footerH + 6, left: 36, right: 36, fontSize: 6.5, color: C.muted, textAlign: 'center' }}>
          {`${id.host} · ${id.address}, ${id.city}${contact ? ' · ' + contact : ''} — Édité le ${dateTimeFr(new Date())}`}
        </Text>

        {/* Titre */}
        <View style={{ marginBottom: 8 }}>
          <Text style={s.title}>{title}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          <View style={{ height: 1.6, backgroundColor: C.gold, width: 110, alignSelf: 'center', marginTop: 5 }} />
        </View>
        {children}
        {verifyCode && (
          <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, borderTopWidth: 0.6, borderTopColor: C.line, paddingTop: 6 }}>
            {qr && <Image src={qr} style={{ width: 52, height: 52, marginRight: 8 }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7.5, fontWeight: 600, color: C.navy }}>Code d&apos;authenticité : {verifyCode}</Text>
              <Text style={s.small}>Vérifiez l&apos;authenticité de ce document en scannant le QR code ou sur {verifyUrl}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function toPdf(el: React.ReactElement): Promise<Buffer> {
  registerFonts();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(el as any);
}

export function pdfResponse(buf: Buffer, filename: string, download = false) {
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
