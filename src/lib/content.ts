/* ============================================
   content — SSG 构建期渲染管线（服务端专用）

   只保留构建时需要的能力：带 anchor 锚点与
   person 注册表的 markdown-it 单例。
   渲染核心见 lib/markdown.ts（全站唯一）。
   ============================================ */

import DOMPurify from 'isomorphic-dompurify'
import { createMarkdown, extractHeadingsFromHtml } from './markdown'
import type { Heading } from './markdown'
import { personPlugin } from './md-plugins'
import { loadRegistry } from './people-server'

// 构建期单例：恒开锚点（TOC 依赖 heading id），挂载 person 插件
const md = createMarkdown({ anchor: true })
personPlugin(md, loadRegistry())

export type { Heading }

/**
 * 渲染 markdown 内容并提取标题（适用于 SSG 阶段构建 TOC）
 * 复用构建期单例，保证 ID 与客户端渲染一致
 */
export function renderMarkdownAndGetHeadings(mdContent: string): { html: string; headings: Heading[] } {
    const html = DOMPurify.sanitize(md.render(mdContent))
    const headings = extractHeadingsFromHtml(html)
    return { html, headings }
}
