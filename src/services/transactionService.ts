import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { normalizeKey } from '@/src/utils/textFormat';
import type {
  GetTransactionsResponse,
  MonthlyReportData,
  MonthlyReportResponse,
  ParsedTransactionDraft,
  Transaction,
} from '@/src/types';

// ─── Fetch params types ──────────────────────────────────────────────────────

export interface FetchTransactionsParams {
  user_id?: string;
  type?: 'expense' | 'money_saving';
  limit?: number;
  offset?: number;
  date_from?: string; // YYYY-MM-DD, inclusive
  date_to?: string; // YYYY-MM-DD, inclusive
}

export interface FetchMonthlyReportParams {
  user_id?: string;
  year?: number;
  month?: number;
}

export interface FetchSpendingOverviewParams {
  year: number;
  month?: number;
  /**
   * When 'week', fetches the current calendar week (Mon–Sun) so transactions
   * that fall outside the selected month are still included. Used by the
   * analytics "week" view.
   */
  period?: 'week' | 'month' | 'year';
}

export interface SpendingOverviewRecord {
  period: string;
  user_id: string;
  total_expense: number;
  total_income: number;
}

export interface PeriodTransactionRecord {
  user_id: string;
  transaction_date: string;
  type: 'expense' | 'money_saving';
  total: number;
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

export interface ExtractedTransactionData {
  merchant: string;
  total: number;
  category: string;
  transaction_date: string;
  notes?: string;
  payment_method?: string;
  file_url?: string;
}

export interface ExtractTransactionParams {
  file: File | { uri: string; type: string; name: string };
  user_id: string;
  transaction_type: 'expense' | 'money_saving';
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
  if (params.date_from) query = query.gte('transaction_date', params.date_from);
  if (params.date_to) query = query.lte('transaction_date', params.date_to);
  if (params.limit) query = query.limit(params.limit);
  if (params.offset) query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;

  return { success: true, count: data.length, data: data as Transaction[] };
}

// ─── fetchCategoryMerchantSuggestions ────────────────────────────────────────

export interface FieldSuggestion {
  value: string;
  count: number;
}

function buildSuggestions(values: (string | null | undefined)[]): FieldSuggestion[] {
  const map = new Map<string, FieldSuggestion>();
  for (const raw of values) {
    if (!raw || !raw.trim()) continue;
    const key = normalizeKey(raw);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { value: raw.trim(), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export async function fetchCategoryMerchantSuggestions(): Promise<{
  categories: FieldSuggestion[];
  merchants: FieldSuggestion[];
}> {
  const { data, error } = await supabase.from('transactions').select('category, merchant');
  if (error) throw error;

  const rows = (data ?? []) as { category: string | null; merchant: string | null }[];
  return {
    categories: buildSuggestions(rows.map(r => r.category)),
    merchants: buildSuggestions(rows.map(r => r.merchant)),
  };
}

// ─── fetchSpendingOverview ───────────────────────────────────────────────────

export async function fetchSpendingOverview(
  params: FetchSpendingOverviewParams
): Promise<SpendingOverviewRecord[]> {
  // Yearly view: use the pre-aggregated spending_overview table
  if (!params.month) {
    const yearStart = `${params.year}-01-01`;
    const yearEnd = `${params.year}-12-31`;

    const { data, error } = await supabase
      .from('spending_overview')
      .select('*')
      .gte('period', yearStart)
      .lte('period', yearEnd)
      .order('period', { ascending: true });

    if (error) throw error;
    return (data ?? []) as SpendingOverviewRecord[];
  }

  // Week/Month view: aggregate raw transactions client-side for daily/weekly granularity
  let rangeStart: string;
  let rangeEnd: string;

  if (params.period === 'week') {
    // Selected month ± padding so the calendar week (Mon–Sun) that overlaps the
    // month start (or today, when viewing the current month) is fully included
    // even if it spans into the previous/next month.
    const monthStr = String(params.month).padStart(2, '0');
    const monthStart = new Date(params.year, (params.month ?? 1) - 1, 1);
    const paddedStart = new Date(monthStart);
    paddedStart.setDate(monthStart.getDate() - 6);
    const paddedEnd = new Date(params.year, (params.month ?? 1), 7); // ~end of month + 6
    rangeStart = paddedStart.toISOString().split('T')[0];
    rangeEnd = paddedEnd.toISOString().split('T')[0];
    void monthStr;
  } else {
    const monthStr = String(params.month).padStart(2, '0');
    rangeStart = `${params.year}-${monthStr}-01`;
    rangeEnd = `${params.year}-${monthStr}-31`;
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('user_id, transaction_date, type, total')
    .gte('transaction_date', rangeStart)
    .lte('transaction_date', rangeEnd);

  if (error) throw error;

  const records = (data ?? []) as PeriodTransactionRecord[];
  const result: SpendingOverviewRecord[] = [];

  // Aggregate per (user, day) — chart groups into days/weeks as needed
  const userDayMap = new Map<string, { total_expense: number; total_income: number }>();
  for (const t of records) {
    if (!t.transaction_date) continue;
    const day = t.transaction_date.slice(0, 10); // YYYY-MM-DD
    const key = `${t.user_id}|${day}`;
    const prev = userDayMap.get(key) ?? { total_expense: 0, total_income: 0 };
    const amount = Number(t.total) || 0;
    if (t.type === 'expense') prev.total_expense += amount;
    else if (t.type === 'money_saving') prev.total_income += amount;
    userDayMap.set(key, prev);
  }

  for (const [key, totals] of userDayMap.entries()) {
    const [user_id, period] = key.split('|');
    result.push({
      period,
      user_id,
      total_expense: totals.total_expense,
      total_income: totals.total_income,
    });
  }

  result.sort((a, b) => a.period.localeCompare(b.period));
  return result;
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
    const monthStart = new Date(year, params.month - 1, 1);
    const monthEnd = new Date(year, params.month, 0); // day 0 = last day of prev month
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    query = query
      .gte('transaction_date', fmt(monthStart))
      .lte('transaction_date', fmt(monthEnd));
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

// ─── uploadReceiptImage ──────────────────────────────────────────────────────
// Resize to max 1200px, quality 0.75 (~300KB) before upload to Supabase Storage

export async function uploadReceiptImage(uri: string, userId: string): Promise<string | null> {
  try {
    const fileName = `${userId}/${Date.now()}.jpg`;

    if (Platform.OS === 'web') {
      // Web: fetch blob URI → Blob → upload
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) { console.error('[uploadReceiptImage] web upload error:', error); return null; }
    } else {
      // Native: resize first, then fetch as arrayBuffer
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      const response = await fetch(manipulated.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error } = await supabase.storage
        .from('receipts')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (error) { console.error('[uploadReceiptImage] native upload error:', error); return null; }
    }

    const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
    if (__DEV__) console.log('[uploadReceiptImage] success:', data.publicUrl);
    return data.publicUrl;
  } catch (err) {
    console.error('[uploadReceiptImage] exception:', err);
    return null;
  }
}

// ─── extractTransaction ──────────────────────────────────────────────────────

export async function extractTransaction(
  params: ExtractTransactionParams
): Promise<ExtractedTransactionData> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

  const formData = new FormData();
  formData.append('user_id', params.user_id);
  formData.append('type', params.transaction_type);

  if (__DEV__) {
    console.log('[extractTransaction] Sending file for OCR:', {
      uri: (params.file as any)?.uri,
      type: (params.file as any)?.type,
      name: (params.file as any)?.name,
      size: (params.file as any)?.size,
    });
  }

  if (isWeb) {
    const response = await fetch((params.file as any).uri);
    const blob = await response.blob();
    const mimeType = (params.file as any).type || blob.type || 'image/jpeg';
    const fileName = (params.file as any).name || `upload_${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: mimeType });
    formData.append('file', file);
  } else {
    // @ts-ignore - React Native FormData typing
    formData.append('file', {
      uri: (params.file as any).uri,
      type: (params.file as any).type || 'image/jpeg',
      name: (params.file as any).name || 'upload.jpg',
    });
  }

  const response = await fetch(`${apiUrl}/webhook/uploadDoc`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'No response body');
    console.error('[extractTransaction] OCR failed:', { status: response.status, body: errText });
    throw new Error(`Gagal OCR (HTTP ${response.status}): ${errText || 'Server returned error'}`);
  }

  const responseText = await response.text().catch(() => '');
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (parseErr) {
    console.error('[extractTransaction] JSON parse failed:', responseText);
    throw new Error(`Gagal OCR: response bukan JSON valid. Raw: ${responseText.slice(0, 200)}`);
  }
  if (__DEV__) console.log('[extractTransaction] OCR success:', data);
  return {
    merchant: data.merchant ?? '',
    total: Number(data.total) || 0,
    category: data.category ?? 'Lainnya',
    transaction_date: data.transaction_date ?? new Date().toISOString().split('T')[0],
    notes: data.notes ?? '',
    payment_method: data.payment_method ?? '',
  } as ExtractedTransactionData;
}

// ─── createTransaction ───────────────────────────────────────────────────────
// Calls create-transaction Edge Function which dual-writes to Supabase + Google Sheets

export async function createTransaction(
  params: CreateTransactionParams
): Promise<Transaction> {
  const { data, error } = await supabase.functions.invoke<Transaction>('create-transaction', {
    body: params,
  });

  if (error) {
    if (__DEV__) console.error('[createTransaction] Save failed:', error);
    throw new Error(`Gagal menyimpan data: ${error.message}`);
  }
  return data as Transaction;
}

// ─── parseTransactionsFromPrompt ─────────────────────────────────────────────

export async function parseTransactionsFromPrompt(
  userId: string,
  prompt: string
): Promise<ParsedTransactionDraft[]> {
  const { data, error } = await supabase.functions.invoke<{
    transactions: Omit<ParsedTransactionDraft, 'id'>[];
  }>('parse-transactions-prompt', {
    body: { user_id: userId, prompt },
  });

  if (error) {
    if (__DEV__) console.error('[parseTransactionsFromPrompt] Failed:', error);
    throw new Error(`Gagal parse prompt: ${error.message}`);
  }

  return (data?.transactions ?? []).map((t, index) => ({
    ...t,
    id: `${Date.now()}-${index}`,
  }));
}

// ─── bulkCreateTransactions ───────────────────────────────────────────────────

export async function bulkCreateTransactions(
  items: CreateTransactionParams[]
): Promise<Transaction[]> {
  const { data, error } = await supabase.functions.invoke<{ data: Transaction[] }>(
    'bulk-create-transactions',
    { body: { transactions: items } }
  );

  if (error) {
    if (__DEV__) console.error('[bulkCreateTransactions] Save failed:', error);
    throw new Error(`Gagal menyimpan data: ${error.message}`);
  }

  return data?.data ?? [];
}
