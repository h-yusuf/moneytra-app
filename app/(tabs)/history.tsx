import { IconSymbol } from '@/components/ui/icon-symbol';
import { dummyTransactions } from '@/src/lib/dummy-data';
import { formatCurrency } from '@/src/lib/utils';
import { fetchTransactions } from '@/src/services/transactionService';
import type { Transaction } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>Transaction History</Text>
          <Text style={{ color: '#737373', fontSize: 14, marginTop: 4 }}>All your expenses and savings</Text>
        </View>
        <Pressable 
          onPress={handleRefresh}
          disabled={refreshing}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#c8f542" />
          ) : (
            <IconSymbol name="arrow.clockwise" size={20} color="#c8f542" />
          )}
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#262626', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
          <IconSymbol name="magnifyingglass" size={20} color="#737373" />
          <TextInput
            style={{ flex: 1, marginLeft: 12, fontSize: 15, color: '#ffffff' }}
            placeholder="Search transactions..."
            placeholderTextColor="#737373"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 16 }}>
        <Pressable 
          onPress={() => setActiveFilter('all')}
          style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: activeFilter === 'all' ? '#c8f542' : '#262626', marginRight: 8 }}
        >
          <Text style={{ color: activeFilter === 'all' ? '#0a0a0a' : '#a3a3a3', fontWeight: activeFilter === 'all' ? '600' : '400', fontSize: 13 }}>
            All
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveFilter('expense')}
          style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: activeFilter === 'expense' ? '#c8f542' : '#262626', marginRight: 8 }}
        >
          <Text style={{ color: activeFilter === 'expense' ? '#0a0a0a' : '#a3a3a3', fontWeight: activeFilter === 'expense' ? '600' : '400', fontSize: 13 }}>
            Expense
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => setActiveFilter('money_saving')}
          style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: activeFilter === 'money_saving' ? '#c8f542' : '#262626' }}
        >
          <Text style={{ color: activeFilter === 'money_saving' ? '#0a0a0a' : '#a3a3a3', fontWeight: activeFilter === 'money_saving' ? '600' : '400', fontSize: 13 }}>
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
            <ActivityIndicator size="large" color="#c8f542" />
            <Text style={{ color: '#737373', marginTop: 16 }}>Loading transactions...</Text>
          </View>
        ) : filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <Pressable 
              key={transaction.id} 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#262626' }}
            >
              <View 
                style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: transaction.type === 'expense' ? '#1f1f1f' : '#1a2e1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
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
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <IconSymbol name="magnifyingglass" size={28} color="#737373" />
            </View>
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 18 }}>No transactions found</Text>
            <Text style={{ color: '#737373', textAlign: 'center', marginTop: 8 }}>
              {searchQuery ? "Try a different search term" : "Start adding your first transaction!"}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
