'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserName } from '@/components/UserName'
import { getConversations, sendMessage } from '@/lib/api/dm'
import { fetchAllUsers } from '@/lib/api/users'
import type { UserInfo } from '@/types/gist'
import DmComposer from './DmComposer'
import styles from '@/styles/dm.module.css'

/** 新建对话视图（?user=xxx）：发第一条消息后跳转到会话 */
export default function NewChatView({ otherUserId }: { otherUserId: string }) {
    const router = useRouter()
    const [otherUser, setOtherUser] = useState<UserInfo | null>(null)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    useEffect(() => {
        fetchAllUsers().then((users) => {
            const u = users.find((u) => u.id === otherUserId)
            if (u) setOtherUser(u)
        })
    }, [otherUserId])

    const handleSend = useCallback(async () => {
        if (!input.trim() || sending) return
        setSending(true)
        setErrorMsg(null)
        try {
            await sendMessage(otherUserId, input.trim())
            const convs = await getConversations()
            const conv = convs.find((c) => c.other_user_id === otherUserId)
            if (conv) {
                router.replace(`/dm?conv=${conv.conversation_id}`)
            } else {
                router.replace('/dm')
            }
        } catch (e: unknown) {
            setErrorMsg((e as { message?: string } | null)?.message || '发送失败')
        } finally {
            setSending(false)
        }
    }, [input, otherUserId, sending, router])

    return (
        <div className={styles.chatView}>
            <div className={styles.chatHeader}>
                <span className={styles.chatHeaderName}>
                    {otherUser ? <UserName username={otherUser.username} userId={otherUser.id} /> : '加载中…'}
                </span>
            </div>

            <div className={styles.messageList}>
                {errorMsg ? (
                    <div className={styles.sendError}>{errorMsg}</div>
                ) : (
                    <p className={styles.status}>发送第一条消息给对方 👋</p>
                )}
            </div>

            <DmComposer value={input} onChange={setInput} onSubmit={handleSend} sending={sending} />
        </div>
    )
}
