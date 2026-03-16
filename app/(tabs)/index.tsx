import { AppContainer } from '@/src/components/common/AppContainer';
import { SectionHeader } from '@/src/components/common/SectionHeader';
import { SummaryCard } from '@/src/components/common/SummaryCard';
import { TransactionCard } from '@/src/components/common/TransactionCard';
import { dummySummary, dummyTransactions } from '@/src/lib/dummy-data';
import { formatCurrency, getGreeting } from '@/src/lib/utils';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();

  return (
    <AppContainer scrollable>
      <View className="px-4 pt-6 pb-4">
        <Text className="text-3xl font-bold text-slate-900 mb-1">
          {getGreeting()}
        </Text>
        <Text className="text-base text-slate-600">
          Kelola keuangan dan tabungan nikah Anda
        </Text>
      </View>

      <View className="px-4 mb-6">
        <View className="mb-3">
          <SummaryCard
            title="Total Expense Bulan Ini"
            value={formatCurrency(dummySummary.total_expense)}
            trend={dummySummary.expense_growth}
            subtitle="vs bulan lalu"
            icon="arrow.down.circle.fill"
            variant="default"
          />
        </View>
        
        <View className="mb-3">
          <SummaryCard
            title="Tabungan Nikah Bulan Ini"
            value={formatCurrency(dummySummary.total_wedding_savings)}
            trend={dummySummary.savings_growth}
            subtitle="vs bulan lalu"
            icon="heart.circle.fill"
            variant="primary"
          />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <SummaryCard
              title="Total Transaksi"
              value={dummySummary.total_transactions.toString()}
              subtitle="bulan ini"
              icon="list.bullet"
            />
          </View>
          <View className="flex-1">
            <SummaryCard
              title="Top Kategori"
              value={dummySummary.top_category.name}
              subtitle={formatCurrency(dummySummary.top_category.total)}
              icon="chart.pie.fill"
            />
          </View>
        </View>
      </View>

      <View className="px-4 mb-4">
        <SectionHeader
          title="Transaksi Terbaru"
          subtitle="5 transaksi terakhir"
          action={{
            label: 'Lihat Semua',
            onPress: () => router.push('/(tabs)/history'),
          }}
        />
        
        {dummyTransactions.slice(0, 5).map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            onPress={() => {}}
          />
        ))}
      </View>
    </AppContainer>
  );
}
