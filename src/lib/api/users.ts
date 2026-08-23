'use client'

import { supabase } from '../supabase'
import type { UserInfo } from '@/types/gist'

/** 全量用户列表（可见性选择、新对话选择等场景） */
export async function fetchAllUsers(): Promise<UserInfo[]> {
  const { data, error } = await supabase.rpc('get_all_users')
  if (error) throw new Error('获取用户列表失败: ' + error.message)
  return (data ?? []) as UserInfo[]
}
