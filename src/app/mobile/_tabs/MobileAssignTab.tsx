'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { CheckCircle2, MapPin, Hash, PlayCircle, Zap, X, Loader2, Download, RotateCcw, Send, Package, Calendar, Trash2 } from 'lucide-react'
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
    const [matchingLots, setMatchingLots] = useState<LocalLot[]>([])
    const [showMatchPicker, setShowMatchPicker] = useState(false)
    const [productionDate, setProductionDate] = useState(() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    })

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

            // 1. Fetch ALL Position Status (to find assigned lot IDs)
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
            
            // Only lots NOT in positions are considered "in lobby"
            const unassignedLots = rawLots.filter((l: any) => !assignedLotIds.has(l.id))

            const formattedLots: LocalLot[] = (unassignedLots || []).map((l: any) => ({
                id: l.id,
                code: l.code,
                daily_seq: l.daily_seq,
                inbound_date: l.inbound_date,
                product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || []
            }))

            // 3. Process Empty Positions for suggestions
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

            // Calculate Grouped Data (Gom ô)
            const { positions: gPositions } = groupWarehouseData(zonesData || [], formattedPositions as any)

            updateData({
                localLots: formattedLots,
                localPositions: gPositions || formattedPositions,
                zones: zonesData || []
            })

            showToast(`Sảnh: ${formattedLots.length} món | Kệ: ${formattedPositions.length} trống`, 'success')
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
            
            // Exclude skipped IDs
            skippedIds.forEach(id => assignedPosIds.add(id))
            
            if (extraExcludeIds) {
                extraExcludeIds.forEach(id => assignedPosIds.add(id))
            }

            const candidates = localPositions.filter(p => !assignedPosIds.has(p.id) && p.zone_ids.some((zId: string) => descendantIds.includes(zId)));
            const sortedCandidates = sortPositionsByBinPriority(candidates);
            const nextPos = sortedCandidates[0];

            if (nextPos) {
                setSuggestedPos(nextPos)
                updateSelection({ step: 'working' })
                setCurrentStt('')
            } else {
                showToast('Không còn vị trí trống trong khu vực này!', 'error')
                updateSelection({ step: 'setup' })
            }
        } finally { setLoading(false) }
    }

    async function handleConfirmStt(selectedLotFromPool?: LocalLot) {
        if (!suggestedPos || (!currentStt && !selectedLotFromPool)) return
        setLoading(true)
        try {
            const sttNum = parseInt(currentStt)
            
            // 1. Find matching lot
            let targetLot = selectedLotFromPool;
            if (!targetLot) {
                const matches = localLots.filter((l: any) => l.daily_seq === sttNum)
                if (matches.length > 1) {
                    setMatchingLots(matches)
                    setShowMatchPicker(true)
                    setLoading(false)
                    return
                }
                targetLot = matches[0]
            }

            const finalInboundDate = targetLot?.inbound_date || new Date().toISOString().split('T')[0]

            const newAssignment: PendingAssignment = {
                lotId: targetLot?.id || null,
                lotCode: targetLot?.code || `STT #${currentStt} (Tự nhập)`,
                productNames: targetLot?.product_names || ['Hàng chờ khớp'],
                positionId: suggestedPos.id,
                positionCode: suggestedPos.code,
                stt: currentStt || (targetLot?.daily_seq?.toString() || ''),
                productionDate: finalInboundDate,
                timestamp: Date.now()
            }
            
            // 2. Save assignment to global context
            addAssignment(newAssignment)
            showToast(`Đã gán: #${newAssignment.stt} (${finalInboundDate}) → ${suggestedPos.code}`, 'success')
            
            // 3. Prepare for next 
            const currentPositionId = suggestedPos.id
            setCurrentStt('')
            setSuggestedPos(null)
            setShowMatchPicker(false)
            setMatchingLots([])
            
            setTimeout(() => {
                suggestNextPosition(new Set([currentPositionId]))
            }, 100)

        } catch (e: any) {
            console.error('Lỗi khi lưu gán vị trí:', e)
            showToast('Lỗi khi lưu: ' + e.message, 'error')
            updateSelection({ step: 'setup' })
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
                        <button className="w-10 h-10 flex items-center justify-center bg-zinc-100 text-zinc-600 rounded-xl" onClick={() => { clearAssignments(); updateSelection({ step: 'setup' }); }}>
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
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                            <h3 className="text-xs font-black text-emerald-700 uppercase mb-1">Quy trình thông minh</h3>
                            <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                                Hệ thống sẽ tự động khớp STT từ "Bể hàng tại sảnh". Bạn không cần chọn ngày sản xuất thủ công.
                            </p>
                        </div>

                        {breadcrumbs.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                                {breadcrumbs.map((b, i) => (
                                    <React.Fragment key={i}>
                                        <button onClick={b.setStep} className="text-[10px] font-black text-emerald-600 uppercase bg-white px-2 py-1 rounded-lg border border-emerald-100">{b.label}: {getZoneName(b.id)}</button>
                                        {i < breadcrumbs.length - 1 && <span className="text-zinc-300">/</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}

                        <div className="space-y-6">
                            {selectionStep === 'warehouse' && (
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">1. Chọn Kho hàng</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {warehouses.filter(w => (emptyCounts.get(w.id) || 0) > 0).map(w => (
                                            <button key={w.id} onClick={() => updateSelection({ warehouseId: w.id, selectionStep: 'aisle' })} className={`p-4 rounded-2xl border-2 transition-all ${selectedWarehouseId === w.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-zinc-100 text-zinc-400'}`}>
                                                <div className="text-xs font-black">{w.name}</div>
                                                <div className="text-[9px] font-bold opacity-60">Trống: {emptyCounts.get(w.id) || 0}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectionStep === 'aisle' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-emerald-600 uppercase">2. Chọn Dãy</label><button onClick={() => updateSelection({ selectionStep: 'warehouse' })} className="text-[9px] font-bold text-zinc-400 uppercase">&larr; Đổi Kho</button></div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {aisles.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => (
                                            <button key={z.id} onClick={() => updateSelection({ aisleId: z.id, selectionStep: 'slot' })} className={`flex justify-between p-4 rounded-2xl border-2 ${selectedAisleId === z.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-zinc-100 text-zinc-500'}`}>
                                                <span className="font-black text-sm">{z.name}</span>
                                                <span className="text-[10px] font-bold opacity-60">TRỐNG {emptyCounts.get(z.id) || 0}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectionStep === 'slot' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-emerald-600 uppercase">3. Chọn Ô</label><button onClick={() => updateSelection({ selectionStep: 'aisle' })} className="text-[9px] font-bold text-zinc-400 uppercase">&larr; Đổi Dãy</button></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {slots.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => (
                                            <button key={z.id} onClick={() => {
                                                updateSelection({ slotId: z.id, tierId: null })
                                                if (activeZones.some(az => az.parent_id === z.id)) { updateSelection({ selectionStep: 'tier' }) }
                                            }} className={`p-4 rounded-2xl border-2 transition-all ${selectedSlotId === z.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' : 'bg-white border-zinc-100 text-zinc-400'}`}>
                                                <div className="font-black">{z.name}</div>
                                                <div className="text-[9px] font-bold opacity-60">TRỐNG {emptyCounts.get(z.id) || 0}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectionStep === 'tier' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-emerald-600 uppercase">4. Chọn Tầng</label><button onClick={() => updateSelection({ selectionStep: 'slot' })} className="text-[9px] font-bold text-zinc-400 uppercase">&larr; Đổi Ô</button></div>
                                    <div className="flex flex-wrap gap-2">
                                        {tiers.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => (
                                            <button key={z.id} onClick={() => updateSelection({ tierId: z.id })} className={`px-5 py-3 rounded-2xl text-[13px] font-black border-2 transition-all ${selectedTierId === z.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-zinc-100 text-zinc-400'}`}>
                                                <div className="flex items-center gap-2">{z.name} {selectedTierId === z.id && <CheckCircle2 size={16} />}</div>
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
                                className={`w-full py-5 rounded-3xl flex items-center justify-center gap-3 text-sm font-black transition-all shadow-xl ${!effectiveZoneId || loading || isDownloading ? 'bg-zinc-100 text-zinc-300' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
                            >
                                <PlayCircle size={20} className={!effectiveZoneId || loading ? 'text-zinc-300' : 'text-emerald-400'} />
                                <span>BẮT ĐẦU GÁN VỊ TRÍ</span>
                            </button>
                            {!effectiveZoneId && <p className="text-[9px] text-zinc-400 text-center mt-3 font-medium uppercase tracking-tight">Vui lòng chọn khu vực</p>}
                        </div>
                    </div>
                ) : (
                    <div className="mobile-card-premium p-6 border-emerald-500 animate-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">VỊ TRÍ TIẾP THEO</div>
                            <button onClick={() => updateSelection({ step: 'setup' })} className="p-1 text-zinc-400"><X size={20} /></button>
                        </div>
                        <div className="text-center py-6">
                            <div className="mx-auto w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center mb-4 border border-emerald-100"><MapPin size={48} /></div>
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">HÃY ĐẶT HÀNG VÀO</div>
                            <div className="text-5xl font-black text-zinc-900 tracking-tighter">{suggestedPos?.code}</div>
                            
                            {/* Short Lot Summary if STT entered */}
                            {currentStt && !showMatchPicker && (
                                <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {(() => {
                                        const match = localLots.find(l => l.daily_seq === parseInt(currentStt))
                                        if (!match) return null
                                        return (
                                            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                                                <div className="text-[9px] font-black text-emerald-600 uppercase mb-1">Khớp được lô hàng</div>
                                                <div className="text-[11px] font-black text-zinc-900 truncate">{match.product_names.join(', ')}</div>
                                                <div className="text-[9px] text-zinc-400 font-bold uppercase mt-1">Ngày: {new Date(match.inbound_date).toLocaleDateString('vi-VN')}</div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}

                            <button 
                                onClick={() => {
                                    if (suggestedPos) {
                                        setSkippedIds(prev => new Set(prev).add(suggestedPos.id));
                                        setSuggestedPos(null);
                                        setTimeout(() => suggestNextPosition(new Set([suggestedPos.id])), 10);
                                    }
                                }}
                                disabled={loading}
                                className="mt-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:text-emerald-600 transition-colors flex items-center justify-center gap-1 mx-auto"
                            >
                                <RotateCcw size={10} /> Bỏ qua & gợi ý vị trí khác &rarr;
                            </button>
                        </div>
                        <div className="h-px bg-zinc-100 my-6" />
                        <div className="space-y-4">
                            <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest text-center block">NHẬP STT CỦA LÔ HÀNG</label>
                            <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={24} />
                                <input type="number" pattern="[0-9]*" inputMode="numeric" value={currentStt} onChange={e => setCurrentStt(e.target.value)} placeholder="STT..." className="w-full bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 focus:border-emerald-500 rounded-2xl py-5 pl-14 pr-6 text-2xl font-black text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-400" autoFocus />
                            </div>
                            <button onClick={() => handleConfirmStt()} disabled={!currentStt || loading} className={`w-full py-5 rounded-2xl flex items-center justify-center gap-2 text-lg font-black transition-all ${!currentStt || loading ? 'bg-zinc-100 text-zinc-400' : 'bg-emerald-600 text-white shadow-lg active:scale-95'}`}>
                                {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                                XÁC NHẬN
                            </button>
                        </div>
                    </div>
                )}

                {/* Match Picker Modal */}
                {showMatchPicker && (
                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 min-h-screen">
                        <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden animate-in slide-in-from-bottom duration-300">
                            <div className="p-6 border-b border-zinc-100">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tight">Trùng STT #{currentStt}</h3>
                                    <button onClick={() => setShowMatchPicker(false)} className="p-2 text-zinc-400 hover:text-zinc-900"><X size={24} /></button>
                                </div>
                                <p className="text-xs text-zinc-500 font-medium leading-relaxed">Phát hiện nhiều lô hàng cùng số STT này tại sảnh. Vui lòng chọn đúng lô bạn đang cầm:</p>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                                {matchingLots.map((l) => (
                                    <button 
                                        key={l.id} 
                                        onClick={() => handleConfirmStt(l)}
                                        className="w-full text-left p-4 bg-zinc-50 rounded-2xl border-2 border-transparent hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="px-2 py-0.5 bg-white border border-zinc-200 rounded text-[9px] font-black text-zinc-400">NGÀY: {new Date(l.inbound_date).toLocaleDateString('vi-VN')}</div>
                                            <div className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"><CheckCircle2 size={20} /></div>
                                        </div>
                                        <div className="text-xs font-black text-zinc-900 leading-snug">{l.product_names.join(', ')}</div>
                                        <div className="text-[10px] text-zinc-400 font-bold mt-1">Mã: {l.code}</div>
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 bg-zinc-50">
                                <button onClick={() => setShowMatchPicker(false)} className="w-full py-4 text-xs font-black text-zinc-400 uppercase tracking-widest">Đóng</button>
                            </div>
                        </div>
                    </div>
                )}

                {assignments.length > 0 && (
                    <div className="mt-8 space-y-3 pb-10">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">ĐÃ GHÉP TRONG PHIÊN ({assignments.length})</h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => { if(confirm('Xóa sạch danh sách trong phiên này?')) clearAssignments(); }}
                                    className="px-3 py-1.5 bg-zinc-100 rounded-lg text-[10px] font-black text-zinc-500 uppercase tracking-widest active:scale-95"
                                >
                                    Xóa hết
                                </button>
                                <button onClick={syncAssignments} disabled={isSyncing} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg text-[10px] font-black text-orange-600 uppercase tracking-widest active:scale-95 disabled:opacity-50">
                                    {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Đồng bộ {assignments.length} mục
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {assignments.map((ass: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-900 font-black shrink-0 border border-zinc-100">#{ass.stt}</div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-zinc-900 leading-none mb-1 truncate">{ass.lotCode}</div>
                                            <div className="text-[9px] text-zinc-500 font-bold uppercase flex items-center gap-1"><MapPin size={10} /> {ass.positionCode}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-[10px] font-bold text-zinc-300">{new Date(ass.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if(confirm('Xóa lần gán này?')) removeAssignment(ass.positionId);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
