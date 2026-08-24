import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SPREADSHEET_ID = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID')!;
const SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

interface TransactionBody {
  user_id: string;
  type: 'expense' | 'money_saving';
  merchant: string;
  total: number;
  category: string;
  transaction_date: string;
  payment_method?: string;
  notes?: string;
  source_name?: string;
  file_url?: string;
}

interface BulkRequestBody {
  transactions: TransactionBody[];
}

// ── Google Sheets service account JWT auth (duplicated from create-transaction) ──

async function getGoogleAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const pemKey = serviceAccount.private_key as string;
  const pemBody = pemKey
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${signingInput}.${signatureB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

function sheetTabFor(body: TransactionBody): string {
  if (body.type === 'expense') return 'Expense';
  if (body.category?.toLowerCase() === 'wedding') return 'Wedding_Savings';
  return 'Money_Saving';
}

async function appendRowToSheets(accessToken: string, body: TransactionBody): Promise<void> {
  const sheetTab = sheetTabFor(body);
  const range = `${sheetTab}!A:G`;
  const row = [
    body.transaction_date,
    body.user_id,
    body.category,
    body.merchant,
    body.payment_method ?? '',
    body.notes ?? '',
    body.total,
  ];

  const sheetsRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (!sheetsRes.ok) {
    const err = await sheetsRes.text();
    console.error(`Google Sheets append failed (non-fatal): ${err}`);
  }
}

// ── Telegram summary notification ─────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}

async function sendBulkTelegramSummary(rows: TransactionBody[]): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  if (rows.length === 0) return;

  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const lines = [
    `<b>🤖 ${rows.length} Transaksi via AI Prompt</b>`,
    `💵 Total: Rp ${formatRupiah(total)}`,
    ...rows.map((r) => `• ${escapeHtml(r.merchant)} — Rp ${formatRupiah(r.total)} (${r.type === 'expense' ? '💸' : '💰'})`),
  ];

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: lines.join('\n'),
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram bulk notification failed (non-fatal): ${err}`);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const body: BulkRequestBody = await req.json();

    if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'transactions harus array dan tidak boleh kosong' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    for (const t of body.transactions) {
      if (!t.user_id || !t.type || !t.merchant || !t.total || !t.category || !t.transaction_date) {
        return new Response(
          JSON.stringify({ error: 'Setiap transaksi wajib punya user_id, type, merchant, total, category, transaction_date' }),
          { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const rows = body.transactions.map((t) => ({
      user_id: t.user_id,
      type: t.type,
      merchant: t.merchant,
      total: t.total,
      category: t.category,
      transaction_date: t.transaction_date,
      payment_method: t.payment_method ?? null,
      notes: t.notes ?? null,
      source_name: t.source_name ?? null,
      file_url: t.file_url ?? null,
    }));

    const { data, error } = await supabase.from('transactions').insert(rows).select();

    if (error) throw error;

    // Append each row to Google Sheets (non-fatal)
    try {
      const accessToken = await getGoogleAccessToken();
      for (const t of body.transactions) {
        await appendRowToSheets(accessToken, t);
      }
    } catch (sheetsErr) {
      console.error('Google Sheets bulk write failed (non-fatal):', sheetsErr);
    }

    // One summary Telegram notification for the whole batch (non-fatal)
    try {
      await sendBulkTelegramSummary(body.transactions);
    } catch (telegramErr) {
      console.error('Telegram bulk notification failed (non-fatal):', telegramErr);
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});
