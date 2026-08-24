import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import type { FieldSuggestion } from '@/src/services/transactionService';
import type { ParsedTransactionDraft } from '@/src/types';
import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AutocompleteInput } from './AutocompleteInput';
import { DateField } from './DateField';

export function draftHasError(draft: ParsedTransactionDraft): boolean {
  return (
    !draft.merchant?.trim() ||
    draft.total === null ||
    draft.total <= 0 ||
    !draft.category?.trim() ||
    !draft.transaction_date?.trim()
  );
}

export function ParsedTransactionReviewList({
  drafts,
  categorySuggestions,
  merchantSuggestions,
  onChange,
  onRemove,
  onSaveAll,
  isSaving,
}: {
  drafts: ParsedTransactionDraft[];
  categorySuggestions: FieldSuggestion[];
  merchantSuggestions: FieldSuggestion[];
  onChange: (id: string, patch: Partial<ParsedTransactionDraft>) => void;
  onRemove: (id: string) => void;
  onSaveAll: () => void;
  isSaving: boolean;
}) {
  const { colors } = useTheme();
  const errorCount = drafts.filter(draftHasError).length;

  return (
    <View style={{ gap: 12 }}>
      {drafts.map((draft) => {
        const hasError = draftHasError(draft);
        return (
          <View
            key={draft.id}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: hasError ? 1 : 0,
              borderColor: colors.error,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              {hasError ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: 11, fontWeight: '600', marginLeft: 6 }}>Lengkapi data</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <IconSymbol name="checkmark.circle.fill" size={12} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 11, fontWeight: '600', marginLeft: 6 }}>Siap disimpan</Text>
                </View>
              )}
              <Pressable onPress={() => onRemove(draft.id)} hitSlop={8}>
                <IconSymbol name="trash.fill" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['expense', 'money_saving'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => onChange(draft.id, { type: t })}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: draft.type === t ? colors.primary : colors.cardSecondary,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: draft.type === t ? '#0a0a0a' : colors.textSecondary }}>
                    {t === 'expense' ? 'Expense' : 'Money Saving'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <AutocompleteInput
              label="Merchant"
              value={draft.merchant ?? ''}
              onChangeText={(text) => onChange(draft.id, { merchant: text || null })}
              suggestions={merchantSuggestions}
            />
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Amount (Rp)</Text>
              <TextInput
                value={draft.total !== null ? String(draft.total) : ''}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '');
                  onChange(draft.id, { total: digits ? parseInt(digits, 10) : null });
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }}
              />
            </View>
            <AutocompleteInput
              label="Category"
              value={draft.category ?? ''}
              onChangeText={(text) => onChange(draft.id, { category: text || null })}
              suggestions={categorySuggestions}
            />
            <DateField
              label="Date"
              value={draft.transaction_date ?? ''}
              onChange={(text) => onChange(draft.id, { transaction_date: text || null })}
            />
          </View>
        );
      })}

      <Pressable
        onPress={onSaveAll}
        disabled={isSaving || errorCount > 0 || drafts.length === 0}
        style={{
          backgroundColor: errorCount > 0 || drafts.length === 0 ? colors.cardSecondary : colors.primary,
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
        {isSaving ? (
          <>
            <ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} />
            <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Menyimpan...</Text>
          </>
        ) : (
          <Text style={{ color: errorCount > 0 || drafts.length === 0 ? colors.textTertiary : '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>
            {errorCount > 0 ? `Lengkapi ${errorCount} item dulu` : `Save All (${drafts.length})`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
