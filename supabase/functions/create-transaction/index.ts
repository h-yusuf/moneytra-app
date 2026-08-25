import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTransactionRecord, escapeHtml, formatRupiah, type TransactionRecordInput } from '../_shared/createTransactionRecord.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SPREADSHEET_ID = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID')!;
const SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

// ── Telegram notification ─────────────────────────────────────────────────────

async function sendTelegramNotification(body: TransactionRecordInput): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const isExpense = body.type === 'expense';
  const title = isExpense ? '💸 Expense Baru' : '💰 Money Saving Baru';

  const lines = [
    `<b>${title}</b>`,
    `🏪 Merchant: ${escapeHtml(body.merchant)}`,
    `🏷️ Kategori: ${escapeHtml(body.category)}`,
    `💵 Jumlah: Rp ${formatRupiah(body.total)}`,
    `📅 Tanggal: ${escapeHtml(body.transaction_date)}`,
  ];
  if (body.payment_method) lines.push(`💳 Metode: ${escapeHtml(body.payment_method)}`);
  if (body.notes) lines.push(`📝 Catatan: ${escapeHtml(body.notes)}`);

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
    // Non-fatal: Telegram failure should not block the save
    console.error(`Telegram notification failed (non-fatal): ${err}`);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body: TransactionRecordInput = await req.json();

    if (!body.user_id || !body.type || !body.merchant || !body.total || !body.category || !body.transaction_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, type, merchant, total, category, transaction_date' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const data = await createTransactionRecord(supabase, body, {
      spreadsheetId: SPREADSHEET_ID,
      serviceAccountJson: SERVICE_ACCOUNT_JSON,
    });

    // Send Telegram notification (non-fatal)
    try {
      await sendTelegramNotification(body);
    } catch (telegramErr) {
      console.error('Telegram notification failed (non-fatal):', telegramErr);
    }

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
