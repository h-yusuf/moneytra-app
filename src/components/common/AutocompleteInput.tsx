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
