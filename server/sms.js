// Messages aux parents : numéros de téléphone, longueur des SMS et passerelles d'envoi (configurées par AI721 dans la console).
import { getPlatformSettings, inPlatform } from './platform.js';
import { unseal } from './vault.js';

/** Numéro camerounais ou international → format E.164 (+237XXXXXXXXX), ou null s'il est inexploitable. */
export function normalizePhone(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  const plus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  else if (!plus && d.length === 9 && /^[62]/.test(d)) d = '237' + d; // numéro national (mobile 6…, fixe 2…)
  if (d.startsWith('237')) return /^237[62]\d{8}$/.test(d) ? `+${d}` : null;
  return (plus || raw.toString().trim().startsWith('00')) && d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

/* ---------- Longueur des SMS : alphabet GSM 7 bits (160 caractères) ou Unicode (70 caractères) ---------- */
const GSM7 = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXT = '^{}\\[~]|€';
export function smsInfo(text) {
  const t = String(text || '');
  let units = 0, gsm = true;
  for (const ch of t) { if (GSM7.includes(ch)) units += 1; else if (GSM7_EXT.includes(ch)) units += 2; else { gsm = false; break; } }
  const len = gsm ? units : [...t].length;
  const single = gsm ? 160 : 70, multi = gsm ? 153 : 67;
  const segments = len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / multi);
  // caractères qui font basculer en Unicode (ex. ê, ô, ç) : signalés pour aider à raccourcir le coût
  const unicode = gsm ? [] : [...new Set([...t].filter((ch) => !GSM7.includes(ch) && !GSM7_EXT.includes(ch)))].slice(0, 8);
  return { length: len, encoding: gsm ? 'GSM 7 bits' : 'Unicode', segments, unicode };
}

/** Remplace les caractères hors alphabet GSM (ê, ô, ç, ï, guillemets typographiques…) par leur équivalent simple : 1 SMS = 160 caractères au lieu de 70. */
export function gsmify(text) {
  const map = { '’': "'", '‘': "'", '«': '"', '»': '"', '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', '\u00a0': ' ', '\u202f': ' ', 'œ': 'oe', 'Œ': 'OE' };
  let out = '';
  for (const ch of String(text || '')) {
    if (GSM7.includes(ch) || GSM7_EXT.includes(ch)) { out += ch; continue; }
    if (map[ch] !== undefined) { out += map[ch]; continue; }
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    out += GSM7.includes(base) ? base : ch;
  }
  return out;
}

/* ---------- Passerelles ---------- */
export const PROVIDERS = {
  aucun: 'Aucune (envoi manuel uniquement)',
  simulation: 'Simulation (démonstration et tests : aucun SMS réel)',
  africastalking: "Africa's Talking",
  twilio: 'Twilio',
  orange: 'Orange SMS API (Orange Developer)'
};
/** Configuration de la passerelle, lue dans la base plateforme (secret déchiffré à la volée). */
export function gatewayConfig() {
  const ps = inPlatform(getPlatformSettings);
  const provider = PROVIDERS[ps.sms_provider] ? ps.sms_provider : 'aucun';
  const secret = ps.sms_secret_enc ? unseal(ps.sms_secret_enc) : null;
  const configured = provider === 'simulation' || (provider !== 'aucun' && !!ps.sms_user && !!secret);
  return { provider, label: PROVIDERS[provider], configured, user: ps.sms_user, secret, sender: ps.sms_sender, from: ps.sms_from };
}

const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();
async function readJson(res) { try { return await res.json(); } catch { return null; } }
let orangeToken = { value: null, exp: 0 };

/** Envoie un SMS ; ne lève jamais d'exception : { ok, id } ou { ok: false, error }. */
export async function sendSms(cfg, to, text) {
  try {
    if (cfg.provider === 'simulation') return { ok: true, simulated: true, id: `SIM-${Date.now().toString(36)}` };
    if (!cfg.configured) return { ok: false, error: 'Passerelle SMS non configurée' };
    if (cfg.provider === 'africastalking') {
      const host = cfg.user === 'sandbox' ? 'https://api.sandbox.africastalking.com' : 'https://api.africastalking.com';
      const res = await fetch(`${host}/version1/messaging`, { method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { apiKey: cfg.secret, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ username: cfg.user, to, message: text, from: cfg.sender }) });
      const j = await readJson(res);
      const rcp = j?.SMSMessageData?.Recipients?.[0];
      if (res.ok && rcp && /success|sent|submitted|queued/i.test(rcp.status)) return { ok: true, id: rcp.messageId };
      return { ok: false, error: rcp?.status || j?.SMSMessageData?.Message || `HTTP ${res.status}` };
    }
    if (cfg.provider === 'twilio') {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.user)}/Messages.json`, { method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ To: to, From: cfg.from || cfg.sender, Body: text }) });
      const j = await readJson(res);
      return res.ok ? { ok: true, id: j?.sid } : { ok: false, error: j?.message || `HTTP ${res.status}` };
    }
    if (cfg.provider === 'orange') {
      if (!orangeToken.value || orangeToken.exp < Date.now() + 60000) {
        const tr = await fetch('https://api.orange.com/oauth/v3/token', { method: 'POST', signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: 'grant_type=client_credentials' });
        const tj = await readJson(tr);
        if (!tr.ok || !tj?.access_token) return { ok: false, error: tj?.error_description || `Jeton Orange refusé (HTTP ${tr.status})` };
        orangeToken = { value: tj.access_token, exp: Date.now() + (Number(tj.expires_in) || 3000) * 1000 };
      }
      const from = `tel:+${String(cfg.from || '').replace(/\D/g, '')}`;
      const res = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(from)}/requests`, { method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${orangeToken.value}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ outboundSMSMessageRequest: { address: `tel:${to}`, senderAddress: from, ...(cfg.sender ? { senderName: cfg.sender } : {}), outboundSMSTextMessage: { message: text } } }) });
      const j = await readJson(res);
      return res.ok ? { ok: true, id: j?.outboundSMSMessageRequest?.resourceURL?.split('/').pop() || null } : { ok: false, error: j?.requestError?.serviceException?.text || j?.message || `HTTP ${res.status}` };
    }
    return { ok: false, error: 'Passerelle inconnue' };
  } catch (e) {
    return { ok: false, error: e.name === 'TimeoutError' ? 'Délai dépassé' : (e.message || 'Erreur réseau') };
  }
}
