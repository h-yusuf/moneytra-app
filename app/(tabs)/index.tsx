import { IconSymbol } from '@/components/ui/icon-symbol';
import { CHAT_SESSION_KEY, type StoredChatSession } from '@/app/chat';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { dummySummary, dummyTransactions } from '@/src/lib/dummy-data';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchTransactions } from '@/src/services/transactionService';
import type { MonthlyReportResponse, Transaction } from '@/src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { profile } = useUser();
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnreadChatReply, setHasUnreadChatReply] = useState(false);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(CHAT_SESSION_KEY)
        .then((raw) => {
          if (!raw) return setHasUnreadChatReply(false);
          const session: StoredChatSession = JSON.parse(raw);
          setHasUnreadChatReply(!!session.unreadReplyAt);
        })
        .catch(() => setHasUnreadChatReply(false));
    }, [])
  );

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour < 12) return 'Good Morning 👋';
    if (hour < 18) return 'Good Afternoon 👋';
    return 'Good Evening 👋';
  };

  const getUserInitial = () => {
    if (!profile?.name) return 'U';
    return profile.name.charAt(0).toUpperCase();
  };

  const handleNotificationPress = () => {
    // TODO: Navigate to notifications screen
    Alert.alert('Notifications', 'Notification feature coming soon!');
  };

  const handleAvatarPress = () => {
    router.push('/settings');
  };

  

  // Auto-fetch saat navigasi ke halaman ini
  useFocusEffect(
    useCallback(() => {
      if (profile?.user_id) {
        loadDashboardData();
      }
    }, [profile?.user_id])
  );

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (!profile?.user_id) {
        console.warn('User ID not set, skipping data fetch');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log('Loading dashboard data for user_id:', profile.user_id);
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const [reportData, transactionsData] = await Promise.all([
        fetchMonthlyReport({
          user_id: profile.user_id,
          year: currentYear,
        }),
        fetchTransactions({
          user_id: profile.user_id,
          limit: 5,
        }),
      ]);

      setReport(reportData);
      setRecentTransactions(transactionsData.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setReport({
        success: true,
        user_id: profile?.user_id || 'unknown',
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

  const totalTransactions = report?.summary?.total_transactions || 0;
  const savingsRate = (() => {
    const exp = report?.summary?.total_expense || 0;
    const sav = report?.summary?.total_money_saving || 0;
    const total = exp + sav;
    return total > 0 ? Math.round((sav / total) * 100) : 0;
  })();

  const handleChatPress = () => {
    router.push('/chat');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{getGreeting()}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>{formattedDate}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable 
              onPress={handleNotificationPress}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
            >
              <IconSymbol name="bell.fill" size={20} color={colors.text} />
            </Pressable>
            <Pressable 
              onPress={handleAvatarPress}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 16 }}>{getUserInitial()}</Text>
            </Pressable>
          </View>
        </View>

        {/* Year Summary Card */}
        <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: colors.primary, borderRadius: 20, padding: 20 }}>
          <View style={{ position: 'relative' }}>
            <Text style={{ color: '#0a0a0a', fontSize: 12, fontWeight: '500', opacity: 0.6, marginBottom: 4 }}>
              {currentDate.getFullYear()} Overview
            </Text>

            {loading ? (
              <ActivityIndicator size="small" color="#0a0a0a" style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
            ) : (
              <>
                <Text style={{ color: '#0a0a0a', fontSize: 32, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 }}>
                  {totalTransactions} transaksi
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: '#0a0a0a', fontSize: 12, fontWeight: '600' }}>
                      💰 Savings rate {savingsRate}%
                    </Text>
                  </View>
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
        {/* <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 24, paddingHorizontal: 20 }}>
          <Pressable 
            style={{ alignItems: 'center' }}
            onPress={() => router.push('/(tabs)/add')}
          >
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <IconSymbol name="arrow.down.circle.fill" size={24} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Expense</Text>
          </Pressable>
          
          <Pressable 
            style={{ alignItems: 'center' }}
            onPress={() => router.push('/(tabs)/add')}
          >
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <IconSymbol name="arrow.up.circle.fill" size={24} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Saving</Text>
          </Pressable>
          
          <Pressable style={{ alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <IconSymbol name="camera.fill" size={24} color="#0a0a0a" />
            </View>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>Scan</Text>
          </Pressable>
        </View> */}

        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
          <View style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: colors.card }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>Total Expense {currentDate.getFullYear()}</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>
              {loading ? '...' : formatCurrency(report?.summary?.total_expense || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="arrow.down" size={10} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 11, marginLeft: 4 }}>Pengeluaran</Text>
            </View>
          </View>
          
          <View style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: colors.card }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>Total Saving {currentDate.getFullYear()}</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>
              {loading ? '...' : formatCurrency(report?.summary?.total_money_saving || 0)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="arrow.up" size={10} color={colors.success} />
              <Text style={{ color: colors.success, fontSize: 11, marginLeft: 4 }}>Tabungan</Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Recent Transactions</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable 
                onPress={handleRefresh}
                disabled={refreshing}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <IconSymbol name="arrow.clockwise" size={16} color={colors.primary} />
                )}
              </Pressable>
              <Pressable onPress={() => router.push('/(tabs)/history')}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500' }}>See all</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : recentTransactions?.length > 0 ? (
            recentTransactions.map((transaction, index) => (
              <Pressable 
                key={`${transaction.id}-${index}`} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  paddingVertical: 12,
                  borderBottomWidth: index < recentTransactions.length - 1 ? 1 : 0, 
                  borderBottomColor: colors.border
                }}
              >
                <View 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 16, 
                    backgroundColor: transaction.type === 'expense' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}
                >
                  <IconSymbol 
                    name={transaction.type === 'expense' ? 'cart.fill' : 'heart.fill'} 
                    size={20} 
                    color={transaction.type === 'expense' ? colors.error : colors.success} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>{transaction.merchant}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{transaction.category}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: transaction.type === 'expense' ? colors.error : colors.success, fontWeight: 'bold', fontSize: 15, marginBottom: 2 }}>
                    {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.total)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{transaction.transaction_date}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Text style={{ color: colors.textTertiary }}>Belum ada transaksi</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Chat AI Floating Bubble */}
      <Pressable
        onPress={handleChatPress}
        style={{
          position: 'absolute',
          bottom: 45,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <IconSymbol name="bot.fill" size={24} color="#0a0a0a" />
        {hasUnreadChatReply && (
          <View
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.error,
              borderWidth: 2,
              borderColor: colors.background,
            }}
          />
        )}
      </Pressable>
    </SafeAreaView>
  );
}
