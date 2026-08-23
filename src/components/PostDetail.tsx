'use client'

import type { ReactNode } from 'react'
import FaIcon from '@/components/FaIcon'
import pd from '@/styles/post-detail.module.css'
import styles from '@/styles/forum.module.css'

/**
 * 详情页骨架：标题栏（标题 + 右侧图标操作）+ 元信息行 + 内容区。
 * 论坛帖 / 广场文章共用；编辑态把 input 传进 title 即可。
 */
export function PostDetailShell({ title, actions, meta, children }: {
    title: ReactNode
    actions?: ReactNode
    meta?: ReactNode
    children: ReactNode
}) {
    return (
        <>
            <div className={pd.detailHeader}>
                <div className={pd.detailHeaderInner}>
                    <div className={pd.detailTitleRow}>
                        {title}
                        <div style={{ display: 'flex', gap: 4 }}>{actions}</div>
                    </div>
                    <div className={pd.detailMeta}>{meta}</div>
                </div>
            </div>
            <div className={styles.page} style={{ paddingTop: 0 }}>
                {children}
            </div>
        </>
    )
}

/** 赞/踩栏。广场版通过 children 追加投币按钮与计数。 */
export function VoteBar({ up, down, myVote, onVote, children }: {
    up: number
    down: number
    myVote: 'up' | 'down' | null
    onVote: (type: 'up' | 'down') => void
    children?: ReactNode
}) {
    return (
        <div className={pd.voteBar}>
            <button
                className={`${pd.voteIcon} ${myVote === 'up' ? pd.voteIconActiveUp : ''}`}
                onClick={() => onVote('up')} title="赞"
            >
                <FaIcon name="thumbs-up" />
            </button>
            <span className={`${pd.voteCount} ${up > 0 ? pd.voteCountPositive : ''}`}>{up}</span>
            <button
                className={`${pd.voteIcon} ${myVote === 'down' ? pd.voteIconActiveDown : ''}`}
                onClick={() => onVote('down')} title="踩"
            >
                <FaIcon name="thumbs-down" />
            </button>
            <span className={`${pd.voteCount} ${down > 0 ? pd.voteCountNegative : ''}`}>{down}</span>
            {children}
        </div>
    )
}
