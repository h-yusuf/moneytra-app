import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';

interface DateFieldProps {
  label: string;
  value: string; // YYYY-MM-DD, same format as the rest of the app — editable as plain text too
  onChange: (value: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toYMD(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function parseYMD(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return { year: Number(y), month: Number(m) - 1, day: Number(d) };
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const selected = parseYMD(value);
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  const [viewYear, setViewYear] = useState(selected?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.month);

  const open = () => {
    setViewYear(selected?.year ?? today.year);
    setViewMonth(selected?.month ?? today.month);
    setIsOpen(true);
  };

  const changeMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 0) { nextMonth = 11; nextYear -= 1; }
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    setViewMonth(nextMonth);
    setViewYear(nextYear);
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const trailingBlanks = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(trailingBlanks).fill(null),
  ];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={{ marginBottom: 12, zIndex: isOpen ? 10 : 1 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>{label}</Text>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          style={{
            backgroundColor: colors.cardSecondary,
            borderRadius: 12,
            padding: 12,
            paddingRight: 44,
            color: colors.text,
            fontSize: 15,
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
        />
        <Pressable
          onPress={open}
          hitSlop={8}
          style={{ position: 'absolute', right: 8, padding: 8 }}
        >
          <IconSymbol name="calendar" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>

      {isOpen && (
        <View
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Pressable onPress={() => changeMonth(-1)} hitSlop={8} style={{ padding: 4 }}>
              <IconSymbol name="chevron.left" size={18} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={() => changeMonth(1)} hitSlop={8} style={{ padding: 4 }}>
              <IconSymbol name="chevron.right" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={`${label}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600' }}>{label}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={{ flexDirection: 'row' }}>
              {week.map((day, dayIndex) => {
                if (day === null) return <View key={dayIndex} style={{ flex: 1, aspectRatio: 1 }} />;
                const isSelected = !!selected && day === selected.day && viewMonth === selected.month && viewYear === selected.year;
                const isToday = day === today.day && viewMonth === today.month && viewYear === today.year;
                return (
                  <View key={dayIndex} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Pressable
                      onPress={() => {
                        onChange(toYMD(viewYear, viewMonth, day));
                        setIsOpen(false);
                      }}
                      style={{
                        width: '78%',
                        aspectRatio: 1,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderWidth: isToday && !isSelected ? 1 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#0a0a0a' : colors.text }}>
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}

          <Pressable
            onPress={() => {
              onChange(toYMD(today.year, today.month, today.day));
              setIsOpen(false);
            }}
            style={{ marginTop: 8, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Today</Text>
          </Pressable>

          <Pressable
            onPress={() => setIsOpen(false)}
            style={{ marginTop: 4, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
