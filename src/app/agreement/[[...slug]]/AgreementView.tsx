'use client'

import { useMemo } from 'react'
import { useDbPage } from '@/hooks/useDbPage'
import { createMarkdown, extractHeadingsFromHtml } from '@/lib/markdown'
import type { Heading } from '@/lib/markdown'
import TableOfContents from '@/components/TableOfContents'
import WikiContent from '@/components/WikiContent'
import AgreementEditPanel from '@/components/AgreementEditPanel'

/**
 * 协议页视图 — 纯客户端取数（构建期只出外壳与路由）。
 */
export default function AgreementView({ slugPath }: { slugPath: string }) {
    const { page, loading, error } = useDbPage('agreement', slugPath)

    const content = page?.content ?? ''
    const title = page?.title ?? '协议与帮助'

    const headings: Heading[] = useMemo(() => {
        if (!content) return []
        try {
            return extractHeadingsFromHtml(
                createMarkdown({ highlight: true, texmath: true, anchor: true }).render(content),
            )
        } catch { return [] }
    }, [content])

    return (
        <div className="page-content" style={{ display: 'flex', gap: '24px' }}>
            <article
                style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                    padding: '76px 24px 60px',
                    flex: 1,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '32px 0 16px',
                    }}
                >
                    <h2
                        style={{
                            fontSize: '1.8rem',
                            fontWeight: 600,
                            color: 'var(--color-text)',
                        }}
                    >
                        {title}
                    </h2>
                    <AgreementEditPanel slug={slugPath} />
                </div>

                <div className="wiki-body">
                    {loading && <p>加载中…</p>}
                    {!loading && error && <p>❌ {error}</p>}
                    {!loading && !error && (
                        <WikiContent format="markdown" content={content} />
                    )}
                </div>
            </article>

            <TableOfContents headings={headings} />
        </div>
    )
}
