const LLM_BASE_URL = Deno.env.get('LLM_BASE_URL')!;
const LLM_API_KEY = Deno.env.get('LLM_API_KEY')!;
const CHAT_MODEL = Deno.env.get('CHAT_MODEL') || 'open-code';

interface ParseRequestBody {
  user_id: string;
  ocr_text: string;
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
  return wib.toISOString().split('T')[0];
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
  return `Parser mutasi rekening bank → array transaksi Monetra. Output JSON saja, tanpa reasoning/markdown.
Tanggal referensi: ${getWIBDate()} (GMT+7).

Input: raw OCR text dari screenshot mutasi rekening/m-banking. Format bisa berupa tabel mutasi dengan kolom tanggal, keterangan, nominal. Bisa juga campuran baris tidak beraturan akibat OCR.

Tugas: baca setiap baris mutasi → 1 object transaksi. Abaikan header tabel, saldo awal/akhir, dan baris non-transaksi.

Field:
- merchant: nama merchant/berita transaksi (dari kolom keterangan/berita). Title Case. null kalau gak jelas
- total: nominal transaksi, angka murni tanpa pemisah. Untuk pengeluaran: nominal utama. Untuk masuk: tetap positif. null kalau gak parseable
- transaction_date: YYYY-MM-DD dari kolom tanggal mutasi. Kalau cuma tanggal tanpa tahun, pakai tahun sekarang. null kalau invalid
- payment_method: inferensi dari berita: "Transfer"|"QRIS"|"E-Wallet"|"Debit Card"|"Credit Card"|"Cash" atau null
- notes: berita/keterangan asli singkat, max 200 char (boleh "")
- category: WAJIB salah satu (case-sensitive):
${CATEGORY_LIST.map((c) => `  - "${c}"`).join('\n')}
  Inferensi: makan/resto/gofood→Daily Meals | parfum/baju/skincare→Grooming Products | minimarket/supermarket→Groceries | bensin/tol/parkir→Transport | pulsa/data/internet→Internet | salon/barber→Personal Treatments | hobi/travel→Life Style | obat/RS→Health | sedekah→Social | nabung→Saving | kursus→Self Improvement | service→Maintenance | aset besar→Capital Expenditure | investasi→Investment | ragu→Lainnya
- type: 
  - Uang KELUAR (debit/mengurangi saldo) → "expense"
  - Uang MASUK (credit/menambah saldo, kecuali nabung) → "money_saving"
  - Transfer masuk dari pihak lain, refund, cashback → "money_saving"
  - Nabung/tabungan sendiri → "money_saving"

Aturan penting:
- Setiap baris mutasi = 1 transaksi terpisah
- Abaikan: "SALDO AWAL", "SALDO AKHIR", "SALDO BUKU", header tabel
- Kalau nominal ada tanda minus/(-) → expense. Kalau ada tanda +/CR → money_saving
- merchant null kalau berita cuma angka/kode transaksi
- Tanggal relatif ("kemarin", "h-1") → resolve dari tanggal referensi
- Maksimal 50 transaksi per request

Output HANYA: {"transactions":[{"merchant":null,"total":0,"category":"Lainnya","transaction_date":"YYYY-MM-DD","payment_method":null,"notes":"","type":"expense"}]}`;
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
    // max_tokens may cut the JSON mid-stream — patch a minimal tail
    const patched = text.replace(/,\s*$/, '').replace(/[\]}]*\s*$/, '') + ']}';
    parsed = JSON.parse(patched);
  }
  if (!Array.isArray((parsed as { transactions?: unknown }).transactions)) {
    // Maybe the LLM returned a bare array
    if (Array.isArray(parsed)) {
      return { transactions: parsed as ParsedTransaction[] };
    }
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

    if (!body.user_id || !body.ocr_text || !body.ocr_text.trim()) {
      return new Response(
        JSON.stringify({ error: 'user_id dan ocr_text wajib diisi' }),
        { status: 400, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    // Mutasi text can be very long (20-50 lines). Guard at 8000 chars.
    const MAX_OCR_CHARS = 8000;
    if (body.ocr_text.length > MAX_OCR_CHARS) {
      return new Response(
        JSON.stringify({
          error: `Teks mutasi terlalu panjang (${body.ocr_text.length} char, maks ${MAX_OCR_CHARS}). Crop screenshot atau pecah jadi beberapa foto.`,
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
          { role: 'user', content: body.ocr_text },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => 'No response body');
      console.error('[parse-mutasi] LLM error:', llmResponse.status, errText);
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
      console.error('[parse-mutasi] JSON parse failed:', content);
      return new Response(
        JSON.stringify({ error: 'Gagal parse hasil AI jadi JSON', raw: String(content).slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[parse-mutasi] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
});