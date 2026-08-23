'use client'

import { supabase } from '../supabase'
import type { TodayProgress, PointsTransaction } from '@/types/gist'

/* =============================================================
   Points API — 积分系统
   ============================================================= */

export async function fetchTodayProgress(): Promise<TodayProgress> {
  const { data, error } = await supabase.rpc('get_today_progress')
  if (error) throw new Error('获取任务进度失败: ' + error.message)
  return (data as TodayProgress) ?? { checked_in: false, comments_today: 0, posts_today: 0, total_points: 0 }
}

export async function fetchPointsHistory(limit = 20, offset = 0): Promise<PointsTransaction[]> {
  const { data, error } = await supabase.rpc('get_points_history', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw new Error('获取积分记录失败: ' + error.message)
  return (data ?? []) as PointsTransaction[]
}

export async function fetchMyPoints(): Promise<number> {
  const { data, error } = await supabase.rpc('get_my_points')
  if (error) return 0
  return (data as number) ?? 0
}
