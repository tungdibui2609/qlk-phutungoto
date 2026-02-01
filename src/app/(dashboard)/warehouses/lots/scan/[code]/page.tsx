'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import {
    Boxes,
    Calendar,
    Package,
    Truck,
    MapPin,
    Search,
    Plus,
    X,
    ClipboardCheck,
    Loader2,
    RefreshCcw,
    ArrowLeft,
    ShieldCheck
} from 'lucide-react'
import Link from 'next/link'
import { TagDisplay } from '@/components/lots/TagDisplay'

interface PageProps {
    params: Promise<{ code: string }>
}

export default function LotScanPage({ params }: PageProps) {
    const { code } = use(params)
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [lot, setLot] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [searchingPositions, setSearchingPositions] = useState(false)
    const [availablePositions, setAvailablePositions] = useState<any[]>([])
    const [posSearchTerm, setPosSearchTerm] = useState('')
    const [isAssigning, setIsAssigning] = useState(false)

    const fetchLotData = useCallback(async () => {
        if (!code || !currentSystem?.code) return

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    *,
                    suppliers (name),
                    qc_info (name),
                    lot_items (
                        id, quantity, unit,
                        products (name, sku, unit)
                    ),
                    positions (id, code),
                    lot_tags (tag, lot_item_id)
                `)
                .eq('code', code)
                .eq('system_code', currentSystem.code)
                .single()

            if (error) throw error
            setLot(data)
        } catch (error: any) {
            console.error('Error fetching lot:', error)
            showToast('Không tìm thấy LOT hoặc lỗi kết nối', 'error')
        } finally {
            setLoading(false)
        }
    }, [code, currentSystem?.code, showToast])

    useEffect(() => {
        fetchLotData()
    }, [fetchLotData])

    const searchPositions = async (term: string) => {
        if (!currentSystem?.code) return
        if (term.length < 1) {
            setAvailablePositions([])
            return
        }

        setSearchingPositions(true)
        try {
            const { data, error } = await supabase
                .from('positions')
                .select('id, code, lot_id')
                .eq('system_type', currentSystem.code)
                .ilike('code', `%${term}%`)
                .limit(10)

            if (error) throw error
            setAvailablePositions(data || [])
        } catch (error) {
            console.error('Error searching positions:', error)
        } finally {
            setSearchingPositions(false)
        }
    }

    const handleAssignPosition = async (positionId: string, positionCode: string) => {
        if (!lot) return

        try {
            const { error } = await supabase
                .from('positions')
                .update({ lot_id: lot.id } as any)
                .eq('id', positionId)

            if (error) throw error

            showToast(`Đã gán LOT vào vị trí ${positionCode}`, 'success')
            fetchLotData()
            setPosSearchTerm('')
            setAvailablePositions([])
            setIsAssigning(false)
        } catch (error: any) {
            showToast('Lỗi khi gán vị trí: ' + error.message, 'error')
        }
    }

    const handleUnassignPosition = async (positionId: string, positionCode: string) => {
        try {
            const { error } = await supabase
                .from('positions')
                .update({ lot_id: null } as any)
                .eq('id', positionId)

            if (error) throw error

            showToast(`Đã gỡ vị trí ${positionCode}`, 'success')
            fetchLotData()
        } catch (error: any) {
            showToast('Lỗi khi gỡ vị trí: ' + error.message, 'error')
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
                <p className="text-slate-500 font-medium whitespace-nowrap overflow-hidden">Đang tải thông tin LOT...</p>
                <div className="text-xs text-slate-400 font-mono mt-4 truncate w-full max-w-xs text-center">{code}</div>
            </div>
        )
    }

    if (!lot) {
        return (
            <div className="p-6 text-center space-y-6">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Boxes size={40} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Không tìm thấy LOT</h2>
                    <p className="text-slate-500 mt-2">Mã LOT <strong>{code}</strong> không tồn tại trong hệ thống {currentSystem?.name}.</p>
                </div>
                <Link
                    href="/warehouses/lots"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold"
                >
                    <ArrowLeft size={18} />
                    Quay lại danh sách
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto space-y-6 pb-20">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <button
                        onClick={fetchLotData}
                        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"
                    >
                        <RefreshCcw size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center shrink-0">
                        <Boxes size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Thông tin quét LOT</h1>
                        <p className="text-orange-600 font-mono font-bold">{lot.code}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                            <Truck size={12} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Nhà cung cấp</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{lot.suppliers?.name || '---'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                            <Calendar size={12} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Ngày đóng gói</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {lot.packaging_date ? new Date(lot.packaging_date).toLocaleDateString('vi-VN') : '--/--/----'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Positions Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MapPin size={20} className="text-orange-500" />
                        Vị trí lưu kho
                    </h3>
                    <button
                        onClick={() => setIsAssigning(!isAssigning)}
                        className={`p-2 rounded-xl transition-colors ${isAssigning ? 'bg-orange-600 text-white' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}`}
                    >
                        {isAssigning ? <X size={20} /> : <Plus size={20} />}
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    {lot.positions && lot.positions.length > 0 ? (
                        lot.positions.map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl px-3 py-2">
                                <span className="font-bold text-orange-600 dark:text-orange-400">{p.code}</span>
                                <button
                                    onClick={() => handleUnassignPosition(p.id, p.code)}
                                    className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 rounded-full text-orange-400"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="w-full text-center py-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-sm text-slate-400 italic">Chưa gán vị trí</p>
                        </div>
                    )}
                </div>

                {isAssigning && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Tìm mã vị trí (VD: A1-01)..."
                                value={posSearchTerm}
                                onChange={(e) => {
                                    const val = e.target.value.toUpperCase()
                                    setPosSearchTerm(val)
                                    searchPositions(val)
                                }}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-orange-500"
                                autoFocus
                            />
                        </div>

                        {searchingPositions ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                            </div>
                        ) : availablePositions.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                {availablePositions.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleAssignPosition(p.id, p.code)}
                                        disabled={p.lot_id === lot.id}
                                        className={`flex flex-col p-3 rounded-2xl border text-left transition-all ${p.lot_id === lot.id
                                            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                                            : p.lot_id
                                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-500'
                                            }`}
                                    >
                                        <span className="font-bold text-slate-900 dark:text-white">{p.code}</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                                            {p.lot_id === lot.id ? 'Đã gán cho LOT này' : p.lot_id ? 'Đã có LOT khác' : 'Trống'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : posSearchTerm.length > 0 && (
                            <p className="text-center text-sm text-slate-400 py-4">Không tìm thấy vị trí trùng khớp</p>
                        )}
                    </div>
                )}
            </div>

            {/* Products Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Package size={20} className="text-indigo-500" />
                    Danh sách sản phẩm
                </h3>

                <div className="space-y-3">
                    {lot.lot_items?.map((item: any) => (
                        <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded text-xs font-mono font-bold border border-indigo-100 dark:border-indigo-800">
                                    {item.products?.sku}
                                </span>
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                    <span className="text-xs font-bold">{item.quantity}</span>
                                    <span className="text-[10px] font-medium opacity-80">{item.unit || item.products?.unit}</span>
                                </div>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight mb-3">{item.products?.name}</h4>

                            {/* Tags in dynamic scan view */}
                            {lot.lot_tags && (
                                <TagDisplay
                                    tags={lot.lot_tags.filter((t: any) => t.lot_item_id === item.id).map((t: any) => t.tag)}
                                    placeholderMap={{ '@': item.products?.sku || '' }}
                                />
                            )}
                        </div>
                    ))}
                    {(!lot.lot_items || lot.lot_items.length === 0) && (
                        <p className="text-center text-sm text-slate-400 italic py-4">Không có sản phẩm</p>
                    )}
                </div>
            </div>

            {/* Bottom Floating Nav for Mobile Scan */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-center z-50">
                <Link
                    href="/warehouses/lots"
                    className="flex items-center gap-2 px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold shadow-xl shadow-slate-200 dark:shadow-none transition-transform active:scale-95"
                >
                    <ClipboardCheck size={20} />
                    Xác nhận & Thoát
                </Link>
            </div>
        </div>
    )
}
