'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import DmChatView from './_components/DmChatView'
import NewChatView from './_components/NewChatView'
import styles from '@/styles/dm.module.css'

/** 私信页路由分发：?conv=xxx 会话 / ?user=xxx 新对话 / 空态 */
export default function DmPageInner() {
    const [activeQuery, setActiveQuery] = useState(() => window.location.search)
    const router = useRouter()
    const session = getSession()

    // 同步 URL query — 同时处理浏览器前进/后退 (popstate) 和
    // 从 layout 侧栏发起的导航 (dm-route-change 自定义事件)
    useEffect(() => {
        const syncQuery = () => setActiveQuery(window.location.search)
        syncQuery()
        window.addEventListener('popstate', syncQuery)
        window.addEventListener('dm-route-change', syncQuery)
        return () => {
            window.removeEventListener('popstate', syncQuery)
            window.removeEventListener('dm-route-change', syncQuery)
        }
    }, [])

    const params = useMemo(() => new URLSearchParams(activeQuery), [activeQuery])
    const convId = params.get('conv')
    const userId = params.get('user')

    useEffect(() => {
        if (!session) router.push('/')
    }, [session, router])

    if (!session) {
        return null
    }

    return (
        <div className={styles.page}>
            {convId ? (
                <DmChatView key={convId} conversationId={convId} currentUserId={session.userId} />
            ) : userId ? (
                <NewChatView key={userId} otherUserId={userId} />
            ) : (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>💬</div>
                    <p className={styles.emptyText}>选择一个对话开始聊天</p>
                    <p className={styles.emptyHint}>或点击左侧「＋」发起新私信</p>
                </div>
            )}
        </div>
    )
}
