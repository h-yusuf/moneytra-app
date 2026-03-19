import type { CategoryBreakdown, DashboardSummary, MonthlyTrend, Transaction } from '@/src/types';

export const dummyTransactions: Transaction[] = [
  {
    id: '1',
    user_id: 'user1',
    type: 'expense',
    transaction_date: '2026-03-16',
    merchant: 'Indomaret',
    category: 'Kebutuhan Harian',
    payment_method: 'QRIS',
    total: 125000,
    notes: 'Belanja bulanan',
    created_at: '2026-03-16T10:30:00Z',
  },
  {
    id: '2',
    user_id: 'user-1',
    type: 'money_saving',
    transaction_date: '2024-03-10',
    merchant: 'Transfer Bank',
    category: 'Tabungan',
    payment_method: 'Transfer',
    total: 5000000,
    notes: 'Tabungan nikah bulan Maret',
    created_at: '2024-03-10T10:00:00Z',
  },
  {
    id: '3',
    user_id: 'user1',
    type: 'expense',
    transaction_date: '2026-03-14',
    merchant: 'Grab',
    category: 'Transportasi',
    payment_method: 'E-Wallet',
    total: 45000,
    notes: 'Perjalanan ke kantor',
    created_at: '2026-03-14T08:15:00Z',
  },
  {
    id: '4',
    user_id: 'user1',
    type: 'expense',
    transaction_date: '2026-03-13',
    merchant: 'Starbucks',
    category: 'Makanan & Minuman',
    payment_method: 'QRIS',
    total: 85000,
    notes: 'Kopi dan snack',
    created_at: '2026-03-13T16:45:00Z',
  },
  {
    id: '5',
    user_id: 'user1',
    type: 'expense',
    transaction_date: '2026-03-12',
    merchant: 'PLN',
    category: 'Tagihan',
    payment_method: 'Transfer',
    total: 350000,
    notes: 'Bayar listrik',
    created_at: '2026-03-12T11:00:00Z',
  },
];

export const dummySummary: DashboardSummary = {
  total_expense: 3250000,
  total_money_saving: 5000000,
  total_transactions: 28,
  expense_growth: -12.5,
  savings_growth: 8.3,
  top_category: {
    name: 'Makanan & Minuman',
    total: 1200000,
  },
  top_merchant: {
    name: 'Indomaret',
    total: 850000,
  },
};

export const dummyMonthlyTrends: MonthlyTrend[] = [
  { month: 'Okt', expense: 2800000, savings: 4000000 },
  { month: 'Nov', expense: 3200000, savings: 4500000 },
  { month: 'Des', expense: 3700000, savings: 4200000 },
  { month: 'Jan', expense: 3100000, savings: 4800000 },
  { month: 'Feb', expense: 3500000, savings: 4600000 },
  { month: 'Mar', expense: 3250000, savings: 5000000 },
];

export const dummyCategoryBreakdown: CategoryBreakdown[] = [
  { category: 'Makanan & Minuman', total: 1200000, percentage: 37 },
  { category: 'Transportasi', total: 650000, percentage: 20 },
  { category: 'Kebutuhan Harian', total: 550000, percentage: 17 },
  { category: 'Tagihan', total: 450000, percentage: 14 },
  { category: 'Hiburan', total: 250000, percentage: 8 },
  { category: 'Lainnya', total: 150000, percentage: 4 },
];
