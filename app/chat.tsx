import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { sendChatMessage } from '@/src/services/aiChatService';
import type { ChatMessage } from '@/src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SUGGESTION_PROMPTS = [
  'Berapa total saving bulan ini?',
  'Kasih rekomendasi keuangan dong',
  'Pengeluaran terbesar aku apa aja?',
  'Apakah saving aku optimal?',
];

const CHAT_SESSION_KEY = '@monetra_chat_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredChatSession {
  messages: ChatMessage[];
  startedAt: number;
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const { profile } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const startedAtRef = useRef<number>(Date.now());
  const hydratedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_SESSION_KEY);
        if (raw) {
          const session: StoredChatSession = JSON.parse(raw);
          if (Date.now() - session.startedAt < SESSION_TTL_MS) {
            startedAtRef.current = session.startedAt;
            setMessages(session.messages);
            scrollToBottom();
          } else {
            await AsyncStorage.removeItem(CHAT_SESSION_KEY);
          }
        }
      } catch (err) {
        console.error('[Chat] Failed to load session:', err);
      } finally {
        hydratedRef.current = true;
      }
    })();
  }, [scrollToBottom]);

  useEffect(() => {
    if (!hydratedRef.current && messages.length === 0) return;
    const session: StoredChatSession = { messages, startedAt: startedAtRef.current };
    AsyncStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session)).catch((err) =>
      console.error('[Chat] Failed to save session:', err)
    );
  }, [messages]);

  const handleNewChat = useCallback(() => {
    startedAtRef.current = Date.now();
    setMessages([]);
    AsyncStorage.removeItem(CHAT_SESSION_KEY).catch((err) =>
      console.error('[Chat] Failed to clear session:', err)
    );
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !profile?.user_id || loading) return;

      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);
      scrollToBottom();

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const response = await sendChatMessage(profile.user_id, trimmed, history);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error('[Chat] Error:', err);
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'Maaf, lagi ada gangguan. Coba lagi ya.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [profile?.user_id, loading, messages, scrollToBottom]
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={{ paddingHorizontal: 20, marginVertical: 6, flexDirection: isUser ? 'row-reverse' : 'row' }}>
        {!isUser && (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              marginTop: 4,
            }}
          >
            <IconSymbol name="bot.fill" size={16} color="#0a0a0a" />
          </View>
        )}
        <View
          style={{
            maxWidth: '75%',
            backgroundColor: isUser ? colors.primary : colors.cardSecondary,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              color: isUser ? '#0a0a0a' : colors.text,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Monetra AI</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Financial Assistant</Text>
        </View>
        {messages.length > 0 && (
          <Pressable
            onPress={handleNewChat}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardSecondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10 }}
          >
            <IconSymbol name="plus" size={14} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>New Chat</Text>
          </Pressable>
        )}
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.success,
          }}
        />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderMessage}
        contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 60 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.cardSecondary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <IconSymbol name="bot.fill" size={28} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
              Halo! Aku Monetra AI 👋
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Tanya apa aja soal keuangan kamu. Aku punya akses ke data transaksi kamu secara real-time.
            </Text>
            <View style={{ gap: 8, width: '100%' }}>
              {SUGGESTION_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => handleSend(prompt)}
                  style={{
                    backgroundColor: colors.cardSecondary,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14 }}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          loading ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <ActivityIndicator size="small" color="#0a0a0a" />
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Monetra AI lagi nulis...</Text>
            </View>
          ) : null
        }
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Tulis pesan..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={500}
            editable={!loading}
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 15,
              backgroundColor: colors.cardSecondary,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              maxHeight: 100,
            }}
          />
          <Pressable
            onPress={() => handleSend(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !input.trim() || loading ? 0.5 : 1,
            }}
          >
            <IconSymbol name="arrow.up" size={20} color="#0a0a0a" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
