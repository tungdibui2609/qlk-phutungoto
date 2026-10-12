'use client'

import { useState, useEffect, useMemo } from 'react'
import { Factory, Search, Edit2, Trash2, Award, User, Phone, Plus, MapPin, Boxes, AlertCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { useListingData } from '@/hooks/useListingData'
import ProductionPlaceModal from '@/components/production-places/ProductionPlaceModal'
import { ProductionPlace } from './types'
import Link from 'next/link'

const FALLBACK_PLACES: ProductionPlace[] = [
    {
        id: 'place-01',
        code: 'NM-BT-01',
        name: 'Nhà máy Chánh Thu - Bến Tre',
        address: 'Ấp Mỹ Thạnh, Xã Mỹ Thạnh, Huyện Giồng Trôm',
        location: null,
        province: 'Bến Tre',
        contact_person: 'Nguyễn Văn A',
        phone: '02753888999',
        capacity: '50 tấn/ngày',
        certification: 'HACCP, ISO 22000, FDA',
        notes: 'Chuyên dây chuyền cấp đông sâu & chế biến sầu riêng',
        is_active: true,
        system_code: 'KHO_DONG_LANH',
        company_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'place-02',
        code: 'CS-DL-01',
        name: 'Xưởng chế biến Cư M\'gar - Đắk Lắk',
        address: 'Km 15, QL 14, Huyện Cư M\'gar',
        location: null,
        province: 'Đắk Lắk',
        contact_person: 'Trần Văn B',
        phone: '02623777888',
        capacity: '30 tấn/ngày',
        certification: 'VietGAP, HACCP',
        notes: 'Trạm thu mua & sơ chế bóc múi tại vùng nguyên liệu Tây Nguyên',
        is_active: true,
        system_code: 'KHO_DONG_LANH',
        company_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 'place-03',
        code: 'NM-TG-01',
        name: 'Nhà máy Đóng gói Tiền Giang',
        address: 'Khu Công nghiệp Mỹ Tho',
        location: null,
        province: 'Tiền Giang',
        contact_person: 'Lê Văn C',
        phone: '02733666555',
        capacity: '40 tấn/ngày',
        certification: 'HACCP, BRC',
        notes: 'Cơ sở đóng gói xuất khẩu & kiểm định chất lượng',
        is_active: true,
        system_code: 'KHO_DONG_LANH',
        company_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
]

export default function ProductionPlacesPage() {
    const { showToast, showConfirm } = useToast()
    const { currentSystem, hasModule } = useSystem()
    const { checkSubscription } = useUser()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingPlace, setEditingPlace] = useState<ProductionPlace | null>(null)
    const [lotCountsByPlace, setLotCountsByPlace] = useState<Record<string, number>>({})

    const isModuleActive = hasModule('production_place') || checkSubscription('production_place')

    const {
        filteredData: placesData,
        loading,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        refresh
    } = useListingData<ProductionPlace>('production_places', {
        orderBy: { column: 'code', ascending: true },
        includeSystemCode: false
    })

    // Sử dụng fallback nếu bảng DB rỗng hoặc vừa mới tạo
    const places = useMemo(() => {
        if (placesData && placesData.length > 0) return placesData
        return FALLBACK_PLACES
    }, [placesData])

    // Thống kê số lượng LOT theo nơi sản xuất
    useEffect(() => {
        async function fetchLotStats() {
            try {
                const { data: lots, error } = await (supabase.from('lots') as any)
                    .select('metadata')
                    .neq('status', 'hidden')
                
                if (lots && !error) {
                    const counts: Record<string, number> = {}
                    lots.forEach((l: any) => {
                        const rawPlaces = l.metadata?.production_places || (l.metadata?.production_place ? [l.metadata?.production_place] : [])
                        const placeList = Array.isArray(rawPlaces) 
                            ? rawPlaces 
                            : String(rawPlaces).split(',').map((s: string) => s.trim()).filter(Boolean)
                        const uniqueInLot = new Set<string>()
                        placeList.forEach((p: any) => {
                            if (p && typeof p === 'string' && p.trim()) {
                                uniqueInLot.add(p.trim())
                            }
                        })
                        uniqueInLot.forEach((pName) => {
                            counts[pName] = (counts[pName] || 0) + 1
                        })
                    })
                    setLotCountsByPlace(counts)
                }
            } catch (err) {
                console.error('Failed to load lot counts for production places', err)
            }
        }

        fetchLotStats()
    }, [places])

    // Tính toán metrics
    const metrics = useMemo(() => {
        const total = places.length
        const active = places.filter(p => p.is_active).length
        const certified = places.filter(p => !!p.certification).length
        return { total, active, certified }
    }, [places])

    const handleCreate = () => {
        setEditingPlace(null)
        setIsModalOpen(true)
    }

    const handleEdit = (place: ProductionPlace) => {
        setEditingPlace(place)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!await showConfirm(`Bạn có chắc muốn xóa nơi sản xuất "${name}"?`)) return

        try {
            const { error } = await (supabase.from('production_places' as any) as any).delete().eq('id', id)
            if (error) {
                showToast('Lỗi: ' + error.message, 'error')
            } else {
                showToast(`Đã xóa nơi sản xuất "${name}" thành công`, 'success')
                refresh()
            }
        } catch (err: any) {
            showToast('Lỗi xóa: ' + err.message, 'error')
        }
    }

    // Nếu module chưa được kích hoạt, hiển thị thông báo bảo vệ tính năng
    if (!isModuleActive) {
        return (
            <div className="p-6 max-w-4xl mx-auto my-12">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-3xl p-8 text-center space-y-4 shadow-sm">
                    <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 mx-auto flex items-center justify-center">
                        <AlertCircle size={32} />
                    </div>
                    <div className="max-w-md mx-auto">
                        <h2 className="text-xl font-black text-amber-950 dark:text-amber-200 mb-2">
                            Module Nơi sản xuất chưa được kích hoạt
                        </h2>
                        <p className="text-sm text-amber-800 dark:text-amber-400/90 leading-relaxed mb-6">
                            Tính năng quản lý và khai báo danh mục Nơi sản xuất / Nhà máy đang bị tắt trong cấu hình phân hệ hoặc chưa được cấp phép.
                        </p>
                        <Link
                            href="/settings?tab=system_config"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-600/25 transition-all"
                        >
                            <span>Đến Cấu hình Phân hệ</span>
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <PageHeader
                title="Nơi Sản Xuất & Cơ Sở Chế Biến"
                subtitle="Quản lý danh mục nhà máy, xưởng chế biến và trạm đóng gói của công ty"
                icon={Factory}
                actionText="Khai báo Cơ sở mới"
                onActionClick={handleCreate}
            />

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Tổng cơ sở</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{metrics.total}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold">
                        <Factory size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Đang hoạt động</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{metrics.active}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                        <MapPin size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Có chứng chỉ (HACCP/ISO)</p>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{metrics.certified}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold">
                        <Award size={22} />
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Tìm theo mã, tên cơ sở, tỉnh thành..."
                        className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Tạm ngưng</option>
                    </select>
                </div>
            </div>

            {/* Places Grid List */}
            {places.length === 0 ? (
                <div className="space-y-4">
                    <EmptyState
                        icon={Factory}
                        title="Chưa có cơ sở sản xuất nào"
                        description="Khai báo các nhà máy, xưởng chế biến hoặc trạm đóng gói để gán vào các lô hàng LOT."
                    />
                    <div className="text-center">
                        <button
                            onClick={handleCreate}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                            + Khai báo ngay
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {places.map(place => {
                        const lotCount = lotCountsByPlace[place.name] || 0
                        return (
                            <div
                                key={place.id}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                            >
                                <div>
                                    {/* Top card */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                                                <Factory size={20} />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                                    {place.code || 'CHƯA CÓ MÃ'}
                                                </span>
                                                <h4 className="text-base font-black text-zinc-900 dark:text-zinc-100 mt-1 leading-snug">
                                                    {place.name}
                                                </h4>
                                            </div>
                                        </div>

                                        <StatusBadge isActive={place.is_active} />
                                    </div>

                                    {/* Info items */}
                                    <div className="space-y-2 my-4 text-xs">
                                        {place.province && (
                                            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                                <MapPin size={14} className="text-rose-500 shrink-0" />
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{place.province}</span>
                                                {place.address && <span className="text-zinc-400 truncate">({place.address})</span>}
                                            </div>
                                        )}

                                        {place.capacity && (
                                            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                                <Factory size={14} className="text-blue-500 shrink-0" />
                                                <span>Công suất: <strong className="text-zinc-800 dark:text-zinc-200">{place.capacity}</strong></span>
                                            </div>
                                        )}

                                        {place.contact_person && (
                                            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                                <User size={14} className="text-amber-500 shrink-0" />
                                                <span>Quản đốc: <strong className="text-zinc-800 dark:text-zinc-200">{place.contact_person}</strong></span>
                                                {place.phone && <span className="text-zinc-400">({place.phone})</span>}
                                            </div>
                                        )}

                                        {place.certification && (
                                            <div className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
                                                <Award size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                                <span className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg text-[11px] border border-emerald-200 dark:border-emerald-800">
                                                    {place.certification}
                                                </span>
                                            </div>
                                        )}

                                        {place.notes && (
                                            <p className="text-zinc-500 dark:text-zinc-400 italic line-clamp-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                                {place.notes}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom actions & LOT link stats */}
                                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                    <Link
                                        href={`/warehouses/lots?search=${encodeURIComponent(place.name)}`}
                                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        <Boxes size={14} />
                                        <span>{lotCount} LOT gắn với cơ sở này</span>
                                    </Link>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleEdit(place)}
                                            className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Chỉnh sửa"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(place.id, place.name)}
                                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                            title="Xóa"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal Form */}
            <ProductionPlaceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    refresh()
                }}
                initialData={editingPlace}
            />
        </div>
    )
}
