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
  
  if (params.user_id) queryParams.append('user_id', params.user_id);
  if (params.year) queryParams.append('year', params.year.toString());
  if (params.month) queryParams.append('month', params.month.toString());

  console.log('fetchMonthlyReport - API call:', `/webhook/report/monthly?${queryParams.toString()}`);

  const response = await apiClient.get<MonthlyReportResponse>(
    `/webhook/report/monthly?${queryParams.toString()}`
  );
  
  console.log('fetchMonthlyReport - API response:', response.data);
  return response.data;
};

/**
 * Fetch spending overview (aggregated per user per period)
 * GET /webhook/report/spending-overview
 */
export const fetchSpendingOverview = async (
  params: FetchSpendingOverviewParams
): Promise<SpendingOverviewRecord[]> => {
  const queryParams = new URLSearchParams();
  queryParams.append('year', params.year.toString());
  if (params.month) queryParams.append('month', params.month.toString());

  console.log('fetchSpendingOverview - API call:', `/webhook/report/spending-overview?${queryParams.toString()}`);

  const response = await apiClient.get<{ data: SpendingOverviewRecord[] }>(
    `/webhook/report/spending-overview?${queryParams.toString()}`
  );
  
  console.log('fetchSpendingOverview - API response:', response.data);
  return response.data.data || [];
};

/**
 * Upload and extract transaction data from receipt image using OCR
 * POST /webhook/uploadDoc
 */
export const extractTransaction = async (
  params: ExtractTransactionParams
): Promise<ExtractedTransactionData> => {
  // MOCK MODE for testing - remove this when API is ready
  const USE_MOCK = false; // Set to false when API is ready
  
  if (USE_MOCK) {
    console.log('Using MOCK data for extraction');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
    return {
      merchant: 'Indomaret',
      total: 125000,
      category: 'Belanja snack dan minuman',
      transaction_date: new Date().toISOString().split('T')[0],
      notes: 'Extracted from receipt image',
      payment_method: 'Cash',
      confidence: 0.95,
    };
  }

  const formData = new FormData();
  
  // React Native FormData requires specific format
  // @ts-ignore - React Native FormData typing
  formData.append('file', {
    uri: params.file.uri,
    type: params.file.type,
    name: params.file.name,
  });
  formData.append('user_id', params.user_id);
  formData.append('transaction_type', params.transaction_type);

  console.log('Sending FormData to API:', {
    endpoint: '/webhook/uploadDoc',
    user_id: params.user_id,
    transaction_type: params.transaction_type,
    file: params.file.name,
  });

  try {
    const response = await apiClient.post<ExtractedTransactionData>(
      '/webhook/uploadDoc',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for OCR processing
      }
    );
    
    console.log('API Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
};

export interface CreateTransactionParams {
  user_id: string;
  type: 'expense' | 'money_saving';
  text: string;
  source_name: string;
}

/**
 * Create/save transaction after user confirms extracted data
 * POST /webhook/extract-transaction
 */
export const createTransaction = async (
  data: CreateTransactionParams
): Promise<Transaction> => {
  console.log('Saving transaction to API:', {
    endpoint: '/webhook/extract-transaction',
    data,
  });

  const response = await apiClient.post<Transaction>(
    '/webhook/extract-transaction',
    data
  );
  
  console.log('Transaction saved:', response.data);
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
