import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface TransactionRecordInput {
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

export interface SheetsEnv {
  spreadsheetId: string;
  serviceAccountJson: string;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Google Sheets service account JWT auth ───────────────────────────────────

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
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

// ── Google Sheets append ─────────────────────────────────────────────────────

function resolveSheetTab(body: TransactionRecordInput): string {
  if (body.type === 'expense') return 'Expense';
  if (body.category?.toLowerCase() === 'wedding') return 'Wedding_Savings';
  return 'Money_Saving';
}

async function appendToSheets(
  accessToken: string,
  spreadsheetId: string,
  body: TransactionRecordInput,
  sheetTab: string
): Promise<void> {
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
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
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
    // Non-fatal: Sheets failure should not block the save
    console.error(`Google Sheets append failed (non-fatal): ${err}`);
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function createTransactionRecord(
  supabase: ReturnType<typeof createClient>,
  body: TransactionRecordInput,
  sheetsEnv: SheetsEnv
) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: body.user_id,
      type: body.type,
      merchant: body.merchant,
      total: body.total,
      category: body.category,
      transaction_date: body.transaction_date,
      payment_method: body.payment_method ?? null,
      notes: body.notes ?? null,
      source_name: body.source_name ?? null,
      file_url: body.file_url ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  try {
    const accessToken = await getGoogleAccessToken(sheetsEnv.serviceAccountJson);
    const sheetTab = resolveSheetTab(body);
    await appendToSheets(accessToken, sheetsEnv.spreadsheetId, body, sheetTab);
  } catch (sheetsErr) {
    console.error('Google Sheets write failed (non-fatal):', sheetsErr);
  }

  return data;
}
