'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import pointsStyles from '@/styles/points.module.css'

interface PointsAmountModalProps {
    open: boolean
    onClose: () => void
    /** 弹窗标题（含 emoji），如 "🏆 奖励积分" */
    title: string
    subtitle: ReactNode
    presets: number[]
    /** 提供"自定义"档位（投币有，奖励无） */
    allowCustom?: boolean
    maxAmount?: number
    initialAmount: number
    busyLabel: string
    confirmLabel: (amount: number) => string
    successText: (amount: number) => string
    fallbackError: string
    /** 提交发放；返回 false 或抛错均视为失败 */
    onSubmit: (amount: number) => Promise<boolean>
    /** 成功后的附加副作用（如累加 tip_count），之后弹窗自动关闭 */
    onSuccess?: (amount: number) => void
}

/**
 * 积分数量选择弹窗：预设档位（可选自定义）+ 数量输入 + 发放结果反馈。
 * 广场的"奖励积分"与"投币"共用，仅文案与档位配置不同。
 */
export default function PointsAmountModal({
    open, onClose, title, subtitle,
    presets, allowCustom = false, maxAmount = 999,
    initialAmount, busyLabel, confirmLabel, successText, fallbackError,
    onSubmit, onSuccess,
}: PointsAmountModalProps) {
    const [amount, setAmount] = useState(initialAmount)
    const [custom, setCustom] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState<{ success: boolean; text: string } | null>(null)

    // 每次打开重置：金额回到默认档，清空自定义与结果（渲染期同步，避免 effect 内 setState）
    const [prevOpen, setPrevOpen] = useState(open)
    if (prevOpen !== open) {
        setPrevOpen(open)
        if (open) {
            setAmount(initialAmount)
            setCustom(false)
            setSubmitting(false)
            setResult(null)
        }
    }

    if (!open) return null

    const handleSubmit = async () => {
        if (submitting || amount <= 0) return
        setSubmitting(true)
        setResult(null)
        try {
            const ok = await onSubmit(amount)
            if (ok) {
                setResult({ success: true, text: successText(amount) })
                onSuccess?.(amount)
                setTimeout(onClose, 1000)
            } else {
                setResult({ success: false, text: fallbackError })
            }
        } catch (e: unknown) {
            setResult({ success: false, text: (e instanceof Error && e.message) || fallbackError })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={pointsStyles.awardModal} onClick={onClose}>
            <div className={pointsStyles.awardCard} onClick={(e) => e.stopPropagation()}>
                <div className={pointsStyles.awardHeader}>
                    <h3>{title}</h3>
                    <button className={pointsStyles.awardClose} onClick={onClose}>✕</button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>{subtitle}</p>

                <div className={pointsStyles.awardPresets}>
                    {presets.map((v) => (
                        <button
                            key={v}
                            className={`${pointsStyles.awardPreset} ${!custom && amount === v ? pointsStyles.awardPresetActive : ''}`}
                            onClick={() => { setAmount(v); setCustom(false) }}
                        >
                            {v} 分
                        </button>
                    ))}
                    {allowCustom && (
                        <button
                            className={`${pointsStyles.awardPreset} ${custom ? pointsStyles.awardPresetActive : ''}`}
                            onClick={() => { setCustom(true); setAmount(0) }}
                        >
                            自定义
                        </button>
                    )}
                </div>

                {/* 奖励模式常显输入框；投币模式仅在自定义档显示 */}
                {(custom || !allowCustom) && (
                    <div className={pointsStyles.awardField}>
                        <label>积分数量</label>
                        <input
                            type="number"
                            min={1}
                            max={maxAmount}
                            value={allowCustom ? amount || '' : amount}
                            onChange={(e) => setAmount(Number(e.target.value) || 0)}
                            autoFocus={allowCustom}
                        />
                    </div>
                )}

                <button
                    className={pointsStyles.awardSubmit}
                    onClick={handleSubmit}
                    disabled={submitting || amount <= 0}
                >
                    {submitting ? busyLabel : confirmLabel(amount)}
                </button>
                {result && (
                    <div className={`${pointsStyles.awardResult} ${result.success ? pointsStyles.awardSuccess : pointsStyles.awardError}`}>
                        {result.text}
                    </div>
                )}
            </div>
        </div>
    )
}
