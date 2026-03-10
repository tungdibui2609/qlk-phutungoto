'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, RotateCcw, Loader2, Keyboard, Camera, ArrowLeft, FileText, CheckCircle2, AlertTriangle, ChevronRight, ArrowDownToLine } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import Link from 'next/link'
import { SelectHallModal } from '@/components/warehouse/map/SelectHallModal'
import { format } from 'date-fns'

// Types
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
    scanned?: boolean // Local state for tracking
}

export default function ExportOrderScanPage() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    // State
    const [step, setStep] = useState<'select' | 'scan'>('select')
    const [useCamera, setUseCamera] = useState(true)
    const [manualCode, setManualCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false)

    // Data
    const [tasks, setTasks] = useState<ExportTask[]>([])
    const [selectedTask, setSelectedTask] = useState<ExportTask | null>(null)
    const [taskItems, setTaskItems] = useState<TaskItem[]>([])
    const [zones, setZones] = useState<any[]>([])

    // Hall selection
    const [isSelectHallOpen, setIsSelectHallOpen] = useState(false)
    const [pendingLotId, setPendingLotId] = useState<string | null>(null)
    const [pendingPositionId, setPendingPositionId] = useState<string | null>(null)
    const [pendingItemId, setPendingItemId] = useState<string | null>(null)

    const inputRef = useRef<HTMLInputElement>(null)

    // Load tasks on mount
    useEffect(() => {
        fetchTasks()
        fetchZones()
    }, [])

    // Auto-focus manual input
    useEffect(() => {
        if (!useCamera && step === 'scan' && inputRef.current) {
            inputRef.current.focus()
        }
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

            // Fetch user names
            const userIds = Array.from(new Set((tasksData || []).map(t => t.created_by).filter(Boolean)))
            let userMap: Record<string, string> = {}
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('user_profiles')
                    .select('id, full_name')
                    .in('id', userIds as string[])
                if (usersData) {
                    usersData.forEach((u: any) => { userMap[u.id] = u.full_name })
                }
            }

            const formatted: ExportTask[] = (tasksData || []).map((t) => ({
                id: t.id,
                code: t.code,
                status: t.status,
                created_at: t.created_at,
                notes: t.notes,
                created_by_name: t.created_by ? (userMap[t.created_by] || 'Unknown') : 'Unknown',
                items_count: t.export_task_items?.[0]?.count || 0
            }))

            setTasks(formatted)
        } catch (error: any) {
            showToast('Lỗi tải danh sách lệnh xuất: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function fetchTaskItems(taskId: string, silent = false) {
        if (!silent) setLoading(true)
        try {
            const { data, error } = await supabase
                .from('export_task_items')
                .select(`
                    id, quantity, unit, status, lot_id, position_id,
                    lots (id, code, positions!positions_lot_id_fkey (code, is_hall:zone_positions(zone_id))),
                    positions!export_task_items_position_id_fkey (code),
                    products (name, sku)
                `)
                .eq('task_id', taskId)

            if (error) throw error

            // Ensure zones are loaded
            let currentZones = zones
            if (currentZones.length === 0) {
                const { data: zData } = await supabase.from('zones').select('*')
                if (zData) {
                    currentZones = zData
                    setZones(zData)
                }
            }

            const items: TaskItem[] = (data || []).map((item: any) => {
                const originalPosCode = item.positions?.code || 'N/A'
                let currentPosCode = originalPosCode
                let isHall = false

                if (item.lots?.positions && item.lots.positions.length > 0) {
                    currentPosCode = item.lots.positions[0].code

                    const isHallRelation = item.lots.positions[0].is_hall
                    const leafZoneId = Array.isArray(isHallRelation)
                        ? isHallRelation[0]?.zone_id
                        : isHallRelation?.zone_id

                    if (leafZoneId) {
                        let currId = leafZoneId
                        while (currId) {
                            const z = currentZones.find((x: any) => x.id === currId)
                            if (!z) break
                            if (z.is_hall) {
                                isHall = true
                                break
                            }
                            currId = z.parent_id
                        }
                    }
                }

                let displayStatus: TaskItem['display_status'] = item.status === 'Exported' ? 'Exported' : 'Pending'
                if (displayStatus === 'Pending' && originalPosCode !== currentPosCode) {
                    displayStatus = isHall ? 'Moved to Hall' : 'Changed Position'
                }

                return {
                    id: item.id,
                    lot_id: item.lots?.id || item.lot_id,
                    lot_code: item.lots?.code || 'N/A',
                    position_id: item.position_id,
                    position_name: originalPosCode,
                    current_position_name: currentPosCode,
                    product_name: item.products?.name || 'N/A',
                    sku: item.products?.sku || 'N/A',
                    quantity: item.quantity,
                    unit: item.unit || '',
                    status: item.status || 'Pending',
                    display_status: displayStatus,
                    scanned: displayStatus === 'Moved to Hall' || displayStatus === 'Changed Position' || displayStatus === 'Exported'
                }
            }).sort((a, b) => a.position_name.localeCompare(b.position_name))

            setTaskItems(items)
        } catch (error: any) {
            showToast('Lỗi tải chi tiết lệnh: ' + error.message, 'error')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    async function selectTask(task: ExportTask) {
        setSelectedTask(task)
        await fetchTaskItems(task.id)
        setStep('scan')
    }

    function handleReset() {
        setStep('select')
        setSelectedTask(null)
        setTaskItems([])
        setManualCode('')
        setPaused(false)
        setPendingLotId(null)
        setPendingPositionId(null)
        setPendingItemId(null)
    }

    async function handleScanResult(rawCode: string, isManual = false) {
        if (loading || (!isManual && paused) || !rawCode) return

        let code = rawCode.trim()

        // Handle URL scanning
        try {
            if (code.startsWith('http')) {
                const url = new URL(code)
                const pathParts = url.pathname.split('/')
                const lastPart = pathParts[pathParts.length - 1]
                if (lastPart) code = lastPart
            }
        } catch (e) { }

        code = code.toUpperCase()
        setPaused(true)
        setManualCode('')

        await processLotScan(code)
    }

    async function processLotScan(code: string) {
        if (!profile?.company_id) return

        setLoading(true)
        try {
            // Find the LOT in the task items
            const matchingItem = taskItems.find(item => item.lot_code === code)

            if (!matchingItem) {
                showToast(`LOT "${code}" không thuộc lệnh xuất "${selectedTask?.code}"`, 'error')
                setPaused(false)
                setLoading(false)
                return
            }

            if (!matchingItem.lot_id) {
                showToast(`LOT "${code}" không có dữ liệu liên kết`, 'error')
                setPaused(false)
                setLoading(false)
                return
            }

            // LOT belongs to order → Open hall selection
            setPendingLotId(matchingItem.lot_id)
            setPendingPositionId(matchingItem.position_id)
            setPendingItemId(matchingItem.id)
            setIsSelectHallOpen(true)

        } catch (e: any) {
            showToast('Lỗi xử lý: ' + e.message, 'error')
            setPaused(false)
        } finally {
            setLoading(false)
        }
    }

    async function handleMoveToHall(hallId: string) {
        setIsSelectHallOpen(false)

        if (!pendingLotId) {
            setPaused(false)
            return
        }

        setLoading(true)
        try {
            // Find descendant zones of hallId
            const targetZoneIds = new Set<string>([hallId])
            let added = true
            while (added) {
                added = false
                for (const z of zones) {
                    if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) {
                        targetZoneIds.add(z.id)
                        added = true
                    }
                }
            }

            // Find an empty position in the hall
            const { data: availablePositions, error: availError } = await (supabase
                .from('zone_positions')
                .select('position_id, zone_id, positions!inner(id, lot_id)')
                .is('positions.lot_id', null)
                .in('zone_id', Array.from(targetZoneIds))
                .limit(1) as any)

            if (availError || !availablePositions || availablePositions.length === 0) {
                showToast('Không còn vị trí trống trong Sảnh này!', 'error')
                setLoading(false)
                setPaused(false)
                return
            }

            const targetPositionId = availablePositions[0].position_id as string

            // Clear old position
            if (pendingPositionId) {
                await supabase
                    .from('positions')
                    .update({ lot_id: null } as any)
                    .eq('id', pendingPositionId)
            } else {
                // Clear any position containing this lot
                await supabase
                    .from('positions')
                    .update({ lot_id: null } as any)
                    .eq('lot_id', pendingLotId)
            }

            // Assign to new position
            const { error: updateError } = await supabase
                .from('positions')
                .update({ lot_id: pendingLotId } as any)
                .eq('id', targetPositionId)

            if (updateError) throw updateError

            const matchingItem = taskItems.find(i => i.id === pendingItemId)
            showToast(`Đã hạ sảnh LOT "${matchingItem?.lot_code}" thành công!`, 'success')

            // Re-fetch items to get updated status
            if (selectedTask) await fetchTaskItems(selectedTask.id, true)

        } catch (error: any) {
            showToast('Lỗi khi hạ sảnh: ' + error.message, 'error')
        } finally {
            setLoading(false)
            setPaused(false)
            setPendingLotId(null)
            setPendingPositionId(null)
            setPendingItemId(null)
        }
    }

    function handleHallModalClose() {
        setIsSelectHallOpen(false)
        setPaused(false)
        setPendingLotId(null)
        setPendingPositionId(null)
        setPendingItemId(null)
    }

    // Stats
    const scannedCount = taskItems.filter(i => i.scanned).length
    const totalCount = taskItems.length

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
            {/* Header */}
            <div className="z-20 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {step === 'scan' ? (
                            <button
                                onClick={handleReset}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        ) : (
                            <Link href="/warehouses" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                                <ArrowLeft size={20} />
                            </Link>
                        )}
                        <div>
                            <h1 className="font-bold text-lg text-slate-900 dark:text-white leading-none">
                                {step === 'select' ? 'Chọn Lệnh Xuất' : `Quét LOT – ${selectedTask?.code}`}
                            </h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{currentSystem?.name}</p>
                        </div>
                    </div>
                    {step === 'scan' && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setUseCamera(!useCamera)}
                                className="p-2.5 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                            >
                                {useCamera ? <Keyboard size={18} /> : <Camera size={18} />}
                            </button>
                            <button
                                onClick={() => { setPaused(false); setManualCode('') }}
                                className="p-2.5 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                            >
                                <RotateCcw size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {/* STEP: Select Task */}
                {step === 'select' && (
                    <div className="p-4 space-y-3 max-w-2xl mx-auto">
                        {loading ? (
                            <div className="flex justify-center p-12">
                                <Loader2 className="animate-spin text-orange-600" size={32} />
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="text-center p-12">
                                <FileText className="mx-auto text-slate-300 mb-4" size={48} />
                                <p className="text-slate-500 font-medium">Không có lệnh xuất đang chờ xử lý</p>
                            </div>
                        ) : (
                            tasks.map(task => (
                                <button
                                    key={task.id}
                                    onClick={() => selectTask(task)}
                                    className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 text-left hover:shadow-md hover:border-orange-300 transition-all active:scale-[0.98] group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600">
                                                <FileText size={22} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-orange-600 dark:text-orange-400 font-mono tracking-tight">{task.code}</h3>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                    <span>{task.created_by_name}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">{format(new Date(task.created_at), 'HH:mm dd/MM')}</span>
                                                    <span>•</span>
                                                    <span className="font-bold">{task.items_count} mặt hàng</span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight size={20} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* STEP: Scan LOT */}
                {step === 'scan' && (
                    <div className="p-4 flex flex-col items-center">
                        {/* Progress bar */}
                        <div className="w-full max-w-md mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500">Tiến độ quét</span>
                                <span className="text-xs font-black text-orange-600">{scannedCount}/{totalCount}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                                    style={{ width: totalCount > 0 ? `${(scannedCount / totalCount) * 100}%` : '0%' }}
                                />
                            </div>
                        </div>

                        {/* Camera View */}
                        {useCamera && (
                            <div className="w-full max-w-xs aspect-square relative bg-black rounded-[40px] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 mb-6 mx-auto">
                                <Scanner
                                    onScan={(result) => {
                                        if (result && result.length > 0) {
                                            handleScanResult(result[0].rawValue)
                                        }
                                    }}
                                    styles={{
                                        container: { width: '100%', height: '100%' },
                                        video: { objectFit: 'cover' as any }
                                    }}
                                    components={{ finder: false }}
                                    constraints={{ facingMode: 'environment' }}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <div className="w-56 h-56 border-2 border-white/30 rounded-3xl relative">
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1 rounded-tl-2xl" />
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1 rounded-tr-2xl" />
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1 rounded-bl-2xl" />
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1 rounded-br-2xl" />
                                        {loading && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl backdrop-blur-[2px]">
                                                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Instruction */}
                        <div className="text-center space-y-2 mb-6 px-6">
                            <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <QrCode size={28} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                {useCamera ? 'Quét mã LOT' : 'Nhập mã LOT'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-[280px] mx-auto">
                                {useCamera ? 'Đưa mã QR của LOT vào khung hình để hạ sảnh' : 'Nhập mã LOT và nhấn Xác nhận'}
                            </p>
                        </div>

                        {/* Manual Input */}
                        {!useCamera && (
                            <div className="w-full max-w-md p-4 animate-in slide-in-from-bottom-4 duration-300">
                                <div className="bg-white dark:bg-slate-900 rounded-[24px] p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                                    <form onSubmit={(e) => { e.preventDefault(); handleScanResult(manualCode, true); }}>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={manualCode}
                                            onChange={(e) => setManualCode(e.target.value)}
                                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center text-2xl font-black uppercase mb-4 focus:ring-4 focus:ring-orange-500/10 outline-none border border-transparent focus:border-orange-500 transition-all text-slate-900 dark:text-white"
                                            placeholder="VÍ DỤ: LOT23..."
                                        />
                                        <button
                                            type="submit"
                                            disabled={loading || !manualCode}
                                            className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : 'Xác nhận'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Items List */}
                        <div className="w-full max-w-2xl mt-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                                Danh sách LOT trong lệnh ({totalCount})
                            </h3>
                            <div className="space-y-1.5">
                                {taskItems.map(item => {
                                    const isPending = item.display_status === 'Pending'
                                    const isExported = item.display_status === 'Exported'
                                    const isHall = item.display_status === 'Moved to Hall'
                                    const isChanged = item.display_status === 'Changed Position'
                                    const statusLabel = isHall ? 'Hạ sảnh' : isChanged ? 'Đổi vị trí' : isExported ? 'Đã xuất' : ''
                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isExported ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                                : isHall ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                                    : isChanged ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                }`}
                                        >
                                            {/* Status Icon */}
                                            <div className={`p-1.5 rounded-lg shrink-0 ${isPending ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                                : isExported ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'
                                                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'
                                                }`}>
                                                {isPending ? <ArrowDownToLine size={18} /> : <CheckCircle2 size={18} />}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-mono text-sm font-black ${isPending ? 'text-blue-600' : isExported ? 'text-emerald-600' : isHall ? 'text-amber-600' : 'text-blue-600'
                                                        }`}>
                                                        {item.lot_code}
                                                    </span>
                                                    <span className="text-stone-300">•</span>
                                                    <span className="text-xs text-stone-500 font-mono">{item.position_name}</span>
                                                    {!isPending && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isExported ? 'bg-emerald-100 text-emerald-600'
                                                            : isHall ? 'bg-amber-100 text-amber-600'
                                                                : 'bg-blue-100 text-blue-600'
                                                            }`}>
                                                            {statusLabel}{(isHall || isChanged) ? ` → ${item.current_position_name}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-stone-500 truncate">
                                                    <span className="font-bold">{item.sku}</span> – {item.product_name}
                                                </div>
                                            </div>

                                            {/* Quantity */}
                                            <div className="text-right shrink-0">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                                                <span className="text-[10px] text-slate-400 ml-1">{item.unit}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Select Hall Modal */}
            <SelectHallModal
                isOpen={isSelectHallOpen}
                onClose={handleHallModalClose}
                onConfirm={handleMoveToHall}
                zones={zones}
            />
        </div>
    )
}
