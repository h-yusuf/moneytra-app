import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

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

  useEffect(() => {
    loadSettings();
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

  return (
    <NotificationContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
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
