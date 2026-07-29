import { useEffect, useState } from 'react';
import { fetchCategoryMerchantSuggestions, type FieldSuggestion } from '@/src/services/transactionService';

export function useCategoryMerchantSuggestions() {
  const [categories, setCategories] = useState<FieldSuggestion[]>([]);
  const [merchants, setMerchants] = useState<FieldSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCategoryMerchantSuggestions()
      .then(({ categories, merchants }) => {
        if (cancelled) return;
        setCategories(categories);
        setMerchants(merchants);
      })
      .catch(() => {
        // Suggestions are a nice-to-have; leave lists empty on failure so the
        // fields still work as plain free-text inputs.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, merchants, loading };
}
