import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { loadRegistry } from './people-server'
import { resolveText } from './people'
import { createClient } from '@supabase/supabase-js'

// ── Supabase 客户端（构建时可用的轻量实例）──
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ============================================================
//  导航树 —— 自动扫描 data/ 下各目录的 .md 文件
//  id = 相对于目录的路径（不含 .md）
//  title / icon 来自 YAML frontmatter
//  ============================================================

export interface NavNode {
  id: string
  title: string
  type: 'page' | 'folder'
  icon?: string
  children?: NavNode[]
  /** 该节点是否有对应的内容页（文件夹可能有对应的 .md） */
  hasContent?: boolean
  /** 完整路径 key，如 "meme/laowang" */
  pathKey?: string
}

const SITE_TITLE = '上中二旦社区'

const WIKI_DIR = path.join(process.cwd(), 'data', 'wiki')

// ---------- 读取 frontmatter ----------

interface PageMeta {
  title: string
  icon?: string
}

function readMeta(filePath: string, fallbackTitle: string): PageMeta {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data } = matter(raw)
    const rawTitle = (data.title as string)?.trim() || fallbackTitle
    // 解析 [stu:xxx] / [tch:xxx] 为纯文本缩写供导航显示
    const registry = loadRegistry()
    const title = resolveText(rawTitle, registry)
    return {
      title,
      icon: data.icon as string | undefined,
    }
  } catch {
    return { title: fallbackTitle }
  }
}

// ---------- 扫描所有 .md 文件 ----------

interface FileEntry {
  /** id = 相对路径不含 .md，如 "campus/map" */
  id: string
  /** 完整文件路径 */
  filePath: string
  meta: PageMeta
}

function scanAllMdFiles(dir: string): FileEntry[] {
  const entries: FileEntry[] = []

  function walk(dir: string, relSegments: string[]) {
    let list: fs.Dirent[]
    try {
      list = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const e of list) {
      if (e.name.startsWith('_') || e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(full, [...relSegments, e.name])
      } else if (e.name.endsWith('.md')) {
        const id = [...relSegments, e.name.replace(/\.md$/, '')].join('/')
        const fallback = e.name.replace(/\.md$/, '')
        const meta = readMeta(full, fallback)
        entries.push({ id, filePath: full, meta })
      }
    }
  }

  walk(dir, [])
  return entries
}

// ---------- 从 FileEntry[] 构建树 ----------

function buildTree(entries: FileEntry[]): NavNode[] {
  // 根节点 map：id → NavNode
  const rootMap = new Map<string, NavNode>()
  // 收集每个 id 的子节点
  const childrenMap = new Map<string, NavNode[]>()

  // 处理所有 .md 文件
  for (const entry of entries) {
    const segments = entry.id.split('/')

    // 创建或更新叶子节点
    const node: NavNode = {
      id: segments[segments.length - 1],
      title: entry.meta.title,
      type: 'page',
      icon: entry.meta.icon,
      hasContent: true,
      pathKey: entry.id,
    }

    const parentKey = segments.slice(0, -1).join('/')
    const list = childrenMap.get(parentKey) || []
    list.push(node)
    childrenMap.set(parentKey, list)
    rootMap.set(entry.id, node)
  }

  // 自动创建中间文件夹节点
  for (const entry of entries) {
    const segments = entry.id.split('/')
    for (let i = 1; i < segments.length; i++) {
      const folderId = segments.slice(0, i).join('/')
      if (rootMap.has(folderId)) continue // 已有对应 page

      const name = segments[i - 1]
      const parentKey = segments.slice(0, i - 1).join('/')

      // 检查是否有同名的 .md（文件夹自己的内容页）
      const contentEntry = entries.find((e) => e.id === folderId)
      const folderNode: NavNode = {
        id: name,
        title: contentEntry?.meta.title ?? name,
        type: 'folder',
        icon: contentEntry?.meta.icon,
        hasContent: !!contentEntry,
        pathKey: folderId,
      }

      rootMap.set(folderId, folderNode)
      const list = childrenMap.get(parentKey) || []
      // 避免重复
      if (!list.some((n) => n.id === name)) {
        list.push(folderNode)
        childrenMap.set(parentKey, list)
      }
    }
  }

  // 将 children 挂到各节点上
  for (const [, node] of rootMap) {
    const kids = childrenMap.get(node.pathKey ?? '') || []
    if (kids.length > 0) {
      node.children = kids
      // 如果有 children，type 应为 folder
      if (node.type === 'page') {
        node.type = 'folder'
      }
    }
  }

  // 收集根级别节点
  const rootList = childrenMap.get('') || []

  // 排序：每个层级按以下规则
  // 1. home 排第一
  // 2. 其余按 id 字母序
  for (const [, list] of childrenMap) {
    list.sort((a, b) => {
      if (a.id === 'home') return -1
      if (b.id === 'home') return 1
      return a.id.localeCompare(b.id)
    })
  }

  // 根节点同样排序
  rootList.sort((a, b) => {
    if (a.id === 'home') return -1
    if (b.id === 'home') return 1
    return a.id.localeCompare(b.id)
  })

  return rootList
}

// ---------- 缓存 ----------

let cachedWikiTree: NavNode[] | null = null

function getWikiTreeInternal(): NavNode[] {
  if (!cachedWikiTree) {
    const entries = scanAllMdFiles(WIKI_DIR)
    cachedWikiTree = buildTree(entries)
  }
  return cachedWikiTree
}

/**
 * 从 DB 获取 wiki 导航树（异步，SSG 构建时使用）
 * 回退到文件系统
 */
export async function getNavTreeFromDB(): Promise<NavNode[]> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('get_all_wiki_pages')
    if (error) throw error
    const rows = (data ?? []) as { slug: string; title: string; frontmatter: Record<string, unknown> }[]

    if (rows.length === 0) {
      return getWikiTreeInternal()
    }

    const entries: FileEntry[] = rows.map((r) => {
      const registry = loadRegistry()
      const resolvedTitle = resolveText(r.title || r.slug.split('/').pop() || r.slug, registry)
      return {
        id: r.slug,
        filePath: '',
        meta: {
          title: resolvedTitle,
          icon: (r.frontmatter?.icon as string) || undefined,
        },
      }
    })

    return buildTree(entries)
  } catch {
    return getWikiTreeInternal()
  }
}

// ---------- 公开 API ----------


export function getSiteTitle(): string {
  return SITE_TITLE
}




