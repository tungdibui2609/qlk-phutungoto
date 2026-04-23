'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { CheckCircle2, MapPin, Hash, PlayCircle, X, Loader2, Download, RotateCcw, Send, Package, Trash2 } from 'lucide-react'
import { groupWarehouseData, sortPositionsByBinPriority } from '@/lib/warehouseUtils'
import { Database } from '@/lib/database.types'
import { useMobile } from '@/contexts/MobileContext'

interface LocalLot {
    id: string
    code: string
    daily_seq: number | null
    product_names: string[]
    inbound_date: string
}

interface LocalPosition {
    id: string
    code: string
    lot_id: string | null
    zone_ids: string[]
}

interface PendingAssignment {
    lotId?: string | null
    lotCode?: string | null
    productNames?: string[]
    positionId: string
    positionCode: string
    stt: string
    productionDate: string
    timestamp: number
}

type Zone = Database['public']['Tables']['zones']['Row']

export default function MobileAssignTab() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const { state, updateData, updateSelection, addAssignment, clearAssignments, removeAssignment } = useMobile()

    const [loading, setLoading] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    // Master Data from Context
    const { zones, localPositions, localLots, selection, assignments } = state
    const { step, warehouseId: selectedWarehouseId, aisleId: selectedAisleId, slotId: selectedSlotId, tierId: selectedTierId, selectionStep } = selection
    
    // Grouped Data for "Gom ô"
    const [groupedZones, setGroupedZones] = useState<Zone[]>([])
    const [virtualToRealMap, setVirtualToRealMap] = useState<Map<string, string[]>>(new Map())

    // UI Helpers (keep local)
    const [suggestedPos, setSuggestedPos] = useState<LocalPosition | null>(null)
    const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
    const [currentStt, setCurrentStt] = useState('')
    const [posSearchTerm, setPosSearchTerm] = useState('')
    const [showPosSuggestions, setShowPosSuggestions] = useState(false)

    // Re-calculate grouped data when zones/positions in context change
    useEffect(() => {
        if (zones.length > 0) {
            const { zones: gZones, virtualToRealMap: vMap } = groupWarehouseData(zones, localPositions as any)
            setGroupedZones(gZones)
            if (vMap) setVirtualToRealMap(vMap)
        }
    }, [zones, localPositions])

    async function downloadData() {
        if (!currentSystem?.code || !profile?.company_id) return
        setIsDownloading(true)
        try {
            const fetchAll = async (baseQuery: any) => {
                let all: any[] = []
                let from = 0
                const step = 1000
                while (true) {
                    const { data, error } = await baseQuery.range(from, from + step - 1)
                    if (error) throw error
                    if (!data || data.length === 0) break
                    all = [...all, ...data]
                    if (data.length < step) break
                    from += step
                }
                return all
            }

            // 1. Fetch ALL Position Status
            const posQuery = supabase.from('positions')
                .select('id, code, lot_id')
                .eq('system_type', currentSystem.code)
            
            const posData = await fetchAll(posQuery)
            const assignedLotIds = new Set(posData.map((p: any) => p.lot_id).filter(Boolean))

            // 2. Fetch Active Lots (Lobby Pool)
            const lotsQuery = supabase.from('lots')
                .select(`id, code, daily_seq, inbound_date, status, lot_items(products(name))`)
                .eq('system_code', currentSystem.code)
                .eq('status', 'active')
            
            const rawLots = await fetchAll(lotsQuery)
            const unassignedLots = rawLots.filter((l: any) => !assignedLotIds.has(l.id))

            const formattedLots: LocalLot[] = (unassignedLots || []).map((l: any) => ({
                id: l.id,
                code: l.code,
                daily_seq: l.daily_seq,
                inbound_date: l.inbound_date,
                product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || []
            }))

            // 3. Process Empty Positions
            const emptyPositions = posData.filter((p: any) => !p.lot_id)
            const zpQuery = supabase.from('zone_positions').select('position_id, zone_id')
            const zpData = await fetchAll(zpQuery)

            const zpMap = new Map<string, string[]>()
            zpData.forEach((item: any) => {
                const list = zpMap.get(item.position_id) || []
                list.push(item.zone_id)
                zpMap.set(item.position_id, list)
            })

            const formattedPositions: LocalPosition[] = (emptyPositions || []).map((p: any) => ({
                id: p.id,
                code: p.code,
                lot_id: p.lot_id,
                zone_ids: zpMap.get(p.id) || []
            }))

            const zonesQuery = (supabase.from('zones') as any).select('*').eq('system_type', currentSystem.code)
            const zonesData = await fetchAll(zonesQuery)

            const { positions: gPositions } = groupWarehouseData(zonesData || [], formattedPositions as any)

            updateData({
                localLots: formattedLots,
                localPositions: gPositions || formattedPositions,
                zones: zonesData || []
            })

            showToast(`Dữ liệu sảnh: ${formattedLots.length} món | Kệ: ${formattedPositions.length} trống`, 'success')
        } catch (e: any) {
            showToast('Lỗi tải dữ liệu: ' + e.message, 'error')
        } finally {
            setIsDownloading(false)
        }
    }

    const getDescendantZoneIds = (zoneId: string) => {
        const members = virtualToRealMap.get(zoneId) || [zoneId]
        const allRealIds = new Set<string>(members)
        let added = true
        while (added) {
            added = false
            for (const z of zones) {
                if (z.parent_id && allRealIds.has(z.parent_id) && !allRealIds.has(z.id)) {
                    allRealIds.add(z.id)
                    added = true
                }
            }
        }
        return Array.from(allRealIds)
    }

    function suggestNextPosition(extraExcludeIds?: Set<string>) {
        if (!effectiveZoneId) return
        setLoading(true)
        try {
            const descendantIds = getDescendantZoneIds(effectiveZoneId)
            const assignedPosIds = new Set(assignments.map((a: any) => a.positionId))
            skippedIds.forEach(id => assignedPosIds.add(id))
            if (extraExcludeIds) {
                extraExcludeIds.forEach(id => assignedPosIds.add(id))
            }

            const candidates = localPositions.filter(p => !assignedPosIds.has(p.id) && p.zone_ids.some((zId: string) => descendantIds.includes(zId)));
            const sortedCandidates = sortPositionsByBinPriority(candidates);
            const nextPos = sortedCandidates[0];

            if (nextPos) {
                setSuggestedPos(nextPos)
                setPosSearchTerm(nextPos.code)
                updateSelection({ step: 'working' })
                setCurrentStt('')
                // Focus back to input
                setTimeout(() => {
                    document.getElementById('mobile-stt-input')?.focus()
                    // Scroll to ensure the position area is visible
                    document.getElementById('pos-suggest-area')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 300);
            } else {
                showToast('Không còn vị trí trống trong khu vực này!', 'error')
                updateSelection({ step: 'setup' })
            }
        } finally { setLoading(false) }
    }

    async function handleConfirmStt() {
        if (!suggestedPos || !currentStt) return
        setLoading(true)
        try {
            const newAssignment: PendingAssignment = {
                lotId: null, // LUÔN GÁN MÙ
                lotCode: `STT #${currentStt} (Gán mù)`,
                productNames: ['Hàng chờ khớp'],
                positionId: suggestedPos.id,
                positionCode: suggestedPos.code,
                stt: currentStt,
                productionDate: new Date().toISOString().split('T')[0],
                timestamp: Date.now()
            }
            
            addAssignment(newAssignment)
            showToast(`Đã gán: #${newAssignment.stt} → ${suggestedPos.code}`, 'success')
            
            const currentPositionId = suggestedPos.id
            setCurrentStt('')
            setSuggestedPos(null)
            
            setTimeout(() => {
                suggestNextPosition(new Set([currentPositionId]))
            }, 100)
        } catch (e: any) {
            showToast('Lỗi khi lưu: ' + e.message, 'error')
        } finally { setLoading(false) }
    }

    async function syncAssignments() {
        if (assignments.length === 0 || !currentSystem?.code) return
        setIsSyncing(true)
        try {
            const toSync = assignments.map((ass: any) => ({
                position_id: ass.positionId,
                lot_stt: parseInt(ass.stt),
                production_date: ass.productionDate,
                system_code: currentSystem.code,
                created_by: profile?.id,
                status: 'pending'
            }))
            const { error } = await (supabase.from('pending_assignments') as any).insert(toSync)
            if (error) throw error
            showToast('Đồng bộ thành công!', 'success')
            clearAssignments()
            updateSelection({ step: 'setup' })
        } catch (e: any) {
            showToast('Lỗi đồng bộ: ' + e.message, 'error')
        } finally { setIsSyncing(false) }
    }

    const activeZones: Zone[] = groupedZones.length > 0 ? groupedZones : zones
    const warehouses: Zone[] = activeZones.filter(z => !z.parent_id)
    const aisles: Zone[] = selectedWarehouseId ? activeZones.filter(z => z.parent_id === selectedWarehouseId) : []
    const slots: Zone[] = selectedAisleId ? activeZones.filter(z => z.parent_id === selectedAisleId) : []
    const tiers: Zone[] = selectedSlotId ? activeZones.filter(z => z.parent_id === selectedSlotId) : []

    const emptyCounts = useMemo(() => {
        const counts = new Map<string, number>()
        if (localPositions.length === 0) return counts
        const assignedPosIds = new Set(assignments.map((a: any) => a.positionId))
        zones.forEach(z => counts.set(z.id, 0))
        const parentMap = new Map<string, string | null>()
        zones.forEach(z => parentMap.set(z.id, z.parent_id))
        
        localPositions.forEach((p: any) => {
            if (assignedPosIds.has(p.id)) return
            const processedInThisPath = new Set<string>()
            p.zone_ids.forEach((leafId: string) => {
                let currId: string | null = leafId
                while (currId) {
                    if (counts.has(currId) && !processedInThisPath.has(currId)) {
                        counts.set(currId, (counts.get(currId) || 0) + 1)
                        processedInThisPath.add(currId)
                    }
                    currId = parentMap.get(currId) || null
                }
            })
        })
        virtualToRealMap.forEach((realIds, vId) => {
            let total = 0
            realIds.forEach(rId => { total += counts.get(rId) || 0 })
            counts.set(vId, total)
        })
        return counts
    }, [zones, localPositions, assignments, virtualToRealMap])

    const getZoneName = (id: string | null) => activeZones.find(z => z.id === id)?.name || ''
    const effectiveZoneId = selectedTierId || selectedSlotId || selectedAisleId || selectedWarehouseId

    // Filter suggestions based on search term
    const posSuggestions = useMemo(() => {
        if (!posSearchTerm || !showPosSuggestions) return []
        const term = posSearchTerm.toUpperCase()
        const assignedPosIds = new Set(assignments.map((a: any) => a.positionId))
        return localPositions
            .filter(p => !assignedPosIds.has(p.id) && p.code.toUpperCase().includes(term))
            .slice(0, 5)
    }, [posSearchTerm, showPosSuggestions, localPositions, assignments])

    const breadcrumbs = [
        { label: 'Kho', id: selectedWarehouseId, setStep: () => updateSelection({ selectionStep: 'warehouse', aisleId: null, slotId: null, tierId: null }) },
        { label: 'Dãy', id: selectedAisleId, setStep: () => updateSelection({ selectionStep: 'aisle', slotId: null, tierId: null }) },
        { label: 'Ô', id: selectedSlotId, setStep: () => updateSelection({ selectionStep: 'slot', tierId: null }) },
        { label: 'Tầng', id: selectedTierId, setStep: () => updateSelection({ selectionStep: 'tier' }) }
    ].filter(b => b.id)

    return (
        <div className="mobile-animate-fade-in pb-20">
            <div className="mobile-header">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="mobile-header-brand">Sarita Workspace</div>
                        <div className="mobile-header-title">Gán Vị Trí</div>
                    </div>
                    <div className="flex gap-2">
                        <button className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl" onClick={downloadData} disabled={isDownloading}>
                            {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center bg-zinc-100 text-zinc-600 rounded-xl" onClick={() => { if(confirm('⚠️ Xóa sạch dữ liệu tạm trên máy?')) { clearAssignments(); updateSelection({ step: 'setup' }); } }}>
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <div className="px-2 py-1 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5 border border-zinc-200">
                        <Package size={11} className="text-zinc-400" />
                        {localLots.length} món tại sảnh
                    </div>
                    {localPositions.length > 0 && (
                        <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase border border-blue-200">
                            {localPositions.length - assignments.length} TRỐNG
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-6">
                {step === 'setup' ? (
                    <div className="mobile-card-premium p-6 space-y-6">
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-4">
                            <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-1">Chế độ gán nhanh</h3>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium leading-relaxed uppercase tracking-tight">
                                Quét vị trí & nhập số STT. Việc khớp sản phẩm sẽ được Admin xử lý sau.
                            </p>
                        </div>

                        {breadcrumbs.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                {breadcrumbs.map((b, i) => (
                                    <React.Fragment key={i}>
                                        <button onClick={b.setStep} className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30 shadow-sm">{b.label}: {getZoneName(b.id)}</button>
                                        {i < breadcrumbs.length - 1 && <span className="text-zinc-300">/</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}

                        <div className="space-y-6">
                            {selectionStep === 'warehouse' && (
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">1. Chọn Kho hàng</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {warehouses.filter(w => (emptyCounts.get(w.id) || 0) > 0).map(w => (
                                            <button key={w.id} onClick={() => updateSelection({ warehouseId: w.id, selectionStep: 'aisle' })} className={`p-4 rounded-2xl border-2 transition-all ${selectedWarehouseId === w.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-400'}`}>
                                                <div className="text-xs font-black uppercase">{w.name}</div>
                                                <div className="text-[9px] font-bold opacity-60">TRỐNG {emptyCounts.get(w.id) || 0}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectionStep === 'aisle' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">2. Chọn Dãy</label><button onClick={() => updateSelection({ selectionStep: 'warehouse' })} className="text-[9px] font-bold text-zinc-400 uppercase">&larr; Đổi Kho</button></div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {aisles.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => (
                                            <button key={z.id} onClick={() => updateSelection({ aisleId: z.id, selectionStep: 'slot' })} className={`flex justify-between p-4 rounded-2xl border-2 ${selectedAisleId === z.id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-500'}`}>
                                                <span className="font-black text-sm uppercase">{z.name}</span>
                                                <span className="text-[10px] font-bold opacity-60">TRỐNG {emptyCounts.get(z.id) || 0}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectionStep === 'slot' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">3. Chọn Ô</label><button onClick={() => updateSelection({ selectionStep: 'aisle' })} className="text-[9px] font-bold text-zinc-400 uppercase">&larr; Đổi Dãy</button></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {slots.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => (
                                            <button key={z.id} onClick={() => {
                                                updateSelection({ slotId: z.id, tierId: null })
                                                if (activeZones.some(az => az.parent_id === z.id)) { updateSelection({ selectionStep: 'tier' }) }
                                            }} className={`p-4 rounded-2xl border-2 transition-all ${selectedSlotId === z.id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-400'}`}>
                                                <div className="font-black uppercase">{z.name}</div>
                                                <div className="text-[9px] font-bold opacity-60">TRỐNG {emptyCounts.get(z.id) || 0}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectionStep === 'tier' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">4. Chọn Tầng</label><button onClick={() => updateSelection({ selectionStep: 'slot' })} className="text-[9px] font-bold text-zinc-400 uppercase">&larr; Đổi Ô</button></div>
                                    <div className="flex flex-wrap gap-2">
                                        {tiers.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => (
                                            <button key={z.id} onClick={() => updateSelection({ tierId: z.id })} className={`px-5 py-3 rounded-2xl text-[13px] font-black border-2 transition-all ${selectedTierId === z.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-400'}`}>
                                                <div className="flex items-center gap-2 uppercase">{z.name} {selectedTierId === z.id && <CheckCircle2 size={16} />}</div>
                                                <span className="text-[9px] font-bold opacity-60">TRỐNG {emptyCounts.get(z.id) || 0}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => suggestNextPosition()}
                                disabled={!effectiveZoneId || loading || isDownloading}
                                className={`w-full py-5 rounded-3xl flex items-center justify-center gap-3 text-sm font-black transition-all shadow-xl ${!effectiveZoneId || loading || isDownloading ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-700' : 'bg-zinc-900 dark:bg-emerald-600 text-white hover:bg-zinc-800 active:scale-95'}`}
                            >
                                <PlayCircle size={20} className={!effectiveZoneId || loading ? 'text-zinc-300' : 'text-emerald-400 dark:text-white'} />
                                <span>BẮT ĐẦU GÁN VỊ TRÍ</span>
                            </button>
                            {!effectiveZoneId && <p className="text-[9px] text-zinc-400 text-center mt-3 font-medium uppercase tracking-tight">Vui lòng chọn khu vực</p>}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="mobile-card-premium p-6 border-emerald-500 animate-in zoom-in duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider">VỊ TRÍ ĐẶT HÀNG</div>
                                <button onClick={() => updateSelection({ step: 'setup' })} className="p-1 text-zinc-300 dark:text-zinc-700"><X size={24} /></button>
                            </div>
                            <div className="text-center py-6" id="pos-suggest-area">
                                <div className="mx-auto w-20 h-20 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-[28px] flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-900/20"><MapPin size={40} /></div>
                                <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-[0.2em] mb-3">VỊ TRÍ ĐẶT HÀNG</div>
                                
                                {/* Smart Position Input with Autocomplete */}
                                <div className="relative max-w-[280px] mx-auto group">
                                    <input
                                        type="text"
                                        value={posSearchTerm}
                                        onChange={(e) => {
                                            setPosSearchTerm(e.target.value.toUpperCase())
                                            setShowPosSuggestions(true)
                                        }}
                                        onFocus={() => setShowPosSuggestions(true)}
                                        className="w-full bg-transparent text-5xl font-black text-zinc-900 dark:text-white tracking-tighter text-center border-none outline-none focus:ring-0 placeholder:text-zinc-200"
                                        placeholder="..."
                                    />
                                    <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">Nhấn để sửa mã kệ</div>

                                    {/* Suggestions Dropdown */}
                                    {showPosSuggestions && posSuggestions.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
                                            {posSuggestions.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSuggestedPos(p)
                                                        setPosSearchTerm(p.code)
                                                        setShowPosSuggestions(false)
                                                    }}
                                                    className="w-full px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-b border-zinc-50 dark:border-zinc-800 last:border-0 flex justify-between items-center"
                                                >
                                                    <span className="font-black text-sm text-zinc-900 dark:text-zinc-100">{p.code}</span>
                                                    <span className="text-[9px] font-bold text-emerald-600 uppercase">Trống</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                {showPosSuggestions && (
                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowPosSuggestions(false)} />
                                )}
                                
                                {/* Fast Mode Info */}
                                <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-emerald-50 dark:bg-emerald-900/5 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/10 max-w-[240px] mx-auto">
                                        <div className="text-[10px] font-black text-emerald-600 uppercase mb-1">Chế độ Gán mù</div>
                                        <div className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 truncate">Hàng sẽ được khớp tại máy Admin</div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => {
                                        if (suggestedPos) {
                                            setSkippedIds(prev => new Set(prev).add(suggestedPos.id));
                                            setSuggestedPos(null);
                                            setPosSearchTerm('');
                                            setTimeout(() => suggestNextPosition(new Set([suggestedPos.id])), 10);
                                        }
                                    }}
                                    disabled={loading}
                                    className="mt-6 text-zinc-400 dark:text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                                >
                                    <RotateCcw size={12} /> Bỏ qua & gợi ý khác
                                </button>
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
                                        onChange={e => setCurrentStt(e.target.value)} 
                                        placeholder="Số STT..." 
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 focus:border-emerald-500 rounded-2xl py-6 pl-14 pr-6 text-3xl font-black text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300" 
                                        autoFocus 
                                        id="mobile-stt-input"
                                        onKeyDown={(e) => e.key === 'Enter' && currentStt && handleConfirmStt()}
                                    />
                                </div>
                                <button onClick={() => handleConfirmStt()} disabled={!currentStt || loading} className={`w-full py-6 rounded-2xl flex items-center justify-center gap-3 text-lg font-black transition-all ${!currentStt || loading ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-700' : 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 active:scale-95'}`}>
                                    {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                                    XÁC NHẬN GÁN
                                </button>
                            </div>
                        </div>

                        {/* Recent History - 3 mục vừa gán xong */}
                        {assignments.length > 0 && (
                            <div className="space-y-3 animate-in fade-in duration-500">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Vừa gán xong ({assignments.length})</h4>
                                <div className="space-y-2">
                                    {assignments.slice(0, 3).map((ass: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black shrink-0">#{ass.stt}</div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 leading-none mb-1 truncate">{ass.lotCode}</div>
                                                    <div className="text-[9px] text-zinc-500 font-bold uppercase flex items-center gap-1.5 tracking-tight"><MapPin size={10} className="text-red-500" /> {ass.positionCode}</div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => { if(confirm('Xóa lần gán này?')) removeAssignment(ass.positionId); }}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-200 dark:text-zinc-800 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {assignments.length > 3 && (
                                        <p className="text-center text-[9px] font-black text-zinc-400 uppercase py-2">... và {assignments.length - 3} mục khác bên dưới ...</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Full History Section */}
                {assignments.length > 0 && (
                    <div className="mt-8 space-y-4 pb-20 border-t border-zinc-100 dark:border-zinc-800 pt-8 px-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Chờ đồng bộ ({assignments.length})</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={syncAssignments} 
                                disabled={isSyncing} 
                                className="flex flex-col items-center justify-center p-6 bg-emerald-600 text-white rounded-[32px] shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 transition-all group"
                            >
                                {isSyncing ? <Loader2 size={32} className="animate-spin mb-3" /> : <Send size={32} className="mb-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                                <div className="text-xs font-black uppercase tracking-widest">Đồng bộ</div>
                            </button>
                            <button 
                                onClick={() => { if(confirm('⚠️ Xóa toàn bộ danh sách để làm lại?')) clearAssignments(); }}
                                className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 text-zinc-400 hover:text-red-500 rounded-[32px] transition-all active:scale-95"
                            >
                                <Trash2 size={32} className="mb-3" />
                                <div className="text-xs font-black uppercase tracking-widest">Xóa sạch</div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
