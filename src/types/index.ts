export type TransactionType = 'expense' | 'money_saving';

export type PaymentMethod = 'QRIS' | 'Cash' | 'Debit' | 'Credit' | 'Transfer' | 'E-Wallet' | 'Other';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  source_name?: string;
  transaction_date: string;
  merchant: string;
  category: string;
  payment_method: PaymentMethod;
  total: number;
  notes?: string;
  file_url?: string;
  created_at: string;
}

export interface DashboardSummary {
  total_expense: number;
  total_money_saving: number;
  total_transactions: number;
  expense_growth: number;
  savings_growth: number;
  top_category: {
    name: string;
    total: number;
  };
  top_merchant: {
    name: string;
    total: number;
  };
}

export interface MonthlyTrend {
  month: string;
  expense: number;
  savings: number;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
}

export interface UploadResponse {
  tanggal: string;
  merchant: string;
  kategori: string;
  payment_method: string;
  total: string;
  notes?: string;
}

export interface GetTransactionsResponse {
  success: boolean;
  count: number;
  data: Transaction[];
}

export interface MonthlyReportData {
  month: string;
  expense: number;
  money_saving: number;
  total: number;
  count: number;
}

export interface CategoryBreakdownData {
  category: string;
  total: number;
  count: number;
}

export interface MonthlyReportResponse {
  success: boolean;
  user_id: string;
  year: number;
  month: number | null;
  summary: {
    total_expense: number;
    total_money_saving: number;
    total_transactions: number;
  };
  monthly_report: MonthlyReportData[];
  category_breakdown: CategoryBreakdownData[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  success: boolean;
  reply: string;
  summary?: {
    total_expense: number;
    total_saving: number;
    this_month_expense: number;
    this_month_saving: number;
  };
}

export interface ParsedTransactionDraft {
  id: string;
  merchant: string | null;
  total: number | null;
  category: string | null;
  transaction_date: string | null;
  payment_method?: string | null;
  notes?: string;
  type: 'expense' | 'money_saving';
}

export interface ParseTransactionsPromptResponse {
  transactions: ParsedTransactionDraft[];
}

export type RecurringIntervalUnit = 'week' | 'month' | 'year';

export interface RecurringItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  interval_unit: RecurringIntervalUnit;
  interval_value: number;
  next_due_date: string; // YYYY-MM-DD
  auto_record: boolean;
  alert_offsets: number[];
  daily_within_days: number | null;
  is_active: boolean;
  last_alert_sent_at: string | null;
  created_at: string;
}

export interface CreateRecurringItemParams {
  user_id: string;
  name: string;
  category: string;
  amount: number;
  interval_unit: RecurringIntervalUnit;
  interval_value: number;
  next_due_date: string;
  auto_record: boolean;
  alert_offsets: number[];
  daily_within_days: number | null;
}
