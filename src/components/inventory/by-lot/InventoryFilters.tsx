import React from 'react'
import { Search, Warehouse, ChevronDown, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface InventoryFiltersProps {
    searchTerm: string
    setSearchTerm: (value: string) => void
    selectedBranch: string
    setSelectedBranch: (value: string) => void
    branches: { id: string, name: string }[]
    targetUnitId: string | null
    setTargetUnitId: (value: string | null) => void
    units: any[]
    systemType: string
    companyInfo: any
    loadingCompany: boolean
}

export function InventoryFilters({
    searchTerm,
    setSearchTerm,
    selectedBranch,
    setSelectedBranch,
    branches,
    targetUnitId,
    setTargetUnitId,
    units,
    systemType,
    companyInfo,
    loadingCompany
}: InventoryFiltersProps) {

    const handlePrint = async () => {
        const params = new URLSearchParams()
        params.set('type', 'lot')
        if (systemType) params.set('systemType', systemType)
        if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
        if (searchTerm) params.set('search', searchTerm)
        if (targetUnitId) params.set('targetUnitId', targetUnitId)
        params.set('to', new Date().toISOString().split('T')[0])

        // Pass auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
            params.set('token', session.access_token)
        }

        // Pass company info directly
        if (companyInfo) {
            if (companyInfo.name) params.set('cmp_name', companyInfo.name)
            if (companyInfo.address) params.set('cmp_address', companyInfo.address)
            if (companyInfo.phone) params.set('cmp_phone', companyInfo.phone)
            if (companyInfo.email) params.set('cmp_email', companyInfo.email)
            if (companyInfo.logo_url) params.set('cmp_logo', companyInfo.logo_url)
            if (companyInfo.short_name) params.set('cmp_short', companyInfo.short_name)
        }

        window.open(`/print/inventory?${params.toString()}`, '_blank')
    }

    return (
        <div className="flex flex-col xl:flex-row gap-4 xl:items-end bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm transition-all mt-4">
            <div className="flex-1 w-full xl:w-auto">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Tìm kiếm</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Mã hàng, Tên hàng, Mã phụ..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>
            </div>

            <div className="w-full md:w-1/2 xl:w-48">
                <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Chi nhánh / Kho</label>
                <div className="relative">
                    <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <select
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                    >
                        <option value="Tất cả">Tất cả chi nhánh</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between xl:justify-start gap-4 w-full xl:w-auto pt-2 xl:pt-0">
                <div className="w-full xl:w-48">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Quy đổi đơn vị</label>
                    <div className="relative">
                        <select
                            value={targetUnitId || ''}
                            onChange={e => setTargetUnitId(e.target.value || null)}
                            className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-8"
                        >
                            <option value="">Đơn vị gốc</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    </div>
                </div>

                <button
                    onClick={handlePrint}
                    disabled={loadingCompany}
                    className={`p-2 mt-6 border border-stone-300 dark:border-stone-700 rounded-md transition-all ${loadingCompany ? 'opacity-50 cursor-wait bg-stone-100' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 active:scale-95'}`}
                    title={loadingCompany ? "Đang tải thông tin..." : "In báo cáo"}
                >
                    <Printer className="w-5 h-5" />
                </button>
            </div>
        </div>
    )
}
