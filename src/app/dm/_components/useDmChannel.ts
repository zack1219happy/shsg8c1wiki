'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { heartbeatConversation, leaveConversation, markConversationRead } from '@/lib/api/dm'

interface RealtimeMessageRow {
    id: string
    sender_id: string
    content: string
    created_at: string
    recalled_at: string | null
}

/**
 * 私信会话的实时通道生命周期：
 * - 订阅 private_messages 的 INSERT / UPDATE（新消息、撤回）
 * - 活跃心跳（页面可见时每 10s），离开时 leave，实时消息不计未读
 * - 进入时标记已读并广播侧栏刷新
 */
export function useDmChannel(conversationId: string, currentUserId: string, handlers: {
    onInsert: (msg: RealtimeMessageRow) => void
    onUpdate: (msg: RealtimeMessageRow) => void
}) {
    const { onInsert, onUpdate } = handlers

    // Realtime 订阅
    useEffect(() => {
        if (!conversationId) return

        const channel = supabase
            .channel('dm-' + conversationId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'private_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => onInsert(payload.new as RealtimeMessageRow),
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'private_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => onUpdate(payload.new as RealtimeMessageRow),
            )
            .subscribe((status, err) => {
                console.log('[DM] sub:', status, err?.message)
            })

        return () => {
            channel.unsubscribe()
        }
    }, [conversationId, onInsert, onUpdate])

    // 标记已读 + 心跳
    useEffect(() => {
        if (!conversationId) return

        markConversationRead(conversationId).finally(() => {
            window.dispatchEvent(new CustomEvent('dm-new-message'))
        })

        heartbeatConversation(conversationId).catch(() => {})
        const interval = setInterval(() => {
            heartbeatConversation(conversationId).catch(() => {})
        }, 10000)

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                heartbeatConversation(conversationId).catch(() => {})
            }
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            clearInterval(interval)
            document.removeEventListener('visibilitychange', onVisible)
            leaveConversation(conversationId).catch(() => {})
        }
    }, [conversationId])
}
