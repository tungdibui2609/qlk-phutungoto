'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
    Map as MapIcon, Search, RefreshCcw, Download, Calendar, 
    History, ArrowRight, Package, LogOut, PackagePlus,
    Activity, Clock, User, Move, Info, Layers, MapPin, Loader2
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { format, subDays, parseISO, startOfDay, endOfDay } from 'date-fns'
import { exportWarehouseSnapshotToExcel } from '../../../../lib/warehouseSnapshotExcelExport'
import { extractWeightFromName } from '@/lib/unitConversion'

type MovementType = 'assigned' | 'moved' | 'exported' | 'replaced' | 'unknown';

interface MapMovement {
    id: string;
    type: MovementType;
    createdAt: string;
    performedBy: {
        id: string;
        fullName: string;
        email: string;
    } | null;
    position: {
        id: string;
        code: string;
    };
    lot: {
        id: string;
        code: string;
        productionOrderCode?: string | null;
        productionLotCode?: string | null;
        products: Array<{
            name: string;
            sku: string;
            quantity: number;
            unit: string;
        }>;
        totalWeightKg: number;
    } | null;
    oldLot: {
        id: string;
        code: string;
        productionOrderCode?: string | null;
        productionLotCode?: string | null;
        products?: Array<{
            name: string;
            sku: string;
            quantity: number;
            unit: string;
        }>;
    } | null;
    sourcePositionCode?: string; // For "moved" type
}

export default function WarehouseMovementsSnapshotPage() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [loading, setLoading] = useState(true)
    const [dateFrom, setDateFrom] = useState(() => format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"))
    const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    const [movements, setMovements] = useState<MapMovement[]>([])
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | MovementType>('all')
    const [prodOrderSearch, setProdOrderSearch] = useState('')
    const [prodLotSearch, setProdLotSearch] = useState('')

    const fetchMovements = useCallback(async () => {
        if (!currentSystem?.code) return
        setLoading(true)
        try {
            // 1. Fetch audit logs for 'positions' table
            const { data: logs, error: logsError } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('table_name', 'positions')
                .eq('system_code', currentSystem.code)
                .gte('created_at', parseISO(dateFrom).toISOString())
                .lte('created_at', parseISO(dateTo).toISOString())
                .order('created_at', { ascending: false }) // Latest first is crucial for deduplication

            if (logsError) throw logsError

            if (!logs || logs.length === 0) {
                setMovements([])
                setLoading(false)
                return
            }

            // 2. Collect unique IDs
            const userIds = Array.from(new Set((logs as any[]).map(l => l.changed_by).filter(Boolean)))
            const posIds = Array.from(new Set((logs as any[]).map(l => l.record_id).filter(Boolean)))
            
            const lotIds = new Set<string>()
            ;(logs as any[]).forEach(l => {
                const oldLotId = l.old_data?.lot_id
                const newLotId = l.new_data?.lot_id
                if (oldLotId) lotIds.add(oldLotId)
                if (newLotId) lotIds.add(newLotId)
            })

            // 3. Fetch related data
            const [usersRes, posRes, lotsRes] = await Promise.all([
                supabase.from('user_profiles' as any).select('id, full_name, email').in('id', userIds),
                supabase.from('positions').select('id, code').in('id', posIds),
                supabase.from('lots').select(`
                    id, code, production_code, production_lot_id,
                    production_lots:production_lot_id(lot_code),
                    productions:production_id(code),
                    lot_items(quantity, unit, products(name, sku, weight_kg))
                `).in('id', Array.from(lotIds))
            ])

            const userMap = new Map<string, any>((usersRes.data?.map((u: any) => [u.id, u]) || []) as any)
            const posMap = new Map<string, string>((posRes.data?.map((p: any) => [p.id, p.code]) || []) as any)
            
            const lotMap = new Map<string, any>()
            ;(lotsRes.data as any[])?.forEach((l: any) => {
                const products = l.lot_items?.map((li: any) => ({
                    name: li.products?.name || 'Unknown',
                    sku: li.products?.sku || 'N/A',
                    quantity: li.quantity,
                    unit: li.unit || 'Kg'
                })) || []

                const totalWeightKg = l.lot_items?.reduce((sum: number, li: any) => {
                    const weightFactor = extractWeightFromName(li.unit) || li.products?.weight_kg || 0
                    return sum + ((li.quantity || 0) * weightFactor)
                }, 0) || 0

                lotMap.set(l.id, {
                    id: l.id,
                    code: l.code,
                    productionOrderCode: l.productions?.code || null,
                    productionLotCode: l.production_lots?.lot_code || l.production_code || null,
                    products,
                    totalWeightKg
                })
            })

            // 4. Process logs into movements WITH Deduplication
            const processedMovements: MapMovement[] = []
            const lotDedupeMap = new Set<string>() // Keep track of lots we've already processed (latest state)

            const unpairedLogs = [...logs] as any[]
            const pairedIds = new Set<string>()

            for (let i = 0; i < unpairedLogs.length; i++) {
                const log = unpairedLogs[i]
                if (pairedIds.has(log.id)) continue

                const oldLotId = log.old_data?.lot_id
                const newLotId = log.new_data?.lot_id
                const timestamp = new Date(log.created_at).getTime()
                
                let movement: MapMovement | null = null

                // Detect Move/Assign/Export (Same logic as audit log)
                if (!oldLotId && newLotId) {
                    const counterpart = unpairedLogs.find((other, idx) => 
                        idx !== i && !pairedIds.has(other.id) &&
                        other.old_data?.lot_id === newLotId && !other.new_data?.lot_id &&
                        other.record_id !== log.record_id &&
                        Math.abs(new Date(other.created_at).getTime() - timestamp) < 24 * 60 * 60 * 1000
                    )

                    if (counterpart) {
                        pairedIds.add(counterpart.id)
                        movement = {
                            id: log.id, type: 'moved', createdAt: log.created_at,
                            performedBy: userMap.get(log.changed_by) || null,
                            position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                            sourcePositionCode: posMap.get(counterpart.record_id) || 'Unknown',
                            lot: lotMap.get(newLotId) || { id: newLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                            oldLot: null
                        }
                    } else {
                        movement = {
                            id: log.id, type: 'assigned', createdAt: log.created_at,
                            performedBy: userMap.get(log.changed_by) || null,
                            position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                            lot: lotMap.get(newLotId) || { id: newLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                            oldLot: null
                        }
                    }
                } else if (oldLotId && !newLotId) {
                    const counterpart = unpairedLogs.find((other, idx) => 
                        idx !== i && !pairedIds.has(other.id) &&
                        other.new_data?.lot_id === oldLotId && !other.old_data?.lot_id &&
                        other.record_id !== log.record_id &&
                        Math.abs(new Date(other.created_at).getTime() - timestamp) < 24 * 60 * 60 * 1000
                    )

                    if (counterpart) {
                        pairedIds.add(counterpart.id)
                        movement = {
                            id: counterpart.id, type: 'moved', createdAt: counterpart.created_at,
                            performedBy: userMap.get(counterpart.changed_by) || null,
                            position: { id: counterpart.record_id, code: posMap.get(counterpart.record_id) || 'Unknown' },
                            sourcePositionCode: posMap.get(log.record_id) || 'Unknown',
                            lot: lotMap.get(oldLotId) || { id: oldLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                            oldLot: null
                        }
                    } else {
                        movement = {
                            id: log.id, type: 'exported', createdAt: log.created_at,
                            performedBy: userMap.get(log.changed_by) || null,
                            position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                            lot: null,
                            oldLot: lotMap.get(oldLotId) || { id: oldLotId, code: 'Unknown' }
                        }
                    }
                } else if (oldLotId && newLotId && oldLotId !== newLotId) {
                    movement = {
                        id: log.id, type: 'replaced', createdAt: log.created_at,
                        performedBy: userMap.get(log.changed_by) || null,
                        position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                        lot: lotMap.get(newLotId) || { id: newLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                        oldLot: lotMap.get(oldLotId) || { id: oldLotId, code: 'Unknown' }
                    }
                }

                // DEDUPLICATION STEP: Only add if this LOT hasn't been seen yet (latest state)
                if (movement) {
                    const lotId = movement.lot?.id || movement.oldLot?.id
                    if (lotId && !lotDedupeMap.has(lotId)) {
                        processedMovements.push(movement)
                        lotDedupeMap.add(lotId)
                    }
                }
            }

            setMovements(processedMovements)
        } catch (e: any) {
            console.error('Error fetching movements snapshot:', e)
            showToast('Lỗi tải dữ liệu: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }, [currentSystem?.code, dateFrom, dateTo, showToast])

    useEffect(() => {
        if (currentSystem?.code) {
            fetchMovements()
        }
    }, [fetchMovements, currentSystem?.code])

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || 
                m.position.code.toLowerCase().includes(searchLower) ||
                m.lot?.code.toLowerCase().includes(searchLower) ||
                m.oldLot?.code.toLowerCase().includes(searchLower) ||
                m.sourcePositionCode?.toLowerCase().includes(searchLower) ||
                m.lot?.products.some(p => p.name.toLowerCase().includes(searchLower) || p.sku.toLowerCase().includes(searchLower)) ||
                m.performedBy?.fullName.toLowerCase().includes(searchLower);

            const matchesProdOrder = !prodOrderSearch || 
                m.lot?.productionOrderCode?.toLowerCase().includes(prodOrderSearch.toLowerCase());
            const matchesProdLot = !prodLotSearch || 
                m.lot?.productionLotCode?.toLowerCase().includes(prodLotSearch.toLowerCase());

            return matchesType && matchesSearch && matchesProdOrder && matchesProdLot;
        });
    }, [movements, typeFilter, searchTerm, prodOrderSearch, prodLotSearch]);

    const handleExportExcel = () => {
        if (!currentSystem) return;
        exportWarehouseSnapshotToExcel({
            systemName: currentSystem.name || 'Unknown System',
            dateRange: `${format(parseISO(dateFrom), 'dd/MM/yyyy')} - ${format(parseISO(dateTo), 'dd/MM/yyyy')}`,
            movements: filteredMovements
        });
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#020617] p-4 sm:p-8 transition-colors overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider border border-orange-100 dark:border-orange-800 shadow-sm">
                        <Layers size={12} />
                        Unique Lot Tracking
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-4">
                        <Activity className="text-orange-600" size={32} />
                        Diễn Biến Kho (Sạch)
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg max-w-2xl">
                        Tổng hợp trạng thái mới nhất của mỗi LOT. Mỗi mã hàng chỉ xuất hiện duy nhất một lần.
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-1">
                        <button 
                            onClick={handleExportExcel}
                            className="px-6 py-2.5 bg-orange-600 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-orange-500/20"
                        >
                            <Download size={16} /> Xuất File Nhập Liệu
                        </button>
                        <button onClick={fetchMovements} disabled={loading} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
                            <RefreshCcw size={20} className={`${loading ? 'animate-spin' : ''} text-zinc-600`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[40px] border border-white dark:border-zinc-800 p-8 mb-8 shadow-2xl shadow-blue-500/5">
                <div className="flex flex-col gap-8">
                    {/* Row 1: Quick Search */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Tìm kiếm nhanh</label>
                        <div className="relative group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors" size={20} />
                            <input 
                                placeholder="Mã LOT, Vị trí hoặc Người thực hiện..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[24px] py-4 pl-14 pr-6 text-sm font-bold outline-none focus:border-orange-500/50 focus:ring-8 focus:ring-orange-500/5 transition-all shadow-sm" 
                            />
                        </div>
                    </div>

                    {/* Row 2: LSX & LOT SX */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Lệnh sản xuất</label>
                            <div className="relative group">
                                <Package className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                                <input 
                                    placeholder="Mã lệnh sản xuất (LSX...)" 
                                    value={prodOrderSearch} 
                                    onChange={e => setProdOrderSearch(e.target.value)} 
                                    className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[20px] py-3 pl-12 pr-6 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-orange-500/50 transition-all shadow-sm" 
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Lô sản xuất</label>
                            <div className="relative group">
                                <Info className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                                <input 
                                    placeholder="Mã lô sản xuất (LOT...)" 
                                    value={prodLotSearch} 
                                    onChange={e => setProdLotSearch(e.target.value)} 
                                    className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[20px] py-3 pl-12 pr-6 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-orange-500/50 transition-all shadow-sm" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Time Filter (Moved Down) */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Khoảng thời gian (Truy vết chi tiết giờ phút)</label>
                        <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[24px] px-6 py-4 shadow-sm">
                            <Calendar size={20} className="text-orange-500 shrink-0" />
                            <div className="flex items-center gap-4 flex-1 w-full">
                                <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-zinc-900 dark:text-white flex-1 min-w-[200px]" />
                                <span className="text-zinc-300 font-bold">/</span>
                                <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent border-none outline-none font-bold text-sm text-zinc-900 dark:text-white flex-1 min-w-[200px]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content View */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20">
                        <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                        <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest">Đang tổng hợp diễn biến...</p>
                    </div>
                ) : filteredMovements.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white/50 rounded-[40px] border border-dashed border-zinc-200">
                        <History size={48} className="opacity-20 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-400">Không tìm thấy dữ liệu</h3>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10">
                            {filteredMovements.map((m, idx) => (
                                <div 
                                    key={m.id} 
                                    className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 p-6 hover:shadow-xl transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                                            <span className="text-sm font-black font-mono tracking-tight">{m.lot?.code || m.oldLot?.code}</span>
                                        </div>
                                        <span className="text-[10px] font-black px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500">
                                            {format(parseISO(m.createdAt), 'HH:mm dd/MM')}
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Production Details Tags */}
                                        {(m.lot?.productionOrderCode || m.oldLot?.productionOrderCode || m.lot?.productionLotCode || m.oldLot?.productionLotCode) && (
                                            <div className="flex flex-wrap gap-2">
                                                {(m.lot?.productionOrderCode || m.oldLot?.productionOrderCode) && (
                                                    <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black rounded border border-blue-100 dark:border-blue-800 uppercase tracking-tighter">
                                                        LSX: {m.lot?.productionOrderCode || m.oldLot?.productionOrderCode}
                                                    </div>
                                                )}
                                                {(m.lot?.productionLotCode || m.oldLot?.productionLotCode) && (
                                                    <div className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[9px] font-black rounded border border-purple-100 dark:border-purple-800 uppercase tracking-tighter">
                                                        LOT SX: {m.lot?.productionLotCode || m.oldLot?.productionLotCode}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* State Indicator */}
                                        <div className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                            {m.type === 'exported' ? (
                                                <>
                                                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm">
                                                        <LogOut size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Trạng thái cuối</div>
                                                        <div className="text-xs font-bold text-zinc-900 dark:text-white">ĐÃ GỠ VỊ TRÍ (Từ {m.position.code})</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                                                        <MapPin size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Trạng thái cuối</div>
                                                        <div className="text-xs font-bold text-zinc-900 dark:text-white">TẠI VỊ TRÍ: {m.position.code}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Metadata Products */}
                                        <div className="grid gap-2">
                                            {(m.lot?.products || m.oldLot?.products || []).map((p: any, pIdx: number) => (
                                                <div key={pIdx} className="p-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800 group-hover:border-orange-200 transition-colors">
                                                    <div className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1 mb-1">{p.name}</div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">{p.sku}</span>
                                                        <span className="text-[9px] font-black text-zinc-500">{p.quantity} {p.unit}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-3 border-t border-zinc-50 dark:border-zinc-800 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                <User size={12} />
                                            </div>
                                            <span className="text-[10px] font-bold text-zinc-500">Cập nhật bởi: {m.performedBy?.fullName || 'Hệ thống'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
            `}</style>
        </div>
    )
}
