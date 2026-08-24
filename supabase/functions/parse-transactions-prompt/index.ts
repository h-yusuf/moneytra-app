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

function buildSystemPrompt(): string {
  return `Kamu adalah parser transaksi keuangan untuk aplikasi Monetra.
Sekarang: ${getWIBDate()}. User berada di Indonesia (GMT+7). Gunakan tanggal ini untuk resolve tanggal relatif seperti "hari ini", "kemarin", "tadi pagi" — JANGAN menebak tanggal lain.

Tugas kamu: baca kalimat user yang menyebutkan satu atau lebih transaksi keuangan, dan ubah jadi array JSON, satu object per transaksi berbeda yang disebut.

Field per transaksi:
- merchant: nama toko/tempat/tujuan (string, atau null kalau gak disebut/gak jelas)
- total: nominal transaksi dalam Rupiah, angka murni tanpa pemisah ribuan. "12k"/"12rb" = 12000. Kalau gak ada nominal yang jelas -> null
- category: kategori transaksi, infer dari konteks (contoh: "Belanja Harian", "Makanan & Minuman", "Transportasi", "Kesehatan", "Hiburan", "Pakaian", "Elektronik", "Pendidikan", "Tagihan", "Transfer", "Tabungan", "Lainnya"). JANGAN pernah null — default "Lainnya"
- transaction_date: format YYYY-MM-DD, resolve dari kata relatif atau tanggal eksplisit. Kalau gak disebut sama sekali -> pakai tanggal hari ini
- payment_method: "Cash", "QRIS", "Transfer", "E-Wallet", atau null kalau gak disebut
- notes: catatan singkat tambahan (string, boleh kosong "")
- type: "money_saving" kalau kalimat menyebut nabung/menabung/tabungan/tabungan nikah, selain itu "expense". Satu prompt bisa hasilkan campuran keduanya kalau user sebut lebih dari satu transaksi dengan konteks berbeda

PENTING:
- Kalau merchant atau total gak bisa ditentukan untuk sebuah transaksi yang disebut, tetap keluarkan object-nya dengan field itu null — JANGAN dihapus/di-skip, dan JANGAN mengarang nilai.
- Setiap kalimat/klausa yang menyebut transaksi berbeda (nominal berbeda, tempat berbeda, atau tanggal berbeda) adalah transaksi TERPISAH.
- Return HANYA JSON object dengan struktur ini, tanpa markdown, tanpa penjelasan:

{"transactions": [{"merchant": "string atau null", "total": 0, "category": "string", "transaction_date": "YYYY-MM-DD", "payment_method": "string atau null", "notes": "", "type": "expense"}]}`;
}

function extractJson(raw: string): { transactions: ParsedTransaction[] } {
  let text = String(raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.transactions)) {
    throw new Error('AI response missing "transactions" array');
  }
  return parsed;
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
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
});
