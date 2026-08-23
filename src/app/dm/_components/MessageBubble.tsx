'use client'

import { useCallback } from 'react'
import { UserName } from '@/components/UserName'
import type { DmMessage } from '@/lib/api/dm'
import { renderMarkdownWithRegistry, replaceWikiLinks } from '@/lib/markdown'
import { registry, titleSlugMap } from '@/data/person-registry'
import { BASE_PATH } from '@/lib/constants'
import styles from '@/styles/dm.module.css'

/** 消息时间：今天显示 HH:MM，否则 M/D HH:MM */
function formatMsgTime(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    if (isToday) return time
    return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

/** 单条私信气泡（含右键菜单入口与发送失败标记） */
export default function MessageBubble({ msg, failed, onContextMenu }: {
    msg: DmMessage
    failed: boolean
    onContextMenu?: (e: React.MouseEvent, msg: DmMessage) => void
}) {
    const handleContext = useCallback(
        (e: React.MouseEvent) => onContextMenu?.(e, msg),
        [onContextMenu, msg],
    )

    return (
        <div
            className={`${styles.message} ${msg.is_mine ? styles.messageMine : styles.messageOther}`}
            onContextMenu={handleContext}
        >
            <span className={styles.messageAuthor}>
                <UserName username={msg.sender_username} userId={msg.sender_id} />
            </span>
            <div
                className={`${styles.bubble} ${msg.is_mine ? styles.bubbleMine : styles.bubbleOther} ${msg.recalled_at ? styles.bubbleRecalled : ''} ${failed ? styles.bubbleFailed : ''}`}
            >
                {msg.recalled_at ? (
                    <span className={styles.recalledText}>消息已撤回</span>
                ) : (
                    <div className={styles.bubbleContent} dangerouslySetInnerHTML={{ __html: replaceWikiLinks(renderMarkdownWithRegistry(msg.content, registry), titleSlugMap, BASE_PATH).replace(/\n+$/, '') }} />
                )}
            </div>
            <span className={styles.messageTime}>
                {formatMsgTime(msg.created_at)}
                {msg.is_mine && msg.recalled_at && ' (已撤回)'}
                {failed && ' · 发送失败'}
            </span>
        </div>
    )
}
