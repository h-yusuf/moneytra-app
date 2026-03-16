import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Transaction } from '../../types';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: () => void;
}

const categoryIcons: Record<string, string> = {
  'Makanan & Minuman': 'fork.knife',
  'Transportasi': 'car.fill',
  'Belanja': 'cart.fill',
  'Tagihan': 'doc.text.fill',
  'Kesehatan': 'cross.case.fill',
  'Hiburan': 'gamecontroller.fill',
  'Pendidikan': 'book.fill',
  'Kebutuhan Harian': 'basket.fill',
  'Tabungan': 'banknote.fill',
  'Lainnya': 'ellipsis.circle.fill',
};

export function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const isExpense = transaction.type === 'expense';
  const icon = categoryIcons[transaction.category] || 'circle.fill';
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
    }).format(d);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3 border border-slate-200 active:bg-slate-50"
    >
      <View className="flex-row items-center">
        <View className={`w-12 h-12 rounded-full items-center justify-center ${
          isExpense ? 'bg-red-100' : 'bg-green-100'
        }`}>
          <IconSymbol 
            name={icon} 
            size={24} 
            color={isExpense ? '#dc2626' : '#16a34a'} 
          />
        </View>
        
        <View className="flex-1 ml-3">
          <Text className="text-base font-semibold text-slate-900 mb-0.5">
            {transaction.merchant}
          </Text>
          <Text className="text-sm text-slate-600">
            {transaction.category} • {formatDate(transaction.transaction_date)}
          </Text>
        </View>
        
        <View className="items-end">
          <Text className={`text-base font-bold ${
            isExpense ? 'text-red-600' : 'text-green-600'
          }`}>
            {isExpense ? '-' : '+'} {formatCurrency(transaction.total)}
          </Text>
          <View className="bg-slate-100 px-2 py-0.5 rounded-full mt-1">
            <Text className="text-xs text-slate-600">{transaction.payment_method}</Text>
          </View>
        </View>
      </View>
      
      {transaction.notes && (
        <Text className="text-sm text-slate-500 mt-2 ml-15">
          {transaction.notes}
        </Text>
      )}
    </TouchableOpacity>
  );
}
