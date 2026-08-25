import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { registerPushToken, storePushToken } from '@/src/services/notificationService';

export interface NotificationSettings {
  enabled: boolean;
  budgetAlerts: boolean;
  transactionReminders: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

interface NotificationContextType {
  settings: NotificationSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<NotificationSettings>) => Promise<void>;
  pushToken: string | null;
  isRegistered: boolean;
  requestPermissionAndRegister: (userId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = '@notification_settings';

const defaultSettings: NotificationSettings = {
  enabled: true,
  budgetAlerts: true,
  transactionReminders: true,
  weeklyReports: false,
  monthlyReports: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: settingsRef.current.enabled,
        shouldShowList: settingsRef.current.enabled,
        shouldPlaySound: settingsRef.current.soundEnabled,
        shouldSetBadge: false,
      }),
    });
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      throw error;
    }
  };

  const requestPermissionAndRegister = async (userId: string) => {
    if (Platform.OS === 'web') return;
    if (!userId) return;

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        await updateSettings({ enabled: false });
        console.warn('Push notification permission denied');
        return;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('Push notification registration failed: missing EAS projectId');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

      const token = tokenData.data;
      await storePushToken(token);
      setPushToken(token);

      await registerPushToken(userId, token);
      setIsRegistered(true);
      if (__DEV__) console.log('Push token registered:', token);
    } catch (error) {
      console.error('Push notification registration failed:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        pushToken,
        isRegistered,
        requestPermissionAndRegister,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
