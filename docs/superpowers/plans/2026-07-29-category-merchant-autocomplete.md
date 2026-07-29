# Category & Merchant Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 4-chip category picker and the plain-text merchant field on the Add Transaction form with a searchable autocomplete that suggests existing category/merchant values (from transaction history, sorted by frequency) while still allowing free-text entry of new values.

**Architecture:** A new Supabase query in `transactionService.ts` fetches all `(category, merchant)` pairs, dedupes them client-side (case/whitespace-insensitive) into frequency-sorted suggestion lists. A small custom hook exposes this to the UI (no TanStack Query — the codebase doesn't actually use it anywhere despite being installed; every existing screen fetches with plain `useState`/`useEffect`, so this follows that established pattern). A new reusable `AutocompleteInput` component renders a filterable dropdown under a `TextInput`. A `smartTitleCase` util normalizes brand-new values (not matches) at submit time, preserving short all-caps acronyms (`PLN`, `KFC`).

**Tech Stack:** React Native + Expo, TypeScript, Supabase JS client (`@/src/lib/supabase`), existing `ThemeContext` for colors. No new dependencies.

## Global Constraints

- Suggestions are global (all users), not scoped to `user_id`.
- Suggestions sorted by usage frequency, most-used first.
- Existing inconsistent data in `transactions` is left untouched — no migration/backfill.
- `smartTitleCase` capitalizes first letter of each word, lowercases the rest, EXCEPT words that are all-uppercase and 2–4 letters long (kept as-is, e.g. `PLN`, `KFC`, `ATM`, `QRIS`). Non-letter characters (`&`, `-`) are left untouched as separators.
- Normalization only applies to values that don't match (trim + lowercase comparison) any existing suggestion; matched values use the existing suggestion's original stored casing instead.
- Applies to both `category` and `merchant` fields, in both the manual entry form and the extracted-data review form in `app/(tabs)/add.tsx`.
- No new npm dependency.
- Project has no test suite (`CLAUDE.md`) — verification steps below are manual (Node one-off checks for pure logic, `npx expo start` for UI).

---

## Task 1: Text normalization util

**Files:**
- Create: `src/utils/textFormat.ts`

**Interfaces:**
- Produces: `normalizeKey(str: string): string`, `smartTitleCase(str: string): string` — used by Task 2 (dedup key) and Task 5/6 (submit-time normalization).

- [ ] **Step 1: Write `src/utils/textFormat.ts`**

```ts
// src/utils/textFormat.ts

export function normalizeKey(str: string): string {
  return str.trim().toLowerCase();
}

const ACRONYM_RE = /^[A-Z]{2,4}$/;

function capitalizeWord(word: string): string {
  // Split leading/trailing non-letter runs off so punctuation-only tokens pass through untouched
  const match = word.match(/^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/);
  if (!match) return word;
  const [, prefix, letters, suffix] = match;
  if (ACRONYM_RE.test(letters)) return prefix + letters + suffix;
  const cased = letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
  return prefix + cased + suffix;
}

export function smartTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map(capitalizeWord)
    .join(' ');
}
```

- [ ] **Step 2: Manually verify the logic**

Run: `node -e "$(cat <<'EOF'
function capitalizeWord(word) {
  const match = word.match(/^([^a-zA-Z]*)([a-zA-Z]+)([^a-zA-Z]*)$/);
  if (!match) return word;
  const [, prefix, letters, suffix] = match;
  if (/^[A-Z]{2,4}$/.test(letters)) return prefix + letters + suffix;
  const cased = letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
  return prefix + cased + suffix;
}
function smartTitleCase(str) {
  return str.trim().split(/\s+/).map(capitalizeWord).join(' ');
}
console.log(smartTitleCase('makanan & minuman'));
console.log(smartTitleCase('BELANJA HARIAN'));
console.log(smartTitleCase('pln'));
console.log(smartTitleCase('bayar PLN bulan ini'));
console.log(smartTitleCase('kfc'));
console.log(smartTitleCase('  kost   '));
EOF
)"`

Expected output:
```
Makanan & Minuman
Belanja Harian
Pln
Bayar PLN Bulan Ini
Kfc
Kost
```

Note: a lone 3-letter word like `pln` typed lowercase title-cases to `Pln` (the acronym exception only fires when the word is already all-uppercase — this matches the spec's rule literally: it protects existing acronyms from being mangled, it doesn't detect that a lowercase word "should" be an acronym). This is expected behavior per the design.

- [ ] **Step 3: Commit**

```bash
git add src/utils/textFormat.ts
git commit -m "feat: add smartTitleCase normalization util"
```

---

## Task 2: Data layer — fetch category/merchant suggestions

**Files:**
- Modify: `src/services/transactionService.ts`

**Interfaces:**
- Consumes: `normalizeKey` from `src/utils/textFormat.ts` (Task 1); existing `supabase` client from `@/src/lib/supabase`.
- Produces: `FieldSuggestion` type and `fetchCategoryMerchantSuggestions(): Promise<{ categories: FieldSuggestion[]; merchants: FieldSuggestion[] }>` — used by Task 3's hook.

- [ ] **Step 1: Add the function to `transactionService.ts`**

Add near the other fetch functions (after `fetchTransactions`, before `fetchSpendingOverview`):

```ts
import { normalizeKey } from '@/src/utils/textFormat';

// ─── fetchCategoryMerchantSuggestions ────────────────────────────────────────

export interface FieldSuggestion {
  value: string;
  count: number;
}

function buildSuggestions(values: (string | null | undefined)[]): FieldSuggestion[] {
  const map = new Map<string, FieldSuggestion>();
  for (const raw of values) {
    if (!raw || !raw.trim()) continue;
    const key = normalizeKey(raw);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { value: raw.trim(), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export async function fetchCategoryMerchantSuggestions(): Promise<{
  categories: FieldSuggestion[];
  merchants: FieldSuggestion[];
}> {
  const { data, error } = await supabase.from('transactions').select('category, merchant');
  if (error) throw error;

  const rows = (data ?? []) as { category: string | null; merchant: string | null }[];
  return {
    categories: buildSuggestions(rows.map(r => r.category)),
    merchants: buildSuggestions(rows.map(r => r.merchant)),
  };
}
```

- [ ] **Step 2: Manually verify dedupe/sort logic**

Run: `node -e "$(cat <<'EOF'
function normalizeKey(s) { return s.trim().toLowerCase(); }
function buildSuggestions(values) {
  const map = new Map();
  for (const raw of values) {
    if (!raw || !raw.trim()) continue;
    const key = normalizeKey(raw);
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { value: raw.trim(), count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
console.log(buildSuggestions(['Makanan', 'makanan ', 'Wedding', 'Makanan', 'MAKANAN', null, '']));
EOF
)"`

Expected output (order: `Makanan` count 4 first, `Wedding` count 1 second):
```
[
  { value: 'Makanan', count: 4 },
  { value: 'Wedding', count: 1 }
]
```

This confirms first-seen casing wins and counts aggregate correctly across case/whitespace variants.

- [ ] **Step 3: Commit**

```bash
git add src/services/transactionService.ts
git commit -m "feat: add fetchCategoryMerchantSuggestions to transactionService"
```

---

## Task 3: `useCategoryMerchantSuggestions` hook

**Files:**
- Create: `src/hooks/useCategoryMerchantSuggestions.ts`

**Interfaces:**
- Consumes: `fetchCategoryMerchantSuggestions`, `FieldSuggestion` from `src/services/transactionService.ts` (Task 2).
- Produces: `useCategoryMerchantSuggestions(): { categories: FieldSuggestion[]; merchants: FieldSuggestion[]; loading: boolean }` — used by Task 5/6 in `add.tsx`.

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useCategoryMerchantSuggestions.ts
import { useEffect, useState } from 'react';
import { fetchCategoryMerchantSuggestions, type FieldSuggestion } from '@/src/services/transactionService';

export function useCategoryMerchantSuggestions() {
  const [categories, setCategories] = useState<FieldSuggestion[]>([]);
  const [merchants, setMerchants] = useState<FieldSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCategoryMerchantSuggestions()
      .then(({ categories, merchants }) => {
        if (cancelled) return;
        setCategories(categories);
        setMerchants(merchants);
      })
      .catch(() => {
        // Suggestions are a nice-to-have; leave lists empty on failure so the
        // fields still work as plain free-text inputs.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, merchants, loading };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCategoryMerchantSuggestions.ts
git commit -m "feat: add useCategoryMerchantSuggestions hook"
```

---

## Task 4: `AutocompleteInput` component

**Files:**
- Create: `src/components/common/AutocompleteInput.tsx`

**Interfaces:**
- Consumes: `FieldSuggestion` type from `src/services/transactionService.ts` (Task 2); `useTheme()` from `@/src/contexts/ThemeContext`.
- Produces: `<AutocompleteInput label suggestions value onChangeText placeholder? />` component — used by Task 5/6 in `add.tsx`.

- [ ] **Step 1: Write the component**

```tsx
// src/components/common/AutocompleteInput.tsx
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { FieldSuggestion } from '@/src/services/transactionService';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: FieldSuggestion[];
  placeholder?: string;
}

const MAX_VISIBLE = 8;

export function AutocompleteInput({
  label,
  value,
  onChangeText,
  suggestions,
  placeholder,
}: AutocompleteInputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const filtered = value.trim()
    ? suggestions.filter(s => s.value.toLowerCase().includes(value.trim().toLowerCase()))
    : suggestions;
  const visible = filtered.slice(0, MAX_VISIBLE);
  const showDropdown = isFocused && visible.length > 0;

  return (
    <View style={{ marginBottom: 12, zIndex: showDropdown ? 10 : 1 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        style={{
          backgroundColor: colors.cardSecondary,
          borderRadius: 12,
          padding: 12,
          color: colors.text,
          fontSize: 15,
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
      />
      {showDropdown && (
        <View
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: 220,
            overflow: 'hidden',
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {visible.map(item => (
              <Pressable
                key={item.value}
                onPress={() => {
                  onChangeText(item.value);
                  setIsFocused(false);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 14 }}>{item.value}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/AutocompleteInput.tsx
git commit -m "feat: add AutocompleteInput reusable component"
```

---

## Task 5: Wire into the manual entry form

**Files:**
- Modify: `app/(tabs)/add.tsx:1-45` (imports, hook usage), `:174-227` (`handleSaveManualEntry`), `:444-461` (merchant + category fields)

**Interfaces:**
- Consumes: `useCategoryMerchantSuggestions` (Task 3), `AutocompleteInput` (Task 4), `smartTitleCase`/`normalizeKey` (Task 1).

- [ ] **Step 1: Add imports and hook call**

In `app/(tabs)/add.tsx`, add to the top imports:

```ts
import { AutocompleteInput } from '@/src/components/common/AutocompleteInput';
import { useCategoryMerchantSuggestions } from '@/src/hooks/useCategoryMerchantSuggestions';
import { normalizeKey, smartTitleCase } from '@/src/utils/textFormat';
```

Inside `AddScreen`, after the existing `useState` declarations (near line 45), add:

```ts
const { categories: categorySuggestions, merchants: merchantSuggestions } = useCategoryMerchantSuggestions();
```

Add a small resolver helper (used by both this task and Task 6) right after that:

```ts
function resolveSuggestedValue(input: string, suggestions: { value: string }[]): string {
  const trimmed = input.trim();
  const match = suggestions.find(s => normalizeKey(s.value) === normalizeKey(trimmed));
  return match ? match.value : smartTitleCase(trimmed);
}
```

- [ ] **Step 2: Replace the merchant `TextInput` (currently line 445) with `AutocompleteInput`**

Find:
```tsx
<TextInput value={manualForm.merchant} onChangeText={(text) => setManualForm({ ...manualForm, merchant: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="e.g. Indomaret, Grab, PLN" placeholderTextColor={colors.textTertiary} />
```

Replace the surrounding block (the `<View style={{ marginBottom: 12 }}>...merchant label + input...</View>` currently at lines 443–446) with:

```tsx
<AutocompleteInput
  label="Merchant / Store Name *"
  value={manualForm.merchant}
  onChangeText={(text) => setManualForm({ ...manualForm, merchant: text })}
  suggestions={merchantSuggestions}
  placeholder="e.g. Indomaret, Grab, PLN"
/>
```

- [ ] **Step 3: Replace the category field + chip row (currently lines 451–461) with `AutocompleteInput`**

Find the block:
```tsx
<View style={{ marginBottom: 12 }}>
  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Category *</Text>
  <TextInput value={manualForm.category} onChangeText={(text) => setManualForm({ ...manualForm, category: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="e.g. Food, Transport, Bills" placeholderTextColor={colors.textTertiary} />
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
    {['Makanan & Minuman', 'Belanja Harian', 'Wedding', 'Lainnya'].map((cat) => (
      <Pressable key={cat} onPress={() => setManualForm({ ...manualForm, category: cat })} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: manualForm.category === cat ? colors.primary : colors.border, backgroundColor: manualForm.category === cat ? colors.primary : colors.cardSecondary }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: manualForm.category === cat ? '#0a0a0a' : colors.textSecondary }}>{cat}</Text>
      </Pressable>
    ))}
  </View>
</View>
```

Replace with:

```tsx
<AutocompleteInput
  label="Category *"
  value={manualForm.category}
  onChangeText={(text) => setManualForm({ ...manualForm, category: text })}
  suggestions={categorySuggestions}
  placeholder="e.g. Food, Transport, Bills"
/>
```

- [ ] **Step 4: Apply normalization at submit time in `handleSaveManualEntry`**

In `handleSaveManualEntry` (line 174), right after the existing validation `if` checks (after the line `if (!manualForm.transaction_date.trim()) { ... return; }` at line 178) and before `if (!profile?.user_id)`, add:

```ts
const resolvedMerchant = resolveSuggestedValue(manualForm.merchant, merchantSuggestions);
const resolvedCategory = resolveSuggestedValue(manualForm.category, categorySuggestions);
```

Then update the `createTransaction` call (lines 191–201) to use these instead of the raw form values:

```ts
await createTransaction({
  user_id: profile.user_id,
  type: selectedType,
  merchant: resolvedMerchant,
  total: amount,
  category: resolvedCategory,
  transaction_date: manualForm.transaction_date,
  payment_method: manualForm.payment_method || undefined,
  notes: manualForm.notes || undefined,
  source_name: 'manual-entry',
});
```

And update the two `checkBudgetAlert`/`Alert.alert` references at lines 206–212 that read `manualForm.category` to read `resolvedCategory` instead (so the budget alert message reflects the normalized category name):

```ts
if (selectedType === 'expense' && resolvedCategory) {
  const budgetCheck = checkBudgetAlert(resolvedCategory, profile.user_id, amount);
  if (budgetCheck.isOverLimit) {
    Alert.alert('⚠️ Budget Exceeded!', `You have exceeded your ${budgetCheck.budget?.period} budget for ${resolvedCategory}!\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK', style: 'destructive' }]);
  } else if (budgetCheck.isNearLimit) {
    Alert.alert('⚠️ Budget Warning', `You are approaching your ${budgetCheck.budget?.period} budget limit for ${resolvedCategory}.\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK' }]);
  }
}
```

- [ ] **Step 5: Manually verify in the running app**

Run: `npx expo start --web` (or `--ios`/`--android`)

1. Open Add Transaction → Manual Entry.
2. Tap the Merchant field — confirm a dropdown of existing merchants appears (empty list is fine on a fresh DB).
3. Type a few characters of an existing merchant — confirm the list filters to matches, sorted by frequency (most-used first if there are repeats).
4. Tap a suggestion — confirm it fills the field and the dropdown closes.
5. Type a brand-new merchant name (e.g. `warkop baru`) and save the transaction — confirm no crash, and (via Supabase dashboard or the History tab) confirm the stored value is `Warkop Baru`.
6. Repeat steps 2–5 for the Category field, confirming the old 4-chip row is gone.
7. Type an existing category with different casing (e.g. `WEDDING` when `Wedding` already exists) and save — confirm the stored value matches the existing casing (`Wedding`), not a re-normalized one.
8. Type a merchant/category consisting of a known acronym, e.g. `pln` typed as `PLN` (all caps) and save — confirm it's stored as `PLN` unchanged.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/add.tsx"
git commit -m "feat: wire autocomplete into manual entry form"
```

---

## Task 6: Wire into the extracted-data review form

**Files:**
- Modify: `app/(tabs)/add.tsx:267-320` (`handleSaveTransaction`), `:530-548` (merchant + category review fields)

**Interfaces:**
- Consumes: `useCategoryMerchantSuggestions`, `AutocompleteInput`, `resolveSuggestedValue` — all already added to this file in Task 5.

- [ ] **Step 1: Replace the extracted merchant `TextInput` (currently around line 536) with `AutocompleteInput`**

Find the block wrapping the extracted merchant field (label + `TextInput` bound to `extractedData.merchant`) and replace the `TextInput` with:

```tsx
<AutocompleteInput
  label="Merchant / Store Name"
  value={extractedData.merchant}
  onChangeText={(text) => setExtractedData({ ...extractedData, merchant: text })}
  suggestions={merchantSuggestions}
/>
```

Keep the surrounding `<View>` wrapper and label text as they currently are, only swapping the `TextInput` element itself — unless the label is redundant with `AutocompleteInput`'s own `label` prop, in which case remove the now-duplicate `<Text>` label and pass it via the `label` prop as shown above.

- [ ] **Step 2: Replace the extracted category field + chip row (currently lines 543–548) with `AutocompleteInput`**

Find:
```tsx
<View style={{ marginBottom: 12 }}>
  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Category</Text>
  <TextInput value={extractedData.category} onChangeText={(text) => setExtractedData({ ...extractedData, category: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholderTextColor={colors.textTertiary} />
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
    {['Makanan & Minuman', 'Belanja Harian', 'Wedding', 'Lainnya'].map((cat) => (
      <Pressable key={cat} onPress={() => setExtractedData({ ...extractedData, category: cat })} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: extractedData.category === cat ? colors.primary : colors.border, backgroundColor: extractedData.category === cat ? colors.primary : colors.cardSecondary }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: extractedData.category === cat ? '#0a0a0a' : colors.textSecondary }}>{cat}</Text>
      </Pressable>
    ))}
  </View>
</View>
```

Replace with:

```tsx
<AutocompleteInput
  label="Category"
  value={extractedData.category}
  onChangeText={(text) => setExtractedData({ ...extractedData, category: text })}
  suggestions={categorySuggestions}
/>
```

- [ ] **Step 3: Apply normalization at submit time in `handleSaveTransaction`**

In `handleSaveTransaction` (line 267), right after the `if (!extractedData) return;` guard and before the `setIsSaving(true)` call, add:

```ts
const resolvedMerchant = resolveSuggestedValue(extractedData.merchant, merchantSuggestions);
const resolvedCategory = resolveSuggestedValue(extractedData.category, categorySuggestions);
```

Update the `createTransaction` call (lines 280–291) to use these:

```ts
await createTransaction({
  user_id: profile.user_id,
  type: selectedType,
  merchant: resolvedMerchant,
  total: extractedData.total,
  category: resolvedCategory,
  transaction_date: extractedData.transaction_date,
  payment_method: extractedData.payment_method || undefined,
  notes: extractedData.notes || undefined,
  source_name: uploadedFile?.name || 'receipt',
  file_url: extractedData.file_url || undefined,
});
```

Update the budget-check block (lines 296–303) to reference `resolvedCategory` instead of `extractedData.category`:

```ts
if (selectedType === 'expense' && resolvedCategory) {
  const budgetCheck = checkBudgetAlert(resolvedCategory, profile.user_id, extractedData.total);
  if (budgetCheck.isOverLimit) {
    Alert.alert('⚠️ Budget Exceeded!', `You have exceeded your ${budgetCheck.budget?.period} budget for ${resolvedCategory}!\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK', style: 'destructive' }]);
  } else if (budgetCheck.isNearLimit) {
    Alert.alert('⚠️ Budget Warning', `You are approaching your ${budgetCheck.budget?.period} budget limit for ${resolvedCategory}.\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK' }]);
  }
}
```

- [ ] **Step 4: Manually verify in the running app**

Run: `npx expo start --web` (or `--ios`/`--android`)

1. Upload a receipt image and let it extract (or simulate the extract step if OCR backend isn't reachable locally).
2. On the review screen, confirm the Merchant and Category fields show the autocomplete dropdown behavior identical to the manual form (steps 2–8 from Task 5's verification, applied here).
3. Save and confirm the transaction is created with the resolved (existing-casing or normalized-new) values.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/add.tsx"
git commit -m "feat: wire autocomplete into extracted-data review form"
```

---

## Self-Review Notes

- **Spec coverage:** data layer (Task 2), normalization (Task 1), UI component (Task 4), both integration points — manual form (Task 5) and extracted review (Task 6) — all covered. Global scope, frequency sort, and no-migration constraints are all encoded directly in the query (no `user_id` filter) and dedupe/sort logic.
- **Deviation from spec wording:** the spec suggested "a TanStack Query hook" as an example; this plan uses a plain `useState`/`useEffect` hook instead, matching how every other screen in this codebase actually fetches data today (TanStack Query is an installed but unused dependency). This is a implementation detail, not a behavior change — the plan still delivers the loading/caching-adjacent shape the spec asked for.
- **Type consistency:** `FieldSuggestion` is defined once in Task 2 and reused identically (`{ value: string; count: number }`) through Tasks 3, 4, 5, 6. `resolveSuggestedValue` is defined once in Task 5 and reused in Task 6 (same file, no re-declaration needed).
