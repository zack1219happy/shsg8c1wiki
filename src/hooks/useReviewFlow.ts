'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** 审核草稿（可编辑的标题/正文） */
export interface ReviewDraft {
    title: string
    content: string
}

interface UseReviewFlowOptions<TItem extends { id: string }, TDetail extends { id: string }> {
    /** 面板是否处于激活 tab（如 requests 面板仅在 tab=requests 时激活） */
    active: boolean
    /** 是否具备审核权限 */
    enabled: boolean
    /** 当前选中条目 id，空串表示列表模式 */
    selectedId: string
    fetchList: () => Promise<TItem[]>
    fetchDetail: (id: string) => Promise<TDetail | null>
    /** 详情加载成功后初始化可编辑草稿 */
    initDraft?: (detail: TDetail) => Partial<ReviewDraft>
    /** 操作完成后的收尾导航 */
    onSettled: () => void
}

/**
 * 审核流通用状态机：待审列表 + 详情加载 + 草稿编辑 + 反馈意见 + 批准/驳回。
 * 编辑审核与新建页面请求审核共用同一套逻辑，差异只在渲染层与具体 API。
 */
export function useReviewFlow<TItem extends { id: string }, TDetail extends { id: string }>(
    options: UseReviewFlowOptions<TItem, TDetail>,
) {
    const { active, enabled, selectedId, fetchList, fetchDetail, initDraft, onSettled } = options
    const canWork = active && enabled

    // ── 列表 ──
    const [items, setItems] = useState<TItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // ── 详情 ──
    const [detail, setDetail] = useState<TDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(true)

    // ── 草稿 / 反馈 / 提交 ──
    const [draft, setDraft] = useState<ReviewDraft>({ title: '', content: '' })
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // 渲染期重置：选中项或激活态变化时切回详情加载中（避免 effect 内同步 setState）
    const detailKey = (active ? '1' : '0') + '|' + selectedId
    const [prevDetailKey, setPrevDetailKey] = useState(detailKey)
    if (prevDetailKey !== detailKey) {
        setPrevDetailKey(detailKey)
        setDetailLoading(true)
    }

    // initDraft 通过 ref 引用，允许调用方传内联箭头函数而不触发详情重载
    const initDraftRef = useRef(initDraft)
    useEffect(() => {
        initDraftRef.current = initDraft
    })

    // 激活态变化时列表回到加载中（如每次进入 requests tab 都重新拉取待审请求）
    const [prevActive, setPrevActive] = useState(active)
    if (prevActive !== active) {
        setPrevActive(active)
        setLoading(true)
        setError(null)
    }

    // 加载待审列表
    useEffect(() => {
        if (!canWork) return
        fetchList()
            .then(setItems)
            .catch((e: { message?: string }) => setError(e?.message ?? '加载失败'))
            .finally(() => setLoading(false))
    }, [canWork, fetchList])

    // 加载详情
    useEffect(() => {
        if (!selectedId || !canWork) return
        fetchDetail(selectedId)
            .then((d) => {
                setDetail(d)
                if (d) setDraft({ title: '', content: '', ...initDraftRef.current?.(d) })
            })
            .catch(() => setDetail(null))
            .finally(() => setDetailLoading(false))
    }, [selectedId, canWork, fetchDetail])

    /** 打开某条待审项（清空反馈意见，返回 id 供路由跳转） */
    const open = useCallback((id: string) => {
        setComment('')
        return id
    }, [])

    /** 关闭详情回到列表 */
    const close = useCallback(() => {
        setDetail(null)
        setComment('')
    }, [])

    /**
     * 执行批准/驳回。
     * runAction 收到 (id, draft, comment, detail)；失败抛错即弹 alert，成功后刷新列表并清场。
     */
    const act = useCallback(
        async (
            kind: 'approve' | 'reject',
            runAction: (id: string, draft: ReviewDraft, comment: string, current: TDetail) => Promise<unknown>,
        ) => {
            if (!detail || submitting) return
            if (kind === 'reject' && !comment.trim() && !window.confirm('没有填写反馈意见，确定要驳回吗？')) return
            setSubmitting(true)
            try {
                await runAction(detail.id, draft, comment, detail)
                const updated = await fetchList()
                setItems(updated)
                setDetail(null)
                setComment('')
                onSettled()
            } catch (e) {
                window.alert(
                    (kind === 'approve' ? '批准失败: ' : '驳回失败: ') +
                        ((e as { message?: string })?.message || '未知错误'),
                )
            } finally {
                setSubmitting(false)
            }
        },
        [detail, submitting, comment, draft, fetchList, onSettled],
    )

    return {
        items, loading, error,
        detail, detailLoading,
        draft, setDraft,
        comment, setComment,
        submitting,
        open, close, act,
    }
}
