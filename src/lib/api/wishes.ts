'use client'

import { supabase } from '../supabase'
import type { WishItem } from '@/types/wishes'

/* =============================================================
   Wishes API — 许愿池
   ============================================================= */

export async function fetchAllWishes(tier?: string): Promise<WishItem[]> {
  const { data, error } = await supabase.rpc('get_all_wishes', { p_tier: tier || null })
  if (error) throw new Error('获取许愿列表失败: ' + error.message)
  return (data ?? []) as WishItem[]
}

export async function fetchWishById(id: string): Promise<WishItem> {
  const { data, error } = await supabase.rpc('get_wish_by_id', { p_id: id })
  if (error) throw new Error('获取许愿详情失败: ' + error.message)
  const rows = data as WishItem[]
  if (!rows || rows.length === 0) throw new Error('许愿不存在')
  return rows[0]
}

/** 用积分支付许愿服务费 */
export async function payWishWithPoints(wishId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('pay_wish_with_points', { p_wish_id: wishId })
  if (error) return { success: false, message: error.message }
  return (data ?? { success: false, message: '支付失败' }) as { success: boolean; message: string }
}

export async function updateWishStatus(
  id: string,
  status: string,
  estimatedHours?: string,
  estimatedStage?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('update_wish_status', {
    p_id: id,
    p_status: status,
    p_estimated_hours: estimatedHours || null,
    p_estimated_stage: estimatedStage || null,
  })
  if (error) throw new Error('更新状态失败: ' + error.message)
  return !!data
}
