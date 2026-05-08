import { BudgetProvider } from '@/src/contexts/BudgetContext';
import { NotificationProvider, useNotification } from '@/src/contexts/NotificationContext';
import { ThemeProvider, useTheme } from '@/src/contexts/ThemeContext';
import { UserProvider, useUser } from '@/src/contexts/UserContext';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppInitializer() {
  const { profile } = useUser();
  const { requestPermissionAndRegister } = useNotification();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = profile?.user_id;
    if (!userId || userId === lastUserId.current) return;
    lastUserId.current = userId;
    requestPermissionAndRegister(userId);
  }, [profile?.user_id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(_response => {
      // Future: navigate to history tab
    });
    return () => sub.remove();
  }, []);

  return null;
}

function RootNavigator() {
  const { isDark } = useTheme();

  return (
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[Monetra SW] Registration failed:', err);
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <UserProvider>
        <BudgetProvider>
          <NotificationProvider>
            <AppInitializer />
            <RootNavigator />
          </NotificationProvider>
        </BudgetProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
