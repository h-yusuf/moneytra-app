import { IconSymbol } from '@/components/ui/icon-symbol';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
          
          {/* Scan Receipt - Primary Action */}
          <Pressable 
            onPress={handleImagePicker}
            style={{ backgroundColor: '#c8f542', borderRadius: 16, padding: 20, marginBottom: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(10, 10, 10, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <IconSymbol name="camera.fill" size={28} color="#0a0a0a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#0a0a0a', fontSize: 17, fontWeight: 'bold', marginBottom: 2 }}>Scan Receipt</Text>
                <Text style={{ color: '#404040', fontSize: 13 }}>Take photo or upload image</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#0a0a0a" />
            </View>
          </Pressable>

          {/* Upload PDF */}
          <Pressable 
            onPress={handleDocumentPicker}
            style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16, marginBottom: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="doc.fill" size={24} color="#c8f542" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Upload PDF</Text>
                <Text style={{ color: '#737373', fontSize: 12 }}>Invoice or receipt PDF</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </View>
          </Pressable>

          {/* Manual Input */}
          <Pressable 
            onPress={() => {}}
            style={{ backgroundColor: '#262626', borderRadius: 16, padding: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <IconSymbol name="pencil" size={24} color="#c8f542" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15, marginBottom: 2 }}>Manual Entry</Text>
                <Text style={{ color: '#737373', fontSize: 12 }}>Fill in transaction details</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="#737373" />
            </View>
          </Pressable>
        </View>

        {/* Tips Section */}
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
      </ScrollView>
    </SafeAreaView>
  );
}
