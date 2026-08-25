import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
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
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNotifications();
      setItems(data);
      setError(null);
    } catch (err) {
      console.error('[notifications] Failed to load:', err);
      setError('Gagal memuat notifikasi.');
    } finally {
      setLoading(false);
    }
  }, []);

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
