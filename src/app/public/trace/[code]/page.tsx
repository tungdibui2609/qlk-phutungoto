import { createClient } from '@supabase/supabase-js'
import { Boxes, Calendar, Package, Factory, ShieldCheck } from 'lucide-react'
import Image from 'next/image'

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
            code,
            packaging_date,
            products (name, sku, unit, image_url, description),
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

    const product = lot.products as any
    const supplier = lot.suppliers as any

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-xl mx-auto space-y-6">

                {/* Header / Brand */}
                <div className="text-center space-y-2 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="relative w-16 h-16 mx-auto mb-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center p-2">
                        {companyInfo.logo ? (
                            <Image src={companyInfo.logo} alt={companyInfo.name} width={64} height={64} className="object-contain" />
                        ) : (
                            <div className="w-full h-full bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl">
                                {companyInfo.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <h1 className="text-sm font-bold tracking-widest uppercase text-slate-400">Truy xuất nguồn gốc</h1>
                    <h2 className="text-2xl font-bold text-slate-900">{companyInfo.name}</h2>
                </div>

                {/* Main Certificate Card */}
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden relative border border-slate-100 animate-in zoom-in-95 duration-500">
                    <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-orange-500 to-amber-500" />

                    <div className="p-8 text-center border-b border-slate-50">
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-mono font-bold mb-4">
                            LOT: {lot.code}
                        </span>

                        {product?.image_url && (
                            <div className="relative w-32 h-32 mx-auto mb-6 rounded-2xl overflow-hidden bg-slate-50">
                                <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                            </div>
                        )}

                        <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">{product?.name || 'Sản phẩm không tên'}</h1>
                        <p className="text-slate-500">{product?.sku}</p>
                    </div>

                    <div className="p-8 space-y-6">

                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Factory size={20} />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nhà cung cấp</h3>
                                <p className="font-bold text-slate-900">{supplier?.name || '---'}</p>
                                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{supplier?.address}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ngày đóng gói</h3>
                                    <p className="font-bold text-slate-900">
                                        {lot.packaging_date ? new Date(lot.packaging_date).toLocaleDateString('vi-VN') : '--'}
                                    </p>
                                </div>
                            </div>

                            {/* REMOVED: Expiry date column does not exist in DB */}
                        </div>

                    </div>

                    <div className="bg-slate-50 p-6 text-center">
                        <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold bg-emerald-100/50 py-2 rounded-xl">
                            <ShieldCheck size={18} />
                            <span>Sản phẩm chính hãng</span>
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 font-medium">
                    Powered by AnyWarehouse Technology
                </p>
            </div>
        </div>
    )
}
