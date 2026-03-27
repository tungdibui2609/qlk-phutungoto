'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Loader2, Camera, Keyboard, RotateCcw, CheckCircle2, Package, MapPin, X, Download, Send, PlayCircle, Hash, Search } from 'lucide-react'
import { Database } from '@/lib/database.types'

interface LocalLot {
    id: string
    code: string
    daily_seq: number | null
    product_names: string[]
}

interface LocalPosition {
    id: string
    code: string
    lot_id: string | null
    zone_ids: string[] // Added for offline zone filtering
}

interface PendingAssignment {
    lotId: string
    lotCode: string
    productNames: string[]
    positionId: string
    positionCode: string
    stt: string
    timestamp: number
}

type Zone = Database['public']['Tables']['zones']['Row']

export default function MobileAssignTab() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [loading, setLoading] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    // Mode: 'scan' (legacy) or 'suggest' (new)
    const [mode, setMode] = useState<'scan' | 'suggest'>('suggest')
    const [step, setStep] = useState<'setup' | 'working'>('setup')

    // Master Data
    const [zones, setZones] = useState<Zone[]>([])
    const [localPositions, setLocalPositions] = useState<LocalPosition[]>([])
    const [localLots, setLocalLots] = useState<LocalLot[]>([])

    // Selection
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

    // Working States
    const [suggestedPos, setSuggestedPos] = useState<LocalPosition | null>(null)
    const [currentStt, setCurrentStt] = useState('')
    const [assignments, setAssignments] = useState<PendingAssignment[]>([])

    useEffect(() => { 
        loadZones() 
        // Load assignments from localStorage if any
        const saved = localStorage.getItem('MOBILE_PENDING_ASSIGNMENTS')
        if (saved) {
            try { setAssignments(JSON.parse(saved)) } catch(e) {}
        }
    }, [])

    useEffect(() => {
        localStorage.setItem('MOBILE_PENDING_ASSIGNMENTS', JSON.stringify(assignments))
    }, [assignments])

    async function loadZones() {
        const { data } = await supabase.from('zones').select('*').order('level', { ascending: true })
        if (data) setZones(data)
    }

    async function downloadData() {
        if (!currentSystem?.code || !profile?.company_id) return
        setIsDownloading(true)
        try {
            // 1. Fetch Today's LOTs
            const today = new Date().toISOString().split('T')[0]
            const { data: lots } = await supabase.from('lots')
                .select(`
                    id, 
                    code, 
                    daily_seq, 
                    lot_items(
                        products(name)
                    )
                `)
                .eq('system_code', currentSystem.code)
                .eq('inbound_date', today)

            const formattedLots: LocalLot[] = (lots || []).map((l: any) => ({
                id: l.id,
                code: l.code,
                daily_seq: l.daily_seq,
                product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || []
            }))

            // 2. Fetch All Empty Positions & Zone Mappings
            // We need zone_positions to filter positions by zone offline
            const { data: posData } = await supabase.from('positions')
                .select(`
                    id, 
                    code, 
                    lot_id,
                    zone_positions(zone_id)
                `)
                .eq('system_type', currentSystem.code)
                .is('lot_id', null)

            const formattedPositions: LocalPosition[] = (posData || []).map((p: any) => {
                const zp = p.zone_positions
                const zoneIds = Array.isArray(zp) 
                    ? zp.map((z: any) => z.zone_id) 
                    : (zp && typeof zp === 'object' && 'zone_id' in zp ? [(zp as any).zone_id] : [])
                    
                return {
                    id: p.id,
                    code: p.code,
                    lot_id: p.lot_id,
                    zone_ids: zoneIds
                }
            })

            setLocalLots(formattedLots)
            setLocalPositions(formattedPositions)
            showToast(`Đã tải: ${formattedLots.length} LOT & ${formattedPositions.length} vị trí trống`, 'success')
        } catch (e: any) {
            showToast('Lỗi tải dữ liệu: ' + e.message, 'error')
        } finally {
            setIsDownloading(false)
        }
    }

    // Get descendant zone IDs
    const getDescendantZoneIds = (zoneId: string) => {
        const ids = new Set<string>([zoneId])
        let added = true
        while (added) {
            added = false
            for (const z of zones) {
                if (z.parent_id && ids.has(z.parent_id) && !ids.has(z.id)) {
                    ids.add(z.id)
                    added = true
                }
            }
        }
        return Array.from(ids)
    }

    function suggestNextPosition() {
        if (!selectedZoneId) {
            showToast('Vui lòng chọn khu vực trước', 'warning')
            setStep('setup')
            return
        }

        // WORK OFFLINE! Use localPositions and assignments
        const descendantIds = getDescendantZoneIds(selectedZoneId)
        const assignedPosIds = new Set(assignments.map(a => a.positionId))

        // Find the first empty position that is in one of the descendant zones 
        // and hasn't been assigned in the current local session
        const nextPos = localPositions
            .filter(p => !assignedPosIds.has(p.id) && p.zone_ids.some(zId => descendantIds.includes(zId)))
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))[0]

        if (nextPos) {
            setSuggestedPos(nextPos)
            setStep('working')
            setCurrentStt('')
        } else {
            showToast('Không còn vị trí trống trong khu vực này!', 'error')
            setStep('setup')
        }
    }

    async function handleConfirmStt() {
        if (!suggestedPos || !currentStt) return

        const sttNum = parseInt(currentStt)
        const targetLot = localLots.find(l => l.daily_seq === sttNum)

        if (!targetLot) {
            showToast(`Không tìm thấy LOT hôm nay có STT là ${currentStt}`, 'error')
            return
        }

        // Check if lot already assigned in this session or DB
        const alreadyAssigned = assignments.find(a => a.lotId === targetLot.id)
        if (alreadyAssigned) {
            showToast(`LOT này đã được gán vào ${alreadyAssigned.positionCode}`, 'warning')
            return
        }

        // Add to local assignments
        const newAssignment: PendingAssignment = {
            lotId: targetLot.id,
            lotCode: targetLot.code,
            productNames: targetLot.product_names,
            positionId: suggestedPos.id,
            positionCode: suggestedPos.code,
            stt: currentStt,
            timestamp: Date.now()
        }

        setAssignments(prev => [newAssignment, ...prev])
        showToast(`Đã ghi nhận: STT ${currentStt} → ${suggestedPos.code}`, 'success')

        // Automatically suggest next position
        suggestNextPosition()
    }

    async function syncAssignments() {
        if (assignments.length === 0) return
        setIsSyncing(true)
        try {
            for (const ass of assignments) {
                // 1. Assign position to lot
                const { error: posErr } = await (supabase.from('positions') as any)
                    .update({ lot_id: ass.lotId } as any)
                    .eq('id', ass.positionId)
                    .eq('system_type', currentSystem?.code)
                
                if (posErr) throw posErr
            }
            showToast(`Đã đồng bộ ${assignments.length} vị trí thành công!`, 'success')
            setAssignments([])
            setStep('setup')
            setSuggestedPos(null)
        } catch (e: any) {
            showToast('Lỗi đồng bộ: ' + e.message, 'error')
        } finally {
            setIsSyncing(false)
        }
    }

    // Zone filters
    const warehouses = zones.filter(z => !z.parent_id)
    const leafZones = selectedWarehouseId ? zones.filter(z => {
        let isUnder = false
        let cur: Zone | undefined = z
        while (cur) {
            if (cur.id === selectedWarehouseId) { isUnder = true; break }
            cur = zones.find(p => p.id === cur!.parent_id)
        }
        const isLeaf = !zones.some(other => other.parent_id === z.id)
        return isUnder && isLeaf
    }) : []

    return (
        <div className="mobile-animate-fade-in pb-20">
            {/* Header */}
            <div className="mobile-header">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="mobile-header-brand">Sarita Workspace</div>
                        <div className="mobile-header-title">Gán Vị Trí</div>
                        <div className="mobile-header-subtitle">Quy trình Gợi ý & STT</div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isDownloading ? 'bg-zinc-100' : 'bg-blue-50 text-blue-600 active:scale-95 border border-blue-100'}`}
                            onClick={downloadData}
                            disabled={isDownloading}
                        >
                            {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        </button>
                        <button 
                            className="w-10 h-10 flex items-center justify-center bg-zinc-100 text-zinc-600 rounded-xl active:scale-95"
                            onClick={() => {
                                if (assignments.length > 0) {
                                    if (confirm('Bạn có chắc muốn làm mới? Các dữ liệu chưa đồng bộ sẽ bị mất.')) {
                                        setAssignments([])
                                        setStep('setup')
                                        setSuggestedPos(null)
                                    }
                                } else {
                                    setStep('setup')
                                    setSuggestedPos(null)
                                }
                            }}
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>

                {/* Badge Status */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${localLots.length > 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${localLots.length > 0 ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                        {localLots.length} LOT sẵn sàng
                    </div>
                    {assignments.length > 0 && (
                        <div className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 size={11} />
                            {assignments.length} Đã gán local
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
                {step === 'setup' ? (
                    <div className="mobile-card-premium p-6 space-y-6 animate-in slide-in-from-bottom duration-500">
                        <div className="text-center mb-2">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-emerald-100">
                                <MapPin size={32} />
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">Thiết lập khu vực</h3>
                            <p className="text-xs text-zinc-500 mt-1 uppercase font-bold tracking-wider">Hệ thống sẽ gợi ý vị trí trống</p>
                        </div>

                        {/* Store/Warehouse */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">1. Chọn Kho hàng</label>
                            <div className="grid grid-cols-2 gap-2">
                                {warehouses.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => setSelectedWarehouseId(w.id)}
                                        className={`px-4 py-3 rounded-2xl text-xs font-black transition-all border-2 uppercase tracking-tight ${selectedWarehouseId === w.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-400'}`}
                                    >
                                        {w.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Zones */}
                        {selectedWarehouseId && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">2. Chọn Khu vực / Ô gộp</label>
                                <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-1">
                                    {leafZones.map(z => {
                                         const path: string[] = []
                                         let cur: Zone | undefined = z
                                         while (cur && cur.id !== selectedWarehouseId) {
                                             path.unshift(cur.name)
                                             cur = zones.find(p => p.id === cur!.parent_id)
                                         }
                                         return (
                                            <button
                                                key={z.id}
                                                onClick={() => setSelectedZoneId(z.id)}
                                                className={`flex items-center justify-between p-4 rounded-2xl text-[13px] font-bold transition-all border-2 ${selectedZoneId === z.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-500'}`}
                                            >
                                                <span>{path.join(' › ')}</span>
                                                {selectedZoneId === z.id && <CheckCircle2 size={16} />}
                                            </button>
                                         )
                                    })}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={suggestNextPosition}
                            disabled={!selectedZoneId || loading || isDownloading}
                            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-black transition-all transform active:scale-95 ${!selectedZoneId || loading || isDownloading ? 'bg-zinc-100 text-zinc-300' : 'bg-zinc-900 text-white shadow-xl'}`}
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
                            {loading ? 'ĐANG TÌM VỊ TRÍ...' : 'BẮT ĐẦU GÁN VỊ TRÍ'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Suggestion Card */}
                        <div className="mobile-card-premium p-6 border-emerald-500 shadow-emerald-500/10 animate-in zoom-in duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    VỊ TRÍ TIẾP THEO
                                </div>
                                <button onClick={() => setStep('setup')} className="p-1 text-zinc-400 hover:text-zinc-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="text-center py-6">
                                <div className="mx-auto w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center mb-4 shadow-inner border border-emerald-100">
                                    <MapPin size={48} />
                                </div>
                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">HÃY ĐẶT HÀNG VÀO</div>
                                <div className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
                                    {suggestedPos?.code}
                                </div>
                            </div>

                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-6" />

                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest text-center block">NHẬP STT CỦA LÔ HÀNG</label>
                                <div className="relative">
                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={24} />
                                    <input
                                        type="number"
                                        pattern="[0-9]*"
                                        inputMode="numeric"
                                        value={currentStt}
                                        onChange={(e) => setCurrentStt(e.target.value)}
                                        placeholder="STT..."
                                        className="w-full bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 focus:border-emerald-500 rounded-2xl py-5 pl-14 pr-6 text-2xl font-black outline-none transition-all placeholder:text-zinc-200"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleConfirmStt}
                                    disabled={!currentStt || loading}
                                    className={`w-full py-5 rounded-2xl flex items-center justify-center gap-2 text-lg font-black transition-all ${!currentStt || loading ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 active:scale-95'}`}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                                    XÁC NHẬN
                                </button>
                            </div>
                        </div>

                        {/* Recent Assignments */}
                        {assignments.length > 0 && (
                            <div className="space-y-3 animate-in fade-in duration-500">
                                <div className="flex items-center justify-between px-2">
                                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">ĐÃ GHÉP TRONG PHIÊN ({assignments.length})</h4>
                                    <button 
                                        onClick={syncAssignments}
                                        disabled={isSyncing}
                                        className="flex items-center gap-1.5 text-[10px] font-black text-orange-600 uppercase tracking-widest active:scale-95 disabled:opacity-50"
                                    >
                                        {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                        ĐỒNG BỘ {assignments.length} MỤC
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {assignments.map((ass, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-black shrink-0 border border-zinc-100">
                                                    #{ass.stt}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-black text-zinc-900 dark:text-white leading-none mb-1 truncate">{ass.lotCode}</div>
                                                    <div className="text-[9px] text-zinc-500 font-medium truncate mb-1">
                                                        {ass.productNames.join(', ')}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-bold uppercase">
                                                        <MapPin size={10} />
                                                        {ass.positionCode}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-bold text-zinc-300">
                                                {new Date(ass.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Empty State when no lots or positions */}
            {(localLots.length === 0 || localPositions.length === 0) && !isDownloading && (
                <div className="px-6 py-4">
                    <div className="p-8 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[32px] text-center bg-zinc-50/50">
                        <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300 dark:text-zinc-600 shadow-sm">
                            <Download size={24} />
                        </div>
                        <h4 className="text-zinc-900 dark:text-white font-black text-sm uppercase tracking-tight">Dữ liệu chưa sẵn sàng</h4>
                        <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed font-medium">Bấm <Download size={10} className="inline mx-0.5" /> ở trên để tải danh sách LOT & vị trí trống về máy.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
