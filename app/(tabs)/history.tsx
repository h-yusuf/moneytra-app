import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { AppContainer } from '@/src/components/common/AppContainer';
import { TransactionCard } from '@/src/components/common/TransactionCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { dummyTransactions } from '@/src/lib/dummy-data';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = dummyTransactions.filter((transaction) =>
    transaction.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
    transaction.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (transaction.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <AppContainer scrollable>
      <View className="px-4 pt-6 pb-4">
        <Text className="text-3xl font-bold text-slate-900 mb-1">
          Riwayat Transaksi
        </Text>
        <Text className="text-base text-slate-600">
          Semua transaksi expense dan tabungan nikah
        </Text>
      </View>

      <View className="px-4 mb-4">
        <View className="flex-row items-center bg-white rounded-xl px-4 py-3 border border-slate-200">
          <IconSymbol name="magnifyingglass" size={20} color="#64748b" />
          <TextInput
            className="flex-1 ml-3 text-base text-slate-900"
            placeholder="Cari merchant, kategori, atau catatan..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View className="px-4 mb-4">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              onPress={() => {}}
            />
          ))
        ) : (
          <EmptyState
            icon="magnifyingglass"
            title="Tidak ada transaksi"
            description="Tidak ditemukan transaksi yang sesuai dengan pencarian Anda"
          />
        )}
      </View>
    </AppContainer>
  );
}
