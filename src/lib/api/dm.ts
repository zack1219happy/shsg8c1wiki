'use client'

import { supabase } from '../supabase'

/* =============================================================
   DM API — 私信
   ============================================================= */

export interface Conversation {
  conversation_id: string
  other_user_id: string
  other_username: string
  other_name: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

export interface DmMessage {
  id: string
  sender_id: string
  sender_username: string
  content: string
  created_at: string
  recalled_at: string | null
  is_mine: boolean
}

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('get_conversations')
  if (error) throw new Error('获取对话列表失败: ' + error.message)
  return (data ?? []) as Conversation[]
}

export async function getMessages(conversationId: string, limit = 50, before?: string): Promise<DmMessage[]> {
  const params: Record<string, string | number> = { p_conversation_id: conversationId, p_limit: limit }
  if (before) params.p_before = before
  const { data, error } = await supabase.rpc('get_messages', params)
  if (error) throw new Error('获取消息失败: ' + error.message)
  return (data ?? []) as DmMessage[]
}

export async function sendMessage(otherUserId: string, content: string): Promise<string> {
  const { data, error } = await supabase.rpc('send_message', {
    p_other_user_id: otherUserId,
    p_content: content,
  })
  if (error) throw new Error('发送失败: ' + error.message)
  return data as string
}

export async function recallMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('recall_message', { p_message_id: messageId })
  if (error) throw new Error('撤回失败: ' + error.message)
}

export async function getUnreadDmCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_dm_count')
  if (error) return 0
  return (data as number) ?? 0
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
}

export async function heartbeatConversation(conversationId: string): Promise<void> {
  await supabase.rpc('heartbeat_conversation', { p_conversation_id: conversationId })
}

export async function leaveConversation(conversationId: string): Promise<void> {
  await supabase.rpc('leave_conversation', { p_conversation_id: conversationId })
}
