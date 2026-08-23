'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import FaIcon from '@/components/FaIcon'
import { UserName } from '@/components/UserName'
import { supabase } from '@/lib/supabase'
import type { FollowState, UserProfile, ConversationSummary } from './types'
import styles from '@/styles/mypage.module.css'

/** 灰色衬底头部：用户名 + 座右铭（可编辑）+ 私信/关注按钮 */
export function HeaderBar({
    profile, initials, isSelf, followState, onFollowToggle,
}: {
    profile: UserProfile
    initials: string
    isSelf: boolean
    followState: FollowState
    onFollowToggle: () => void
}) {
    const [motto, setMotto] = useState(profile.motto)
    const [editingMotto, setEditingMotto] = useState(false)
    const [mottoDraft, setMottoDraft] = useState(profile.motto)
    const [prevMotto, setPrevMotto] = useState(profile.motto)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // sync from profile（渲染期调整，避免在 effect 中同步 setState）
    if (prevMotto !== profile.motto) {
        setPrevMotto(profile.motto)
        setMotto(profile.motto)
        setMottoDraft(profile.motto)
    }

    const handleStartEdit = useCallback(() => {
        setMottoDraft(motto)
        setEditingMotto(true)
        requestAnimationFrame(() => inputRef.current?.focus())
    }, [motto])

    const handleSaveMotto = useCallback(async () => {
        const trimmed = mottoDraft.trim()
        if (trimmed) {
            setMotto(trimmed)
            await supabase.rpc('update_motto', { p_motto: trimmed })
        }
        setEditingMotto(false)
    }, [mottoDraft])

    const handleCancelMotto = useCallback(() => {
        setMottoDraft(motto)
        setEditingMotto(false)
    }, [motto])

    // 学号 → 届数色
    const sDigits = (profile.student_id ?? '').replace(/\D/g, '')
    const sNum = sDigits.length <= 2 ? parseInt(sDigits, 10) : parseInt(sDigits.slice(-2), 10)
    const badgeColor = sNum >= 1 && sNum <= 5 ? '#e88d9e'
        : sNum >= 51 && sNum <= 70 ? '#4a90d9'
        : '#999'

    return (
        <div className={styles.headerBg}>
            <div className={styles.headerInner}>
                <div className={styles.headerLeft}>
                    <div className={styles.userNameRow}>
                        <UserName username={profile.username} userId={profile.id} link={false} />
                    </div>
                    <div className={styles.mottoRow}>
                        {editingMotto ? (
                            <div className={styles.mottoEditArea}>
                                <span className={styles.initials} style={{ background: badgeColor }}>{initials}</span>
                                <input
                                    ref={inputRef}
                                    className={styles.mottoInput}
                                    type="text" maxLength={60}
                                    value={mottoDraft}
                                    onChange={e => setMottoDraft(e.target.value)}
                                    onBlur={handleSaveMotto}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveMotto()
                                        if (e.key === 'Escape') handleCancelMotto()
                                    }}
                                    placeholder="写一句座右铭…"
                                />
                                <button className={styles.mottoEditAction} onClick={handleSaveMotto} title="保存">
                                    <FaIcon name="check" />
                                </button>
                                <button className={styles.mottoEditAction} onClick={handleCancelMotto} title="取消">
                                    <FaIcon name="times" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className={styles.initials} style={{ background: badgeColor }}>{initials}</span>
                                <span className={styles.mottoText}>
                                    {motto || '还没有座右铭'}
                                </span>
                                {isSelf && (
                                    <button className={styles.mottoEditBtn} onClick={handleStartEdit} title="编辑座右铭">
                                        <FaIcon name="pen" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.headerRight}>
                    {/* 私信：仅查看他人主页时显示 */}
                    {!isSelf && (
                        <DmButton targetUserId={profile.id} router={router} />
                    )}
                    {/* 关注/取消关注：仅查看他人主页时显示 */}
                    {!isSelf && (
                        <button
                            className={`${styles.actionBtn} ${
                                followState === 'none' ? styles.followBtn : styles.followBtnActive
                            }`}
                            onClick={onFollowToggle}
                        >
                            {followState === 'none' && <>+ 关注</>}
                            {followState === 'following' && <><FaIcon name="check" /> 已关注</>}
                            {followState === 'mutual' && <><FaIcon name="check" /> 互相关注</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

/** 私信按钮：先查已有对话，有则跳 conv，无则用 user= */
function DmButton({ targetUserId, router }: { targetUserId: string; router: ReturnType<typeof useRouter> }) {
    const [busy, setBusy] = useState(false)

    const handleClick = useCallback(async () => {
        if (busy) return
        setBusy(true)
        try {
            const { data: convs } = await supabase.rpc('get_conversations')
            const conv = (convs as ConversationSummary[] | null)?.find(c => c.other_user_id === targetUserId)
            if (conv) {
                router.push(`/dm?conv=${conv.conversation_id}`)
            } else {
                router.push(`/dm?user=${targetUserId}`)
            }
        } catch {
            router.push(`/dm?user=${targetUserId}`)
        }
    }, [targetUserId, router, busy])

    return (
        <button
            className={`${styles.actionBtn} ${styles.dmBtn}`}
            onClick={handleClick}
            disabled={busy}
        >
            <FaIcon name="envelope" /> {busy ? '…' : '私信'}
        </button>
    )
}
