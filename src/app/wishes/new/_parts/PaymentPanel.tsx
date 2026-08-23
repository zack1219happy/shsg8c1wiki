'use client'

import FaIcon from '@/components/FaIcon'
import { BASE_PATH } from '@/lib/constants'
import type { ModelOption } from './constants'
import styles from '@/styles/wishes.module.css'

interface Estimate {
    tierLabel: string
    serviceFee: number
    apiCostRange: string
}

/** 步骤 3：付款（微信扫码 / 积分支付双 tab） */
export default function PaymentPanel({
    estimate, selectedModel, requestNumber, extraMoney,
    paymentTab, onTabChange,
    myPoints, pointsNeeded, canPayWithPoints, loggedIn,
    payingWithPoints, pointsPayResult,
    onPayWithPoints, onBackToWishes,
}: {
    estimate: Estimate
    selectedModel: ModelOption
    requestNumber: number
    extraMoney: string
    paymentTab: 'wechat' | 'points'
    onTabChange: (t: 'wechat' | 'points') => void
    myPoints: number
    pointsNeeded: number
    canPayWithPoints: boolean
    loggedIn: boolean
    payingWithPoints: boolean
    pointsPayResult: { success: boolean; message: string } | null
    onPayWithPoints: () => void
    onBackToWishes: () => void
}) {
    const reqNo = `#${String(requestNumber).padStart(4, '0')}`

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNum}>3</span>
                付服务费
            </h2>

            {/* ── Tab 切换 ── */}
            <div className={styles.paymentTabs}>
                <button
                    className={`${styles.paymentTab} ${paymentTab === 'wechat' ? styles.paymentTabActive : ''}`}
                    onClick={() => onTabChange('wechat')}
                >
                    <FaIcon name="weixin" /> 微信支付
                </button>
                <button
                    className={`${styles.paymentTab} ${paymentTab === 'points' ? styles.paymentTabActive : ''}`}
                    onClick={() => onTabChange('points')}
                >
                    <FaIcon name="coins" /> 积分支付
                </button>
            </div>

            {/* ── 微信支付 ── */}
            {paymentTab === 'wechat' && (
                <div className={styles.paymentCard}>
                    <div className={styles.requestBadge}>
                        你的需求编号：<strong>{reqNo}</strong>
                    </div>

                    <div className={styles.paymentBody}>
                        <div className={styles.qrArea}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- 静态微信收款码，项目全站使用原生 <img>（SSG 导出 + images.unoptimized），改用 next/image 需额外提供 width/height 等属性，会改变既有样式 */}
                            <img
                                src={`${BASE_PATH}/wechat-pay.webp`}
                                alt="微信收款码"
                                className={styles.qrImg}
                            />
                            <p className={styles.qrHint}>
                                微信扫码 → 选择对应金额付款 → <strong>备注填 {reqNo}</strong>
                            </p>
                        </div>

                        <div className={styles.paymentInfo}>
                            <div className={styles.paymentRow}>
                                <span>你的档位</span>
                                <strong className={styles.paymentTier}>{estimate.tierLabel}</strong>
                            </div>
                            <div className={styles.paymentRow}>
                                <span>应付服务费</span>
                                <strong className={styles.paymentFee}>¥{estimate.serviceFee}</strong>
                            </div>
                            <div className={styles.paymentRow}>
                                <span>预估 API 成本（做完付）</span>
                                <span>{estimate.apiCostRange}</span>
                            </div>
                            <div className={styles.paymentRow}>
                                <span>模型选择</span>
                                <span>{selectedModel.emoji} {selectedModel.label}</span>
                            </div>
                            {extraMoney.trim() && parseInt(extraMoney.trim()) > 0 && (
                                <div className={styles.paymentRow}>
                                    <span>加钱金额（待确认）</span>
                                    <span>¥{parseInt(extraMoney.trim())}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <PaymentFooter />

                    <div style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <button
                            className={styles.submitBtn}
                            onClick={onBackToWishes}
                            style={{ alignSelf: 'center' }}
                        >
                            我已付款，返回许愿池
                        </button>
                    </div>
                </div>
            )}

            {/* ── 积分支付 ── */}
            {paymentTab === 'points' && (
                <div className={styles.paymentCard}>
                    <div className={styles.requestBadge}>
                        需求编号：<strong>{reqNo}</strong>
                    </div>

                    <div style={{ padding: '20px 24px' }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '10px 0', borderBottom: '1px solid var(--color-border)',
                            fontSize: '0.9rem',
                        }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>服务费</span>
                            <strong>¥{estimate.serviceFee} ↔ {pointsNeeded} 积分</strong>
                        </div>

                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '10px 0', borderBottom: '1px solid var(--color-border)',
                            fontSize: '0.9rem',
                        }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>你的积分</span>
                            <strong style={{ color: 'var(--color-primary)' }}>
                                <FaIcon name="coins" /> {myPoints}
                            </strong>
                        </div>

                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '10px 0',
                            fontSize: '0.9rem',
                        }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>支付后剩余</span>
                            <strong style={{ color: canPayWithPoints ? '#16a34a' : '#dc2626' }}>
                                {myPoints >= pointsNeeded ? `${myPoints - pointsNeeded} 积分` : '积分不足'}
                            </strong>
                        </div>

                        {pointsPayResult && (
                            <div style={{
                                marginTop: 12, padding: '10px 14px',
                                borderRadius: 'var(--border-radius)',
                                fontSize: '0.85rem', textAlign: 'center',
                                background: pointsPayResult.success ? '#f0fdf4' : '#fef2f2',
                                color: pointsPayResult.success ? '#16a34a' : '#dc2626',
                                border: `1px solid ${pointsPayResult.success ? '#bbf7d0' : '#fecaca'}`,
                            }}>
                                {pointsPayResult.success ? '✅ ' : '❌ '}{pointsPayResult.message}
                            </div>
                        )}
                    </div>

                    <PaymentFooter />

                    <div style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <button
                            className={styles.submitBtn}
                            onClick={onPayWithPoints}
                            disabled={!canPayWithPoints || payingWithPoints || pointsPayResult?.success}
                            style={{
                                opacity: (!canPayWithPoints || pointsPayResult?.success) ? 0.5 : undefined,
                            }}
                        >
                            {payingWithPoints ? (
                                <><FaIcon name="spinner" spin /> 支付中…</>
                            ) : pointsPayResult?.success ? (
                                '✅ 已支付'
                            ) : !loggedIn ? (
                                '请先登录'
                            ) : !canPayWithPoints ? (
                                '积分不足'
                            ) : (
                                `使用 ${pointsNeeded} 积分支付`
                            )}
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}

function PaymentFooter() {
    return (
        <div className={styles.paymentFooter}>
            <p>✅ 付款后 <strong>1 ~ 2 个工作日</strong>内开工</p>
            <p>❓ 超过<strong>一周</strong>没动静？站内私信敲我</p>
        </div>
    )
}
