# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (Expo Go / web)
npx expo start

# Run on specific platform
npx expo start --android
npx expo start --ios
npx expo start --web

# Lint
npx expo lint

# Build web (PWA)
npm run build:web
```

No test suite is configured. There is no `test` script.

## Environment

Copy `.env.example` to `.env`. Required variables:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_URL=https://n8n.pullstack.cloud
```

All env vars must be prefixed `EXPO_PUBLIC_` to be accessible in the app.

## Architecture

**Monetra** is a React Native + Expo app for tracking personal expenses and wedding savings (*tabungan nikah*). Supabase is the primary backend (Postgres + Storage + Edge Functions). n8n (`EXPO_PUBLIC_API_URL`) is only used for the receipt OCR/AI extraction step — everything else talks to Supabase directly.

### Routing — Expo Router (file-based)

- `app/_layout.tsx` — root layout, wraps all providers, registers service worker on web
- `app/(tabs)/` — bottom tab navigator: `index` (Summary), `history`, `add`, `explore`, `settings`
- `app/modal.tsx` — modal screen

### Provider stack (top → bottom in `_layout.tsx`)

`ThemeProvider` → `UserProvider` → `BudgetProvider` → `NotificationProvider` → `AppInitializer`

`AppInitializer` is a renderless component that fires push token registration when `user_id` becomes available.

### State management

| Concern | Tool |
|---|---|
| Server data (transactions, reports) | TanStack Query — queries in screen components via `src/services/` |
| Upload/review flow state | Zustand — `src/store/useTransactionStore.ts` (holds `pendingTransaction` and `uploadResult` between Add → Review screens) |
| User profile | `UserContext` — AsyncStorage-backed, key `@monetra_user_profile` |
| Budgets | `BudgetContext` — AsyncStorage-backed, key `@budgets` |
| Push token | `NotificationContext` + `src/services/notificationService.ts` — AsyncStorage key `@push_token` |

### API layer

Almost everything goes through `src/lib/supabase.ts` (`supabase-js` client, `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`). `src/lib/api.ts` (Axios instance pointing at `EXPO_PUBLIC_API_URL`) is unused dead code — nothing imports `apiClient`; the raw n8n `fetch` call in `extractTransaction` reads `EXPO_PUBLIC_API_URL` directly instead.

| Purpose | Path |
|---|---|
| Fetch transactions / reports / suggestions | `supabase.from('transactions')` / `spending_overview` — direct client queries in `src/services/transactionService.ts` |
| Upload receipt image | `supabase.storage.from('receipts')` — resized client-side first (max 1200px, `uploadReceiptImage`) |
| Register push token | `supabase.from('push_tokens').upsert(...)` — `src/services/notificationService.ts` |
| **OCR extract (n8n)** | `POST {EXPO_PUBLIC_API_URL}/webhook/uploadDoc` — the only n8n call; image resized to max 1600px client-side first (`extractTransaction`, `transactionService.ts`) |
| Save confirmed transaction | `POST {SUPABASE_URL}/functions/v1/create-transaction` (Edge Function, dual-writes Supabase + Google Sheets) |
| AI chat assistant | `POST {SUPABASE_URL}/functions/v1/ai-chat` (Edge Function, `src/services/aiChatService.ts`) |

n8n workflows live in `doc/n8n-workflows/` for reference (not deployed from this repo). The OCR flow there is two steps, not one AI vision call: `Webhook File upload (uploadDoc)` → `Image to Text` (Tesseract OCR node, reads pixels) → text handed to a DeepSeek **text** chat completion (`Call AI DeepSeek`) that structures it into JSON. DeepSeek's API has no vision/image endpoint — don't try to send image bytes to it directly (this was tried once as a Supabase Edge Function and reverted).

`createTransaction` posts the confirmed form to the `create-transaction` Edge Function as structured JSON (not the older n8n `/webhook/extract-transaction` text-based flow).

### Styling

NativeWind (Tailwind-in-React-Native). Use `className` props throughout. Global CSS entry: `global.css`. Config: `tailwind.config.js`. Theme colors live in `src/theme/colors.ts` and are also exposed via `ThemeContext` (`useTheme().colors`) for imperative style props where `className` can't be used.

Design language: emerald/teal primary, dark-on-light cards, large radius, generous spacing.

### Key types (`src/types/index.ts`)

- `TransactionType`: `'expense' | 'money_saving'`
- `Transaction` — core data model
- `UploadResponse` — Indonesian-field-name shape (`tanggal`, `kategori`, etc.) used only by `useTransactionStore` (currently unused elsewhere). The actual OCR result type in use is `ExtractedTransactionData` (English field names: `merchant`, `total`, `category`, `transaction_date`), returned by `extractTransaction()`.
- `MonthlyReportResponse` / `CategoryBreakdownData` — dashboard chart data

### Reusable components

Common UI lives in `src/components/common/`: `AppContainer`, `SummaryCard`, `TransactionCard`, `EmptyState`, `PrimaryButton`, `SectionHeader`.

Root-level `components/` contains Expo-generated primitives (`themed-text`, `haptic-tab`, etc.) — prefer `src/components/` for new work.

## Platform notes

- **Web (PWA)**: Service worker registered in `_layout.tsx`. `build:web` runs `expo export` then `scripts/pwa-patch.js`. Deployed via Netlify (`netlify.toml`).
- **Push notifications**: `expo-notifications`. Skip on web (`Platform.OS === 'web'` guard in `NotificationContext`).
- **File upload**: Web path fetches blob URI and wraps in `File`; native path passes `{uri, type, name}` object directly to `FormData`.
