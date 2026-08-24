# Catat via Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type a free-text sentence (or several) describing one or more transactions, have AI parse it into structured drafts, review/edit them, then bulk-save.

**Architecture:** Two new Supabase Edge Functions (`parse-transactions-prompt`, `bulk-create-transactions`) plus a fourth input-method card on the Add screen with a text entry component and an editable multi-item review list. Reuses the existing `ai-chat` LLM provider config and the existing OCR review UI patterns.

**Tech Stack:** React Native + Expo (TypeScript), Supabase (Postgres, Edge Functions on Deno), NativeWind/inline styles matching existing `add.tsx` conventions.

**Spec:** `docs/superpowers/specs/2026-08-24-catat-via-prompt-design.md`

## Global Constraints

- No new secrets: parsing reuses `LLM_BASE_URL`, `LLM_API_KEY`, `CHAT_MODEL` (default `'open-code'`) — the same env vars `ai-chat` already uses.
- No automated test suite exists in this repo (confirmed in `CLAUDE.md`) — every task's "test" step is a manual verification (curl, `npx tsc --noEmit`, or in-app check), not a unit test file.
- Card title in the Add screen UI must read exactly **"Catat via Prompt"**.
- `bulk-create-transactions` sends exactly ONE Telegram summary message per batch, never one per transaction.
- Every parsed/saved item from this flow gets `source_name: 'ai-prompt-entry'`.
- Follow existing code style: inline `style={{...}}` objects (not NativeWind `className`) in `add.tsx` and new common components, matching every existing component in `src/components/common/`.

---

### Task 1: `ParsedTransactionDraft` type

**Files:**
- Modify: `src/types/index.ts:106-107` (append after the `ChatResponse` interface, before EOF)

**Interfaces:**
- Produces: `ParsedTransactionDraft` type, consumed by Tasks 5, 7, 8, 9.

- [ ] **Step 1: Append the new type**

Add at the end of `src/types/index.ts` (after the closing `}` of `ChatResponse`):

```ts

export interface ParsedTransactionDraft {
  id: string;
  merchant: string | null;
  total: number | null;
  category: string | null;
  transaction_date: string | null;
  payment_method?: string | null;
  notes?: string;
  type: 'expense' | 'money_saving';
}

export interface ParseTransactionsPromptResponse {
  transactions: ParsedTransactionDraft[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "src/types/index.ts"`
Expected: no output (no errors referencing this file).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ParsedTransactionDraft type for prompt-entry flow"
```

---

### Task 2: New icon mapping for the Prompt Entry card

**Files:**
- Modify: `components/ui/icon-symbol.tsx:83-91`

**Interfaces:**
- Produces: `'text.bubble.fill'` becomes a valid `IconSymbolName`, consumed by Task 9.

- [ ] **Step 1: Add the mapping**

In `components/ui/icon-symbol.tsx`, the `MAPPING` object currently ends like this (lines 83-91):

```ts
  // AI Assistant
  'bot.fill': 'smart-toy',

  // OCR processing
  'doc.text.viewfinder': 'document-scanner',
  'eye.fill': 'visibility',
  'sparkles': 'auto-awesome',
  'checklist': 'checklist',
} as IconMapping;
```

Change it to:

```ts
  // AI Assistant
  'bot.fill': 'smart-toy',

  // OCR processing
  'doc.text.viewfinder': 'document-scanner',
  'eye.fill': 'visibility',
  'sparkles': 'auto-awesome',
  'checklist': 'checklist',

  // Prompt entry
  'text.bubble.fill': 'chat',
} as IconMapping;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "icon-symbol"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/ui/icon-symbol.tsx
git commit -m "feat: add text.bubble.fill icon mapping for prompt entry"
```

---

### Task 3: `parse-transactions-prompt` Edge Function

**Files:**
- Create: `supabase/functions/parse-transactions-prompt/index.ts`

**Interfaces:**
- Consumes: `LLM_BASE_URL`, `LLM_API_KEY`, `CHAT_MODEL` env vars (already set as Supabase secrets, used by `ai-chat`).
- Produces: `POST {SUPABASE_URL}/functions/v1/parse-transactions-prompt` accepting `{ user_id: string, prompt: string }`, returning `{ transactions: ParsedTransactionDraft[] }` (shape without the client-only `id` field — the client assigns `id` after receiving the response, see Task 5). Consumed by Task 5.

- [ ] **Step 1: Write the function**

Create `supabase/functions/parse-transactions-prompt/index.ts`:

```ts
const LLM_BASE_URL = Deno.env.get('LLM_BASE_URL')!;
const LLM_API_KEY = Deno.env.get('LLM_API_KEY')!;
const CHAT_MODEL = Deno.env.get('CHAT_MODEL') || 'open-code';

interface ParseRequestBody {
  user_id: string;
  prompt: string;
}

interface ParsedTransaction {
  merchant: string | null;
  total: number | null;
  category: string | null;
  transaction_date: string | null;
  payment_method: string | null;
  notes: string;
  type: 'expense' | 'money_saving';
}

function getWIBDate(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utcMs + 7 * 3600000);
  return wib.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' WIB (GMT+7)';
}

function buildSystemPrompt(): string {
  return `Kamu adalah parser transaksi keuangan untuk aplikasi Monetra.
Sekarang: ${getWIBDate()}. User berada di Indonesia (GMT+7). Gunakan tanggal ini untuk resolve tanggal relatif seperti "hari ini", "kemarin", "tadi pagi" — JANGAN menebak tanggal lain.

Tugas kamu: baca kalimat user yang menyebutkan satu atau lebih transaksi keuangan, dan ubah jadi array JSON, satu object per transaksi berbeda yang disebut.

Field per transaksi:
- merchant: nama toko/tempat/tujuan (string, atau null kalau gak disebut/gak jelas)
- total: nominal transaksi dalam Rupiah, angka murni tanpa pemisah ribuan. "12k"/"12rb" = 12000. Kalau gak ada nominal yang jelas -> null
- category: kategori transaksi, infer dari konteks (contoh: "Belanja Harian", "Makanan & Minuman", "Transportasi", "Kesehatan", "Hiburan", "Pakaian", "Elektronik", "Pendidikan", "Tagihan", "Transfer", "Tabungan", "Lainnya"). JANGAN pernah null — default "Lainnya"
- transaction_date: format YYYY-MM-DD, resolve dari kata relatif atau tanggal eksplisit. Kalau gak disebut sama sekali -> pakai tanggal hari ini
- payment_method: "Cash", "QRIS", "Transfer", "E-Wallet", atau null kalau gak disebut
- notes: catatan singkat tambahan (string, boleh kosong "")
- type: "money_saving" kalau kalimat menyebut nabung/menabung/tabungan/tabungan nikah, selain itu "expense". Satu prompt bisa hasilkan campuran keduanya kalau user sebut lebih dari satu transaksi dengan konteks berbeda

PENTING:
- Kalau merchant atau total gak bisa ditentukan untuk sebuah transaksi yang disebut, tetap keluarkan object-nya dengan field itu null — JANGAN dihapus/di-skip, dan JANGAN mengarang nilai.
- Setiap kalimat/klausa yang menyebut transaksi berbeda (nominal berbeda, tempat berbeda, atau tanggal berbeda) adalah transaksi TERPISAH.
- Return HANYA JSON object dengan struktur ini, tanpa markdown, tanpa penjelasan:

{"transactions": [{"merchant": "string atau null", "total": 0, "category": "string", "transaction_date": "YYYY-MM-DD", "payment_method": "string atau null", "notes": "", "type": "expense"}]}`;
}

function extractJson(raw: string): { transactions: ParsedTransaction[] } {
  let text = String(raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.transactions)) {
    throw new Error('AI response missing "transactions" array');
  }
  return parsed;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const body: ParseRequestBody = await req.json();

    if (!body.user_id || !body.prompt || !body.prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'user_id dan prompt wajib diisi' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const llmResponse = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: body.prompt },
        ],
        stream: false,
        temperature: 0.2,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => 'No response body');
      console.error('[parse-transactions-prompt] LLM error:', llmResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `LLM request failed (${llmResponse.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content ?? '{}';

    let result: { transactions: ParsedTransaction[] };
    try {
      result = extractJson(content);
    } catch (parseErr) {
      console.error('[parse-transactions-prompt] JSON parse failed:', content);
      return new Response(
        JSON.stringify({ error: 'Gagal parse hasil AI jadi JSON', raw: String(content).slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[parse-transactions-prompt] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
});
```

- [ ] **Step 2: Deploy**

Run: `supabase functions deploy parse-transactions-prompt`
Expected: `Deployed Functions on project ...: parse-transactions-prompt`

- [ ] **Step 3: Manual verification — single transaction**

Run (replace `<SUPABASE_URL>` and `<ANON_KEY>` with the values from `.env`):

```bash
curl -s -X POST "<SUPABASE_URL>/functions/v1/parse-transactions-prompt" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","prompt":"hari ini aku belanja roti 12k di pasar"}'
```

Expected: HTTP 200, JSON with `"transactions"` array of length 1, `total: 12000`, `merchant` mentioning pasar/roti, `transaction_date` equal to today's date (WIB), `type: "expense"`.

- [ ] **Step 4: Manual verification — multi-transaction, mixed dates**

```bash
curl -s -X POST "<SUPABASE_URL>/functions/v1/parse-transactions-prompt" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","prompt":"hari ini belanja 12k di pasar dan kemarin belanja 10k di indomaret"}'
```

Expected: `"transactions"` array of length 2, two different `transaction_date` values one day apart, both `type: "expense"`.

- [ ] **Step 5: Manual verification — ambiguous line**

```bash
curl -s -X POST "<SUPABASE_URL>/functions/v1/parse-transactions-prompt" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","prompt":"tadi ada transaksi tapi aku lupa nominalnya"}'
```

Expected: `"transactions"` array of length 1, `total: null` (not a made-up number).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/parse-transactions-prompt/index.ts
git commit -m "feat: add parse-transactions-prompt edge function"
```

---

### Task 4: `bulk-create-transactions` Edge Function

**Files:**
- Create: `supabase/functions/bulk-create-transactions/index.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (all already set as Supabase secrets, same ones `create-transaction` uses).
- Produces: `POST {SUPABASE_URL}/functions/v1/bulk-create-transactions` accepting `{ transactions: CreateTransactionBody[] }` (same per-item shape as `create-transaction`'s body), returning `{ data: Transaction[] }`. Consumed by Task 5.

- [ ] **Step 1: Write the function**

Create `supabase/functions/bulk-create-transactions/index.ts`. This duplicates the Google Sheets JWT auth and Telegram helpers from `supabase/functions/create-transaction/index.ts` (no shared module exists between functions in this repo — each function is self-contained, follow that pattern) but batches the insert and sends one summary Telegram message instead of one per row:

```ts
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
```

- [ ] **Step 2: Deploy**

Run: `supabase functions deploy bulk-create-transactions`
Expected: `Deployed Functions on project ...: bulk-create-transactions`

- [ ] **Step 3: Manual verification**

```bash
curl -s -X POST "<SUPABASE_URL>/functions/v1/bulk-create-transactions" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"transactions":[
    {"user_id":"test-user","type":"expense","merchant":"Pasar","total":12000,"category":"Belanja Harian","transaction_date":"2026-08-24","source_name":"ai-prompt-entry"},
    {"user_id":"test-user","type":"expense","merchant":"Indomaret","total":10000,"category":"Belanja Harian","transaction_date":"2026-08-23","source_name":"ai-prompt-entry"}
  ]}'
```

Expected: HTTP 200, `{ "data": [...] }` with 2 rows, each with a generated `id`. Confirm in the Supabase dashboard (`transactions` table) that both rows exist with `source_name: "ai-prompt-entry"`. Confirm in Google Sheets that both rows were appended to the `Expense` tab. Confirm exactly ONE Telegram message arrived (not two).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/bulk-create-transactions/index.ts
git commit -m "feat: add bulk-create-transactions edge function"
```

---

### Task 5: Client service functions

**Files:**
- Modify: `src/services/transactionService.ts:1-10` (imports — no change needed, `ParsedTransactionDraft` import added), append new functions after line 448 (EOF)
- Modify: `src/services/transactionService.ts:5` — add `ParsedTransactionDraft` to the existing type-only import from `@/src/types`

**Interfaces:**
- Consumes: `ParsedTransactionDraft`, `CreateTransactionParams`, `Transaction` types (existing); the two Edge Functions from Tasks 3 and 4.
- Produces: `parseTransactionsFromPrompt(userId: string, prompt: string): Promise<ParsedTransactionDraft[]>` and `bulkCreateTransactions(items: CreateTransactionParams[]): Promise<Transaction[]>`, consumed by Task 9.

- [ ] **Step 1: Add the type import**

In `src/services/transactionService.ts`, change the existing import block (lines 5-10):

```ts
import type {
  GetTransactionsResponse,
  MonthlyReportData,
  MonthlyReportResponse,
  Transaction,
} from '@/src/types';
```

to:

```ts
import type {
  GetTransactionsResponse,
  MonthlyReportData,
  MonthlyReportResponse,
  ParsedTransactionDraft,
  Transaction,
} from '@/src/types';
```

- [ ] **Step 2: Append `parseTransactionsFromPrompt`**

Append at the end of `src/services/transactionService.ts`:

```ts

// ─── parseTransactionsFromPrompt ─────────────────────────────────────────────

export async function parseTransactionsFromPrompt(
  userId: string,
  prompt: string
): Promise<ParsedTransactionDraft[]> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const response = await fetch(`${supabaseUrl}/functions/v1/parse-transactions-prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ user_id: userId, prompt }),
  });

  const responseText = await response.text().catch(() => 'No response body');

  if (!response.ok) {
    console.error('[parseTransactionsFromPrompt] Failed:', { status: response.status, body: responseText });
    throw new Error(`Gagal parse prompt (HTTP ${response.status}): ${responseText || 'Server error'}`);
  }

  let data: { transactions: Omit<ParsedTransactionDraft, 'id'>[] };
  try {
    data = JSON.parse(responseText);
  } catch (parseErr) {
    console.error('[parseTransactionsFromPrompt] JSON parse failed:', responseText);
    throw new Error(`Gagal parse prompt: response bukan JSON valid. Raw: ${responseText.slice(0, 200)}`);
  }

  return data.transactions.map((t, index) => ({
    ...t,
    id: `${Date.now()}-${index}`,
  }));
}

// ─── bulkCreateTransactions ───────────────────────────────────────────────────

export async function bulkCreateTransactions(
  items: CreateTransactionParams[]
): Promise<Transaction[]> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const response = await fetch(`${supabaseUrl}/functions/v1/bulk-create-transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ transactions: items }),
  });

  const responseText = await response.text().catch(() => 'No response body');

  if (!response.ok) {
    console.error('[bulkCreateTransactions] Save failed:', { status: response.status, body: responseText });
    throw new Error(`Gagal menyimpan data (HTTP ${response.status}): ${responseText || 'Server error'}`);
  }

  let data: { data: Transaction[] };
  try {
    data = JSON.parse(responseText);
  } catch (parseErr) {
    console.error('[bulkCreateTransactions] JSON parse failed:', responseText);
    throw new Error(`Gagal menyimpan data: response bukan JSON valid. Raw: ${responseText.slice(0, 200)}`);
  }

  return data.data;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "transactionService"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/services/transactionService.ts
git commit -m "feat: add parseTransactionsFromPrompt and bulkCreateTransactions client calls"
```

---

### Task 6: Generalize `OcrProcessingCard` with a `stages` prop

**Files:**
- Modify: `src/components/common/OcrProcessingCard.tsx:6-20`

**Interfaces:**
- Consumes: nothing new.
- Produces: `OcrProcessingCard` now accepts an optional `stages: { icon: IconSymbolName; message: string }[]` prop (defaults to the existing OCR stage list — fully backward compatible), consumed by Task 7.

- [ ] **Step 1: Add the `stages` prop**

In `src/components/common/OcrProcessingCard.tsx`, change lines 6-20 from:

```tsx
const STAGES: { icon: any; message: string }[] = [
  { icon: 'doc.text.viewfinder', message: 'Membaca gambar struk...' },
  { icon: 'eye.fill', message: 'Mendeteksi teks & angka...' },
  { icon: 'sparkles', message: 'AI menganalisis transaksi...' },
  { icon: 'checklist', message: 'Menyusun hasil ekstraksi...' },
];

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function OcrProcessingCard({ imageUri }: { imageUri?: string }) {
```

to:

```tsx
export type ProcessingStage = { icon: any; message: string };

const DEFAULT_OCR_STAGES: ProcessingStage[] = [
  { icon: 'doc.text.viewfinder', message: 'Membaca gambar struk...' },
  { icon: 'eye.fill', message: 'Mendeteksi teks & angka...' },
  { icon: 'sparkles', message: 'AI menganalisis transaksi...' },
  { icon: 'checklist', message: 'Menyusun hasil ekstraksi...' },
];

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function OcrProcessingCard({
  imageUri,
  stages = DEFAULT_OCR_STAGES,
}: {
  imageUri?: string;
  stages?: ProcessingStage[];
}) {
```

- [ ] **Step 2: Update references to `STAGES` inside the component**

Still in the same file, the `useEffect` stage-cycling timer and the `stage` memo currently reference the module-level `STAGES` constant. Update them to use the `stages` prop instead:

Find:
```tsx
      setStageIndex((i) => (i + 1) % STAGES.length);
```
Replace with:
```tsx
      setStageIndex((i) => (i + 1) % stages.length);
```

Find:
```tsx
  const stage = useMemo(() => STAGES[stageIndex], [stageIndex]);
```
Replace with:
```tsx
  const stage = useMemo(() => stages[stageIndex], [stageIndex, stages]);
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "OcrProcessingCard"`
Expected: no output.

- [ ] **Step 4: Verify the existing OCR flow still works**

Run `npx expo start`, open the Add screen, use Take Photo or Upload from Gallery, tap Extract Data. Expected: the scan-line/rotating-stage card still renders exactly as before (default stages), since `stages` defaults to `DEFAULT_OCR_STAGES` when the caller in `add.tsx` doesn't pass it.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/OcrProcessingCard.tsx
git commit -m "refactor: generalize OcrProcessingCard with a stages prop"
```

---

### Task 7: `PromptEntryCard` component

**Files:**
- Create: `src/components/common/PromptEntryCard.tsx`

**Interfaces:**
- Consumes: `OcrProcessingCard` (Task 6), `useTheme()` (existing), `IconSymbol` (existing).
- Produces: `PromptEntryCard` component with props `{ onParse: (prompt: string) => Promise<void>; isParsing: boolean }`, consumed by Task 9.

- [ ] **Step 1: Write the component**

Create `src/components/common/PromptEntryCard.tsx`:

```tsx
import { useTheme } from '@/src/contexts/ThemeContext';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { OcrProcessingCard } from './OcrProcessingCard';

const PROMPT_STAGES = [
  { icon: 'doc.text.viewfinder' as const, message: 'Membaca kalimat...' },
  { icon: 'sparkles' as const, message: 'Memisah transaksi...' },
  { icon: 'checklist' as const, message: 'Menyusun data...' },
];

export function PromptEntryCard({
  onParse,
  isParsing,
}: {
  onParse: (prompt: string) => Promise<void>;
  isParsing: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  if (isParsing) {
    return <OcrProcessingCard stages={PROMPT_STAGES} />;
  }

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
        placeholder={'Contoh: "hari ini aku belanja roti 12k di pasar" atau "hari ini belanja 12k dan kemarin belanja 10k di indomaret"'}
        placeholderTextColor={colors.textTertiary}
        style={{
          backgroundColor: colors.cardSecondary,
          borderRadius: 12,
          padding: 12,
          color: colors.text,
          fontSize: 15,
          minHeight: 100,
          marginBottom: 12,
        }}
      />
      <Pressable
        onPress={() => onParse(text)}
        disabled={!text.trim()}
        style={{
          backgroundColor: text.trim() ? colors.primary : colors.cardSecondary,
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: text.trim() ? '#0a0a0a' : colors.textTertiary, fontWeight: 'bold', fontSize: 14 }}>
          Parse dengan AI
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "PromptEntryCard"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/PromptEntryCard.tsx
git commit -m "feat: add PromptEntryCard component"
```

---

### Task 8: `ParsedTransactionReviewList` component

**Files:**
- Create: `src/components/common/ParsedTransactionReviewList.tsx`

**Interfaces:**
- Consumes: `ParsedTransactionDraft` (Task 1), `AutocompleteInput`, `DateField`, `IconSymbol`, `FieldSuggestion` (all existing).
- Produces: `ParsedTransactionReviewList` component with props `{ drafts, categorySuggestions, merchantSuggestions, onChange, onRemove, onSaveAll, isSaving }`, and an exported helper `draftHasError(draft): boolean`, both consumed by Task 9.

- [ ] **Step 1: Write the component**

Create `src/components/common/ParsedTransactionReviewList.tsx`:

```tsx
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { FieldSuggestion } from '@/src/services/transactionService';
import type { ParsedTransactionDraft } from '@/src/types';
import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AutocompleteInput } from './AutocompleteInput';
import { DateField } from './DateField';

export function draftHasError(draft: ParsedTransactionDraft): boolean {
  return (
    !draft.merchant?.trim() ||
    draft.total === null ||
    draft.total <= 0 ||
    !draft.category?.trim() ||
    !draft.transaction_date?.trim()
  );
}

export function ParsedTransactionReviewList({
  drafts,
  categorySuggestions,
  merchantSuggestions,
  onChange,
  onRemove,
  onSaveAll,
  isSaving,
}: {
  drafts: ParsedTransactionDraft[];
  categorySuggestions: FieldSuggestion[];
  merchantSuggestions: FieldSuggestion[];
  onChange: (id: string, patch: Partial<ParsedTransactionDraft>) => void;
  onRemove: (id: string) => void;
  onSaveAll: () => void;
  isSaving: boolean;
}) {
  const { colors } = useTheme();
  const errorCount = drafts.filter(draftHasError).length;

  return (
    <View style={{ gap: 12 }}>
      {drafts.map((draft) => {
        const hasError = draftHasError(draft);
        return (
          <View
            key={draft.id}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: hasError ? 1 : 0,
              borderColor: colors.error,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              {hasError ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: 11, fontWeight: '600', marginLeft: 6 }}>Lengkapi data</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <IconSymbol name="checkmark.circle.fill" size={12} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 11, fontWeight: '600', marginLeft: 6 }}>Siap disimpan</Text>
                </View>
              )}
              <Pressable onPress={() => onRemove(draft.id)} hitSlop={8}>
                <IconSymbol name="trash.fill" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['expense', 'money_saving'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => onChange(draft.id, { type: t })}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: draft.type === t ? colors.primary : colors.cardSecondary,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: draft.type === t ? '#0a0a0a' : colors.textSecondary }}>
                    {t === 'expense' ? 'Expense' : 'Money Saving'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <AutocompleteInput
              label="Merchant"
              value={draft.merchant ?? ''}
              onChangeText={(text) => onChange(draft.id, { merchant: text || null })}
              suggestions={merchantSuggestions}
            />
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Amount (Rp)</Text>
              <TextInput
                value={draft.total !== null ? String(draft.total) : ''}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '');
                  onChange(draft.id, { total: digits ? parseInt(digits, 10) : null });
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }}
              />
            </View>
            <AutocompleteInput
              label="Category"
              value={draft.category ?? ''}
              onChangeText={(text) => onChange(draft.id, { category: text || null })}
              suggestions={categorySuggestions}
            />
            <DateField
              label="Date"
              value={draft.transaction_date ?? ''}
              onChange={(text) => onChange(draft.id, { transaction_date: text || null })}
            />
          </View>
        );
      })}

      <Pressable
        onPress={onSaveAll}
        disabled={isSaving || errorCount > 0 || drafts.length === 0}
        style={{
          backgroundColor: errorCount > 0 || drafts.length === 0 ? colors.cardSecondary : colors.primary,
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
        {isSaving ? (
          <>
            <ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} />
            <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Menyimpan...</Text>
          </>
        ) : (
          <Text style={{ color: errorCount > 0 || drafts.length === 0 ? colors.textTertiary : '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>
            {errorCount > 0 ? `Lengkapi ${errorCount} item dulu` : `Save All (${drafts.length})`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "ParsedTransactionReviewList"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/ParsedTransactionReviewList.tsx
git commit -m "feat: add ParsedTransactionReviewList component"
```

---

### Task 9: Wire "Catat via Prompt" into the Add screen

**Files:**
- Modify: `app/(tabs)/add.tsx` (imports, state, a new handler block, the INPUT METHOD section, a new render block, success-modal reuse)

**Interfaces:**
- Consumes: `PromptEntryCard` (Task 7), `ParsedTransactionReviewList` + `draftHasError` (Task 8), `parseTransactionsFromPrompt` + `bulkCreateTransactions` (Task 5), `ParsedTransactionDraft` (Task 1), `'text.bubble.fill'` icon (Task 2).
- Produces: the complete user-facing feature.

- [ ] **Step 1: Add imports**

In `app/(tabs)/add.tsx`, change the import block (currently lines 1-17):

```tsx
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AutocompleteInput } from '@/src/components/common/AutocompleteInput';
import { DateField } from '@/src/components/common/DateField';
import { OcrProcessingCard } from '@/src/components/common/OcrProcessingCard';
import { useBudget } from '@/src/contexts/BudgetContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { useCategoryMerchantSuggestions } from '@/src/hooks/useCategoryMerchantSuggestions';
import { createTransaction, extractTransaction, uploadReceiptImage, type ExtractedTransactionData } from '@/src/services/transactionService';
import { normalizeKey, smartTitleCase } from '@/src/utils/textFormat';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
```

to:

```tsx
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AutocompleteInput } from '@/src/components/common/AutocompleteInput';
import { DateField } from '@/src/components/common/DateField';
import { OcrProcessingCard } from '@/src/components/common/OcrProcessingCard';
import { ParsedTransactionReviewList } from '@/src/components/common/ParsedTransactionReviewList';
import { PromptEntryCard } from '@/src/components/common/PromptEntryCard';
import { useBudget } from '@/src/contexts/BudgetContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { useCategoryMerchantSuggestions } from '@/src/hooks/useCategoryMerchantSuggestions';
import {
  bulkCreateTransactions,
  createTransaction,
  extractTransaction,
  parseTransactionsFromPrompt,
  uploadReceiptImage,
  type ExtractedTransactionData,
} from '@/src/services/transactionService';
import type { ParsedTransactionDraft } from '@/src/types';
import { normalizeKey, smartTitleCase } from '@/src/utils/textFormat';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
```

- [ ] **Step 2: Add state**

Find (currently around line 47):

```tsx
  const [showManualEntry, setShowManualEntry] = useState(false);
```

Add right after it:

```tsx
  const [showPromptEntry, setShowPromptEntry] = useState(false);
  const [isParsingPrompt, setIsParsingPrompt] = useState(false);
  const [promptDrafts, setPromptDrafts] = useState<ParsedTransactionDraft[]>([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
```

- [ ] **Step 3: Make entry modes mutually exclusive**

Find `handleManualEntry` (currently lines 174-179):

```tsx
  const handleManualEntry = () => {
    setShowManualEntry((prev) => !prev);
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
  };
```

Replace with:

```tsx
  const handleManualEntry = () => {
    setShowManualEntry((prev) => !prev);
    setShowPromptEntry(false);
    setPromptDrafts([]);
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
  };

  const handlePromptEntryToggle = () => {
    setShowPromptEntry((prev) => !prev);
    setShowManualEntry(false);
    setPromptDrafts([]);
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
  };
```

- [ ] **Step 4: Add the parse/save handlers**

Find `handleSaveTransaction`/`performExtractedSave` block end (currently ends at line 355, right before `const formatFileSize`). Insert the new handlers right after that block and before `formatFileSize`:

```tsx
  const handleParsePrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    if (!profile?.user_id) {
      Alert.alert('User ID Required', 'Please set your User ID in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Settings', onPress: () => router.push('/settings') },
      ]);
      return;
    }

    setInlineAlert(null);
    setIsParsingPrompt(true);
    try {
      const drafts = await parseTransactionsFromPrompt(profile.user_id, prompt);
      setPromptDrafts(drafts);
      setIsParsingPrompt(false);
      if (drafts.length === 0) {
        setInlineAlert({ type: 'error', message: 'AI gak nemu transaksi apapun di kalimat itu. Coba tulis ulang.' });
      }
    } catch (error: any) {
      setIsParsingPrompt(false);
      console.error('[add] Prompt parse error:', error);
      setInlineAlert({ type: 'error', message: `Gagal parse: ${error?.message || 'Terjadi kesalahan. Coba lagi.'}` });
    }
  };

  const handleChangeDraft = (id: string, patch: Partial<ParsedTransactionDraft>) => {
    setPromptDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleRemoveDraft = (id: string) => {
    setPromptDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSaveAllDrafts = async () => {
    if (!profile?.user_id || promptDrafts.length === 0) return;

    setIsSavingBulk(true);
    try {
      const items = promptDrafts.map((d) => ({
        user_id: profile.user_id!,
        type: d.type,
        merchant: resolveSuggestedValue(d.merchant ?? '', merchantSuggestions),
        total: d.total ?? 0,
        category: resolveSuggestedValue(d.category ?? '', categorySuggestions),
        transaction_date: d.transaction_date ?? new Date().toISOString().split('T')[0],
        payment_method: d.payment_method || undefined,
        notes: d.notes || undefined,
        source_name: 'ai-prompt-entry',
      }));

      const saved = await bulkCreateTransactions(items);
      const totalSaved = items.reduce((sum, i) => sum + i.total, 0);

      setSelectedType(items[0].type);
      setSavedAmount(totalSaved);
      await playSuccessSound(items[0].type);

      setIsSavingBulk(false);
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        setShowPromptEntry(false);
        setPromptDrafts([]);
        setInlineAlert(null);
      }, 2500);

      console.log('[add] bulkCreateTransactions saved:', saved.length);
    } catch (error: any) {
      setIsSavingBulk(false);
      console.error('[add] Bulk save error:', error);
      setInlineAlert({ type: 'error', message: `Gagal menyimpan: ${error?.message || 'Terjadi kesalahan.'}` });
    }
  };

```

- [ ] **Step 5: Reset prompt state on pull-to-refresh and cancel**

Find `handleRefreshPage` (currently lines 163-172):

```tsx
  const handleRefreshPage = () => {
    setIsRefreshing(true);
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
    setShowManualEntry(false);
    setSelectedType('expense');
    setManualForm({ merchant: '', total: '', category: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: '', notes: '' });
    setTimeout(() => setIsRefreshing(false), 600);
  };
```

Replace with:

```tsx
  const handleRefreshPage = () => {
    setIsRefreshing(true);
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
    setShowManualEntry(false);
    setShowPromptEntry(false);
    setPromptDrafts([]);
    setSelectedType('expense');
    setManualForm({ merchant: '', total: '', category: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: '', notes: '' });
    setTimeout(() => setIsRefreshing(false), 600);
  };
```

- [ ] **Step 6: Add the fourth INPUT METHOD card**

Find the Manual Entry card closing (currently lines 439-450):

```tsx
          <Pressable onPress={handleManualEntry} style={{ backgroundColor: showManualEntry ? colors.primary : colors.card, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: showManualEntry ? 'rgba(10,10,10,0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="pencil" size={24} color={showManualEntry ? '#0a0a0a' : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: showManualEntry ? '#0a0a0a' : colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Manual Entry</Text>
                <Text style={{ color: showManualEntry ? 'rgba(10,10,10,0.6)' : colors.textTertiary, fontSize: 12 }}>{showManualEntry ? 'Tap to close form' : 'Fill in transaction details manually'}</Text>
              </View>
              <IconSymbol name={showManualEntry ? 'chevron.left' : 'chevron.right'} size={16} color={showManualEntry ? '#0a0a0a' : '#737373'} />
            </View>
          </Pressable>
        </View>
```

Replace with (adds the new card, keeps the closing `</View>`):

```tsx
          <Pressable onPress={handleManualEntry} style={{ backgroundColor: showManualEntry ? colors.primary : colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: showManualEntry ? 'rgba(10,10,10,0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="pencil" size={24} color={showManualEntry ? '#0a0a0a' : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: showManualEntry ? '#0a0a0a' : colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Manual Entry</Text>
                <Text style={{ color: showManualEntry ? 'rgba(10,10,10,0.6)' : colors.textTertiary, fontSize: 12 }}>{showManualEntry ? 'Tap to close form' : 'Fill in transaction details manually'}</Text>
              </View>
              <IconSymbol name={showManualEntry ? 'chevron.left' : 'chevron.right'} size={16} color={showManualEntry ? '#0a0a0a' : '#737373'} />
            </View>
          </Pressable>

          <Pressable onPress={handlePromptEntryToggle} style={{ backgroundColor: showPromptEntry ? colors.primary : colors.card, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: showPromptEntry ? 'rgba(10,10,10,0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="text.bubble.fill" size={24} color={showPromptEntry ? '#0a0a0a' : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: showPromptEntry ? '#0a0a0a' : colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Catat via Prompt</Text>
                <Text style={{ color: showPromptEntry ? 'rgba(10,10,10,0.6)' : colors.textTertiary, fontSize: 12 }}>{showPromptEntry ? 'Tap to close' : 'Ketik kalimat, AI catat transaksinya'}</Text>
              </View>
              <IconSymbol name={showPromptEntry ? 'chevron.left' : 'chevron.right'} size={16} color={showPromptEntry ? '#0a0a0a' : '#737373'} />
            </View>
          </Pressable>
        </View>
```

- [ ] **Step 7: Add the render block for prompt entry + review list**

Find the end of the Manual Entry Form block (currently lines 453-506, ending with `        )}` right before `{/* File Preview */}`). Insert a new block right after that `)}` and before `{/* File Preview */}`:

```tsx
        {/* Prompt Entry */}
        {showPromptEntry && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>CATAT VIA PROMPT</Text>
            {promptDrafts.length === 0 ? (
              <PromptEntryCard onParse={handleParsePrompt} isParsing={isParsingPrompt} />
            ) : (
              <ParsedTransactionReviewList
                drafts={promptDrafts}
                categorySuggestions={categorySuggestions}
                merchantSuggestions={merchantSuggestions}
                onChange={handleChangeDraft}
                onRemove={handleRemoveDraft}
                onSaveAll={handleSaveAllDrafts}
                isSaving={isSavingBulk}
              />
            )}
          </View>
        )}

```

- [ ] **Step 8: Exclude the Tips block while prompt entry is open**

Find (currently around line 600):

```tsx
        {/* Tips */}
        {!uploadedFile && !showManualEntry && (
```

Replace with:

```tsx
        {/* Tips */}
        {!uploadedFile && !showManualEntry && !showPromptEntry && (
```

- [ ] **Step 9: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "add.tsx"`
Expected: no output.

- [ ] **Step 10: Manual end-to-end verification**

Run `npx expo start`, open the Add screen:

1. Tap "Catat via Prompt". Type "hari ini aku belanja roti 12k di pasar". Tap "Parse dengan AI". Expected: the generalized processing card shows ("Membaca kalimat..." etc.), then one review card appears pre-filled (merchant/total 12000/category/today's date), badge "Siap disimpan", "Save All (1)" enabled. Tap it. Expected: success modal shows, amount matches, row appears in the transactions list (History tab) with `source_name: "ai-prompt-entry"` if inspected via Supabase dashboard.
2. Repeat with "hari ini belanja 12k dan kemarin belanja 10k di indomaret". Expected: two review cards, two different dates, "Save All (2)".
3. Repeat with "tadi ada transaksi tapi aku lupa nominalnya". Expected: one review card with badge "Lengkapi data", "Save All" button shows "Lengkapi 1 item dulu" and is disabled. Fill in the amount manually. Expected: badge switches to "Siap disimpan", button re-enables as "Save All (1)".
4. Confirm Telegram received exactly one summary message for the 2-item batch from step 2, not two.

- [ ] **Step 11: Commit**

```bash
git add "app/(tabs)/add.tsx"
git commit -m "feat: wire Catat via Prompt entry flow into Add screen"
```
