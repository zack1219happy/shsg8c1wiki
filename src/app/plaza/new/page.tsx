'use client'

import { useCallback, useEffect, useState } from 'react'
import FaIcon from '@/components/FaIcon'
import CategoryPickerModal from '@/components/CategoryPickerModal'
import ToggleField from '@/components/ToggleField'
import NewPostFormShell from '@/components/NewPostFormShell'
import { getSession } from '@/lib/auth'
import { checkPlazaDuplicate, createPlazaArticle, fetchPlazaCategories } from '@/lib/api/plaza'
import { loadPinyinInitialsFromDB } from '@/lib/people'
import { useNewPostForm } from '@/hooks/useNewPostForm'
import type { PlazaCategory } from '@/types/plaza'
import Styles from '@/styles/forum.module.css'

/* ==============================================================
   发表文章页
   - 默认私密，可见性/JS 开关用共享 ToggleField
   - 分类通过 CategoryPickerModal 从数据库分类树中选择
   ============================================================== */

export default function NewArticlePage() {
    const [categoryId, setCategoryId] = useState<string | null>(null) // 用户选的分类 ID
    const [categoryName, setCategoryName] = useState<string | null>(null) // 用户选的分类名（用于显示）
    const [isPublic, setIsPublic] = useState(false) // 默认私密
    const [hasJs, setHasJs] = useState(false)
    const [categories, setCategories] = useState<PlazaCategory[]>([])
    const [pickerOpen, setPickerOpen] = useState(false)
    const session = getSession()

    useEffect(() => { loadPinyinInitialsFromDB() }, [])

    // 加载分类
    useEffect(() => {
        fetchPlazaCategories()
            .then(setCategories)
            .catch(() => {})
    }, [])

    const form = useNewPostForm({
        draftKey: 'plaza_new',
        extraDraft: { categoryId, categoryName, isPublic, hasJs },
        onRestoreExtra: (draft) => {
            if (typeof draft.categoryId === 'string') setCategoryId(draft.categoryId)
            if (typeof draft.categoryName === 'string') setCategoryName(draft.categoryName)
            if (draft.isPublic !== undefined) setIsPublic(draft.isPublic as boolean)
            if (draft.hasJs !== undefined) setHasJs(draft.hasJs as boolean)
        },
        checkDuplicate: (title, content) => checkPlazaDuplicate(title, content),
        publish: async (title, content) => {
            const cat = categories.find((c) => c.id === categoryId)
            if (!cat) throw new Error('无效的分类')
            const slug =
                title
                    .toLowerCase()
                    .replace(/[^\w一-鿿-]+/g, '-')
                    .replace(/^-+|-+$/g, '') +
                '-' +
                Date.now().toString(36)
            await createPlazaArticle(title, slug, content, categoryId!, isPublic, hasJs)
            return '/plaza/post?slug=' + encodeURIComponent(slug)
        },
        errorFallback: '发布失败',
    })

    // 分类显示文本（含父级路径）
    const categoryLabel = useCallback(() => {
        if (!categoryName) return null
        const cat = categories.find((c) => c.name === categoryName)
        if (!cat) return categoryName
        const parts: string[] = [cat.name]
        let parentId = cat.parent_id
        while (parentId) {
            const parent = categories.find((c) => c.id === parentId)
            if (!parent) break
            parts.unshift(parent.name)
            parentId = parent.parent_id
        }
        return parts.join(' · ')
    }, [categoryName, categories])

    if (!session) {
        return (
            <div className={Styles.page}>
                <p className={Styles.error}>请先登录后再发文章</p>
            </div>
        )
    }

    return (
        <>
            <NewPostFormShell
                heading={<><FaIcon name="pen" /> 发表文章</>}
                backHref="/plaza"
                noun="文章"
                titlePlaceholder="文章标题"
                title={form.title}
                onTitleChange={form.setTitle}
                content={form.content}
                onContentChange={form.setContent}
                noSanitizePreview={hasJs}
                canSubmit={!!categoryId}
                controls={
                    <>
                        {/* 分类选择器 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>分类</label>
                            <button
                                type="button"
                                className={Styles.catPickerTrigger}
                                onClick={() => setPickerOpen(true)}
                            >
                                <FaIcon name="folder" className={Styles.catPickerTriggerIcon} />
                                <span className={`${Styles.catPickerTriggerText} ${!categoryLabel() ? Styles.catPickerTriggerPlaceholder : ''}`}>
                                    {categoryLabel() || '选择分类…'}
                                </span>
                                <FaIcon name="chevron-right" className={Styles.catPickerTriggerChevron} />
                            </button>
                        </div>

                        {/* 可见性 */}
                        <ToggleField
                            label="可见性"
                            checked={isPublic}
                            onChange={setIsPublic}
                            onText="公开（所有人可见）"
                            offText="私密（仅自己可见）"
                        />

                        {/* JS 开关 */}
                        <ToggleField
                            label="JavaScript"
                            tooltip="开启后，读者可选择直接运行页面中的 JavaScript（跳过安全过滤）。仅在您信任内容的情况下使用。"
                            checked={hasJs}
                            onChange={setHasJs}
                            onText="开启"
                            offText="关闭"
                        />
                    </>
                }
                error={form.error}
                submitting={form.submitting}
                onSubmit={form.submit}
                dupWarning={form.dupWarning}
                onDismissDup={form.dismissDup}
                onForceSubmit={form.forceSubmit}
                submitLabel="发布文章"
            />

            {/* 分类选择模态框 */}
            {pickerOpen && (
                <CategoryPickerModal
                    categories={categories}
                    selectedName={categoryName}
                    onConfirm={(id, name) => { setCategoryId(id); setCategoryName(name) }}
                    onClose={() => setPickerOpen(false)}
                />
            )}
        </>
    )
}
