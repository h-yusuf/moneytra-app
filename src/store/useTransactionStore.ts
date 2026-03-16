import { create } from 'zustand';
import type { Transaction, UploadResponse } from '@/types';

interface TransactionStore {
  pendingTransaction: Partial<Transaction> | null;
  uploadResult: UploadResponse | null;
  setPendingTransaction: (transaction: Partial<Transaction> | null) => void;
  setUploadResult: (result: UploadResponse | null) => void;
  clearPending: () => void;
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  pendingTransaction: null,
  uploadResult: null,
  setPendingTransaction: (transaction) => set({ pendingTransaction: transaction }),
  setUploadResult: (result) => set({ uploadResult: result }),
  clearPending: () => set({ pendingTransaction: null, uploadResult: null }),
}));
