# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all n8n webhook calls with direct Supabase JS client queries and a Supabase Edge Function for OCR extraction.

**Architecture:** App talks directly to Supabase Postgres via `@supabase/supabase-js`. Edge Function `extract-receipt` handles OCR. Edge Function `create-transaction` handles save — it dual-writes to Supabase Postgres and Google Sheets (kept as realtime monitoring dashboard). Reports and push tokens go directly via Supabase JS client.

**Tech Stack:** `@supabase/supabase-js`, Supabase Edge Functions (Deno), Supabase Storage, Supabase Postgres (existing), existing React Native + Expo app.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/supabase.ts` | **Create** | Single Supabase client instance |
| `src/services/transactionService.ts` | **Rewrite** | All DB reads/writes + Edge Function call for OCR |
| `src/services/notificationService.ts` | **Partial rewrite** | `registerPushToken` → Supabase upsert |
| `app/(tabs)/add.tsx` | **Partial edit** | Update `createTransaction` callers to pass structured data |
| `.env` / `.env.example` | **Edit** | Add Supabase URL + anon key |
| `src/lib/api.ts` | **Delete** | Replaced by Supabase client |
| `supabase/functions/extract-receipt/index.ts` | **Create** | Edge Function main handler |
| `supabase/functions/extract-receipt/providers/gemini.ts` | **Create** | Gemini Vision API adapter |
| `supabase/functions/extract-receipt/providers/openai.ts` | **Create** | OpenAI GPT-4o adapter |
| `supabase/functions/extract-receipt/providers/groq.ts` | **Create** | Groq Llava adapter |
| `supabase/functions/extract-receipt/prompt.ts` | **Create** | Shared extraction prompt |
| `supabase/functions/create-transaction/index.ts` | **Create** | Edge Function: dual-write Supabase + Google Sheets |
| `supabase/config.toml` | **Create** | Supabase CLI project config |

---

## Task 1: Supabase Dashboard — SQL Migrations + Storage Bucket

> Manual step in Supabase Dashboard SQL Editor (https://supabase.com/dashboard).

**Files:** None (run in Supabase Dashboard)

- [ ] **Step 1: Open SQL Editor in Supabase Dashboard and run migration**

```sql
-- Add file_url column to existing transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS file_url text;

-- Create push_tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id    text PRIMARY KEY DEFAULT 'default',
  token      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Create Storage bucket**

Go to Supabase Dashboard → Storage → New Bucket  
Name: `receipts`  
Public: **OFF** (private)  
File size limit: 10 MB  
Allowed MIME types: `image/jpeg, image/png, image/webp, image/heic, application/pdf`

- [ ] **Step 3: Add storage policy so Edge Function can write**

In SQL Editor:

```sql
-- Allow Edge Function (service role) full access to receipts bucket
-- Anon users: no direct access (Edge Function handles uploads with service key)
CREATE POLICY "service role can manage receipts"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'receipts')
  WITH CHECK (bucket_id = 'receipts');
```

- [ ] **Step 4: Verify**

Run in SQL Editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'file_url';
-- Should return 1 row

SELECT * FROM push_tokens LIMIT 1;
-- Should return 0 rows (empty, no error)
```

- [ ] **Step 5: Note credentials**

From Supabase Dashboard → Settings → API, copy:
- `Project URL` → will go in `EXPO_PUBLIC_SUPABASE_URL`
- `anon public key` → will go in `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `service_role key` → will go in Edge Function secrets

---

## Task 2: Install Dependency + Configure .env

**Files:**
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Install Supabase JS**

```bash
npx expo install @supabase/supabase-js
```

Expected: Package added to `node_modules` and `package.json`.

- [ ] **Step 2: Update .env**

Open `.env`. Current content:
```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Add lines:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace the placeholder values with your actual credentials from Task 1 Step 5.

- [ ] **Step 3: Update .env.example**

Open `.env.example`. Replace its full contents with:

```
# Supabase (required)
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Legacy n8n API (no longer used — kept for reference)
# EXPO_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 4: Commit**

```bash
git add .env.example package.json package-lock.json
git commit -m "feat: install @supabase/supabase-js and update env template"
```

---

## Task 3: Create Supabase Client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/supabase.ts` with these exact contents:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Verify app still starts**

```bash
npx expo start --web
```

Open browser console. No errors about missing modules. Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase client"
```

---

## Task 4: Create Edge Function — Shared Prompt + Providers

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/functions/extract-receipt/prompt.ts`
- Create: `supabase/functions/extract-receipt/providers/gemini.ts`
- Create: `supabase/functions/extract-receipt/providers/openai.ts`
- Create: `supabase/functions/extract-receipt/providers/groq.ts`

- [ ] **Step 1: Create supabase/config.toml**

```bash
mkdir -p supabase/functions/extract-receipt/providers
```

Create `supabase/config.toml`:

```toml
[api]
enabled = true

[db]
# Managed by Supabase cloud — no local config needed

[functions.extract-receipt]
verify_jwt = false
```

- [ ] **Step 2: Create supabase/functions/extract-receipt/prompt.ts**

```typescript
export function buildExtractionPrompt(transactionType: string): string {
  return `You are an AI assistant that extracts transaction data from receipt/payment images.

Extract the following fields as a JSON object:
- merchant: store or merchant name (string)
- total: numeric amount only, no currency symbol (number)
- category: one of exactly [Makanan & Minuman, Transportasi, Belanja, Tagihan, Kesehatan, Hiburan, Pendidikan, Kebutuhan Harian, Lainnya]
- transaction_date: in YYYY-MM-DD format (string)
- notes: brief description of the purchase (string, optional)
- payment_method: one of exactly [QRIS, Cash, Debit, Credit, Transfer, E-Wallet, Other] (string, optional)

Return ONLY valid JSON with these fields. No explanation, no markdown, no code blocks.
Transaction type hint: ${transactionType}`;
}
```

- [ ] **Step 3: Create supabase/functions/extract-receipt/providers/gemini.ts**

```typescript
export async function callGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(text);
}
```

- [ ] **Step 4: Create supabase/functions/extract-receipt/providers/openai.ts**

```typescript
export async function callOpenAI(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(text);
}
```

- [ ] **Step 5: Create supabase/functions/extract-receipt/providers/groq.ts**

```typescript
export async function callGroq(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(text);
}
```

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add Edge Function scaffold — prompt and provider adapters"
```

---

## Task 5: Create Edge Function — Main Handler

**Files:**
- Create: `supabase/functions/extract-receipt/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildExtractionPrompt } from './prompt.ts';
import { callGemini } from './providers/gemini.ts';
import { callOpenAI } from './providers/openai.ts';
import { callGroq } from './providers/groq.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function extractWithProvider(
  imageBase64: string,
  mimeType: string,
  transactionType: string
): Promise<Record<string, unknown>> {
  const provider = Deno.env.get('PROVIDER') ?? 'gemini';
  const prompt = buildExtractionPrompt(transactionType);
  switch (provider) {
    case 'gemini': return callGemini(imageBase64, mimeType, prompt);
    case 'openai': return callOpenAI(imageBase64, mimeType, prompt);
    case 'groq':   return callGroq(imageBase64, mimeType, prompt);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

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
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('user_id') as string | null;
    const transactionType = (formData.get('transaction_type') as string) || 'expense';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const fileName = `${userId ?? 'default'}/${Date.now()}_${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    const fileUrl = urlData.publicUrl;

    // Convert to base64 for AI providers
    const uint8 = new Uint8Array(fileBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const imageBase64 = btoa(binary);
    const mimeType = file.type || 'image/jpeg';

    // Call AI extraction
    const extracted = await extractWithProvider(imageBase64, mimeType, transactionType);

    const result = {
      merchant: extracted.merchant ?? '',
      total: Number(extracted.total) || 0,
      category: extracted.category ?? 'Lainnya',
      transaction_date: extracted.transaction_date ?? new Date().toISOString().split('T')[0],
      notes: extracted.notes ?? '',
      payment_method: extracted.payment_method ?? 'Other',
      file_url: fileUrl,
    };

    return new Response(JSON.stringify(result), {
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

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/extract-receipt/index.ts
git commit -m "feat: add extract-receipt Edge Function main handler"
```

---

## Task 6: Deploy Edge Function

> Requires Supabase CLI. Run from the repo root.

- [ ] **Step 1: Install Supabase CLI (if not installed)**

```bash
npm install -g supabase
supabase --version
# Expected output: supabase X.Y.Z
```

- [ ] **Step 2: Login and link project**

```bash
supabase login
# Opens browser for auth

supabase link --project-ref YOUR_PROJECT_REF
# Project ref is the string in your Supabase URL: https://YOUR_PROJECT_REF.supabase.co
```

- [ ] **Step 3: Deploy the function**

```bash
supabase functions deploy extract-receipt
```

Expected output: `Deployed Function extract-receipt`

- [ ] **Step 4: Set secrets**

```bash
# Set AI provider and key — use whichever you have
supabase secrets set PROVIDER=gemini
supabase secrets set GEMINI_API_KEY=your_gemini_key_here

# Google Sheets dual-write (used by create-transaction Edge Function)
# GOOGLE_SHEETS_SPREADSHEET_ID = the spreadsheet ID from the Sheets URL
supabase secrets set GOOGLE_SHEETS_SPREADSHEET_ID=1bmAjvJAflklKH-Xoyitd2mK6agT6j2bnYKbO3L7GQiE
# GOOGLE_SERVICE_ACCOUNT_KEY = full JSON key downloaded from Google Cloud Console (single-line, no spaces)
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}'

# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set automatically by Supabase
```

> **How to get the Google service account key:**  
> 1. Google Cloud Console → IAM & Admin → Service Accounts → Create service account  
> 2. Grant it no Google Cloud roles (not needed)  
> 3. Create JSON key → download  
> 4. Share the target Google Sheet with the service account email (Editor permission)  
> 5. Pass the entire JSON as a single string to `supabase secrets set`

- [ ] **Step 5: Verify deployment**

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/extract-receipt \
  -F "user_id=test" \
  -F "transaction_type=expense" \
  -F "file=@/path/to/any/test/receipt.jpg"
```

Expected: JSON response with `merchant`, `total`, `category`, `transaction_date`, `file_url` fields (or error message if AI key not yet valid — that's fine for now).

---

## Task 7: Rewrite transactionService — Reads (fetchTransactions, fetchSpendingOverview)

**Files:**
- Modify: `src/services/transactionService.ts`

> Replace the entire file. We rewrite it in stages (Task 7 → 8 → 9 → 10) but commit once at the end of Task 10 when the file is complete.

- [ ] **Step 1: Replace the top of the file — imports and types**

Open `src/services/transactionService.ts`. Replace the entire file with this starting block (we'll add functions in steps):

```typescript
import { supabase } from '@/src/lib/supabase';
import type {
  GetTransactionsResponse,
  MonthlyReportData,
  MonthlyReportResponse,
  Transaction,
} from '@/src/types';

// ─── Fetch params types ──────────────────────────────────────────────────────

export interface FetchTransactionsParams {
  user_id?: string;
  type?: 'expense' | 'money_saving';
  limit?: number;
  offset?: number;
}

export interface FetchMonthlyReportParams {
  user_id?: string;
  year?: number;
  month?: number;
}

export interface FetchSpendingOverviewParams {
  year: number;
  month?: number;
}

export interface SpendingOverviewRecord {
  period: string;
  user_id: string;
  total_expense: number;
  total_income: number;
}

export interface ExtractedTransactionData {
  merchant: string;
  total: number;
  category: string;
  transaction_date: string;
  notes?: string;
  payment_method?: string;
  file_url?: string;
  confidence?: number;
}

export interface CreateTransactionParams {
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

export interface ExtractTransactionParams {
  file: File | { uri: string; type: string; name: string };
  user_id: string;
  transaction_type: 'expense' | 'money_saving';
}
```

- [ ] **Step 2: Add fetchTransactions**

Append to the same file:

```typescript
// ─── fetchTransactions ───────────────────────────────────────────────────────

export async function fetchTransactions(
  params: FetchTransactionsParams = {}
): Promise<GetTransactionsResponse> {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.user_id) query = query.eq('user_id', params.user_id);
  if (params.type) query = query.eq('type', params.type);
  if (params.limit) query = query.limit(params.limit);
  if (params.offset) query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;

  return { success: true, count: data.length, data: data as Transaction[] };
}
```

- [ ] **Step 3: Add fetchSpendingOverview (uses Supabase view)**

```typescript
// ─── fetchSpendingOverview ───────────────────────────────────────────────────

export async function fetchSpendingOverview(
  params: FetchSpendingOverviewParams
): Promise<SpendingOverviewRecord[]> {
  const yearStart = `${params.year}-01-01`;
  const yearEnd = `${params.year}-12-31`;

  let query = supabase
    .from('spending_overview')
    .select('*')
    .gte('period', yearStart)
    .lte('period', yearEnd)
    .order('period', { ascending: true });

  if (params.month) {
    const monthStr = String(params.month).padStart(2, '0');
    const periodMonth = `${params.year}-${monthStr}-01`;
    query = supabase
      .from('spending_overview')
      .select('*')
      .eq('period', periodMonth);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as SpendingOverviewRecord[];
}
```

---

## Task 8: Rewrite transactionService — fetchMonthlyReport (client-side computation)

**Files:**
- Modify: `src/services/transactionService.ts` (append)

- [ ] **Step 1: Append fetchMonthlyReport**

```typescript
// ─── fetchMonthlyReport ──────────────────────────────────────────────────────

export async function fetchMonthlyReport(
  params: FetchMonthlyReportParams
): Promise<MonthlyReportResponse> {
  const year = params.year ?? new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  let query = supabase
    .from('transactions')
    .select('*')
    .gte('transaction_date', yearStart)
    .lte('transaction_date', yearEnd);

  if (params.user_id) query = query.eq('user_id', params.user_id);
  if (params.month) {
    const monthStr = String(params.month).padStart(2, '0');
    query = query
      .gte('transaction_date', `${year}-${monthStr}-01`)
      .lte('transaction_date', `${year}-${monthStr}-31`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const transactions = (data ?? []) as Transaction[];

  // Summary totals
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.total), 0);
  const totalMoneySaving = transactions
    .filter(t => t.type === 'money_saving')
    .reduce((sum, t) => sum + Number(t.total), 0);

  // Monthly breakdown
  const monthMap = new Map<string, MonthlyReportData>();
  transactions.forEach(t => {
    const month = t.transaction_date?.slice(0, 7) ?? `${year}-01`; // YYYY-MM
    const prev = monthMap.get(month) ?? {
      month,
      expense: 0,
      money_saving: 0,
      total: 0,
      count: 0,
    };
    const amount = Number(t.total);
    monthMap.set(month, {
      month,
      expense: prev.expense + (t.type === 'expense' ? amount : 0),
      money_saving: prev.money_saving + (t.type === 'money_saving' ? amount : 0),
      total: prev.total + amount,
      count: prev.count + 1,
    });
  });
  const monthlyReport = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // Category breakdown
  const catMap = new Map<string, { total: number; count: number }>();
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const cat = t.category ?? 'Lainnya';
      const prev = catMap.get(cat) ?? { total: 0, count: 0 };
      catMap.set(cat, { total: prev.total + Number(t.total), count: prev.count + 1 });
    });
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);

  return {
    success: true,
    user_id: params.user_id ?? 'default',
    year,
    month: params.month ?? null,
    summary: {
      total_expense: totalExpense,
      total_money_saving: totalMoneySaving,
      total_transactions: transactions.length,
    },
    monthly_report: monthlyReport,
    category_breakdown: categoryBreakdown,
  };
}
```

---

## Task 9: Rewrite transactionService — extractTransaction + createTransaction

**Files:**
- Modify: `src/services/transactionService.ts` (append)

- [ ] **Step 1: Append extractTransaction (calls Edge Function)**

```typescript
// ─── extractTransaction ──────────────────────────────────────────────────────

export async function extractTransaction(
  params: ExtractTransactionParams
): Promise<ExtractedTransactionData> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

  const formData = new FormData();
  formData.append('user_id', params.user_id);
  formData.append('transaction_type', params.transaction_type);

  if (isWeb) {
    // On web: file.uri is a blob URL — fetch it and convert to File
    const response = await fetch((params.file as any).uri);
    const blob = await response.blob();
    const mimeType = (params.file as any).type || blob.type || 'image/jpeg';
    const fileName = (params.file as any).name || `upload_${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: mimeType });
    formData.append('file', file);
  } else {
    // React Native: {uri, type, name} object format
    // @ts-ignore - React Native FormData typing
    formData.append('file', {
      uri: (params.file as any).uri,
      type: (params.file as any).type || 'image/jpeg',
      name: (params.file as any).name || 'upload.jpg',
    });
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/extract-receipt`,
    {
      method: 'POST',
      headers: { apikey: supabaseAnonKey },
      body: formData,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Extraction failed: ${errText}`);
  }

  const data = await response.json();
  // Edge Function always returns a single object (not array)
  return data as ExtractedTransactionData;
}
```

- [ ] **Step 2: Append createTransaction (calls Edge Function — dual-write Supabase + Google Sheets)**

```typescript
// ─── createTransaction ───────────────────────────────────────────────────────
// Calls create-transaction Edge Function which:
//   1. Inserts row into Supabase transactions table
//   2. Appends row to Google Sheets for realtime monitoring

export async function createTransaction(
  params: CreateTransactionParams
): Promise<Transaction> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/create-transaction`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`createTransaction failed: ${errText}`);
  }

  const data = await response.json();
  return data as Transaction;
}
```

- [ ] **Step 3: Commit all transactionService changes**

```bash
git add src/services/transactionService.ts
git commit -m "feat: rewrite transactionService to use Supabase directly"
```

---

## Task 10: Create Edge Function — create-transaction (Dual-Write)

**Files:**
- Create: `supabase/functions/create-transaction/index.ts`
- Modify: `supabase/config.toml` (add function entry)

> This Edge Function receives structured transaction data, inserts it into Supabase Postgres, and simultaneously appends a row to Google Sheets. Google Sheets is retained as a realtime monitoring/report dashboard for the couple.

- [ ] **Step 1: Update supabase/config.toml — add create-transaction**

Open `supabase/config.toml` and add:

```toml
[functions.create-transaction]
verify_jwt = false
```

- [ ] **Step 2: Create supabase/functions/create-transaction/index.ts**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SPREADSHEET_ID = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID')!;
const SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!;

interface CreateTransactionBody {
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

// ── Google Sheets service account JWT auth ───────────────────────────────────

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

  // Import the RSA private key
  const pemKey = serviceAccount.private_key as string;
  const pemBody = pemKey.replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
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

  // Exchange JWT for access token
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

async function appendToSheets(
  accessToken: string,
  body: CreateTransactionBody,
  dbId: string
): Promise<void> {
  // Sheet tab: "Expense" for expense, "Wedding_Savings" for money_saving
  const sheetTab = body.type === 'expense' ? 'Expense' : 'Wedding_Savings';
  const range = `${sheetTab}!A:K`;

  const row = [
    body.user_id,
    body.type,
    body.merchant,
    body.total,
    body.category,
    body.transaction_date,
    body.payment_method ?? '',
    body.notes ?? '',
    body.source_name ?? '',
    body.file_url ?? '',
    dbId,
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
    // Non-fatal: log and continue. Sheets failure should not block save.
    console.error(`Google Sheets append failed (non-fatal): ${err}`);
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
    const body: CreateTransactionBody = await req.json();

    if (!body.user_id || !body.type || !body.merchant || !body.total || !body.category || !body.transaction_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, type, merchant, total, category, transaction_date' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Insert into Supabase
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

    // 2. Append to Google Sheets (non-fatal — runs after Supabase succeeds)
    try {
      const accessToken = await getGoogleAccessToken();
      await appendToSheets(accessToken, body, data.id);
    } catch (sheetsErr) {
      console.error('Google Sheets write failed (non-fatal):', sheetsErr);
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

> **Google Sheets column order (A–K):** user_id | type | merchant | total | category | transaction_date | payment_method | notes | source_name | file_url | db_id (UUID)  
> Make sure the target sheet tabs are named exactly `Expense` and `Wedding_Savings`. Add a header row manually if the sheet is empty.

- [ ] **Step 3: Deploy create-transaction**

```bash
supabase functions deploy create-transaction
```

Expected output: `Deployed Function create-transaction`

- [ ] **Step 4: Verify secrets are set**

```bash
supabase secrets list
# Should include: GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_KEY, PROVIDER, GEMINI_API_KEY
```

- [ ] **Step 5: Smoke test**

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-transaction \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "type": "expense",
    "merchant": "Test Merchant",
    "total": 50000,
    "category": "Lainnya",
    "transaction_date": "2026-06-05",
    "notes": "smoke test"
  }'
```

Expected: JSON object with `id` (UUID), `merchant`, `total`, and other fields. Check Supabase Dashboard → Table Editor → transactions for the row. Check Google Sheets for a new row in the `Expense` tab.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/create-transaction/ supabase/config.toml
git commit -m "feat: add create-transaction Edge Function with dual-write to Supabase + Google Sheets"
```

---

## Task 11: Update add.tsx — createTransaction Callers

> `createTransaction` now calls Edge Function `create-transaction`. The params shape is unchanged from Task 9 — structured fields. Two call sites in `add.tsx` need updating.

**Files:**
- Modify: `app/(tabs)/add.tsx`

- [ ] **Step 1: Update handleSaveManualEntry**

Find in `app/(tabs)/add.tsx` (around line 280):

```typescript
      await createTransaction({
        user_id: profile.user_id,
        type: selectedType,
        text: textData,
        source_name: 'manual-entry',
      });
```

Replace with:

```typescript
      await createTransaction({
        user_id: profile.user_id,
        type: selectedType,
        merchant: manualForm.merchant,
        total: parseFloat(manualForm.total),
        category: manualForm.category,
        transaction_date: manualForm.transaction_date,
        payment_method: manualForm.payment_method || undefined,
        notes: manualForm.notes || undefined,
        source_name: 'manual-entry',
      });
```

- [ ] **Step 2: Remove the textData variable that's no longer needed in handleSaveManualEntry**

In the same function, delete these lines (around line 271–278):

```typescript
      const textData = [
        `Merchant: ${manualForm.merchant}`,
        `Amount: Rp ${amount.toLocaleString('id-ID')}`,
        `Category: ${manualForm.category}`,
        `Date: ${manualForm.transaction_date}`,
        manualForm.payment_method ? `Payment: ${manualForm.payment_method}` : '',
        manualForm.notes ? `Notes: ${manualForm.notes}` : '',
      ].filter(Boolean).join('\n');
```

Also remove the `const amount = ...` line above it and reference `parseFloat(manualForm.total)` inline in the `createTransaction` call (already done in Step 1).

Actually keep `const amount` since it's still used in `checkBudgetAlert`. Just update the textData lines:

Delete only:

```typescript
      const textData = [
        `Merchant: ${manualForm.merchant}`,
        `Amount: Rp ${amount.toLocaleString('id-ID')}`,
        `Category: ${manualForm.category}`,
        `Date: ${manualForm.transaction_date}`,
        manualForm.payment_method ? `Payment: ${manualForm.payment_method}` : '',
        manualForm.notes ? `Notes: ${manualForm.notes}` : '',
      ].filter(Boolean).join('\n');
```

- [ ] **Step 3: Update handleSaveTransaction**

Find in `app/(tabs)/add.tsx` (around line 453):

```typescript
      // Save transaction to database
      await createTransaction({
        user_id: profile.user_id,
        type: selectedType,
        text: textData,
        source_name: uploadedFile?.name || 'manual-entry',
      });
```

Replace with:

```typescript
      // Save transaction to database
      await createTransaction({
        user_id: profile.user_id,
        type: selectedType,
        merchant: extractedData.merchant,
        total: extractedData.total,
        category: extractedData.category,
        transaction_date: extractedData.transaction_date,
        payment_method: extractedData.payment_method || undefined,
        notes: extractedData.notes || undefined,
        source_name: uploadedFile?.name || 'manual-entry',
        file_url: (extractedData as any).file_url || undefined,
      });
```

- [ ] **Step 4: Remove the textData block in handleSaveTransaction**

Find and delete these lines (around line 441–449):

```typescript
      // Format text dari extracted data
      const textData = [
        extractedData.merchant ? `Merchant: ${extractedData.merchant}` : '',
        `Amount: Rp ${extractedData.total.toLocaleString('id-ID')}`,
        `Category: ${extractedData.category}`,
        `Date: ${extractedData.transaction_date}`,
        extractedData.notes ? `Notes: ${extractedData.notes}` : '',
        extractedData.payment_method ? `Payment: ${extractedData.payment_method}` : '',
      ].filter(Boolean).join('\n');
```

- [ ] **Step 5: Run lint to verify no errors**

```bash
npx expo lint
```

Expected: 0 errors. Fix any that appear.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/add.tsx
git commit -m "feat: update add.tsx to use structured createTransaction params"
```

---

## Task 12: Rewrite notificationService.ts

**Files:**
- Modify: `src/services/notificationService.ts`

- [ ] **Step 1: Replace the file**

Open `src/services/notificationService.ts`. Replace entirely:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/lib/supabase';

const PUSH_TOKEN_KEY = '@push_token';

export async function registerPushToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, updated_at: new Date().toISOString() });
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/notificationService.ts
git commit -m "feat: update notificationService to use Supabase for push token registration"
```

---

## Task 13: Remove Legacy Axios Client

**Files:**
- Delete: `src/lib/api.ts`

- [ ] **Step 1: Verify no remaining imports of api.ts**

```bash
grep -r "from '@/src/lib/api'" src/ app/ --include="*.ts" --include="*.tsx"
```

Expected: no output (0 matches). If any matches appear, update those files to use `src/lib/supabase` instead before deleting.

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/api.ts
```

- [ ] **Step 3: Run lint**

```bash
npx expo lint
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy Axios API client (replaced by Supabase client)"
```

---

## Task 14: End-to-End Verification

> Manual testing. Run `npx expo start --web` and test each flow.

- [ ] **Step 1: Start the app**

```bash
npx expo start --web
```

Open browser at the URL shown (usually http://localhost:8081).

- [ ] **Step 2: Test fetch transactions (History tab)**

1. Open Settings tab → set a User ID that has existing transactions in Supabase
2. Open History tab
3. Verify: transaction list loads without errors
4. Expected: transactions appear sorted by date descending

- [ ] **Step 3: Test create transaction (manual entry)**

1. Open Add tab
2. Select "Expense"
3. Tap "Manual Entry"
4. Fill: Merchant=TestMerchant, Amount=50000, Category=Lainnya, Date=today
5. Tap "Save Transaction"
6. Expected: success modal appears
7. Open History tab → verify new transaction appears

- [ ] **Step 4: Test dashboard reports (Summary tab)**

1. Open Summary tab
2. Expected: total expense, total savings, transaction count all show numbers
3. Recent transactions section shows data

- [ ] **Step 5: Test OCR extraction (Add tab)**

1. Open Add tab
2. Tap "Upload from Gallery" or "Take Photo"
3. Select a receipt image
4. Tap "Extract Data"
5. Expected: extracted data (merchant, amount, category) appears in the review form
6. Edit if needed, tap "Save Transaction"
7. Open History tab → verify transaction saved with `file_url` populated

- [ ] **Step 6: Test Explore tab (spending overview)**

1. Open Explore tab
2. Expected: couple spending comparison chart loads with data from `spending_overview` view

- [ ] **Step 7: Check Supabase Dashboard + Google Sheets**

1. Open Supabase Dashboard → Table Editor → transactions
2. Verify the two new transactions from Steps 3 and 5 appear, `file_url` populated for OCR transaction
3. Open Table Editor → push_tokens — verify a row appeared (if push permissions granted during app load)
4. Open Google Sheets spreadsheet (`1bmAjvJAflklKH-Xoyitd2mK6agT6j2bnYKbO3L7GQiE`)
5. Open sheet tab `Expense` — verify matching rows appeared for expense transactions saved in Steps 3 and 5
6. Open sheet tab `Wedding_Savings` — verify rows appear for money_saving type transactions

- [ ] **Step 8: Final commit if all tests pass**

```bash
git add -A
git commit -m "chore: complete Supabase migration — all n8n dependencies removed"
```

---

## Appendix: Type fix for MonthlyReportResponse

The `MonthlyReportResponse` type in `src/types/index.ts` has `month: number` but our new implementation sets `month: number | null`. Verify the type allows null:

Open `src/types/index.ts`. Find:

```typescript
export interface MonthlyReportResponse {
  success: boolean;
  user_id: string;
  year: number;
  month: number;
  ...
```

If `month` is not `number | null`, update it:

```typescript
  month: number | null;
```

This matches the existing n8n API response shape (already typed correctly per `src/types/index.ts:82`). No change needed if it already says `number | null`.
