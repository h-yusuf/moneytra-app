import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTransactionRecord, formatRupiah, type TransactionRecordInput } from '../_shared/createTransactionRecord.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const SPREADSHEET_ID = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID')!;
const SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

type IntervalUnit = 'week' | 'month' | 'year';

interface RecurringItemRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  interval_unit: IntervalUnit;
  interval_value: number;
  next_due_date: string;
  auto_record: boolean;
  alert_offsets: number[];
  daily_within_days: number | null;
  last_alert_sent_at: string | null;
}

// ── Date helpers (WIB, date-only) ─────────────────────────────────────────────

function todayWIB(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utcMs + 7 * 3600000);
  return wib.toISOString().split('T')[0];
}

function daysBetween(fromYMD: string, toYMD: string): number {
  const a = new Date(`${fromYMD}T00:00:00Z`);
  const b = new Date(`${toYMD}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addIntervalClamped(dateYMD: string, unit: IntervalUnit, value: number): string {
  const [y, m, d] = dateYMD.split('-').map(Number);

  if (unit === 'week') {
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + value * 7);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const months = unit === 'year' ? value * 12 : value;
  const target = new Date(y, m - 1 + months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, daysInTargetMonth));
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function shouldAlert(daysUntilDue: number, item: RecurringItemRow, today: string): boolean {
  if (item.last_alert_sent_at === today) return false;
  if (item.daily_within_days != null && daysUntilDue <= item.daily_within_days) return true;
  return item.alert_offsets.includes(daysUntilDue);
}

// ── Notification delivery (non-fatal) ─────────────────────────────────────────

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) console.error('Telegram send failed (non-fatal):', await res.text());
  } catch (err) {
    console.error('Telegram send failed (non-fatal):', err);
  }
}

async function sendExpoPush(
  supabase: ReturnType<typeof createClient>,
  title: string,
  body: string
): Promise<void> {
  try {
    const { data: tokens, error } = await supabase.from('push_tokens').select('token');
    if (error || !tokens?.length) return;
    const messages = (tokens as { token: string }[]).map(t => ({
      to: t.token,
      title,
      body,
      sound: 'default',
    }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) console.error('Expo push send failed (non-fatal):', await res.text());
  } catch (err) {
    console.error('Expo push send failed (non-fatal):', err);
  }
}

function formatDateID(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (CRON_SECRET) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today = todayWIB();

  const { data: items, error } = await supabase
    .from('recurring_items')
    .select('*')
    .eq('is_active', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = (items ?? []) as RecurringItemRow[];
  let processed = 0;

  for (const item of rows) {
    const daysUntilDue = daysBetween(today, item.next_due_date);

    if (item.auto_record && daysUntilDue <= 0) {
      try {
        const txInput: TransactionRecordInput = {
          user_id: item.user_id,
          type: 'expense',
          merchant: item.name,
          total: item.amount,
          category: item.category,
          transaction_date: today,
          notes: `Auto-recorded from recurring: ${item.name}`,
          source_name: 'recurring-auto',
        };
        await createTransactionRecord(supabase, txInput, {
          spreadsheetId: SPREADSHEET_ID,
          serviceAccountJson: SERVICE_ACCOUNT_JSON,
        });

        const nextDueDate = addIntervalClamped(item.next_due_date, item.interval_unit, item.interval_value);
        await supabase
          .from('recurring_items')
          .update({ next_due_date: nextDueDate, last_alert_sent_at: null })
          .eq('id', item.id);

        const text = `✅ Auto-recorded: ${item.name} Rp${formatRupiah(item.amount)}`;
        await sendTelegram(text);
        await sendExpoPush(supabase, 'Auto-recorded', text);
      } catch (err) {
        console.error(`Auto-record failed for ${item.name} (non-fatal):`, err);
        await sendTelegram(`❌ Gagal auto-record ${item.name} — cek app`);
      }
      processed++;
      continue;
    }

    if (shouldAlert(daysUntilDue, item, today)) {
      const text = daysUntilDue < 0
        ? `⚠️ ${item.name} OVERDUE ${Math.abs(daysUntilDue)} hari! Rp${formatRupiah(item.amount)}`
        : daysUntilDue === 0
          ? `🔔 ${item.name} jatuh tempo HARI INI — Rp${formatRupiah(item.amount)}, ${item.category}`
          : `🔔 ${item.name} jatuh tempo ${daysUntilDue} hari lagi (${formatDateID(item.next_due_date)}) — Rp${formatRupiah(item.amount)}, ${item.category}`;

      await sendTelegram(text);
      await sendExpoPush(supabase, 'Reminder', text);
      await supabase
        .from('recurring_items')
        .update({ last_alert_sent_at: today })
        .eq('id', item.id);
      processed++;
    }
  }

  return new Response(JSON.stringify({ success: true, processed, total: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
