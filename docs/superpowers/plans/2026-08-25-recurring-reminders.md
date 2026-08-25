# Recurring Items & Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track bills and recurring costs (vehicle tax, periodic service, subscriptions) with a per-item configurable alert schedule (day-offset checklist + daily-escalation window), delivered via the existing Telegram bot and Expo push infra, with optional auto-recording as a transaction when due.

**Architecture:** One new table (`recurring_items`), one new Edge Function (`check-reminders`) invoked daily by `pg_cron`/`pg_net`, a shared Deno helper extracted from `create-transaction` for the insert+Sheets dual-write, a new client service layer, and a Settings card linking to a new full-screen `/reminders` route (not a bottom tab — the tab bar is already at 5 items).

**Tech Stack:** React Native + Expo (TypeScript), Supabase (Postgres, Edge Functions on Deno, `pg_cron`/`pg_net`), existing Telegram Bot API integration, existing Expo push token infra (`push_tokens` table).

**Spec:** `docs/superpowers/specs/2026-08-25-recurring-reminders-design.md`

> **Amendment (2026-08-25, during implementation):** `interval_months` (int) was
> replaced with `interval_unit` (`'week' | 'month' | 'year'`) + `interval_value`
> (int) across the table, types, `check-reminders`, `recurringItemsService`, and
> the add/edit form — a months-only interval couldn't represent a 5-year vehicle
> registration renewal or a weekly cadence. Every code block below that still
> shows `interval_months` reflects the pre-amendment design; the actual deployed
> code uses `interval_unit`/`interval_value` with an `addIntervalClamped(date,
> unit, value)` helper (week → `+value*7` days; month/year → `+value` or
> `+value*12` months, clamped to end-of-month). Deployed to the **staging**
> Supabase project (`xslstofngselbphqctfl`, "Monetra") — the CLI's default
> linked project (`hzhnvlaudcjntkiqctrs`, "monetra-app-v.2") is prod and was
> deliberately not touched beyond an initial accidental deploy that was cleaned
> up (table dropped, function deleted, secret unset).

## Global Constraints

- No automated test suite exists in this repo — every task's "test" step is a manual verification (curl, `npx tsc --noEmit`, SQL query, or in-app check), not a unit test file.
- Reuse existing secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`. Exactly one new secret is added: `CRON_SECRET` (a random string), used to authenticate the `pg_cron` → `check-reminders` call so the endpoint isn't publicly invokable.
- This app has no Supabase Auth / RLS-scoped users — `transactions` is read/written directly with the anon/service key by a single shared household. `recurring_items` follows the same posture (no RLS restrictions beyond what already exists on `transactions`).
- Follow existing code style: inline `style={{...}}` objects (not NativeWind `className`) in `app/` screens and `src/components/common/`, matching every existing screen.
- Follow the existing large-screen-file convention (`add.tsx`, `settings.tsx` keep their modals inline rather than extracted into separate component files) — `app/reminders.tsx` keeps its add/edit form and detail sheet inline as local `Modal`s, not extracted components.
- Dates are plain `YYYY-MM-DD` strings throughout (no time component), matching `transaction_date` elsewhere in the app.

---

### Task 1: Database — `recurring_items` table

> Manual step in Supabase Dashboard SQL Editor.

**Files:** None (run in Supabase Dashboard)

**Interfaces:**
- Produces: table `public.recurring_items`, columns as below. Consumed by Tasks 4, 6.

- [ ] **Step 1: Run the migration**

```sql
create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  category text not null,
  amount numeric not null,
  interval_months integer not null check (interval_months > 0),
  next_due_date date not null,
  auto_record boolean not null default false,
  alert_offsets integer[] not null default '{}',
  daily_within_days integer,
  is_active boolean not null default true,
  last_alert_sent_at date,
  created_at timestamptz not null default now()
);

create index if not exists recurring_items_active_due_idx
  on public.recurring_items (next_due_date)
  where is_active = true;
```

- [ ] **Step 2: Verify**

Run in SQL Editor:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'recurring_items'
order by ordinal_position;
-- Should list 12 columns: id, user_id, name, category, amount,
-- interval_months, next_due_date, auto_record, alert_offsets,
-- daily_within_days, is_active, last_alert_sent_at, created_at (13 rows)

select * from public.recurring_items;
-- Should return 0 rows, no error
```

- [ ] **Step 3: Note completion**

No git commit for this task (dashboard-only change). Proceed to Task 2.

---

### Task 2: `RecurringItem` types

**Files:**
- Modify: `src/types/index.ts` (append after `ParseTransactionsPromptResponse`, at EOF)

**Interfaces:**
- Produces: `RecurringItem`, `CreateRecurringItemParams` types, consumed by Tasks 6, 8.

- [ ] **Step 1: Append the new types**

Add at the end of `src/types/index.ts`:

```ts

export interface RecurringItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  interval_months: number;
  next_due_date: string; // YYYY-MM-DD
  auto_record: boolean;
  alert_offsets: number[];
  daily_within_days: number | null;
  is_active: boolean;
  last_alert_sent_at: string | null;
  created_at: string;
}

export interface CreateRecurringItemParams {
  user_id: string;
  name: string;
  category: string;
  amount: number;
  interval_months: number;
  next_due_date: string;
  auto_record: boolean;
  alert_offsets: number[];
  daily_within_days: number | null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "src/types/index.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add RecurringItem types"
```

---

### Task 3: Shared Deno helper — extract transaction insert + Sheets dual-write

**Files:**
- Create: `supabase/functions/_shared/createTransactionRecord.ts`
- Modify: `supabase/functions/create-transaction/index.ts` (rewrite, same external behavior)

**Interfaces:**
- Produces: `createTransactionRecord(supabase, body, sheetsEnv)`, `formatRupiah(amount)`, `escapeHtml(text)`, `TransactionRecordInput` type — consumed by Task 4 (`check-reminders`) and by the rewritten `create-transaction`.
- Consumes: nothing new — same env vars `create-transaction` already reads (`GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`), now passed as parameters instead of module-level constants so the helper has no implicit env dependency.

This is a pure refactor: `create-transaction`'s HTTP contract, response shape, and Sheets/Telegram side effects are unchanged. It's done now because Task 4 needs the same insert+Sheets logic for auto-recorded transactions, and duplicating ~80 lines of Google JWT signing code would be a maintenance hazard (a bug fixed in one copy and not the other).

- [ ] **Step 1: Create the shared helper**

Create `supabase/functions/_shared/createTransactionRecord.ts`:

```ts
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
```

- [ ] **Step 2: Rewrite `create-transaction` to use the shared helper**

Replace the full contents of `supabase/functions/create-transaction/index.ts` with:

```ts
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
```

- [ ] **Step 3: Deploy and verify unchanged behavior**

Run: `supabase functions deploy create-transaction`

Then from the app (or curl), save one manual transaction and confirm:
- Response shape unchanged (transaction row JSON).
- Row appears in the correct Google Sheets tab.
- Telegram message received in the existing format ("💸 Expense Baru" / "💰 Money Saving Baru").

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/createTransactionRecord.ts supabase/functions/create-transaction/index.ts
git commit -m "refactor: extract transaction insert + Sheets dual-write into shared helper"
```

---

### Task 4: `check-reminders` Edge Function

**Files:**
- Create: `supabase/functions/check-reminders/index.ts`

**Interfaces:**
- Consumes: `createTransactionRecord`, `formatRupiah` from `../_shared/createTransactionRecord.ts` (Task 3); `recurring_items` table (Task 1); `push_tokens` table (existing).
- Produces: `POST {SUPABASE_URL}/functions/v1/check-reminders` (no body needed), invoked by `pg_cron` (Task 5). Returns `{ success: true, processed: number, total: number }`.

- [ ] **Step 1: Write the function**

Create `supabase/functions/check-reminders/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTransactionRecord, formatRupiah, type TransactionRecordInput } from '../_shared/createTransactionRecord.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const SPREADSHEET_ID = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID')!;
const SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

interface RecurringItemRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  interval_months: number;
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

function addMonthsClamped(dateYMD: string, months: number): string {
  const [y, m, d] = dateYMD.split('-').map(Number);
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

        const nextDueDate = addMonthsClamped(item.next_due_date, item.interval_months);
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
```

- [ ] **Step 2: Set the new secret and deploy**

```bash
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
supabase functions deploy check-reminders --no-verify-jwt
```

`--no-verify-jwt` is required because `pg_net` calls the function without a Supabase user JWT — the `CRON_SECRET` header check inside the function is what authenticates the call instead.

- [ ] **Step 3: Verify manually**

Get the secret value back for testing: `supabase secrets list` (or use the value from Step 2 before it's discarded).

Insert a test row due today, then invoke the function directly:

```sql
insert into public.recurring_items
  (user_id, name, category, amount, interval_months, next_due_date, auto_record, alert_offsets, daily_within_days)
values
  ('default', 'Test Reminder', 'Lainnya', 50000, 1, current_date, false, '{0}', 7);
```

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/check-reminders' \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected: HTTP 200, `{"success":true,"processed":1,"total":1}`, a Telegram message "🔔 Test Reminder jatuh tempo HARI INI...", and `last_alert_sent_at` updated to today:

```sql
select name, last_alert_sent_at from public.recurring_items where name = 'Test Reminder';
```

Clean up the test row afterward:

```sql
delete from public.recurring_items where name = 'Test Reminder';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/check-reminders/index.ts
git commit -m "feat: add check-reminders Edge Function for due-date alerts"
```

---

### Task 5: Cron schedule

> Manual step in Supabase Dashboard SQL Editor. Depends on Task 4 being deployed.

**Files:** None (run in Supabase Dashboard)

- [ ] **Step 1: Enable extensions**

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

- [ ] **Step 2: Schedule the daily check**

Replace `<PROJECT_REF>` and `<CRON_SECRET>` (the value set in Task 4, Step 2):

```sql
select cron.schedule(
  'daily-reminder-check',
  '0 1 * * *', -- 01:00 UTC = 08:00 WIB
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Verify the schedule was created**

```sql
select jobid, schedule, jobname, active from cron.job where jobname = 'daily-reminder-check';
-- Should return 1 row, active = true
```

- [ ] **Step 4: Note completion**

No git commit for this task (dashboard-only change). Proceed to Task 6.

---

### Task 6: Client service layer

**Files:**
- Create: `src/services/recurringItemsService.ts`

**Interfaces:**
- Consumes: `supabase` client (`src/lib/supabase.ts`), `RecurringItem`/`CreateRecurringItemParams` types (Task 2).
- Produces: `fetchRecurringItems`, `createRecurringItem`, `updateRecurringItem`, `markRecurringItemPaid`, `deleteRecurringItem`, `daysUntilDue`, `getRecurringItemStatus`, `RecurringItemStatus` type — consumed by Task 7 (Settings card) and Task 8 (`app/reminders.tsx`).

- [ ] **Step 1: Write the service module**

Create `src/services/recurringItemsService.ts`:

```ts
import { supabase } from '@/src/lib/supabase';
import type { CreateRecurringItemParams, RecurringItem } from '@/src/types';

export async function fetchRecurringItems(): Promise<RecurringItem[]> {
  const { data, error } = await supabase
    .from('recurring_items')
    .select('*')
    .eq('is_active', true)
    .order('next_due_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RecurringItem[];
}

export async function createRecurringItem(params: CreateRecurringItemParams): Promise<RecurringItem> {
  const { data, error } = await supabase
    .from('recurring_items')
    .insert({ ...params, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data as RecurringItem;
}

export async function updateRecurringItem(
  id: string,
  updates: Partial<CreateRecurringItemParams>
): Promise<RecurringItem> {
  const { data, error } = await supabase
    .from('recurring_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringItem;
}

export async function deleteRecurringItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_items')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ── Date math (mirrors supabase/functions/check-reminders/index.ts —
// duplicated intentionally, no shared module exists between the Expo app
// and Deno Edge Functions in this repo) ───────────────────────────────────────

function addMonthsClamped(dateYMD: string, months: number): string {
  const [y, m, d] = dateYMD.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, daysInTargetMonth));
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function daysUntilDue(nextDueDate: string): number {
  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const a = new Date(`${todayYMD}T00:00:00`);
  const b = new Date(`${nextDueDate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type RecurringItemStatus = 'active' | 'due_soon' | 'overdue';

export function getRecurringItemStatus(item: RecurringItem): RecurringItemStatus {
  const days = daysUntilDue(item.next_due_date);
  if (days < 0) return 'overdue';
  const dueSoon =
    item.alert_offsets.includes(days) ||
    (item.daily_within_days != null && days <= item.daily_within_days);
  return dueSoon ? 'due_soon' : 'active';
}

export async function markRecurringItemPaid(item: RecurringItem): Promise<RecurringItem> {
  const nextDueDate = addMonthsClamped(item.next_due_date, item.interval_months);
  const { data, error } = await supabase
    .from('recurring_items')
    .update({ next_due_date: nextDueDate, last_alert_sent_at: null })
    .eq('id', item.id)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringItem;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "recurringItemsService"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/services/recurringItemsService.ts
git commit -m "feat: add recurringItemsService client layer"
```

---

### Task 7: Settings card + `/reminders` route registration

**Files:**
- Modify: `app/(tabs)/settings.tsx:1-22` (imports, add `useRouter`, add summary state + fetch)
- Modify: `app/(tabs)/settings.tsx:190-192` (insert new card between Profile Card and Budget Management Card)
- Modify: `app/_layout.tsx:44-47` (register `reminders` Stack screen)

**Interfaces:**
- Consumes: `fetchRecurringItems`, `getRecurringItemStatus` (Task 6).
- Produces: navigation target `/reminders`, consumed by Task 8 (the screen that must exist at that route).

- [ ] **Step 1: Add imports and summary state to `settings.tsx`**

At the top of `app/(tabs)/settings.tsx`, change:

```ts
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBudget } from '@/src/contexts/BudgetContext';
import { useNotification } from '@/src/contexts/NotificationContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchTransactions } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
```

to:

```ts
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBudget } from '@/src/contexts/BudgetContext';
import { useNotification } from '@/src/contexts/NotificationContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { formatCurrency } from '@/src/lib/utils';
import { fetchRecurringItems, getRecurringItemStatus } from '@/src/services/recurringItemsService';
import { fetchMonthlyReport, fetchTransactions } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
```

Then, inside `SettingsScreen`, right after the `useNotification()` line, add:

```ts
  const router = useRouter();
  const [recurringSummary, setRecurringSummary] = useState({ active: 0, dueSoon: 0 });

  useFocusEffect(
    useCallback(() => {
      fetchRecurringItems()
        .then(items => {
          const dueSoon = items.filter(i => getRecurringItemStatus(i) !== 'active').length;
          setRecurringSummary({ active: items.length, dueSoon });
        })
        .catch(() => setRecurringSummary({ active: 0, dueSoon: 0 }));
    }, [])
  );
```

- [ ] **Step 2: Insert the Reminders card**

Between the closing `</View>` of the Profile Card and the `{/* Budget Management Card */}` comment (currently lines 190-192), insert:

```tsx
        {/* Reminders Card */}
        <Pressable
          onPress={() => router.push('/reminders')}
          style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <IconSymbol name="bell.fill" size={20} color={colors.primary} style={{ marginRight: 12 }} />
            <View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: 'bold' }}>Reminders</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                {recurringSummary.active} aktif{recurringSummary.dueSoon > 0 ? `, ${recurringSummary.dueSoon} jatuh tempo` : ''}
              </Text>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.textTertiary} />
        </Pressable>

```

- [ ] **Step 3: Register the `/reminders` Stack screen**

In `app/_layout.tsx`, change:

```tsx
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false, presentation: 'card' }} />
```

to:

```tsx
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="reminders" options={{ headerShown: false, presentation: 'card' }} />
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "settings.tsx|_layout.tsx"`
Expected: no output referencing these files (a "Cannot find module './reminders'" type error is expected and fine until Task 8 creates the file — if `tsc` reports that specific error, it's not a regression, skip it; any other error in these two files must be fixed before proceeding).

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/settings.tsx" app/_layout.tsx
git commit -m "feat: add Reminders card to Settings and register /reminders route"
```

---

### Task 8: `app/reminders.tsx` — list, add/edit form, detail sheet

**Files:**
- Create: `app/reminders.tsx`

**Interfaces:**
- Consumes: `fetchRecurringItems`, `createRecurringItem`, `updateRecurringItem`, `deleteRecurringItem`, `markRecurringItemPaid`, `daysUntilDue`, `getRecurringItemStatus`, `RecurringItemStatus` (Task 6); `RecurringItem`, `CreateRecurringItemParams` (Task 2); `AutocompleteInput`, `DateField` (existing); `useCategoryMerchantSuggestions` (existing); `useUser` (existing).
- Produces: the `/reminders` screen navigated to from Task 7's Settings card.

- [ ] **Step 1: Write the screen**

Create `app/reminders.tsx`:

```tsx
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AutocompleteInput } from '@/src/components/common/AutocompleteInput';
import { DateField } from '@/src/components/common/DateField';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { useCategoryMerchantSuggestions } from '@/src/hooks/useCategoryMerchantSuggestions';
import { formatCurrency } from '@/src/lib/utils';
import {
  createRecurringItem,
  daysUntilDue,
  deleteRecurringItem,
  fetchRecurringItems,
  getRecurringItemStatus,
  markRecurringItemPaid,
  updateRecurringItem,
  type RecurringItemStatus,
} from '@/src/services/recurringItemsService';
import type { RecurringItem } from '@/src/types';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const INTERVAL_PRESETS: { label: string; months: number }[] = [
  { label: '1 bulan', months: 1 },
  { label: '3 bulan', months: 3 },
  { label: '6 bulan', months: 6 },
  { label: '1 tahun', months: 12 },
];
const OFFSET_CHOICES = [30, 14, 7, 3, 1, 0];

const STATUS_META: Record<RecurringItemStatus, { emoji: string; label: string; color: (c: any) => string }> = {
  active: { emoji: '🟢', label: 'Aktif', color: c => c.success },
  due_soon: { emoji: '🟡', label: 'Due Soon', color: () => '#f59e0b' },
  overdue: { emoji: '🔴', label: 'Overdue', color: c => c.error },
};

type FormState = {
  name: string;
  category: string;
  amount: string;
  next_due_date: string;
  interval_months: number;
  auto_record: boolean;
  alert_offsets: number[];
  daily_within_days: number | null;
};

function defaultFormState(): FormState {
  const today = new Date().toISOString().split('T')[0];
  return {
    name: '',
    category: '',
    amount: '',
    next_due_date: today,
    interval_months: 1,
    auto_record: false,
    alert_offsets: [7],
    daily_within_days: 3,
  };
}

function applyIntervalPreset(interval_months: number): { alert_offsets: number[]; daily_within_days: number } {
  return interval_months >= 6
    ? { alert_offsets: [30], daily_within_days: 7 }
    : { alert_offsets: [7], daily_within_days: 3 };
}

export default function RemindersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useUser();
  const { categories: categorySuggestions } = useCategoryMerchantSuggestions();

  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState());
  const [isSaving, setIsSaving] = useState(false);

  const [selectedItem, setSelectedItem] = useState<RecurringItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchRecurringItems();
      setItems(data);
      setError(null);
    } catch (err) {
      console.error('[reminders] Failed to load:', err);
      setError('Gagal memuat reminders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreateForm = () => {
    setEditingId(null);
    setForm(defaultFormState());
    setShowForm(true);
  };

  const openEditForm = (item: RecurringItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      amount: String(item.amount),
      next_due_date: item.next_due_date,
      interval_months: item.interval_months,
      auto_record: item.auto_record,
      alert_offsets: item.alert_offsets,
      daily_within_days: item.daily_within_days,
    });
    setShowDetail(false);
    setShowForm(true);
  };

  const toggleOffset = (offset: number) => {
    setForm(prev => ({
      ...prev,
      alert_offsets: prev.alert_offsets.includes(offset)
        ? prev.alert_offsets.filter(o => o !== offset)
        : [...prev.alert_offsets, offset].sort((a, b) => b - a),
    }));
  };

  const selectIntervalPreset = (months: number) => {
    setForm(prev => ({ ...prev, interval_months: months, ...applyIntervalPreset(months) }));
  };

  const handleSaveForm = async () => {
    if (!profile?.user_id) {
      Alert.alert('User ID Required', 'Please set your User ID in Settings.');
      return;
    }
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || !form.category.trim() || !amount || amount <= 0 || !form.next_due_date) {
      Alert.alert('Lengkapi data', 'Nama, kategori, nominal, dan tanggal jatuh tempo wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const params = {
        user_id: profile.user_id,
        name: form.name.trim(),
        category: form.category.trim(),
        amount,
        interval_months: form.interval_months,
        next_due_date: form.next_due_date,
        auto_record: form.auto_record,
        alert_offsets: form.alert_offsets,
        daily_within_days: form.daily_within_days,
      };
      if (editingId) {
        await updateRecurringItem(editingId, params);
      } else {
        await createRecurringItem(params);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      console.error('[reminders] Save failed:', err);
      Alert.alert('Gagal menyimpan', err?.message || 'Terjadi kesalahan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async (item: RecurringItem) => {
    try {
      await markRecurringItemPaid(item);
      setShowDetail(false);
      await load();
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Terjadi kesalahan.');
    }
  };

  const handleDelete = (item: RecurringItem) => {
    Alert.alert('Hapus Reminder', `Hapus "${item.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecurringItem(item.id);
            setShowDetail(false);
            await load();
          } catch (err: any) {
            Alert.alert('Gagal', err?.message || 'Terjadi kesalahan.');
          }
        },
      },
    ]);
  };

  const handleRecordAsTransaction = (item: RecurringItem) => {
    setShowDetail(false);
    router.push({
      pathname: '/(tabs)/add',
      params: {
        prefillMerchant: item.name,
        prefillCategory: item.category,
        prefillAmount: String(item.amount),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
          <IconSymbol name="chevron.left" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: 'bold', flex: 1 }}>Reminders</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}>
        {error && !loading && (
          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, textAlign: 'center' }}>
              Belum ada reminder. Tap + untuk tambah pajak, servis, atau langganan.
            </Text>
          </View>
        ) : (
          items.map(item => {
            const status = getRecurringItemStatus(item);
            const meta = STATUS_META[status];
            const days = daysUntilDue(item.next_due_date);
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSelectedItem(item);
                  setShowDetail(true);
                }}
                style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                      {item.category} · tiap {item.interval_months === 1 ? 'bulan' : item.interval_months === 12 ? 'tahun' : `${item.interval_months} bulan`}
                    </Text>
                  </View>
                  <Text style={{ color: meta.color(colors), fontSize: 12, fontWeight: '600' }}>
                    {meta.emoji} {meta.label}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>{formatCurrency(item.amount)}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {days < 0 ? `${Math.abs(days)} hari lewat` : days === 0 ? 'Hari ini' : `${days} hari lagi`}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Pressable
        onPress={openCreateForm}
        style={{
          position: 'absolute',
          bottom: 32,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <IconSymbol name="plus" size={28} color="#0a0a0a" />
      </Pressable>

      {/* Add/Edit Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowForm(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 32, maxHeight: '85%' }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              {editingId ? 'Edit Reminder' : 'Reminder Baru'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Nama</Text>
              <TextInput
                value={form.name}
                onChangeText={t => setForm(prev => ({ ...prev, name: t }))}
                placeholder="Pajak Motor, Netflix, dll"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15, marginBottom: 12 }}
              />

              <AutocompleteInput
                label="Kategori"
                value={form.category}
                onChangeText={t => setForm(prev => ({ ...prev, category: t }))}
                suggestions={categorySuggestions}
                placeholder="Kendaraan, Tagihan, dll"
              />

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Nominal (Rp)</Text>
              <TextInput
                value={form.amount}
                onChangeText={t => setForm(prev => ({ ...prev, amount: t.replace(/[^0-9]/g, '') }))}
                keyboardType="numeric"
                placeholder="350000"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15, marginBottom: 12 }}
              />

              <DateField label="Jatuh Tempo Pertama" value={form.next_due_date} onChange={v => setForm(prev => ({ ...prev, next_due_date: v }))} />

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: '600' }}>INTERVAL</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {INTERVAL_PRESETS.map(preset => {
                  const isSelected = form.interval_months === preset.months;
                  return (
                    <Pressable
                      key={preset.months}
                      onPress={() => selectIntervalPreset(preset.months)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isSelected ? colors.primary : colors.cardSecondary }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? '#0a0a0a' : colors.textSecondary }}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Auto-record transaksi</Text>
                <Pressable
                  onPress={() => setForm(prev => ({ ...prev, auto_record: !prev.auto_record }))}
                  style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: form.auto_record ? colors.primary : colors.cardSecondary, justifyContent: 'center', paddingHorizontal: 3 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: form.auto_record ? '#0a0a0a' : colors.textTertiary, alignSelf: form.auto_record ? 'flex-end' : 'flex-start' }} />
                </Pressable>
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: '600' }}>ALERT SEBELUM JATUH TEMPO</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {OFFSET_CHOICES.map(offset => {
                  const isSelected = form.alert_offsets.includes(offset);
                  return (
                    <Pressable
                      key={offset}
                      onPress={() => toggleOffset(offset)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isSelected ? colors.primary : colors.cardSecondary }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? '#0a0a0a' : colors.textSecondary }}>
                        H-{offset}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Escalate harian (hari terakhir)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => setForm(prev => ({ ...prev, daily_within_days: prev.daily_within_days == null ? 7 : Math.max(0, prev.daily_within_days - 1) }))}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>-</Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', minWidth: 24, textAlign: 'center' }}>
                    {form.daily_within_days ?? 0}
                  </Text>
                  <Pressable
                    onPress={() => setForm(prev => ({ ...prev, daily_within_days: (prev.daily_within_days ?? 0) + 1 }))}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>+</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={handleSaveForm}
                disabled={isSaving}
                style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' }}
              >
                {isSaving ? <ActivityIndicator size="small" color="#0a0a0a" /> : (
                  <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 15 }}>Simpan</Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Detail Sheet Modal */}
      <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} onPress={() => setShowDetail(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, padding: 24 }}
          >
            {selectedItem && (
              <>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{selectedItem.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 20 }}>
                  {selectedItem.category} · {formatCurrency(selectedItem.amount)}
                </Text>

                {!selectedItem.auto_record && (
                  <Pressable
                    onPress={() => handleMarkPaid(selectedItem)}
                    style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 }}
                  >
                    <Text style={{ color: '#0a0a0a', fontWeight: '600', fontSize: 14 }}>Mark as Paid</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleRecordAsTransaction(selectedItem)}
                  style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Catat sebagai transaksi</Text>
                </Pressable>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => openEditForm(selectedItem)}
                    style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(selectedItem)}
                    style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>Hapus</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "reminders.tsx"`
Expected: no output.

- [ ] **Step 3: Manual UI check**

Run `npx expo start --web`, log in with a `user_id` in Settings, tap the new Reminders card, confirm:
- Empty state renders with no items.
- FAB opens the add form; interval preset chips update the offset checklist defaults; saving creates a row and returns to the list showing it with the correct status badge.
- Tapping a card opens the detail sheet; Edit re-opens the form pre-filled; Delete removes it from the list (soft-delete, confirm via Supabase dashboard that `is_active = false` rather than the row being gone).

- [ ] **Step 4: Commit**

```bash
git add app/reminders.tsx
git commit -m "feat: add Reminders screen (list, add/edit form, detail sheet)"
```

---

### Task 9: Prefill Add screen from the Reminders "Catat sebagai transaksi" shortcut

Task 8's `handleRecordAsTransaction` navigates to `/(tabs)/add` with
`prefillMerchant`/`prefillCategory`/`prefillAmount` params, but `add.tsx`
doesn't read route params yet — without this task the shortcut opens Add
with an empty form, silently dropping the prefill data.

**Files:**
- Modify: `app/(tabs)/add.tsx:59-89` (imports + initial state)

**Interfaces:**
- Consumes: `prefillMerchant`, `prefillCategory`, `prefillAmount` string route params (produced by Task 8's `router.push`).

- [ ] **Step 1: Read the params and prefill on mount**

In `app/(tabs)/add.tsx`, change the import line:

```ts
import { useRouter } from 'expo-router';
```

to:

```ts
import { useLocalSearchParams, useRouter } from 'expo-router';
```

Then, inside `AddScreen`, right after `const router = useRouter();`, add:

```ts
  const { prefillMerchant, prefillCategory, prefillAmount } = useLocalSearchParams<{
    prefillMerchant?: string;
    prefillCategory?: string;
    prefillAmount?: string;
  }>();
```

Two existing state declarations need their initial values changed. First,
`manualForm` (line ~80) — change:

```ts
  const [manualForm, setManualForm] = useState({
    merchant: '',
    total: '',
    category: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: '',
  });
```

to:

```ts
  const [manualForm, setManualForm] = useState({
    merchant: prefillMerchant ?? '',
    total: prefillAmount ?? '',
    category: prefillCategory ?? '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: '',
  });
```

Second, `showManualEntry` (line 75) — change:

```ts
  const [showManualEntry, setShowManualEntry] = useState(false);
```

to:

```ts
  const [showManualEntry, setShowManualEntry] = useState(!!prefillMerchant);
```

This is the only change to that declaration — the setter name
(`setShowManualEntry`) stays the same, so every existing call site
elsewhere in the file keeps working unchanged.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "(tabs)/add.tsx"`
Expected: no output.

- [ ] **Step 3: Manual verification**

From the Reminders screen (Task 8), open a reminder-only item's detail
sheet and tap "Catat sebagai transaksi" — confirm the Add screen opens
directly in Manual Entry mode with merchant/category/amount pre-filled
from the reminder item.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/add.tsx"
git commit -m "feat: prefill Add screen manual entry from Reminders shortcut"
```

---

### Task 10: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Escalating alert schedule**

In the Supabase dashboard, create a test item via the app: `interval_months=12`, due date 35 days from today, default preset (`alert_offsets=[30]`, `daily_within_days=7`). Manually invoke `check-reminders` (Task 4, Step 3 curl command) once — confirm no alert (35 days out doesn't match offset 30 or the daily window). Update `next_due_date` to 30 days from today via SQL, re-invoke — confirm one Telegram + push alert fires and `last_alert_sent_at` is set to today.

- [ ] **Step 2: Auto-record flow**

Create a test item with `auto_record=true`, `interval_months=1`, `next_due_date = current_date`. Invoke `check-reminders` — confirm:
- A row appears in `transactions` with `source_name='recurring-auto'` and the item's amount/category.
- The row appears in the correct Google Sheets tab.
- `recurring_items.next_due_date` advanced by 1 month.
- A "✅ Auto-recorded" Telegram message was received.

- [ ] **Step 3: Overdue reminder-only item**

Create a test item with `auto_record=false`, `next_due_date` 3 days in the past, `daily_within_days=7`. Invoke `check-reminders` — confirm an "⚠️ OVERDUE" alert fires. In the app, open the item's detail sheet and tap "Mark as Paid" — confirm `next_due_date` advances and `last_alert_sent_at` resets to null.

- [ ] **Step 4: Dedup guard**

Re-invoke `check-reminders` twice within the same day for any item that alerted in Step 1-3 — confirm no duplicate Telegram/push message on the second call (check `last_alert_sent_at = today` short-circuits it).

- [ ] **Step 5: Month-end clamp**

Via SQL, set a test item's `next_due_date` to `2027-01-31` with `interval_months=1`. Call `markRecurringItemPaid` from the app (or replicate the `addMonthsClamped` logic manually) — confirm the resulting date is `2027-02-28` (2027 is not a leap year), not an invalid date.

- [ ] **Step 6: Clean up test data**

```sql
delete from public.recurring_items where user_id = '<test user_id used above>' and name like 'Test%';
```

No commit for this task — verification only.
