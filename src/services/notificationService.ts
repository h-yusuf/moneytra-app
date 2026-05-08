import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/src/lib/api';

const PUSH_TOKEN_KEY = '@push_token';

export async function registerPushToken(userId: string, token: string): Promise<void> {
  await apiClient.post('/webhook/register-token', {
    user_id: userId,
    push_token: token,
  });
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}
