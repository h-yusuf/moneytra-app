import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchSpendingOverview, FetchSpendingOverviewParams, SpendingOverviewRecord } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Line as SvgLine, Text as SvgText } from 'react-native-svg';

const COUPLE_COLORS = ['#FF6B8A', '#4ECDC4'] as const;
const COUPLE_COLORS_DIM = ['rgba(255,107,138,0.12)', 'rgba(78,205,196,0.12)'] as const;

type UserStat = {
  user_id: string;
  totalExpense: number;
  totalIncome: number;
  color: string;
  colorDim: string;
};

export default function ExploreScreen() {
  const { colors } = useTheme();
  const { profile } = useUser();
  const [report, setReport] = useState<MonthlyReportResponse | null>(null);
  const [spendingData, setSpendingData] = useState<SpendingOverviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showFilterModal, setShowFilterModal] = useState(false);

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const periodLabel = useMemo(() => {
    if (selectedPeriod === 'year') return `Year ${selectedYear}`;
    return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  }, [selectedPeriod, selectedMonth, selectedYear]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [selectedPeriod, selectedMonth, selectedYear])
  );

  const loadReport = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const params: FetchSpendingOverviewParams = {
        year: selectedYear,
        period: selectedPeriod,
      };
      if (selectedPeriod !== 'year') params.month = selectedMonth;
      const [overviewData, reportData] = await Promise.all([
        fetchSpendingOverview(params),
        fetchMonthlyReport(params),
      ]);
      setSpendingData(overviewData);
      setReport(reportData);
    } catch (err) {
      console.error('Failed to load report:', err);
      setReport({
        success: true,
        user_id: profile?.user_id || 'unknown',
        year: new Date().getFullYear(),
        month: null,
        summary: { total_expense: 0, total_money_saving: 0, total_transactions: 0 },
        monthly_report: [],
        category_breakdown: [],
      });
      setSpendingData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const userStats = useMemo((): UserStat[] => {
    const safeData = Array.isArray(spendingData) ? spendingData : [];
    const userMap = new Map<string, { totalExpense: number; totalIncome: number }>();
    safeData.forEach(record => {
      const prev = userMap.get(record.user_id) || { totalExpense: 0, totalIncome: 0 };
      userMap.set(record.user_id, {
        totalExpense: prev.totalExpense + (record.total_expense || 0),
        totalIncome: prev.totalIncome + (record.total_income || 0),
      });
    });
    return Array.from(userMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 2)
      .map(([user_id, stats], index) => ({
        user_id,
        ...stats,
        color: COUPLE_COLORS[index % COUPLE_COLORS.length],
        colorDim: COUPLE_COLORS_DIM[index % COUPLE_COLORS_DIM.length],
      }));
  }, [spendingData]);

  // Derive totals from spendingData so the ring matches the selected period
  // (week/month/year) rather than only the report's monthly summary.
  const totalSpent = userStats.reduce((s, u) => s + u.totalExpense, 0);
  const totalSaved = userStats.reduce((s, u) => s + u.totalIncome, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COUPLE_COLORS[0], marginRight: 5 }} />
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COUPLE_COLORS[1], marginRight: 8 }} />
              <Text style={{ color: colors.textTertiary, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Couple Finance</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Analytics</Text>
          </View>
          <Pressable
            onPress={() => loadReport(true)}
            disabled={refreshing}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol name="arrow.clockwise" size={17} color={colors.textTertiary} />
            )}
          </Pressable>
        </View>

        {/* Filter Button */}
        <View style={{ paddingHorizontal: 20, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(['week', 'month', 'year'] as const).map((period) => (
            <Pressable
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
                backgroundColor: selectedPeriod === period ? colors.primary : 'transparent',
                borderWidth: 1,
                borderColor: selectedPeriod === period ? colors.primary : colors.border,
              }}
            >
              <Text style={{
                color: selectedPeriod === period ? colors.background : colors.textTertiary,
                fontWeight: selectedPeriod === period ? '700' : '400',
                fontSize: 12, textTransform: 'capitalize',
              }}>
                {period}
              </Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => setShowFilterModal(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: colors.card, borderRadius: 100,
              paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.border,
            }}
          >
            <IconSymbol name="calendar" size={14} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{periodLabel}</Text>
            <IconSymbol name="arrow.down" size={10} color={colors.textTertiary} />
          </Pressable>
        </View>

        {/* Filter Modal */}
        <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowFilterModal(false)}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 36, maxHeight: '82%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Filter Period</Text>
                <Pressable onPress={() => setShowFilterModal(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}>
                  <IconSymbol name="xmark" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Period type */}
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10, letterSpacing: 0.5 }}>PERIOD</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
                  {(['week', 'month', 'year'] as const).map((period) => {
                    const isActive = selectedPeriod === period;
                    return (
                      <Pressable
                        key={period}
                        onPress={() => setSelectedPeriod(period)}
                        style={{
                          flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                          backgroundColor: isActive ? colors.primary : colors.cardSecondary,
                          borderWidth: 1, borderColor: isActive ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ color: isActive ? colors.background : colors.textSecondary, fontWeight: isActive ? '700' : '500', fontSize: 13, textTransform: 'capitalize' }}>{period}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Month — hidden for year view */}
                {selectedPeriod !== 'year' && (
                  <>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10, letterSpacing: 0.5 }}>MONTH</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                      {MONTH_NAMES.map((name, idx) => {
                        const isActive = selectedMonth === idx + 1;
                        return (
                          <Pressable
                            key={name}
                            onPress={() => setSelectedMonth(idx + 1)}
                            style={{
                              paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                              backgroundColor: isActive ? colors.primary : colors.cardSecondary,
                              borderWidth: 1, borderColor: isActive ? colors.primary : colors.border,
                            }}
                          >
                            <Text style={{ color: isActive ? colors.background : colors.textSecondary, fontSize: 13, fontWeight: isActive ? '700' : '500' }}>{name.slice(0, 3)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* Year */}
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 10, letterSpacing: 0.5 }}>YEAR</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((year) => {
                    const isActive = selectedYear === year;
                    return (
                      <Pressable
                        key={year}
                        onPress={() => setSelectedYear(year)}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                          backgroundColor: isActive ? colors.primary : colors.cardSecondary,
                          borderWidth: 1, borderColor: isActive ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{ color: isActive ? colors.background : colors.textSecondary, fontSize: 13, fontWeight: isActive ? '700' : '500' }}>{year}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <Pressable
                  onPress={() => {
                    const now = new Date();
                    setSelectedPeriod('month');
                    setSelectedMonth(now.getMonth() + 1);
                    setSelectedYear(now.getFullYear());
                  }}
                  style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Reset</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowFilterModal(false)}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.background, fontWeight: 'bold', fontSize: 14 }}>Apply</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textTertiary, marginTop: 12, fontSize: 13 }}>Loading couple data...</Text>
          </View>
        ) : (
          <>
            {/* Couple Balance Ring */}
            <View style={{ alignItems: 'center', marginTop: 28, marginBottom: 4 }}>
              <CoupleBalanceRing userStats={userStats} totalSpent={totalSpent} totalSaved={totalSaved} />
            </View>

            {/* User Stat Cards */}
            {userStats.length > 0 && (
              <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, gap: 10 }}>
                {userStats.map((user) => (
                  <UserStatCard key={user.user_id} user={user} />
                ))}
              </View>
            )}

            {/* Spending Battle Bar */}
            {userStats.length === 2 && <SpendingBattleBar userStats={userStats} />}

            {/* Spending Overview Chart */}
            <View style={{ marginHorizontal: 20, marginTop: 20, backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Spending Overview</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2, marginBottom: 14 }}>
                {selectedPeriod === 'week' ? 'Daily this week' : selectedPeriod === 'month' ? 'Weekly this month' : 'Monthly this year'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {userStats.map(user => (
                  <View key={user.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: user.color }} />
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{user.user_id}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 14, height: 2, backgroundColor: colors.error, borderRadius: 1 }} />
                  <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Expense</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 14, height: 2, backgroundColor: colors.success, borderRadius: 1 }} />
                  <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Income</Text>
                </View>
              </View>
              <ImprovedComboChart
                selectedPeriod={selectedPeriod}
                spendingData={Array.isArray(spendingData) ? spendingData : []}
                userStats={userStats}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            </View>

            {/* Category Breakdown */}
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Categories</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2, marginBottom: 16 }}>Combined spending breakdown</Text>
              {(report?.category_breakdown || []).slice(0, 6).map((cat, index) => {
                const maxTotal = Math.max(...(report?.category_breakdown?.map(c => c.total) || [1]));
                const pct = (cat.total / maxTotal) * 100;
                const palette = [COUPLE_COLORS[0], COUPLE_COLORS[1], colors.primary, '#f59e0b', '#a855f7', '#60a5fa'];
                const catColor = palette[index % palette.length];
                return (
                  <View key={cat.category} style={{ marginBottom: 10, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: catColor }} />
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{cat.category}</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{formatCurrency(cat.total)}</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.cardSecondary, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: catColor, borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{cat.count} transaction{cat.count !== 1 ? 's' : ''}</Text>
                  </View>
                );
              })}
              {(!report?.category_breakdown || report.category_breakdown.length === 0) && (
                <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No category data</Text>
              )}
            </View>

            {/* Couple Insights */}
            <CoupleInsights
              userStats={userStats}
              totalSpent={totalSpent}
              totalSaved={totalSaved}
              topCategory={report?.category_breakdown?.[0]?.category}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────
   CoupleBalanceRing
───────────────────────────────────────────────── */
function CoupleBalanceRing({
  userStats,
  totalSpent,
  totalSaved,
}: {
  userStats: UserStat[];
  totalSpent: number;
  totalSaved: number;
}) {
  const { colors } = useTheme();
  const SIZE = 186;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 70;
  const SW = 18;
  const C = 2 * Math.PI * R;

  const totalUserExpense = userStats.reduce((s, u) => s + u.totalExpense, 0);

  let currentDeg = 0;
  const arcs = userStats.map(user => {
    const pct = totalUserExpense > 0 ? user.totalExpense / totalUserExpense : 1 / Math.max(userStats.length, 1);
    const GAP = userStats.length > 1 ? 3 : 0;
    const sweepDeg = pct * 360 - GAP;
    const startDeg = currentDeg;
    currentDeg += pct * 360;
    const dashLen = Math.max((sweepDeg / 360) * C, 0);
    return { user, startDeg, dashLen, pct };
  });

  const amountStr = totalSpent > 999999
    ? `Rp ${(totalSpent / 1000000).toFixed(1)}M`
    : totalSpent > 999
    ? `Rp ${(totalSpent / 1000).toFixed(0)}K`
    : formatCurrency(totalSpent);

  const savedStr = totalSaved > 999999
    ? `+Rp ${(totalSaved / 1000000).toFixed(1)}M`
    : totalSaved > 999
    ? `+Rp ${(totalSaved / 1000).toFixed(0)}K`
    : `+${formatCurrency(totalSaved)}`;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <LinearGradient id="ring-glow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.25} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Outer glow ring */}
        <Circle cx={CX} cy={CY} r={R + SW / 2 + 4} stroke="url(#ring-glow)" strokeWidth={1} fill="none" />
        {/* Track */}
        <Circle cx={CX} cy={CY} r={R} stroke={colors.cardSecondary} strokeWidth={SW} fill="none" />
        {/* User arcs */}
        {arcs.map(({ user, startDeg, dashLen }) => (
          <Circle
            key={user.user_id}
            cx={CX}
            cy={CY}
            r={R}
            stroke={user.color}
            strokeWidth={SW}
            fill="none"
            strokeDasharray={`${dashLen.toFixed(2)} ${C.toFixed(2)}`}
            strokeLinecap="round"
            transform={`rotate(${(-90 + startDeg).toFixed(2)}, ${CX}, ${CY})`}
          />
        ))}
        {/* Center labels */}
        <SvgText x={CX} y={CY - 16} textAnchor="middle" fill={colors.textTertiary} fontSize={8} letterSpacing={2}>
          TOTAL SPENT
        </SvgText>
        <SvgText x={CX} y={CY + 4} textAnchor="middle" fill={colors.text} fontSize={13} fontWeight="bold">
          {amountStr}
        </SvgText>
        <SvgText x={CX} y={CY + 20} textAnchor="middle" fill={colors.success} fontSize={10}>
          {savedStr}
        </SvgText>
      </Svg>

      {/* Legend */}
      {userStats.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 2 }}>
          {arcs.map(({ user, pct }) => (
            <View key={user.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: user.color }} />
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{user.user_id}</Text>
              <Text style={{ color: user.color, fontSize: 12, fontWeight: '700' }}>
                {Math.round(pct * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}
      {userStats.length === 0 && (
        <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8 }}>No spending data</Text>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────
   UserStatCard
───────────────────────────────────────────────── */
function UserStatCard({ user }: { user: UserStat }) {
  const { colors } = useTheme();
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: user.color,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: user.colorDim,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.5, borderColor: user.color,
        }}>
          <Text style={{ color: user.color, fontWeight: '800', fontSize: 15 }}>
            {user.user_id.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, flex: 1 }} numberOfLines={1}>
          {user.user_id}
        </Text>
      </View>
      <Text style={{ color: colors.textTertiary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 }}>Spent</Text>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, letterSpacing: -0.5, marginBottom: 12 }}>
        {formatCurrency(user.totalExpense)}
      </Text>
      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 12 }} />
      <Text style={{ color: colors.textTertiary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 }}>Saved</Text>
      <Text style={{ color: colors.success, fontWeight: '700', fontSize: 14 }}>
        {formatCurrency(user.totalIncome)}
      </Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────
   SpendingBattleBar
───────────────────────────────────────────────── */
function SpendingBattleBar({ userStats }: { userStats: UserStat[] }) {
  const { colors } = useTheme();
  const [u0, u1] = userStats;
  const total = u0.totalExpense + u1.totalExpense;
  const pct0 = total > 0 ? (u0.totalExpense / total) * 100 : 50;
  const pct1 = 100 - pct0;
  const winner = pct0 > pct1 ? u0 : pct1 > pct0 ? u1 : null;
  const diff = Math.abs(pct0 - pct1);

  return (
    <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.textTertiary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
        Spending Split
      </Text>

      {/* Battle bar */}
      <View style={{ height: 36, borderRadius: 10, overflow: 'hidden', flexDirection: 'row', marginBottom: 10, backgroundColor: colors.cardSecondary }}>
        <View style={{ flex: Math.max(pct0, 5), backgroundColor: u0.color, alignItems: 'center', justifyContent: 'center' }}>
          {pct0 > 18 && <Text style={{ color: colors.background, fontWeight: '800', fontSize: 11 }}>{Math.round(pct0)}%</Text>}
        </View>
        <View style={{ flex: Math.max(pct1, 5), backgroundColor: u1.color, alignItems: 'center', justifyContent: 'center' }}>
          {pct1 > 18 && <Text style={{ color: colors.background, fontWeight: '800', fontSize: 11 }}>{Math.round(pct1)}%</Text>}
        </View>
      </View>

      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: u0.color }} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{u0.user_id}</Text>
          </View>
          <Text style={{ color: u0.color, fontWeight: '700', fontSize: 13 }}>{formatCurrency(u0.totalExpense)}</Text>
        </View>
        <Text style={{ color: colors.border, fontSize: 14, fontWeight: '900', letterSpacing: 1 }}>VS</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{u1.user_id}</Text>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: u1.color }} />
          </View>
          <Text style={{ color: u1.color, fontWeight: '700', fontSize: 13 }}>{formatCurrency(u1.totalExpense)}</Text>
        </View>
      </View>

      {total > 0 && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center' }}>
            {winner
              ? <>{winner.user_id} spent {diff.toFixed(0)}% more this period</>
              : <>Perfectly balanced spending!</>}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────
   ImprovedComboChart
───────────────────────────────────────────────── */
type ChartDataPoint = {
  label: string;
  users: { user_id: string; expense: number; income: number }[];
  totalExpense: number;
  totalIncome: number;
};

function ImprovedComboChart({
  selectedPeriod,
  spendingData,
  userStats,
  selectedMonth,
  selectedYear,
}: {
  selectedPeriod: 'week' | 'month' | 'year';
  spendingData: SpendingOverviewRecord[];
  userStats: UserStat[];
  selectedMonth: number;
  selectedYear: number;
}) {
  const { colors } = useTheme();
  const chartWidth = Dimensions.get('window').width - 80;
  const chartHeight = 200;
  const baseline = chartHeight - 20;
  const plotHeight = chartHeight - 40;
  const [selectedBar, setSelectedBar] = useState<{
    user: string; period: string; expense: number; income: number;
  } | null>(null);

  const colorMap = useMemo(
    () => Object.fromEntries(userStats.map(u => [u.user_id, u.color])),
    [userStats]
  );

  const chartData = useMemo((): ChartDataPoint[] => {
    const allUsers = Array.from(new Set(spendingData.map(r => r.user_id))).sort().slice(0, 2);

    // Map of period string -> records (for year, period is YYYY-MM-01 from spending_overview)
    const periodMap = new Map<string, SpendingOverviewRecord[]>();
    spendingData.forEach(record => {
      if (!periodMap.has(record.period)) periodMap.set(record.period, []);
      periodMap.get(record.period)!.push(record);
    });

    const sumUsersFor = (bucketKeys: string[]): { user_id: string; expense: number; income: number }[] =>
      allUsers.map(user_id => {
        let expense = 0;
        let income = 0;
        for (const k of bucketKeys) {
          const recs = periodMap.get(k) || [];
          const rec = recs.find(r => r.user_id === user_id);
          if (rec) {
            expense += rec.total_expense || 0;
            income += rec.total_income || 0;
          }
        }
        return { user_id, expense: Math.round(expense), income: Math.round(income) };
      });

    // Reference date: today if viewing the current month/year, otherwise the 1st.
    const realNow = new Date();
    const isCurrentMonth =
      realNow.getFullYear() === selectedYear && (realNow.getMonth() + 1) === selectedMonth;
    const refDate = isCurrentMonth ? realNow : new Date(selectedYear, selectedMonth - 1, 1);

    // YEAR: monthly buckets from spending_overview (period = YYYY-MM-01)
    if (selectedPeriod === 'year') {
      const year = selectedYear;
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, index) => {
        const periodKey = `${year}-${String(index + 1).padStart(2, '0')}-01`;
        const users = sumUsersFor([periodKey]);
        return {
          label,
          users,
          totalExpense: users.reduce((s, u) => s + u.expense, 0),
          totalIncome: users.reduce((s, u) => s + u.income, 0),
        };
      });
    }

    // WEEK: 7 days (Mon-Sun) of the reference week.
    if (selectedPeriod === 'week') {
      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dow = refDate.getDay(); // 0=Sun
      const diff = dow === 0 ? -6 : 1 - dow; // back to Monday
      const weekStart = new Date(refDate);
      weekStart.setDate(refDate.getDate() + diff);

      const points: ChartDataPoint[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const key = d.toISOString().split('T')[0];
        const users = sumUsersFor([key]);
        points.push({
          label: dayLabels[d.getDay()],
          users,
          totalExpense: users.reduce((s, u) => s + u.expense, 0),
          totalIncome: users.reduce((s, u) => s + u.income, 0),
        });
      }
      return points;
    }

    // MONTH: weekly buckets within the selected month
    const year = selectedYear;
    const month = selectedMonth - 1; // 0-based
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // firstDow: Monday=0 .. Sunday=6
    const rawDow = firstDay.getDay(); // 0=Sun..6=Sat
    const firstDow = rawDow === 0 ? 6 : rawDow - 1;
    const weeks: { label: string; days: number[] }[] = [];
    let dayCursor = 1;
    let weekIdx = 0;
    while (dayCursor <= daysInMonth && weekIdx < 6) {
      const weekLen = weekIdx === 0 ? (7 - firstDow) : Math.min(7, daysInMonth - dayCursor + 1);
      const days: number[] = [];
      for (let d = 0; d < weekLen; d++) days.push(dayCursor + d);
      weeks.push({ label: `W${weekIdx + 1}`, days });
      dayCursor += weekLen;
      weekIdx++;
    }

    return weeks.slice(0, 6).map(({ label, days }) => {
      const keys = days.map(d => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      const users = sumUsersFor(keys);
      return {
        label,
        users,
        totalExpense: users.reduce((s, u) => s + u.expense, 0),
        totalIncome: users.reduce((s, u) => s + u.income, 0),
      };
    });
  }, [selectedPeriod, spendingData, selectedMonth, selectedYear]);

  if (!chartData.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No data available</Text>
      </View>
    );
  }

  const numUsers = chartData[0]?.users.length || 1;
  const maxValue = Math.max(
    ...chartData.flatMap(item => [
      item.totalExpense, item.totalIncome,
      ...item.users.map(u => u.expense + u.income),
    ]),
    1
  );

  const pgw = chartWidth / chartData.length;
  const barWidth = Math.min((pgw * 0.65) / numUsers, 28);
  const barSpacing = 3;

  const yFor = (val: number) => baseline - (val / maxValue) * plotHeight;

  const buildLinePath = (vals: number[]) =>
    vals.map((v, i) => {
      const x = pgw * i + pgw / 2;
      const y = yFor(v);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

  const buildAreaPath = (vals: number[]) =>
    `${buildLinePath(vals)} L ${(pgw * (vals.length - 1) + pgw / 2).toFixed(1)} ${baseline} L ${(pgw / 2).toFixed(1)} ${baseline} Z`;

  const expensePath = buildLinePath(chartData.map(i => i.totalExpense));
  const incomePath = buildLinePath(chartData.map(i => i.totalIncome));
  const expenseArea = buildAreaPath(chartData.map(i => i.totalExpense));
  const incomeArea = buildAreaPath(chartData.map(i => i.totalIncome));

  return (
    <View style={{ alignItems: 'center' }}>
      {selectedBar && (
        <View style={{ marginBottom: 12, padding: 12, backgroundColor: colors.cardSecondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border, width: '100%' }}>
          <Text style={{ color: colorMap[selectedBar.user] || colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
            {selectedBar.user} — {selectedBar.period}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: colors.error, fontSize: 12 }}>Spent: {formatCurrency(selectedBar.expense)}</Text>
            <Text style={{ color: colors.success, fontSize: 12 }}>Saved: {formatCurrency(selectedBar.income)}</Text>
          </View>
        </View>
      )}

      <Svg width={chartWidth} height={chartHeight + 50}>
        <Defs>
          <LinearGradient id="expense-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.error} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.error} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="income-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.success} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colors.success} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {[0.25, 0.5, 0.75].map(ratio => (
          <SvgLine
            key={ratio}
            x1={0} y1={(baseline - plotHeight * ratio).toFixed(1)}
            x2={chartWidth} y2={(baseline - plotHeight * ratio).toFixed(1)}
            stroke={colors.border} strokeWidth={1} strokeDasharray="3 4"
          />
        ))}

        {/* Area fills */}
        <Path d={expenseArea} fill="url(#expense-area)" />
        <Path d={incomeArea} fill="url(#income-area)" />

        {/* Bars */}
        {chartData.map((item, pIdx) => {
          const totalW = barWidth * numUsers + barSpacing * (numUsers - 1);
          const groupStartX = pgw * pIdx + (pgw - totalW) / 2;

          return (
            <G key={`p-${pIdx}`}>
              {item.users.map((user, uIdx) => {
                const bx = groupStartX + uIdx * (barWidth + barSpacing);
                const expH = (user.expense / maxValue) * plotHeight;
                const incH = (user.income / maxValue) * plotHeight;
                const userColor = colorMap[user.user_id] || COUPLE_COLORS[uIdx % COUPLE_COLORS.length];

                return (
                  <G key={`u-${uIdx}`}>
                    <Rect
                      x={bx} y={0} width={barWidth} height={chartHeight}
                      fill="transparent"
                      onPress={() => setSelectedBar({
                        user: user.user_id, period: item.label,
                        expense: user.expense, income: user.income,
                      })}
                    />
                    {/* Income bar (dim) */}
                    {incH > 0 && (
                      <Rect
                        x={bx} y={baseline - incH} width={barWidth} height={Math.max(incH, 2)}
                        fill={userColor} opacity={0.3} rx={3}
                      />
                    )}
                    {/* Expense bar */}
                    {expH > 0 && (
                      <Rect
                        x={bx} y={baseline - incH - expH} width={barWidth} height={Math.max(expH, 2)}
                        fill={userColor} rx={4}
                      />
                    )}
                  </G>
                );
              })}
            </G>
          );
        })}

        {/* Income line (dashed) + dots */}
        <Path d={incomePath} stroke={colors.success} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
        {chartData.map((item, i) => {
          const x = pgw * i + pgw / 2;
          const y = yFor(item.totalIncome);
          return <Circle key={`id-${i}`} cx={x} cy={y} r={3.5} fill={colors.success} />;
        })}

        {/* Expense line + dots */}
        <Path d={expensePath} stroke={colors.error} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {chartData.map((item, i) => {
          const x = pgw * i + pgw / 2;
          const y = yFor(item.totalExpense);
          return <Circle key={`ed-${i}`} cx={x} cy={y} r={3.5} fill={colors.error} stroke={colors.background} strokeWidth={1.5} />;
        })}

        {/* Period labels */}
        {chartData.map((item, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={pgw * i + pgw / 2} y={chartHeight + 8}
            fontSize={10} fill={colors.textTertiary} textAnchor="middle" fontWeight="600"
          >
            {item.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

/* ─────────────────────────────────────────────────
   CoupleInsights
───────────────────────────────────────────────── */
function CoupleInsights({
  userStats,
  totalSpent,
  totalSaved,
  topCategory,
}: {
  userStats: UserStat[];
  totalSpent: number;
  totalSaved: number;
  topCategory?: string;
}) {
  const { colors } = useTheme();
  const savingsRate = (totalSpent + totalSaved) > 0
    ? (totalSaved / (totalSpent + totalSaved)) * 100
    : 0;

  const biggerSpender = userStats.length === 2
    ? (userStats[0].totalExpense >= userStats[1].totalExpense ? userStats[0] : userStats[1])
    : null;

  const biggerSaver = userStats.length === 2
    ? (userStats[0].totalIncome >= userStats[1].totalIncome ? userStats[0] : userStats[1])
    : null;

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Insights</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2, marginBottom: 16 }}>Smart observations for your duo</Text>

      {/* Savings rate */}
      <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="dollarsign.circle.fill" size={20} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Combined Savings Rate</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Saved {formatCurrency(totalSaved)} together — {savingsRate.toFixed(0)}% of combined funds.
            {savingsRate > 20 ? ' Excellent teamwork!' : savingsRate > 10 ? ' Good progress!' : ' Room to grow!'}
          </Text>
        </View>
      </View>

      {/* Bigger spender */}
      {biggerSpender && (
        <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: biggerSpender.colorDim, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="chart.bar.fill" size={20} color={biggerSpender.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Spending Champion</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              <Text style={{ color: biggerSpender.color, fontWeight: '700' }}>{biggerSpender.user_id}</Text>
              {' '}leads spending at {formatCurrency(biggerSpender.totalExpense)}.
              {topCategory ? ` Top category: ${topCategory}.` : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Bigger saver */}
      {biggerSaver && biggerSaver.totalIncome > 0 && (
        <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: biggerSaver.colorDim, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="arrow.up.circle.fill" size={20} color={biggerSaver.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Top Saver</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              <Text style={{ color: biggerSaver.color, fontWeight: '700' }}>{biggerSaver.user_id}</Text>
              {' '}saving more with {formatCurrency(biggerSaver.totalIncome)} this period. Keep it up!
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
