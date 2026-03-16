export type TransactionType = 'expense' | 'wedding_savings';

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
  total_wedding_savings: number;
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
