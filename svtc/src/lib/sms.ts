import 'server-only';
import { phoneIntl } from './format';

/**
 * Passerelles SMS prises en charge. Les identifiants sont lus dans les variables d'environnement
 * (jamais stockés en base ni affichés) : SMS_PROVIDER = SIMULATION | TWILIO | ORANGE | AFRICASTALKING.
 */
export type SmsProvider = 'SIMULATION' | 'TWILIO' | 'ORANGE' | 'AFRICASTALKING';
export type SmsResult = { status: 'ENVOYE' | 'SIMULE' | 'ECHEC'; error?: string };

export function smsConfig(): { provider: SmsProvider; configured: boolean; label: string } {
  const p = (process.env.SMS_PROVIDER || 'SIMULATION').toUpperCase() as SmsProvider;
  const env = process.env;
  const configured =
    p === 'TWILIO' ? !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)
    : p === 'ORANGE' ? !!(env.ORANGE_CLIENT_ID && env.ORANGE_CLIENT_SECRET && env.ORANGE_SENDER_PHONE)
    : p === 'AFRICASTALKING' ? !!(env.AT_USERNAME && env.AT_API_KEY)
    : false;
  const labels: Record<SmsProvider, string> = {
    SIMULATION: 'Mode simulation (aucun SMS réel envoyé)',
    TWILIO: 'Twilio',
    ORANGE: 'Orange SMS API (Cameroun)',
    AFRICASTALKING: "Africa's Talking",
  };
  return { provider: configured ? p : 'SIMULATION', configured, label: labels[configured ? p : 'SIMULATION'] };
}

let orangeToken: { value: string; exp: number } | null = null;

async function orangeAccessToken(): Promise<string> {
  if (orangeToken && orangeToken.exp > Date.now() + 60_000) return orangeToken.value;
  const basic = Buffer.from(`${process.env.ORANGE_CLIENT_ID}:${process.env.ORANGE_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Orange OAuth ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  orangeToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function sendOne(provider: SmsProvider, to: string, body: string): Promise<SmsResult> {
  const env = process.env;
  const dest = phoneIntl(to);
  if (!/^\+237[26]\d{8}$/.test(dest)) return { status: 'ECHEC', error: 'Numéro invalide' };
  try {
    if (provider === 'TWILIO') {
      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: dest, From: env.TWILIO_FROM!, Body: body }).toString(),
        signal: AbortSignal.timeout(15000),
      });
      return r.ok ? { status: 'ENVOYE' } : { status: 'ECHEC', error: `Twilio ${r.status}` };
    }
    if (provider === 'ORANGE') {
      const token = await orangeAccessToken();
      const sender = `tel:${phoneIntl(env.ORANGE_SENDER_PHONE)}`;
      const r = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(sender)}/requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: `tel:${dest}`,
            senderAddress: sender,
            ...(env.ORANGE_SENDER_NAME ? { senderName: env.ORANGE_SENDER_NAME } : {}),
            outboundSMSTextMessage: { message: body },
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      return r.ok ? { status: 'ENVOYE' } : { status: 'ECHEC', error: `Orange ${r.status}` };
    }
    if (provider === 'AFRICASTALKING') {
      const params = new URLSearchParams({ username: env.AT_USERNAME!, to: dest, message: body });
      if (env.AT_SENDER_ID) params.set('from', env.AT_SENDER_ID);
      const r = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: { apiKey: env.AT_API_KEY!, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
      });
      return r.ok ? { status: 'ENVOYE' } : { status: 'ECHEC', error: `Africa's Talking ${r.status}` };
    }
    return { status: 'SIMULE' };
  } catch (e) {
    return { status: 'ECHEC', error: (e as Error).message.slice(0, 120) };
  }
}

/** Envoie une série de SMS (5 en parallèle au maximum). */
export async function sendSmsBatch(items: { phone: string; body: string }[]): Promise<SmsResult[]> {
  const { provider } = smsConfig();
  const results: SmsResult[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await sendOne(provider, items[idx].phone, items[idx].body);
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, items.length) }, worker));
  return results;
}

/** Lien WhatsApp « cliquer pour envoyer » (gratuit, depuis le téléphone de l'administrateur). */
export function whatsappLink(phone: string, body: string): string {
  return `https://wa.me/${phoneIntl(phone).replace('+', '')}?text=${encodeURIComponent(body)}`;
}
