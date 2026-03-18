import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { dummyTransactions } from '@/src/lib/dummy-data';
import { formatCurrency } from '@/src/lib/utils';
import { fetchTransactions } from '@/src/services/transactionService';
import type { Transaction } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'expense' | 'money_saving'>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  // Auto-fetch saat navigasi ke halaman ini
  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [])
  );

  const loadTransactions = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await fetchTransactions({
        user_id: 'test-user-123',
        limit: 100,
      });
      setTransactions(response.data);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setTransactions(dummyTransactions);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadTransactions(true);
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = 
      transaction.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (transaction.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesFilter = 
      activeFilter === 'all' || transaction.type === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>Transaction History</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>All your expenses and savings</Text>
        </View>
        <Pressable 
          onPress={handleRefresh}
          disabled={refreshing}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol name="arrow.clockwise" size={20} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textTertiary} />
          <TextInput
            style={{ flex: 1, marginLeft: 12, fontSize: 15, color: colors.text }}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 16 }}>
        <Pressable 
          onPress={() => setActiveFilter('all')}
          style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: activeFilter === 'all' ? colors.primary : colors.card, marginRight: 8 }}
        >
          <Text style={{ color: activeFilter === 'all' ? '#0a0a0a' : colors.textSecondary, fontWeight: activeFilter === 'all' ? '600' : '400', fontSize: 13 }}>
            All
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveFilter('expense')}
          style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: activeFilter === 'expense' ? colors.primary : colors.card, marginRight: 8 }}
        >
          <Text style={{ color: activeFilter === 'expense' ? '#0a0a0a' : colors.textSecondary, fontWeight: activeFilter === 'expense' ? '600' : '400', fontSize: 13 }}>
            Expense
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveFilter('money_saving')}
          style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: activeFilter === 'money_saving' ? colors.primary : colors.card }}
        >
          <Text style={{ color: activeFilter === 'money_saving' ? '#0a0a0a' : colors.textSecondary, fontWeight: activeFilter === 'money_saving' ? '600' : '400', fontSize: 13 }}>
            Savings
          </Text>
        </Pressable>
      </View>

      {/* Transaction List */}
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textTertiary, marginTop: 16 }}>Loading transactions...</Text>
          </View>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <Pressable 
              key={transaction.id} 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View 
                style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: transaction.type === 'expense' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
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
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <IconSymbol name="magnifyingglass" size={28} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 18 }}>No transactions found</Text>
            <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 8 }}>
              {searchQuery ? "Try a different search term" : "Start adding your first transaction!"}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
