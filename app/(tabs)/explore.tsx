import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchSpendingOverview, FetchSpendingOverviewParams, SpendingOverviewRecord } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, LayoutChangeEvent, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Line as SvgLine, Text as SvgText } from 'react-native-svg';

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
            <View style={{ marginHorizontal: 20, marginTop: 20, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 20, paddingLeft: 20, paddingRight: 8, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              <View style={{ paddingRight: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Spending Overview</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2, marginBottom: 14 }}>
                  {selectedPeriod === 'week' ? 'Daily this week' : selectedPeriod === 'month' ? 'Weekly this month' : 'Monthly this year'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: colors.primary }} />
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Expense</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: colors.success, opacity: 0.7 }} />
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Income</Text>
                  </View>
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

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

  // Measure the actual available width instead of guessing from the screen
  // width, so the chart always fits its parent card on any device size.
  const [containerWidth, setContainerWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width);

  const PAD_LEFT = 36;
  const PAD_RIGHT = 8;
  const chartHeight = 180;
  const baseline = chartHeight - 24;
  const plotHeight = chartHeight - 44;
  const plotWidth = Math.max(containerWidth - PAD_LEFT - PAD_RIGHT, 0);

  // Crosshair scrub state (trading-app style touch & drag)
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastHapticIndex = useRef<number | null>(null);

  // Draw-in animation replayed whenever the period/data changes, plus a
  // gentle looping pulse on the latest-value dot (like a "live" price ping).
  const drawAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Geometry needed by the PanResponder, kept in a ref so the responder
  // (created once via useRef) always reads the latest layout/data without
  // having to be recreated on every render.
  const chartMetaRef = useRef({ n: 0, padLeft: PAD_LEFT, stepX: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateActiveFromTouch(e.nativeEvent.locationX),
      onPanResponderMove: (e) => updateActiveFromTouch(e.nativeEvent.locationX),
      onPanResponderRelease: () => setActiveIndex(null),
      onPanResponderTerminate: () => setActiveIndex(null),
    })
  ).current;

  function updateActiveFromTouch(x: number) {
    const { n, padLeft, stepX } = chartMetaRef.current;
    if (n === 0) return;
    const raw = stepX > 0 ? (x - padLeft) / stepX : 0;
    const idx = Math.min(Math.max(Math.round(raw), 0), n - 1);
    setActiveIndex(idx);
    if (lastHapticIndex.current !== idx) {
      lastHapticIndex.current = idx;
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
    }
  }

  // Replay the draw-in animation whenever the selected period changes.
  // Native driver can't be used here: strokeDashoffset/opacity on SVG path
  // props aren't transform-based, so this runs on the JS thread.
  useEffect(() => {
    drawAnim.setValue(0);
    Animated.timing(drawAnim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [selectedPeriod, selectedMonth, selectedYear]);

  // Looping pulse ring around the latest value, like a live ticker.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const chartData = useMemo(() => {
    const periodTotals = new Map<string, { expense: number; income: number }>();
    spendingData.forEach(record => {
      const existing = periodTotals.get(record.period) || { expense: 0, income: 0 };
      periodTotals.set(record.period, {
        expense: existing.expense + (record.total_expense || 0),
        income: existing.income + (record.total_income || 0),
      });
    });

    const periodArray = Array.from(periodTotals.entries())
      .map(([period, vals]) => ({
        period,
        expense: Math.round(vals.expense),
        income: Math.round(vals.income),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    if (selectedPeriod === 'year') {
      const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return periodArray.map(item => {
        const monthIdx = parseInt(item.period.split('-')[1], 10) - 1;
        return {
          label: short[monthIdx] ?? '',
          totalExpense: item.expense,
          totalIncome: item.income,
        };
      });
    }

    if (selectedPeriod === 'week') {
      const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return periodArray.map(item => {
        const d = new Date(item.period + 'T00:00:00');
        return {
          label: short[d.getDay()] ?? '',
          totalExpense: item.expense,
          totalIncome: item.income,
        };
      });
    }

    // month: bucket daily records into weeks (Mon-Sun), label W1..W6
    const year = selectedYear;
    const month = selectedMonth - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rawDow = new Date(year, month, 1).getDay();
    const firstDow = rawDow === 0 ? 6 : rawDow - 1;
    const weeks: { label: string; days: string[] }[] = [];
    let cursor = 1;
    let weekIdx = 0;
    while (cursor <= daysInMonth && weekIdx < 6) {
      const len = weekIdx === 0 ? 7 - firstDow : Math.min(7, daysInMonth - cursor + 1);
      const days: string[] = [];
      for (let i = 0; i < len; i++) {
        days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(cursor + i).padStart(2, '0')}`);
      }
      weeks.push({ label: `W${weekIdx + 1}`, days });
      cursor += len;
      weekIdx++;
    }
    return weeks.map(w => {
      let expense = 0;
      let income = 0;
      w.days.forEach(d => {
        const t = periodTotals.get(d);
        if (t) {
          expense += t.expense;
          income += t.income;
        }
      });
      return { label: w.label, totalExpense: expense, totalIncome: income };
    });
  }, [selectedPeriod, spendingData, selectedMonth, selectedYear]);

  if (!chartData.length) {
    return (
      <View onLayout={onLayout} style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No data available</Text>
      </View>
    );
  }

  const maxValue = Math.max(...chartData.map(p => Math.max(p.totalExpense, p.totalIncome)), 1);
  const n = chartData.length;
  const stepX = n > 1 ? plotWidth / (n - 1) : 0;
  const xFor = (i: number) => PAD_LEFT + i * stepX;
  const yFor = (v: number) => baseline - (v / maxValue) * plotHeight;

  const linePath = (key: 'totalExpense' | 'totalIncome') =>
    chartData.map((p, i) => {
      const x = xFor(i);
      const y = yFor(p[key]);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

  const expenseLine = linePath('totalExpense');
  const incomeLine = linePath('totalIncome');
  const expenseArea = n > 1
    ? `${expenseLine} L ${xFor(n - 1).toFixed(1)} ${baseline} L ${xFor(0).toFixed(1)} ${baseline} Z`
    : '';

  // Length of the expense polyline, used to animate it "drawing" itself in
  // (classic trading-app chart entrance), via stroke-dasharray/dashoffset.
  const pathLength = Math.max(
    chartData.reduce((acc, p, i) => {
      if (i === 0) return 0;
      const prev = chartData[i - 1];
      const dx = xFor(i) - xFor(i - 1);
      const dy = yFor(p.totalExpense) - yFor(prev.totalExpense);
      return acc + Math.hypot(dx, dy);
    }, 0),
    1
  );

  // Thin out X-axis labels on narrow screens / long series so text never overlaps.
  const minLabelGap = 34;
  const labelStride = stepX > 0 ? Math.max(1, Math.ceil(minLabelGap / stepX)) : 1;

  // Compact Y-axis value labels (e.g. "1.2jt", "500rb")
  const formatCompact = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}jt`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
    return `${Math.round(v)}`;
  };

  const svgWidth = PAD_LEFT + plotWidth + PAD_RIGHT;
  const svgHeight = chartHeight + 22;
  const lastX = xFor(n - 1);
  const lastY = yFor(chartData[n - 1].totalExpense);

  // Keep the latest chart geometry in a ref so the PanResponder (created once)
  // always reads fresh values without needing to be recreated every render.
  chartMetaRef.current = { n, padLeft: PAD_LEFT, stepX };

  const activePoint = activeIndex !== null ? chartData[activeIndex] : null;
  const activeX = activeIndex !== null ? xFor(activeIndex) : 0;
  const activeY = activePoint ? yFor(activePoint.totalExpense) : 0;

  const TOOLTIP_W = 116;
  const tooltipLeft = Math.min(Math.max(activeX - TOOLTIP_W / 2, 0), Math.max(svgWidth - TOOLTIP_W, 0));

  return (
    <View
      onLayout={onLayout}
      {...panResponder.panHandlers}
      style={{ width: '100%', height: svgHeight }}
    >
      {containerWidth > 0 && (
        <Svg width={svgWidth} height={svgHeight}>
          <Defs>
            <LinearGradient id="exp-grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.32} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Grid lines + Y-axis value labels */}
          {[0, 0.5, 1].map(ratio => {
            const y = baseline - plotHeight * ratio;
            return (
              <React.Fragment key={ratio}>
                <SvgLine
                  x1={PAD_LEFT} y1={y}
                  x2={PAD_LEFT + plotWidth} y2={y}
                  stroke={colors.border} strokeWidth={0.5} strokeDasharray="3 4"
                />
                <SvgText
                  x={PAD_LEFT - 6} y={y + 3}
                  textAnchor="end" fontSize={9}
                  fill={colors.textTertiary}
                >
                  {formatCompact(maxValue * ratio)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Expense area (fades in after the line finishes drawing) */}
          {n > 1 && (
            <AnimatedPath
              d={expenseArea}
              fill="url(#exp-grad)"
              opacity={drawAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] })}
            />
          )}

          {/* Income line (dashed) */}
          {n > 1 && (
            <AnimatedPath
              d={incomeLine}
              stroke={colors.success}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 4"
              opacity={drawAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 0.85] })}
            />
          )}

          {/* Expense line — animates drawing itself in, left to right */}
          {n > 1 && (
            <AnimatedPath
              d={expenseLine}
              stroke={colors.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${pathLength}`}
              strokeDashoffset={drawAnim.interpolate({ inputRange: [0, 1], outputRange: [pathLength, 0] })}
            />
          )}

          {/* Expense dots (skip when the series is dense to avoid clutter) */}
          {n <= 12 && chartData.map((p, i) => (
            <Circle
              key={`dot-${i}`}
              cx={xFor(i)} cy={yFor(p.totalExpense)} r={3}
              fill={colors.primary}
              stroke={colors.background}
              strokeWidth={1.5}
            />
          ))}

          {/* Last value — soft "live" pulse ring, trading-app style */}
          <AnimatedCircle
            cx={lastX} cy={lastY}
            r={pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 13] })}
            fill={colors.primary}
            opacity={pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] })}
          />
          <SvgLine
            x1={PAD_LEFT} y1={lastY} x2={lastX} y2={lastY}
            stroke={colors.primary} strokeWidth={0.75} strokeDasharray="2 3" opacity={0.5}
          />
          <Circle cx={lastX} cy={lastY} r={4} fill={colors.primary} stroke={colors.background} strokeWidth={2} />
          <Rect
            x={Math.min(lastX + 4, svgWidth - 58)} y={Math.max(lastY - 9, 2)}
            width={54} height={16} rx={4}
            fill={colors.primary}
          />
          <SvgText
            x={Math.min(lastX + 4, svgWidth - 58) + 27} y={Math.max(lastY - 9, 2) + 11}
            textAnchor="middle" fontSize={9} fontWeight="700"
            fill={colors.background}
          >
            {formatCompact(chartData[n - 1].totalExpense)}
          </SvgText>

          {/* X labels (thinned to avoid overlap) */}
          {chartData.map((p, i) => {
            const isLast = i === n - 1;
            if (!isLast && i % labelStride !== 0) return null;
            return (
              <SvgText
                key={`lbl-${i}`}
                x={xFor(i)} y={chartHeight + 10}
                textAnchor={isLast ? 'end' : i === 0 ? 'start' : 'middle'}
                fontSize={10}
                fill={colors.textTertiary} fontWeight="600"
              >
                {p.label}
              </SvgText>
            );
          })}

          {/* Crosshair — appears while dragging a finger across the chart */}
          {activePoint && (
            <>
              <SvgLine
                x1={activeX} y1={10} x2={activeX} y2={baseline}
                stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="2 3" opacity={0.6}
              />
              <Circle
                cx={activeX} cy={activeY} r={5.5}
                fill={colors.background} stroke={colors.primary} strokeWidth={2.5}
              />
            </>
          )}
        </Svg>
      )}

      {/* Scrub tooltip — plain RN view for crisp text + shadow, like a price tag */}
      {activePoint && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tooltipLeft,
            top: 2,
            width: TOOLTIP_W,
            backgroundColor: colors.card,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 6,
            paddingHorizontal: 9,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 5,
          }}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>
            {activePoint.label.toUpperCase()}
          </Text>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 1 }}>
            {formatCurrency(activePoint.totalExpense)}
          </Text>
          {activePoint.totalIncome > 0 && (
            <Text style={{ color: colors.success, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
              +{formatCurrency(activePoint.totalIncome)}
            </Text>
          )}
        </View>
      )}
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
