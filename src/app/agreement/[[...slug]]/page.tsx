import { supabase } from '@/lib/supabase'
import AgreementView from './AgreementView'

interface Props {
    params: Promise<{ slug?: string[] }>
}

interface AgreementSlugRow {
    slug: string
}

/**
 * 协议页路由。内容完全客户端取数；
 * 静态导出的动态路由必须枚举参数，因此保留
 * 构建期的一次 slug 列表查询（轻量 RPC）。
 */
export async function generateStaticParams() {
    let slugs: string[] = []
    try {
        const { data } = await supabase.rpc('get_agreement_slugs')
        slugs = ((data ?? []) as AgreementSlugRow[]).map((r) => r.slug)
    } catch {
        slugs = ['index']
    }

    const params: { slug: string[] }[] = []
    for (const s of slugs) {
        if (s === 'index') {
            params.push({ slug: [] })
            params.push({ slug: ['index'] })
        } else {
            params.push({ slug: [s] })
        }
    }
    return params
}

export default async function AgreementPage({ params }: Props) {
    const { slug } = await params
    const slugPath = slug?.length ? slug.join('/') : 'index'
    return <AgreementView slugPath={slugPath} />
}
