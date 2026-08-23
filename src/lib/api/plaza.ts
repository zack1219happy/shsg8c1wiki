'use client'

import { supabase } from '../supabase'
import type { PlazaArticleDetail, PlazaArticleListResult, PlazaCategory, PlazaTipRecord, SendPointsResult } from '@/types/plaza'

/* =============================================================
   Plaza API — 文章广场
   - 分类从 plaza_categories 表动态读取，不再硬编码
   - 列表支持分类筛选、搜索、我写的/我赞的 标签页
   - 可见性只有公开 / 私密两态（is_public: boolean），
     没有论坛的 excluded_visibility 数组
   - 点赞走 toggle_plaza_like RPC（乐观更新）
   - 含积分奖励/投币/沙箱交互（award/tip/sendPoints/storage）
   ============================================================= */

/** 检测广场文章重复（客户端预检） */
export async function checkPlazaDuplicate(title: string, content: string): Promise<{ is_duplicate: boolean; existing_title: string; created_at: string } | null> {
  const { data, error } = await supabase.rpc('check_plaza_article_duplicate', {
    p_title: title.trim(),
    p_content: content.trim(),
  })
  if (error) return null
  return (data ?? [])[0] ?? null
}

/** get_plaza_articles RPC 原始行（含 upvote_count，需映射为 like_count） */
type PlazaArticleRow = PlazaArticleListResult & {
  upvote_count?: number | null
}

/** get_plaza_article RPC 原始行 */
type PlazaArticleDetailRow = PlazaArticleDetail & {
  upvote_count?: number | null
}

/** 获取所有分类（扁平列表，前端自行构建树结构） */
export async function fetchPlazaCategories(): Promise<PlazaCategory[]> {
  const { data, error } = await supabase.rpc('get_plaza_categories')
  if (error) throw new Error('获取分类失败: ' + error.message)
  return (data ?? []) as PlazaCategory[]
}

export async function fetchPlazaArticles(
  categoryId?: string,
  search?: string,
  limit = 50,
  offset = 0,
  my?: boolean,
  liked?: boolean,
): Promise<PlazaArticleListResult[]> {
  const params: Record<string, string | number | boolean> = { p_limit: limit, p_offset: offset }
  if (categoryId) params.p_category_id = categoryId
  if (search) params.p_search = search
  if (my) params.p_my = true
  if (liked) params.p_liked = true
  const { data, error } = await supabase.rpc('get_plaza_articles', params)
  if (error) throw new Error('获取广场文章失败: ' + error.message)
  return ((data ?? []) as PlazaArticleRow[]).map((r: PlazaArticleRow) => ({
    ...r,
    like_count: r.upvote_count ?? r.like_count ?? 0,
    downvote_count: r.downvote_count ?? 0,
  })) as PlazaArticleListResult[]
}

export async function fetchPlazaArticle(slug: string): Promise<PlazaArticleDetail> {
  const { data, error } = await supabase.rpc('get_plaza_article', { p_slug: slug })
  if (error) throw new Error('获取文章失败: ' + error.message)
  const row = (data as PlazaArticleDetailRow[] | null)?.[0]
  if (!row) throw new Error('文章不存在')
  return {
    ...row,
    like_count: row.upvote_count ?? row.like_count ?? 0,
    downvote_count: row.downvote_count ?? 0,
  } as PlazaArticleDetail
}

export async function createPlazaArticle(
  title: string,
  slug: string,
  content: string,
  categoryId: string,
  isPublic: boolean,
  hasJs?: boolean,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_plaza_article', {
    p_title: title.trim(),
    p_slug: slug.trim(),
    p_content: content.trim(),
    p_category_id: categoryId,
    p_is_public: isPublic,
    p_has_js: hasJs ?? false,
  })
  if (error) throw new Error('发布文章失败: ' + error.message)
  return data as string
}

export async function updatePlazaArticle(
  id: string,
  title: string,
  content: string,
  categoryId: string,
  isPublic: boolean,
  hasJs?: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('update_plaza_article', {
    p_article_id: id,
    p_title: title.trim(),
    p_content: content.trim(),
    p_category_id: categoryId,
    p_is_public: isPublic,
    p_has_js: hasJs ?? false,
  })
  if (error) throw new Error('编辑失败: ' + error.message)
}

export async function deletePlazaArticle(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_plaza_article', { p_article_id: id })
  if (error) throw new Error('删除失败: ' + error.message)
}

export async function votePlazaArticle(articleId: string, voteType: 'up' | 'down'): Promise<void> {
  const { error } = await supabase.rpc('vote_plaza_article', {
    p_article_id: articleId,
    p_vote_type: voteType,
  })
  if (error) throw new Error('投票失败: ' + error.message)
}

export async function removePlazaVote(articleId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_plaza_vote', { p_article_id: articleId })
  if (error) throw new Error('取消投票失败: ' + error.message)
}

export async function getUserPlazaVote(articleId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_user_plaza_vote', { p_article_id: articleId })
  if (error) return null
  return data as string | null
}

export async function fetchLikedPlazaIds(): Promise<string[]> {
  const s = (await import('@/lib/auth')).getSession()
  if (!s) return []
  const { data, error } = await supabase.rpc('get_user_liked_plaza_ids', { p_user_id: s.userId })
  if (error) throw new Error('获取赞过的文章失败: ' + error.message)
  return (data ?? []).map((r: { article_id: string }) => r.article_id)
}

/** 管理员奖励作者积分 */
export async function awardPlazaArticlePoints(articleId: string, amount: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('award_plaza_article_points', {
    p_article_id: articleId,
    p_amount: amount,
  })
  if (error) throw new Error('奖励积分失败: ' + error.message)
  return !!data
}

/** 读者投币 */
export async function tipPlazaArticle(articleId: string, amount: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('tip_plaza_article', {
    p_article_id: articleId,
    p_amount: amount,
  })
  if (error) throw new Error(error.message)
  return !!data
}

/* ── Plaza Sandbox API — 沙箱 JS 交互能力 ── */

/** 作者预埋悬赏：作者扣分 → 当前读者收分 */
export async function sendPlazaPoints(
  articleId: string,
  amount: number,
  articleCap: number,
  balanceFloor: number,
  oncePerUser = false,
): Promise<SendPointsResult> {
  const { data, error } = await supabase.rpc('send_plaza_points', {
    p_article_id: articleId,
    p_amount: amount,
    p_article_cap: articleCap,
    p_balance_floor: balanceFloor,
    p_once_per_user: oncePerUser,
  })
  if (error) return { success: false, message: error.message }
  return { success: data === true }
}

/** 获取文章收到的读者打赏记录 */
export async function fetchPlazaArticleTips(articleId: string): Promise<PlazaTipRecord[]> {
  const { data, error } = await supabase.rpc('get_plaza_article_tips', {
    p_article_id: articleId,
  })
  if (error) throw new Error('获取打赏记录失败: ' + error.message)
  return (data ?? []) as PlazaTipRecord[]
}

/** 读取当前用户在当前文章的持久化存储 */
export async function getPlazaStorage(articleId: string, key: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_plaza_storage', {
    p_article_id: articleId,
    p_key: key,
  })
  if (error) return null
  return (data as string) ?? null
}

/** 写入当前用户在当前文章的持久化存储 */
export async function setPlazaStorage(articleId: string, key: string, value: string): Promise<boolean> {
  const { error } = await supabase.rpc('set_plaza_storage', {
    p_article_id: articleId,
    p_key: key,
    p_value: value,
  })
  if (error) return false
  return true
}
