'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
    Map as MapIcon, Search, Filter, RefreshCcw, Download, Calendar, 
    History, ArrowRight, Package, MapPin, CheckCircle2, XCircle,
    ChevronLeft, ChevronRight, Loader2, Info, Activity, Clock,
    User, ArrowUpRight, ArrowDownRight, Move, LogOut, PackagePlus
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { format, subDays, parseISO, startOfDay, endOfDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import { exportWarehouseMovementsToExcel } from '@/lib/warehouseMovementExcelExport'
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
    } | null;
    sourcePositionCode?: string; // For "moved" type
}

export default function WarehouseMapLogPage() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [loading, setLoading] = useState(true)
    const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
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
                .gte('created_at', startOfDay(parseISO(dateFrom)).toISOString())
                .lte('created_at', endOfDay(parseISO(dateTo)).toISOString())
                .order('created_at', { ascending: false })

            if (logsError) throw logsError

            if (!logs || logs.length === 0) {
                setMovements([])
                setLoading(false)
                return
            }

            // 2. Collect unique user IDs, position IDs, and lot IDs
            const userIds = Array.from(new Set((logs as any[]).map(l => l.changed_by).filter(Boolean)))
            const posIds = Array.from(new Set((logs as any[]).map(l => l.record_id).filter(Boolean)))
            
            const lotIds = new Set<string>()
            ;(logs as any[]).forEach(l => {
                const oldLotId = l.old_data?.lot_id
                const newLotId = l.new_data?.lot_id
                if (oldLotId) lotIds.add(oldLotId)
                if (newLotId) lotIds.add(newLotId)
            })

            // 3. Fetch related data in parallel
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

            // 4. Process logs into movements
            const processedMovements: MapMovement[] = []

            // Helper to find a "counterpart" log for movement tracking
            // In our system, a MOVE is often: Position A (lot_id: LOT -> null) and Position B (lot_id: null -> LOT)
            // occurring within seconds of each other by the same user.
            const unpairedLogs = [...logs] as any[]
            const pairedIds = new Set<string>()

            for (let i = 0; i < unpairedLogs.length; i++) {
                const log = unpairedLogs[i]
                if (pairedIds.has(log.id)) continue

                const oldLotId = log.old_data?.lot_id
                const newLotId = log.new_data?.lot_id
                const timestamp = new Date(log.created_at).getTime()
                
                let movement: MapMovement | null = null

                if (!oldLotId && newLotId) {
                    // Try to find a counterpart (MOVE)
                    // Look for a log where this LOT was removed from somewhere else recently
                    // We increase window to 24 hours as moves can take a long time (e.g. warehouse relocation)
                    const counterpart = unpairedLogs.find((other, idx) => 
                        idx !== i && 
                        !pairedIds.has(other.id) &&
                        other.old_data?.lot_id === newLotId && 
                        !other.new_data?.lot_id &&
                        other.record_id !== log.record_id && // Must be different positions to be a "Move"
                        Math.abs(new Date(other.created_at).getTime() - timestamp) < 24 * 60 * 60 * 1000 // 24 hour window
                    )

                    if (counterpart) {
                        pairedIds.add(counterpart.id)
                        movement = {
                            id: log.id,
                            type: 'moved',
                            createdAt: log.created_at,
                            performedBy: userMap.get(log.changed_by) || null,
                            position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                            sourcePositionCode: posMap.get(counterpart.record_id) || 'Unknown',
                            lot: lotMap.get(newLotId) || { id: newLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                            oldLot: null
                        }
                    } else {
                        movement = {
                            id: log.id,
                            type: 'assigned',
                            createdAt: log.created_at,
                            performedBy: userMap.get(log.changed_by) || null,
                            position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                            lot: lotMap.get(newLotId) || { id: newLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                            oldLot: null
                        }
                    }
                } else if (oldLotId && !newLotId) {
                    // This might be a standalone EXPORT or the "from" part of a move (if not paired yet)
                    const counterpart = unpairedLogs.find((other, idx) => 
                        idx !== i && 
                        !pairedIds.has(other.id) &&
                        other.new_data?.lot_id === oldLotId && 
                        !other.old_data?.lot_id &&
                        other.record_id !== log.record_id && // Must be different positions to be a "Move"
                        Math.abs(new Date(other.created_at).getTime() - timestamp) < 24 * 60 * 60 * 1000 // 24 hour window
                    )

                    if (counterpart) {
                        pairedIds.add(counterpart.id)
                        movement = {
                            id: counterpart.id,
                            type: 'moved',
                            createdAt: counterpart.created_at,
                            performedBy: userMap.get(counterpart.changed_by) || null,
                            position: { id: counterpart.record_id, code: posMap.get(counterpart.record_id) || 'Unknown' },
                            sourcePositionCode: posMap.get(log.record_id) || 'Unknown',
                            lot: lotMap.get(oldLotId) || { id: oldLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                            oldLot: null
                        }
                    } else {
                        movement = {
                            id: log.id,
                            type: 'exported',
                            createdAt: log.created_at,
                            performedBy: userMap.get(log.changed_by) || null,
                            position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                            lot: null,
                            oldLot: lotMap.get(oldLotId) || { id: oldLotId, code: 'Unknown' }
                        }
                    }
                } else if (oldLotId && newLotId && oldLotId !== newLotId) {
                    movement = {
                        id: log.id,
                        type: 'replaced',
                        createdAt: log.created_at,
                        performedBy: userMap.get(log.changed_by) || null,
                        position: { id: log.record_id, code: posMap.get(log.record_id) || 'Unknown' },
                        lot: lotMap.get(newLotId) || { id: newLotId, code: 'Unknown', products: [], totalWeightKg: 0 },
                        oldLot: lotMap.get(oldLotId) || { id: oldLotId, code: 'Unknown' }
                    }
                }

                if (movement) {
                    processedMovements.push(movement)
                }
            }

            setMovements(processedMovements)
        } catch (e: any) {
            console.error('Error fetching movements:', e)
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
        exportWarehouseMovementsToExcel({
            systemName: currentSystem.name || 'Unknown System',
            dateRange: `${format(parseISO(dateFrom), 'dd/MM/yyyy')} - ${format(parseISO(dateTo), 'dd/MM/yyyy')}`,
            movements: filteredMovements
        });
    }

    const getMovementIcon = (type: MovementType) => {
        switch (type) {
            case 'assigned': return <PackagePlus className="text-emerald-500" />;
            case 'moved': return <Move className="text-blue-500" />;
            case 'exported': return <LogOut className="text-rose-500" />;
            case 'replaced': return <RefreshCcw className="text-amber-500" />;
            default: return <Activity className="text-zinc-500" />;
        }
    }

    const getMovementLabel = (type: MovementType) => {
        switch (type) {
            case 'assigned': return 'Nhập vị trí';
            case 'moved': return 'Di chuyển';
            case 'exported': return 'Gỡ vị trí / Dọn ô';
            case 'replaced': return 'Thay thế';
            default: return 'Khác';
        }
    }

    const getMovementColor = (type: MovementType) => {
        switch (type) {
            case 'assigned': return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
            case 'moved': return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
            case 'exported': return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800';
            case 'replaced': return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
            default: return 'bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-900/20 dark:text-zinc-400 dark:border-zinc-800';
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#020617] p-4 sm:p-8 transition-colors overflow-hidden">
            {/* Header section with Premium Aesthetic */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-800 shadow-sm">
                        <Activity size={12} />
                        Live Warehouse Tracking
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-4">
                        <MapIcon className="text-blue-600" size={32} />
                        Nhật Ký Sơ Đồ Kho
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg max-w-2xl">
                        Bản ghi toàn diện mọi cử động trên sơ đồ kho: Nhập, Xuất và Luân chuyển nội bộ.
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-1">
                        <button 
                            onClick={handleExportExcel}
                            className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs uppercase rounded-xl flex items-center gap-2 hover:opacity-90 transition-all"
                        >
                            <Download size={16} /> Xuất Báo Cáo
                        </button>
                        <button 
                            onClick={fetchMovements} 
                            disabled={loading}
                            className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all active:scale-90"
                        >
                            <RefreshCcw size={20} className={`${loading ? 'animate-spin' : ''} text-zinc-600 dark:text-zinc-400`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Panel - Glassmorphism style */}
            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-[40px] border border-white dark:border-zinc-800 p-8 mb-8 shadow-2xl shadow-blue-500/5">
                <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Search Field */}
                        <div className="lg:col-span-7 space-y-3">
                            <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Tìm kiếm nhanh</label>
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input 
                                    placeholder="Mã LOT, SKU, Vị trí hoặc Người thực hiện..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                    className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[24px] py-4 pl-14 pr-6 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-500/50 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm" 
                                />
                            </div>
                        </div>

                        {/* Date Range Selector */}
                        <div className="lg:col-span-5 space-y-3">
                            <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Khoảng thời gian</label>
                            <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[24px] px-6 py-4 shadow-sm">
                                <Calendar size={20} className="text-blue-500 shrink-0" />
                                <div className="flex items-center gap-4 flex-1">
                                    <input 
                                        type="date" 
                                        value={dateFrom} 
                                        onChange={(e) => setDateFrom(e.target.value)} 
                                        className="bg-transparent border-none outline-none font-bold text-sm text-zinc-900 dark:text-white flex-1" 
                                    />
                                    <span className="text-zinc-300 dark:text-zinc-700 font-bold">/</span>
                                    <input 
                                        type="date" 
                                        value={dateTo} 
                                        onChange={(e) => setDateTo(e.target.value)} 
                                        className="bg-transparent border-none outline-none font-bold text-sm text-zinc-900 dark:text-white flex-1" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Lệnh sản xuất</label>
                            <div className="relative group">
                                <Package className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input 
                                    placeholder="Mã lệnh sản xuất (LSX...)" 
                                    value={prodOrderSearch} 
                                    onChange={e => setProdOrderSearch(e.target.value)} 
                                    className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[20px] py-3 pl-12 pr-6 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-500/50 transition-all shadow-sm" 
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Lô sản xuất</label>
                            <div className="relative group">
                                <Info className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input 
                                    placeholder="Mã lô sản xuất (LOT...)" 
                                    value={prodLotSearch} 
                                    onChange={e => setProdLotSearch(e.target.value)} 
                                    className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[20px] py-3 pl-12 pr-6 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-500/50 transition-all shadow-sm" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Type Filter - Full Width Row */}
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-2">Hình thức cử động</label>
                        <div className="bg-white dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 rounded-[24px] px-2 py-2 shadow-sm">
                            <div className="flex gap-2">
                                {(['all', 'assigned', 'moved', 'exported'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setTypeFilter(type)}
                                        className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                                            typeFilter === type 
                                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl' 
                                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        {type === 'all' ? 'Tất cả cử động' : getMovementLabel(type)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline View */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white dark:bg-zinc-900/50 rounded-[40px] border border-zinc-100 dark:border-zinc-800">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                            <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-pulse" size={32} />
                        </div>
                        <p className="text-zinc-400 font-bold text-xs uppercase tracking-[0.3em] mt-8">Đang truy xuất dữ liệu thời gian thực...</p>
                    </div>
                ) : filteredMovements.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white dark:bg-zinc-900/50 rounded-[40px] border border-zinc-100 dark:border-zinc-800 text-zinc-300">
                        <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                            <History size={48} className="opacity-20" />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Chưa có bản ghi nào</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm text-center font-medium">Không tìm thấy bất kỳ cử động nào trong khoảng thời gian đã chọn.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-4 space-y-6 custom-scrollbar">
                        {filteredMovements.map((m, idx) => (
                            <div 
                                key={m.id} 
                                className="group relative bg-white dark:bg-zinc-900/80 rounded-[32px] border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col lg:flex-row gap-8 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                {/* Left Side: Action Icon & Type */}
                                <div className="flex flex-row lg:flex-col items-center lg:items-start gap-4 lg:w-48 shrink-0">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border ${getMovementColor(m.type)}`}>
                                        {React.cloneElement(getMovementIcon(m.type) as React.ReactElement, { size: 28, strokeWidth: 2.5 } as any)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-[11px] font-black uppercase tracking-[0.15em] ${m.type === 'assigned' ? 'text-emerald-600' : m.type === 'moved' ? 'text-blue-600' : m.type === 'exported' ? 'text-rose-600' : 'text-amber-600'}`}>
                                            {getMovementLabel(m.type)}
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-1 text-zinc-500 dark:text-zinc-400">
                                            <Clock size={12} />
                                            <span className="text-xs font-bold">{format(parseISO(m.createdAt), 'HH:mm')}</span>
                                            <span className="text-[10px] opacity-30">|</span>
                                            <span className="text-xs font-bold">{format(parseISO(m.createdAt), 'dd/MM/yyyy')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Center: The Movement "Bridge" */}
                                <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 py-4 px-8 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-[24px] border border-zinc-100/50 dark:border-zinc-800/50">
                                    
                                    {m.type === 'moved' && (
                                        <>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-zinc-400 uppercase mb-2">Vị trí gốc</span>
                                                <div className="px-5 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm text-lg font-black text-zinc-500 line-through">
                                                    {m.sourcePositionCode}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center text-blue-500 animate-pulse">
                                                <ArrowRight size={24} strokeWidth={3} className="rotate-90 md:rotate-0" />
                                                <span className="text-[8px] font-black uppercase mt-1">Luân chuyển</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-blue-600 uppercase mb-2">Vị trí đích</span>
                                                <div className="px-6 py-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 text-xl font-black">
                                                    {m.position.code}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {m.type === 'assigned' && (
                                        <>
                                            <div className="flex flex-col items-center opacity-30 grayscale">
                                                <span className="text-[10px] font-black uppercase mb-2">Khu vực nhận</span>
                                                <div className="p-4 bg-zinc-200 dark:bg-zinc-800 rounded-full">
                                                    <Package size={24} />
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center text-emerald-500">
                                                <ArrowRight size={24} strokeWidth={3} className="rotate-90 md:rotate-0" />
                                                <span className="text-[8px] font-black uppercase mt-1">Đưa vào kệ</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-emerald-600 uppercase mb-2">Tại vị trí</span>
                                                <div className="px-6 py-4 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-500/20 text-xl font-black">
                                                    {m.position.code}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {m.type === 'exported' && (
                                        <>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-rose-600 uppercase mb-2">Từ vị trí</span>
                                                <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-2 border-rose-500 text-rose-500 rounded-2xl shadow-sm text-xl font-black">
                                                    {m.position.code}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center text-rose-500">
                                                <ArrowRight size={24} strokeWidth={3} className="rotate-90 md:rotate-0" />
                                                <span className="text-[8px] font-black uppercase mt-1">Gỡ vị trí / Dọn ô</span>
                                            </div>
                                            <div className="flex flex-col items-center opacity-30 grayscale">
                                                <span className="text-[10px] font-black uppercase mb-2">Điểm đến</span>
                                                <div className="p-4 bg-zinc-200 dark:bg-zinc-800 rounded-full">
                                                    <LogOut size={24} />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {m.type === 'replaced' && (
                                        <>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-amber-600 uppercase mb-2">LOT Cũ</span>
                                                <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-bold text-zinc-500">
                                                    {m.oldLot?.code || 'Unknown'}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center text-amber-500">
                                                <RefreshCcw size={20} strokeWidth={3} />
                                                <span className="text-[8px] font-black uppercase mt-1">Thay thế tại {m.position.code}</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-amber-600 uppercase mb-2">LOT Mới</span>
                                                <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800">
                                                    {m.lot?.code || 'Unknown'}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Right Side: Lot & Product Metadata */}
                                <div className="lg:w-80 space-y-4">
                                    {(m.lot || m.oldLot) && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                    <span className="text-sm font-black text-zinc-900 dark:text-white font-mono tracking-tight">
                                                        {m.lot?.code || m.oldLot?.code}
                                                    </span>
                                                </div>
                                                {m.lot?.totalWeightKg ? (
                                                    <span className="text-[10px] font-black px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500">
                                                        {Number(m.lot.totalWeightKg).toLocaleString('vi-VN')} KG
                                                    </span>
                                                ) : null}
                                            </div>
                                            
                                            {m.lot?.products.map((p, pIdx) => (
                                                <div key={pIdx} className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 group-hover:border-blue-200 dark:group-hover:border-blue-900 transition-colors">
                                                    <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">{p.name}</div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{p.sku}</span>
                                                        <span className="text-[10px] font-black text-blue-600">{p.quantity} {p.unit}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Performed By Info */}
                                    <div className="pt-4 mt-auto border-t border-zinc-50 dark:border-zinc-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                                <User size={14} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{m.performedBy?.fullName || 'Hệ thống'}</span>
                                                <span className="text-[8px] text-zinc-400 font-medium">Operator</span>
                                            </div>
                                        </div>
                                        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors group/btn">
                                            <ArrowUpRight size={16} className="text-zinc-300 group-hover/btn:text-blue-500 transition-colors" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    )
}
