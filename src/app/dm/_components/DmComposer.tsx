'use client'

import dynamic from 'next/dynamic'
import styles from '@/styles/dm.module.css'

const MarkdownEditor = dynamic(
    () => import('@/components/MarkdownEditor').then((m) => m.MarkdownEditor),
    { ssr: false },
)

/** 私信输入区：Ctrl+Enter 发送提示 + 编辑器 + 发送按钮（新对话/聊天共用） */
export default function DmComposer({ value, onChange, onSubmit, sending, resetKey }: {
    value: string
    onChange: (v: string) => void
    onSubmit: () => void
    sending?: boolean
    /** 变化时强制重建编辑器（如乐观发送后清空内容） */
    resetKey?: number | string
}) {
    return (
        <div className={styles.inputArea}>
            <div className={styles.editorWrap}>
                <span className={styles.editorHint}>Ctrl+Enter 发送</span>
                <MarkdownEditor
                    key={resetKey}
                    value={value}
                    onChange={onChange}
                    config={{ preview: false, fullScreen: false, scrollSync: false }}
                    className={styles.editorInner}
                    previewClassName={styles.editorPreviewContent}
                    onSubmit={onSubmit}
                />
            </div>
            <div className={styles.inputActions}>
                <button
                    className={styles.sendBtn}
                    onClick={onSubmit}
                    disabled={sending || !value.trim()}
                >
                    {sending ? '发送中…' : '发送'}
                </button>
            </div>
        </div>
    )
}
