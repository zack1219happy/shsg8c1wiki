'use client'

import { supabase } from '../supabase'
import type { ForumPost } from '@/types/gist'

/* =============================================================
   Forum API — 讨论区操作
   ============================================================= */

export async function fetchForumPosts(): Promise<ForumPost[]> {
  const { data, error } = await supabase.rpc('get_forum_posts')
  if (error) throw new Error('获取帖子列表失败: ' + error.message)
  return (data ?? []) as ForumPost[]
}

export async function fetchLikedPostIds(): Promise<string[]> {
  const s = (await import('@/lib/auth')).getSession()
  if (!s) return []
  const { data, error } = await supabase.rpc('get_user_liked_posts', { p_user_id: s.userId })
  if (error) throw new Error('获取赞过的帖子失败: ' + error.message)
  return (data ?? []).map((r: { post_id: string }) => r.post_id)
}

export async function fetchForumPost(postId: string): Promise<ForumPost | null> {
  const { data, error } = await supabase.rpc('get_forum_post', { p_post_id: postId })
  if (error) throw new Error('获取帖子失败: ' + error.message)
  return (data ?? [])[0] ?? null
}

/** 检测论坛帖子重复（客户端预检） */
export async function checkForumDuplicate(title: string, content: string): Promise<{ is_duplicate: boolean; existing_title: string; created_at: string } | null> {
  const { data, error } = await supabase.rpc('check_forum_post_duplicate', {
    p_title: title.trim(),
    p_content: content.trim(),
  })
  if (error) return null
  return (data ?? [])[0] ?? null
}

export async function createForumPost(title: string, content: string, excludedVisibility?: string[], agentVisible = true): Promise<string> {
  const { data, error } = await supabase.rpc('create_forum_post', {
    p_title: title.trim(),
    p_content: content.trim(),
    p_excluded_visibility: excludedVisibility && excludedVisibility.length > 0 ? excludedVisibility : [],
    p_agent_visible: agentVisible,
  })
  if (error) throw new Error('发帖失败: ' + error.message)
  return data as string
}

export async function voteForumPost(postId: string, voteType: 'up' | 'down'): Promise<void> {
  const { error } = await supabase.rpc('vote_forum_post', {
    p_post_id: postId,
    p_vote_type: voteType,
  })
  if (error) throw new Error('投票失败: ' + error.message)
}

export async function removeForumVote(postId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_forum_vote', { p_post_id: postId })
  if (error) throw new Error('取消投票失败: ' + error.message)
}

export async function getUserForumVote(postId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_user_forum_vote', { p_post_id: postId })
  if (error) return null
  return data as string | null
}

export async function updateForumPost(postId: string, title: string, content: string, excludedVisibility?: string[] | null, agentVisible?: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_forum_post', {
    p_post_id: postId,
    p_title: title.trim(),
    p_content: content.trim(),
    p_excluded_visibility: excludedVisibility !== undefined ? (excludedVisibility ?? []) : null,
    p_agent_visible: agentVisible ?? null,
  })
  if (error) throw new Error('编辑失败: ' + error.message)
}

export async function togglePinForumPost(postId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_pin_forum_post', { p_post_id: postId })
  if (error) throw new Error('操作失败: ' + error.message)
  return !!data
}
