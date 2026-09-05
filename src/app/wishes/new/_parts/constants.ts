/** 许愿池：模型选项、复杂度题目、档位估算、联系方式选项 */

export interface ModelOption {
    value: string
    label: string
    emoji: string
    desc: string
    costNote: string | null
    billing: 'weekly-quota' | 'free'
    quotaMultiplier: number | null
}

// ── 模型选项 ──
export const MODEL_OPTIONS: ModelOption[] = [
    {
        value: 'luna',
        label: 'GPT 5.6 Luna (Max)',
        emoji: '🌙',
        desc: '综合能力与速度均衡',
        costNote: '周额度 ¥40，1% = ¥0.4；简单 0.1%～2%，中等 10%～20%',
        billing: 'weekly-quota',
        quotaMultiplier: 1,
    },
    {
        value: 'terra',
        label: 'GPT 5.6 Terra (xHigh)',
        emoji: '🌍',
        desc: '推理能力更强，额度消耗更高',
        costNote: '约为 Luna ×6；简单 0.6%～12%，中等 60%～120%',
        billing: 'weekly-quota',
        quotaMultiplier: 6,
    },
    {
        value: 'qwen-flash-next',
        label: 'Qwen3.8 Flash Next (xHigh)',
        emoji: '⚡',
        desc: 'API 免费，适合不赶时间的需求',
        costNote: 'API 免费；速度慢约 3 倍',
        billing: 'free',
        quotaMultiplier: null,
    },
]

// ── 积分兑换 ──
export const POINTS_PER_RMB = 200

// ── API 额度计费 ──
export const WEEKLY_QUOTA_RMB = 40
export const RMB_PER_QUOTA_PERCENT = WEEKLY_QUOTA_RMB / 100

type WishTier = 'small' | 'medium' | 'large'
const LUNA_USAGE_RANGES: Record<'small' | 'medium', readonly [number, number]> = {
    small: [0.1, 2],
    medium: [10, 20],
}

function formatAmount(value: number): string {
    return value.toFixed(2).replace(/\.?(0)+$/, '')
}

export function apiCostRangeForModel(modelValue: string, tier: WishTier): string {
    const model = MODEL_OPTIONS.find((option) => option.value === modelValue) || MODEL_OPTIONS[0]
    if (model.billing === 'free') return '免费'
    // ASSUMPTION: 用户只提供了简单和中等任务的参考区间，大型任务显示按实际用量结算。
    if (tier === 'large') return '按实际用量结算'

    const baseRange = LUNA_USAGE_RANGES[tier]

    const multiplier = model.quotaMultiplier || 1
    const minPercent = baseRange[0] * multiplier
    const maxPercent = baseRange[1] * multiplier
    const minRmb = minPercent * RMB_PER_QUOTA_PERCENT
    const maxRmb = maxPercent * RMB_PER_QUOTA_PERCENT
    return `${formatAmount(minPercent)}%～${formatAmount(maxPercent)}%（约 ¥${formatAmount(minRmb)}～¥${formatAmount(maxRmb)}）`
}

export function serviceFeeToPoints(serviceFee: number): number {
    return Math.round(serviceFee * POINTS_PER_RMB)
}

// ── 复杂度问题 ──
export interface Question {
    q: string
    options: { label: string; desc: string; scores: [number, number] }[]
}

export const Q1: Question = {
    q: '大概要改动多少东西？',
    options: [
        { label: '就一两处', desc: '文章加个自动保存、帖子加个可见性', scores: [0, 0] },
        { label: '好几处，但不算大', desc: '加个许愿池、私信加群聊', scores: [1, 0] },
        { label: '很多东西要重新搞', desc: '智能 AI 助手、Obsidian-like 编辑器', scores: [2, 1] },
    ],
}

export const Q2: Question = {
    q: '大概要做成什么样？',
    options: [
        { label: '小优化 / 小功能', desc: '改几处代码、加个小组件，不需要建新表', scores: [0, 0] },
        { label: '中等功能 / 新模块', desc: '建新表、多个页面、中等复杂度', scores: [1, 1] },
        { label: '大型系统 / 完整功能', desc: '复杂架构、AI 集成、重型编辑器等', scores: [2, 2] },
    ],
}

// ── 计算预估档位 ──
export function estimateTier(scores: [number, number], modelValue = 'luna'): {
    tier: 'small' | 'medium' | 'large'
    tierLabel: string
    serviceFee: number
    apiCostRange: string
} {
    const total = scores[0] + scores[1]
    if (total <= 0) return { tier: 'small', tierLabel: '小功能', serviceFee: 0.5, apiCostRange: apiCostRangeForModel(modelValue, 'small') }
    if (total <= 2) return { tier: 'medium', tierLabel: '中级开发', serviceFee: 3, apiCostRange: apiCostRangeForModel(modelValue, 'medium') }
    return { tier: 'large', tierLabel: '大型开发', serviceFee: 10, apiCostRange: apiCostRangeForModel(modelValue, 'large') }
}

// ── 联系人类型 ──
export const CONTACT_OPTIONS = [
    { value: 'dm', label: '站内私信', placeholder: '（我知道你是谁，不需要额外填写）' },
    { value: 'wechat', label: '微信', placeholder: '微信号' },
    { value: 'phone', label: '手机号', placeholder: '手机号码' },
]
