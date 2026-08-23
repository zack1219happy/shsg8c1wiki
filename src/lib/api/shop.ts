'use client'

import { supabase } from '../supabase'
import type { ShopItem, UserPurchase, UserDecoration, TagData, TagSubmission } from '@/types/gist'

/* =============================================================
   Shop API — 积分商城与标签装备/投稿
   ============================================================= */

/** 获取所有可购买商品 */
export async function fetchShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase.rpc('get_shop_items')
  if (error) throw new Error('获取商品列表失败: ' + error.message)
  return (data ?? []) as ShopItem[]
}

/** 获取当前用户已购买的商品 */
export async function fetchUserPurchases(): Promise<UserPurchase[]> {
  const { data, error } = await supabase.rpc('get_user_purchases')
  if (error) throw new Error('获取已购商品失败: ' + error.message)
  return (data ?? []) as UserPurchase[]
}

/** 购买商品 */
export async function purchaseItem(itemId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('purchase_item', { p_item_id: itemId })
  if (error) return { success: false, message: error.message }
  return (data ?? { success: false, message: '购买失败' }) as { success: boolean; message: string }
}

/** 装备颜色（传 null 卸装） */
export async function equipColor(itemId: string | null): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('equip_color', { p_item_id: itemId })
  if (error) return { success: false, message: error.message }
  return (data ?? { success: false, message: '操作失败' }) as { success: boolean; message: string }
}

/** 装备标签（最多 3 个，传入 {v, c} 数组，c 为颜色或 null） */
export async function equipTags(tagData: TagData[]): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('equip_tags', { p_tag_values: tagData })
  if (error) return { success: false, message: error.message }
  return (data ?? { success: false, message: '操作失败' }) as { success: boolean; message: string }
}

/** 获取当前装备状态 */
export async function fetchUserEquipped(): Promise<UserDecoration> {
  const { data, error } = await supabase.rpc('get_user_equipped')
  if (error) return { color: null, tags: [] }
  return (data as UserDecoration) ?? { color: null, tags: [] }
}

/** 获取当前用户的独有标签（非 shop 商品） */
export async function fetchUserExclusiveTags(): Promise<TagData[]> {
  const { data, error } = await supabase.rpc('get_user_exclusive_tags')
  if (error) return []
  return (data ?? []) as TagData[]
}

/* ── 标签投稿 ── */

/** 提交标签投稿（文字 + 颜色 + 价格） */
export async function submitTagSubmission(value: string, tagColor: string | null, price: number): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('submit_tag_submission', {
    p_value: value,
    p_tag_color: tagColor || null,
    p_price: price,
  })
  if (error) return { success: false, message: error.message }
  return (data ?? { success: false, message: '提交失败' }) as { success: boolean; message: string }
}

/** 获取所有标签投稿（管理员审核列表） */
export async function fetchTagSubmissions(): Promise<TagSubmission[]> {
  const { data, error } = await supabase.rpc('get_tag_submissions')
  if (error) throw new Error('获取投稿失败: ' + error.message)
  return (data ?? []) as TagSubmission[]
}

/** 审核通过投稿（上架商城） */
export async function approveTagSubmission(id: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('approve_tag_submission', { p_id: id })
  if (error) return { success: false, message: error.message }
  return (data ?? { success: false, message: '操作失败' }) as { success: boolean; message: string }
}

/** 驳回投稿 */
export async function rejectTagSubmission(id: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('reject_tag_submission', { p_id: id })
  if (error) return { success: false, message: error.message }
  return (data ?? { success: false, message: '操作失败' }) as { success: boolean; message: string }
}
