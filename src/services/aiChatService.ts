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

// ─── sendChatMessageStream ────────────────────────────────────────────────────
// Uses XMLHttpRequest (not fetch) because RN's fetch is a whatwg-fetch polyfill
// on top of XHR with no real incremental Response.body streaming — XHR's
// onprogress firing with a growing responseText is the actual stream source.

export interface StreamCallbacks {
  onSummary?: (summary: NonNullable<ChatResponse['summary']>) => void;
  onResearchStart?: (query: string) => void;
  onResearchDone?: () => void;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export interface StreamHandle {
  abort: () => void;
}

export function sendChatMessageStream(
  userId: string,
  message: string,
  history: ChatMessage[] | undefined,
  callbacks: StreamCallbacks
): StreamHandle {
  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/ai-chat`;
  const xhr = new XMLHttpRequest();
  let readOffset = 0;
  let buffer = '';
  let settled = false;

  const finish = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
  };

  const processChunk = (text: string) => {
    buffer += text;
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === 'summary' && parsed.summary) {
          callbacks.onSummary?.(parsed.summary);
        } else if (parsed.type === 'research_start') {
          callbacks.onResearchStart?.(parsed.query ?? '');
        } else if (parsed.type === 'research_done') {
          callbacks.onResearchDone?.();
        } else if (parsed.type === 'content' && typeof parsed.content === 'string') {
          callbacks.onDelta(parsed.content);
        } else if (parsed.type === 'done') {
          finish(callbacks.onDone);
        }
      } catch {
        // Ignore malformed/partial frames
      }
    }
  };

  xhr.open('POST', edgeFunctionUrl);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);

  xhr.onprogress = () => {
    const newText = xhr.responseText.slice(readOffset);
    readOffset = xhr.responseText.length;
    if (newText) processChunk(newText);
  };

  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      finish(() => callbacks.onError(new Error(`Chat stream failed: ${xhr.status}`)));
      return;
    }
    // Catch any trailing frame the last onprogress tick missed.
    const newText = xhr.responseText.slice(readOffset);
    if (newText) processChunk(newText);
    finish(callbacks.onDone);
  };

  xhr.onerror = () => {
    finish(() => callbacks.onError(new Error('Chat stream network error')));
  };

  xhr.send(
    JSON.stringify({
      user_id: userId,
      message,
      history: history?.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    })
  );

  return {
    abort: () => {
      settled = true;
      xhr.abort();
    },
  };
}
