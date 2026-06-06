import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBudget } from '@/src/contexts/BudgetContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { createTransaction } from '@/src/services/transactionService';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type InlineAlert = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

export default function AddScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useUser();
  const { checkBudgetAlert } = useBudget();
  const [selectedType, setSelectedType] = useState<'expense' | 'money_saving'>('expense');
  const [isSaving, setIsSaving] = useState(false);
  const [inlineAlert, setInlineAlert] = useState<InlineAlert>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedAmount, setSavedAmount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [manualForm, setManualForm] = useState({
    merchant: '',
    total: '',
    category: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: '',
  });

  const playSuccessSound = async (type: 'expense' | 'money_saving') => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        type === 'money_saving'
          ? require('@/assets/sounds/Cash Register Sound Effect.mp3')
          : require('@/assets/sounds/Vintage Cash Register Sound.mp3')
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const resetForm = () => {
    setManualForm({
      merchant: '',
      total: '',
      category: '',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      notes: '',
    });
    setInlineAlert(null);
  };

  const handleRefreshPage = () => {
    setIsRefreshing(true);
    resetForm();
    setSelectedType('expense');
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSaveManualEntry = async () => {
    if (!manualForm.merchant.trim()) {
      setInlineAlert({ type: 'error', message: 'Merchant name is required.' });
      return;
    }
    if (!manualForm.total || isNaN(parseFloat(manualForm.total)) || parseFloat(manualForm.total) <= 0) {
      setInlineAlert({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }
    if (!manualForm.category.trim()) {
      setInlineAlert({ type: 'error', message: 'Category is required.' });
      return;
    }
    if (!manualForm.transaction_date.trim()) {
      setInlineAlert({ type: 'error', message: 'Date is required.' });
      return;
    }

    if (!profile?.user_id) {
      Alert.alert(
        'User ID Required',
        'Please set your User ID in Settings before adding transactions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => router.push('/settings') },
        ]
      );
      return;
    }

    setIsSaving(true);
    try {
      const amount = parseFloat(manualForm.total);

      await createTransaction({
        user_id: profile.user_id,
        type: selectedType,
        merchant: manualForm.merchant,
        total: amount,
        category: manualForm.category,
        transaction_date: manualForm.transaction_date,
        payment_method: manualForm.payment_method || undefined,
        notes: manualForm.notes || undefined,
        source_name: 'manual-entry',
      });

      setSavedAmount(amount);
      await playSuccessSound(selectedType);

      if (selectedType === 'expense' && manualForm.category) {
        const budgetCheck = checkBudgetAlert(manualForm.category, profile.user_id, amount);
        if (budgetCheck.isOverLimit) {
          Alert.alert(
            '⚠️ Budget Exceeded!',
            `You have exceeded your ${budgetCheck.budget?.period} budget for ${manualForm.category}!\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`,
            [{ text: 'OK', style: 'destructive' }]
          );
        } else if (budgetCheck.isNearLimit) {
          Alert.alert(
            '⚠️ Budget Warning',
            `You are approaching your ${budgetCheck.budget?.period} budget limit for ${manualForm.category}.\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`,
            [{ text: 'OK' }]
          );
        }
      }

      setIsSaving(false);
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        resetForm();
      }, 2500);
    } catch (error: any) {
      setIsSaving(false);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to save transaction. Please try again.';
      setInlineAlert({ type: 'error', message: errorMessage });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshPage}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>Add Transaction</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>Enter transaction details manually</Text>
        </View>

        {/* Inline Alert */}
        {inlineAlert && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <View style={{
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor:
                inlineAlert.type === 'success' ? 'rgba(34, 197, 94, 0.1)' :
                inlineAlert.type === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                'rgba(59, 130, 246, 0.1)',
              borderWidth: 1,
              borderColor:
                inlineAlert.type === 'success' ? 'rgba(34, 197, 94, 0.3)' :
                inlineAlert.type === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                'rgba(59, 130, 246, 0.3)',
            }}>
              <IconSymbol
                name={
                  inlineAlert.type === 'success' ? 'checkmark.circle.fill' :
                  inlineAlert.type === 'error' ? 'xmark.circle.fill' :
                  'info.circle.fill'
                }
                size={20}
                color={
                  inlineAlert.type === 'success' ? colors.success :
                  inlineAlert.type === 'error' ? colors.error :
                  '#3b82f6'
                }
              />
              <Text style={{
                color:
                  inlineAlert.type === 'success' ? colors.success :
                  inlineAlert.type === 'error' ? colors.error :
                  '#3b82f6',
                fontSize: 13,
                marginLeft: 10,
                flex: 1,
                lineHeight: 18,
              }}>
                {inlineAlert.message}
              </Text>
              <Pressable onPress={() => setInlineAlert(null)} style={{ padding: 4 }}>
                <IconSymbol name="xmark" size={14} color="#737373" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Transaction Type Selector */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>TRANSACTION TYPE</Text>
          <View style={{ flexDirection: 'row' }}>
            <Pressable
              onPress={() => setSelectedType('expense')}
              style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: selectedType === 'expense' ? colors.primary : colors.card, marginRight: 12 }}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: selectedType === 'expense' ? 'rgba(10, 10, 10, 0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <IconSymbol name="arrow.down.circle.fill" size={24} color={selectedType === 'expense' ? colors.error : colors.textTertiary} />
                </View>
                <Text style={{ color: selectedType === 'expense' ? '#0a0a0a' : colors.textSecondary, fontWeight: selectedType === 'expense' ? '600' : '400', fontSize: 14 }}>
                  Expense
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setSelectedType('money_saving')}
              style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: selectedType === 'money_saving' ? colors.primary : colors.card }}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: selectedType === 'money_saving' ? 'rgba(10, 10, 10, 0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <IconSymbol name="heart.circle.fill" size={24} color={selectedType === 'money_saving' ? colors.success : colors.textTertiary} />
                </View>
                <Text style={{ color: selectedType === 'money_saving' ? '#0a0a0a' : colors.textSecondary, fontWeight: selectedType === 'money_saving' ? '600' : '400', fontSize: 14 }}>
                  Money Saving
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Manual Entry Form */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>TRANSACTION DETAILS</Text>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>

            {/* Merchant */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Merchant / Store Name *</Text>
              <TextInput
                value={manualForm.merchant}
                onChangeText={(text) => setManualForm({ ...manualForm, merchant: text })}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }}
                placeholder="e.g. Indomaret, Grab, PLN"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Amount */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Amount (Rp) *</Text>
              <TextInput
                value={manualForm.total}
                onChangeText={(text) => setManualForm({ ...manualForm, total: text.replace(/[^0-9]/g, '') })}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
            </View>

            {/* Category */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Category *</Text>
              <TextInput
                value={manualForm.category}
                onChangeText={(text) => setManualForm({ ...manualForm, category: text })}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }}
                placeholder="e.g. Food, Transport, Bills"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {['Makanan & Minuman', 'Belanja Harian', 'Wedding', 'Lainnya'].map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setManualForm({ ...manualForm, category: cat })}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: manualForm.category === cat ? colors.primary : colors.border,
                      backgroundColor: manualForm.category === cat ? colors.primary : colors.cardSecondary,
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: manualForm.category === cat ? '#0a0a0a' : colors.textSecondary,
                    }}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Date */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Date *</Text>
              <TextInput
                value={manualForm.transaction_date}
                onChangeText={(text) => setManualForm({ ...manualForm, transaction_date: text })}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Payment Method */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Payment Method</Text>
              <TextInput
                value={manualForm.payment_method}
                onChangeText={(text) => setManualForm({ ...manualForm, payment_method: text })}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }}
                placeholder="e.g. Cash, QRIS, Transfer, E-Wallet"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Notes */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Notes</Text>
              <TextInput
                value={manualForm.notes}
                onChangeText={(text) => setManualForm({ ...manualForm, notes: text })}
                style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15, minHeight: 80 }}
                placeholder="Add additional notes..."
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={resetForm}
                disabled={isSaving}
                style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveManualEntry}
                disabled={isSaving}
                style={{ flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
              >
                {isSaving ? (
                  <>
                    <ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Saving...</Text>
                  </>
                ) : (
                  <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Save Transaction</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', maxWidth: 320, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(34, 197, 94, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(34, 197, 94, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
              </View>
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
              {selectedType === 'money_saving' ? 'Money Saved!' : 'Expense Recorded!'}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              {selectedType === 'money_saving'
                ? 'Your savings have been successfully recorded. Keep up the good work!'
                : 'Your expense has been successfully recorded and added to your history.'}
            </Text>
            <View style={{ marginTop: 20, backgroundColor: colors.cardSecondary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4, textAlign: 'center' }}>AMOUNT</Text>
              <Text style={{ color: colors.primary, fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
                Rp {savedAmount.toLocaleString('id-ID')}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
