/** 许愿池：模型选项、复杂度题目、档位估算、联系方式选项 */

export interface ModelOption {
    value: string
    label: string
    emoji: string
    desc: string
    costNote: string | null
}

// ── 模型选项 ──
export const MODEL_OPTIONS: ModelOption[] = [
    {
        value: 'flash',
        label: 'DeepSeek V4 Flash',
        emoji: '🔵',
        desc: '默认，大多数需求够了，成本最低',
        costNote: null,
    },
    {
        value: 'v4-pro',
        label: 'V4-Pro',
        emoji: '🟣',
        desc: '推理更强，成本 ×2',
        costNote: null,
    },
    {
        value: 'glm-5.2',
        label: 'GLM-5.2',
        emoji: '🟢',
        desc: '前端做得最好看，成本 ×10',
        costNote: '⚠️ API 成本可能飙到几十块，建议设预算上限',
    },
    {
        value: 'agens',
        label: 'Agens',
        emoji: '⚪',
        desc: '几乎免费，但效率很低，不急再选',
        costNote: '⏳ 预计交付时间会显著延长',
    },
]

// ── 积分兑换 ──
export const POINTS_PER_RMB = 200

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
export function estimateTier(scores: [number, number]): {
    tier: 'small' | 'medium' | 'large'
    tierLabel: string
    serviceFee: number
    apiCostRange: string
} {
    const total = scores[0] + scores[1]
    if (total <= 0) return { tier: 'small', tierLabel: '小功能', serviceFee: 0.5, apiCostRange: '≤ ¥1.5' }
    if (total <= 2) return { tier: 'medium', tierLabel: '中级开发', serviceFee: 3, apiCostRange: '¥1.5 ~ ¥10' }
    return { tier: 'large', tierLabel: '大型开发', serviceFee: 10, apiCostRange: '> ¥10' }
}

// ── 联系人类型 ──
export const CONTACT_OPTIONS = [
    { value: 'dm', label: '站内私信', placeholder: '（我知道你是谁，不需要额外填写）' },
    { value: 'wechat', label: '微信', placeholder: '微信号' },
    { value: 'phone', label: '手机号', placeholder: '手机号码' },
]
