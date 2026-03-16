import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <View className="flex-1">
        <Text className="text-lg font-bold text-slate-900">{title}</Text>
        {subtitle && (
          <Text className="text-sm text-slate-600 mt-0.5">{subtitle}</Text>
        )}
      </View>
      
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text className="text-sm font-semibold text-teal-600">{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
