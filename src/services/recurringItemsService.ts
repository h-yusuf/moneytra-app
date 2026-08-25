import { supabase } from '@/src/lib/supabase';
import type { CreateRecurringItemParams, RecurringItem } from '@/src/types';

export async function fetchRecurringItems(): Promise<RecurringItem[]> {
  const { data, error } = await supabase
    .from('recurring_items')
    .select('*')
    .eq('is_active', true)
    .order('next_due_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RecurringItem[];
}

export async function createRecurringItem(params: CreateRecurringItemParams): Promise<RecurringItem> {
  const { data, error } = await supabase
    .from('recurring_items')
    .insert({ ...params, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data as RecurringItem;
}

export async function updateRecurringItem(
  id: string,
  updates: Partial<CreateRecurringItemParams>
): Promise<RecurringItem> {
  const { data, error } = await supabase
    .from('recurring_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringItem;
}

export async function deleteRecurringItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_items')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ── Date math (mirrors supabase/functions/check-reminders/index.ts —
// duplicated intentionally, no shared module exists between the Expo app
// and Deno Edge Functions in this repo) ───────────────────────────────────────

function addMonthsClamped(dateYMD: string, months: number): string {
  const [y, m, d] = dateYMD.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, daysInTargetMonth));
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function daysUntilDue(nextDueDate: string): number {
  const now = new Date();
  const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const a = new Date(`${todayYMD}T00:00:00`);
  const b = new Date(`${nextDueDate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type RecurringItemStatus = 'active' | 'due_soon' | 'overdue';

export function getRecurringItemStatus(item: RecurringItem): RecurringItemStatus {
  const days = daysUntilDue(item.next_due_date);
  if (days < 0) return 'overdue';
  const dueSoon =
    item.alert_offsets.includes(days) ||
    (item.daily_within_days != null && days <= item.daily_within_days);
  return dueSoon ? 'due_soon' : 'active';
}

export async function markRecurringItemPaid(item: RecurringItem): Promise<RecurringItem> {
  const nextDueDate = addMonthsClamped(item.next_due_date, item.interval_months);
  const { data, error } = await supabase
    .from('recurring_items')
    .update({ next_due_date: nextDueDate, last_alert_sent_at: null })
    .eq('id', item.id)
    .select()
    .single();
  if (error) throw error;
  return data as RecurringItem;
}
