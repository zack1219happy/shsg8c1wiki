'use client'

import { useEffect, useState } from 'react'

export interface DbPage {
    title?: string
    content: string
    frontmatter?: Record<string, unknown>
}

/**
 * 从数据库加载页面内容（wiki 页面 / 协议页）。
 * 全站唯一的页面取数路径——构建期不再烘内容，
 * 静态导出只负责外壳与路由。
 */
export function useDbPage(variant: 'wiki' | 'agreement', slug: string) {
    const [page, setPage] = useState<DbPage | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        // 通过微任务触发，避免在 effect 内同步调用含 setState 的函数
        Promise.resolve().then(() => {
            if (cancelled) return
            setLoading(true)
            setError(null)
            const load = variant === 'wiki'
                ? import('@/lib/wiki-api').then((m) => m.fetchWikiPage(slug))
                : import('@/lib/agreement-api').then((m) => m.fetchAgreementPage(slug))
            load
                .then((p) => { if (!cancelled) setPage(p ?? null) })
                .catch((e: unknown) => {
                    if (!cancelled) setError((e as { message?: string } | null)?.message ?? '加载失败')
                })
                .finally(() => { if (!cancelled) setLoading(false) })
        })
        return () => { cancelled = true }
    }, [variant, slug])

    return { page, loading, error }
}
