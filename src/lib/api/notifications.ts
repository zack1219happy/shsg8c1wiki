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
  target_title: string | null
  read: boolean
  created_at: string
  comment_id: string
  type: NotificationType
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.rpc('get_notifications_v2')
  if (error) {
    // 数据库迁移尚未执行时继续兼容旧函数，避免通知中心整体不可用。
    const fallback = await supabase.rpc('get_notifications')
    if (fallback.error) throw new Error('获取通知失败: ' + error.message)
    return ((fallback.data ?? []) as Omit<Notification, 'target_title'>[]).map((n) => ({
      ...n,
      target_title: null,
      type: n.type ?? 'comment_reply',
    }))
  }
  return ((data ?? []) as Notification[]).map((n: Notification) => ({
    ...n,
    target_title: n.target_title ?? null,
    type: n.type ?? 'comment_reply',
  }))
}

export async function getUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_count')
  if (error) return 0
  return (data as number) ?? 0
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId })
  if (error) throw new Error('标记通知已读失败: ' + error.message)
}

/** 在对应内容页查看时，将该内容的相关通知全部标为已读。 */
export async function markNotificationsReadForPage(page: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_read_for_page', { p_page: page })
  if (error) throw new Error('标记内容通知已读失败: ' + error.message)
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
