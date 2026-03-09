'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Loader2, FileText, ChevronRight, Camera, Keyboard, RotateCcw, ArrowLeft, CheckCircle2, ArrowDownToLine, QrCode } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { SelectHallModal } from '@/components/warehouse/map/SelectHallModal'
import { format } from 'date-fns'

interface ExportTask {
    id: string
    code: string
    status: string
    created_at: string
    created_by_name?: string
    items_count?: number
    notes?: string | null
}

interface TaskItem {
    id: string
    lot_id: string | null
    lot_code: string
    position_id: string | null
    position_name: string
    current_position_name: string
    product_name: string
    sku: string
    quantity: number
    unit: string
    status: string
    display_status: 'Pending' | 'Moved to Hall' | 'Changed Position' | 'Exported'
    scanned?: boolean
}

export default function MobileWorkTab() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [step, setStep] = useState<'select' | 'scan'>('select')
    const [useCamera, setUseCamera] = useState(true)
    const [manualCode, setManualCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false)

    const [tasks, setTasks] = useState<ExportTask[]>([])
    const [selectedTask, setSelectedTask] = useState<ExportTask | null>(null)
    const [taskItems, setTaskItems] = useState<TaskItem[]>([])
    const [zones, setZones] = useState<any[]>([])

    const [isSelectHallOpen, setIsSelectHallOpen] = useState(false)
    const [pendingLotId, setPendingLotId] = useState<string | null>(null)
    const [pendingPositionId, setPendingPositionId] = useState<string | null>(null)
    const [pendingItemId, setPendingItemId] = useState<string | null>(null)

    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { fetchTasks(); fetchZones() }, [])
    useEffect(() => {
        if (!useCamera && step === 'scan' && inputRef.current) inputRef.current.focus()
    }, [useCamera, step])

    async function fetchZones() {
        const { data } = await supabase.from('zones').select('*')
        if (data) setZones(data)
    }

    async function fetchTasks() {
        setLoading(true)
        try {
            const { data: tasksData, error } = await supabase
                .from('export_tasks')
                .select('*, export_task_items(count)')
                .in('status', ['Pending', 'In Progress'])
                .order('created_at', { ascending: false })
            if (error) throw error

            const userIds = Array.from(new Set((tasksData || []).map(t => t.created_by).filter(Boolean)))
            let userMap: Record<string, string> = {}
            if (userIds.length > 0) {
                const { data: usersData } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds as string[])
                if (usersData) usersData.forEach((u: any) => { userMap[u.id] = u.full_name })
            }

            setTasks((tasksData || []).map(t => ({
                id: t.id, code: t.code, status: t.status, created_at: t.created_at, notes: t.notes,
                created_by_name: t.created_by ? (userMap[t.created_by] || 'Unknown') : 'Unknown',
                items_count: t.export_task_items?.[0]?.count || 0
            })))
        } catch (error: any) {
            showToast('Lỗi tải danh sách: ' + error.message, 'error')
        } finally { setLoading(false) }
    }

    async function fetchTaskItems(taskId: string, silent = false) {
        if (!silent) setLoading(true)
        try {
            const { data, error } = await supabase
                .from('export_task_items')
                .select(`id, quantity, unit, status, lot_id, position_id,
          lots (id, code, positions!positions_lot_id_fkey (code, is_hall:zone_positions(zone_id))),
          positions (code), products (name, sku)`)
                .eq('task_id', taskId)
            if (error) throw error

            let currentZones = zones
            if (currentZones.length === 0) {
                const { data: zData } = await supabase.from('zones').select('*')
                if (zData) { currentZones = zData; setZones(zData) }
            }

            const items: TaskItem[] = (data || []).map((item: any) => {
                const originalPosCode = item.positions?.code || 'N/A'
                let currentPosCode = originalPosCode
                let isHall = false

                if (item.lots?.positions?.length > 0) {
                    currentPosCode = item.lots.positions[0].code
                    const isHallRelation = item.lots.positions[0].is_hall
                    const leafZoneId = Array.isArray(isHallRelation) ? isHallRelation[0]?.zone_id : isHallRelation?.zone_id
                    if (leafZoneId) {
                        let currId = leafZoneId
                        while (currId) {
                            const z = currentZones.find((x: any) => x.id === currId)
                            if (!z) break
                            if (z.is_hall) { isHall = true; break }
                            currId = z.parent_id
                        }
                    }
                }

                let displayStatus: TaskItem['display_status'] = item.status === 'Exported' ? 'Exported' : 'Pending'
                if (displayStatus === 'Pending' && originalPosCode !== currentPosCode) {
                    displayStatus = isHall ? 'Moved to Hall' : 'Changed Position'
                }

                return {
                    id: item.id, lot_id: item.lots?.id || item.lot_id, lot_code: item.lots?.code || 'N/A',
                    position_id: item.position_id, position_name: originalPosCode, current_position_name: currentPosCode,
                    product_name: item.products?.name || 'N/A', sku: item.products?.sku || 'N/A',
                    quantity: item.quantity, unit: item.unit || '', status: item.status || 'Pending',
                    display_status: displayStatus,
                    scanned: displayStatus === 'Moved to Hall' || displayStatus === 'Changed Position' || displayStatus === 'Exported'
                }
            }).sort((a, b) => a.position_name.localeCompare(b.position_name))

            setTaskItems(items)
        } catch (error: any) {
            showToast('Lỗi tải chi tiết: ' + error.message, 'error')
        } finally { if (!silent) setLoading(false) }
    }

    async function selectTask(task: ExportTask) {
        setSelectedTask(task)
        await fetchTaskItems(task.id)
        setStep('scan')
    }

    function handleReset() {
        setStep('select'); setSelectedTask(null); setTaskItems([]); setManualCode('')
        setPaused(false); setPendingLotId(null); setPendingPositionId(null); setPendingItemId(null)
    }

    async function handleScanResult(rawCode: string, isManual = false) {
        if (loading || (!isManual && paused) || !rawCode) return
        let code = rawCode.trim()
        try { if (code.startsWith('http')) { const url = new URL(code); const parts = url.pathname.split('/'); code = parts[parts.length - 1] || code } } catch { }
        code = code.toUpperCase()
        setPaused(true); setManualCode('')
        await processLotScan(code)
    }

    async function processLotScan(code: string) {
        if (!profile?.company_id) return
        setLoading(true)
        try {
            const matchingItem = taskItems.find(item => item.lot_code === code)
            if (!matchingItem) { showToast(`LOT "${code}" không thuộc lệnh xuất "${selectedTask?.code}"`, 'error'); setPaused(false); setLoading(false); return }
            if (!matchingItem.lot_id) { showToast(`LOT "${code}" không có dữ liệu liên kết`, 'error'); setPaused(false); setLoading(false); return }
            setPendingLotId(matchingItem.lot_id); setPendingPositionId(matchingItem.position_id)
            setPendingItemId(matchingItem.id); setIsSelectHallOpen(true)
        } catch (e: any) { showToast('Lỗi: ' + e.message, 'error'); setPaused(false) }
        finally { setLoading(false) }
    }

    async function handleMoveToHall(hallId: string) {
        setIsSelectHallOpen(false)
        if (!pendingLotId) { setPaused(false); return }
        setLoading(true)
        try {
            const targetZoneIds = new Set<string>([hallId])
            let added = true
            while (added) { added = false; for (const z of zones) { if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) { targetZoneIds.add(z.id); added = true } } }

            const { data: availablePositions, error: availError } = await (supabase
                .from('zone_positions').select('position_id, zone_id, positions!inner(id, lot_id)')
                .is('positions.lot_id', null).in('zone_id', Array.from(targetZoneIds)).limit(1) as any)

            if (availError || !availablePositions?.length) { showToast('Không còn vị trí trống trong Sảnh!', 'error'); setLoading(false); setPaused(false); return }

            const targetPositionId = availablePositions[0].position_id as string
            if (pendingPositionId) { await supabase.from('positions').update({ lot_id: null } as any).eq('id', pendingPositionId) }
            else { await supabase.from('positions').update({ lot_id: null } as any).eq('lot_id', pendingLotId) }

            const { error: updateError } = await supabase.from('positions').update({ lot_id: pendingLotId } as any).eq('id', targetPositionId)
            if (updateError) throw updateError

            const matchingItem = taskItems.find(i => i.id === pendingItemId)
            showToast(`Đã hạ sảnh LOT "${matchingItem?.lot_code}" thành công!`, 'success')
            if (selectedTask) await fetchTaskItems(selectedTask.id, true)
        } catch (error: any) { showToast('Lỗi hạ sảnh: ' + error.message, 'error') }
        finally { setLoading(false); setPaused(false); setPendingLotId(null); setPendingPositionId(null); setPendingItemId(null) }
    }

    function handleHallModalClose() {
        setIsSelectHallOpen(false); setPaused(false)
        setPendingLotId(null); setPendingPositionId(null); setPendingItemId(null)
    }

    const scannedCount = taskItems.filter(i => i.scanned).length
    const totalCount = taskItems.length

    // ============ SELECT TASK VIEW ============
    if (step === 'select') {
        return (
            <div className="mobile-animate-fade-in">
                <div className="mobile-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="mobile-header-brand">Sarita Workspace</div>
                            <div className="mobile-header-title">Công Việc</div>
                            <div className="mobile-header-subtitle">{currentSystem?.name || ''}</div>
                        </div>
                        <button className="mobile-btn mobile-btn--primary" onClick={fetchTasks} disabled={loading}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Tải lại
                        </button>
                    </div>
                </div>

                <div style={{ padding: '20px' }}>
                    <div className="mobile-section-label">Lệnh xuất kho ({tasks.length})</div>

                    {loading && tasks.length === 0 ? (
                        <div className="mobile-loading">
                            <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
                            <span style={{ color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>Đang tải...</span>
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="mobile-empty">
                            <div className="mobile-empty-icon"><FileText size={36} /></div>
                            <p style={{ color: '#71717a', fontWeight: 700, fontSize: 16 }}>Không có lệnh mới</p>
                            <p style={{ color: '#a1a1aa', fontSize: 13, marginTop: 6 }}>Nhấn "Tải lại" để cập nhật</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {tasks.map(task => (
                                <button key={task.id} onClick={() => selectTask(task)} className="mobile-card" style={{ padding: 20, textAlign: 'left', border: '1px solid #f4f4f5', cursor: 'pointer', width: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ width: 52, height: 52, borderRadius: 18, background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FileText size={24} color="white" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 18, fontWeight: 900, color: '#18181b', letterSpacing: -0.5 }}>{task.code}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a1a1aa', marginTop: 3 }}>
                                                    <span>{task.created_by_name}</span>
                                                    <span>•</span>
                                                    <span style={{ fontFamily: 'monospace' }}>{format(new Date(task.created_at), 'HH:mm dd/MM')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ background: '#eff6ff', padding: '6px 12px', borderRadius: 999, border: '1px solid #dbeafe' }}>
                                                <span style={{ fontSize: 13, fontWeight: 900, color: '#2563eb' }}>{task.items_count} LOT</span>
                                            </div>
                                            <ChevronRight size={20} color="#d4d4d8" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ============ SCAN VIEW ============
    return (
        <div className="mobile-animate-fade-in">
            <div className="mobile-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={handleReset} style={{ padding: 8, borderRadius: 999, background: 'none', border: 'none', cursor: 'pointer', color: '#71717a' }}>
                            <ArrowLeft size={22} />
                        </button>
                        <div>
                            <div className="mobile-header-brand">Sarita Workspace</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#18181b' }}>Công Việc</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ background: '#f4f4f5', padding: '8px 14px', borderRadius: 14, border: '1px solid #e4e4e7' }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: '#18181b' }}>{selectedTask?.code}</span>
                        </div>
                        <button className="mobile-btn mobile-btn--ghost" onClick={() => setUseCamera(!useCamera)}>
                            {useCamera ? <Keyboard size={16} /> : <Camera size={16} />}
                        </button>
                        <button className="mobile-btn mobile-btn--ghost" onClick={() => { setPaused(false); setManualCode('') }}>
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* Progress */}
                <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa' }}>Tiến độ quét</span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: '#2563eb' }}>{scannedCount}/{totalCount}</span>
                    </div>
                    <div className="mobile-progress">
                        <div className="mobile-progress-fill" style={{ width: totalCount > 0 ? `${(scannedCount / totalCount) * 100}%` : '0%', background: 'linear-gradient(90deg, #2563eb, #3b82f6)' }} />
                    </div>
                </div>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Camera */}
                {useCamera && (
                    <div className="mobile-scanner" style={{ marginBottom: 20 }}>
                        <Scanner
                            onScan={(result) => { if (result?.length > 0) handleScanResult(result[0].rawValue) }}
                            styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' as any } }}
                            components={{ finder: false }}
                            constraints={{ facingMode: 'environment' }}
                        />
                        <div className="mobile-scanner-corner mobile-scanner-corner--tl" />
                        <div className="mobile-scanner-corner mobile-scanner-corner--tr" />
                        <div className="mobile-scanner-corner mobile-scanner-corner--bl" />
                        <div className="mobile-scanner-corner mobile-scanner-corner--br" />
                        {loading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
                                <Loader2 size={36} className="animate-spin" style={{ color: '#2563eb' }} />
                            </div>
                        )}
                    </div>
                )}

                {/* Manual Input */}
                {!useCamera && (
                    <div style={{ width: '100%', maxWidth: 380, marginBottom: 20 }} className="mobile-animate-slide-up">
                        <div className="mobile-card" style={{ padding: 24 }}>
                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 18, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#2563eb' }}>
                                    <QrCode size={28} />
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: '#18181b' }}>Nhập mã LOT</div>
                            </div>
                            <form onSubmit={e => { e.preventDefault(); handleScanResult(manualCode, true) }}>
                                <input ref={inputRef} type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
                                    className="mobile-input" style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}
                                    placeholder="VÍ DỤ: LOT23..." />
                                <button type="submit" disabled={loading || !manualCode} className="mobile-btn mobile-btn--primary mobile-btn--lg">
                                    {loading ? <Loader2 size={22} className="animate-spin" /> : 'Xác nhận'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* LOT List */}
                <div style={{ width: '100%' }}>
                    <div className="mobile-section-label">Danh sách LOT ({totalCount})</div>
                    {taskItems.map(item => {
                        const isPending = item.display_status === 'Pending'
                        const isExported = item.display_status === 'Exported'
                        const isHall = item.display_status === 'Moved to Hall'
                        const isChanged = item.display_status === 'Changed Position'
                        const statusLabel = isHall ? 'Hạ sảnh' : isChanged ? 'Đổi vị trí' : isExported ? 'Đã xuất' : ''

                        return (
                            <div key={item.id} className={`mobile-lot-item ${isExported ? 'mobile-lot-item--exported' : isPending ? '' : 'mobile-lot-item--scanned'}`}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        background: isPending ? '#f4f4f5' : isExported ? '#dcfce7' : '#fef3c7',
                                        color: isPending ? '#a1a1aa' : isExported ? '#16a34a' : '#d97706'
                                    }}>
                                        {isPending ? <ArrowDownToLine size={18} /> : <CheckCircle2 size={18} />}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: isPending ? '#2563eb' : isExported ? '#16a34a' : '#d97706' }}>{item.lot_code}</span>
                                            <span style={{ color: '#d4d4d8' }}>•</span>
                                            <span style={{ fontSize: 10, color: '#a1a1aa', fontFamily: 'monospace' }}>{item.position_name}</span>
                                            {!isPending && (
                                                <span style={{
                                                    fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                                                    background: isExported ? '#dcfce7' : isHall ? '#fef3c7' : '#dbeafe',
                                                    color: isExported ? '#16a34a' : isHall ? '#d97706' : '#2563eb'
                                                }}>
                                                    {statusLabel}{(isHall || isChanged) ? ` → ${item.current_position_name}` : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <strong>{item.sku}</strong> – {item.product_name}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#18181b' }}>{item.quantity}</span>
                                    <span style={{ fontSize: 10, color: '#a1a1aa', marginLeft: 3 }}>{item.unit}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <SelectHallModal isOpen={isSelectHallOpen} onClose={handleHallModalClose} onConfirm={handleMoveToHall} zones={zones} />
        </div>
    )
}
