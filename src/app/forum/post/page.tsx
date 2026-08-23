'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import FaIcon from '@/components/FaIcon'
import WikiContent from '@/components/WikiContent'
import { renderMarkdown } from '@/lib/markdown'
import { getSession } from '@/lib/auth'
import {
  fetchForumPost,
  voteForumPost,
  removeForumVote,
  getUserForumVote,
  updateForumPost,
  fetchAllUsers,
} from '@/lib/gist-api'
import CommentSection from '@/components/CommentSection'
import VisibilityBar from '@/components/VisibilityBar'
import VisibilityModal from '@/components/VisibilityModal'
import type { ForumPost, UserInfo } from '@/types/gist'
import { formatDate } from '@/lib/forum'
import { UserName } from '@/components/UserName'
import { loadPinyinInitialsFromDB } from '@/lib/people'
import { useAutoSave, loadDraft } from '@/hooks/useAutoSave'
import styles from '@/styles/forum.module.css'
import pd from '@/styles/post-detail.module.css'

const MarkdownEditor = dynamic(
  () => import('@/components/MarkdownEditor').then((m) => m.MarkdownEditor),
  { ssr: false },
)

export default function ForumPostPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const postId = searchParams.get('id') || ''

  const [post, setPost] = useState<ForumPost | null>(null)
  const [loadedPostId, setLoadedPostId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = loadedPostId !== postId
  const [session, setSession] = useState<{ userId: string; username: string } | null>(null)
  const [myVote, setMyVote] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editExcludedIds, setEditExcludedIds] = useState<string[]>([])
  const [editAgentVisible, setEditAgentVisible] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [allUsers, setAllUsers] = useState<UserInfo[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [showVisibilityModal, setShowVisibilityModal] = useState(false)

  /** 全量加载（首次 / 出错时用） */
  const load = useCallback(() => {
    if (!postId) return
    Promise.all([
      fetchForumPost(postId),
      getSession(),
      getUserForumVote(postId).catch(() => null),
    ])
      .then(([p, s, v]) => {
        setError(null)
        if (!p) { setError('帖子不存在'); return }
        setPost(p)
        setSession(s)
        setMyVote(v)
        fetchAllUsers().then(setAllUsers).catch(() => {}).finally(() => setUsersLoading(false))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : null))
      .finally(() => setLoadedPostId(postId))
  }, [postId])

  /** 局部刷新：只重拉帖子 + 我的投票（投票后、编辑后），不触发 loading */
  const refreshPostOnly = useCallback(async () => {
    if (!postId) return
    try {
      const [p, v] = await Promise.all([
        fetchForumPost(postId),
        getUserForumVote(postId).catch(() => null),
      ])
      if (p) { setPost(p); setMyVote(v) }
    } catch {}
  }, [postId])

  useEffect(() => { load() }, [load])

  // 客户端初始化：加载拼音首字母
  useEffect(() => { loadPinyinInitialsFromDB() }, [])

  // 编辑模式草稿恢复
  useEffect(() => {
    if (!postId) return
    void (async () => {
      interface DraftData {
        title: string
        content: string
        excludedUserIds: string[]
        agentVisible?: boolean
      }
      const draft = loadDraft<DraftData>(`forum_edit_${postId}`)
      if (draft && postId) {
        // 有草稿时自动进入编辑模式
        if (draft.title) setEditTitle(draft.title)
        if (draft.content) setEditContent(draft.content)
        if (draft.excludedUserIds) setEditExcludedIds(draft.excludedUserIds)
        if ('agentVisible' in draft) setEditAgentVisible(draft.agentVisible ?? false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在挂载时恢复一次草稿
  }, [])

  // 编辑模式自动保存草稿
  const editHasContent = editTitle.trim() !== '' || editContent.trim() !== ''
  const { clearDraft: clearEditDraft } = useAutoSave({
    key: `forum_edit_${postId}`,
    data: { title: editTitle, content: editContent, excludedUserIds: editExcludedIds, agentVisible: editAgentVisible },
    enabled: editing && editHasContent,
  })

  const handleVote = async (type: 'up' | 'down') => {
    if (!post) return
    // 乐观更新：立即反映 UI
    const prevVote = myVote
    setPost((p) => {
      if (!p) return p
      const next = { ...p }
      // 撤销之前的投票（如果有）
      if (prevVote === 'up') next.upvotes = Math.max(0, (next.upvotes ?? 0) - 1)
      if (prevVote === 'down') next.downvotes = Math.max(0, (next.downvotes ?? 0) - 1)
      if (type !== prevVote) {
        // 新投票
        if (type === 'up') next.upvotes = (next.upvotes ?? 0) + 1
        if (type === 'down') next.downvotes = (next.downvotes ?? 0) + 1
        setMyVote(type)
      } else {
        setMyVote(null)
      }
      return next
    })
    try {
      if (myVote === type) {
        await removeForumVote(post.id)
      } else {
        await voteForumPost(post.id, type)
      }
      // 后台同步确保一致性
      refreshPostOnly()
    } catch {
      // 回滚
      setMyVote(prevVote)
      refreshPostOnly()
    }
  }

  const startEdit = () => {
    if (!post) return
    setEditTitle(post.title)
    setEditContent(post.content)
    setEditExcludedIds(post.excluded_visibility ?? [])
    setEditAgentVisible(post.agent_visible ?? true)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditTitle('')
    setEditContent('')
    setEditExcludedIds([])
    clearEditDraft()
  }

  const submitEdit = async () => {
    if (!post || !editTitle.trim() || !editContent.trim() || submitting) return
    setSubmitting(true)
    try {
      await updateForumPost(post.id, editTitle.trim(), editContent.trim(), editExcludedIds, editAgentVisible)
      clearEditDraft()
      setEditing(false)
      refreshPostOnly()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : null) }
    finally { setSubmitting(false) }
  }

  const isAuthor = session && post && session.userId === post.author_id
  const editExcludedUsers = allUsers.filter((u) => editExcludedIds.includes(u.id))

  if (!postId) return <div className={styles.page}><p>缺少帖子 ID</p></div>
  if (loading) return <div className={styles.page}><p className={styles.loading}>加载中&hellip;</p></div>
  if (error) return <div className={styles.page}><p className={styles.error}>❌ {error}</p></div>
  if (!post) return <div className={styles.page}><p className={styles.error}>❌ 帖子不存在</p></div>

  return (
    <>
      <div className={pd.detailHeader}>
        <div className={pd.detailHeaderInner}>
          <div className={pd.detailTitleRow}>
            {editing ? (
              <input
                className={styles.titleInput}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={100}
                autoFocus
              />
            ) : (
              <h1 className={pd.detailTitle} dangerouslySetInnerHTML={{ __html: renderMarkdown(post.title) }} />
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {isAuthor && !editing && (
                <button className={pd.backBtnIcon} onClick={startEdit} title="编辑帖子">
                  <FaIcon name="pen" />
                </button>
              )}
              <button className={pd.backBtnIcon} onClick={editing ? cancelEdit : () => router.push('/forum')} title={editing ? '取消编辑' : '返回讨论区'}>
                <FaIcon name="chevron-left" />
              </button>
            </div>
          </div>
          <div className={pd.detailMeta}>
            <UserName username={post.author_username} userId={post.author_id} className={pd.detailAuthor} />
            <span>发布于 {formatDate(post.created_at)}</span>
            {post.updated_at !== post.created_at && (
              <span>编辑于 {formatDate(post.updated_at)}</span>
            )}
            {editing && <span style={{ color: 'var(--color-primary)' }}>编辑中</span>}
          </div>
        </div>
      </div>

      <div className={styles.page} style={{ paddingTop: 0 }}>
        {editing ? (
          <div className={styles.newPostForm}>
            <VisibilityBar
              excludedUsers={editExcludedUsers}
              onOpenModal={() => setShowVisibilityModal(true)}
              onRemoveExclude={(userId) =>
                setEditExcludedIds((prev) => prev.filter((id) => id !== userId))
              }
              agentVisible={editAgentVisible}
              onAgentVisibleChange={setEditAgentVisible}
            />
            <div className={styles.editorWrapper} style={{ minHeight: '300px' }}>
              <MarkdownEditor value={editContent} onChange={setEditContent} className={styles.editorNoBorder} />
            </div>
            <div className={styles.formActions}>
              <button className={`${styles.btn} ${styles.btnOutline}`} onClick={cancelEdit}>取消</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={submitEdit} disabled={submitting}>
                {submitting ? '保存中&hellip;' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <div className={pd.detail}>
            <div className={pd.detailBody}>
              <WikiContent content={post.content} className="wiki-body" />
            </div>

            <div className={pd.voteBar}>
              <button className={`${pd.voteIcon} ${myVote === 'up' ? pd.voteIconActiveUp : ''}`}
                onClick={() => handleVote('up')} title="赞"><FaIcon name="thumbs-up" /></button>
              <span className={`${pd.voteCount} ${(post.upvotes ?? 0) > 0 ? pd.voteCountPositive : ''}`}>{post.upvotes ?? 0}</span>
              <button className={`${pd.voteIcon} ${myVote === 'down' ? pd.voteIconActiveDown : ''}`}
                onClick={() => handleVote('down')} title="踩"><FaIcon name="thumbs-down" /></button>
              <span className={`${pd.voteCount} ${(post.downvotes ?? 0) > 0 ? pd.voteCountNegative : ''}`}>{post.downvotes ?? 0}</span>
            </div>

            <CommentSection source="forum" targetId={postId} title="评论" />
          </div>
        )}
      </div>

      {showVisibilityModal && (
        <VisibilityModal
          allUsers={allUsers}
          usersLoading={usersLoading}
          excludedUserIds={editExcludedIds}
          onToggle={(userId) =>
            setEditExcludedIds((prev) =>
              prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
            )
          }
          onClose={() => setShowVisibilityModal(false)}
        />
      )}
    </>
  )
}

