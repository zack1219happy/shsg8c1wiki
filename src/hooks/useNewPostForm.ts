'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoSave, loadDraft } from '@/hooks/useAutoSave'

export interface DupInfo {
    existing_title: string
    created_at: string
}

interface NewPostFormOptions {
    /** 草稿存储键 */
    draftKey: string
    /** 随草稿自动保存的额外字段 */
    extraDraft?: Record<string, unknown>
    /** 草稿恢复时处理标题/正文以外的字段 */
    onRestoreExtra?: (draft: Record<string, unknown>) => void
    /** 提交前额外校验，返回错误文案则中断发布 */
    validate?: () => string | null
    /** 内容查重，命中返回重复信息并等待用户确认后强制发布 */
    checkDuplicate?: (title: string, content: string) => Promise<DupInfo | null>
    /** 执行发布（参数为 trim 后的标题与正文），返回完成后跳转的 URL；失败抛错 */
    publish: (title: string, content: string) => Promise<string>
    /** 错误无 message 时的兜底文案（如"发帖失败"/"发布失败"） */
    errorFallback?: string
}

/**
 * 发帖/发文章表单状态机：标题正文 + 草稿自动保存恢复 + 查重拦截 + 强制发布。
 * 论坛与广场的差异只在额外控件与 publish 实现。
 */
export function useNewPostForm(options: NewPostFormOptions) {
    const router = useRouter()
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dupWarning, setDupWarning] = useState<DupInfo | null>(null)

    // 恢复草稿（仅挂载时一次；回调走 ref 以允许内联写法）
    const draftKeyRef = useRef(options.draftKey)
    const onRestoreExtraRef = useRef(options.onRestoreExtra)
    useEffect(() => {
        draftKeyRef.current = options.draftKey
        onRestoreExtraRef.current = options.onRestoreExtra
    })
    useEffect(() => {
        const draft = loadDraft<Record<string, unknown>>(draftKeyRef.current)
        if (!draft) return
        if (typeof draft.title === 'string' && draft.title) setTitle(draft.title)
        if (typeof draft.content === 'string' && draft.content) setContent(draft.content)
        onRestoreExtraRef.current?.(draft)
    }, [])

    // 自动保存草稿
    const hasContent = title.trim() !== '' || content.trim() !== ''
    const { clearDraft } = useAutoSave({
        key: options.draftKey,
        data: { title, content, ...options.extraDraft },
        enabled: hasContent,
    })

    const doPublish = useCallback(async () => {
        if (!title.trim() || !content.trim()) return
        setSubmitting(true)
        setError(null)
        try {
            const url = await options.publish(title.trim(), content.trim())
            clearDraft()
            router.push(url)
        } catch (e: unknown) {
            setError(e instanceof Error && e.message ? e.message : (options.errorFallback ?? '发布失败'))
        } finally {
            setSubmitting(false)
        }
    }, [title, content, options, clearDraft, router])

    /** 常规提交：先校验、再查重，命中重复则挂起等待用户决断 */
    const submit = useCallback(async () => {
        if (submitting) return
        const invalid = options.validate?.()
        if (invalid) {
            setError(invalid)
            return
        }
        if (options.checkDuplicate) {
            const dup = await options.checkDuplicate(title.trim(), content.trim())
            if (dup) {
                setDupWarning(dup)
                return
            }
        }
        await doPublish()
    }, [submitting, options, title, content, doPublish])

    /** 用户确认重复后的强制发布 */
    const forceSubmit = useCallback(() => {
        setDupWarning(null)
        return doPublish()
    }, [doPublish])

    const dismissDup = useCallback(() => setDupWarning(null), [])

    return { title, setTitle, content, setContent, submitting, error, setError, dupWarning, dismissDup, submit, forceSubmit }
}
