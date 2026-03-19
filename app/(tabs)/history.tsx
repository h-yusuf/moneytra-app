import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { dummyTransactions } from '@/src/lib/dummy-data';
import { formatCurrency } from '@/src/lib/utils';
import { fetchTransactions } from '@/src/services/transactionService';
import type { Transaction } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { profile } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'expense' | 'money_saving'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  

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
        limit: 100,  // Get all data tanpa filter user_id
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

  const filteredTransactions = (transactions || []).filter((transaction) => {
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
              onPress={() => {
                setSelectedTransaction(transaction);
                setShowDetailModal(true);
              }}
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

      {/* Detail Transaction Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setShowDetailModal(false)}
        >
          <Pressable 
            style={{ width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, padding: 24 }}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedTransaction && (
              <>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                  <View 
                    style={{ 
                      width: 56, 
                      height: 56, 
                      borderRadius: 16, 
                      backgroundColor: selectedTransaction.type === 'expense' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      marginRight: 16 
                    }}
                  >
                    <IconSymbol 
                      name={selectedTransaction.type === 'expense' ? 'cart.fill' : 'heart.fill'} 
                      size={28} 
                      color={selectedTransaction.type === 'expense' ? colors.error : colors.success} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
                      {selectedTransaction.merchant}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                      {selectedTransaction.type === 'expense' ? 'Expense' : 'Money Saving'}
                    </Text>
                  </View>
                </View>

                {/* Amount */}
                <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Amount</Text>
                  <Text style={{ 
                    color: selectedTransaction.type === 'expense' ? colors.error : colors.success, 
                    fontSize: 36, 
                    fontWeight: 'bold' 
                  }}>
                    {selectedTransaction.type === 'expense' ? '-' : '+'}{formatCurrency(selectedTransaction.total)}
                  </Text>
                </View>

                {/* Details */}
                <View style={{ gap: 16 }}>
                  {/* Category */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Category</Text>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{selectedTransaction.category}</Text>
                  </View>

                  {/* Date */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Date</Text>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{selectedTransaction.transaction_date}</Text>
                  </View>

                  {/* Payment Method */}
                  {selectedTransaction.payment_method && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Payment Method</Text>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{selectedTransaction.payment_method}</Text>
                    </View>
                  )}

                  {/* Source */}
                  {selectedTransaction.source_name && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Source</Text>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{selectedTransaction.source_name}</Text>
                    </View>
                  )}

                  {/* User ID */}
                  {selectedTransaction.user_id && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>User ID</Text>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{selectedTransaction.user_id}</Text>
                    </View>
                  )}

                  {/* Notes */}
                  {selectedTransaction.notes && (
                    <View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 8 }}>Notes</Text>
                      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{selectedTransaction.notes}</Text>
                    </View>
                  )}
                </View>

                {/* Close Button */}
                <Pressable
                  onPress={() => setShowDetailModal(false)}
                  style={{ marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#0a0a0a', fontWeight: '600', fontSize: 15 }}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
