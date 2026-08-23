'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import styles from '@/styles/forum.module.css'

const MarkdownEditor = dynamic(
    () => import('@/components/MarkdownEditor').then((m) => m.MarkdownEditor),
    { ssr: false },
)

/**
 * 发帖/发文章页骨架：页头 + 标题输入 + 自定义控件区 + 编辑器 + 查重警告 + 操作按钮。
 * 论坛（VisibilityBar）与广场（分类选择器 + 开关）的差异通过 controls 注入。
 */
export default function NewPostFormShell({
    heading, backHref, noun,
    titlePlaceholder, title, onTitleChange,
    content, onContentChange, noSanitizePreview = false,
    controls,
    error, canSubmit = true,
    submitting, onSubmit,
    dupWarning, onDismissDup, onForceSubmit,
    submitLabel, publishingLabel,
}: {
    heading: ReactNode
    backHref: string
    /** 实体名词，用于查重警告文案："帖子" / "文章" */
    noun: string
    titlePlaceholder: string
    title: string
    onTitleChange: (v: string) => void
    content: string
    onContentChange: (v: string) => void
    /** 编辑器预览跳过安全过滤（广场 JS 文章用） */
    noSanitizePreview?: boolean
    controls?: ReactNode
    error?: string | null
    canSubmit?: boolean
    submitting: boolean
    onSubmit: () => void
    dupWarning?: { existing_title: string; created_at: string } | null
    onDismissDup?: () => void
    onForceSubmit?: () => void
    submitLabel: string
    publishingLabel?: string
}) {
    const router = useRouter()

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h2>{heading}</h2>
                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => router.push(backHref)}>
                    ← 返回
                </button>
            </div>

            <div className={styles.newPostForm}>
                <input
                    className={styles.titleInput}
                    type="text"
                    placeholder={titlePlaceholder}
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    maxLength={100}
                    autoFocus
                />

                {controls}

                <div className={styles.editorWrapper}>
                    <MarkdownEditor value={content} onChange={onContentChange} className={styles.editorNoBorder} noSanitizePreview={noSanitizePreview} />
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {/* 重复内容警告 */}
                {dupWarning && (
                    <div className={styles.dupWarning}>
                        <div className={styles.dupWarningContent}>
                            <p><strong>检测到重复内容</strong></p>
                            <p>您已在 {new Date(dupWarning.created_at).toLocaleString('zh-CN')} 发过标题为「{dupWarning.existing_title}」的{noun}，内容相似。</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>确认再次发布吗？</p>
                            <div className={styles.dupWarningActions}>
                                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={onDismissDup}>
                                    不发布了
                                </button>
                                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onForceSubmit}>
                                    确认发布
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className={styles.formActions}>
                    <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => router.push(backHref)}>
                        取消
                    </button>
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={onSubmit}
                        disabled={submitting || !title.trim() || !content.trim() || !canSubmit}
                    >
                        {submitting ? (publishingLabel ?? '发布中…') : submitLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
