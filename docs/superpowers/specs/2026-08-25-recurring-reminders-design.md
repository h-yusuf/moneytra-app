# Recurring Items & Reminders — Design Spec

Date: 2026-08-25
Status: Approved for implementation planning

## Problem

Bills and recurring costs (vehicle tax, insurance, subscriptions, periodic
vehicle service) currently have no tracking in the app. Two related needs:

1. **Bill reminders** — items with no fixed reliable amount or where the
   user pays manually (vehicle tax) need proactive due-date alerts before
   they're forgotten.
2. **Recurring transactions** — items with a fixed amount that repeats on a
   schedule (subscriptions) should optionally auto-record themselves as a
   transaction when due, instead of requiring manual entry every cycle.

One unified data model (`recurring_items`) covers both; the difference is
just the `auto_record` flag per item.

## Architecture

```
recurring_items (new table)
    ↓
pg_cron (daily, ~08:00 WIB) → pg_net.http_post → check-reminders (new Edge Function)
    ↓
for each active item:
  - compute days_until_due
  - decide whether to alert (per-item alert_offsets / daily_within_days)
  - if auto_record && due → insert transaction (shared helper), advance next_due_date
  - else if due-window matched → send Telegram + Expo push
    ↓
Telegram (existing bot/chat_id secrets)  +  Expo push (existing push_tokens table)
```

New client screen: `app/reminders.tsx` (Stack screen, not a bottom tab —
reached via a card in Settings between Profile and Budget Management, to
avoid crowding the already-5-item tab bar).

## Data model

New Supabase table `recurring_items`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | text | who created it (household data stays shared, same as `transactions`) |
| `name` | text | e.g. "Pajak Motor", "Servis Motor", "Netflix" |
| `category` | text | reuses the same category strings as `transactions` |
| `amount` | numeric | used for the reminder text and for auto-record |
| `interval_months` | int | 1 = monthly, 3/6 = service interval, 12 = yearly, any N |
| `next_due_date` | date | anchor date; advanced by `interval_months` each cycle |
| `auto_record` | boolean | true → auto-insert a transaction when due |
| `alert_offsets` | int[] | days-before-due to send a discrete alert, e.g. `{30,7,1}` |
| `daily_within_days` | int nullable | once remaining days ≤ this, alert every day (overrides offsets); `null`/`0` disables |
| `is_active` | boolean | soft-disable instead of delete |
| `last_alert_sent_at` | date nullable | dedup guard — cron only sends once per calendar day |
| `created_at` | timestamptz | |

No `due_day`/`due_month`/enum `recurrence` field — `next_due_date` alone is
the anchor, advanced by `interval_months` each cycle. Advancing clamps to
the last day of the target month when the original day-of-month doesn't
exist there (e.g. 31 Jan + 1 month → 28/29 Feb).

### Default presets on create (editable per item)

- `interval_months >= 6` (yearly tax, 6-month service): `alert_offsets=[30]`,
  `daily_within_days=7`.
- `interval_months < 6` (monthly/quarterly subscription): `alert_offsets=[7]`,
  `daily_within_days=3`.

These are just the form's initial checkbox state — fully overridable via
the checklist UI before saving.

## Escalation logic

No calendar-exact math, no fixed global curve — each item's alert schedule
is entirely user-configured via `alert_offsets` + `daily_within_days`:

```
days_until_due = next_due_date - today

send alert if:
  days_until_due IN alert_offsets
  OR (daily_within_days IS NOT NULL AND days_until_due <= daily_within_days)
AND last_alert_sent_at != today   -- idempotency guard; cron runs once/day anyway
```

Overdue (`days_until_due < 0`) items with `daily_within_days` set (the
common case) keep alerting daily until the user marks them paid or
`auto_record` fires — they don't silently stop being "due" just because the
date passed.

## Cron mechanism

- Enable `pg_cron` + `pg_net` extensions (one-time Supabase SQL, dashboard
  or migration).
- Schedule: `cron.schedule('daily-reminder-check', '0 1 * * *', ...)` — 01:00
  UTC ≈ 08:00 WIB, calls `net.http_post` against the `check-reminders` Edge
  Function URL with the service-role key.
- `check-reminders` (new Edge Function), per active row:
  1. Compute `days_until_due`.
  2. Skip if `last_alert_sent_at = today` (already handled today).
  3. If `auto_record` and `days_until_due <= 0`:
     - Insert transaction via shared helper (see below).
     - On success: advance `next_due_date` (+`interval_months`, clamped),
       reset `last_alert_sent_at = null`, send confirmation notification.
     - On failure: log error, do NOT advance (retries next day), send a
       failure alert to Telegram (financial action failing silently is
       worse than a noisy alert).
  4. Else if the alert condition above matches: send reminder
     (overdue-worded if `days_until_due < 0`), set `last_alert_sent_at = today`.

## Auto-record integration

Extract the transaction-insert logic currently inline in the
`create-transaction` Edge Function into a shared module
`supabase/functions/_shared/createTransactionRecord.ts`, imported by both
`create-transaction` and `check-reminders`. This avoids `check-reminders`
making an HTTP call back into `create-transaction` and keeps the Sheets/DB
dual-write logic in one place.

Auto-recorded row fields: `type='expense'`, `merchant=name`,
`total=amount`, `category=category`, `transaction_date=today`,
`notes='Auto-recorded from recurring: <name>'`, `source_name='recurring-auto'`.

## Notification content & delivery

Both channels reuse existing secrets/tables — no new onboarding flow:

- **Telegram**: existing `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (already
  used by `create-transaction` / `bulk-create-transactions`).
- **Expo push**: existing `push_tokens` table (already populated by
  `notificationService.ts` / `NotificationContext`) — loop all rows,
  household-shared like Telegram.

Message formats:
- Reminder: `🔔 Pajak Motor jatuh tempo 7 hari lagi (12 Sep 2026) — Rp350.000, Kendaraan`
- Overdue: `⚠️ Pajak Motor OVERDUE 3 hari! Rp350.000`
- Auto-recorded: `✅ Auto-recorded: Netflix Rp150.000`
- Auto-record failure: `❌ Gagal auto-record Netflix — cek app`

Both channel sends are non-fatal (log + skip on failure), matching the
existing `sendTelegramNotification` pattern — a delivery failure never
blocks the DB state update.

## Client service layer (`src/services/recurringItemsService.ts`, new)

```ts
fetchRecurringItems(): Promise<RecurringItem[]>
createRecurringItem(params: CreateRecurringItemParams): Promise<RecurringItem>
updateRecurringItem(id: string, updates: Partial<RecurringItem>): Promise<RecurringItem>
markRecurringItemPaid(id: string): Promise<RecurringItem>   // advances next_due_date, resets last_alert_sent_at
deleteRecurringItem(id: string): Promise<void>              // sets is_active = false
```

All direct `supabase.from('recurring_items')` calls via the shared client
(`src/lib/supabase.ts`), following the same pattern as `transactionService.ts`.

## New types (`src/types/index.ts`)

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
```

## UI

### Settings card

New card in `app/(tabs)/settings.tsx`, positioned between the Profile card
and the Budget Management card. Shows a summary ("3 aktif, 1 jatuh tempo")
and navigates via `router.push('/reminders')` — same pattern as the
existing `/chat` and `/settings` Stack screens (registered in
`app/_layout.tsx`).

### `app/reminders.tsx` (new Stack screen)

- List sorted by `next_due_date` ascending. Each card: category icon, name,
  amount, "tiap N bulan"/"tiap tahun" label, status badge:
  - 🟢 Aktif — outside any alert window
  - 🟡 Due Soon — inside `alert_offsets`/`daily_within_days` window
  - 🔴 Overdue — `days_until_due < 0`
- Screen-local FAB "+" opens the add/edit form (modal).
- Tapping a card opens a detail sheet with:
  - **Mark as Paid** — calls `markRecurringItemPaid`; primarily for
    `auto_record=false` items (vehicle tax) since those never advance
    automatically.
  - **Catat sebagai transaksi** shortcut — navigates to Add screen with
    manual-entry prefilled from this item's amount/category (reduces
    friction for the common "pay then log" flow on reminder-only items).
  - Edit, Delete (soft, `is_active=false`).

### Add/edit form

Reuses existing form primitives (`AutocompleteInput`, `DateField`):
- Name, category, amount, first due date.
- Interval chips: `1 bulan / 3 bulan / 6 bulan / 1 tahun / Custom`.
- Toggle: **Auto-record transaksi**.
- Alert checklist chips (multi-select): `H-30 / H-14 / H-7 / H-3 / H-1 / H-0`.
- Toggle **Escalate harian** + numeric stepper for `daily_within_days`.

## Error handling

- Cron re-invoked twice same day (manual retrigger) → naturally deduped by
  `last_alert_sent_at = today` check.
- Missing Telegram/push config or push token → silent no-op per channel,
  matches existing pattern; DB state still updates correctly.
- Timezone: dates are stored as plain `DATE` (no time component); cron runs
  at a fixed UTC hour approximating WIB morning. Single shared household —
  no per-user timezone handling needed.
- Deactivated items (`is_active=false`) are excluded from the cron query
  entirely — no dangling alerts.

## Out of scope (YAGNI)

- Per-user Telegram chat IDs / multi-household support (this app is a
  single shared household, matching the existing unscoped `history.tsx`
  query and single `TELEGRAM_CHAT_ID`).
- Weekly/custom cron cadence — daily is sufficient since alerts are
  day-granularity anyway.
- Partial/undo after auto-record.
- In-app unread badge on the Settings tab icon for overdue items (push +
  Telegram already cover proactive alerting; can be added later without
  touching this design).

## Testing

Manual, no automated test suite in this repo:
1. Create a yearly item (e.g. `interval_months=12`, `alert_offsets=[30]`,
   `daily_within_days=7`) with `next_due_date` 35 days out — confirm no
   alert fires until day 30, then again daily inside the last 7 days.
2. Create a monthly subscription (`interval_months=1`, `auto_record=true`)
   with `next_due_date` = today — confirm `check-reminders` inserts a
   transaction, advances `next_due_date` by 1 month, and sends the
   auto-recorded confirmation (not a due reminder).
3. Let a reminder-only item (`auto_record=false`) go overdue — confirm
   daily alerts continue past the due date until "Mark as Paid" is tapped,
   and that action advances `next_due_date` and resets alert state.
4. Re-invoke `check-reminders` twice in the same day — confirm no duplicate
   Telegram/push sends (dedup via `last_alert_sent_at`).
5. Day-of-month clamp: item due 31 Jan, `interval_months=1` — confirm
   `next_due_date` after advancing lands on 28/29 Feb, not an invalid date.
