import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';

interface DateFieldProps {
  label: string;
  value: string; // YYYY-MM-DD, same format as the rest of the app
  onChange: (value: string) => void;
}

function toYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseYMD(value: string): Date {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const fieldStyle = {
    backgroundColor: colors.cardSecondary,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    fontSize: 15,
  };

  if (Platform.OS === 'web') {
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>{label}</Text>
        {React.createElement('input', {
          type: 'date',
          value,
          onChange: (e: any) => onChange(e.target.value),
          style: { ...fieldStyle, border: 'none', width: '100%', fontFamily: 'inherit' },
        })}
      </View>
    );
  }

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) onChange(toYMD(selectedDate));
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>{label}</Text>
      <Pressable onPress={() => setShowPicker(true)} style={fieldStyle}>
        <Text style={{ color: value ? colors.text : colors.textTertiary, fontSize: 15 }}>
          {value || 'YYYY-MM-DD'}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker value={parseYMD(value)} mode="date" display="default" onChange={handleChange} />
      )}
    </View>
  );
}
