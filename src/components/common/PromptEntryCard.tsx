import { useTheme } from '@/src/contexts/ThemeContext';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { OcrProcessingCard } from './OcrProcessingCard';

const PROMPT_STAGES = [
  { icon: 'doc.text.viewfinder' as const, message: 'Membaca kalimat...' },
  { icon: 'sparkles' as const, message: 'Memisah transaksi...' },
  { icon: 'checklist' as const, message: 'Menyusun data...' },
];

export function PromptEntryCard({
  onParse,
  isParsing,
}: {
  onParse: (prompt: string) => Promise<void>;
  isParsing: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  if (isParsing) {
    return <OcrProcessingCard stages={PROMPT_STAGES} />;
  }

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        textAlignVertical="top"
        placeholder={'Contoh: "hari ini aku belanja roti 12k di pasar" atau "hari ini belanja 12k dan kemarin belanja 10k di indomaret"'}
        placeholderTextColor={colors.textTertiary}
        style={{
          backgroundColor: colors.cardSecondary,
          borderRadius: 12,
          padding: 12,
          color: colors.text,
          fontSize: 15,
          minHeight: 100,
          marginBottom: 12,
        }}
      />
      <Pressable
        onPress={() => onParse(text)}
        disabled={!text.trim()}
        style={{
          backgroundColor: text.trim() ? colors.primary : colors.cardSecondary,
          borderRadius: 12,
          padding: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: text.trim() ? '#0a0a0a' : colors.textTertiary, fontWeight: 'bold', fontSize: 14 }}>
          Parse dengan AI
        </Text>
      </Pressable>
    </View>
  );
}
