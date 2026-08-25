import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

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
  const budgetsRef = useRef<Budget[]>([]);
  // Serializes writes so concurrent add/update/delete calls can't race on a stale `budgets` snapshot.
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        budgetsRef.current = parsed;
        setBudgets(parsed);
      }
    } catch (error) {
      console.error('Failed to load budgets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mutateBudgets = (mutate: (current: Budget[]) => Budget[]) => {
    const result = writeQueue.current.then(async () => {
      const newBudgets = mutate(budgetsRef.current);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newBudgets));
      budgetsRef.current = newBudgets;
      setBudgets(newBudgets);
    });
    writeQueue.current = result.catch(() => {});
    return result;
  };

  const addBudget = async (budget: Omit<Budget, 'id'>) => {
    const newBudget: Budget = {
      ...budget,
      id: Date.now().toString(),
    };
    await mutateBudgets(current => [...current, newBudget]);
  };

  const updateBudget = async (id: string, updates: Partial<Budget>) => {
    await mutateBudgets(current =>
      current.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const deleteBudget = async (id: string) => {
    await mutateBudgets(current => current.filter(b => b.id !== id));
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
