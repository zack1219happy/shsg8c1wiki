'use client'

import { supabase } from '../supabase'

/* =============================================================
   Comments API — 全站统一评论
   五个板块（wiki 页面 / 论坛 / 广场 / 许愿 / 用户留言板）
   共用同一张表、同一组 RPC、同一个组件。
   ============================================================= */

export type CommentSource = 'wiki' | 'forum' | 'plaza' | 'wish' | 'user_page'

export interface UnifiedComment {
  id: string
  parentId: string | null
  /** 用于删除权限判断的 userId。可为空（历史匿名数据），为空时仅 admin 可删 */
  authorId?: string
  author: string
  content: string
  createdAt: string
  deleted: boolean
}

interface UnifiedCommentRow {
  id: string
  parent_id: string | null
  author_id: string | null
  author_username: string
  content: string
  created_at: string
  deleted: boolean
}

export function toUnifiedComment(raw: UnifiedCommentRow): UnifiedComment {
  return {
    id: raw.id,
    parentId: raw.parent_id ?? null,
    authorId: raw.author_id ?? undefined,
    author: raw.author_username,
    content: raw.content,
    createdAt: raw.created_at,
    deleted: !!raw.deleted,
  }
}

export async function fetchComments(source: CommentSource, targetId: string): Promise<UnifiedComment[]> {
  const { data, error } = await supabase.rpc('get_comments', { p_source: source, p_target: targetId })
  if (error) throw new Error('获取评论失败: ' + error.message)
  return ((data ?? []) as UnifiedCommentRow[]).map(toUnifiedComment)
}

const RATE_LIMIT_KEY = 'wiki_comment_timestamps'
const MAX_COMMENTS = 60
const WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(): void {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(RATE_LIMIT_KEY)
  let timestamps: number[] = []
  if (stored) {
    try { timestamps = JSON.parse(stored) } catch { localStorage.removeItem(RATE_LIMIT_KEY) }
  }
  const now = Date.now()
  const recent = timestamps.filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_COMMENTS) {
    const oldest = recent[0]
    const waitMs = WINDOW_MS - (now - oldest)
    const waitMin = Math.ceil(waitMs / 60000)
    throw new Error('评论太频繁，请 ' + waitMin + ' 分钟后再试（限制 ' + MAX_COMMENTS + ' 条/小时）')
  }
  recent.push(now)
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent))
}

/** 发表评论（客户端限流全站统一 60 条/小时） */
export async function addComment(
  source: CommentSource,
  targetId: string,
  content: string,
  parentId?: string,
): Promise<string> {
  checkRateLimit()
  const { data, error } = await supabase.rpc('add_comment', {
    p_source: source,
    p_target: targetId,
    p_content: content.trim(),
    p_parent_id: parentId || null,
  })
  if (error) throw new Error('提交失败: ' + error.message)
  return data as string
}

/** 删除评论（作者/管理员可删；留言板主人可删本页留言） */
export async function deleteComment(commentId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_comment', { p_comment_id: commentId })
  if (error) throw new Error('删除失败: ' + error.message)
  return !!data
}
