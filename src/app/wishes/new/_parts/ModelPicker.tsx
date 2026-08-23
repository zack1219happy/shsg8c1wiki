'use client'

import { useState } from 'react'
import { MODEL_OPTIONS } from './constants'
import styles from '@/styles/wishes.module.css'

/** AI 模型下拉选择（桌面端展开卡片式） */
export default function ModelPicker({ value, onChange }: {
    value: string
    onChange: (v: string) => void
}) {
    const [open, setOpen] = useState(false)
    const selected = MODEL_OPTIONS.find((m) => m.value === value) || MODEL_OPTIONS[0]

    return (
        <div className={styles.modelPicker}>
            <button
                className={styles.modelTrigger}
                onClick={() => setOpen(!open)}
            >
                <span>
                    <span className={styles.modelTriggerEmoji}>{selected.emoji}</span>
                    {selected.label}
                </span>
                <span className={`${styles.modelChevron} ${open ? styles.modelChevronOpen : ''}`}>▾</span>
            </button>

            {open && (
                <div className={styles.modelDropdown}>
                    {MODEL_OPTIONS.map((m) => (
                        <button
                            key={m.value}
                            className={`${styles.modelOption} ${value === m.value ? styles.modelOptionActive : ''}`}
                            onClick={() => { onChange(m.value); setOpen(false) }}
                        >
                            <span className={styles.modelOptionHeader}>
                                <span className={styles.modelEmoji}>{m.emoji}</span>
                                <strong>{m.label}</strong>
                            </span>
                            <span className={styles.modelDesc}>{m.desc}</span>
                            {m.costNote && (
                                <span className={styles.modelCostNote}>{m.costNote}</span>
                            )}
                            {value === m.value && (
                                <span className={styles.modelCheck}>✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
