'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import FaIcon from '@/components/FaIcon'
import { getSession } from '@/lib/auth'
import { checkForumDuplicate, createForumPost } from '@/lib/api/forum'
import { fetchAllUsers } from '@/lib/api/users'
import { loadPinyinInitialsFromDB } from '@/lib/people'
import VisibilityBar from '@/components/VisibilityBar'
import VisibilityModal from '@/components/VisibilityModal'
import NewPostFormShell from '@/components/NewPostFormShell'
import { useNewPostForm } from '@/hooks/useNewPostForm'
import type { UserInfo } from '@/types/gist'
import Styles from '@/styles/forum.module.css'

export default function NewPostPage() {
    const [allUsers, setAllUsers] = useState<UserInfo[]>([])
    const [usersLoading, setUsersLoading] = useState(true)
    const [excludedUserIds, setExcludedUserIds] = useState<string[]>([])
    const [agentVisible, setAgentVisible] = useState(true)
    const [showVisibilityModal, setShowVisibilityModal] = useState(false)
    const session = getSession()

    // 加载用户列表 + 拼音首字母
    useEffect(() => {
        loadPinyinInitialsFromDB()
        fetchAllUsers()
            .then((users) => setAllUsers(users))
            .catch(() => {})
            .finally(() => setUsersLoading(false))
    }, [])

    const form = useNewPostForm({
        draftKey: 'forum_new',
        extraDraft: { excludedUserIds, agentVisible },
        onRestoreExtra: (draft) => {
            if (Array.isArray(draft.excludedUserIds)) setExcludedUserIds(draft.excludedUserIds as string[])
            if ('agentVisible' in draft) setAgentVisible((draft.agentVisible as boolean) ?? false)
        },
        checkDuplicate: (title, content) => checkForumDuplicate(title, content),
        publish: (title, content) =>
            createForumPost(title, content, excludedUserIds, agentVisible).then((id) => '/forum/post?id=' + id),
        errorFallback: '发帖失败',
    })

    /** 在模态框中切换某个用户是否被排除 */
    const toggleExclude = useCallback((userId: string) => {
        setExcludedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
        )
    }, [])

    /** 从 excludedUserIds 反查 UserInfo */
    const excludedUsers = useMemo(
        () => allUsers.filter((u) => excludedUserIds.includes(u.id)),
        [allUsers, excludedUserIds],
    )

    if (!session) {
        return (
            <div className={Styles.page}>
                <p className={Styles.error}>请先登录后再发帖</p>
            </div>
        )
    }

    return (
        <>
            <NewPostFormShell
                heading={<><FaIcon name="pen" /> 发新帖</>}
                backHref="/forum"
                noun="帖子"
                titlePlaceholder="帖子标题"
                title={form.title}
                onTitleChange={form.setTitle}
                content={form.content}
                onContentChange={form.setContent}
                controls={
                    <VisibilityBar
                        excludedUsers={excludedUsers}
                        onOpenModal={() => setShowVisibilityModal(true)}
                        onRemoveExclude={(userId) =>
                            setExcludedUserIds((prev) => prev.filter((id) => id !== userId))
                        }
                        agentVisible={agentVisible}
                        onAgentVisibleChange={setAgentVisible}
                    />
                }
                error={form.error}
                submitting={form.submitting}
                onSubmit={form.submit}
                dupWarning={form.dupWarning}
                onDismissDup={form.dismissDup}
                onForceSubmit={form.forceSubmit}
                submitLabel="发布帖子"
            />

            {showVisibilityModal && (
                <VisibilityModal
                    allUsers={allUsers}
                    usersLoading={usersLoading}
                    excludedUserIds={excludedUserIds}
                    onToggle={toggleExclude}
                    onClose={() => setShowVisibilityModal(false)}
                />
            )}
        </>
    )
}
