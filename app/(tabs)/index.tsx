import { IconSymbol } from '@/components/ui/icon-symbol';
import { dummySummary, dummyTransactions } from '@/src/lib/dummy-data';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchTransactions } from '@/src/services/transactionService';
import type { MonthlyReportResponse, Transaction } from '@/src/types';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const router = useRouter();
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Auto-fetch saat navigasi ke halaman ini
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const [reportData, transactionsData] = await Promise.all([
        fetchMonthlyReport({
          user_id: 'test-user-123',
          year: currentYear,
          month: currentMonth,
        }),
        fetchTransactions({
          user_id: 'test-user-123',
          limit: 5,
        }),
      ]);

      setReport(reportData);
      setRecentTransactions(transactionsData.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setReport({
        success: true,
        user_id: 'test-user-123',
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        summary: {
          total_expense: dummySummary.total_expense,
          total_money_saving: dummySummary.total_money_saving,
          total_transactions: dummySummary.total_transactions,
        },
        monthly_report: [],
        category_breakdown: [
          {
            category: dummySummary.top_category.name,
            total: dummySummary.top_category.total,
            count: 1,
          },
        ],
      });
      setRecentTransactions(dummyTransactions.slice(0, 5));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData(true);
  };

  const totalBalance = report 
    ? report.summary.total_money_saving - report.summary.total_expense 
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: 'bold' }}>Hello, User!</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <IconSymbol name="bell.fill" size={20} color="#a3a3a3" />
            </Pressable>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#c8f542', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 16 }}>U</Text>
            </View>
          </View>
        </View>

        {/* Balance Card */}
        <View style={{ marginHorizontal: 20, marginTop: 16, borderRadius: 24, backgroundColor: '#c8f542', overflow: 'hidden' }}>
          <View style={{ padding: 20, position: 'relative' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#404040', fontWeight: '600', fontSize: 14 }}>Your Balance</Text>
              <Text style={{ color: '#525252', fontSize: 12 }}>{formattedDate}</Text>
            </View>
            
            {loading ? (
              <ActivityIndicator size="small" color="#0a0a0a" />
            ) : (
              <>
                <Text style={{ color: '#0a0a0a', fontSize: 40, fontWeight: 'bold', marginBottom: 8, marginTop: 4 }}>
                  {formatCurrency(Math.abs(totalBalance))}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconSymbol 
                    name={totalBalance >= 0 ? "arrow.up.right" : "arrow.down.right"} 
                    size={14} 
                    color={totalBalance >= 0 ? "#16a34a" : "#dc2626"} 
                  />
                  <Text style={{ color: totalBalance >= 0 ? '#15803d' : '#dc2626', fontSize: 14, marginLeft: 4, fontWeight: '500' }}>
                    {totalBalance >= 0 ? '+' : ''}{((totalBalance / (report?.summary.total_money_saving || 1)) * 100).toFixed(1)}%
                  </Text>
                </View>
              </>
            )}
            
            {/* Dotted pattern decoration */}
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, opacity: 0.15 }}>
              {[...Array(6)].map((_, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 8, paddingVertical: 6 }}>
                  {[...Array(3)].map((_, j) => (
                    <View key={j} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#0a0a0a', marginHorizontal: 3 }} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 24, paddingHorizontal: 20 }}>
          <Pressable 
            style={{ alignItems: 'center' }}
            onPress={() => router.push('/(tabs)/add')}
          >
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <IconSymbol name="arrow.down.circle.fill" size={24} color="#c8f542" />
            </View>
            <Text style={{ color: '#a3a3a3', fontSize: 11 }}>Expense</Text>
          </Pressable>
          
          <Pressable 
            style={{ alignItems: 'center' }}
            onPress={() => router.push('/(tabs)/add')}
          >
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <IconSymbol name="arrow.up.circle.fill" size={24} color="#c8f542" />
            </View>
            <Text style={{ color: '#a3a3a3', fontSize: 11 }}>Saving</Text>
          </Pressable>
          
          <Pressable style={{ alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#c8f542', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <IconSymbol name="camera.fill" size={24} color="#0a0a0a" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>Scan</Text>
          </Pressable>
        </View>

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
          <View style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: '#262626' }}>
            <Text style={{ color: '#a3a3a3', fontSize: 11, marginBottom: 8 }}>Total Expense</Text>
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>
              {loading ? '...' : formatCurrency(report?.summary.total_expense || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="arrow.down" size={10} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 11, marginLeft: 4 }}>Pengeluaran</Text>
            </View>
          </View>
          
          <View style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: '#262626' }}>
            <Text style={{ color: '#a3a3a3', fontSize: 11, marginBottom: 8 }}>Total Saving</Text>
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>
              {loading ? '...' : formatCurrency(report?.summary.total_money_saving || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="arrow.up" size={10} color="#22c55e" />
              <Text style={{ color: '#22c55e', fontSize: 11, marginLeft: 4 }}>Tabungan</Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>Recent Transactions</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable 
                onPress={handleRefresh}
                disabled={refreshing}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' }}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#c8f542" />
                ) : (
                  <IconSymbol name="arrow.clockwise" size={16} color="#c8f542" />
                )}
              </Pressable>
              <Pressable onPress={() => router.push('/(tabs)/history')}>
                <Text style={{ color: '#c8f542', fontSize: 13, fontWeight: '500' }}>See all</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#c8f542" />
            </View>
          ) : recentTransactions.length > 0 ? (
            recentTransactions.map((transaction, index) => (
              <Pressable 
                key={transaction.id} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  paddingVertical: 12,
                  borderBottomWidth: index < recentTransactions.length - 1 ? 1 : 0, 
                  borderBottomColor: '#262626' 
                }}
              >
                <View 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 16, 
                    backgroundColor: transaction.type === 'expense' ? '#1f1f1f' : '#1a2e1a',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}
                >
                  <IconSymbol 
                    name={transaction.type === 'expense' ? 'cart.fill' : 'heart.fill'} 
                    size={20} 
                    color={transaction.type === 'expense' ? '#ef4444' : '#22c55e'} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>{transaction.merchant}</Text>
                  <Text style={{ color: '#737373', fontSize: 12 }}>{transaction.category}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: transaction.type === 'expense' ? '#ef4444' : '#22c55e', fontWeight: 'bold', fontSize: 15, marginBottom: 2 }}>
                    {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.total)}
                  </Text>
                  <Text style={{ color: '#737373', fontSize: 11 }}>{transaction.transaction_date}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ color: '#737373' }}>Belum ada transaksi</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
