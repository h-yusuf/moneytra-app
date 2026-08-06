import type { ChatMessage, ChatResponse } from '@/src/types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function sendChatMessage(
  userId: string,
  message: string,
  history?: ChatMessage[]
): Promise<ChatResponse> {
  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/ai-chat`;

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      user_id: userId,
      message,
      history: history?.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[aiChatService] Error:', response.status, errText);
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const data = await response.json();
  return data as ChatResponse;
}
