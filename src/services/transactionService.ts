import { supabase } from '@/src/lib/supabase';
import type {
  GetTransactionsResponse,
  MonthlyReportData,
  MonthlyReportResponse,
  Transaction,
} from '@/src/types';

// ─── Fetch params types ──────────────────────────────────────────────────────

export interface FetchTransactionsParams {
  user_id?: string;
  type?: 'expense' | 'money_saving';
  limit?: number;
  offset?: number;
}

export interface FetchMonthlyReportParams {
  user_id?: string;
  year?: number;
  month?: number;
}

export interface FetchSpendingOverviewParams {
  year: number;
  month?: number;
}

export interface SpendingOverviewRecord {
  period: string;
  user_id: string;
  total_expense: number;
  total_income: number;
}

export interface CreateTransactionParams {
  user_id: string;
  type: 'expense' | 'money_saving';
  merchant: string;
  total: number;
  category: string;
  transaction_date: string;
  payment_method?: string;
  notes?: string;
  source_name?: string;
  file_url?: string;
}

// ─── fetchTransactions ───────────────────────────────────────────────────────

export async function fetchTransactions(
  params: FetchTransactionsParams = {}
): Promise<GetTransactionsResponse> {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params.user_id) query = query.eq('user_id', params.user_id);
  if (params.type) query = query.eq('type', params.type);
  if (params.limit) query = query.limit(params.limit);
  if (params.offset) query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;

  return { success: true, count: data.length, data: data as Transaction[] };
}

// ─── fetchSpendingOverview ───────────────────────────────────────────────────

export async function fetchSpendingOverview(
  params: FetchSpendingOverviewParams
): Promise<SpendingOverviewRecord[]> {
  const yearStart = `${params.year}-01-01`;
  const yearEnd = `${params.year}-12-31`;

  let query = supabase
    .from('spending_overview')
    .select('*')
    .gte('period', yearStart)
    .lte('period', yearEnd)
    .order('period', { ascending: true });

  if (params.month) {
    const monthStr = String(params.month).padStart(2, '0');
    const periodMonth = `${params.year}-${monthStr}-01`;
    query = supabase
      .from('spending_overview')
      .select('*')
      .eq('period', periodMonth);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as SpendingOverviewRecord[];
}

// ─── fetchMonthlyReport ──────────────────────────────────────────────────────

export async function fetchMonthlyReport(
  params: FetchMonthlyReportParams
): Promise<MonthlyReportResponse> {
  const year = params.year ?? new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  let query = supabase
    .from('transactions')
    .select('*')
    .gte('transaction_date', yearStart)
    .lte('transaction_date', yearEnd);

  if (params.user_id) query = query.eq('user_id', params.user_id);
  if (params.month) {
    const monthStr = String(params.month).padStart(2, '0');
    query = query
      .gte('transaction_date', `${year}-${monthStr}-01`)
      .lte('transaction_date', `${year}-${monthStr}-31`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const transactions = (data ?? []) as Transaction[];

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.total), 0);
  const totalMoneySaving = transactions
    .filter(t => t.type === 'money_saving')
    .reduce((sum, t) => sum + Number(t.total), 0);

  const monthMap = new Map<string, MonthlyReportData>();
  transactions.forEach(t => {
    const month = t.transaction_date?.slice(0, 7) ?? `${year}-01`;
    const prev = monthMap.get(month) ?? {
      month,
      expense: 0,
      money_saving: 0,
      total: 0,
      count: 0,
    };
    const amount = Number(t.total);
    monthMap.set(month, {
      month,
      expense: prev.expense + (t.type === 'expense' ? amount : 0),
      money_saving: prev.money_saving + (t.type === 'money_saving' ? amount : 0),
      total: prev.total + amount,
      count: prev.count + 1,
    });
  });
  const monthlyReport = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const catMap = new Map<string, { total: number; count: number }>();
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const cat = t.category ?? 'Lainnya';
      const prev = catMap.get(cat) ?? { total: 0, count: 0 };
      catMap.set(cat, { total: prev.total + Number(t.total), count: prev.count + 1 });
    });
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);

  return {
    success: true,
    user_id: params.user_id ?? 'default',
    year,
    month: params.month ?? null,
    summary: {
      total_expense: totalExpense,
      total_money_saving: totalMoneySaving,
      total_transactions: transactions.length,
    },
    monthly_report: monthlyReport,
    category_breakdown: categoryBreakdown,
  };
}

// ─── createTransaction ───────────────────────────────────────────────────────
// Calls create-transaction Edge Function which dual-writes to Supabase + Google Sheets

export async function createTransaction(
  params: CreateTransactionParams
): Promise<Transaction> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/create-transaction`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`createTransaction failed: ${errText}`);
  }

  const data = await response.json();
  return data as Transaction;
}
