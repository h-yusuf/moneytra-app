import React from 'react';
import { View, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from './PrimaryButton';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon = 'tray', title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4">
        <IconSymbol name={icon} size={40} color="#94a3b8" />
      </View>
      
      <Text className="text-lg font-bold text-slate-900 text-center mb-2">
        {title}
      </Text>
      
      {description && (
        <Text className="text-sm text-slate-600 text-center mb-6 max-w-xs">
          {description}
        </Text>
      )}
      
      {action && (
        <PrimaryButton
          title={action.label}
          onPress={action.onPress}
          variant="outline"
          size="sm"
        />
      )}
    </View>
  );
}
