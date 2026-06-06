import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBudget } from '@/src/contexts/BudgetContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { createTransaction, extractTransaction, uploadReceiptImage, type ExtractedTransactionData } from '@/src/services/transactionService';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type UploadedFile = {
  uri: string;
  type: 'image' | 'pdf';
  name: string;
  size?: number;
};

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
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedTransactionData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineAlert, setInlineAlert] = useState<InlineAlert>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedAmount, setSavedAmount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
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

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please allow camera access in your device settings.', [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        setUploadedFile({ uri: asset.uri, type: 'image', name: `receipt_${Date.now()}.jpg`, size: asset.fileSize });
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleUploadDocument = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file: File = e.target.files[0];
        if (!file) return;
        setUploadedFile({ uri: URL.createObjectURL(file), type: 'image', name: file.name, size: file.size });
      };
      input.click();
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access.', [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      if (!result.canceled) {
        const asset = result.assets[0];
        setUploadedFile({ uri: asset.uri, type: 'image', name: asset.fileName || `upload_${Date.now()}.jpg`, size: asset.fileSize });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handlePickDocument = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e: any) => {
        const file: File = e.target.files[0];
        if (!file) return;
        const isPdf = file.type === 'application/pdf';
        setUploadedFile({ uri: URL.createObjectURL(file), type: isPdf ? 'pdf' : 'image', name: file.name, size: file.size });
      };
      input.click();
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (!result.canceled) {
        const asset = result.assets[0];
        const isPdf = asset.mimeType === 'application/pdf';
        setUploadedFile({ uri: asset.uri, type: isPdf ? 'pdf' : 'image', name: asset.name, size: asset.size });
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleRefreshPage = () => {
    setIsRefreshing(true);
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
    setShowManualEntry(false);
    setSelectedType('expense');
    setManualForm({ merchant: '', total: '', category: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: '', notes: '' });
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleManualEntry = () => {
    setShowManualEntry((prev) => !prev);
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
  };

  const handleCancelUpload = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
    setShowManualEntry(false);
    setManualForm({ merchant: '', total: '', category: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: '', notes: '' });
  };

  const handleSaveManualEntry = async () => {
    if (!manualForm.merchant.trim()) { setInlineAlert({ type: 'error', message: 'Merchant name is required.' }); return; }
    if (!manualForm.total || isNaN(parseFloat(manualForm.total)) || parseFloat(manualForm.total) <= 0) { setInlineAlert({ type: 'error', message: 'Please enter a valid amount.' }); return; }
    if (!manualForm.category.trim()) { setInlineAlert({ type: 'error', message: 'Category is required.' }); return; }
    if (!manualForm.transaction_date.trim()) { setInlineAlert({ type: 'error', message: 'Date is required.' }); return; }

    if (!profile?.user_id) {
      Alert.alert('User ID Required', 'Please set your User ID in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Settings', onPress: () => router.push('/settings') },
      ]);
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
          Alert.alert('⚠️ Budget Exceeded!', `You have exceeded your ${budgetCheck.budget?.period} budget for ${manualForm.category}!\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK', style: 'destructive' }]);
        } else if (budgetCheck.isNearLimit) {
          Alert.alert('⚠️ Budget Warning', `You are approaching your ${budgetCheck.budget?.period} budget limit for ${manualForm.category}.\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK' }]);
        }
      }

      setIsSaving(false);
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        setShowManualEntry(false);
        setManualForm({ merchant: '', total: '', category: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: '', notes: '' });
        setInlineAlert(null);
      }, 2500);
    } catch (error: any) {
      setIsSaving(false);
      setInlineAlert({ type: 'error', message: error.response?.data?.message || error.message || 'Failed to save transaction.' });
    }
  };

  const handleExtractTransaction = async () => {
    if (!uploadedFile) {
      setInlineAlert({ type: 'error', message: 'Please upload a file first.' });
      setTimeout(() => setInlineAlert(null), 3000);
      return;
    }
    if (!profile?.user_id) {
      Alert.alert('User ID Required', 'Please set your User ID in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Settings', onPress: () => router.push('/settings') },
      ]);
      return;
    }

    setInlineAlert({ type: 'info', message: 'Extracting transaction data from your image...' });
    setIsExtracting(true);

    try {
      const [extracted, fileUrl] = await Promise.all([
        extractTransaction({
          file: { uri: uploadedFile.uri, type: uploadedFile.type === 'pdf' ? 'application/pdf' : 'image/jpeg', name: uploadedFile.name },
          user_id: profile.user_id,
          transaction_type: selectedType,
        }),
        uploadReceiptImage(uploadedFile.uri, profile.user_id),
      ]);

      setExtractedData({ ...extracted, file_url: fileUrl ?? undefined });
      setIsExtracting(false);
      setInlineAlert({ type: 'success', message: 'Extraction complete! Please review and edit if needed.' });
      setTimeout(() => setInlineAlert(null), 4000);
    } catch (error: any) {
      setIsExtracting(false);
      setInlineAlert({ type: 'error', message: error.message || 'Failed to extract transaction data. Please try again or use manual entry.' });
    }
  };

  const handleSaveTransaction = async () => {
    if (!extractedData) return;
    setIsSaving(true);
    try {
      if (!profile?.user_id) {
        Alert.alert('User ID Required', 'Please set your User ID in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => router.push('/settings') },
        ]);
        setIsSaving(false);
        return;
      }

      await createTransaction({
        user_id: profile.user_id,
        type: selectedType,
        merchant: extractedData.merchant,
        total: extractedData.total,
        category: extractedData.category,
        transaction_date: extractedData.transaction_date,
        payment_method: extractedData.payment_method || undefined,
        notes: extractedData.notes || undefined,
        source_name: uploadedFile?.name || 'receipt',
        file_url: extractedData.file_url || undefined,
      });

      setSavedAmount(extractedData.total);
      await playSuccessSound(selectedType);

      if (selectedType === 'expense' && extractedData.category) {
        const budgetCheck = checkBudgetAlert(extractedData.category, profile.user_id, extractedData.total);
        if (budgetCheck.isOverLimit) {
          Alert.alert('⚠️ Budget Exceeded!', `You have exceeded your ${budgetCheck.budget?.period} budget for ${extractedData.category}!\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK', style: 'destructive' }]);
        } else if (budgetCheck.isNearLimit) {
          Alert.alert('⚠️ Budget Warning', `You are approaching your ${budgetCheck.budget?.period} budget limit for ${extractedData.category}.\n\nBudget: Rp ${budgetCheck.budget?.amount.toLocaleString()}\nSpent: ${budgetCheck.percentage.toFixed(1)}%`, [{ text: 'OK' }]);
        }
      }

      setIsSaving(false);
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        setUploadedFile(null);
        setExtractedData(null);
        setInlineAlert(null);
      }, 2500);
    } catch (error: any) {
      setIsSaving(false);
      setInlineAlert({ type: 'error', message: error.response?.data?.message || error.message || 'Failed to save transaction.' });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefreshPage} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>Add Transaction</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>Upload receipt or enter manually</Text>
        </View>

        {/* Inline Alert */}
        {inlineAlert && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <View style={{
              borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center',
              backgroundColor: inlineAlert.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : inlineAlert.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              borderWidth: 1,
              borderColor: inlineAlert.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : inlineAlert.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
            }}>
              <IconSymbol name={inlineAlert.type === 'success' ? 'checkmark.circle.fill' : inlineAlert.type === 'error' ? 'xmark.circle.fill' : 'info.circle.fill'} size={20} color={inlineAlert.type === 'success' ? colors.success : inlineAlert.type === 'error' ? colors.error : '#3b82f6'} />
              <Text style={{ color: inlineAlert.type === 'success' ? colors.success : inlineAlert.type === 'error' ? colors.error : '#3b82f6', fontSize: 13, marginLeft: 10, flex: 1, lineHeight: 18 }}>{inlineAlert.message}</Text>
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
            <Pressable onPress={() => setSelectedType('expense')} style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: selectedType === 'expense' ? colors.primary : colors.card, marginRight: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: selectedType === 'expense' ? 'rgba(10, 10, 10, 0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <IconSymbol name="arrow.down.circle.fill" size={24} color={selectedType === 'expense' ? colors.error : colors.textTertiary} />
                </View>
                <Text style={{ color: selectedType === 'expense' ? '#0a0a0a' : colors.textSecondary, fontWeight: selectedType === 'expense' ? '600' : '400', fontSize: 14 }}>Expense</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setSelectedType('money_saving')} style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: selectedType === 'money_saving' ? colors.primary : colors.card }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: selectedType === 'money_saving' ? 'rgba(10, 10, 10, 0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <IconSymbol name="heart.circle.fill" size={24} color={selectedType === 'money_saving' ? colors.success : colors.textTertiary} />
                </View>
                <Text style={{ color: selectedType === 'money_saving' ? '#0a0a0a' : colors.textSecondary, fontWeight: selectedType === 'money_saving' ? '600' : '400', fontSize: 14 }}>Money Saving</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Input Methods */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>INPUT METHOD</Text>

          <Pressable onPress={handleTakePhoto} style={{ backgroundColor: colors.primary, borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(10, 10, 10, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <IconSymbol name="camera.fill" size={28} color="#0a0a0a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#0a0a0a', fontSize: 17, fontWeight: 'bold', marginBottom: 2 }}>Take Photo</Text>
                <Text style={{ color: 'rgba(10, 10, 10, 0.7)', fontSize: 13 }}>Capture receipt with camera</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#0a0a0a" />
            </View>
          </Pressable>

          <Pressable onPress={handleUploadDocument} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="photo.fill" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Upload from Gallery</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Choose image from your device</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </View>
          </Pressable>

          <Pressable onPress={handlePickDocument} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="doc.fill" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Upload Document</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>PDF, image, or any file format</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </View>
          </Pressable>

          <Pressable onPress={handleManualEntry} style={{ backgroundColor: showManualEntry ? colors.primary : colors.card, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: showManualEntry ? 'rgba(10,10,10,0.15)' : colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="pencil" size={24} color={showManualEntry ? '#0a0a0a' : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: showManualEntry ? '#0a0a0a' : colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Manual Entry</Text>
                <Text style={{ color: showManualEntry ? 'rgba(10,10,10,0.6)' : colors.textTertiary, fontSize: 12 }}>{showManualEntry ? 'Tap to close form' : 'Fill in transaction details manually'}</Text>
              </View>
              <IconSymbol name={showManualEntry ? 'chevron.left' : 'chevron.right'} size={16} color={showManualEntry ? '#0a0a0a' : '#737373'} />
            </View>
          </Pressable>
        </View>

        {/* Manual Entry Form */}
        {showManualEntry && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>MANUAL ENTRY FORM</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Merchant / Store Name *</Text>
                <TextInput value={manualForm.merchant} onChangeText={(text) => setManualForm({ ...manualForm, merchant: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="e.g. Indomaret, Grab, PLN" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Amount (Rp) *</Text>
                <TextInput value={manualForm.total} onChangeText={(text) => setManualForm({ ...manualForm, total: text.replace(/[^0-9]/g, '') })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="0" placeholderTextColor={colors.textTertiary} keyboardType="numeric" />
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Category *</Text>
                <TextInput value={manualForm.category} onChangeText={(text) => setManualForm({ ...manualForm, category: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="e.g. Food, Transport, Bills" placeholderTextColor={colors.textTertiary} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {['Makanan & Minuman', 'Belanja Harian', 'Wedding', 'Lainnya'].map((cat) => (
                    <Pressable key={cat} onPress={() => setManualForm({ ...manualForm, category: cat })} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: manualForm.category === cat ? colors.primary : colors.border, backgroundColor: manualForm.category === cat ? colors.primary : colors.cardSecondary }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: manualForm.category === cat ? '#0a0a0a' : colors.textSecondary }}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Date *</Text>
                <TextInput value={manualForm.transaction_date} onChangeText={(text) => setManualForm({ ...manualForm, transaction_date: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Payment Method</Text>
                <TextInput value={manualForm.payment_method} onChangeText={(text) => setManualForm({ ...manualForm, payment_method: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="e.g. Cash, QRIS, Transfer, E-Wallet" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Notes</Text>
                <TextInput value={manualForm.notes} onChangeText={(text) => setManualForm({ ...manualForm, notes: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15, minHeight: 80 }} placeholder="Add additional notes..." placeholderTextColor={colors.textTertiary} multiline textAlignVertical="top" />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={handleCancelUpload} disabled={isSaving} style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveManualEntry} disabled={isSaving} style={{ flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                  {isSaving ? (<><ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} /><Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Saving...</Text></>) : (<Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Save Transaction</Text>)}
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* File Preview */}
        {uploadedFile && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>PREVIEW</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="doc.fill" size={20} color="#0a0a0a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 2 }} numberOfLines={1}>{uploadedFile.name}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{formatFileSize(uploadedFile.size)}</Text>
                </View>
              </View>
              {uploadedFile.type === 'image' && (
                <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                  <Image source={{ uri: uploadedFile.uri }} style={{ width: '100%', height: 200, backgroundColor: colors.cardSecondary }} resizeMode="contain" />
                </View>
              )}
              {uploadedFile.type === 'pdf' && (
                <View style={{ borderRadius: 12, backgroundColor: colors.cardSecondary, padding: 32, alignItems: 'center', marginBottom: 12 }}>
                  <IconSymbol name="doc.text.fill" size={48} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8 }}>PDF Document</Text>
                </View>
              )}
              {!extractedData && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable onPress={handleCancelUpload} disabled={isExtracting} style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleExtractTransaction} disabled={isExtracting} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                    {isExtracting ? (<><ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} /><Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Extracting...</Text></>) : (<Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Extract Data</Text>)}
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Extracted Data Review */}
        {extractedData && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>EXTRACTED DATA</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, padding: 12, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 12 }}>
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 13, marginLeft: 8, fontWeight: '500' }}>Data extracted successfully! Review and edit if needed.</Text>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Merchant</Text>
                <TextInput value={extractedData.merchant} onChangeText={(text) => setExtractedData({ ...extractedData, merchant: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Amount</Text>
                <TextInput value={extractedData.total.toString()} onChangeText={(text) => setExtractedData({ ...extractedData, total: parseFloat(text) || 0 })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Category</Text>
                <TextInput value={extractedData.category} onChangeText={(text) => setExtractedData({ ...extractedData, category: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholderTextColor={colors.textTertiary} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {['Makanan & Minuman', 'Belanja Harian', 'Wedding', 'Lainnya'].map((cat) => (
                    <Pressable key={cat} onPress={() => setExtractedData({ ...extractedData, category: cat })} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: extractedData.category === cat ? colors.primary : colors.border, backgroundColor: extractedData.category === cat ? colors.primary : colors.cardSecondary }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: extractedData.category === cat ? '#0a0a0a' : colors.textSecondary }}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Date</Text>
                <TextInput value={extractedData.transaction_date} onChangeText={(text) => setExtractedData({ ...extractedData, transaction_date: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15 }} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '500' }}>Notes</Text>
                <TextInput value={extractedData.notes || ''} onChangeText={(text) => setExtractedData({ ...extractedData, notes: text })} style={{ backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, color: colors.text, fontSize: 15, minHeight: 80 }} placeholder="Add notes..." placeholderTextColor={colors.textTertiary} multiline textAlignVertical="top" />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={handleCancelUpload} disabled={isSaving} style={{ flex: 1, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveTransaction} disabled={isSaving} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
                  {isSaving ? (<><ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} /><Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Saving...</Text></>) : (<Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Save Transaction</Text>)}
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Tips */}
        {!uploadedFile && !showManualEntry && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="lightbulb.fill" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Pro Tip</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 18 }}>For best results, make sure the receipt is well-lit and all text is clearly visible when scanning.</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
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
              {selectedType === 'money_saving' ? 'Your savings have been successfully recorded. Keep up the good work!' : 'Your expense has been successfully recorded and added to your history.'}
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
