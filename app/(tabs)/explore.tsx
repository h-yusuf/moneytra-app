import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchSpendingOverview, SpendingOverviewRecord } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect, Line as SvgLine, Text as SvgText } from 'react-native-svg';

export default function ExploreScreen() {
  const { colors } = useTheme();
  const { profile } = useUser();
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [spendingData, setSpendingData] = useState<SpendingOverviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadReport();
  }, []);

  // Auto-fetch saat navigasi ke halaman ini
  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [])
  );

  // Refetch saat period berubah
  useEffect(() => {
    loadReport();
  }, [selectedPeriod]);

  const loadReport = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const currentDate = new Date();
      
      // Fetch spending overview (tanpa filter user_id untuk dapat semua user)
      const overviewParams: any = {
        year: currentDate.getFullYear(),
      };
      
      // Year view: fetch semua bulan (tanpa month filter)
      // Week/Month view: fetch bulan current saja
      if (selectedPeriod === 'week' || selectedPeriod === 'month') {
        overviewParams.month = currentDate.getMonth() + 1;
      }
      
      console.log('Fetching spending overview with params:', overviewParams);
      const overviewData = await fetchSpendingOverview(overviewParams);
      console.log('Spending overview data:', overviewData);
      setSpendingData(overviewData);
      
      // Tetap fetch monthly report untuk summary cards
      const reportParams: any = {
        year: currentDate.getFullYear(),
      };
      if (selectedPeriod === 'week' || selectedPeriod === 'month') {
        reportParams.month = currentDate.getMonth() + 1;
      }
      
      const reportData = await fetchMonthlyReport(reportParams);
      setReport(reportData);
    } catch (err) {
      console.error('Failed to load report:', err);
      setReport({
        success: true,
        user_id: profile?.user_id || 'unknown',
        year: new Date().getFullYear(),
        month: null,
        summary: {
          total_expense: 0,
          total_money_saving: 0,
          total_transactions: 0,
        },
        monthly_report: [],
        category_breakdown: [],
      });
      setSpendingData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadReport(true);
  };

  const totalSpent = report?.summary?.total_expense || 0;
  const totalSaved = report?.summary?.total_money_saving || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>Analytics</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>Track your spending patterns</Text>
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

        {/* Period Selector */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 16 }}>
          {(['week', 'month', 'year'] as const).map((period) => (
            <Pressable 
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedPeriod === period ? colors.primary : colors.card, marginRight: 8 }}
            >
              <Text style={{ color: selectedPeriod === period ? '#0a0a0a' : colors.textSecondary, fontWeight: selectedPeriod === period ? '600' : '400', fontSize: 13, textTransform: 'capitalize' }}>
                {period}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Overview Cards */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 24, gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <IconSymbol name="arrow.down" size={14} color={colors.error} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Spent</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(totalSpent)}</Text>
              </View>
              
              <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(34, 197, 94, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <IconSymbol name="arrow.up" size={14} color={colors.success} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Saved</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(totalSaved)}</Text>
              </View>
            </View>

            {/* Combined Bar + Line Chart */}
            <View style={{ marginHorizontal: 20, marginTop: 24, backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Spending Overview</Text>
                <DynamicLegend spendingData={spendingData} colors={colors} />
              </View>
              
              <CustomComboChart selectedPeriod={selectedPeriod} spendingData={spendingData} colors={colors} />
            </View>

            {/* Category Breakdown */}
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 16, fontSize: 16 }}>Category Breakdown</Text>
              
              {(report?.category_breakdown || []).slice(0, 5).map((category, index) => {
                const maxTotal = Math.max(...(report?.category_breakdown?.map(c => c.total) || [1]));
                const percentage = (category.total / maxTotal) * 100;
                const chartColors = [colors.primary, colors.success, '#3b82f6', '#f59e0b', colors.error];
                
                return (
                  <View key={category.category} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>{category.category}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{formatCurrency(category.total)}</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: colors.cardSecondary, borderRadius: 4, overflow: 'hidden' }}>
                      <View 
                        style={{ height: '100%', borderRadius: 4, width: `${percentage}%`, backgroundColor: chartColors[index % chartColors.length] }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Insights */}
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 16, fontSize: 16 }}>Insights</Text>
              
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(34, 197, 94, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <IconSymbol name="arrow.up.right" size={18} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 4 }}>Great Progress!</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 18 }}>
                      You've saved {formatCurrency(totalSaved)} this month. Keep it up!
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245, 158, 11, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <IconSymbol name="lightbulb.fill" size={18} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 4 }}>Tip</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 18 }}>
                      Your top spending category is {report?.category_breakdown?.[0]?.category || 'Food & Drinks'}. Consider setting a budget limit.
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

type DynamicLegendProps = {
  spendingData: SpendingOverviewRecord[];
  colors: ReturnType<typeof useTheme>['colors'];
};

function DynamicLegend({ spendingData, colors }: DynamicLegendProps) {
  // Ensure spendingData is array
  const safeData = Array.isArray(spendingData) ? spendingData : [];
  
  // Extract unique users
  const users = useMemo(() => {
    const allUsers = new Set<string>();
    safeData.forEach(record => {
      if (record.user_id) allUsers.add(record.user_id);
    });
    return Array.from(allUsers).sort();
  }, [safeData]);
  
  const userColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
  
  if (users.length === 0) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 10 }}>No users</Text>
      </View>
    );
  }
  
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {users.map((user_id, index) => (
        <View key={user_id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: userColors[index % userColors.length], marginRight: 4 }} />
          <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{user_id}</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 12, height: 2, backgroundColor: '#ef4444', marginRight: 4 }} />
        <Text style={{ color: colors.textTertiary, fontSize: 10 }}>Total Exp</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 12, height: 2, backgroundColor: '#10b981', marginRight: 4 }} />
        <Text style={{ color: colors.textTertiary, fontSize: 10 }}>Total Inc</Text>
      </View>
    </View>
  );
}

type ComboChartProps = {
  selectedPeriod: 'week' | 'month' | 'year';
  spendingData: SpendingOverviewRecord[];
  colors: ReturnType<typeof useTheme>['colors'];
};

type UserData = {
  user_id: string;
  expense: number;
  income: number;
};

type ChartDataPoint = {
  label: string;
  users: UserData[];
  totalExpense: number;
  totalIncome: number;
};

function CustomComboChart({ selectedPeriod, spendingData, colors }: ComboChartProps) {
  const chartWidth = Dimensions.get('window').width - 80;
  const chartHeight = 200;
  const [selectedBar, setSelectedBar] = useState<{ user: string; period: string; expense: number; income: number } | null>(null);

  // Ensure spendingData is array, fallback to empty array if not
  const safeSpendingData = useMemo(() => {
    if (Array.isArray(spendingData)) return spendingData;
    console.warn('spendingData is not array:', spendingData);
    return [];
  }, [spendingData]);

  const chartData = useMemo(() => {
    // Extract unique users dari spending data
    const allUsers = new Set<string>();
    safeSpendingData.forEach(record => {
      if (record.user_id) allUsers.add(record.user_id);
    });
    const usersList = Array.from(allUsers).sort();

    // Group data by period
    const periodMap = new Map<string, SpendingOverviewRecord[]>();
    safeSpendingData.forEach(record => {
      const key = record.period;
      if (!periodMap.has(key)) {
        periodMap.set(key, []);
      }
      periodMap.get(key)!.push(record);
    });

    const generateChartData = (labels: string[]): ChartDataPoint[] => {
      return labels.map((label, index) => {
        let periodKey = '';
        let divider = 1; // Untuk bagi rata data
        
        if (selectedPeriod === 'year') {
          // Year view: map label ke period (Jan -> 2026-01-01)
          const monthIndex = index + 1;
          const year = new Date().getFullYear();
          periodKey = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
        } else if (selectedPeriod === 'month') {
          // Month view: gunakan data bulan current, bagi 4 untuk W1-W4
          const year = new Date().getFullYear();
          const month = new Date().getMonth() + 1;
          periodKey = `${year}-${String(month).padStart(2, '0')}-01`;
          divider = 4;
        } else {
          // Week view: gunakan data bulan current, bagi 7 untuk Mon-Sun
          const year = new Date().getFullYear();
          const month = new Date().getMonth() + 1;
          periodKey = `${year}-${String(month).padStart(2, '0')}-01`;
          divider = 7;
        }

        const periodRecords = periodKey ? periodMap.get(periodKey) || [] : [];
        
        const users: UserData[] = usersList.map((user_id) => {
          const userRecord = periodRecords.find(r => r.user_id === user_id);
          return {
            user_id,
            expense: Math.round((userRecord?.total_expense || 0) / divider),
            income: Math.round((userRecord?.total_income || 0) / divider),
          };
        });
        
        const totalExpense = users.reduce((sum, u) => sum + u.expense, 0);
        const totalIncome = users.reduce((sum, u) => sum + u.income, 0);
        
        return { label, users, totalExpense, totalIncome };
      });
    };

    if (selectedPeriod === 'week') {
      return generateChartData(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    } else if (selectedPeriod === 'month') {
      return generateChartData(['W1', 'W2', 'W3', 'W4']);
    } else {
      return generateChartData(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    }
  }, [selectedPeriod, spendingData]);

  if (!chartData.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No data available</Text>
      </View>
    );
  }

  const userColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
  const numUsers = chartData[0]?.users.length || 1;
  const maxValue = Math.max(
    ...chartData.flatMap((item) => [
      item.totalExpense,
      item.totalIncome,
      ...item.users.map((u) => u.expense + u.income),
    ]),
    1
  );
  
  const periodGroupWidth = chartWidth / chartData.length;
  const barWidth = Math.min((periodGroupWidth * 0.7) / numUsers, 30);
  const barSpacing = 4;

  // Line paths untuk total expense dan total income
  const expenseLinePath = chartData
    .map((item, index) => {
      const x = periodGroupWidth * index + periodGroupWidth / 2;
      const y = chartHeight - (item.totalExpense / maxValue) * (chartHeight - 50);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const incomeLinePath = chartData
    .map((item, index) => {
      const x = periodGroupWidth * index + periodGroupWidth / 2;
      const y = chartHeight - (item.totalIncome / maxValue) * (chartHeight - 50);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <View style={{ alignItems: 'center' }}>
      {selectedBar && (
        <View style={{ marginBottom: 12, padding: 12, backgroundColor: colors.cardSecondary, borderRadius: 8 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
            {selectedBar.user} - {selectedBar.period}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Expense: {formatCurrency(selectedBar.expense)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Income: {formatCurrency(selectedBar.income)}
            </Text>
          </View>
        </View>
      )}
      <Svg width={chartWidth} height={chartHeight + 50}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <SvgLine
            key={ratio}
            x1={0}
            y1={(chartHeight - chartHeight * ratio).toFixed(2)}
            x2={chartWidth}
            y2={(chartHeight - chartHeight * ratio).toFixed(2)}
            stroke={colors.cardSecondary}
            strokeWidth={1}
            strokeDasharray="4 6"
            opacity={0.6}
          />
        ))}

        {/* Side-by-side Stacked Bars per User */}
        {chartData.map((item, periodIndex) => {
          const periodStartX = periodGroupWidth * periodIndex;
          const totalBarsWidth = (barWidth * numUsers) + (barSpacing * (numUsers - 1));
          const groupStartX = periodStartX + (periodGroupWidth - totalBarsWidth) / 2;
          
          return (
            <G key={`period-${periodIndex}`}>
              {item.users.map((user, userIndex) => {
                const barX = groupStartX + (userIndex * (barWidth + barSpacing));
                const incomeHeight = (user.income / maxValue) * (chartHeight - 50);
                const expenseHeight = (user.expense / maxValue) * (chartHeight - 50);
                
                return (
                  <G key={`user-${userIndex}`}>
                    {/* Invisible touchable area */}
                    <Rect
                      x={barX}
                      y={0}
                      width={barWidth}
                      height={chartHeight}
                      fill="transparent"
                      onPress={() => {
                        setSelectedBar({
                          user: user.user_id,
                          period: item.label,
                          expense: user.expense,
                          income: user.income,
                        });
                      }}
                    />
                    {/* Income bar (bottom) */}
                    <Rect
                      x={barX}
                      y={chartHeight - incomeHeight}
                      width={barWidth}
                      height={Math.max(incomeHeight, 2)}
                      fill={userColors[userIndex % userColors.length]}
                      opacity={0.6}
                    />
                    {/* Expense bar (top) */}
                    <Rect
                      x={barX}
                      y={chartHeight - incomeHeight - expenseHeight}
                      width={barWidth}
                      height={Math.max(expenseHeight, 2)}
                      rx={4}
                      fill={userColors[userIndex % userColors.length]}
                    />
                    {/* User ID label */}
                    <SvgText
                      x={barX + barWidth / 2}
                      y={chartHeight + 12}
                      fontSize={9}
                      fill={colors.textTertiary}
                      textAnchor="middle"
                    >
                      {user.user_id}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          );
        })}

        {/* Total Expense Line */}
        <Path d={expenseLinePath} stroke="#ef4444" strokeWidth={3} fill="none" strokeLinecap="round" />
        {chartData.map((item, index) => {
          const x = periodGroupWidth * index + periodGroupWidth / 2;
          const y = chartHeight - (item.totalExpense / maxValue) * (chartHeight - 50);
          return <Circle key={`exp-dot-${index}`} cx={x} cy={y} r={4} fill="#ef4444" />;
        })}

        {/* Total Income Line */}
        <Path d={incomeLinePath} stroke="#10b981" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="6 4" />
        {chartData.map((item, index) => {
          const x = periodGroupWidth * index + periodGroupWidth / 2;
          const y = chartHeight - (item.totalIncome / maxValue) * (chartHeight - 50);
          return <Circle key={`inc-dot-${index}`} cx={x} cy={y} r={4} fill="#10b981" />;
        })}

        {/* Period Labels */}
        {chartData.map((item, index) => {
          const x = periodGroupWidth * index + periodGroupWidth / 2;
          return (
            <SvgText
              key={`label-${index}`}
              x={x}
              y={chartHeight + 26}
              fontSize={11}
              fill={colors.text}
              textAnchor="middle"
              fontWeight="600"
            >
              {item.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
