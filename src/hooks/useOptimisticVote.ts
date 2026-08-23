'use client'

import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export type VoteType = 'up' | 'down'

interface OptimisticVoteOptions<T> {
    item: T | null
    setItem: Dispatch<SetStateAction<T | null>>
    /** 我的投票状态由页面持有（加载流程需要写入），此处传入 */
    myVote: VoteType | null
    setMyVote: Dispatch<SetStateAction<VoteType | null>>
    getId: (item: T) => string
    readCounts: (item: T) => { up: number; down: number }
    writeCounts: (item: T, counts: { up: number; down: number }) => T
    vote: (id: string, type: VoteType) => Promise<unknown>
    removeVote: (id: string) => Promise<unknown>
    /** 投票后的服务端同步（重拉真实计数/我的投票） */
    refresh?: () => void | Promise<void>
}

/**
 * 赞/踩乐观更新：先改本地计数与我的投票，再调 API；失败回滚并以服务端数据兜底。
 * 论坛帖与广场文章共用（仅计数字段名与 API 不同）。
 */
export function useOptimisticVote<T>(options: OptimisticVoteOptions<T>) {
    const handleVote = useCallback(
        async (type: VoteType) => {
            const { item, myVote: prev } = options
            if (!item) return
            const counts = options.readCounts(item)
            let up = counts.up
            let down = counts.down
            // 撤销之前的投票（如果有）
            if (prev === 'up') up = Math.max(0, up - 1)
            if (prev === 'down') down = Math.max(0, down - 1)
            // 同一票再点一次 = 取消
            const next = type === prev ? null : type
            if (next === 'up') up += 1
            if (next === 'down') down += 1
            options.setMyVote(next)
            options.setItem(options.writeCounts(item, { up, down }))
            try {
                if (prev === type) await options.removeVote(options.getId(item))
                else await options.vote(options.getId(item), type)
                // 后台同步确保一致性
                void options.refresh?.()
            } catch {
                // 回滚
                options.setMyVote(prev)
                void options.refresh?.()
            }
        },
        [options],
    )

    return { handleVote }
}
