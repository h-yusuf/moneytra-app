# Catat via Prompt — Design Spec

Date: 2026-08-24
Status: Approved for implementation planning

## Problem

User wants a free-text entry path: type a sentence (or several) describing
one or more transactions — e.g. *"hari ini aku belanja roti 12k di pasar"*
or *"hari ini belanja 12k dan kemarin belanja 10k di indomaret"* — and have
AI parse it into structured transaction(s), review them, then bulk-save.

## Architecture

Two new Supabase Edge Functions, one new UI flow on the Add screen.

```
User types free-text prompt (textarea)
    ↓
[parse-transactions-prompt]  (new Edge Function)
    - reuses LLM_BASE_URL / LLM_API_KEY / CHAT_MODEL env (same provider
      config as the existing `ai-chat` function — no new secrets)
    - injects current WIB date (reuse the getWIBDate() pattern from
      ai-chat) so the model can resolve relative dates ("hari ini",
      "kemarin")
    - returns an array of draft transactions (length >= 1)
    ↓
Review list (client-side, editable, per-item error flag)
    ↓ user taps "Save All" (disabled while any item has an error)
[bulk-create-transactions]  (new Edge Function)
    - single batch insert: supabase.from('transactions').insert([...]).select()
    - loops appending each row to Google Sheets (non-fatal per row,
      same tab-routing rule as create-transaction: expense -> Expense,
      money_saving + category 'wedding' -> Wedding_Savings, else ->
      Money_Saving)
    - sends ONE summary Telegram notification for the whole batch
      (not one per transaction)
```

`create-transaction` (single-save, used by manual entry / OCR review) is
left untouched. `bulk-create-transactions` is a separate function because
its Sheets/Telegram side effects differ (loop rows, one summary notification
instead of N).

## Data contracts

### `parse-transactions-prompt`

Request:
```json
{ "user_id": "string", "prompt": "string" }
```

Response:
```json
{
  "transactions": [
    {
      "merchant": "string or null",
      "total": "number or null",
      "category": "string or null",
      "transaction_date": "string YYYY-MM-DD or null",
      "payment_method": "string or null",
      "notes": "string",
      "type": "expense | money_saving"
    }
  ]
}
```

Rules for the model (system prompt), mirroring the extraction rules already
used in `doc/n8n-workflows/*` and `ai-chat`:
- Split the prompt into one object per distinct transaction mentioned.
- Resolve relative dates ("hari ini", "kemarin", "tadi pagi") against the
  injected WIB date.
- Infer `type` per item from context: mentions of "nabung", "tabungan",
  "tabungan nikah" → `money_saving`; otherwise → `expense`. A single prompt
  can produce a mix of both types.
- Infer `category` the same way the OCR prompt does (Belanja Harian,
  Makanan & Minuman, Transportasi, etc.) — never null; default `"Lainnya"`.
- If `merchant` or `total` can't be determined for a mentioned transaction,
  set them `null` rather than guessing — the client flags these for manual
  completion instead of silently dropping the line.
- Return ONLY the JSON object, no prose, no markdown fences.

### `bulk-create-transactions`

Request:
```json
{
  "transactions": [
    {
      "user_id": "string",
      "type": "expense | money_saving",
      "merchant": "string",
      "total": "number",
      "category": "string",
      "transaction_date": "string YYYY-MM-DD",
      "payment_method": "string?",
      "notes": "string?",
      "source_name": "string?"
    }
  ]
}
```
`source_name` is set client-side to `"ai-prompt-entry"` for every item so
saved rows are distinguishable from manual/OCR entries later if needed.

Response (success): `{ "data": Transaction[] }` (rows as inserted, same
shape `create-transaction` returns for a single row).

Response (failure): `{ "error": "string" }`, HTTP 500. The whole batch is
one insert call — no partial-success handling. This is acceptable because
the client only enables "Save All" once every draft item has passed
client-side validation (no missing required fields), so a failure here is
an infra/network issue, not a data issue, and the review list stays intact
for retry.

## New types (`src/types/index.ts`)

```ts
export interface ParsedTransactionDraft {
  id: string; // client-only, uuid or index-based, for list keys/edits
  merchant: string | null;
  total: number | null;
  category: string | null;
  transaction_date: string | null;
  payment_method?: string | null;
  notes?: string;
  type: 'expense' | 'money_saving';
}
```

A draft "has an error" (client-computed, not a server field) when
`merchant`, `total`, `category`, or `transaction_date` is null/empty.

## Client service layer (`src/services/transactionService.ts`)

Two new functions, following the existing `fetch`-to-Edge-Function pattern
used by `createTransaction`:

```ts
parseTransactionsFromPrompt(userId: string, prompt: string): Promise<ParsedTransactionDraft[]>
bulkCreateTransactions(items: CreateTransactionParams[]): Promise<Transaction[]>
```

## Components

`app/(tabs)/add.tsx` is already 600+ lines — this feature's review-list UI
is sizable enough that it should not be added inline there. New files:

- **`src/components/common/PromptEntryCard.tsx`** — multiline `TextInput`
  + "Parse dengan AI" button. While parsing, shows the (generalized)
  `OcrProcessingCard` in place of the button.
- **`src/components/common/ParsedTransactionReviewList.tsx`** — one card
  per draft: `AutocompleteInput` for merchant/category (reusing the same
  suggestion lists already fetched in `add.tsx`), numeric `TextInput` for
  total, `DateField` for date, a type toggle (expense/money_saving) chip
  pair, a delete button, and a red "Lengkapi data" badge when the item has
  an error. Footer "Save All" button, disabled while any item errors,
  showing a count ("Save All (3)").

### `OcrProcessingCard` generalization

Add an optional `stages` prop (array of `{icon, message}`), defaulting to
the current OCR stage list — fully backward compatible with its existing
use in the OCR extract flow. `PromptEntryCard` passes its own stage list
("Membaca kalimat...", "Memisah transaksi...", "Menyusun data..."). The
`imageUri` prop stays optional/undefined for the prompt-entry case (no
scan-line rendered, matches its current no-image behavior).

## UI placement

Fourth card under "INPUT METHOD" on the Add screen, alongside Take Photo /
Upload from Gallery / Manual Entry. Title: **"Catat via Prompt"**. Tapping
it toggles the `PromptEntryCard` open, same show/hide pattern already used
for Manual Entry (`showManualEntry` state) — add a parallel
`showPromptEntry` state, mutually exclusive with `showManualEntry` and
`uploadedFile` (only one entry mode visible at a time, same as today).

## Flow in `add.tsx`

1. `showPromptEntry` toggled on → `PromptEntryCard` renders.
2. User types, taps "Parse dengan AI" → `parseTransactionsFromPrompt()` →
   sets `promptDrafts: ParsedTransactionDraft[]` state, hides the textarea,
   shows `ParsedTransactionReviewList`.
3. User edits/removes drafts inline (list state lives in `add.tsx`, passed
   down as props + callbacks — same lifting pattern as `manualForm`).
4. "Save All" → `bulkCreateTransactions()` with `source_name:
   'ai-prompt-entry'` on every item → on success, reuse the existing
   success modal/sound (`showSuccessModal`, `playSuccessSound`) and reset
   state; on failure, inline error alert, list stays for retry.

## Error handling

- Parse call fails entirely (network/500) → inline error alert, textarea
  stays filled so the user can retry without retyping.
- Parse succeeds but some drafts are incomplete → they render with the
  error badge; "Save All" is disabled until the user fixes or deletes them.
- Bulk insert fails → inline error alert; review list is preserved, "Save
  All" re-enabled for retry.

## Out of scope (YAGNI)

- Duplicate-transaction detection.
- Undo after Save All.
- Editing `type` inference confidence / showing why AI picked a type.
- Streaming/partial results while parsing (single request/response is
  enough given prompts are short).

## Testing

Manual, no automated test suite in this repo:
1. Single transaction, single sentence — merchant/total/date/category all
   resolved correctly.
2. Multi-transaction, mixed relative dates ("hari ini" / "kemarin") and
   mixed type (one expense line + one "nabung" line) — both rows correct,
   both types correct.
3. Ambiguous line (no nominal amount) — appears in review list flagged,
   Save All disabled until fixed or removed.
4. After Save All — confirm rows in Supabase `transactions`, rows appended
   to the correct Google Sheets tab(s), one summary Telegram message (not
   N messages).
