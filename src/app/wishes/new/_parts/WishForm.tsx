'use client'

import dynamic from 'next/dynamic'
import FaIcon from '@/components/FaIcon'
import { CONTACT_OPTIONS } from './constants'
import ModelPicker from './ModelPicker'
import styles from '@/styles/wishes.module.css'

const MarkdownEditor = dynamic(
    () => import('@/components/MarkdownEditor').then((m) => m.MarkdownEditor),
    { ssr: false },
)

/** 步骤 2：需求表单（描述 + 联系方式 + 模型选择 + 加钱/预算） */
export default function WishForm({
    session,
    description, onDescriptionChange,
    contactType, onContactTypeChange, contactDetail, onContactDetailChange,
    modelPref, onModelPrefChange,
    extraMoney, onExtraMoneyChange,
    budgetCap, onBudgetCapChange,
    myPoints, bothAnswered, pointsNeeded,
    error, submitting, onSubmit,
}: {
    session: { userId: string; username: string } | null
    description: string
    onDescriptionChange: (v: string) => void
    contactType: string
    onContactTypeChange: (v: string) => void
    contactDetail: string
    onContactDetailChange: (v: string) => void
    modelPref: string
    onModelPrefChange: (v: string) => void
    extraMoney: string
    onExtraMoneyChange: (v: string) => void
    budgetCap: string
    onBudgetCapChange: (v: string) => void
    myPoints: number
    bothAnswered: boolean
    pointsNeeded: number
    error: string | null
    submitting: boolean
    onSubmit: () => void
}) {
    const formValid = description.trim().length > 0

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>2</span>
                说说你想要什么
            </h2>

            <div className={styles.form}>
                {/* 功能描述 */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                        想要的功能 <span className={styles.required}>*</span>
                    </label>
                    <div style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--border-radius)',
                        overflow: 'hidden',
                        height: 240,
                    }}>
                        <MarkdownEditor
                            value={description}
                            onChange={onDescriptionChange}
                            className={styles.editorInner}
                        />
                    </div>
                </div>

                {/* 联系方式 */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>怎么联系你</label>
                    <div className={styles.contactOptions}>
                        {CONTACT_OPTIONS.map((c) => (
                            <button
                                key={c.value}
                                className={`${styles.contactOption} ${contactType === c.value ? styles.contactOptionActive : ''}`}
                                onClick={() => {
                                    onContactTypeChange(c.value)
                                    if (c.value === 'dm') onContactDetailChange('')
                                }}
                                disabled={c.value === 'dm' && !session}
                                title={c.value === 'dm' && !session ? '请先登录' : undefined}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    {contactType !== 'dm' && (
                        <input
                            className={styles.formInput}
                            type="text"
                            placeholder={CONTACT_OPTIONS.find((c) => c.value === contactType)?.placeholder}
                            value={contactDetail}
                            onChange={(e) => onContactDetailChange(e.target.value)}
                        />
                    )}
                    {contactType === 'dm' && session && (
                        <p className={styles.formHint}>
                            已登录为 <strong>@{session.username}</strong>，提交后可通过站内私信联系
                        </p>
                    )}
                    {contactType === 'dm' && !session && (
                        <p className={styles.formHintWarn}>请先登录才能使用站内私信联系</p>
                    )}
                </div>

                {/* 模型选择 */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                        想用哪个 AI 模型？
                        <span className={styles.formLabelExtra}>（默认不用管）</span>
                    </label>
                    <ModelPicker value={modelPref} onChange={onModelPrefChange} />
                </div>

                {/* 加钱 */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                        加钱插队？
                        <span className={styles.formLabelExtra}>（选填，整数）</span>
                    </label>
                    <div className={styles.inputWithSuffix}>
                        <span className={styles.inputPrefix}>¥</span>
                        <input
                            className={styles.formInput}
                            type="number"
                            min="0"
                            step="1"
                            placeholder="加越多排名越靠前"
                            value={extraMoney}
                            onChange={(e) => onExtraMoneyChange(e.target.value)}
                        />
                    </div>
                    <p className={styles.formHint}>填写后我会联系你确认收款，确认后才生效</p>
                </div>

                {/* API 预算上限 */}
                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                        API 成本上限？
                        <span className={styles.formLabelExtra}>（选填）</span>
                    </label>
                    <div className={styles.inputWithSuffix}>
                        <span className={styles.inputPrefix}>¥</span>
                        <input
                            className={styles.formInput}
                            type="number"
                            min="0"
                            step="1"
                            placeholder="超出后先联系你确认，不填就不限"
                            value={budgetCap}
                            onChange={(e) => onBudgetCapChange(e.target.value)}
                        />
                    </div>
                </div>

                {/* 积分余额提示 */}
                {session && (
                    <div style={{
                        padding: '10px 14px', fontSize: '0.82rem',
                        borderRadius: 'var(--border-radius)',
                        background: 'var(--color-active-bg)',
                        color: 'var(--color-text-secondary)',
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <FaIcon name="coins" />
                        <span>
                            你目前有 <strong style={{ color: 'var(--color-primary)' }}>{myPoints}</strong> 积分
                            {bothAnswered && (
                                <> · 服务费可用 <strong>{pointsNeeded}</strong> 积分抵扣</>
                            )}
                        </span>
                    </div>
                )}

                {/* 提交按钮 */}
                {error && <p className={styles.formError}>❌ {error}</p>}

                <button
                    className={styles.submitBtn}
                    disabled={!formValid || submitting}
                    onClick={onSubmit}
                >
                    {submitting ? (
                        <><FaIcon name="spinner" spin /> 提交中…</>
                    ) : (
                        '提交需求'
                    )}
                </button>
            </div>
        </section>
    )
}
