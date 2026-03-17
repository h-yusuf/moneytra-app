import apiClient from '@/src/lib/api';
import type {
    GetTransactionsResponse,
    MonthlyReportResponse,
    Transaction
} from '@/src/types';

export interface FetchTransactionsParams {
  user_id?: string;
  type?: 'expense' | 'money_saving';
  limit?: number;
  offset?: number;
}

export interface FetchMonthlyReportParams {
  user_id: string;
  year?: number;
  month?: number;
}

export interface UploadReceiptParams {
  file: File | Blob;
  user_id: string;
  source_name?: string;
}

export interface ExtractTransactionParams {
  file: File | Blob;
  user_id: string;
  transaction_type: 'expense' | 'money_saving';
}

export interface ExtractedTransactionData {
  merchant: string;
  total: number;
  category: string;
  transaction_date: string;
  notes?: string;
  payment_method?: string;
  confidence?: number;
}

/**
 * Fetch all transactions from Supabase
 * GET /webhook/transactions
 */
export const fetchTransactions = async (
  params: FetchTransactionsParams = {}
): Promise<GetTransactionsResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.user_id) queryParams.append('user_id', params.user_id);
  if (params.type) queryParams.append('type', params.type);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());

  const response = await apiClient.get<GetTransactionsResponse>(
    `/webhook/transactions?${queryParams.toString()}`
  );
  
  return response.data;
};

/**
 * Fetch monthly report for charts/graphs
 * GET /webhook/report/monthly
 */
export const fetchMonthlyReport = async (
  params: FetchMonthlyReportParams
): Promise<MonthlyReportResponse> => {
  const queryParams = new URLSearchParams();
  
  queryParams.append('user_id', params.user_id);
  if (params.year) queryParams.append('year', params.year.toString());
  if (params.month) queryParams.append('month', params.month.toString());

  const response = await apiClient.get<MonthlyReportResponse>(
    `/webhook/report/monthly?${queryParams.toString()}`
  );
  
  return response.data;
};

/**
 * Extract transaction data from receipt image using OCR
 * POST /webhook/extract-transaction
 */
export const extractTransaction = async (
  params: ExtractTransactionParams
): Promise<ExtractedTransactionData> => {
  const formData = new FormData();
  
  formData.append('file', params.file);
  formData.append('user_id', params.user_id);
  formData.append('transaction_type', params.transaction_type);

  const response = await apiClient.post<ExtractedTransactionData>(
    '/webhook/extract-transaction',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data;
};

/**
 * Create/save transaction after user confirms extracted data
 * POST /webhook/transactions
 */
export const createTransaction = async (
  data: Partial<Transaction> & { user_id: string }
): Promise<Transaction> => {
  const response = await apiClient.post<Transaction>(
    '/webhook/transactions',
    data
  );
  
  return response.data;
};

/**
 * Upload receipt/payment proof for OCR extraction
 * POST /uploadDoc
 * @deprecated Use extractTransaction instead
 */
export const uploadReceipt = async (
  params: UploadReceiptParams
): Promise<Transaction> => {
  const formData = new FormData();
  
  formData.append('file', params.file);
  formData.append('user_id', params.user_id);
  if (params.source_name) {
    formData.append('source_name', params.source_name);
  }

  const response = await apiClient.post<Transaction>(
    '/webhook/uploadDoc',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data;
};
