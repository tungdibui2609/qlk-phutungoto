'use client'

import { useState, useEffect, useMemo } from 'react'
import { MapPin, Search, Edit2, Trash2, Award, Layers, User, Phone, Trees, Plus, ExternalLink, Boxes } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { useListingData } from '@/hooks/useListingData'
import MaterialZoneModal from '@/components/material-zones/MaterialZoneModal'
import { MaterialZone } from './types'
import { getProvinceCode } from '@/lib/provinces'
import Link from 'next/link'

export default function MaterialZonesPage() {
    const { showToast, showConfirm } = useToast()
    const { currentSystem } = useSystem()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingZone, setEditingZone] = useState<MaterialZone | null>(null)
    const [lotCountsByZone, setLotCountsByZone] = useState<Record<string, number>>({})

    const {
        filteredData: zones,
        loading,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        refresh
    } = useListingData<MaterialZone>('material_zones', {
        orderBy: { column: 'code', ascending: true },
        includeSystemCode: false
    })

    // Fetch lot statistics by material zone
    useEffect(() => {
        async function fetchLotStats() {
            try {
                const { data: lots, error } = await (supabase.from('lots') as any)
                    .select('metadata')
                    .neq('status', 'hidden')
                
                if (lots && !error) {
                    const counts: Record<string, number> = {}
                    lots.forEach((l: any) => {
                        const rawArr = l.metadata?.material_zones
                        const zoneItems: string[] = Array.isArray(rawArr) && rawArr.length > 0
                            ? rawArr
                            : (l.metadata?.material_zone ? l.metadata.material_zone.split(',').map((s: string) => s.trim()).filter(Boolean) : [])
                        
                        zoneItems.forEach((mz: string) => {
                            if (mz) {
                                counts[mz] = (counts[mz] || 0) + 1
                            }
                        })
                    })
                    setLotCountsByZone(counts)
                }
            } catch (err) {
                console.error('Failed to load lot counts for material zones', err)
            }
        }

        fetchLotStats()
    }, [zones])

    // Metric Calculations
    const metrics = useMemo(() => {
        const total = zones.length
        const active = zones.filter(z => z.is_active).length
        const totalArea = zones.reduce((sum, z) => sum + (Number(z.area_ha) || 0), 0)
        const certified = zones.filter(z => !!z.certification).length
        return { total, active, totalArea, certified }
    }, [zones])

    const handleCreate = () => {
        setEditingZone(null)
        setIsModalOpen(true)
    }

    const handleEdit = (zone: MaterialZone) => {
        setEditingZone(zone)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!await showConfirm(`Bạn có chắc muốn xóa vùng trồng "${name}"?`)) return

        const { error } = await (supabase.from('material_zones' as any) as any).delete().eq('id', id)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast(`Đã xóa vùng trồng "${name}" thành công`, 'success')
            refresh()
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Vùng Nguyên Liệu / Vùng Trồng"
                subtitle="Material Zones & PUC"
                description="Khai báo mã số vùng trồng PUC, nguồn gốc nguyên liệu xuất khẩu và số liệu theo dõi"
                icon={MapPin}
                actionText="Khai báo Vùng Trồng"
                onActionClick={handleCreate}
            />

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1.5">
                        <span>Tổng vùng trồng</span>
                        <Trees size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                        {metrics.total}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">Đã khai báo trên hệ thống</div>
                </div>

                <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1.5">
                        <span>Đang hoạt động</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {metrics.active}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">Sẵn sàng nhập nguyên liệu</div>
                </div>

                <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1.5">
                        <span>Tổng diện tích</span>
                        <Layers size={16} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                        {metrics.totalArea.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-zinc-400">ha</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">Quy mô vùng canh tác</div>
                </div>

                <div className="p-4.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1.5">
                        <span>Có chứng nhận / PUC</span>
                        <Award size={16} className="text-purple-500" />
                    </div>
                    <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                        {metrics.certified}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">Đạt tiêu chuẩn xuất khẩu</div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 flex flex-col md:flex-row flex-wrap gap-3 md:items-center shadow-xs">
                <div className="relative flex-1 w-full md:min-w-[280px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo mã PUC, tên vùng trồng, tỉnh thành, đại diện..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium transition-all"
                    />
                </div>
                <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl">
                    {(['all', 'active', 'inactive'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                statusFilter === f
                                    ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                            {f === 'all' ? 'Tất cả' : f === 'active' ? 'Hoạt động' : 'Ngừng'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List / Table Content */}
            {loading ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-16 text-center shadow-xs">
                    <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-zinc-400 font-bold uppercase tracking-wider text-xs">Đang tải danh sách vùng trồng...</p>
                </div>
            ) : zones.length === 0 ? (
                <div className="space-y-4 text-center">
                    <EmptyState
                        icon={MapPin}
                        title="Chưa có vùng trồng nào"
                        description={searchTerm ? 'Không tìm thấy vùng trồng phù hợp với từ khóa.' : 'Hãy khai báo vùng trồng hoặc mã PUC đầu tiên để theo dõi số liệu và phục vụ tạo LOT.'}
                    />
                    {!searchTerm && (
                        <div>
                            <button
                                onClick={handleCreate}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>Khai báo Vùng Trồng Đầu Tiên</span>
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="py-3.5 px-4">Mã PUC / Vùng</th>
                                    <th className="py-3.5 px-4">Tên Vùng Trồng</th>
                                    <th className="py-3.5 px-4">Địa phương</th>
                                    <th className="py-3.5 px-4">Quy mô</th>
                                    <th className="py-3.5 px-4">Đại diện & Liên hệ</th>
                                    <th className="py-3.5 px-4">Chứng nhận</th>
                                    <th className="py-3.5 px-4 text-center">Số LOT</th>
                                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                {zones.map((zone) => {
                                    // Match count either by zone code or zone name
                                    const lotCount = (zone.code ? (lotCountsByZone[zone.code] || 0) : 0) + (lotCountsByZone[zone.name] || 0)
                                    return (
                                        <tr key={zone.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                            {/* Code / PUC */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {zone.code ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                                        {zone.code}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400 text-xs italic">---</span>
                                                )}
                                            </td>

                                            {/* Name & Details */}
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                                                    {zone.name}
                                                </div>
                                                {zone.notes && (
                                                    <div className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                                                        {zone.notes}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Location / Province */}
                                            <td className="py-3.5 px-4">
                                                {(() => {
                                                    const provCode = getProvinceCode(zone.province || zone.location || '')
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 text-xs font-medium">
                                                                <MapPin size={13} className="text-emerald-600 shrink-0" />
                                                                <span>{zone.province || zone.location || '---'}</span>
                                                                {provCode && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60" title={`Mã hành chính: ${provCode}`}>
                                                                        Mã {provCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {zone.location && zone.province && zone.location !== zone.province && (
                                                                <div className="text-[11px] text-zinc-400 truncate max-w-[200px] mt-0.5">
                                                                    {zone.location}
                                                                </div>
                                                            )}
                                                        </>
                                                    )
                                                })()}
                                            </td>

                                            {/* Scale / Area */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {zone.area_ha ? (
                                                    <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                                                        {zone.area_ha} <span className="text-[10px] text-zinc-400 font-normal">ha</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400 text-xs">---</span>
                                                )}
                                            </td>

                                            {/* Farmer & Phone */}
                                            <td className="py-3.5 px-4">
                                                {zone.farmer_name ? (
                                                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                                                        <User size={12} className="text-purple-500 shrink-0" />
                                                        <span>{zone.farmer_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-400 text-xs">---</span>
                                                )}
                                                {zone.phone && (
                                                    <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                                                        <Phone size={10} className="text-emerald-500 shrink-0" />
                                                        <span>{zone.phone}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Certification */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {zone.certification ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                                                        <Award size={11} />
                                                        {zone.certification}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400 text-xs">---</span>
                                                )}
                                            </td>

                                            {/* Lots count */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <Link
                                                    href={`/warehouses/lots?search=${encodeURIComponent(zone.code || zone.name)}`}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors"
                                                    title="Xem các LOT thuộc vùng trồng này"
                                                >
                                                    <Boxes size={12} />
                                                    <span>{lotCount}</span>
                                                </Link>
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                <StatusBadge
                                                    isActive={zone.is_active}
                                                    activeText="Hoạt động"
                                                    inactiveText="Ngừng"
                                                />
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(zone)}
                                                        className="p-1.5 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                                                        title="Chỉnh sửa vùng trồng"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(zone.id, zone.name)}
                                                        className="p-1.5 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                        title="Xóa vùng trồng"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Create/Edit */}
            <MaterialZoneModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => refresh()}
                initialData={editingZone}
            />
        </div>
    )
}
