import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildExtractionPrompt } from './prompt.ts';
import { callGemini } from './providers/gemini.ts';
import { callOpenAI } from './providers/openai.ts';
import { callGroq } from './providers/groq.ts';
import { callDeepSeek } from './providers/deepseek.ts';
import { callAnthropic } from './providers/anthropic.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function extractWithProvider(
  imageBase64: string,
  mimeType: string,
  transactionType: string
): Promise<Record<string, unknown>> {
  const provider = Deno.env.get('PROVIDER') ?? 'gemini';
  const prompt = buildExtractionPrompt(transactionType);
  switch (provider) {
    case 'gemini':    return callGemini(imageBase64, mimeType, prompt);
    case 'openai':    return callOpenAI(imageBase64, mimeType, prompt);
    case 'groq':      return callGroq(imageBase64, mimeType, prompt);
    case 'deepseek':  return callDeepSeek(imageBase64, mimeType, prompt);
    case 'anthropic': return callAnthropic(imageBase64, mimeType, prompt);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('user_id') as string | null;
    const transactionType = (formData.get('transaction_type') as string) || 'expense';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const fileName = `${userId ?? 'default'}/${Date.now()}_${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, fileBuffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    const fileUrl = urlData.publicUrl;

    const uint8 = new Uint8Array(fileBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const imageBase64 = btoa(binary);
    const mimeType = file.type || 'image/jpeg';

    const extracted = await extractWithProvider(imageBase64, mimeType, transactionType);

    const result = {
      merchant: extracted.merchant ?? '',
      total: Number(extracted.total) || 0,
      category: extracted.category ?? 'Lainnya',
      transaction_date: extracted.transaction_date ?? new Date().toISOString().split('T')[0],
      notes: extracted.notes ?? '',
      payment_method: extracted.payment_method ?? 'Other',
      file_url: fileUrl,
    };

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
