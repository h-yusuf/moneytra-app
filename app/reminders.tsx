import { IconSymbol } from '@/components/ui/icon-symbol';
import { AutocompleteInput } from '@/src/components/common/AutocompleteInput';
import { DateField } from '@/src/components/common/DateField';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { useCategoryMerchantSuggestions } from '@/src/hooks/useCategoryMerchantSuggestions';
import { formatCurrency } from '@/src/lib/utils';
import {
  createRecurringItem,
  daysUntilDue,
  deleteRecurringItem,
  fetchRecurringItems,
  getRecurringItemStatus,
  markRecurringItemPaid,
  updateRecurringItem,
  type RecurringItemStatus,
} from '@/src/services/recurringItemsService';
import type { RecurringIntervalUnit, RecurringItem } from '@/src/types';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const INTERVAL_PRESETS: { label: string; unit: RecurringIntervalUnit; value: number }[] = [
  { label: '1 Bulan', unit: 'month', value: 1 },
  { label: '3 Bulan', unit: 'month', value: 3 },
  { label: '6 Bulan', unit: 'month', value: 6 },
  { label: '1 Tahun', unit: 'year', value: 1 },
  { label: '5 Tahun', unit: 'year', value: 5 },
];
const UNIT_LABELS: Record<RecurringIntervalUnit, string> = {
  week: 'Minggu',
  month: 'Bulan',
  year: 'Tahun',
};
const OFFSET_CHOICES = [30, 14, 7, 3, 1, 0];

const WARNING_COLOR = '#f59e0b';

const STATUS_META: Record<RecurringItemStatus, { icon: string; label: string; color: (c: any) => string }> = {
  active: { icon: 'checkmark.circle.fill', label: 'Aktif', color: c => c.success },
  due_soon: { icon: 'clock.fill', label: 'Segera', color: () => WARNING_COLOR },
  overdue: { icon: 'exclamationmark.triangle.fill', label: 'Telat', color: c => c.error },
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function humanizeDueIn(days: number): string {
  if (days < 0) return `Telat ${Math.abs(days)} hari`;
  if (days === 0) return 'Hari ini';
  if (days < 60) return `${days} hari lagi`;
  if (days < 365) return `~${Math.round(days / 30)} bulan lagi`;
  return `~${Math.round(days / 365)} tahun lagi`;
}

type FormState = {
  name: string;
  category: string;
  amount: string;
  next_due_date: string;
  interval_unit: RecurringIntervalUnit;
  interval_value: number;
  auto_record: boolean;
  alert_offsets: number[];
  daily_within_days: number | null;
};

function defaultFormState(): FormState {
  const today = new Date().toISOString().split('T')[0];
  return {
    name: '',
    category: '',
    amount: '',
    next_due_date: today,
    interval_unit: 'month',
    interval_value: 1,
    auto_record: false,
    alert_offsets: [7],
    daily_within_days: 3,
  };
}

function intervalMonthsEquivalent(unit: RecurringIntervalUnit, value: number): number {
  if (unit === 'week') return value / 4.345; // rough weeks->months for the alert-preset heuristic only
  return unit === 'year' ? value * 12 : value;
}

function applyIntervalPreset(unit: RecurringIntervalUnit, value: number): { alert_offsets: number[]; daily_within_days: number } {
  return intervalMonthsEquivalent(unit, value) >= 6
    ? { alert_offsets: [30], daily_within_days: 7 }
    : { alert_offsets: [7], daily_within_days: 3 };
}

export default function RemindersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useUser();
  const { categories: categorySuggestions } = useCategoryMerchantSuggestions();

  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState());
  const [isSaving, setIsSaving] = useState(false);

  const [selectedItem, setSelectedItem] = useState<RecurringItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchRecurringItems();
      setItems(data);
      setError(null);
    } catch (err) {
      console.error('[reminders] Failed to load:', err);
      setError('Gagal memuat reminders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreateForm = () => {
    setEditingId(null);
    setForm(defaultFormState());
    setShowForm(true);
  };

  const openEditForm = (item: RecurringItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      amount: String(item.amount),
      next_due_date: item.next_due_date,
      interval_unit: item.interval_unit,
      interval_value: item.interval_value,
      auto_record: item.auto_record,
      alert_offsets: item.alert_offsets,
      daily_within_days: item.daily_within_days,
    });
    setShowDetail(false);
    setShowForm(true);
  };

  const toggleOffset = (offset: number) => {
    setForm(prev => ({
      ...prev,
      alert_offsets: prev.alert_offsets.includes(offset)
        ? prev.alert_offsets.filter(o => o !== offset)
        : [...prev.alert_offsets, offset].sort((a, b) => b - a),
    }));
  };

  const selectIntervalPreset = (unit: RecurringIntervalUnit, value: number) => {
    setForm(prev => ({ ...prev, interval_unit: unit, interval_value: value, ...applyIntervalPreset(unit, value) }));
  };

  const handleSaveForm = async () => {
    if (!profile?.user_id) {
      Alert.alert('User ID Required', 'Please set your User ID in Settings.');
      return;
    }
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || !form.category.trim() || !amount || amount <= 0 || !form.next_due_date) {
      Alert.alert('Lengkapi data', 'Nama, kategori, nominal, dan tanggal jatuh tempo wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const params = {
        user_id: profile.user_id,
        name: form.name.trim(),
        category: form.category.trim(),
        amount,
        interval_unit: form.interval_unit,
        interval_value: form.interval_value,
        next_due_date: form.next_due_date,
        auto_record: form.auto_record,
        alert_offsets: form.alert_offsets,
        daily_within_days: form.daily_within_days,
      };
      if (editingId) {
        await updateRecurringItem(editingId, params);
      } else {
        await createRecurringItem(params);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      console.error('[reminders] Save failed:', err);
      Alert.alert('Gagal menyimpan', err?.message || 'Terjadi kesalahan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async (item: RecurringItem) => {
    try {
      await markRecurringItemPaid(item);
      setShowDetail(false);
      await load();
    } catch (err: any) {
      Alert.alert('Gagal', err?.message || 'Terjadi kesalahan.');
    }
  };

  const handleDelete = (item: RecurringItem) => {
    Alert.alert('Hapus Reminder', `Hapus "${item.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecurringItem(item.id);
            setShowDetail(false);
            await load();
          } catch (err: any) {
            Alert.alert('Gagal', err?.message || 'Terjadi kesalahan.');
          }
        },
      },
    ]);
  };

  const handleRecordAsTransaction = (item: RecurringItem) => {
    setShowDetail(false);
    router.push({
      pathname: '/(tabs)/add',
      params: {
        prefillMerchant: item.name,
        prefillCategory: item.category,
        prefillAmount: String(item.amount),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
          <IconSymbol name="chevron.left" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: 'bold', flex: 1 }}>Reminders</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}>
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
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>Belum ada reminder</Text>
            <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 8, paddingHorizontal: 24, fontSize: 13 }}>
              Tap + untuk tambah pajak, servis, atau langganan.
            </Text>
          </View>
        ) : (
          items.map(item => {
            const status = getRecurringItemStatus(item);
            const meta = STATUS_META[status];
            const statusColor = meta.color(colors);
            const days = daysUntilDue(item.next_due_date);
            const intervalLabel = item.interval_value === 1
              ? UNIT_LABELS[item.interval_unit].toLowerCase()
              : `${item.interval_value} ${UNIT_LABELS[item.interval_unit].toLowerCase()}`;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSelectedItem(item);
                  setShowDetail(true);
                }}
                style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: hexToRgba(statusColor, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <IconSymbol name={item.auto_record ? 'arrow.clockwise' : 'bell.fill'} size={20} color={statusColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 }}>{item.name}</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                          backgroundColor: hexToRgba(statusColor, 0.14),
                        }}
                      >
                        <IconSymbol name={meta.icon as any} size={11} color={statusColor} />
                        <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                      {item.category} · tiap {intervalLabel}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>{formatCurrency(item.amount)}</Text>
                      <Text style={{ color: statusColor, fontSize: 12, fontWeight: '600' }}>{humanizeDueIn(days)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Pressable
        onPress={openCreateForm}
        style={{
          position: 'absolute',
          bottom: 32,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <IconSymbol name="plus" size={28} color="#0a0a0a" />
      </Pressable>

      {/* Add/Edit Form Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowForm(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 32, maxHeight: '85%' }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              {editingId ? 'Edit Reminder' : 'Reminder Baru'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Nama</Text>
              <TextInput
                value={form.name}
                onChangeText={t => setForm(prev => ({ ...prev, name: t }))}
                placeholder="Pajak Motor, Netflix, dll"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15, marginBottom: 12 }}
              />

              <AutocompleteInput
                label="Kategori"
                value={form.category}
                onChangeText={t => setForm(prev => ({ ...prev, category: t }))}
                suggestions={categorySuggestions}
                placeholder="Kendaraan, Tagihan, dll"
              />

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Nominal (Rp)</Text>
              <TextInput
                value={form.amount}
                onChangeText={t => setForm(prev => ({ ...prev, amount: t.replace(/[^0-9]/g, '') }))}
                keyboardType="numeric"
                placeholder="350000"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15, marginBottom: 12 }}
              />

              <DateField label="Jatuh Tempo Pertama" value={form.next_due_date} onChange={v => setForm(prev => ({ ...prev, next_due_date: v }))} />

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: '600' }}>INTERVAL</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {INTERVAL_PRESETS.map(preset => {
                  const isSelected = form.interval_unit === preset.unit && form.interval_value === preset.value;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => selectIntervalPreset(preset.unit, preset.value)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isSelected ? colors.primary : colors.cardSecondary }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? '#0a0a0a' : colors.textSecondary }}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Custom: setiap</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => setForm(prev => ({ ...prev, interval_value: Math.max(1, prev.interval_value - 1) }))}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>-</Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', minWidth: 24, textAlign: 'center' }}>
                    {form.interval_value}
                  </Text>
                  <Pressable
                    onPress={() => setForm(prev => ({ ...prev, interval_value: prev.interval_value + 1 }))}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>+</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['week', 'month', 'year'] as RecurringIntervalUnit[]).map(unit => {
                    const isSelected = form.interval_unit === unit;
                    return (
                      <Pressable
                        key={unit}
                        onPress={() => setForm(prev => ({ ...prev, interval_unit: unit }))}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: isSelected ? colors.primary : colors.cardSecondary }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? '#0a0a0a' : colors.textSecondary }}>{UNIT_LABELS[unit]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Auto-record transaksi</Text>
                <Pressable
                  onPress={() => setForm(prev => ({ ...prev, auto_record: !prev.auto_record }))}
                  style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: form.auto_record ? colors.primary : colors.cardSecondary, justifyContent: 'center', paddingHorizontal: 3 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: form.auto_record ? '#0a0a0a' : colors.textTertiary, alignSelf: form.auto_record ? 'flex-end' : 'flex-start' }} />
                </Pressable>
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10, fontWeight: '600' }}>ALERT SEBELUM JATUH TEMPO</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {OFFSET_CHOICES.map(offset => {
                  const isSelected = form.alert_offsets.includes(offset);
                  return (
                    <Pressable
                      key={offset}
                      onPress={() => toggleOffset(offset)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isSelected ? colors.primary : colors.cardSecondary }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? '#0a0a0a' : colors.textSecondary }}>
                        H-{offset}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Escalate harian (hari terakhir)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={() => setForm(prev => ({ ...prev, daily_within_days: prev.daily_within_days == null ? 7 : Math.max(0, prev.daily_within_days - 1) }))}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>-</Text>
                  </Pressable>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', minWidth: 24, textAlign: 'center' }}>
                    {form.daily_within_days ?? 0}
                  </Text>
                  <Pressable
                    onPress={() => setForm(prev => ({ ...prev, daily_within_days: (prev.daily_within_days ?? 0) + 1 }))}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>+</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={handleSaveForm}
                disabled={isSaving}
                style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' }}
              >
                {isSaving ? <ActivityIndicator size="small" color="#0a0a0a" /> : (
                  <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 15 }}>Simpan</Text>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Detail Sheet Modal */}
      <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }} onPress={() => setShowDetail(false)}>
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, padding: 24 }}
          >
            {selectedItem && (
              <>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{selectedItem.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 20 }}>
                  {selectedItem.category} · {formatCurrency(selectedItem.amount)}
                </Text>

                {!selectedItem.auto_record && (
                  <Pressable
                    onPress={() => handleMarkPaid(selectedItem)}
                    style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 }}
                  >
                    <Text style={{ color: '#0a0a0a', fontWeight: '600', fontSize: 14 }}>Mark as Paid</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleRecordAsTransaction(selectedItem)}
                  style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Catat sebagai transaksi</Text>
                </Pressable>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => openEditForm(selectedItem)}
                    style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(selectedItem)}
                    style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>Hapus</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
