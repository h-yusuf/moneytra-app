# Category & Merchant Autocomplete — Design

## Problem

The Add Transaction form (manual entry + extracted/OCR review) has two free-text fields, `category` and `merchant`, backed by nothing more than a `string` column on `transactions`. There is no master category/merchant table. Today:

- `category` shows 4 hardcoded preset chips (`Makanan & Minuman`, `Belanja Harian`, `Wedding`, `Lainnya`) plus a free-text `TextInput`.
- `merchant` is plain free-text with no suggestions at all.

This leads to inconsistent values across transactions (e.g. `Makanan`, `makanan `, `MAKANAN`) and no way to reuse merchant names already typed before.

## Goals

- Let the user pick an existing category/merchant value (derived from transaction history) or type a new one inline — no separate "create new" step needed, since free text already works.
- Suggestions are global (all users, not scoped to the current user_id).
- Suggestions sorted by frequency of use (most-used first).
- New values get normalized to a consistent casing going forward; existing DB rows are left untouched (to be audited manually later).
- Applies to both `category` and `merchant`, in both the manual entry form and the extracted-data review form.

## Non-goals

- No master category/merchant table migration.
- No backfill/migration of existing inconsistent data in `transactions`.
- No new dependency — build with existing RN primitives, consistent with the rest of the codebase's custom-styled approach.

## 1. Data layer

New function in `src/services/transactionService.ts`:

```ts
export interface FieldSuggestion {
  value: string;
  count: number;
}

export async function fetchCategoryMerchantSuggestions(): Promise<{
  categories: FieldSuggestion[];
  merchants: FieldSuggestion[];
}>
```

- Queries Supabase: `supabase.from('transactions').select('category, merchant')` — no `user_id` filter (global scope, per user decision).
- Client-side dedupe: group by `trim().toLowerCase()` key; keep the first-seen original casing as the display value; count occurrences per key.
- Sort each list descending by `count`.

Wrapped in a TanStack Query hook, e.g. `useCategoryMerchantSuggestions()` (colocated with other query hooks used in `add.tsx`), with `staleTime` ~5 minutes — the suggestion pool doesn't need to be real-time fresh.

## 2. Normalization

New util `src/utils/textFormat.ts`:

```ts
export function smartTitleCase(str: string): string
```

Rule, applied per word (splitting on whitespace, keeping other characters like `&`/`-` untouched):
- If the word is all-uppercase and 2–4 letters long (acronym heuristic — `PLN`, `KFC`, `ATM`, `QRIS`), leave it unchanged.
- Otherwise, capitalize the first letter, lowercase the rest.

**When it runs:** only when the submitted value doesn't match (case-insensitive, trimmed) any existing suggestion — i.e. it's genuinely new. If it matches an existing suggestion, the existing suggestion's original stored casing is used instead (no re-normalization of already-consistent data). Applied at submit/blur time, not on every keystroke, so it doesn't fight the user while typing.

## 3. UI component

New reusable component `src/components/common/AutocompleteInput.tsx`.

Props:
```ts
{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: FieldSuggestion[];
  placeholder?: string;
}
```

Behavior:
- Renders a `TextInput` styled consistently with existing form fields (`colors.cardSecondary` background, same radius/padding/font as current fields).
- On focus: shows a dropdown overlay below the input (absolute positioned, doesn't push surrounding layout), listing suggestions filtered by substring match (case-insensitive) against the current text, already sorted by frequency. Shows up to ~8 items, scrollable if more.
- Empty text + focused: shows the top ~8 suggestions by frequency (browse mode).
- Tapping a suggestion calls `onChangeText(item.value)` (using its original stored casing) and closes the dropdown.
- Blur / tap outside closes the dropdown.
- No explicit "create new" affordance — continuing to type text that doesn't match anything and moving on is itself "creating new"; normalization (see §2) takes care of consistent casing at submit time.

The old static chip row (4 hardcoded presets) is removed and replaced by this component.

### Integration points in `app/(tabs)/add.tsx`

- Manual form category field (currently lines 452–461)
- Manual form merchant field (currently line 445)
- Extracted-data review category field (currently lines 543–548)
- Extracted-data review merchant field (currently line 536)

All four wire up to the same `useCategoryMerchantSuggestions()` query result (categories → category fields, merchants → merchant fields).

## 4. Error handling & edge cases

- Query loading/error → suggestions default to `[]`; the field still behaves as a plain text input, and normalization at submit still applies. Never blocks user input.
- Existing inconsistent data in `transactions` (pre-feature) is left as-is; the suggestion list simply reflects whatever casing was first-seen per dedup key. User has stated they'll audit old data manually — no migration in scope here.
- Matching is done via `trim().toLowerCase()` key, so `"kategori"` and `"Kategori"` in old data collapse into a single suggestion entry (first-seen casing wins for display).
- No test suite exists in this project (per `CLAUDE.md`). Verification is manual via `npx expo start` (web/simulator): confirm dropdown filtering works, selecting an existing value works, typing a brand-new category/merchant gets `smartTitleCase`-normalized on submit, and acronym values (`PLN`, `KFC`) survive normalization unchanged.
