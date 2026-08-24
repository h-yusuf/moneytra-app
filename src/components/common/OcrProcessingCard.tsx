import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/src/contexts/ThemeContext';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';

export type ProcessingStage = { icon: any; message: string };

const DEFAULT_OCR_STAGES: ProcessingStage[] = [
  { icon: 'doc.text.viewfinder', message: 'Membaca gambar struk...' },
  { icon: 'eye.fill', message: 'Mendeteksi teks & angka...' },
  { icon: 'sparkles', message: 'AI menganalisis transaksi...' },
  { icon: 'checklist', message: 'Menyusun hasil ekstraksi...' },
];

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function OcrProcessingCard({
  imageUri,
  stages = DEFAULT_OCR_STAGES,
}: {
  imageUri?: string;
  stages?: ProcessingStage[];
}) {
  const { colors } = useTheme();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const startRef = useRef(Date.now());

  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startRef.current = Date.now();
    const tick = setInterval(() => setElapsedMs(Date.now() - startRef.current), 100);

    const stageTimer = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      setStageIndex((i) => (i + 1) % stages.length);
    }, 2400);

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    );
    const barLoop = Animated.loop(
      Animated.timing(barAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );

    scanLoop.start();
    pulseLoop.start();
    rotateLoop.start();
    barLoop.start();

    return () => {
      clearInterval(tick);
      clearInterval(stageTimer);
      scanLoop.stop();
      pulseLoop.stop();
      rotateLoop.stop();
      barLoop.stop();
    };
  }, []);

  const scanTranslateY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 148] });
  const rotateDeg = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const barWidth = trackWidth * 0.4;
  const barTranslateX = barAnim.interpolate({ inputRange: [0, 1], outputRange: [-barWidth, trackWidth] });

  const stage = useMemo(() => stages[stageIndex], [stageIndex, stages]);

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
      {imageUri && (
        <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, height: 150 }}>
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', opacity: 0.5 }} resizeMode="cover" />
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', left: 0, right: 0, height: 44, top: 0,
              transform: [{ translateY: scanTranslateY }],
              backgroundColor: colors.primary, opacity: 0.12,
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', left: 0, right: 0, height: 2, top: 0,
              transform: [{ translateY: scanTranslateY }],
              backgroundColor: colors.primary,
              shadowColor: colors.primary, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
            }}
          />
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          <Animated.View
            style={{
              position: 'absolute', width: 48, height: 48, borderRadius: 24,
              borderWidth: 2, borderColor: 'transparent', borderTopColor: colors.primary,
              transform: [{ rotate: rotateDeg }],
            }}
          />
          <Animated.View
            style={{
              width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cardSecondary,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: pulseAnim }],
            }}
          >
            <IconSymbol name={stage.icon} size={18} color={colors.primary} />
          </Animated.View>
        </View>

        <View style={{ flex: 1 }}>
          <Animated.Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', opacity: fadeAnim }}>
            {stage.message}
          </Animated.Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
            Sedang diproses · {formatElapsed(elapsedMs)}
          </Text>
        </View>
      </View>

      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{ height: 4, borderRadius: 2, backgroundColor: colors.cardSecondary, overflow: 'hidden', marginTop: 14 }}
      >
        {trackWidth > 0 && (
          <Animated.View
            style={{
              width: barWidth, height: '100%', borderRadius: 2, backgroundColor: colors.primary,
              transform: [{ translateX: barTranslateX }],
            }}
          />
        )}
      </View>
    </View>
  );
}
