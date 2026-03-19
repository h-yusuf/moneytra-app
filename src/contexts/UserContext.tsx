import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
}

interface UserContextType {
  profile: UserProfile | null;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_STORAGE_KEY = '@monetra_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  user_id: 'user-456',
  name: 'User',
  email: 'user@example.com',
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        setProfile(JSON.parse(stored));
      } else {
        setProfile(DEFAULT_PROFILE);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setProfile(DEFAULT_PROFILE);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const newProfile = { ...profile, ...updates } as UserProfile;
      setProfile(newProfile);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newProfile));
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  };

  return (
    <UserContext.Provider value={{ profile, updateProfile, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
