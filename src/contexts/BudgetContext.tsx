import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly';
  user_id: string;
}

interface BudgetContextType {
  budgets: Budget[];
  isLoading: boolean;
  addBudget: (budget: Omit<Budget, 'id'>) => Promise<void>;
  updateBudget: (id: string, budget: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  getBudgetByCategory: (category: string, user_id: string) => Budget | undefined;
  checkBudgetAlert: (category: string, user_id: string, currentSpent: number) => {
    isNearLimit: boolean;
    isOverLimit: boolean;
    percentage: number;
    budget: Budget | undefined;
  };
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

const STORAGE_KEY = '@budgets';

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setBudgets(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load budgets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBudgets = async (newBudgets: Budget[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newBudgets));
      setBudgets(newBudgets);
    } catch (error) {
      console.error('Failed to save budgets:', error);
      throw error;
    }
  };

  const addBudget = async (budget: Omit<Budget, 'id'>) => {
    const newBudget: Budget = {
      ...budget,
      id: Date.now().toString(),
    };
    await saveBudgets([...budgets, newBudget]);
  };

  const updateBudget = async (id: string, updates: Partial<Budget>) => {
    const updated = budgets.map(b => 
      b.id === id ? { ...b, ...updates } : b
    );
    await saveBudgets(updated);
  };

  const deleteBudget = async (id: string) => {
    const filtered = budgets.filter(b => b.id !== id);
    await saveBudgets(filtered);
  };

  const getBudgetByCategory = (category: string, user_id: string) => {
    return budgets.find(b => 
      b.category.toLowerCase() === category.toLowerCase() && 
      b.user_id === user_id
    );
  };

  const checkBudgetAlert = (category: string, user_id: string, currentSpent: number) => {
    const budget = getBudgetByCategory(category, user_id);
    
    if (!budget) {
      return {
        isNearLimit: false,
        isOverLimit: false,
        percentage: 0,
        budget: undefined,
      };
    }

    const percentage = (currentSpent / budget.amount) * 100;
    const isNearLimit = percentage >= 80 && percentage < 100;
    const isOverLimit = percentage >= 100;

    return {
      isNearLimit,
      isOverLimit,
      percentage,
      budget,
    };
  };

  return (
    <BudgetContext.Provider
      value={{
        budgets,
        isLoading,
        addBudget,
        updateBudget,
        deleteBudget,
        getBudgetByCategory,
        checkBudgetAlert,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within BudgetProvider');
  }
  return context;
}
