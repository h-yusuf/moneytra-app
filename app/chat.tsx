import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useUser } from '@/src/contexts/UserContext';
import { sendChatMessageStream, type StreamHandle } from '@/src/services/aiChatService';
import { bulkCreateTransactions } from '@/src/services/transactionService';
import type { ChatMessage, ParsedTransactionDraft } from '@/src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
  'Catat: beli kopi 15rb, bensin 50rb, bayar wifi 250rb',
];

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// ─── PulsingDot ── header "online" indicator: a soft expanding ring behind a solid dot ──

function PulsingDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ─── EqualizerTyping ── signature "thinking" indicator: 3 bars ticking like a mini ledger chart ──

function EqualizerTyping({ color }: { color: string }) {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(bar, { toValue: 1, duration: 340, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(bar, { toValue: 0.3, duration: 340, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 14, gap: 3 }}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            borderRadius: 1.5,
            backgroundColor: color,
            height: bar.interpolate({ inputRange: [0.3, 1], outputRange: [5, 14] }),
          }}
        />
      ))}
    </View>
  );
}

// ─── ResearchingIndicator ── magnifying glass sweeping over a line, like scanning search results ──

function ResearchingIndicator({ color, dimColor }: { color: string; dimColor: string }) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <IconSymbol name="magnifyingglass" size={16} color={color} />
      </Animated.View>
      <Text style={{ color: dimColor, fontSize: 14, marginLeft: 8 }}>Monetra AI lagi riset di web...</Text>
    </View>
  );
}

// ─── MessageBubble ── entrance feels like a receipt feeding out of a printer ──

function MessageBubble({
  item,
  isUser,
  isUnread,
  animateIn,
  colors,
}: {
  item: ChatMessage;
  isUser: boolean;
  isUnread: boolean;
  animateIn: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const progress = useRef(new Animated.Value(animateIn ? 0 : 1)).current;

  useEffect(() => {
    if (!animateIn) return;
    Animated.spring(progress, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [animateIn, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const scaleY = progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <Animated.View
      style={{
        paddingHorizontal: 20,
        marginVertical: 6,
        flexDirection: isUser ? 'row-reverse' : 'row',
        opacity: progress,
        transform: [{ translateY }, { scaleY }],
      }}
    >
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
          {isUnread && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.error,
                borderWidth: 1.5,
                borderColor: colors.background,
              }}
            />
          )}
        </View>
      )}
      <View style={{ maxWidth: '75%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <View
          style={{
            backgroundColor: isUser ? colors.primary : colors.cardSecondary,
            borderRadius: 18,
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius: isUser ? 18 : 4,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: isUser ? '#0a0a0a' : colors.text, fontSize: 15, lineHeight: 22 }}>
            {item.content}
          </Text>
        </View>
        <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 4, marginHorizontal: 4 }}>
          {formatClock(item.timestamp)}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── SuggestionChip ── staggered entrance for the empty-state prompt chips ──

function SuggestionChip({
  label,
  index,
  colors,
  onPress,
}: {
  label: string;
  index: number;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 90),
      Animated.spring(progress, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [index, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: colors.cardSecondary,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export const CHAT_SESSION_KEY = '@monetra_chat_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface StoredChatSession {
  messages: ChatMessage[];
  startedAt: number;
  unreadReplyAt?: number | null;
}

async function persistChatSession(session: StoredChatSession): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('[Chat] Failed to save session:', err);
  }
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const { profile } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadReplyAt, setUnreadReplyAt] = useState<number | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<ParsedTransactionDraft[]>([]);
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);
  const streamHandleRef = useRef<StreamHandle | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const startedAtRef = useRef<number>(Date.now());
  const messagesRef = useRef<ChatMessage[]>([]);
  const mountedRef = useRef(true);
  const mountTimeRef = useRef<number>(Date.now());
  const sendScale = useRef(new Animated.Value(1)).current;

  const pressSendIn = () => Animated.spring(sendScale, { toValue: 0.88, friction: 6, useNativeDriver: true }).start();
  const pressSendOut = () => Animated.spring(sendScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hydrateFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CHAT_SESSION_KEY);
      if (!raw) return;
      const session: StoredChatSession = JSON.parse(raw);
      if (Date.now() - session.startedAt >= SESSION_TTL_MS) {
        await AsyncStorage.removeItem(CHAT_SESSION_KEY);
        return;
      }
      // Only move forward: a stale re-check must never regress state that's
      // already ahead locally (e.g. a message just sent by this instance).
      if (session.startedAt !== startedAtRef.current) {
        startedAtRef.current = session.startedAt;
      } else if (session.messages.length <= messagesRef.current.length && !session.unreadReplyAt) {
        return;
      }
      messagesRef.current = session.messages;
      setMessages(session.messages);
      if (session.unreadReplyAt) {
        setUnreadReplyAt(session.unreadReplyAt);
        await persistChatSession({ ...session, unreadReplyAt: null });
      }
      scrollToBottom();
    } catch (err) {
      console.error('[Chat] Failed to load session:', err);
    }
  }, [scrollToBottom]);

  // Re-check storage every time this screen gains focus — picks up a reply
  // that finished arriving while the user was away on another screen.
  useFocusEffect(
    useCallback(() => {
      hydrateFromStorage();
      const interval = setInterval(hydrateFromStorage, 3000);
      return () => clearInterval(interval);
    }, [hydrateFromStorage])
  );

  const handleNewChat = useCallback(() => {
    streamHandleRef.current?.abort();
    streamHandleRef.current = null;
    setStreamingReply(null);
    setResearching(false);
    setLoading(false);
    setPendingDrafts([]);
    startedAtRef.current = Date.now();
    messagesRef.current = [];
    setMessages([]);
    setUnreadReplyAt(null);
    AsyncStorage.removeItem(CHAT_SESSION_KEY).catch((err) =>
      console.error('[Chat] Failed to clear session:', err)
    );
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !profile?.user_id || loading) return;

      const historySnapshot = messagesRef.current.map((m) => ({ role: m.role, content: m.content }));

      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      const afterUserMessage = [...messagesRef.current, userMessage];
      messagesRef.current = afterUserMessage;
      setMessages(afterUserMessage);
      setInput('');
      setLoading(true);
      scrollToBottom();
      persistChatSession({ messages: afterUserMessage, startedAt: startedAtRef.current, unreadReplyAt: null });

      setStreamingReply(null);
      setResearching(false);

      try {
        const finalText = await new Promise<string>((resolve, reject) => {
          let acc = '';
          streamHandleRef.current = sendChatMessageStream(profile.user_id, trimmed, historySnapshot, {
            onResearchStart: () => {
              if (mountedRef.current) {
                setResearching(true);
                scrollToBottom();
              }
            },
            onResearchDone: () => {
              if (mountedRef.current) setResearching(false);
            },
            onDelta: (chunk) => {
              acc += chunk;
              if (mountedRef.current) {
                setResearching(false);
                setStreamingReply(acc);
                scrollToBottom();
              }
            },
            onTransactionDrafts: (drafts) => {
              if (mountedRef.current) {
                const withIds: ParsedTransactionDraft[] = drafts.map((d, i) => ({
                  ...d,
                  id: `${Date.now()}-${i}`,
                }));
                setPendingDrafts(withIds);
                scrollToBottom();
              }
            },
            onDone: () => resolve(acc),
            onError: (err) => reject(err),
          });
        });

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: finalText || 'Maaf, aku gak bisa nge-response sekarang.',
          timestamp: Date.now(),
        };
        const finalMessages = [...afterUserMessage, assistantMessage];
        messagesRef.current = finalMessages;
        const stillMounted = mountedRef.current;
        if (stillMounted) {
          setMessages(finalMessages);
        }
        persistChatSession({
          messages: finalMessages,
          startedAt: startedAtRef.current,
          unreadReplyAt: stillMounted ? null : assistantMessage.timestamp,
        });
      } catch (err) {
        console.error('[Chat] Error:', err);
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'Maaf, lagi ada gangguan. Coba lagi ya.',
          timestamp: Date.now(),
        };
        const finalMessages = [...afterUserMessage, errorMessage];
        messagesRef.current = finalMessages;
        const stillMounted = mountedRef.current;
        if (stillMounted) {
          setMessages(finalMessages);
        }
        persistChatSession({
          messages: finalMessages,
          startedAt: startedAtRef.current,
          unreadReplyAt: stillMounted ? null : errorMessage.timestamp,
        });
      } finally {
        streamHandleRef.current = null;
        if (mountedRef.current) {
          setLoading(false);
          setStreamingReply(null);
          setResearching(false);
          scrollToBottom();
        }
      }
    },
    [profile?.user_id, loading, scrollToBottom]
  );

  const handleSaveChatDrafts = useCallback(async () => {
    if (!profile?.user_id || pendingDrafts.length === 0) return;

    setIsSavingDrafts(true);
    try {
      const items = pendingDrafts.map((d) => ({
        user_id: profile.user_id!,
        type: d.type,
        merchant: d.merchant ?? 'Unknown',
        total: d.total ?? 0,
        category: d.category ?? 'Lainnya',
        transaction_date: d.transaction_date ?? new Date().toISOString().split('T')[0],
        payment_method: d.payment_method || undefined,
        notes: d.notes || undefined,
        source_name: 'chat-input',
      }));

      const saved = await bulkCreateTransactions(items);
      const totalSaved = items.reduce((sum, i) => sum + i.total, 0);

      const successMsg: ChatMessage = {
        role: 'assistant',
        content: `Tersimpan! ${saved.length} transaksi berhasil dicatat (total Rp ${totalSaved.toLocaleString('id-ID')}). Data udah masuk ke summary kamu.`,
        timestamp: Date.now(),
      };
      const finalMessages = [...messagesRef.current, successMsg];
      messagesRef.current = finalMessages;
      if (mountedRef.current) {
        setMessages(finalMessages);
        setPendingDrafts([]);
        scrollToBottom();
      }
      persistChatSession({
        messages: finalMessages,
        startedAt: startedAtRef.current,
        unreadReplyAt: null,
      });
    } catch (err) {
      console.error('[Chat] Draft save error:', err);
      if (mountedRef.current) {
        const errMsg: ChatMessage = {
          role: 'assistant',
          content: 'Gagal menyimpan transaksi. Coba lagi ya.',
          timestamp: Date.now(),
        };
        const finalMessages = [...messagesRef.current, errMsg];
        messagesRef.current = finalMessages;
        setMessages(finalMessages);
        scrollToBottom();
      }
    } finally {
      if (mountedRef.current) setIsSavingDrafts(false);
    }
  }, [profile?.user_id, pendingDrafts, scrollToBottom]);

  const handleRemoveChatDraft = useCallback((id: string) => {
    setPendingDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isUnread = !isUser && unreadReplyAt !== null && item.timestamp >= unreadReplyAt;
    const animateIn = item.timestamp >= mountTimeRef.current;

    return (
      <MessageBubble item={item} isUser={isUser} isUnread={isUnread} animateIn={animateIn} colors={colors} />
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
        <PulsingDot color={colors.success} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => `${item.timestamp}-${item.role}`}
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
              {SUGGESTION_PROMPTS.map((prompt, index) => (
                <SuggestionChip key={prompt} label={prompt} index={index} colors={colors} onPress={() => handleSend(prompt)} />
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          <>
            {loading ? (
              streamingReply ? (
                <View style={{ paddingHorizontal: 20, marginVertical: 6, flexDirection: 'row' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 4 }}>
                    <IconSymbol name="bot.fill" size={16} color="#0a0a0a" />
                  </View>
                  <View style={{ maxWidth: '75%', backgroundColor: colors.cardSecondary, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{streamingReply}</Text>
                  </View>
                </View>
              ) : researching ? (
                <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <IconSymbol name="magnifyingglass" size={16} color="#0a0a0a" />
                  </View>
                  <ResearchingIndicator color={colors.primary} dimColor={colors.textTertiary} />
                </View>
              ) : (
                <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                    <EqualizerTyping color="#0a0a0a" />
                  </View>
                  <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Monetra AI lagi mikir...</Text>
                </View>
              )
            ) : null}

            {/* Transaction Drafts — inline as assistant bubble */}
            {pendingDrafts.length > 0 && (
              <View style={{ paddingHorizontal: 20, marginVertical: 6, flexDirection: 'row' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 4 }}>
                  <IconSymbol name="bot.fill" size={16} color="#0a0a0a" />
                </View>
                <View style={{ maxWidth: '85%', flexShrink: 1 }}>
                  {/* Header bubble */}
                  <View style={{ backgroundColor: colors.cardSecondary, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>
                      {pendingDrafts.length} Transaksi Siap Disimpan
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                      Cek data di bawah, edit kalo perlu, terus klik Simpan.
                    </Text>
                  </View>

                  {/* Draft cards */}
                  {pendingDrafts.map((draft, idx) => (
                    <View
                      key={draft.id}
                      style={{
                        backgroundColor: colors.cardSecondary,
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                          {draft.merchant || 'Tanpa nama'}
                        </Text>
                        <Pressable onPress={() => handleRemoveChatDraft(draft.id)} style={{ padding: 4, marginLeft: 8 }}>
                          <IconSymbol name="xmark" size={14} color={colors.textTertiary} />
                        </Pressable>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <View style={{ backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                            Rp {(draft.total ?? 0).toLocaleString('id-ID')}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{draft.category || 'Lainnya'}</Text>
                        </View>
                        <View style={{ backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{draft.transaction_date || '-'}</Text>
                        </View>
                        <View style={{ backgroundColor: draft.type === 'money_saving' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: draft.type === 'money_saving' ? colors.success : colors.error, fontSize: 12, fontWeight: '500' }}>
                            {draft.type === 'money_saving' ? 'Saving' : 'Expense'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  {/* Save button */}
                  <Pressable
                    onPress={handleSaveChatDrafts}
                    disabled={isSavingDrafts}
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      marginTop: 4,
                    }}
                  >
                    {isSavingDrafts ? (
                      <>
                        <ActivityIndicator size="small" color="#0a0a0a" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>Menyimpan...</Text>
                      </>
                    ) : (
                      <>
                        <IconSymbol name="checkmark.circle.fill" size={18} color="#0a0a0a" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#0a0a0a', fontWeight: 'bold', fontSize: 14 }}>
                          Simpan {pendingDrafts.length} Transaksi
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </>
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
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
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
              borderWidth: 1.5,
              borderColor: inputFocused ? colors.primary : 'transparent',
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any, outlineWidth: 0 } : null),
            }}
          />
          <Pressable
            onPress={() => handleSend(input)}
            onPressIn={pressSendIn}
            onPressOut={pressSendOut}
            disabled={!input.trim() || loading}
          >
            <Animated.View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || loading ? 0.5 : 1,
                transform: [{ scale: sendScale }],
              }}
            >
              <IconSymbol name="arrow.up" size={20} color="#0a0a0a" />
            </Animated.View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
