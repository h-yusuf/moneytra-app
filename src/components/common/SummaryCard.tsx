import React from 'react';
import { View, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  trend?: number;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

export function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  trend,
  variant = 'default' 
}: SummaryCardProps) {
  const variantStyles = {
    default: 'bg-white border-slate-200',
    primary: 'bg-gradient-to-br from-teal-500 to-emerald-600',
    success: 'bg-gradient-to-br from-green-500 to-emerald-600',
    warning: 'bg-gradient-to-br from-amber-500 to-orange-600',
  };

  const textColor = variant === 'default' ? 'text-slate-900' : 'text-white';
  const subtitleColor = variant === 'default' ? 'text-slate-600' : 'text-white/80';

  return (
    <View className={`rounded-2xl p-4 border ${variantStyles[variant]} shadow-sm`}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className={`text-sm font-medium ${subtitleColor}`}>{title}</Text>
        {icon && <IconSymbol name={icon} size={20} color={variant === 'default' ? '#64748b' : '#ffffff'} />}
      </View>
      
      <Text className={`text-2xl font-bold ${textColor} mb-1`}>{value}</Text>
      
      {(subtitle || trend !== undefined) && (
        <View className="flex-row items-center gap-2">
          {trend !== undefined && (
            <View className={`flex-row items-center ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <IconSymbol 
                name={trend >= 0 ? 'arrow.up' : 'arrow.down'} 
                size={14} 
                color={trend >= 0 ? '#16a34a' : '#dc2626'} 
              />
              <Text className={`text-xs font-semibold ml-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(trend).toFixed(1)}%
              </Text>
            </View>
          )}
          {subtitle && (
            <Text className={`text-xs ${subtitleColor}`}>{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
}
