'use client'

import { useEffect, useRef, useState } from 'react'
import WikiContent from '@/components/WikiContent'
import AgreementEditPanel from '@/components/AgreementEditPanel'

interface ContentDbProps {
    /** 内容域：wiki 页面 / 协议页 */
    variant: 'wiki' | 'agreement'
    slug: string
    /** 静态编译时的内容（fallback，SSR 瞬间展示） */
    staticContent: string
    /** 协议页的静态标题 */
    staticTitle?: string
}

/**
 * 动态内容容器 — 静态先行、DB 无缝替换的通用壳。
 *
 * 初始渲染使用静态编译的内容（瞬间展示），挂载后按 variant
 * 拉取 DB 最新版本，如有差异则无缝切换。审批通过的新内容
 * 因此立即可见，无需等待重新构建。
 */
export default function ContentDB({ variant, slug, staticContent, staticTitle }: ContentDbProps) {
    const [dbPage, setDbPage] = useState<{ title?: string; content: string } | null>(null)
    const loadedRef = useRef(false)

    useEffect(() => {
        if (loadedRef.current) return
        loadedRef.current = true
        const fetchDb = variant === 'wiki'
            ? import('@/lib/wiki-api').then((m) => m.fetchWikiPage)
            : import('@/lib/agreement-api').then((m) => m.fetchAgreementPage)
        fetchDb.then((fetch) => fetch(slug))
            .then((page) => {
                if (page && page.content !== staticContent) {
                    setDbPage(page)
                }
            })
            .catch(() => { /* 静默失败，保留静态内容 */ })
    }, [variant, slug, staticContent])

    const content = dbPage?.content ?? staticContent

    if (variant === 'agreement') {
        return (
            <>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '32px 0 16px',
                    }}
                >
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {dbPage?.title ?? staticTitle}
                    </h2>
                    <AgreementEditPanel slug={slug} />
                </div>
                <div className="wiki-body">
                    <WikiContent format="markdown" content={content} />
                </div>
            </>
        )
    }

    return <WikiContent content={content} className="wiki-body" slug={slug} />
}
