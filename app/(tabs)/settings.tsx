import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatCurrency } from '@/src/lib/utils';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const targetSavings = 50000000;
  const currentSavings = 5000000;
  const progress = (currentSavings / targetSavings) * 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>Settings</Text>
          <Text style={{ color: '#737373', fontSize: 14, marginTop: 4 }}>Manage your profile and preferences</Text>
        </View>

        {/* Profile Card */}
        <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: '#262626', borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#c8f542', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Text style={{ color: '#0a0a0a', fontSize: 24, fontWeight: 'bold' }}>U</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 2 }}>User Name</Text>
              <Text style={{ color: '#737373', fontSize: 13 }}>user@example.com</Text>
            </View>
            <Pressable style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }}>
              <IconSymbol name="pencil" size={16} color="#c8f542" />
            </Pressable>
          </View>
        </View>

        {/* Savings Target Card */}
        <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: '#262626', borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: 'bold' }}>Savings Target</Text>
            <IconSymbol name="heart.fill" size={20} color="#c8f542" />
          </View>
          
          <Text style={{ color: '#c8f542', fontSize: 32, fontWeight: 'bold', marginBottom: 12 }}>
            {formatCurrency(targetSavings)}
          </Text>
          
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#737373', fontSize: 12 }}>Progress</Text>
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>{progress.toFixed(1)}%</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
              <View 
                style={{ height: '100%', borderRadius: 4, width: `${progress}%`, backgroundColor: '#c8f542' }}
              />
            </View>
          </View>
          
          <Text style={{ color: '#737373', fontSize: 12 }}>
            Collected: {formatCurrency(currentSavings)}
          </Text>
        </View>

        {/* Preferences Section */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>PREFERENCES</Text>
          
          <View style={{ backgroundColor: '#262626', borderRadius: 16, overflow: 'hidden' }}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="dollarsign.circle.fill" size={20} color="#c8f542" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Currency</Text>
                  <Text style={{ color: '#737373', fontSize: 12 }}>IDR - Indonesian Rupiah</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="moon.fill" size={20} color="#c8f542" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Theme</Text>
                  <Text style={{ color: '#737373', fontSize: 12 }}>Dark Mode</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="bell.fill" size={20} color="#c8f542" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Notifications</Text>
                  <Text style={{ color: '#737373', fontSize: 12 }}>Manage app notifications</Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </Pressable>
          </View>
        </View>

        {/* Other Section */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ color: '#a3a3a3', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 0.5 }}>OTHER</Text>
          
          <View style={{ backgroundColor: '#262626', borderRadius: 16, overflow: 'hidden' }}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="questionmark.circle.fill" size={20} color="#737373" />
                </View>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>Help & FAQ</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="info.circle.fill" size={20} color="#737373" />
                </View>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>About App</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </Pressable>

            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(153, 27, 27, 0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#ef4444" />
                </View>
                <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 15 }}>Logout</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Version */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <Text style={{ color: '#525252', fontSize: 11, textAlign: 'center' }}>Monetra v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
