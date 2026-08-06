import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LLM_BASE_URL = Deno.env.get('LLM_BASE_URL')!;
const LLM_API_KEY = Deno.env.get('LLM_API_KEY')!;
const LLM_MODEL = Deno.env.get('LLM_MODEL') || 'open-code';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  user_id: string;
  message: string;
  history?: ChatMessage[];
}

interface FinancialSummary {
  total_expense: number;
  total_saving: number;
  transaction_count: number;
  this_month_expense: number;
  this_month_saving: number;
  top_categories: { category: string; total: number; count: number }[];
  top_merchants: { merchant: string; total: number; count: number }[];
  recent_transactions: {
    merchant: string;
    category: string;
    total: number;
    type: string;
    date: string;
  }[];
  saving_target?: number;
}

async function fetchFinancialSummary(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<FinancialSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  // All transactions
  const { data: allTx } = await supabase
    .from('transactions')
    .select('type, total, category, merchant, transaction_date')
    .eq('user_id', userId);

  const transactions = allTx ?? [];

  const total_expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.total, 0);
  const total_saving = transactions
    .filter((t) => t.type === 'money_saving')
    .reduce((sum, t) => sum + t.total, 0);

  // This month
  const thisMonthTx = transactions.filter((t) => {
    const d = new Date(t.transaction_date);
    return d >= new Date(monthStart) && d <= new Date(monthEnd);
  });

  const this_month_expense = thisMonthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.total, 0);
  const this_month_saving = thisMonthTx
    .filter((t) => t.type === 'money_saving')
    .reduce((sum, t) => sum + t.total, 0);

  // Top categories
  const catMap = new Map<string, { total: number; count: number }>();
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const existing = catMap.get(t.category) ?? { total: 0, count: 0 };
      existing.total += t.total;
      existing.count += 1;
      catMap.set(t.category, existing);
    });

  const top_categories = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top merchants
  const merchMap = new Map<string, { total: number; count: number }>();
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const existing = merchMap.get(t.merchant) ?? { total: 0, count: 0 };
      existing.total += t.total;
      existing.count += 1;
      merchMap.set(t.merchant, existing);
    });

  const top_merchants = Array.from(merchMap.entries())
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Recent 10 transactions
  const recent = [...transactions]
    .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
    .slice(0, 10);

  const recent_transactions = recent.map((t) => ({
    merchant: t.merchant,
    category: t.category,
    total: t.total,
    type: t.type,
    date: t.transaction_date,
  }));

  // Saving target from user_settings (if table exists)
  let saving_target: number | undefined;
  const { data: settings } = await supabase
    .from('user_settings')
    .select('saving_target')
    .eq('user_id', userId)
    .single();
  if (settings?.saving_target) {
    saving_target = settings.saving_target;
  }

  return {
    total_expense,
    total_saving,
    transaction_count: transactions.length,
    this_month_expense,
    this_month_saving,
    top_categories,
    top_merchants,
    recent_transactions,
    saving_target,
  };
}

function buildSystemPrompt(summary: FinancialSummary): string {
  return `Kamu adalah Monetra AI, asisten keuangan pribadi untuk aplikasi Monetra.
Kamu punya akses ke data keuangan user secara real-time. Tugas kamu:
- Analisa pola pengeluaran dan tabungan user
- Kasih rekomendasi keuangan yang actionable dan practical
- Jika user punya saving yang idle, rekomendasikan untuk dialokasikan (misal: RDN/reksadana, deposito, etc.)
- Gunakan bahasa casual Indonesia (campur EN/ID), friendly dan to the point
- Format angka dengan "Rp" prefix, gunakan format ribuan (contoh: Rp 1.500.000)

DATA KEUANGAN USER:
- Total Expense: Rp ${summary.total_expense.toLocaleString('id-ID')}
- Total Saving: Rp ${summary.total_saving.toLocaleString('id-ID')}
- Total Transaksi: ${summary.transaction_count}
- Expense Bulan Ini: Rp ${summary.this_month_expense.toLocaleString('id-ID')}
- Saving Bulan Ini: Rp ${summary.this_month_saving.toLocaleString('id-ID')}${summary.saving_target ? `\n- Target Tabungan: Rp ${summary.saving_target.toLocaleString('id-ID')}` : ''}

TOP CATEGORIES (Expense):
${summary.top_categories.map((c, i) => `${i + 1}. ${c.category}: Rp ${c.total.toLocaleString('id-ID')} (${c.count}x)`).join('\n')}

TOP MERCHANTS:
${summary.top_merchants.map((m, i) => `${i + 1}. ${m.merchant}: Rp ${m.total.toLocaleString('id-ID')} (${m.count}x)`).join('\n')}

RECENT TRANSACTIONS:
${summary.recent_transactions.map((t) => `- ${t.merchant} | ${t.category} | ${t.type} | Rp ${t.total.toLocaleString('id-ID')} | ${t.date}`).join('\n')}

Jawab pertanyaan user berdasarkan data di atas. Jika data tidak cukup, bilang saja. Jangan mengarang angka.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const body: ChatRequestBody = await req.json();
    const { user_id, message, history } = body;

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: 'user_id and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const summary = await fetchFinancialSummary(supabase, user_id);
    const systemPrompt = buildSystemPrompt(summary);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const llmResponse = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      console.error('[ai-chat] LLM error:', llmResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'LLM request failed', detail: errText }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const reply = llmData.choices?.[0]?.message?.content ?? 'Maaf, aku gak bisa nge-response sekarang.';

    return new Response(
      JSON.stringify({
        success: true,
        reply,
        summary: {
          total_expense: summary.total_expense,
          total_saving: summary.total_saving,
          this_month_expense: summary.this_month_expense,
          this_month_saving: summary.this_month_saving,
        },
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error) {
    console.error('[ai-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
