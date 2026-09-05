'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FaIcon from '@/components/FaIcon'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { fetchMyPoints } from '@/lib/api/points'
import { payWishWithPoints } from '@/lib/api/wishes'
import ComplexityQuiz from './_parts/ComplexityQuiz'
import WishForm from './_parts/WishForm'
import PaymentPanel from './_parts/PaymentPanel'
import {
    MODEL_OPTIONS, Q1, Q2,
    POINTS_PER_RMB, RMB_PER_QUOTA_PERCENT, WEEKLY_QUOTA_RMB,
    serviceFeeToPoints, estimateTier,
} from './_parts/constants'
import styles from '@/styles/wishes.module.css'

/* ==============================================================
   许愿池 — 单页表单 + 扫码付款流程
   页面只负责状态编排；题目/表单/付款 UI 在 _parts/
   ============================================================== */

export default function WishingPoolPage() {
    const router = useRouter()
    const session = getSession()

    // —— 步骤 1：复杂度 ——
    const [q1Idx, setQ1Idx] = useState<number | null>(null)
    const [q2Idx, setQ2Idx] = useState<number | null>(null)
    // —— 步骤 2：表单 ——
    const [description, setDescription] = useState('')
    const [contactType, setContactType] = useState(session ? 'dm' : 'wechat')
    const [contactDetail, setContactDetail] = useState('')
    const [modelPref, setModelPref] = useState('luna')
    const [extraMoney, setExtraMoney] = useState('')
    const [budgetCap, setBudgetCap] = useState('')
    // —— 流程状态 ——
    const [submitted, setSubmitted] = useState(false)
    const [requestNumber, setRequestNumber] = useState<number | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // —— 积分支付 ——
    const [wishId, setWishId] = useState<string | null>(null)
    const [myPoints, setMyPoints] = useState(0)
    const [payingWithPoints, setPayingWithPoints] = useState(false)
    const [pointsPayResult, setPointsPayResult] = useState<{ success: boolean; message: string } | null>(null)
    // —— 支付 tab ——
    const [paymentTab, setPaymentTab] = useState<'wechat' | 'points'>('wechat')

    // 加载用户积分
    useEffect(() => {
        if (session) {
            fetchMyPoints().then(setMyPoints).catch(() => {})
        }
    }, [session])

    // 预估
    const scores: [number, number] = [
        q1Idx !== null ? Q1.options[q1Idx].scores[0] : 0,
        q2Idx !== null ? Q2.options[q2Idx].scores[1] : 0,
    ]
    const estimate = estimateTier(
        (q1Idx !== null || q2Idx !== null) ? scores : [0, 0],
        modelPref,
    )
    const bothAnswered = q1Idx !== null && q2Idx !== null

    // 提交
    const handleSubmit = useCallback(async () => {
        if (!description.trim() || submitting) return
        setSubmitting(true)
        setError(null)

        try {
            const { data, error: rpcError } = await supabase.rpc('submit_wish', {
                p_description: description.trim(),
                p_contact_type: contactType,
                p_contact_detail: contactType === 'dm' ? null : (contactDetail.trim() || null),
                p_model_preference: modelPref,
                p_extra_money: extraMoney.trim() ? parseInt(extraMoney.trim(), 10) : 0,
                p_api_budget_cap: budgetCap.trim() ? parseInt(budgetCap.trim(), 10) : null,
                p_estimated_tier: estimate.tier,
                p_user_id: session?.userId || null,
            })

            if (rpcError) throw new Error(rpcError.message)
            setRequestNumber(data.request_number)
            setWishId(data.id)
            setSubmitted(true)
        } catch (e: unknown) {
            setError((e as { message?: string } | null)?.message || '提交失败，请稍后再试')
        } finally {
            setSubmitting(false)
        }
    }, [description, submitting, contactType, contactDetail, modelPref, extraMoney, budgetCap, estimate, session])

    // ── 积分支付 ──
    const pointsNeeded = serviceFeeToPoints(estimate.serviceFee)
    const canPayWithPoints = !!session && myPoints >= pointsNeeded

    const handlePayWithPoints = useCallback(async () => {
        if (!wishId || payingWithPoints) return
        setPayingWithPoints(true)
        setPointsPayResult(null)
        try {
            const result = await payWishWithPoints(wishId)
            setPointsPayResult(result)
            if (result.success) {
                setMyPoints((prev) => prev - pointsNeeded)
            }
        } catch (e: unknown) {
            setPointsPayResult({ success: false, message: (e as { message?: string } | null)?.message || '支付请求失败' })
        } finally {
            setPayingWithPoints(false)
        }
    }, [wishId, payingWithPoints, pointsNeeded])

    const selectedModel = MODEL_OPTIONS.find((m) => m.value === modelPref) || MODEL_OPTIONS[0]

    return (
        <div className={styles.page}>
            <div className={styles.container}>

                {/* ========== 标题 ========== */}
                <div className={styles.header}>
                    <h1>
                        <FaIcon name="coins" /> 许愿池
                    </h1>
                    <p className={styles.subtitle}>
                        想要什么功能？告诉我，我来帮你实现
                    </p>
                </div>

                {/* ========== 流程说明 ========== */}
                <div className={styles.flowCard}>
                    <div className={styles.flowSteps}>
                        {[
                            { step: '①', label: '写需求', desc: '填表说清楚你想要的' },
                            { step: '②', label: '付服务费', desc: '微信扫码或积分支付' },
                            { step: '③', label: '等开发', desc: '1-2 个工作日开工' },
                            { step: '④', label: '付 API 成本', desc: '实报实销，不赚差价' },
                        ].map((f) => (
                            <div key={f.step} className={styles.flowStep}>
                                <span className={styles.flowStepNum}>{f.step}</span>
                                <strong>{f.label}</strong>
                                <span className={styles.flowStepDesc}>{f.desc}</span>
                            </div>
                        ))}
                    </div>

                    <div className={styles.warningBox}>
                        <p><strong>⚠️ 开始之前先看清楚：</strong></p>
                        <ul>
                            <li>
                                <strong>服务费 ≠ 全部费用</strong>。服务费是首付，除此之外还可能有：
                                <ul>
                                    <li>
                                        <strong>API 成本</strong>：Luna 和 Terra 按实际周额度收取，每周 ¥{WEEKLY_QUOTA_RMB}，每 1% 计 ¥{RMB_PER_QUOTA_PERCENT}。
                                        <ul>
                                            <li>Luna：简单任务约 0.1%～2%（¥0.04～¥0.8），中等任务约 10%～20%（¥4～¥8）。</li>
                                            <li>Terra：约为 Luna 的 6 倍，费用会随额度消耗增加。</li>
                                            <li>Qwen3.8 Flash Next：API 免费，速度慢约 3 倍。</li>
                                        </ul>
                                    </li>
                                    <li><strong>数据库月费 / 域名年费</strong> —— 如果功能需要单独的数据库或域名，我会给几个方案让你选，费用你自己承担。</li>
                                </ul>
                            </li>
                            <li><strong>需求写得越详细，做得越贴合你的想法</strong>，反复修改才烧钱。</li>
                            <li><strong>🐛 修 bug 免费</strong>，不需要走许愿池，直接站内私信我就行。</li>
                            <li><strong>加钱越多，同类需求排名越靠前</strong>。</li>
                            <li>支持<strong>微信支付</strong>和<strong>积分支付</strong>（1 RMB = {POINTS_PER_RMB} 积分）。积分可用于抵扣服务费和 API 成本，不可用于月费。</li>
                        </ul>
                    </div>
                </div>

                {!submitted ? (
                    <>
                        <ComplexityQuiz
                            q1Idx={q1Idx}
                            q2Idx={q2Idx}
                            onSelectQ1={setQ1Idx}
                            onSelectQ2={setQ2Idx}
                            estimate={estimate}
                            pointsNeeded={pointsNeeded}
                            bothAnswered={bothAnswered}
                        />

                        <WishForm
                            session={session ? { userId: session.userId, username: session.username } : null}
                            description={description}
                            onDescriptionChange={setDescription}
                            contactType={contactType}
                            onContactTypeChange={setContactType}
                            contactDetail={contactDetail}
                            onContactDetailChange={setContactDetail}
                            modelPref={modelPref}
                            onModelPrefChange={setModelPref}
                            extraMoney={extraMoney}
                            onExtraMoneyChange={setExtraMoney}
                            budgetCap={budgetCap}
                            onBudgetCapChange={setBudgetCap}
                            myPoints={myPoints}
                            bothAnswered={bothAnswered}
                            pointsNeeded={pointsNeeded}
                            error={error}
                            submitting={submitting}
                            onSubmit={handleSubmit}
                        />
                    </>
                ) : requestNumber !== null && (
                    <PaymentPanel
                        estimate={estimate}
                        selectedModel={selectedModel}
                        requestNumber={requestNumber}
                        extraMoney={extraMoney}
                        paymentTab={paymentTab}
                        onTabChange={setPaymentTab}
                        myPoints={myPoints}
                        pointsNeeded={pointsNeeded}
                        canPayWithPoints={canPayWithPoints}
                        loggedIn={!!session}
                        payingWithPoints={payingWithPoints}
                        pointsPayResult={pointsPayResult}
                        onPayWithPoints={handlePayWithPoints}
                        onBackToWishes={() => router.push('/wishes')}
                    />
                )}

            </div>
        </div>
    )
}
