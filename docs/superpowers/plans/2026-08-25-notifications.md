# In-App Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generic, flexible in-app notification inbox (`type` + `content jsonb`) surfaced via the Dashboard bell icon, with `check-reminders` as the first writer so reminder/overdue/auto-record events show up in-app, not just Telegram/push.

**Architecture:** One new table (`notifications`), `check-reminders` gains a fourth delivery channel (insert a row) alongside Telegram/Expo push, a new client service layer, and a new `/notifications` Stack screen. The Dashboard bell icon (currently a "coming soon" alert) becomes the entry point, with an unread-count red dot matching the existing chat-unread badge pattern.

**Tech Stack:** React Native + Expo (TypeScript), Supabase (Postgres, Edge Functions on Deno).

**Design discussed in chat** (no separate spec doc — small, closely mirrors the just-built `docs/superpowers/plans/2026-08-25-recurring-reminders.md` pattern).

## Global Constraints

- `type` is a free-form `text` column, `content` is `jsonb` — no rigid per-type schema in the database. This plan documents (not enforces) the `content` shape for `type = 'recurring_reminder'`; future notification sources can invent their own `type` + `content` shape without a migration.
- No RLS scoping beyond what `transactions`/`recurring_items` already have (single shared household, no Supabase Auth).
- Deployed to the **staging** Supabase project (`xslstofngselbphqctfl`, "Monetra") — same project as the Reminders feature. Do not touch the CLI's default-linked prod project (`hzhnvlaudcjntkiqctrs`).
- Follow existing code style: inline `style={{...}}` objects, `useTheme().colors` tokens, `IconSymbol` for icons — matching `app/reminders.tsx`'s just-built visual language (tinted icon-circle, pill status/kind badge).
- No automated test suite — every "test" step is manual (curl, `npx tsc --noEmit`, SQL query, or in-app check).

---

### Task 1: Database — `notifications` table

> Manual step via `supabase db query --linked --file <path>` against the staging project (already linked from the Reminders work).

**Files:** None (SQL run directly against Supabase)

- [ ] **Step 1: Run the migration**

```sql
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  content jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;
```

- [ ] **Step 2: Verify**

```sql
select column_name, data_type from information_schema.columns
where table_name = 'notifications' order by ordinal_position;
-- 6 rows: id, user_id, type, content, read_at, created_at

select * from public.notifications;
-- 0 rows, no error
```

No git commit for this task (dashboard/CLI-only DB change).

---

### Task 2: `AppNotification` type

**Files:**
- Modify: `src/types/index.ts` (append at EOF)

**Interfaces:**
- Produces: `AppNotification`, `RecurringReminderNotificationContent` — consumed by Tasks 4, 6.

- [ ] **Step 1: Append the types**

```ts

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  content: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// Documented (not enforced) `content` shape when `type === 'recurring_reminder'`.
export interface RecurringReminderNotificationContent {
  title: string;
  body: string;
  kind: 'reminder' | 'overdue' | 'auto_recorded' | 'auto_record_failed';
  recurring_item_id: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "src/types/index.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add AppNotification type"
```

---

### Task 3: `check-reminders` writes notification rows

**Files:**
- Modify: `supabase/functions/check-reminders/index.ts`

**Interfaces:**
- Produces: a `notifications` row (`type='recurring_reminder'`) per Telegram send, inserted right alongside the existing `sendTelegram`/`sendExpoPush` calls.

This is the only writer for now — no other event source is wired in this plan.

- [ ] **Step 1: Add an `insertNotification` helper**

Add near the other notification-delivery functions (after `sendExpoPush`):

```ts
async function insertNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  content: {
    title: string;
    body: string;
    kind: 'reminder' | 'overdue' | 'auto_recorded' | 'auto_record_failed';
    recurring_item_id: string;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type: 'recurring_reminder',
      content,
    });
    if (error) console.error('Notification insert failed (non-fatal):', error.message);
  } catch (err) {
    console.error('Notification insert failed (non-fatal):', err);
  }
}
```

- [ ] **Step 2: Call it from the auto-record success path**

Find (inside the `if (item.auto_record && daysUntilDue <= 0)` block, success case):

```ts
        const text = buildAutoRecordedMessage(item, today);
        await sendTelegram(text);
        await sendExpoPush(supabase, 'Auto-recorded', `${item.name} Rp${formatRupiah(item.amount)}`);
```

Change to:

```ts
        const text = buildAutoRecordedMessage(item, today);
        await sendTelegram(text);
        await sendExpoPush(supabase, 'Auto-recorded', `${item.name} Rp${formatRupiah(item.amount)}`);
        await insertNotification(supabase, item.user_id, {
          title: `✅ Auto-recorded: ${item.name}`,
          body: `Rp${formatRupiah(item.amount)} tercatat otomatis.`,
          kind: 'auto_recorded',
          recurring_item_id: item.id,
        });
```

- [ ] **Step 3: Call it from the auto-record failure path**

Find:

```ts
      } catch (err) {
        console.error(`Auto-record failed for ${item.name} (non-fatal):`, err);
        await sendTelegram(buildAutoRecordFailedMessage(item));
      }
```

Change to:

```ts
      } catch (err) {
        console.error(`Auto-record failed for ${item.name} (non-fatal):`, err);
        await sendTelegram(buildAutoRecordFailedMessage(item));
        await insertNotification(supabase, item.user_id, {
          title: `❌ Auto-record Gagal: ${item.name}`,
          body: 'Cek app untuk detail.',
          kind: 'auto_record_failed',
          recurring_item_id: item.id,
        });
      }
```

- [ ] **Step 4: Call it from the reminder/overdue path**

Find:

```ts
    if (shouldAlert(daysUntilDue, item, today)) {
      const text = buildReminderMessage(item, daysUntilDue);
      const pushBody = daysUntilDue < 0
        ? `${item.name} terlambat ${Math.abs(daysUntilDue)} hari — Rp${formatRupiah(item.amount)}`
        : daysUntilDue === 0
          ? `${item.name} jatuh tempo hari ini — Rp${formatRupiah(item.amount)}`
          : `${item.name} jatuh tempo ${daysUntilDue} hari lagi — Rp${formatRupiah(item.amount)}`;

      await sendTelegram(text);
      await sendExpoPush(supabase, 'Reminder', pushBody);
```

Change to:

```ts
    if (shouldAlert(daysUntilDue, item, today)) {
      const text = buildReminderMessage(item, daysUntilDue);
      const pushBody = daysUntilDue < 0
        ? `${item.name} terlambat ${Math.abs(daysUntilDue)} hari — Rp${formatRupiah(item.amount)}`
        : daysUntilDue === 0
          ? `${item.name} jatuh tempo hari ini — Rp${formatRupiah(item.amount)}`
          : `${item.name} jatuh tempo ${daysUntilDue} hari lagi — Rp${formatRupiah(item.amount)}`;

      await sendTelegram(text);
      await sendExpoPush(supabase, 'Reminder', pushBody);
      await insertNotification(supabase, item.user_id, {
        title: daysUntilDue < 0 ? `⚠️ Overdue: ${item.name}` : `🔔 Reminder: ${item.name}`,
        body: pushBody,
        kind: daysUntilDue < 0 ? 'overdue' : 'reminder',
        recurring_item_id: item.id,
      });
```

- [ ] **Step 5: Deploy**

Run: `supabase functions deploy check-reminders --no-verify-jwt`

- [ ] **Step 6: Verify**

Insert a test recurring item due today (reminder-only), trigger via `CRON_SECRET=... ./scripts/trigger-check-reminders.sh`, then:

```sql
select type, content, read_at from public.notifications order by created_at desc limit 1;
```

Expected: one row, `type='recurring_reminder'`, `content->>'kind' = 'reminder'`, `read_at` is null. Clean up the test recurring item afterward.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/check-reminders/index.ts
git commit -m "feat: write notifications row on every reminder/auto-record event"
```

---

### Task 4: Client service layer

**Files:**
- Create: `src/services/notificationsService.ts`

**Interfaces:**
- Consumes: `supabase` client, `AppNotification` type (Task 2).
- Produces: `fetchNotifications`, `markNotificationRead`, `countUnreadNotifications` — consumed by Tasks 5, 6.

- [ ] **Step 1: Write the service module**

```ts
import { supabase } from '@/src/lib/supabase';
import type { AppNotification } from '@/src/types';

export async function fetchNotifications(userId?: string): Promise<AppNotification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function countUnreadNotifications(userId?: string): Promise<number> {
  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (userId) query = query.eq('user_id', userId);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "notificationsService"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/services/notificationsService.ts
git commit -m "feat: add notificationsService client layer"
```

---

### Task 5: Dashboard bell icon wiring

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `countUnreadNotifications` (Task 4).
- Produces: navigation to `/notifications` (Task 6 must create this route for the app to have somewhere to go).

- [ ] **Step 1: Import the service and add unread-count state**

Add to the imports:

```ts
import { countUnreadNotifications } from '@/src/services/notificationsService';
```

Add state near `hasUnreadChatReply`:

```ts
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
```

- [ ] **Step 2: Poll unread count on focus**

Add a `useFocusEffect` alongside the existing chat-unread one (same interval-while-focused pattern):

```ts
  useFocusEffect(
    useCallback(() => {
      const checkUnreadNotifications = () => {
        countUnreadNotifications(profile?.user_id)
          .then(count => setHasUnreadNotifications(count > 0))
          .catch(() => setHasUnreadNotifications(false));
      };
      checkUnreadNotifications();
      const interval = setInterval(checkUnreadNotifications, 5000);
      return () => clearInterval(interval);
    }, [profile?.user_id])
  );
```

- [ ] **Step 3: Replace the "coming soon" handler**

Find:

```ts
  const handleNotificationPress = () => {
    // TODO: Navigate to notifications screen
    Alert.alert('Notifications', 'Notification feature coming soon!');
  };
```

Change to:

```ts
  const handleNotificationPress = () => {
    router.push('/notifications');
  };
```

- [ ] **Step 4: Add the unread red-dot badge**

Find the bell `Pressable` (in the header row):

```tsx
            <Pressable 
              onPress={handleNotificationPress}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
            >
              <IconSymbol name="bell.fill" size={20} color={colors.text} />
            </Pressable>
```

Change to (adds `position: 'relative'` and the same dot style already used for the chat FAB's unread badge):

```tsx
            <Pressable 
              onPress={handleNotificationPress}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12, position: 'relative' }}
            >
              <IconSymbol name="bell.fill" size={20} color={colors.text} />
              {hasUnreadNotifications && (
                <View
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.error,
                    borderWidth: 2,
                    borderColor: colors.background,
                  }}
                />
              )}
            </Pressable>
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "(tabs)/index.tsx"`
Expected: only a "Cannot find module '/notifications'" typed-route error, which resolves once Task 6 creates the screen — no other errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: wire Dashboard bell icon to /notifications with unread badge"
```

---

### Task 6: `/notifications` screen

**Files:**
- Create: `app/notifications.tsx`
- Modify: `app/_layout.tsx` (register the Stack screen)

**Interfaces:**
- Consumes: `fetchNotifications`, `markNotificationRead` (Task 4); `AppNotification` (Task 2).
- Produces: the `/notifications` route Task 5 navigates to.

- [ ] **Step 1: Register the route**

In `app/_layout.tsx`, change:

```tsx
        <Stack.Screen name="chat" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="reminders" options={{ headerShown: false, presentation: 'card' }} />
```

to:

```tsx
        <Stack.Screen name="chat" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="reminders" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, presentation: 'card' }} />
```

- [ ] **Step 2: Write the screen**

Create `app/notifications.tsx`. Visual language matches `app/reminders.tsx`'s just-redesigned list (tinted icon-circle keyed by `content.kind`, unread rows get a subtle highlight instead of a separate badge column since the whole row states its own read state):

```tsx
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { fetchNotifications, markNotificationRead } from '@/src/services/notificationsService';
import type { AppNotification, RecurringReminderNotificationContent } from '@/src/types';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const KIND_ICON: Record<string, string> = {
  reminder: 'bell.fill',
  overdue: 'exclamationmark.triangle.fill',
  auto_recorded: 'checkmark.circle.fill',
  auto_record_failed: 'xmark.circle.fill',
};

const KIND_COLOR: Record<string, (c: any) => string> = {
  reminder: c => c.primary,
  overdue: c => c.error,
  auto_recorded: c => c.success,
  auto_record_failed: c => c.error,
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useUser();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNotifications(profile?.user_id);
      setItems(data);
      setError(null);
    } catch (err) {
      console.error('[notifications] Failed to load:', err);
      setError('Gagal memuat notifikasi.');
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePress = async (item: AppNotification) => {
    if (!item.read_at) {
      setItems(prev => prev.map(n => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
      markNotificationRead(item.id).catch(() => {});
    }
    if (item.type === 'recurring_reminder') {
      const content = item.content as unknown as RecurringReminderNotificationContent;
      if (content.recurring_item_id) router.push('/reminders');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
          <IconSymbol name="chevron.left" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: 'bold', flex: 1 }}>Notifications</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
        {error && !loading && (
          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ paddingVertical: 64, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <IconSymbol name="bell.fill" size={28} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>Belum ada notifikasi</Text>
            <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 8, paddingHorizontal: 24, fontSize: 13 }}>
              Reminder dan event lain bakal muncul di sini.
            </Text>
          </View>
        ) : (
          items.map(item => {
            const content = item.content as { title?: string; body?: string; kind?: string };
            const kind = content.kind ?? 'reminder';
            const icon = KIND_ICON[kind] ?? 'bell.fill';
            const color = (KIND_COLOR[kind] ?? (c => c.primary))(colors);
            const isUnread = !item.read_at;
            return (
              <Pressable
                key={item.id}
                onPress={() => handlePress(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: isUnread ? hexToRgba(color, 0.06) : colors.card,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: isUnread ? 1 : 0,
                  borderColor: hexToRgba(color, 0.3),
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    backgroundColor: hexToRgba(color, 0.14),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <IconSymbol name={icon as any} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: isUnread ? '700' : '600' }}>
                    {content.title ?? 'Notifikasi'}
                  </Text>
                  {!!content.body && (
                    <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4 }}>{content.body}</Text>
                  )}
                  <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6 }}>{timeAgo(item.created_at)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "notifications.tsx|_layout.tsx|\(tabs\)/index.tsx"`
Expected: no output.

- [ ] **Step 4: Manual UI check**

`npx expo start --web`, tap the Dashboard bell icon — confirm it opens `/notifications`, shows the notification row(s) from Task 3's test, tapping one clears the unread highlight and (for `recurring_reminder` type) navigates to `/reminders`. Confirm the Dashboard bell's red dot disappears once all notifications are read.

- [ ] **Step 5: Commit**

```bash
git add app/notifications.tsx app/_layout.tsx
git commit -m "feat: add Notifications screen"
```

---

### Task 7: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Full pipeline** — create a reminder-only test item due today, trigger `check-reminders`, confirm all four channels fire: Telegram message, `recurring_items.last_alert_sent_at` updated, `notifications` row inserted with `read_at = null`, and (once app is open) the Dashboard bell shows the red dot.
- [ ] **Step 2: Mark-as-read flow** — open `/notifications`, tap the new row, confirm `read_at` gets set in the DB (`select read_at from notifications order by created_at desc limit 1;`) and the Dashboard bell's red dot disappears on next focus.
- [ ] **Step 3: Auto-record path** — create an `auto_record=true` test item due today, trigger, confirm a `kind='auto_recorded'` notification appears alongside the Telegram confirmation and the new transaction row.
- [ ] **Step 4: Clean up test data** — delete any test rows created above from both `recurring_items` and `notifications`.

No commit for this task — verification only.
