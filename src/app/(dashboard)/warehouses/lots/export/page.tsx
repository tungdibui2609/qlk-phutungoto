'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Search, FileText, Check, Loader2, Package, ArrowLeft, Save, History, Trash2, ArrowUpDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'
import { logActivity } from '@/lib/audit'
import { lotService } from '@/services/warehouse/lotService'
import { format } from 'date-fns'
import Protected from '@/components/auth/Protected'

interface ExportTask {
    id: string
    code: string
    status: string
    created_at: string
    notes: string | null
    items_count?: number
}

interface PickRecord {
    id: string
    sessionId: string
    seq: number
    qty: number
    note: string
    timestamp: string
}

interface ExportTaskItem {
    id: string
    lot_id: string
    product_id: string
    quantity: number
    exported_quantity: number | null
    unit: string
    status: string
    metadata: {
        picks?: PickRecord[]
        processed_picks?: PickRecord[]
    } | null
    products: {
        name: string
        sku: string
    }
    lots: {
        id: string
        code: string
        quantity: number
        metadata: any
    }
}

interface GroupedItem {
    productId: string
    sku: string
    name: string
    unit: string
    totalRequired: number
    totalPicked: number
    items: ExportTaskItem[]
    history: Array<{
        sessionId: string
        timestamp: string
        qty: number
        note: string
        itemsCount: number
        isFinalized?: boolean
    }>
}

export default function ExportOperationsPage() {
    const router = useRouter()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [loading, setLoading] = useState(true)
    const [isStatsOpen, setIsStatsOpen] = useState(false)
    const [expandedInfo, setExpandedInfo] = useState<Record<string, boolean>>({})
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)')
        setIsMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const toggleInfo = (key: string) => {
        setExpandedInfo(prev => ({ ...prev, [key]: !prev[key] }))
    }
    const [processing, setProcessing] = useState(false)
    const [tasks, setTasks] = useState<ExportTask[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTask, setSelectedTask] = useState<ExportTask | null>(null)
    const [taskItems, setTaskItems] = useState<ExportTaskItem[]>([])
    
    const [newPickQty, setNewPickQty] = useState<Record<string, string>>({})
    const [newPickNote, setNewPickNote] = useState<Record<string, string>>({})
    const [savingGroup, setSavingGroup] = useState<string | null>(null)

    useEffect(() => {
        fetchTasks()
    }, [currentSystem])

    async function fetchTasks() {
        if (!currentSystem?.code) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('export_tasks')
                .select('*, export_task_items(count)')
                .eq('system_code', currentSystem.code)
                .in('status', ['Pending', 'In Progress'])
                .order('created_at', { ascending: false })

            if (error) throw error
            const formattedTasks = ((data as any[]) || []).map((t: any) => ({
                ...t,
                items_count: t.export_task_items?.[0]?.count || 0
            }))
            setTasks(formattedTasks)
            
            // If we have a selected task, we might want to check if it's still in the list
            if (selectedTask && !formattedTasks.find(t => t.id === selectedTask.id)) {
                setSelectedTask(null)
                setTaskItems([])
            }
        } catch (error: any) {
            showToast('Lỗi tải danh sách lệnh: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function handleSelectTask(task: ExportTask) {
        setSelectedTask(task)
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('export_task_items')
                .select(`
                    *, 
                    products(name, sku), 
                    lots(id, code, quantity, metadata)
                `)
                .eq('task_id', task.id)

            if (error) throw error
            setTaskItems((data as any[]) || [])
        } catch (error: any) {
            showToast('Lỗi tải chi tiết lệnh: ' + error.message, 'error')
            setSelectedTask(null)
        } finally {
            setLoading(false)
        }
    }

    const groupedItems = useMemo(() => {
        const groups: Record<string, GroupedItem> = {}
        
        taskItems.forEach(item => {
            const key = `${item.product_id}_${item.unit}`
            if (!groups[key]) {
                groups[key] = {
                    productId: item.product_id,
                    sku: item.products.sku,
                    name: item.products.name,
                    unit: item.unit,
                    totalRequired: 0,
                    totalPicked: 0,
                    items: [],
                    history: []
                }
            }
            
            const g = groups[key]
            g.totalRequired += item.quantity
            g.items.push(item)
            
            const itemPicks = item.metadata?.picks || []
            const processedPicks = item.metadata?.processed_picks || []
            const allPicks = [...processedPicks, ...itemPicks]
            
            allPicks.forEach(p => {
                const existingSession = g.history.find(sh => sh.sessionId === p.sessionId)
                if (existingSession) {
                    existingSession.qty += p.qty
                } else {
                    g.history.push({
                        sessionId: p.sessionId,
                        timestamp: p.timestamp,
                        qty: p.qty,
                        note: p.note,
                        itemsCount: 1,
                        isFinalized: processedPicks.includes(p) // Đánh dấu lượt đã duyệt
                    })
                }
            })
        })
        
        Object.values(groups).forEach(g => {
            // Tính tổng số lượng thực tế đã xuất/lấy
            let total = 0
            g.items.forEach(item => {
                const itemHistoryQty = (item.metadata?.picks?.reduce((sum, p) => sum + p.qty, 0) || 0) + 
                                     (item.metadata?.processed_picks?.reduce((sum, p) => sum + p.qty, 0) || 0)
                
                // Nếu đã Exported (Duyệt xuất) thì số lượng đã lấy ít nhất phải bằng item.quantity
                if (item.status === 'Exported') {
                    total += Math.max(item.quantity, itemHistoryQty)
                } else {
                    total += itemHistoryQty
                }
            })
            
            g.totalPicked = total
            g.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        })
        
        return Object.values(groups)
    }, [taskItems])

    async function handleSavePickForGroup(group: GroupedItem) {
        const key = `${group.productId}_${group.unit}`
        const qtyStr = newPickQty[key] || ''
        const qty = parseFloat(qtyStr)
        const note = newPickNote[key] || ''

        if (isNaN(qty) || qty <= 0) {
            showToast('Vui lòng nhập số lượng hợp lệ', 'warning')
            return
        }

        if (!selectedTask) return

        const remainingCapacity = group.totalRequired - group.totalPicked
        if (qty > remainingCapacity + 0.000001) {
            showToast(`Số lượng vượt quá yêu cầu còn lại (${formatQuantityFull(remainingCapacity)})`, 'warning')
            return
        }

        setSavingGroup(key)
        try {
            const sessionId = crypto.randomUUID()
            const timestamp = new Date().toISOString()
            let remainingToAllocate = qty
            
            // Lấy thông tin người dùng hiện tại để ghi log
            const { data: { session } } = await supabase.auth.getSession()
            const userId = session?.user?.id
            if (!userId) throw new Error('Không tìm thấy thông tin người dùng')

            const updates: Array<{ id: string, metadata: any }> = []
            const picksToInsert: any[] = []

            for (const item of group.items) {
                if (remainingToAllocate <= 0) break
                
                const itemPickedCurrently = item.metadata?.picks?.reduce((sum, p) => sum + p.qty, 0) || 0
                const itemProcessedBefore = item.metadata?.processed_picks?.reduce((sum, p) => sum + p.qty, 0) || 0
                
                const itemCapacity = item.quantity - itemPickedCurrently - itemProcessedBefore
                
                if (itemCapacity <= 0 || isItemLocked(item)) continue
                
                const take = Math.min(remainingToAllocate, itemCapacity)
                const currentMetadata = item.metadata || {}
                const currentPicks = currentMetadata.picks || []
                
                const newPick: PickRecord = {
                    id: crypto.randomUUID(),
                    sessionId: sessionId,
                    seq: currentPicks.length + 1,
                    qty: take,
                    note: note,
                    timestamp: timestamp
                }

                updates.push({
                    id: item.id,
                    metadata: { ...currentMetadata, picks: [...currentPicks, newPick] }
                })

                // Chuẩn bị dữ liệu ghi vào bảng history vĩnh viễn
                picksToInsert.push({
                    task_item_id: item.id,
                    quantity: take,
                    note: note,
                    picker_id: userId,
                    session_id: sessionId,
                    system_code: currentSystem?.code || '',
                    created_at: timestamp
                })
                
                remainingToAllocate -= take
            }

            // Ghi vào bảng history vĩnh viễn trước
            if (picksToInsert.length > 0) {
                const { error: historyError } = await (supabase.from('export_task_picks') as any)
                    .insert(picksToInsert)
                if (historyError) {
                    console.error('Pick History Error:', historyError)
                    throw new Error(`Lỗi ghi lịch sử: ${historyError.message}. (Bạn đã chạy SQL migration chưa?)`)
                }
            }

            for (const update of updates) {
                const { error } = await (supabase.from('export_task_items') as any)
                    .update({ metadata: update.metadata })
                    .eq('id', update.id)
                if (error) throw error
            }

            const { data: refreshed } = await supabase
                .from('export_task_items')
                .select(`*, products(name, sku), lots(id, code, quantity, metadata)`)
                .eq('task_id', selectedTask.id)
            
            if (refreshed) setTaskItems(refreshed as any[])
            
            setNewPickQty(prev => ({ ...prev, [key]: '' }))
            setNewPickNote(prev => ({ ...prev, [key]: '' }))
            
            showToast('Đã ghi nhận lượt lấy hàng', 'success')
        } catch (error: any) {
            showToast('Lỗi khi lưu: ' + error.message, 'error')
        } finally {
            setSavingGroup(null)
        }
    }

    async function handleDeleteSession(group: GroupedItem, sessionId: string) {
        if (!selectedTask) return
        try {
            // Xóa trong bảng history vĩnh viễn
            const { error: historyError } = await supabase
                .from('export_task_picks')
                .delete()
                .eq('session_id', sessionId)
            if (historyError) throw historyError

            const itemIdsInGroup = group.items.map(i => i.id)
            for (const itemId of itemIdsInGroup) {
                const item = taskItems.find(i => i.id === itemId)
                if (!item || !item.metadata?.picks) continue
                
                const originalPicks = item.metadata.picks
                const hasSession = originalPicks.some(p => p.sessionId === sessionId)
                
                if (hasSession) {
                    const filtered = originalPicks.filter(p => p.sessionId !== sessionId)
                    const reSequenced = filtered.map((p, i) => ({ ...p, seq: i + 1 }))
                    const updatedMetadata = { ...item.metadata, picks: reSequenced }
                    
                    const { error } = await (supabase.from('export_task_items') as any)
                        .update({ metadata: updatedMetadata })
                        .eq('id', item.id)
                    if (error) throw error
                }
            }

            const { data: refreshed } = await supabase
                .from('export_task_items')
                .select(`*, products(name, sku), lots(id, code, quantity, metadata)`)
                .eq('task_id', selectedTask.id)
            
            if (refreshed) setTaskItems(refreshed as any[])
        } catch (error: any) {
            showToast('Lỗi khi xóa: ' + error.message, 'error')
        }
    }

    const isItemLocked = (item: any) => item.status === 'Picked' || item.status === 'Exported';

    async function handleConfirmExport() {
        if (!selectedTask) return
        
        const hasPicks = taskItems.some(item => (item.metadata?.picks?.length || 0) > 0)
        if (!hasPicks) {
            showToast('Chưa có lượt lấy hàng nào', 'warning')
            return
        }

        setProcessing(true)
        try {
            for (const item of taskItems) {
                const totalPickQty = item.metadata?.picks?.reduce((sum, p) => sum + p.qty, 0) || 0
                if (totalPickQty <= 0) continue
                if (item.status === 'Exported') continue; // Đã trừ kho rồi thì bỏ qua

                // Chỉ cập nhật thông tin lấy hàng vào lệnh xuất, chưa trừ tồn kho thực tế
                await (supabase.from('export_task_items') as any).update({
                    exported_quantity: totalPickQty,
                    metadata: item.metadata,
                    status: 'Picked'
                }).eq('id', item.id)
            }

            // Cập nhật trạng thái lệnh thành In Progress nếu đang là Pending
            if (selectedTask.status === 'Pending') {
                await (supabase.from('export_tasks') as any).update({ status: 'In Progress' }).eq('id', selectedTask.id)
            }

            showToast('Chốt ca thành công! Dữ liệu đã được khóa và chờ quản lý duyệt xuất.', 'success')
            await fetchTasks()
            
        } catch (error: any) {
            showToast(error.message || 'Có lỗi xảy ra', 'error')
        } finally {
            setProcessing(false)
        }
    }

    return (
        <Protected permission="warehouse_lot.manage">
            <div className="h-[calc(100vh-48px)] md:h-[calc(100vh-48px)] bg-slate-50 dark:bg-slate-950 md:rounded-2xl shadow-sm md:border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in fade-in duration-300">
                {/* Header */}
                <div className="px-3 md:px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 md:gap-3">
                        <button 
                            onClick={() => {
                                if (selectedTask && isMobile) {
                                    setSelectedTask(null)
                                    setTaskItems([])
                                } else {
                                    router.push('/warehouses/lots')
                                }
                            }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 text-slate-500"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                            <FileText className="text-white" size={14} />
                        </div>
                        <div>
                            <h2 className="text-xs md:text-sm font-black text-slate-900 dark:text-white leading-none uppercase tracking-tight">
                                {selectedTask && isMobile ? selectedTask.code : 'Vận hành Xuất kho'}
                            </h2>
                        </div>
                    </div>
                    {/* Mobile: Show task count when selected */}
                    {selectedTask && (
                        <div className="md:hidden text-right">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{taskItems.length}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">SP</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar: Task List - Hidden on mobile when task selected */}
                    <div className={`${selectedTask ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-slate-100 dark:border-slate-800 flex-col bg-white dark:bg-slate-900/50`}>
                        <div className="p-3 md:p-4 border-b border-slate-50 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text"
                                    placeholder="Tìm mã lệnh..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                            {tasks.filter(t => t.code.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                <div className="py-20 text-center">
                                    <Package size={40} className="mx-auto text-slate-200 mb-3" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trống</p>
                                </div>
                            ) : (
                                tasks
                                    .filter(t => t.code.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(task => (
                                        <button
                                            key={task.id}
                                            onClick={() => handleSelectTask(task)}
                                            className={`w-full text-left p-3 md:p-4 rounded-2xl transition-all flex items-center justify-between group ${
                                                selectedTask?.id === task.id 
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${selectedTask?.id === task.id ? 'text-blue-100' : 'text-slate-400'}`}>Lệnh xuất</span>
                                                </div>
                                                <div className="font-bold text-sm truncate uppercase tracking-tighter">{task.code}</div>
                                                <div className={`text-[10px] mt-1 font-bold ${selectedTask?.id === task.id ? 'text-blue-200' : 'text-slate-400'}`}>
                                                    {format(new Date(task.created_at), 'dd/MM/yyyy • HH:mm')}
                                                </div>
                                            </div>
                                        </button>
                                    ))
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Content - Full width on mobile */}
                    <div className={`${!selectedTask ? 'hidden md:flex' : 'flex'} flex-1 overflow-hidden flex-col bg-slate-50 dark:bg-slate-950`}>
                        {loading && !selectedTask ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                                <Loader2 className="animate-spin text-blue-600" size={48} />
                                <p className="text-sm font-bold uppercase tracking-widest">Đang tải...</p>
                            </div>
                        ) : !selectedTask ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 md:p-20 text-center">
                                <div className="w-20 h-20 md:w-24 md:h-24 bg-white dark:bg-slate-900 rounded-[32px] md:rounded-[40px] flex items-center justify-center mb-4 md:mb-6 shadow-sm border border-slate-100 dark:border-slate-800">
                                    <ArrowUpDown className="text-slate-300" size={40} />
                                </div>
                                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Chọn lệnh vận hành</h3>
                                <p className="max-w-xs text-xs text-slate-500 font-medium tracking-tight">Vui lòng chọn một lệnh xuất ở danh sách bên trái để bắt đầu ghi nhận lượt lấy hàng.</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Banner - Compact, responsive */}
                                <div className="px-3 md:px-6 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                        <div className="px-2 md:px-3 py-1 bg-emerald-500 text-white rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest shrink-0">{selectedTask.code}</div>
                                        {selectedTask.notes && <span className="text-[10px] md:text-xs text-slate-400 font-medium italic truncate hidden sm:inline">• {selectedTask.notes}</span>}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-none">{taskItems.length} <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase">Mặt hàng</span></div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-3 md:p-6 custom-scrollbar">
                                    <div className="space-y-4 md:space-y-8">
                                        {groupedItems.map(group => {
                                            const key = `${group.productId}_${group.unit}`
                                            return (
                                                <div key={key} className="bg-white dark:bg-zinc-900 rounded-xl md:rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                                    {/* Header: Thống kê & Tiến độ */}
                                                    <div className="p-3 md:p-4 bg-slate-50 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800">
                                                        <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4 mb-2 md:mb-3">
                                                            <div className="flex items-center gap-4 md:gap-8">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5 md:mb-1">Kế hoạch</span>
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className="text-lg md:text-xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">{formatQuantityFull(group.totalRequired)}</span>
                                                                        <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase">{group.unit}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="w-px h-6 md:h-8 bg-slate-200 dark:bg-zinc-700" />
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-0.5 md:mb-1">Đã lấy</span>
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className="text-lg md:text-xl font-black text-emerald-600 tracking-tighter">{formatQuantityFull(group.totalPicked)}</span>
                                                                        <span className="text-[8px] md:text-[9px] font-bold text-emerald-500/50 uppercase">{group.unit}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="hidden md:flex flex-col w-32">
                                                                    <div className="flex justify-between text-[9px] font-black mb-1">
                                                                        <span className="text-slate-400 uppercase">TIẾN ĐỘ</span>
                                                                        <span className="text-emerald-600">{Math.round((group.totalPicked / group.totalRequired) * 100)}%</span>
                                                                    </div>
                                                                    <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${Math.min(100, (group.totalPicked / group.totalRequired) * 100)}%` }} />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button 
                                                                onClick={() => toggleInfo(key)}
                                                                className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[9px] md:text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-all shadow-sm"
                                                            >
                                                                <span className="hidden sm:inline">{expandedInfo[key] ? 'Đóng chi tiết' : 'Xem thông tin LOT'}</span>
                                                                <span className="sm:hidden">{expandedInfo[key] ? 'Đóng' : 'LOT'}</span>
                                                                <FileText size={12} />
                                                            </button>
                                                        </div>
                                                        
                                                        {/* Mobile Progress Bar */}
                                                        <div className="md:hidden h-1 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (group.totalPicked / group.totalRequired) * 100)}%` }} />
                                                        </div>
                                                    </div>

                                                    {/* Collapsible Info Section */}
                                                    {expandedInfo[key] && (
                                                        <div className="p-3 md:p-4 bg-blue-50/30 dark:bg-blue-900/10 border-b border-blue-100/50 dark:border-blue-900/30 animate-in fade-in slide-in-from-top-2 duration-200">
                                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest">{group.sku}</span>
                                                                <h4 className="text-[10px] md:text-xs font-black text-slate-800 dark:text-zinc-200 uppercase">{group.name}</h4>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 md:gap-1.5 mt-2 overflow-hidden">
                                                                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mr-1">LOT:</span>
                                                                {group.items.map(i => (
                                                                    <span key={i.id} className="px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded text-[8px] md:text-[9px] font-bold text-slate-500 shadow-sm">{i.lots.code}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col lg:flex-row">
                                                        {/* Main Action Area */}
                                                        <div className="lg:w-[45%] p-3 md:p-4 bg-white dark:bg-zinc-900 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-zinc-800 flex flex-col gap-2 md:gap-3">
                                                            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Ghi nhận lượt lấy</h5>
                                                            <div className="flex gap-2 md:gap-3">
                                                                <div className="relative flex-1">
                                                                    <input
                                                                        type="number"
                                                                        placeholder="0"
                                                                        className="w-full pl-3 md:pl-4 pr-14 md:pr-16 py-2.5 md:py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500 rounded-xl text-xl md:text-2xl font-black text-blue-600 outline-none transition-all placeholder:text-slate-200"
                                                                        value={newPickQty[key] || ''}
                                                                        onChange={e => setNewPickQty({...newPickQty, [key]: e.target.value})}
                                                                    />
                                                                    <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-[8px] md:text-[9px] font-black text-slate-400 uppercase bg-white dark:bg-zinc-900 px-1 md:px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-zinc-800">{group.unit}</div>
                                                                </div>
                                                                    <button
                                                                    onClick={() => handleSavePickForGroup(group)}
                                                                    disabled={savingGroup === key || !newPickQty[key] || group.items.every(isItemLocked)}
                                                                    className="px-4 md:px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] md:text-xs font-black disabled:opacity-50 transition-all flex items-center gap-1.5 md:gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] shrink-0"
                                                                >
                                                                    {savingGroup === key ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                                    <span className="hidden sm:inline">LƯU</span>
                                                                </button>
                                                            </div>
                                                            <input 
                                                                type="text"
                                                                placeholder="Ghi chú (vị trí, tình trạng...)"
                                                                className="w-full px-3 md:px-4 py-2 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500 rounded-xl text-[10px] md:text-[11px] font-bold text-slate-500 outline-none transition-all"
                                                                value={newPickNote[key] || ''}
                                                                disabled={group.items.some(isItemLocked)}
                                                                onChange={e => setNewPickNote({...newPickNote, [key]: e.target.value})}
                                                            />
                                                        </div>

                                                        {/* History Area */}
                                                        <div className="flex-1 p-3 md:p-4 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-zinc-900/10">
                                                            <h5 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3 flex items-center gap-2">
                                                                <History size={12} /> Nhật ký lượt lấy
                                                            </h5>
                                                            <div className="flex-1 overflow-y-auto space-y-1.5 md:space-y-2 pr-1 md:pr-2 custom-scrollbar max-h-[200px] md:max-h-[300px]">
                                                                {group.history.length === 0 ? (
                                                                    <div className="flex flex-col items-center justify-center py-6 opacity-10">
                                                                        <Package size={32} />
                                                                        <p className="text-[10px] font-bold mt-1 uppercase">Trống</p>
                                                                    </div>
                                                                ) : (
                                                                    group.history.map((session, idx) => (
                                                                        <div key={session.sessionId} className="flex items-center justify-between p-2.5 md:p-3.5 bg-white dark:bg-zinc-950/40 rounded-lg md:rounded-xl border border-slate-100 dark:border-zinc-800 group transition-all">
                                                                            <div className="flex items-center gap-2.5 md:gap-4 min-w-0">
                                                                                <div className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] md:text-[10px] font-black text-slate-400 shrink-0">{group.history.length - idx}</div>
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs md:text-sm font-black text-slate-800 dark:text-zinc-100">+{formatQuantityFull(session.qty)} <span className="text-[8px] md:text-[9px] font-medium text-slate-400 uppercase">{group.unit}</span></p>
                                                                                    <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-tight truncate">{format(new Date(session.timestamp), 'HH:mm • dd/MM')} {session.note && <span className="text-blue-500 italic ml-1">"{session.note}"</span>}</p>
                                                                                </div>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => handleDeleteSession(group, session.sessionId)} 
                                                                                disabled={group.items.some(isItemLocked)}
                                                                                className="p-1.5 md:p-2 text-slate-300 hover:text-rose-500 md:opacity-0 md:group-hover:opacity-100 transition-all disabled:hidden shrink-0"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-3 md:p-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 shrink-0 bg-white dark:bg-slate-900 shadow-sm">
                                    <div className="text-center sm:text-right flex-1 sm:pr-8">
                                        <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">TỔNG QUAN CHỐT CA</p>
                                        <p className="text-base md:text-lg font-black text-rose-600 dark:text-rose-400 flex items-center justify-center sm:justify-end gap-2">
                                            <ArrowUpDown size={14} />
                                            {formatQuantityFull(taskItems.reduce((acc, item) => acc + (item.metadata?.picks || []).reduce((sum, p) => sum + p.qty, 0), 0))} <span className="text-[10px] md:text-xs font-medium uppercase">đơn vị</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleConfirmExport}
                                        disabled={processing || !taskItems.some(item => (item.metadata?.picks?.length || 0) > 0) || taskItems.every(isItemLocked)}
                                        className="w-full sm:w-auto px-6 md:px-8 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl md:rounded-2xl text-xs md:text-[13px] font-black shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        {processing ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                        {taskItems.every(isItemLocked) ? 'Đã chốt ca' : 'Chốt ca'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Protected>
    )
}
