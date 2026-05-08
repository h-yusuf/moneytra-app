# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When either user adds a transaction, the other user's device receives a push notification via Expo Push API — even when the app is closed.

**Architecture:** Install `expo-notifications`, extend `NotificationContext` with token registration and foreground handler, add `notificationService.ts` for backend calls, wire an `AppInitializer` component in `_layout.tsx` to register on user login. Backend must add a `register-token` webhook and trigger push from the create-transaction webhook.

**Tech Stack:** `expo-notifications`, Expo Push API (`https://exp.host/--/api/v2/push/send`), AsyncStorage, existing axios `apiClient`.

---

## File Map

| Action | File |
|--------|------|
| Create | `src/services/notificationService.ts` |
| Modify | `src/contexts/NotificationContext.tsx` |
| Modify | `app/_layout.tsx` |
| Install | `expo-notifications` package |

---

### Task 1: Install expo-notifications

**Files:**
- Modify: `package.json` (via install command)

- [ ] **Step 1: Install package**

```bash
npx expo install expo-notifications
```

Expected output: package added, `package.json` updated with `"expo-notifications"`.

- [ ] **Step 2: Verify install**

```bash
grep "expo-notifications" package.json
```

Expected: `"expo-notifications": "~0.x.x"` (version may vary)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: install expo-notifications"
```

---

### Task 2: Create notificationService.ts

**Files:**
- Create: `src/services/notificationService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/services/notificationService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/src/lib/api';

const PUSH_TOKEN_KEY = '@push_token';

export async function registerPushToken(userId: string, token: string): Promise<void> {
  await apiClient.post('/webhook/register-token', {
    user_id: userId,
    push_token: token,
  });
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "notificationService"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/services/notificationService.ts
git commit -m "feat(notifications): add notificationService with token registration"
```

---

### Task 3: Update NotificationContext with push token logic

**Files:**
- Modify: `src/contexts/NotificationContext.tsx`

The current file has: settings state, loadSettings, updateSettings. We add: `pushToken`, `isRegistered`, `requestPermissionAndRegister`, and the foreground notification handler.

- [ ] **Step 1: Replace the full file**

```typescript
// src/contexts/NotificationContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { registerPushToken, storePushToken } from '@/src/services/notificationService';

export interface NotificationSettings {
  enabled: boolean;
  budgetAlerts: boolean;
  transactionReminders: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface NotificationContextType {
  settings: NotificationSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  pushToken: string | null;
  isRegistered: boolean;
  requestPermissionAndRegister: (userId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = '@notification_settings';

const defaultSettings: NotificationSettings = {
  enabled: true,
  budgetAlerts: true,
  transactionReminders: true,
  weeklyReports: false,
  monthlyReports: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const settingsRef = useRef(settings);

  // Keep ref in sync so foreground handler always reads latest settings
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    loadSettings();
  }, []);

  // Set foreground notification handler once on mount (web skipped)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: settingsRef.current.enabled,
        shouldPlaySound: settingsRef.current.soundEnabled,
        shouldSetBadge: false,
      }),
    });
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      throw error;
    }
  };

  const requestPermissionAndRegister = async (userId: string) => {
    if (Platform.OS === 'web') return;
    if (!userId) return;

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        await updateSettings({ enabled: false });
        console.warn('Push notification permission denied');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '0f7b789b-9b59-44cd-95c0-748d0885ef39',
      });

      const token = tokenData.data;
      await storePushToken(token);
      setPushToken(token);

      await registerPushToken(userId, token);
      setIsRegistered(true);
      console.log('Push token registered:', token);
    } catch (error) {
      console.error('Push notification registration failed:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        pushToken,
        isRegistered,
        requestPermissionAndRegister,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "NotificationContext"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/contexts/NotificationContext.tsx
git commit -m "feat(notifications): add push token registration to NotificationContext"
```

---

### Task 4: Add AppInitializer to _layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

`AppInitializer` is a null-rendering component that sits inside all providers. It calls `requestPermissionAndRegister` when `profile.user_id` is first set (and again if it changes), and sets up the notification tap listener.

- [ ] **Step 1: Replace the full file**

```typescript
// app/_layout.tsx
import { BudgetProvider } from '@/src/contexts/BudgetContext';
import { useNotification, NotificationProvider } from '@/src/contexts/NotificationContext';
import { ThemeProvider, useTheme } from '@/src/contexts/ThemeContext';
import { UserProvider, useUser } from '@/src/contexts/UserContext';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Null-rendering component — registers push token when user logs in
function AppInitializer() {
  const { profile } = useUser();
  const { requestPermissionAndRegister } = useNotification();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = profile?.user_id;
    if (!userId || userId === lastUserId.current) return;
    lastUserId.current = userId;
    requestPermissionAndRegister(userId);
  }, [profile?.user_id]);

  // Handle notification tap: app opens automatically, nothing else needed
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(_response => {
      // Future: navigate to history tab
    });
    return () => sub.remove();
  }, []);

  return null;
}

function RootNavigator() {
  const { isDark } = useTheme();

  return (
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[Monetra SW] Registration failed:', err);
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <UserProvider>
        <BudgetProvider>
          <NotificationProvider>
            <AppInitializer />
            <RootNavigator />
          </NotificationProvider>
        </BudgetProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "_layout"
```

Expected: no output (no errors).

- [ ] **Step 3: Full TypeScript check**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: no output (no errors across the whole project).

- [ ] **Step 4: Commit**

```bash
git add "app/_layout.tsx"
git commit -m "feat(notifications): wire AppInitializer for push token registration on login"
```

---

### Task 5: Backend — register-token webhook (n8n)

> **Note:** This task is done in the n8n backend, not in this repo. Document here for reference.

- [ ] **Step 1: Create new n8n webhook**

Trigger: `POST /webhook/register-token`

Request body:
```json
{ "user_id": "yusuf", "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

n8n flow:
1. Webhook trigger receives body
2. Upsert to your DB/Airtable/Google Sheet: match on `user_id`, update `push_token` and `updated_at`
3. Return `200 { success: true }`

- [ ] **Step 2: Test with curl**

```bash
curl -X POST $EXPO_PUBLIC_API_URL/webhook/register-token \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","push_token":"ExponentPushToken[test123]"}'
```

Expected: `{"success":true}` or equivalent success response.

---

### Task 6: Backend — send push from create-transaction webhook (n8n)

> **Note:** This task is done in the n8n backend, not in this repo.

- [ ] **Step 1: Modify existing create-transaction n8n workflow**

After the "save transaction" step, add:

1. **Query tokens:** Fetch all rows from push token storage WHERE `user_id != transaction.user_id`
2. **HTTP Request node** for each token found:

```
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json

{
  "to": "{{ $json.push_token }}",
  "title": "{{ $json.user_id }} menambahkan transaksi",
  "body": "{{ $('Webhook').item.json.merchant }} • {{ $('Webhook').item.json.type === 'expense' ? 'Pengeluaran' : 'Tabungan' }} Rp {{ $('Webhook').item.json.total }}",
  "sound": "default"
}
```

3. **Error handling:** Log Expo API response but do NOT fail the transaction save if push fails.

- [ ] **Step 2: Test end-to-end on physical device**

1. Install app on physical Android or iOS device (push does NOT work on simulator)
2. Open app → set user_id (e.g. "nia") → permission dialog should appear → grant
3. Check n8n execution log for `register-token` webhook — should show token saved
4. On second device (or same device with user_id changed to "yusuf"), add a transaction
5. First device should receive push notification within 5 seconds

---

### Task 7: Push and verify

- [ ] **Step 1: Push frontend changes**

```bash
git push origin main
```

- [ ] **Step 2: Verify web build still works (no crash from expo-notifications on web)**

Open `http://localhost:8081` in browser → navigate all tabs → no console errors about notifications.

- [ ] **Step 3: Manual checklist**

- [ ] Permission dialog appears on first launch (physical device)
- [ ] `isRegistered = true` logged after granting permission
- [ ] Token appears in n8n register-token execution log
- [ ] Notification received on other user's device when transaction added
- [ ] Notification appears even when receiving app is backgrounded
- [ ] Declining permission → notification toggles in settings auto-disable
- [ ] Web build → no crash, no permission dialog
