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

Copy `.env.example` to `.env`. Only one required variable:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

All env vars must be prefixed `EXPO_PUBLIC_` to be accessible in the app.

## Architecture

**Monetra** is a React Native + Expo app for tracking personal expenses and wedding savings (*tabungan nikah*). It connects to a FastAPI backend (not in this repo) which handles OCR/AI extraction via n8n webhooks.

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

`src/lib/api.ts` exports a single Axios instance (`apiClient`) pointing at `EXPO_PUBLIC_API_URL`. All endpoints are n8n webhooks:

| Purpose | Endpoint |
|---|---|
| Fetch transactions | `GET /webhook/transactions` |
| Monthly report / charts | `GET /webhook/report/monthly` |
| Spending overview | `GET /webhook/report/spending-overview` |
| Upload + OCR extract | `POST /webhook/uploadDoc` |
| Save confirmed transaction | `POST /webhook/extract-transaction` |
| Register push token | `POST /webhook/register-token` |

`createTransaction` sends the confirmed form data as plain text (`text` field) to `/webhook/extract-transaction`, not the extracted JSON directly.

### Styling

NativeWind (Tailwind-in-React-Native). Use `className` props throughout. Global CSS entry: `global.css`. Config: `tailwind.config.js`. Theme colors live in `src/theme/colors.ts` and are also exposed via `ThemeContext` (`useTheme().colors`) for imperative style props where `className` can't be used.

Design language: emerald/teal primary, dark-on-light cards, large radius, generous spacing.

### Key types (`src/types/index.ts`)

- `TransactionType`: `'expense' | 'money_saving'`
- `Transaction` — core data model
- `UploadResponse` — raw AI extraction result (Indonesian field names: `tanggal`, `merchant`, `kategori`, etc.)
- `MonthlyReportResponse` / `CategoryBreakdownData` — dashboard chart data

### Reusable components

Common UI lives in `src/components/common/`: `AppContainer`, `SummaryCard`, `TransactionCard`, `EmptyState`, `PrimaryButton`, `SectionHeader`.

Root-level `components/` contains Expo-generated primitives (`themed-text`, `haptic-tab`, etc.) — prefer `src/components/` for new work.

## Platform notes

- **Web (PWA)**: Service worker registered in `_layout.tsx`. `build:web` runs `expo export` then `scripts/pwa-patch.js`. Deployed via Netlify (`netlify.toml`).
- **Push notifications**: `expo-notifications`. Skip on web (`Platform.OS === 'web'` guard in `NotificationContext`).
- **File upload**: Web path fetches blob URI and wraps in `File`; native path passes `{uri, type, name}` object directly to `FormData`.
