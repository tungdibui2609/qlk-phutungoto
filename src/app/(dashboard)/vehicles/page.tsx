'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Plus, Search, Car, Edit, Trash2, Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import Protected from '@/components/auth/Protected'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

export default function VehiclesPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const { systemType } = useSystem()
    const { showToast, showConfirm } = useToast()
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetchVehicles()
    }, [])

    async function fetchVehicles() {
        setLoading(true)
        const { data, error } = await (supabase.from('vehicles') as any)
            .select('*')
            .eq('system_code', systemType)
            .order('brand')
            .order('model')

        if (data) {
            setVehicles(data as any)
            // Expand all brands by default
            const brands = new Set((data as any[]).map((v: any) => v.brand as string))
            setExpandedBrands(brands)
        }
        setLoading(false)
    }

    async function deleteVehicle(id: string) {
        if (!await showConfirm('Bạn có chắc muốn xóa dòng xe này?')) return

        const { error } = await supabase.from('vehicles').delete().eq('id', id)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa dòng xe thành công', 'success')
            fetchVehicles()
        }
    }

    const toggleBrand = (brand: string) => {
        const newExpanded = new Set(expandedBrands)
        if (newExpanded.has(brand)) {
            newExpanded.delete(brand)
        } else {
            newExpanded.add(brand)
        }
        setExpandedBrands(newExpanded)
    }

    const filteredVehicles = vehicles.filter(v => {
        const searchLower = searchTerm.toLowerCase()
        return v.brand.toLowerCase().includes(searchLower) ||
            v.model.toLowerCase().includes(searchLower) ||
            (v.engine_type && v.engine_type.toLowerCase().includes(searchLower))
    })

    // Group vehicles by brand
    const vehiclesByBrand = filteredVehicles.reduce((acc, vehicle) => {
        if (!acc[vehicle.brand]) {
            acc[vehicle.brand] = []
        }
        acc[vehicle.brand].push(vehicle)
        return acc
    }, {} as Record<string, Vehicle[]>)

    const sortedBrands = Object.keys(vehiclesByBrand).sort()

    const formatYearRange = (yearFrom: number | null, yearTo: number | null) => {
        if (!yearFrom && !yearTo) return 'Tất cả năm'
        if (!yearFrom) return `- ${yearTo}`
        if (!yearTo) return `${yearFrom} - nay`
        return `${yearFrom} - ${yearTo}`
    }

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800">Dòng xe</h1>
                    <p className="text-stone-500 text-sm mt-1">Quản lý danh sách dòng xe để tra cứu phụ tùng tương thích</p>
                </div>
                <Protected permission="vehicle.manage">
                    <Link
                        href="/vehicles/new"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        <Plus size={20} />
                        Thêm mới
                    </Link>
                </Protected>
            </div>

            {/* SEARCH */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo hãng, dòng xe, động cơ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                </div>
            </div>

            {/* VEHICLE LIST BY BRAND */}
            {loading ? (
                <div className="bg-white rounded-2xl p-8 text-center text-stone-500 border border-stone-200">
                    Đang tải...
                </div>
            ) : sortedBrands.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-stone-500 border border-stone-200">
                    <Car className="mx-auto mb-3 opacity-30" size={48} />
                    <p>Chưa có dòng xe nào</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedBrands.map(brand => (
                        <div key={brand} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                            {/* Brand Header */}
                            <button
                                onClick={() => toggleBrand(brand)}
                                className="w-full flex items-center justify-between px-5 py-4 bg-stone-50 hover:bg-stone-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                        <Car size={20} className="text-orange-600" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-stone-800">{brand}</h3>
                                        <p className="text-sm text-stone-500">{vehiclesByBrand[brand].length} dòng xe</p>
                                    </div>
                                </div>
                                {expandedBrands.has(brand) ? (
                                    <ChevronDown size={20} className="text-stone-400" />
                                ) : (
                                    <ChevronRight size={20} className="text-stone-400" />
                                )}
                            </button>

                            {/* Vehicle List */}
                            {expandedBrands.has(brand) && (
                                <div className="divide-y divide-stone-100">
                                    {vehiclesByBrand[brand].map(vehicle => (
                                        <div key={vehicle.id} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50 transition-colors">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium text-stone-800">{vehicle.model}</span>
                                                    {vehicle.body_type && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600">
                                                            {vehicle.body_type}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-stone-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {formatYearRange(vehicle.year_from, vehicle.year_to)}
                                                    </span>
                                                    {vehicle.engine_type && (
                                                        <span>Động cơ: {vehicle.engine_type}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Protected permission="vehicle.manage">
                                                    <Link
                                                        href={`/vehicles/${vehicle.id}`}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                                    >
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        onClick={() => deleteVehicle(vehicle.id)}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </Protected>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* STATS */}
            <div className="text-sm text-stone-500 text-right">
                Tổng cộng {filteredVehicles.length} dòng xe từ {sortedBrands.length} hãng
            </div>
        </div>
    )
}
