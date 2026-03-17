import { IconSymbol } from '@/components/ui/icon-symbol';
import { createTransaction, extractTransaction, type ExtractedTransactionData } from '@/src/services/transactionService';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  const [selectedType, setSelectedType] = useState<'expense' | 'money_saving'>('expense');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedTransactionData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineAlert, setInlineAlert] = useState<InlineAlert>(null);

  const handleTakePhoto = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in your device settings to take photos.',
          [{ text: 'OK' }]
        );
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
        setUploadedFile({
          uri: asset.uri,
          type: 'image',
          name: `receipt_${Date.now()}.jpg`,
          size: asset.fileSize,
        });
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const handleUploadDocument = async () => {
    try {
      // Request media library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow photo library access in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        setUploadedFile({
          uri: asset.uri,
          type: 'image',
          name: asset.fileName || `upload_${Date.now()}.jpg`,
          size: asset.fileSize,
        });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const isPdf = asset.mimeType === 'application/pdf';
        setUploadedFile({
          uri: asset.uri,
          type: isPdf ? 'pdf' : 'image',
          name: asset.name,
          size: asset.size,
        });
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const handleManualEntry = () => {
    setInlineAlert({
      type: 'info',
      message: 'Manual transaction entry form will be available soon.'
    });
    setTimeout(() => setInlineAlert(null), 3000);
  };

  const handleCancelUpload = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setInlineAlert(null);
  };

  const handleExtractTransaction = async () => {
    if (!uploadedFile) {
      setInlineAlert({
        type: 'error',
        message: 'Please upload a file first.'
      });
      setTimeout(() => setInlineAlert(null), 3000);
      return;
    }

    console.log('Starting extraction...', uploadedFile);
    
    setInlineAlert({
      type: 'info',
      message: 'Extracting transaction data from your image...'
    });
    
    setIsExtracting(true);
    
    try {
      // Create file object for upload - React Native format
      const fileToUpload = {
        uri: uploadedFile.uri,
        type: uploadedFile.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
        name: uploadedFile.name,
      } as any;

      console.log('File to upload:', fileToUpload);
      console.log('Calling extractTransaction API...');

      // Extract transaction data from image
      const extracted = await extractTransaction({
        file: fileToUpload,
        user_id: 'test-user-123',
        transaction_type: selectedType,
      });

      console.log('Extraction successful:', extracted);
      setExtractedData(extracted);
      setIsExtracting(false);
      
      setInlineAlert({
        type: 'success',
        message: 'Extraction complete! Please review and edit if needed.'
      });
      setTimeout(() => setInlineAlert(null), 4000);
      
    } catch (error: any) {
      setIsExtracting(false);
      console.error('Extraction error:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.message 
        || error.message 
        || 'Failed to extract transaction data. Please try again or use manual entry.';
      
      setInlineAlert({
        type: 'error',
        message: errorMessage
      });
    }
  };

  const handleSaveTransaction = async () => {
    if (!extractedData) return;

    setIsSaving(true);
    
    try {
      // Format text dari extracted data
      const textData = [
        extractedData.merchant ? `Merchant: ${extractedData.merchant}` : '',
        `Amount: Rp ${extractedData.total.toLocaleString('id-ID')}`,
        `Category: ${extractedData.category}`,
        `Date: ${extractedData.transaction_date}`,
        extractedData.notes ? `Notes: ${extractedData.notes}` : '',
        extractedData.payment_method ? `Payment: ${extractedData.payment_method}` : '',
      ].filter(Boolean).join('\n');

      console.log('Saving transaction with text format:', textData);

      // Save transaction to database
      await createTransaction({
        user_id: 'test-user-123',
        type: selectedType,
        text: textData,
        source_name: uploadedFile?.name || 'manual-entry',
      });

      setInlineAlert({
        type: 'success',
        message: 'Transaction saved successfully!'
      });
      
      setTimeout(() => {
        setUploadedFile(null);
        setExtractedData(null);
        setIsSaving(false);
        setInlineAlert(null);
      }, 2000);
    } catch (error: any) {
      setIsSaving(false);
      console.error('Save error:', error);
      console.error('Save error details:', error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.message 
        || error.message 
        || 'Failed to save transaction. Please check your connection and try again.';
      
      setInlineAlert({
        type: 'error',
        message: errorMessage
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>Add Transaction</Text>
          <Text style={{ color: '#737373', fontSize: 14, marginTop: 4 }}>Upload receipt or enter manually</Text>
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
                inlineAlert.type === 'success' ? 'rgba(34, 197, 94, 0.15)' :
                inlineAlert.type === 'error' ? 'rgba(239, 68, 68, 0.15)' :
                'rgba(200, 245, 66, 0.15)',
              borderWidth: 1,
              borderColor: 
                inlineAlert.type === 'success' ? '#22c55e' :
                inlineAlert.type === 'error' ? '#ef4444' :
                '#c8f542'
            }}>
              <IconSymbol 
                name={
                  inlineAlert.type === 'success' ? 'checkmark.circle.fill' :
                  inlineAlert.type === 'error' ? 'xmark.circle.fill' :
                  'info.circle.fill'
                }
                size={20} 
                color={
                  inlineAlert.type === 'success' ? '#22c55e' :
                  inlineAlert.type === 'error' ? '#ef4444' :
                  '#c8f542'
                }
              />
              <Text style={{ 
                flex: 1, 
                marginLeft: 12, 
                fontSize: 13, 
                color: 
                  inlineAlert.type === 'success' ? '#22c55e' :
                  inlineAlert.type === 'error' ? '#ef4444' :
                  '#c8f542',
                fontWeight: '500'
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
          <Text style={{ color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>TRANSACTION TYPE</Text>
          <View style={{ flexDirection: 'row' }}>
            <Pressable
              onPress={() => setSelectedType('expense')}
              style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: selectedType === 'expense' ? '#c8f542' : '#262626', marginRight: 12 }}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: selectedType === 'expense' ? 'rgba(10, 10, 10, 0.15)' : '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <IconSymbol 
                    name="arrow.down.circle.fill" 
                    size={24} 
                    color={selectedType === 'expense' ? '#0a0a0a' : '#c8f542'} 
                  />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedType === 'expense' ? '#0a0a0a' : '#ffffff' }}>
                  Expense
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setSelectedType('money_saving')}
              style={{ flex: 1, borderRadius: 16, padding: 16, backgroundColor: selectedType === 'money_saving' ? '#c8f542' : '#262626' }}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: selectedType === 'money_saving' ? 'rgba(10, 10, 10, 0.15)' : '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <IconSymbol 
                    name="heart.circle.fill" 
                    size={24} 
                    color={selectedType === 'money_saving' ? '#0a0a0a' : '#c8f542'} 
                  />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedType === 'money_saving' ? '#0a0a0a' : '#ffffff' }}>
                  Savings
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Input Methods */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>INPUT METHOD</Text>
          
          {/* Take Photo - Primary Action */}
          <Pressable 
            onPress={handleTakePhoto}
            style={{ backgroundColor: '#c8f542', borderRadius: 16, padding: 20, marginBottom: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(10, 10, 10, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <IconSymbol name="camera.fill" size={28} color="#0a0a0a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#0a0a0a', fontSize: 17, fontWeight: 'bold', marginBottom: 2 }}>Take Photo</Text>
                <Text style={{ color: '#404040', fontSize: 13 }}>Capture receipt with camera</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#0a0a0a" />
            </View>
          </Pressable>

          {/* Upload Document */}
          <Pressable 
            onPress={handleUploadDocument}
            style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16, marginBottom: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="photo.fill" size={24} color="#c8f542" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Upload from Gallery</Text>
                <Text style={{ color: '#737373', fontSize: 12 }}>Choose image from your device</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </View>
          </Pressable>

          {/* Pick Document (PDF/Any File) */}
          <Pressable 
            onPress={handlePickDocument}
            style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16, marginBottom: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="doc.fill" size={24} color="#c8f542" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Upload Document</Text>
                <Text style={{ color: '#737373', fontSize: 12 }}>PDF, image, or any file format</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </View>
          </Pressable>

          {/* Manual Input */}
          <Pressable 
            onPress={handleManualEntry}
            style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="pencil" size={24} color="#c8f542" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Manual Entry</Text>
                <Text style={{ color: '#737373', fontSize: 12 }}>Fill in transaction details manually</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </View>
          </Pressable>
        </View>

        {/* Preview Section */}
        {uploadedFile && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Text style={{ color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>PREVIEW</Text>
            
            <View style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16, marginBottom: 12 }}>
              {/* File Info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#c8f542', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name={uploadedFile.type === 'pdf' ? 'doc.fill' : 'photo.fill'} size={20} color="#0a0a0a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14, marginBottom: 2 }} numberOfLines={1}>
                    {uploadedFile.name}
                  </Text>
                  <Text style={{ color: '#737373', fontSize: 12 }}>
                    {formatFileSize(uploadedFile.size)}
                  </Text>
                </View>
              </View>

              {/* Image Preview */}
              {uploadedFile.type === 'image' && (
                <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                  <Image 
                    source={{ uri: uploadedFile.uri }} 
                    style={{ width: '100%', height: 200, backgroundColor: '#1a1a1a' }}
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* PDF Placeholder */}
              {uploadedFile.type === 'pdf' && (
                <View style={{ borderRadius: 12, backgroundColor: '#1a1a1a', padding: 32, alignItems: 'center', marginBottom: 12 }}>
                  <IconSymbol name="doc.text.fill" size={48} color="#737373" />
                  <Text style={{ color: '#737373', fontSize: 13, marginTop: 8 }}>PDF Document</Text>
                </View>
              )}

              {/* Action Buttons */}
              {!extractedData ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable 
                    onPress={handleCancelUpload}
                    disabled={isExtracting}
                    style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                  
                  <Pressable 
                    onPress={handleExtractTransaction}
                    disabled={isExtracting}
                    style={{ flex: 1, backgroundColor: '#c8f542', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                  >
                    {isExtracting ? (
                      <>
                        <ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Extracting...</Text>
                      </>
                    ) : (
                      <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Extract Data</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Extracted Data Review */}
        {extractedData && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Text style={{ color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>EXTRACTED DATA</Text>
            
            <View style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16 }}>
              {/* Success Badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, padding: 12, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 12 }}>
                <IconSymbol name="checkmark.circle.fill" size={20} color="#22c55e" />
                <Text style={{ color: '#22c55e', fontSize: 13, marginLeft: 8, fontWeight: '600' }}>
                  Data extracted successfully! Please review and edit if needed.
                </Text>
              </View>

              {/* Merchant */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#a3a3a3', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>MERCHANT</Text>
                <TextInput
                  value={extractedData.merchant}
                  onChangeText={(text) => setExtractedData({ ...extractedData, merchant: text })}
                  style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, color: '#ffffff', fontSize: 15 }}
                  placeholder="Merchant name"
                  placeholderTextColor="#737373"
                />
              </View>

              {/* Amount */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#a3a3a3', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>AMOUNT</Text>
                <TextInput
                  value={extractedData.total.toString()}
                  onChangeText={(text) => setExtractedData({ ...extractedData, total: parseFloat(text) || 0 })}
                  style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, color: '#ffffff', fontSize: 15 }}
                  placeholder="0"
                  placeholderTextColor="#737373"
                  keyboardType="numeric"
                />
              </View>

              {/* Category */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#a3a3a3', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>CATEGORY</Text>
                <TextInput
                  value={extractedData.category}
                  onChangeText={(text) => setExtractedData({ ...extractedData, category: text })}
                  style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, color: '#ffffff', fontSize: 15 }}
                  placeholder="Category"
                  placeholderTextColor="#737373"
                />
              </View>

              {/* Date */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: '#a3a3a3', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>DATE</Text>
                <TextInput
                  value={extractedData.transaction_date}
                  onChangeText={(text) => setExtractedData({ ...extractedData, transaction_date: text })}
                  style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, color: '#ffffff', fontSize: 15 }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#737373"
                />
              </View>

              {/* Notes */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#a3a3a3', fontSize: 11, marginBottom: 6, fontWeight: '600' }}>NOTES (OPTIONAL)</Text>
                <TextInput
                  value={extractedData.notes || ''}
                  onChangeText={(text) => setExtractedData({ ...extractedData, notes: text })}
                  style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, color: '#ffffff', fontSize: 15, minHeight: 80 }}
                  placeholder="Add notes..."
                  placeholderTextColor="#737373"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Save Buttons */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable 
                  onPress={handleCancelUpload}
                  disabled={isSaving}
                  style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </Pressable>
                
                <Pressable 
                  onPress={handleSaveTransaction}
                  disabled={isSaving}
                  style={{ flex: 1, backgroundColor: '#c8f542', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
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
        )}

        {/* Tips Section */}
        {!uploadedFile && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <View style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(200, 245, 66, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                  <IconSymbol name="lightbulb.fill" size={16} color="#c8f542" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14, marginBottom: 4 }}>Pro Tip</Text>
                  <Text style={{ color: '#737373', fontSize: 13, lineHeight: 18 }}>
                    For best results, make sure the receipt is well-lit and all text is clearly visible when scanning.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
