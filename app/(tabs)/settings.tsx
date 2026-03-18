import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { formatCurrency } from '@/src/lib/utils';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { theme, isDark, setTheme, colors } = useTheme();
  const [showThemeModal, setShowThemeModal] = useState(false);
  
  const targetSavings = 50000000;
  const currentSavings = 5000000;
  const progress = (currentSavings / targetSavings) * 100;
  
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
              <Text style={{ color: '#0a0a0a', fontSize: 24, fontWeight: 'bold' }}>U</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 2 }}>User Name</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>user@example.com</Text>
            </View>
            <Pressable style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center' }}>
              <IconSymbol name="pencil" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Savings Target Card */}
        <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: 'bold' }}>Savings Target</Text>
            <IconSymbol name="heart.fill" size={20} color={colors.primary} />
          </View>
          
          <Text style={{ color: colors.primary, fontSize: 32, fontWeight: 'bold', marginBottom: 12 }}>
            {formatCurrency(targetSavings)}
          </Text>
          
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Progress</Text>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{progress.toFixed(1)}%</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardSecondary, borderRadius: 4, overflow: 'hidden' }}>
              <View 
                style={{ height: '100%', borderRadius: 4, width: `${progress}%`, backgroundColor: colors.primary }}
              />
            </View>
          </View>
          
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
            Collected: {formatCurrency(currentSavings)}
          </Text>
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

            <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <IconSymbol name="bell.fill" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Notifications</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Manage app notifications</Text>
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
    </SafeAreaView>
  );
}
