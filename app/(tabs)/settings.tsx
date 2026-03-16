import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AppContainer } from '@/src/components/common/AppContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatCurrency } from '@/src/lib/utils';

export default function SettingsScreen() {
  const targetSavings = 50000000;
  const currentSavings = 5000000;
  const progress = (currentSavings / targetSavings) * 100;

  return (
    <AppContainer scrollable>
      <View className="px-4 pt-6 pb-4">
        <Text className="text-3xl font-bold text-slate-900 mb-1">
          Pengaturan
        </Text>
        <Text className="text-base text-slate-600">
          Kelola profil dan preferensi aplikasi
        </Text>
      </View>

      <View className="px-4 mb-6">
        <View className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-6 mb-4">
          <View className="flex-row items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center mr-4">
              <IconSymbol name="person.fill" size={32} color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-white mb-1">
                User Name
              </Text>
              <Text className="text-sm text-white/80">
                user@example.com
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-6 border border-slate-200 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-slate-900">
              Target Tabungan Nikah
            </Text>
            <IconSymbol name="heart.fill" size={24} color="#0d9488" />
          </View>
          
          <Text className="text-3xl font-bold text-teal-600 mb-2">
            {formatCurrency(targetSavings)}
          </Text>
          
          <View className="mb-3">
            <View className="flex-row justify-between mb-2">
              <Text className="text-sm text-slate-600">Progress</Text>
              <Text className="text-sm font-semibold text-slate-900">
                {progress.toFixed(1)}%
              </Text>
            </View>
            <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <View 
                className="h-full bg-teal-600 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </View>
          </View>
          
          <Text className="text-sm text-slate-600">
            Terkumpul: {formatCurrency(currentSavings)}
          </Text>
        </View>

        <Text className="text-sm font-semibold text-slate-700 mb-3 px-1">
          Preferensi
        </Text>

        <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
          <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-slate-200">
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                <IconSymbol name="dollarsign.circle.fill" size={20} color="#64748b" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900">
                  Mata Uang
                </Text>
                <Text className="text-sm text-slate-600">
                  IDR - Indonesian Rupiah
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-slate-200">
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                <IconSymbol name="paintbrush.fill" size={20} color="#64748b" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900">
                  Tema
                </Text>
                <Text className="text-sm text-slate-600">
                  Light Mode
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                <IconSymbol name="bell.fill" size={20} color="#64748b" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900">
                  Notifikasi
                </Text>
                <Text className="text-sm text-slate-600">
                  Kelola notifikasi aplikasi
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text className="text-sm font-semibold text-slate-700 mb-3 px-1">
          Lainnya
        </Text>

        <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-slate-200">
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                <IconSymbol name="questionmark.circle.fill" size={20} color="#64748b" />
              </View>
              <Text className="text-base font-semibold text-slate-900">
                Bantuan & FAQ
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-slate-200">
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                <IconSymbol name="info.circle.fill" size={20} color="#64748b" />
              </View>
              <Text className="text-base font-semibold text-slate-900">
                Tentang Aplikasi
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center mr-3">
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#dc2626" />
              </View>
              <Text className="text-base font-semibold text-red-600">
                Keluar
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View className="px-4 pb-6">
        <Text className="text-xs text-slate-500 text-center">
          Monetra v1.0.0
        </Text>
      </View>
    </AppContainer>
  );
}
