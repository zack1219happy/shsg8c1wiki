'use client'

import type { ReactNode } from 'react'
import styles from '@/styles/forum.module.css'

/** 行内"标签 + 开关 + 状态文案"，带键盘可达性（Enter/空格切换）。 */
export default function ToggleField({ label, tooltip, checked, onChange, onText, offText, padded = false }: {
    label: ReactNode
    /** 可选的 "?" 帮助提示，悬停显示 */
    tooltip?: string
    checked: boolean
    onChange: (next: boolean) => void
    onText: string
    offText: string
    /** 详情页编辑表单中的行需要额外内边距 */
    padded?: boolean
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(padded ? { padding: '8px 4px' } : {}) }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                {label}
                {tooltip && (
                    <span
                        title={tooltip}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            border: '1px solid var(--color-border, #ddd)',
                            fontSize: '0.65rem',
                            cursor: 'help',
                            color: 'var(--color-text-secondary, #999)',
                            marginLeft: 4,
                            verticalAlign: 'middle',
                        }}
                    >
                        ?
                    </span>
                )}
            </span>
            <div
                className={styles.toggleSwitch + (checked ? ' ' + styles.toggleOn : '')}
                onClick={() => onChange(!checked)}
                role="switch"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!checked) } }}
            >
                <div className={styles.toggleSlider} />
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
                {checked ? onText : offText}
            </span>
        </div>
    )
}
