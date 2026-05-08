# Push Notifications — Design Spec
**Date:** 2026-05-08
**Status:** Approved

## Goal

When either user (nia or yusuf) adds a transaction in Monetra, the other user's device receives a push notification — even when the app is closed or backgrounded.

## Approach

Expo Push Notifications via the Expo Push API (free, no infrastructure). Mobile only (iOS + Android). Web/PWA skipped gracefully.

## Architecture

```
FRONTEND                          BACKEND (n8n)
─────────────────────────────     ──────────────────────────────
App launch:
  request permission         →    POST /webhook/register-token
  get ExpoPushToken                 save { user_id, push_token }
  store token locally

User B creates transaction:       Existing create-transaction webhook:
  POST /webhook/extract-     →      save transaction
  transaction (existing)            query push_token WHERE user_id ≠ B
                                    POST https://exp.host/--/api/v2/push/send
                             ←        { to: tokenA,
                                        title: "{user_id} menambahkan transaksi",
                                        body: "{merchant} • {type} {amount}" }
Device A receives push:
  app closed → system notif
  app open   → in-app banner
```

## Frontend Changes

### New File: `src/services/notificationService.ts`
- `registerPushToken(userId: string, token: string): Promise<void>`
  - POST `/webhook/register-token` with `{ user_id, push_token }`
  - Idempotent — safe to call on every launch
- `getStoredPushToken(): Promise<string | null>`
  - Read from AsyncStorage key `'@push_token'`

### Updated: `src/contexts/NotificationContext.tsx`
New state:
- `pushToken: string | null`
- `isRegistered: boolean`

New function: `requestPermissionAndRegister(userId: string)`
1. Check platform — skip if web (`Platform.OS === 'web'`)
2. Check existing permission status via `Notifications.getPermissionsAsync()`
3. If not granted, call `Notifications.requestPermissionsAsync()`
4. If denied → set `notifSettings.enabled = false`, no crash
5. Call `Notifications.getExpoPushTokenAsync()` with projectId from `app.json`
6. Store token to AsyncStorage `'@push_token'`
7. Call `notificationService.registerPushToken(userId, token)`
8. Set `isRegistered = true`

Foreground handler (set once on mount):
```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: notifSettings.enabled,
    shouldPlaySound: notifSettings.soundEnabled,
    shouldSetBadge: false,
  }),
});
```

### Updated: `app/_layout.tsx`
- On mount (after user profile loads): call `requestPermissionAndRegister(profile.user_id)`
- Re-register when `profile.user_id` changes (user switches account in settings)
- Setup `Notifications.addNotificationResponseReceivedListener` — tap on notif opens app (no-op navigation, app already opens)

## Backend Changes (n8n)

### New Webhook: `POST /webhook/register-token`
Request body:
```json
{ "user_id": "yusuf", "push_token": "ExponentPushToken[xxx]" }
```
Behavior: upsert record by `user_id` — update token if exists, insert if not.

### Modified Webhook: create transaction (existing)
After saving transaction, add n8n steps:
1. Query all push tokens WHERE `user_id ≠ transaction.user_id`
2. If tokens found, POST to `https://exp.host/--/api/v2/push/send`:
```json
{
  "to": "<token>",
  "title": "<user_id> menambahkan transaksi",
  "body": "<merchant> • <type> <amount>",
  "sound": "default"
}
```
3. Errors from Expo Push API are logged, not fatal to the transaction save.

## Notification Content

| Field | Value |
|-------|-------|
| Title | `{user_id} menambahkan transaksi` |
| Body  | `{merchant} • Pengeluaran Rp {amount}` or `{merchant} • Tabungan Rp {amount}` |
| Sound | default (respects device silent mode) |
| Badge | not set |

## Constraints

- **Web/PWA:** `expo-notifications` does not support web. All notification code is gated behind `Platform.OS !== 'web'`. No crash on web.
- **Permission denied:** Settings notification toggles are disabled automatically. UI shows hint to enable in device Settings.
- **No user_id set:** Skip registration silently. Re-attempt when user_id is set.
- **Expo Go dev:** `getExpoPushTokenAsync` requires `projectId` from `app.json` (`extra.eas.projectId`). Must use physical device for testing push in dev.

## Files Summary

| File | Action |
|------|--------|
| `src/services/notificationService.ts` | Create |
| `src/contexts/NotificationContext.tsx` | Update |
| `app/_layout.tsx` | Update |
| `package.json` | Add `expo-notifications` |
| Backend n8n | Add webhook + modify existing (out of scope for frontend PR) |
