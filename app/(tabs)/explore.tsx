import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchSpendingOverview, FetchSpendingOverviewParams, SpendingOverviewRecord } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect, Line as SvgLine, Text as SvgText } from 'react-native-svg';

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

  useFocusEffect(
    useCallback(() => {
      loadReport();
    }, [selectedPeriod])
  );

  const loadReport = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const currentDate = new Date();
      const params: FetchSpendingOverviewParams = { year: currentDate.getFullYear() };
      if (selectedPeriod !== 'year') params.month = currentDate.getMonth() + 1;
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

  const totalSpent = report?.summary?.total_expense || 0;
  const totalSaved = report?.summary?.total_money_saving || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COUPLE_COLORS[0], marginRight: 5 }} />
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: COUPLE_COLORS[1], marginRight: 8 }} />
              <Text style={{ color: '#444', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>Couple Finance</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Analytics</Text>
          </View>
          <Pressable
            onPress={() => loadReport(true)}
            disabled={refreshing}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#242424' }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol name="arrow.clockwise" size={17} color="#555" />
            )}
          </Pressable>
        </View>

        {/* Period Selector */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, gap: 6 }}>
          {(['week', 'month', 'year'] as const).map((period) => (
            <Pressable
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={{
                paddingHorizontal: 18, paddingVertical: 9, borderRadius: 100,
                backgroundColor: selectedPeriod === period ? colors.primary : 'transparent',
                borderWidth: 1,
                borderColor: selectedPeriod === period ? colors.primary : '#242424',
              }}
            >
              <Text style={{
                color: selectedPeriod === period ? '#0a0a0a' : '#555',
                fontWeight: selectedPeriod === period ? '700' : '400',
                fontSize: 13, textTransform: 'capitalize',
              }}>
                {period}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: '#333', marginTop: 12, fontSize: 13 }}>Loading couple data...</Text>
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
            <View style={{ marginHorizontal: 20, marginTop: 20, backgroundColor: '#141414', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e1e1e' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Spending Overview</Text>
              <Text style={{ color: '#444', fontSize: 12, marginTop: 2, marginBottom: 14 }}>
                {selectedPeriod === 'week' ? 'Daily this week' : selectedPeriod === 'month' ? 'Weekly this month' : 'Monthly this year'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {userStats.map(user => (
                  <View key={user.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: user.color }} />
                    <Text style={{ color: '#555', fontSize: 11 }}>{user.user_id}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 14, height: 2, backgroundColor: '#ef4444', borderRadius: 1 }} />
                  <Text style={{ color: '#555', fontSize: 11 }}>Expense</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 14, height: 2, backgroundColor: '#22c55e', borderRadius: 1 }} />
                  <Text style={{ color: '#555', fontSize: 11 }}>Income</Text>
                </View>
              </View>
              <ImprovedComboChart
                selectedPeriod={selectedPeriod}
                spendingData={Array.isArray(spendingData) ? spendingData : []}
                userStats={userStats}
              />
            </View>

            {/* Category Breakdown */}
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Categories</Text>
              <Text style={{ color: '#444', fontSize: 12, marginTop: 2, marginBottom: 16 }}>Combined spending breakdown</Text>
              {(report?.category_breakdown || []).slice(0, 6).map((cat, index) => {
                const maxTotal = Math.max(...(report?.category_breakdown?.map(c => c.total) || [1]));
                const pct = (cat.total / maxTotal) * 100;
                const palette = [COUPLE_COLORS[0], COUPLE_COLORS[1], '#c8f542', '#f59e0b', '#a855f7', '#60a5fa'];
                const catColor = palette[index % palette.length];
                return (
                  <View key={cat.category} style={{ marginBottom: 10, backgroundColor: '#141414', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e1e1e' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: catColor }} />
                        <Text style={{ color: '#ddd', fontWeight: '600', fontSize: 14 }}>{cat.category}</Text>
                      </View>
                      <Text style={{ color: '#666', fontSize: 13 }}>{formatCurrency(cat.total)}</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: '#242424', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: catColor, borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: '#333', fontSize: 11 }}>{cat.count} transaction{cat.count !== 1 ? 's' : ''}</Text>
                  </View>
                );
              })}
              {(!report?.category_breakdown || report.category_breakdown.length === 0) && (
                <Text style={{ color: '#333', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No category data</Text>
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
        {/* Subtle outer glow ring */}
        <Circle cx={CX} cy={CY} r={R + SW / 2 + 4} stroke="#1a1a1a" strokeWidth={1} fill="none" />
        {/* Track */}
        <Circle cx={CX} cy={CY} r={R} stroke="#1e1e1e" strokeWidth={SW} fill="none" />
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
            strokeLinecap="butt"
            transform={`rotate(${(-90 + startDeg).toFixed(2)}, ${CX}, ${CY})`}
          />
        ))}
        {/* Center labels */}
        <SvgText x={CX} y={CY - 16} textAnchor="middle" fill="#333" fontSize={8} letterSpacing={2}>
          TOTAL SPENT
        </SvgText>
        <SvgText x={CX} y={CY + 4} textAnchor="middle" fill="#ffffff" fontSize={13} fontWeight="bold">
          {amountStr}
        </SvgText>
        <SvgText x={CX} y={CY + 20} textAnchor="middle" fill="#22c55e" fontSize={10}>
          {savedStr}
        </SvgText>
      </Svg>

      {/* Legend */}
      {userStats.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 2 }}>
          {arcs.map(({ user, pct }) => (
            <View key={user.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: user.color }} />
              <Text style={{ color: '#555', fontSize: 12 }}>{user.user_id}</Text>
              <Text style={{ color: user.color, fontSize: 12, fontWeight: '700' }}>
                {Math.round(pct * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}
      {userStats.length === 0 && (
        <Text style={{ color: '#333', fontSize: 13, marginTop: 8 }}>No spending data</Text>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────
   UserStatCard
───────────────────────────────────────────────── */
function UserStatCard({ user }: { user: UserStat }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#141414',
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: '#1e1e1e',
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
        <Text style={{ color: '#aaa', fontWeight: '600', fontSize: 13, flex: 1 }} numberOfLines={1}>
          {user.user_id}
        </Text>
      </View>
      <Text style={{ color: '#333', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 }}>Spent</Text>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: -0.5, marginBottom: 12 }}>
        {formatCurrency(user.totalExpense)}
      </Text>
      <View style={{ height: 1, backgroundColor: '#1e1e1e', marginBottom: 12 }} />
      <Text style={{ color: '#333', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 }}>Saved</Text>
      <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 14 }}>
        {formatCurrency(user.totalIncome)}
      </Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────
   SpendingBattleBar
───────────────────────────────────────────────── */
function SpendingBattleBar({ userStats }: { userStats: UserStat[] }) {
  const [u0, u1] = userStats;
  const total = u0.totalExpense + u1.totalExpense;
  const pct0 = total > 0 ? (u0.totalExpense / total) * 100 : 50;
  const pct1 = 100 - pct0;
  const winner = pct0 > pct1 ? u0 : pct1 > pct0 ? u1 : null;
  const diff = Math.abs(pct0 - pct1);

  return (
    <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: '#141414', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1e1e1e' }}>
      <Text style={{ color: '#333', fontSize: 9, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
        Spending Split
      </Text>

      {/* Battle bar */}
      <View style={{ height: 36, borderRadius: 10, overflow: 'hidden', flexDirection: 'row', marginBottom: 10 }}>
        <View style={{ flex: Math.max(pct0, 5), backgroundColor: u0.color, alignItems: 'center', justifyContent: 'center' }}>
          {pct0 > 18 && <Text style={{ color: '#0a0a0a', fontWeight: '800', fontSize: 11 }}>{Math.round(pct0)}%</Text>}
        </View>
        <View style={{ flex: Math.max(pct1, 5), backgroundColor: u1.color, alignItems: 'center', justifyContent: 'center' }}>
          {pct1 > 18 && <Text style={{ color: '#0a0a0a', fontWeight: '800', fontSize: 11 }}>{Math.round(pct1)}%</Text>}
        </View>
      </View>

      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: u0.color }} />
            <Text style={{ color: '#666', fontSize: 12 }}>{u0.user_id}</Text>
          </View>
          <Text style={{ color: u0.color, fontWeight: '700', fontSize: 13 }}>{formatCurrency(u0.totalExpense)}</Text>
        </View>
        <Text style={{ color: '#242424', fontSize: 14, fontWeight: '900', letterSpacing: 1 }}>VS</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <Text style={{ color: '#666', fontSize: 12 }}>{u1.user_id}</Text>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: u1.color }} />
          </View>
          <Text style={{ color: u1.color, fontWeight: '700', fontSize: 13 }}>{formatCurrency(u1.totalExpense)}</Text>
        </View>
      </View>

      {total > 0 && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1e1e1e' }}>
          <Text style={{ color: '#333', fontSize: 12, textAlign: 'center' }}>
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
}: {
  selectedPeriod: 'week' | 'month' | 'year';
  spendingData: SpendingOverviewRecord[];
  userStats: UserStat[];
}) {
  const chartWidth = Dimensions.get('window').width - 80;
  const chartHeight = 200;
  const [selectedBar, setSelectedBar] = useState<{
    user: string; period: string; expense: number; income: number;
  } | null>(null);

  const colorMap = useMemo(
    () => Object.fromEntries(userStats.map(u => [u.user_id, u.color])),
    [userStats]
  );

  const chartData = useMemo((): ChartDataPoint[] => {
    const allUsers = Array.from(new Set(spendingData.map(r => r.user_id))).sort().slice(0, 2);
    const periodMap = new Map<string, SpendingOverviewRecord[]>();
    spendingData.forEach(record => {
      if (!periodMap.has(record.period)) periodMap.set(record.period, []);
      periodMap.get(record.period)!.push(record);
    });

    const build = (labels: string[], divider: number): ChartDataPoint[] => {
      const year = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      const monthStr = String(month).padStart(2, '0');

      return labels.map((label, index) => {
        const periodKey = selectedPeriod === 'year'
          ? `${year}-${String(index + 1).padStart(2, '0')}-01`
          : `${year}-${monthStr}-01`;

        const records = periodMap.get(periodKey) || [];
        const users = allUsers.map(user_id => {
          const rec = records.find(r => r.user_id === user_id);
          return {
            user_id,
            expense: Math.round((rec?.total_expense || 0) / divider),
            income: Math.round((rec?.total_income || 0) / divider),
          };
        });

        return {
          label,
          users,
          totalExpense: users.reduce((s, u) => s + u.expense, 0),
          totalIncome: users.reduce((s, u) => s + u.income, 0),
        };
      });
    };

    if (selectedPeriod === 'week') return build(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], 7);
    if (selectedPeriod === 'month') return build(['W1', 'W2', 'W3', 'W4'], 4);
    return build(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 1);
  }, [selectedPeriod, spendingData]);

  if (!chartData.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Text style={{ color: '#333', fontSize: 13 }}>No data available</Text>
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

  const expensePath = chartData.map((item, i) => {
    const x = pgw * i + pgw / 2;
    const y = chartHeight - (item.totalExpense / maxValue) * (chartHeight - 40);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const incomePath = chartData.map((item, i) => {
    const x = pgw * i + pgw / 2;
    const y = chartHeight - (item.totalIncome / maxValue) * (chartHeight - 40);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <View style={{ alignItems: 'center' }}>
      {selectedBar && (
        <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#242424', width: '100%' }}>
          <Text style={{ color: colorMap[selectedBar.user] || '#ccc', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
            {selectedBar.user} — {selectedBar.period}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: '#ef4444', fontSize: 12 }}>Spent: {formatCurrency(selectedBar.expense)}</Text>
            <Text style={{ color: '#22c55e', fontSize: 12 }}>Saved: {formatCurrency(selectedBar.income)}</Text>
          </View>
        </View>
      )}

      <Svg width={chartWidth} height={chartHeight + 50}>
        {/* Grid */}
        {[0.25, 0.5, 0.75].map(ratio => (
          <SvgLine
            key={ratio}
            x1={0} y1={(chartHeight - chartHeight * ratio).toFixed(1)}
            x2={chartWidth} y2={(chartHeight - chartHeight * ratio).toFixed(1)}
            stroke="#1e1e1e" strokeWidth={1}
          />
        ))}

        {/* Bars */}
        {chartData.map((item, pIdx) => {
          const totalW = barWidth * numUsers + barSpacing * (numUsers - 1);
          const groupStartX = pgw * pIdx + (pgw - totalW) / 2;

          return (
            <G key={`p-${pIdx}`}>
              {item.users.map((user, uIdx) => {
                const bx = groupStartX + uIdx * (barWidth + barSpacing);
                const expH = (user.expense / maxValue) * (chartHeight - 40);
                const incH = (user.income / maxValue) * (chartHeight - 40);
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
                    <Rect
                      x={bx} y={chartHeight - incH} width={barWidth} height={Math.max(incH, 2)}
                      fill={userColor} opacity={0.25} rx={3}
                    />
                    {/* Expense bar */}
                    <Rect
                      x={bx} y={chartHeight - incH - expH} width={barWidth} height={Math.max(expH, 2)}
                      fill={userColor} rx={4}
                    />
                    <SvgText
                      x={bx + barWidth / 2} y={chartHeight + 12}
                      fontSize={8} fill="#2a2a2a" textAnchor="middle"
                    >
                      {user.user_id}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          );
        })}

        {/* Expense line */}
        <Path d={expensePath} stroke="#ef4444" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {chartData.map((item, i) => {
          const x = pgw * i + pgw / 2;
          const y = chartHeight - (item.totalExpense / maxValue) * (chartHeight - 40);
          return <Circle key={`ed-${i}`} cx={x} cy={y} r={3.5} fill="#ef4444" />;
        })}

        {/* Income line */}
        <Path d={incomePath} stroke="#22c55e" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
        {chartData.map((item, i) => {
          const x = pgw * i + pgw / 2;
          const y = chartHeight - (item.totalIncome / maxValue) * (chartHeight - 40);
          return <Circle key={`id-${i}`} cx={x} cy={y} r={3.5} fill="#22c55e" />;
        })}

        {/* Period labels */}
        {chartData.map((item, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={pgw * i + pgw / 2} y={chartHeight + 28}
            fontSize={10} fill="#444" textAnchor="middle" fontWeight="600"
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
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Insights</Text>
      <Text style={{ color: '#444', fontSize: 12, marginTop: 2, marginBottom: 16 }}>Smart observations for your duo</Text>

      {/* Savings rate */}
      <View style={{ backgroundColor: '#141414', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1e1e1e', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="dollarsign.circle.fill" size={20} color="#22c55e" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Combined Savings Rate</Text>
          <Text style={{ color: '#555', fontSize: 13, lineHeight: 18 }}>
            Saved {formatCurrency(totalSaved)} together — {savingsRate.toFixed(0)}% of combined funds.
            {savingsRate > 20 ? ' Excellent teamwork!' : savingsRate > 10 ? ' Good progress!' : ' Room to grow!'}
          </Text>
        </View>
      </View>

      {/* Bigger spender */}
      {biggerSpender && (
        <View style={{ backgroundColor: '#141414', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1e1e1e', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: biggerSpender.colorDim, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="chart.bar.fill" size={20} color={biggerSpender.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Spending Champion</Text>
            <Text style={{ color: '#555', fontSize: 13, lineHeight: 18 }}>
              <Text style={{ color: biggerSpender.color, fontWeight: '700' }}>{biggerSpender.user_id}</Text>
              {' '}leads spending at {formatCurrency(biggerSpender.totalExpense)}.
              {topCategory ? ` Top category: ${topCategory}.` : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Bigger saver */}
      {biggerSaver && biggerSaver.totalIncome > 0 && (
        <View style={{ backgroundColor: '#141414', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1e1e1e', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: biggerSaver.colorDim, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="arrow.up.circle.fill" size={20} color={biggerSaver.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Top Saver</Text>
            <Text style={{ color: '#555', fontSize: 13, lineHeight: 18 }}>
              <Text style={{ color: biggerSaver.color, fontWeight: '700' }}>{biggerSaver.user_id}</Text>
              {' '}saving more with {formatCurrency(biggerSaver.totalIncome)} this period. Keep it up!
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
