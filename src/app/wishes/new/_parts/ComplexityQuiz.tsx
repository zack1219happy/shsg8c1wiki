'use client'

import { Q1, Q2, type Question } from './constants'
import styles from '@/styles/wishes.module.css'

interface Estimate {
    tier: 'small' | 'medium' | 'large'
    tierLabel: string
    serviceFee: number
    apiCostRange: string
}

function QuestionBlock({ q, selected, onSelect }: {
    q: Question
    selected: number | null
    onSelect: (i: number) => void
}) {
    return (
        <div className={styles.qBlock}>
            <p className={styles.qText}>{q.q}</p>
            <div className={styles.qOptions}>
                {q.options.map((opt, i) => (
                    <button
                        key={i}
                        className={`${styles.qOption} ${selected === i ? styles.qOptionActive : ''}`}
                        onClick={() => onSelect(i)}
                    >
                        <span className={styles.qOptionLabel}>{opt.label}</span>
                        <span className={styles.qOptionDesc}>{opt.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

/** 步骤 1：复杂度两题 + 预估档位卡 */
export default function ComplexityQuiz({ q1Idx, q2Idx, onSelectQ1, onSelectQ2, estimate, pointsNeeded, bothAnswered }: {
    q1Idx: number | null
    q2Idx: number | null
    onSelectQ1: (i: number) => void
    onSelectQ2: (i: number) => void
    estimate: Estimate
    pointsNeeded: number
    bothAnswered: boolean
}) {
    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>1</span>
                看看你的需求属于哪一档
            </h2>
            <p className={styles.sectionHint}>
                描述越贴近实际 → 档位估得越准 → 成本越可控
            </p>

            <QuestionBlock q={Q1} selected={q1Idx} onSelect={onSelectQ1} />
            <QuestionBlock q={Q2} selected={q2Idx} onSelect={onSelectQ2} />

            {/* 预估结果 */}
            {bothAnswered && (
                <div className={styles.estimateCard}>
                    <div className={styles.estimateNormal}>
                        <span className={styles.estimateIcon}>👉</span>
                        <div>
                            <strong>预估档位：{estimate.tierLabel}</strong>
                            <p>
                                服务费 <strong>¥{estimate.serviceFee}</strong>（现在付，微信扫码）
                                &nbsp;↔&nbsp; <strong>{pointsNeeded} 积分</strong>
                                &nbsp;+&nbsp; API 成本约 <strong>{estimate.apiCostRange}</strong>（开发完按实际收）
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
