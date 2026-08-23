'use client'

import { useMemo } from 'react'
import { useDbPage } from '@/hooks/useDbPage'
import { renderAttributesFromFrontmatter, renderInlineTitle, createMarkdown, extractHeadingsFromHtml } from '@/lib/markdown'
import type { Heading } from '@/lib/markdown'
import Breadcrumb from '@/components/Breadcrumb'
import AttributeBox from '@/components/AttributeBox'
import TableOfContents from '@/components/TableOfContents'
import CommentSection from '@/components/CommentSection'
import WikiEditPanel from '@/components/WikiEditPanel'
import WikiContent from '@/components/WikiContent'
import type { NavNode } from '@/lib/navigation'

const homeCrumb: NavNode[] = [{ id: 'home', title: '首页', type: 'page', pathKey: '' }]

export default function WikiHomePage() {
    const { page } = useDbPage('wiki', 'home')

    const content = page?.content ?? ''
    const title = page?.title ?? '首页'

    // 属性栏：与详情页同款，从 frontmatter 客户端渲染
    const attributes = useMemo(
        () => renderAttributesFromFrontmatter((page?.frontmatter ?? {}) as Record<string, unknown>),
        [page],
    )

    // 标题提取供 TOC：与详情页同款客户端管线
    const headings: Heading[] = useMemo(() => {
        if (!content) return []
        try {
            const html = createMarkdown({ highlight: true, texmath: true, anchor: true }).render(content)
            return extractHeadingsFromHtml(html)
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
                        dangerouslySetInnerHTML={{ __html: renderInlineTitle(title) }}
                    />
                    <WikiEditPanel slug="home" />
                </div>

                <Breadcrumb crumbs={homeCrumb} baseHref="/wiki" />
                <AttributeBox attributes={attributes} />

                <WikiContent content={content} className="wiki-body" slug="home" />

                <CommentSection source="wiki" targetId="home" />
            </article>

            <TableOfContents headings={headings} />
        </div>
    )
}
