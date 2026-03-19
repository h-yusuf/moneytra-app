import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBudget } from '@/src/contexts/BudgetContext';
import { useNotification } from '@/src/contexts/NotificationContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { formatCurrency } from '@/src/lib/utils';
import { fetchMonthlyReport, fetchTransactions } from '@/src/services/transactionService';
import type { MonthlyReportResponse } from '@/src/types';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { theme, isDark, setTheme, colors } = useTheme();
  const { profile, updateProfile } = useUser();
  const { budgets, addBudget, updateBudget, deleteBudget } = useBudget();
  const { settings: notifSettings, updateSettings: updateNotifSettings } = useNotification();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: profile?.name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    user_id: profile?.user_id || '',
  });
  const [budgetForm, setBudgetForm] = useState({
    category: '',
    amount: '',
    period: 'monthly' as 'daily' | 'weekly' | 'monthly',
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportResponse | null>(null);
  const [categorySpending, setCategorySpending] = useState<Record<string, number>>({});
  
  const standardCategories = [
    'Belanja Harian',
    'Makanan & Minuman',
    'Transportasi',
    'Kesehatan',
    'Hiburan',
    'Pakaian',
    'Elektronik',
    'Pendidikan',
    'Tagihan',
    'Lainnya',
  ];
  
  const getThemeLabel = () => {
    if (theme === 'light') return 'Light Mode';
    if (theme === 'dark') return 'Dark Mode';
    return 'System Default';
  };
  
  const getThemeIcon = () => {
    if (theme === 'light') return 'sun.max.fill';
    if (theme === 'dark') return 'moon.fill';
    return 'circle.lefthalf.filled';
  };

  useEffect(() => {
    loadMonthlyReport();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMonthlyReport();
    }, [])
  );

  const loadMonthlyReport = async () => {
    try {
      const currentDate = new Date();
      const reportData = await fetchMonthlyReport({
        ...(profile?.user_id ? { user_id: profile.user_id } : {}),
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
      console.log('Settings - Monthly report data:', reportData);
      setMonthlyReport(reportData);

      const hasBreakdown = reportData?.category_breakdown?.length;
      if (hasBreakdown) {
        const map: Record<string, number> = {};
        reportData.category_breakdown.forEach((item) => {
          if (!item?.category) return;
          map[item.category.toLowerCase()] = item.total || 0;
        });
        setCategorySpending(map);
      } else {
        await loadCategorySpendingFromTransactions(currentDate.getFullYear(), currentDate.getMonth() + 1);
      }
    } catch (error) {
      console.error('Failed to load monthly report:', error);
    }
  };

  const loadCategorySpendingFromTransactions = async (year: number, month: number) => {
    try {
      const response = await fetchTransactions({
        ...(profile?.user_id ? { user_id: profile.user_id } : {}),
        type: 'expense',
        limit: 500,
      });

      const map = response.data.reduce<Record<string, number>>((acc, txn) => {
        if (!txn?.transaction_date) return acc;
        const date = new Date(txn.transaction_date);
        if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return acc;

        const key = (txn.category || 'uncategorized').toLowerCase();
        acc[key] = (acc[key] || 0) + (txn.total || 0);
        return acc;
      }, {});

      setCategorySpending(map);
    } catch (error) {
      console.error('Failed to load transactions for category spending:', error);
      setCategorySpending({});
    }
  };

  const getCategorySpending = (category: string) => {
    const key = category?.toLowerCase();
    if (categorySpending[key] != null) {
      return categorySpending[key];
    }

    if (!monthlyReport?.category_breakdown) return 0;

    const categoryData = monthlyReport.category_breakdown.find(
      (item) => item.category?.toLowerCase() === key
    );

    return categoryData?.total || 0;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#ef4444'; // Red
    if (percentage >= 80) return '#f59e0b'; // Orange/Yellow
    return colors.primary; // Green/Primary
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>Settings</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>Manage your profile and preferences</Text>
        </View>

        {/* Profile Card */}
        <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Text style={{ color: '#0a0a0a', fontSize: 24, fontWeight: 'bold' }}>
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 2 }}>{profile?.name || 'User Name'}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{profile?.email || 'user@example.com'}</Text>
              {profile?.phone && (
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{profile.phone}</Text>
              )}
            </View>
            <Pressable 
              onPress={() => {
                setEditForm({
                  name: profile?.name || '',
                  email: profile?.email || '',
                  phone: profile?.phone || '',
                  user_id: profile?.user_id || '',
                });
                setShowEditModal(true);
              }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
            >
              <IconSymbol name="pencil" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Budget Management Card */}
        <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="chart.bar.fill" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: 'bold' }}>Budget Management</Text>
            </View>
            <Pressable 
              onPress={() => {
                setBudgetForm({ category: '', amount: '', period: 'monthly' });
                setEditingBudget(null);
                setShowBudgetModal(true);
              }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <IconSymbol name="plus" size={16} color="#0a0a0a" />
            </Pressable>
          </View>
          
          {budgets.filter(b => b.user_id === profile?.user_id).length > 0 ? (
            <View style={{ gap: 8 }}>
              {budgets.filter(b => b.user_id === profile?.user_id).map((budget) => {
                const spent = getCategorySpending(budget.category);
                const remaining = budget.amount - spent;
                const percentage = (spent / budget.amount) * 100;
                const progressColor = getProgressColor(percentage);

                return (
                  <View key={budget.id} style={{ backgroundColor: colors.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                    {/* Header with category name and actions */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{budget.category}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable 
                          onPress={() => {
                            setBudgetForm({
                              category: budget.category,
                              amount: budget.amount.toString(),
                              period: budget.period,
                            });
                            setEditingBudget(budget.id);
                            setShowBudgetModal(true);
                          }}
                          style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <IconSymbol name="pencil" size={10} color={colors.primary} />
                        </Pressable>
                        <Pressable 
                          onPress={() => {
                            Alert.alert(
                              'Delete Budget',
                              `Are you sure you want to delete budget for ${budget.category}?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                  text: 'Delete', 
                                  style: 'destructive',
                                  onPress: () => deleteBudget(budget.id)
                                }
                              ]
                            );
                          }}
                          style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <IconSymbol name="trash" size={10} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Budget, Spent, Remaining */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginBottom: 2 }}>Budget</Text>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                          {formatCurrency(budget.amount)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginBottom: 2 }}>Spent</Text>
                        <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: '600' }}>
                          {formatCurrency(spent)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginBottom: 2 }}>Remaining</Text>
                        <Text style={{ color: remaining < 0 ? '#ef4444' : colors.text, fontSize: 16, fontWeight: '600' }}>
                          {remaining < 0 ? '-' : ''}{formatCurrency(Math.abs(remaining))}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={{ marginBottom: 8 }}>
                      <View style={{ height: 8, backgroundColor: colors.cardSecondary, borderRadius: 4, overflow: 'hidden' }}>
                        <View 
                          style={{ 
                            height: '100%', 
                            width: `${Math.min(percentage, 100)}%`, 
                            backgroundColor: progressColor,
                            borderRadius: 4
                          }}
                        />
                      </View>
                    </View>

                    {/* Percentage */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Text style={{ color: progressColor, fontSize: 14, fontWeight: 'bold' }}>
                        {percentage.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
                No budgets set yet. Tap + to add your first budget.
              </Text>
            </View>
          )}
        </View>

        {/* Preferences Section */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>PREFERENCES</Text>
          
          <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.cardSecondary }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="dollarsign.circle.fill" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Currency</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>IDR - Indonesian Rupiah</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable 
              onPress={() => setShowThemeModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.cardSecondary }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name={getThemeIcon()} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Theme</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{getThemeLabel()}</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable 
              onPress={() => setShowNotificationModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="bell.fill" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Notifications</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {notifSettings.enabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>

        {/* Other Section */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>OTHER</Text>
          
          <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.cardSecondary }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="questionmark.circle.fill" size={20} color={colors.textTertiary} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Help & FAQ</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.cardSecondary }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="info.circle.fill" size={20} color={colors.textTertiary} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>About App</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </Pressable>

            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={colors.error} />
                </View>
                <Text style={{ color: colors.error, fontWeight: '600', fontSize: 15 }}>Logout</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Version */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text style={{ color: '#525252', fontSize: 11, textAlign: 'center' }}>Monetra v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable 
          onPress={() => setShowThemeModal(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <Pressable 
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Choose Theme</Text>
            
            {/* Light Mode */}
            <Pressable 
              onPress={() => {
                setTheme('light');
                setShowThemeModal(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: theme === 'light' ? colors.primary + '20' : 'transparent', marginBottom: 8 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme === 'light' ? colors.primary : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="sun.max.fill" size={20} color={theme === 'light' ? '#0a0a0a' : colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Light Mode</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Bright and clear</Text>
              </View>
              {theme === 'light' && (
                <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary} />
              )}
            </Pressable>

            {/* Dark Mode */}
            <Pressable 
              onPress={() => {
                setTheme('dark');
                setShowThemeModal(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: theme === 'dark' ? colors.primary + '20' : 'transparent', marginBottom: 8 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme === 'dark' ? colors.primary : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="moon.fill" size={20} color={theme === 'dark' ? '#0a0a0a' : colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Dark Mode</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Easy on the eyes</Text>
              </View>
              {theme === 'dark' && (
                <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary} />
              )}
            </Pressable>

            {/* System Default */}
            <Pressable 
              onPress={() => {
                setTheme('system');
                setShowThemeModal(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: theme === 'system' ? colors.primary + '20' : 'transparent' }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme === 'system' ? colors.primary : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="circle.lefthalf.filled" size={20} color={theme === 'system' ? '#0a0a0a' : colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>System Default</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Follow device settings</Text>
              </View>
              {theme === 'system' && (
                <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary} />
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setShowEditModal(false)}
        >
          <Pressable 
            style={{ width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, padding: 24 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>Edit Profile</Text>
            
            {/* Name Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>NAME</Text>
              <TextInput
                value={editForm.name}
                onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                placeholder="Enter your name"
                placeholderTextColor={colors.textTertiary}
                style={{ 
                  backgroundColor: colors.background, 
                  borderRadius: 12, 
                  padding: 14, 
                  color: colors.text,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
              />
            </View>

            {/* Email Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>EMAIL</Text>
              <TextInput
                value={editForm.email}
                onChangeText={(text) => setEditForm({ ...editForm, email: text })}
                placeholder="Enter your email"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ 
                  backgroundColor: colors.background, 
                  borderRadius: 12, 
                  padding: 14, 
                  color: colors.text,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
              />
            </View>

            {/* Phone Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>PHONE (Optional)</Text>
              <TextInput
                value={editForm.phone}
                onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                placeholder="Enter your phone number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                style={{ 
                  backgroundColor: colors.background, 
                  borderRadius: 12, 
                  padding: 14, 
                  color: colors.text,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
              />
            </View>

            {/* User ID Input */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>USER ID</Text>
              <TextInput
                value={editForm.user_id}
                onChangeText={(text) => setEditForm({ ...editForm, user_id: text })}
                placeholder="Enter your user ID"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                style={{ 
                  backgroundColor: colors.background, 
                  borderRadius: 12, 
                  padding: 14, 
                  color: colors.text,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
              />
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6 }}>
                This ID will be used for all API requests
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    await updateProfile({
                      name: editForm.name,
                      email: editForm.email,
                      phone: editForm.phone,
                      user_id: editForm.user_id,
                    });
                    setShowEditModal(false);
                    Alert.alert('Success', 'Profile updated successfully!');
                  } catch (error) {
                    Alert.alert('Error', 'Failed to update profile');
                  }
                }}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#0a0a0a', fontWeight: '600', fontSize: 15 }}>Save Changes</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Budget Modal */}
      <Modal
        visible={showBudgetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBudgetModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShowBudgetModal(false)}
        >
          <Pressable 
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
                {editingBudget ? 'Edit Budget' : 'Add Budget'}
              </Text>
              <Pressable onPress={() => setShowBudgetModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Category Picker */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>CATEGORY</Text>
              <Pressable
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                style={{ 
                  backgroundColor: colors.background, 
                  borderRadius: 12, 
                  padding: 14, 
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: budgetForm.category ? colors.text : colors.textTertiary, fontSize: 15 }}>
                  {budgetForm.category || 'Select category'}
                </Text>
                <IconSymbol name={showCategoryPicker ? 'chevron.up' : 'chevron.down'} size={16} color={colors.textSecondary} />
              </Pressable>
              
              {showCategoryPicker && (
                <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, maxHeight: 200 }}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {standardCategories.map((category) => (
                      <Pressable
                        key={category}
                        onPress={() => {
                          setBudgetForm({ ...budgetForm, category });
                          setShowCategoryPicker(false);
                        }}
                        style={{ 
                          padding: 14, 
                          borderBottomWidth: 1, 
                          borderBottomColor: colors.border,
                          backgroundColor: budgetForm.category === category ? colors.cardSecondary : 'transparent'
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 15 }}>{category}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Amount Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>BUDGET AMOUNT</Text>
              <TextInput
                value={budgetForm.amount}
                onChangeText={(text) => setBudgetForm({ ...budgetForm, amount: text.replace(/[^0-9]/g, '') })}
                placeholder="Enter amount"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={{ 
                  backgroundColor: colors.background, 
                  borderRadius: 12, 
                  padding: 14, 
                  color: colors.text,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
              />
            </View>

            {/* Period Selection */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>PERIOD</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                  <Pressable
                    key={period}
                    onPress={() => setBudgetForm({ ...budgetForm, period })}
                    style={{ 
                      flex: 1, 
                      paddingVertical: 12, 
                      borderRadius: 12, 
                      backgroundColor: budgetForm.period === period ? colors.primary : colors.background,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: budgetForm.period === period ? colors.primary : colors.border
                    }}
                  >
                    <Text style={{ 
                      color: budgetForm.period === period ? '#0a0a0a' : colors.text, 
                      fontWeight: budgetForm.period === period ? '600' : '400',
                      fontSize: 14,
                      textTransform: 'capitalize'
                    }}>
                      {period}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowBudgetModal(false)}
                style={{ flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!budgetForm.category.trim() || !budgetForm.amount.trim()) {
                    Alert.alert('Error', 'Please fill in all fields');
                    return;
                  }

                  try {
                    if (editingBudget) {
                      await updateBudget(editingBudget, {
                        category: budgetForm.category.trim(),
                        amount: parseFloat(budgetForm.amount),
                        period: budgetForm.period,
                      });
                      Alert.alert('Success', 'Budget updated successfully!');
                    } else {
                      await addBudget({
                        category: budgetForm.category.trim(),
                        amount: parseFloat(budgetForm.amount),
                        period: budgetForm.period,
                        user_id: profile?.user_id || 'user-456',
                      });
                      Alert.alert('Success', 'Budget added successfully!');
                    }
                    setShowBudgetModal(false);
                    setBudgetForm({ category: '', amount: '', period: 'monthly' });
                    setEditingBudget(null);
                  } catch (error) {
                    Alert.alert('Error', 'Failed to save budget');
                  }
                }}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#0a0a0a', fontWeight: '600', fontSize: 15 }}>
                  {editingBudget ? 'Update' : 'Add Budget'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal
        visible={showNotificationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShowNotificationModal(false)}
        >
          <Pressable 
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Notification Settings</Text>
              <Pressable onPress={() => setShowNotificationModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* Master Toggle */}
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Enable Notifications</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Turn on/off all notifications</Text>
                  </View>
                  <Pressable
                    onPress={() => updateNotifSettings({ enabled: !notifSettings.enabled })}
                    style={{ 
                      width: 52, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: notifSettings.enabled ? colors.primary : colors.cardSecondary,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                  >
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: '#fff',
                      transform: [{ translateX: notifSettings.enabled ? 20 : 0 }]
                    }} />
                  </Pressable>
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

              {/* Notification Types */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 16, letterSpacing: 0.5 }}>NOTIFICATION TYPES</Text>

              {/* Budget Alerts */}
              <View style={{ marginBottom: 20, opacity: notifSettings.enabled ? 1 : 0.5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>Budget Alerts</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Get notified when approaching or exceeding budget</Text>
                  </View>
                  <Pressable
                    disabled={!notifSettings.enabled}
                    onPress={() => updateNotifSettings({ budgetAlerts: !notifSettings.budgetAlerts })}
                    style={{ 
                      width: 52, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: notifSettings.budgetAlerts && notifSettings.enabled ? colors.primary : colors.cardSecondary,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                  >
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: '#fff',
                      transform: [{ translateX: notifSettings.budgetAlerts ? 20 : 0 }]
                    }} />
                  </Pressable>
                </View>
              </View>

              {/* Transaction Reminders */}
              <View style={{ marginBottom: 20, opacity: notifSettings.enabled ? 1 : 0.5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>Transaction Reminders</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Remind to log daily transactions</Text>
                  </View>
                  <Pressable
                    disabled={!notifSettings.enabled}
                    onPress={() => updateNotifSettings({ transactionReminders: !notifSettings.transactionReminders })}
                    style={{ 
                      width: 52, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: notifSettings.transactionReminders && notifSettings.enabled ? colors.primary : colors.cardSecondary,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                  >
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: '#fff',
                      transform: [{ translateX: notifSettings.transactionReminders ? 20 : 0 }]
                    }} />
                  </Pressable>
                </View>
              </View>

              {/* Weekly Reports */}
              <View style={{ marginBottom: 20, opacity: notifSettings.enabled ? 1 : 0.5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>Weekly Reports</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Receive weekly spending summary</Text>
                  </View>
                  <Pressable
                    disabled={!notifSettings.enabled}
                    onPress={() => updateNotifSettings({ weeklyReports: !notifSettings.weeklyReports })}
                    style={{ 
                      width: 52, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: notifSettings.weeklyReports && notifSettings.enabled ? colors.primary : colors.cardSecondary,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                  >
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: '#fff',
                      transform: [{ translateX: notifSettings.weeklyReports ? 20 : 0 }]
                    }} />
                  </Pressable>
                </View>
              </View>

              {/* Monthly Reports */}
              <View style={{ marginBottom: 20, opacity: notifSettings.enabled ? 1 : 0.5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>Monthly Reports</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Receive monthly financial summary</Text>
                  </View>
                  <Pressable
                    disabled={!notifSettings.enabled}
                    onPress={() => updateNotifSettings({ monthlyReports: !notifSettings.monthlyReports })}
                    style={{ 
                      width: 52, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: notifSettings.monthlyReports && notifSettings.enabled ? colors.primary : colors.cardSecondary,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                  >
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: '#fff',
                      transform: [{ translateX: notifSettings.monthlyReports ? 20 : 0 }]
                    }} />
                  </Pressable>
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

              {/* Sound & Vibration */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 16, letterSpacing: 0.5 }}>ALERTS</Text>

              {/* Sound */}
              <View style={{ marginBottom: 20, opacity: notifSettings.enabled ? 1 : 0.5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>Sound</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Play sound for notifications</Text>
                  </View>
                  <Pressable
                    disabled={!notifSettings.enabled}
                    onPress={() => updateNotifSettings({ soundEnabled: !notifSettings.soundEnabled })}
                    style={{ 
                      width: 52, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: notifSettings.soundEnabled && notifSettings.enabled ? colors.primary : colors.cardSecondary,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                  >
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: '#fff',
                      transform: [{ translateX: notifSettings.soundEnabled ? 20 : 0 }]
                    }} />
                  </Pressable>
                </View>
              </View>

              {/* Vibration */}
              <View style={{ marginBottom: 8, opacity: notifSettings.enabled ? 1 : 0.5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>Vibration</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Vibrate for notifications</Text>
                  </View>
                  <Pressable
                    disabled={!notifSettings.enabled}
                    onPress={() => updateNotifSettings({ vibrationEnabled: !notifSettings.vibrationEnabled })}
                    style={{ 
                      width: 52, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: notifSettings.vibrationEnabled && notifSettings.enabled ? colors.primary : colors.cardSecondary,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                  >
                    <View style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: '#fff',
                      transform: [{ translateX: notifSettings.vibrationEnabled ? 20 : 0 }]
                    }} />
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
