import { supabase } from '@/src/lib/supabase';
import type { AppNotification } from '@/src/types';

export async function fetchNotifications(userId?: string): Promise<AppNotification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function countUnreadNotifications(userId?: string): Promise<number> {
  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (userId) query = query.eq('user_id', userId);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
