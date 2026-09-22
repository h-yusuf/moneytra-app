const LLM_BASE_URL = Deno.env.get('LLM_BASE_URL')!;
const LLM_API_KEY = Deno.env.get('LLM_API_KEY')!;
const CHAT_MODEL = Deno.env.get('CHAT_MODEL') || 'open-code';

interface ParseRequestBody {
  user_id: string;
  prompt: string;
}

interface ParsedTransaction {
  merchant: string | null;
  total: number | null;
  category: string | null;
  transaction_date: string | null;
  payment_method: string | null;
  notes: string;
  type: 'expense' | 'money_saving';
}

function getWIBDate(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utcMs + 7 * 3600000);
  return wib.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' WIB (GMT+7)';
}

const CATEGORY_LIST = [
  'Daily Meals',
  'Grooming Products',
  'Groceries',
  'Transport',
  'Internet',
  'Personal Treatments',
  'Life Style',
  'Health',
  'Social',
  'Saving',
  'Self Improvement',
  'Maintenance',
  'Capital Expenditure',
  'Investment',
  'Lainnya',
];

function buildSystemPrompt(): string {
  return `Cepat. Output JSON saja, tanpa reasoning/markdown. Parser transaksi Monetra.
Sekarang: ${getWIBDate()} (GMT+7). Resolve tanggal relatif ("hari ini","kemarin") dari sini.

Baca kalimat user → array JSON, 1 object per transaksi berbeda.

Field:
- merchant: nama toko/tempat (Title Case, min 2 char, bukan angka/simbol. null kalau gak disebut)
- total: nominal Rupiah, angka murni. "12k"/"12rb"=12000, "1.5jt"=1500000. null kalau gak ada
- transaction_date: YYYY-MM-DD. Default hari ini kalau gak disebut. null kalau invalid
- payment_method: "Cash"|"QRIS"|"Transfer"|"E-Wallet"|"Debit Card"|"Credit Card" atau null
- notes: catatan singkat max 200 char (boleh "")
- category: WAJIB salah satu (case-sensitive, jangan translate):
${CATEGORY_LIST.map((c) => `  - "${c}"`).join('\n')}
  Inferensi: makan siap/resto/gofood→Daily Meals | parfum/baju/skincare→Grooming Products | kebutuhan rumah di minimarket→Groceries | bensin/tiket/parkir→Transport | pulsa/data/wifi→Internet | jasa perawatan→Personal Treatments | nongkrong/hobi/travel→Life Style | obat/RS/BPJS→Health | sedekah/kado→Social | nabung/tabungan→Saving | kursus/tools→Self Improvement | service→Maintenance | aset besar→Capital Expenditure | emas/crypto/saham→Investment | ragu→Lainnya
- type: "money_saving" kalau category="Saving" atau menyebut nabung/tabungan, selain itu "expense"

Aturan:
- merchant/total null → tetap keluarkan object-nya, jangan di-skip atau diarang nilai
- Transaksi berbeda (nominal/tempat/tanggal beda) = object terpisah
- Output HANYA: {"transactions":[{"merchant":...,"total":0,"category":"...","transaction_date":"YYYY-MM-DD","payment_method":...,"notes":"","type":"expense"}]}`;
}

function extractJson(raw: string): { transactions: ParsedTransaction[] } {
  let text = String(raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Common failure: max_tokens cut the JSON mid-stream, so the array is
    // missing its closing `]` and/or `}`. Try to patch a minimal tail.
    const patched = text.replace(/,\s*$/, '').replace(/[\]}]*\s*$/, '') + ']}';
    parsed = JSON.parse(patched);
  }
  if (!Array.isArray((parsed as { transactions?: unknown }).transactions)) {
    throw new Error('AI response missing "transactions" array');
  }
  return parsed as { transactions: ParsedTransaction[] };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const body: ParseRequestBody = await req.json();

    if (!body.user_id || !body.prompt || !body.prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'user_id dan prompt wajib diisi' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    // Guard against excessively long prompts that would blow up the LLM
    // context window or cause the JSON response to truncate at max_tokens.
    const MAX_PROMPT_CHARS = 1000;
    if (body.prompt.length > MAX_PROMPT_CHARS) {
      return new Response(
        JSON.stringify({
          error: `Prompt terlalu panjang (${body.prompt.length} char). Maksimal ${MAX_PROMPT_CHARS} char. Coba pecah jadi beberapa input.`,
        }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const llmResponse = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: body.prompt },
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => 'No response body');
      console.error('[parse-transactions-prompt] LLM error:', llmResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `LLM request failed (${llmResponse.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content ?? '{}';

    let result: { transactions: ParsedTransaction[] };
    try {
      result = extractJson(content);
    } catch (parseErr) {
      console.error('[parse-transactions-prompt] JSON parse failed:', content);
      return new Response(
        JSON.stringify({ error: 'Gagal parse hasil AI jadi JSON', raw: String(content).slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[parse-transactions-prompt] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
});
