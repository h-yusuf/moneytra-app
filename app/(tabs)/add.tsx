import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppContainer } from '@/src/components/common/AppContainer';
import { PrimaryButton } from '@/src/components/common/PrimaryButton';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function AddScreen() {
  const [selectedType, setSelectedType] = useState<'expense' | 'money_saving'>('expense');

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      console.log('Image selected:', result.assets[0].uri);
    }
  };

  const handleDocumentPicker = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });

    if (!result.canceled) {
      console.log('Document selected:', result.assets[0].uri);
    }
  };

  return (
    <AppContainer>
      <View className="px-4 pt-6 pb-4">
        <Text className="text-3xl font-bold text-slate-900 mb-1">
          Tambah Transaksi
        </Text>
        <Text className="text-base text-slate-600">
          Upload struk atau input manual
        </Text>
      </View>

      <View className="px-4 mb-6">
        <Text className="text-sm font-semibold text-slate-700 mb-3">
          Pilih Jenis Data
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => setSelectedType('expense')}
            className={`flex-1 rounded-xl p-4 border-2 ${
              selectedType === 'expense'
                ? 'bg-teal-50 border-teal-600'
                : 'bg-white border-slate-200'
            }`}
          >
            <View className="items-center">
              <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                selectedType === 'expense' ? 'bg-teal-100' : 'bg-slate-100'
              }`}>
                <IconSymbol 
                  name="arrow.down.circle.fill" 
                  size={28} 
                  color={selectedType === 'expense' ? '#0d9488' : '#64748b'} 
                />
              </View>
              <Text className={`text-sm font-semibold ${
                selectedType === 'expense' ? 'text-teal-900' : 'text-slate-700'
              }`}>
                Expense
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedType('money_saving')}
            className={`flex-1 rounded-xl p-4 border-2 ${
              selectedType === 'money_saving'
                ? 'bg-teal-50 border-teal-600'
                : 'bg-white border-slate-200'
            }`}
          >
            <View className="items-center">
              <View className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                selectedType === 'money_saving' ? 'bg-teal-100' : 'bg-slate-100'
              }`}>
                <IconSymbol 
                  name="heart.circle.fill" 
                  size={28} 
                  color={selectedType === 'money_saving' ? '#0d9488' : '#64748b'} 
                />
              </View>
              <Text className={`text-sm font-semibold ${
                selectedType === 'money_saving' ? 'text-teal-900' : 'text-slate-700'
              }`}>
                Tabungan Nikah
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View className="px-4 mb-6">
        <Text className="text-sm font-semibold text-slate-700 mb-3">
          Metode Input
        </Text>
        
        <View className="bg-white rounded-2xl p-6 border border-slate-200 mb-4">
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-teal-100 items-center justify-center mb-3">
              <IconSymbol name="photo" size={32} color="#0d9488" />
            </View>
            <Text className="text-lg font-bold text-slate-900 mb-1">
              Upload Gambar
            </Text>
            <Text className="text-sm text-slate-600 text-center mb-4">
              Upload foto struk atau bukti transfer
            </Text>
            <PrimaryButton
              title="Pilih Gambar"
              icon="photo.fill"
              onPress={handleImagePicker}
              variant="primary"
            />
          </View>
        </View>

        <View className="bg-white rounded-2xl p-6 border border-slate-200 mb-4">
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-amber-100 items-center justify-center mb-3">
              <IconSymbol name="doc.fill" size={32} color="#d97706" />
            </View>
            <Text className="text-lg font-bold text-slate-900 mb-1">
              Upload PDF
            </Text>
            <Text className="text-sm text-slate-600 text-center mb-4">
              Upload file PDF struk atau invoice
            </Text>
            <PrimaryButton
              title="Pilih PDF"
              icon="doc.fill"
              onPress={handleDocumentPicker}
              variant="secondary"
            />
          </View>
        </View>

        <View className="bg-white rounded-2xl p-6 border border-slate-200">
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-emerald-100 items-center justify-center mb-3">
              <IconSymbol name="pencil" size={32} color="#059669" />
            </View>
            <Text className="text-lg font-bold text-slate-900 mb-1">
              Input Manual
            </Text>
            <Text className="text-sm text-slate-600 text-center mb-4">
              Isi form transaksi secara manual
            </Text>
            <PrimaryButton
              title="Buat Manual"
              icon="pencil"
              onPress={() => {}}
              variant="outline"
            />
          </View>
        </View>
      </View>
    </AppContainer>
  );
}
