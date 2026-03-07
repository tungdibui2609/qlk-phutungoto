import { createClient } from '@supabase/supabase-js'
import { Boxes, Calendar, Package, Factory, ShieldCheck } from 'lucide-react'
import Image from 'next/image'
import TraceView from './TraceView'

// Use Service Role to fetch public data safely (Read Only for specifics)
// In a real app, strict RLS or RPC is better. Here we sanitize at fetch level.
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PageProps {
    params: Promise<{ code: string }>
    searchParams: Promise<{ c?: string }>
}

export default async function PublicTracePage({ params, searchParams }: PageProps) {
    const { code } = await params
    const { c: companyId } = await searchParams

    let query = supabaseAdmin
        .from('lots')
        .select(`
            id,
            code,
            packaging_date,
            lot_items (
                quantity,
                unit,
                products (name, sku, unit, image_url, description)
            ),
            lot_tags (tag),
            suppliers (name, address),
            qc_info (name, description),
            system_code,
            company_id
        `)
        .eq('code', code)

    // Strict filter by company if provided in URL
    if (companyId) {
        query = query.eq('company_id', companyId)
    }

    const { data: lot, error } = await query.maybeSingle()

    // Fetch company info safely
    let companyInfo = { name: 'AnyWarehouse', logo: null }
    if (lot?.company_id) {
        const { data: company } = await supabaseAdmin
            .from('company_settings')
            .select('name, logo_url')
            .eq('id', lot.company_id)
            .single()
        if (company) {
            companyInfo = { name: company.name, logo: company.logo_url }
        }
    }

    if (!lot || error) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400">
                    <Boxes size={40} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">Không tìm thấy thông tin</h1>
                <p className="text-slate-500 mb-4">Mã LOT <strong>{code}</strong> không tồn tại hoặc đã bị xóa.</p>

                {/* DEBUG INFO */}
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-mono text-left max-w-sm w-full overflow-auto">
                    <p className="font-bold border-b border-red-200 pb-2 mb-2">Debug Info:</p>
                    <p>Error Code: {error?.code || 'N/A'}</p>
                    <p>Message: {error?.message || 'No data returned'}</p>
                    <p>Param CompanyID: {companyId || 'None'}</p>
                </div>
            </div>
        )
    }

    const items = (lot.lot_items as any[]) || []
    const firstItem = items[0]
    const product = firstItem?.products
    const tags = (lot.lot_tags as any[])?.map(t => t.tag) || []
    const supplier = lot.suppliers as any

    return (
        <TraceView
            lot={lot}
            companyInfo={companyInfo}
        />
    )
}
