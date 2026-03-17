import { IconSymbol } from '@/components/ui/icon-symbol';
import { dummySummary } from '@/src/lib/dummy-data';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const currentDate = new Date();
      const reportData = await fetchMonthlyReport({
        user_id: 'test-user-123',
        year: currentDate.getFullYear(),
      });
      setReport(reportData);
    } catch (err) {
      console.error('Failed to load report:', err);
      setReport({
        success: true,
        user_id: 'test-user-123',
        year: new Date().getFullYear(),
        month: null,
        summary: {
          total_expense: dummySummary.total_expense,
          total_money_saving: dummySummary.total_money_saving,
          total_transactions: dummySummary.total_transactions,
        },
        monthly_report: [],
        category_breakdown: [
          { category: 'Food & Drinks', total: 1500000, count: 15 },
          { category: 'Shopping', total: 800000, count: 8 },
          { category: 'Transport', total: 500000, count: 20 },
          { category: 'Entertainment', total: 300000, count: 5 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = report?.summary.total_expense || 0;
  const totalSaved = report?.summary.total_money_saving || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>Analytics</Text>
          <Text style={{ color: '#737373', fontSize: 14, marginTop: 4 }}>Track your spending patterns</Text>
        </View>

        {/* Period Selector */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 16 }}>
          {(['week', 'month', 'year'] as const).map((period) => (
            <Pressable 
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedPeriod === period ? '#c8f542' : '#262626', marginRight: 8 }}
            >
              <Text style={{ color: selectedPeriod === period ? '#0a0a0a' : '#a3a3a3', fontWeight: selectedPeriod === period ? '600' : '400', fontSize: 13, textTransform: 'capitalize' }}>
                {period}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#c8f542" />
          </View>
        ) : (
          <>
            {/* Overview Cards */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: '#262626', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(153, 27, 27, 0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <IconSymbol name="arrow.down" size={14} color="#ef4444" />
                  </View>
                  <Text style={{ color: '#a3a3a3', fontSize: 11 }}>Spent</Text>
                </View>
                <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(totalSpent)}</Text>
              </View>
              
              <View style={{ flex: 1, backgroundColor: '#262626', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(21, 128, 61, 0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <IconSymbol name="arrow.up" size={14} color="#22c55e" />
                  </View>
                  <Text style={{ color: '#a3a3a3', fontSize: 11 }}>Saved</Text>
                </View>
                <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(totalSaved)}</Text>
              </View>
            </View>

            {/* Simple Bar Chart Visualization */}
            <View style={{ marginHorizontal: 20, marginTop: 24, backgroundColor: '#262626', borderRadius: 16, padding: 20 }}>
              <Text style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: 16, fontSize: 16 }}>Spending Overview</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 128 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                  const heights = [60, 80, 45, 90, 70, 100, 55];
                  return (
                    <View key={day} style={{ alignItems: 'center', flex: 1 }}>
                      <View 
                        style={{ 
                          width: 24,
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                          height: heights[index], 
                          backgroundColor: index === 5 ? '#c8f542' : '#404040' 
                        }}
                      />
                      <Text style={{ color: '#737373', fontSize: 10, marginTop: 8 }}>{day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Category Breakdown */}
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: 16, fontSize: 16 }}>Category Breakdown</Text>
              
              {report?.category_breakdown.slice(0, 5).map((category, index) => {
                const maxTotal = Math.max(...(report?.category_breakdown.map(c => c.total) || [1]));
                const percentage = (category.total / maxTotal) * 100;
                const colors = ['#c8f542', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];
                
                return (
                  <View key={category.category} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#ffffff', fontWeight: '500', fontSize: 14 }}>{category.category}</Text>
                      <Text style={{ color: '#a3a3a3', fontSize: 13 }}>{formatCurrency(category.total)}</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                      <View 
                        style={{ height: '100%', borderRadius: 4, width: `${percentage}%`, backgroundColor: colors[index % colors.length] }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Insights */}
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: 16, fontSize: 16 }}>Insights</Text>
              
              <View style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(21, 128, 61, 0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <IconSymbol name="arrow.up.right" size={18} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 4 }}>Great Progress!</Text>
                    <Text style={{ color: '#737373', fontSize: 13, lineHeight: 18 }}>
                      You've saved {formatCurrency(totalSaved)} this month. Keep it up!
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(217, 119, 6, 0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <IconSymbol name="lightbulb.fill" size={18} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 4 }}>Tip</Text>
                    <Text style={{ color: '#737373', fontSize: 13, lineHeight: 18 }}>
                      Your top spending category is {report?.category_breakdown[0]?.category || 'Food & Drinks'}. Consider setting a budget limit.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
