'use client'

import { supabase } from '../supabase'
import type { NotificationType } from '@/types/gist'

/* =============================================================
   Notifications API — 通知中心
   ============================================================= */

export interface Notification {
  id: string
  from_user_id: string | null
  from_username: string | null
  page: string
  excerpt: string | null
  read: boolean
  created_at: string
  comment_id: string
  type: NotificationType
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.rpc('get_notifications')
  if (error) throw new Error('获取通知失败: ' + error.message)
  return ((data ?? []) as Notification[]).map((n: Notification) => ({
    ...n,
    type: n.type ?? 'comment_reply',
  }))
}

export async function getUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_count')
  if (error) return 0
  return (data as number) ?? 0
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase.rpc('mark_notification_read', { p_notification_id: notificationId })
}

export async function clearAllNotifications(type?: string): Promise<void> {
  if (type) {
    await supabase.rpc('clear_notifications_by_type', { p_type: type })
  } else {
    await supabase.rpc('clear_all_notifications')
  }
}

export async function deleteNotifications(type?: string): Promise<void> {
  if (type) {
    await supabase.rpc('delete_notifications', { p_type: type })
  } else {
    await supabase.rpc('delete_notifications')
  }
}
