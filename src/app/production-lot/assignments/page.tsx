'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { 
    CheckCircle2, MapPin, Hash, Calendar, Loader2, 
    Link as LinkIcon, AlertCircle, Trash2, Check, X, XCircle,
    ArrowRight, Package, Search, Filter, RefreshCcw,
    AlertTriangle, Edit2, Save
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

type PendingAssignment = {
    id: string
    position_id: string
    lot_stt: number
    production_date: string
    system_code: string
    created_at: string
    status: string
    // Joined data
    position?: {
        code: string
        id: string
    }
}

type Lot = Database['public']['Tables']['lots']['Row'] & {
    product_names?: string[]
}

export default function AssignmentApprovalPage() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()

    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [productionDate, setProductionDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    
    const [pendingList, setPendingList] = useState<PendingAssignment[]>([])
    const [approvedList, setApprovedList] = useState<PendingAssignment[]>([])
    const [rejectedList, setRejectedList] = useState<PendingAssignment[]>([])
    const [lotsInDay, setLotsInDay] = useState<Lot[]>([])
    
    // Editing state
    const [allPositions, setAllPositions] = useState<any[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValues, setEditValues] = useState<{ lot_stt: string, position_id: string }>({ lot_stt: '', position_id: '' })

    useEffect(() => {
        if (currentSystem?.code) {
            fetchData()
            fetchPositions()
        }
    }, [currentSystem, productionDate])

    async function fetchPositions() {
        if (!currentSystem?.code) return;
        try {
            // Fetch all positions for this system/company
            const { data, error } = await (supabase.from('positions') as any)
                .select('id, code')
                .eq('company_id', profile?.company_id)
                .eq('system_type', currentSystem.code)
                .order('code', { ascending: true });
            
            if (error) throw error;
            setAllPositions(data || []);
        } catch (e) {
            console.error('Fetch positions error:', e);
        }
    }

    async function fetchData() {
        if (!currentSystem?.code) {
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            // 1. Fetch pending assignments AND processed (approved/rejected) assignments for the selected date
            const { data: pData, error: pErr } = await (supabase.from('pending_assignments') as any)
                .select('*, position:positions(id, code)')
                .eq('system_code', currentSystem.code)
                .or(`status.eq.pending,and(status.neq.pending,production_date.eq.${productionDate})`)
                .order('created_at', { ascending: false })

            if (pErr) throw pErr

            const pending = pData?.filter((a: any) => a.status === 'pending') || []
            const approved = pData?.filter((a: any) => a.status === 'approved') || []
            const rejected = pData?.filter((a: any) => a.status === 'rejected') || []

            // 2. Extract unique dates from assignments to fetch relevant LOTs
            const relevantDates = Array.from(new Set(pData?.map((a: any) => a.production_date) || []))
            if (!relevantDates.includes(productionDate)) {
                relevantDates.push(productionDate) // Always include selected date for sidebar
            }

            // 3. Fetch LOTs for these dates
            const { data: lData, error: lErr } = await supabase
                .from('lots')
                .select(`
                    *,
                    lot_items(products(name))
                `)
                .eq('system_code', currentSystem.code)
                .in('inbound_date', relevantDates)
                .neq('status', 'hidden')
                .neq('status', 'exported')
                .order('daily_seq', { ascending: true })

            if (lErr) throw lErr
            let finalLots = lData || []

            const formattedLots: Lot[] = finalLots.map((l: any) => ({
                ...l,
                product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || []
            }))

            setPendingList(pending)
            setApprovedList(approved)
            setRejectedList(rejected)
            setLotsInDay(formattedLots || [])
        } catch (e: any) {
            console.error('Fetch error:', e)
            showToast('Lỗi tải dữ liệu: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const startEdit = (ass: PendingAssignment) => {
        setEditingId(ass.id)
        setEditValues({
            lot_stt: ass.lot_stt.toString(),
            position_id: ass.position_id
        })
    }

    const handleSaveEdit = async (ass: PendingAssignment) => {
        const newStt = parseInt(editValues.lot_stt)
        const newPosId = editValues.position_id

        if (isNaN(newStt) || !newPosId) {
            showToast('Vui lòng nhập đầy đủ thông tin', 'error')
            return
        }

        setActionLoading(ass.id)
        try {
            // 1. If it was already approved, we must unassign from old position first
            if (ass.status === 'approved') {
                // Find the lot matching OLD stt/date
                const oldLot = lotsInDay.find(l => l.daily_seq === ass.lot_stt && l.inbound_date?.split('T')[0] === ass.production_date);
                if (oldLot) {
                    // Check if it's currently at the old position
                    const { data: posData } = await (supabase.from('positions') as any).select('id, lot_id').eq('id', ass.position_id).single();
                    if (posData?.lot_id === oldLot.id) {
                        // Clear it
                        const { error: clearErr } = await (supabase.from('positions') as any).update({ lot_id: null }).eq('id', ass.position_id);
                        if (clearErr) throw new Error("Lỗi khi gỡ LOT cũ: " + clearErr.message);
                    }
                }
            }

            // 2. Update the assignment record itself
            const { error: updateErr } = await (supabase.from('pending_assignments') as any)
                .update({ 
                    lot_stt: newStt, 
                    position_id: newPosId 
                })
                .eq('id', ass.id)

            if (updateErr) throw updateErr

            // 3. If it was approved, now we re-assign to the NEW position
            if (ass.status === 'approved') {
                // Find the lot matching NEW stt/date
                const newLot = lotsInDay.find(l => l.daily_seq === newStt && l.inbound_date?.split('T')[0] === ass.production_date);
                if (newLot) {
                    // Double check target position
                    const { data: targetPos } = await (supabase.from('positions') as any).select('id, lot_id, code').eq('id', newPosId).single();
                    if (targetPos?.lot_id && targetPos.lot_id !== newLot.id) {
                        throw new Error(`Vị trí ${targetPos.code} đã có LOT khác đứng. Vui lòng gỡ LOT đó trước!`);
                    }
                    
                    // Assign
                    const { error: assignErr } = await (supabase.from('positions') as any).update({ lot_id: newLot.id }).eq('id', newPosId);
                    if (assignErr) throw new Error("Lỗi khi gán vị trí mới: " + assignErr.message);
                }
            }

            showToast('Đã lưu thay đổi thành công', 'success')
            setEditingId(null)
            fetchData() // Refresh everything
        } catch (e: any) {
            showToast('Lỗi khi lưu: ' + e.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleApprove = async (ass: PendingAssignment, lotId: string) => {
        setActionLoading(ass.id)
        try {
            // Validate 1: Is this LOT already assigned to another position?
            const { data: existingPositions, error: checkErr1 } = await (supabase.from('positions') as any)
                .select('id, code')
                .eq('lot_id', lotId)
                
            if (checkErr1) throw new Error("Không thể kiểm tra vị trí cũ của lô: " + checkErr1.message);

            const otherPositions = (existingPositions || []).filter((p: any) => p.id !== ass.position_id);
            if (otherPositions.length > 0) {
                const posCodes = otherPositions.map((p: any) => p.code).join(', ');
                throw new Error(`LOT này đang nằm tại vị trí: ${posCodes}. Yêu cầu gỡ LOT khỏi vị trí cũ TRƯỚC khi gán sang vị trí mới!`);
            }

            // Validate 2: Is the target position already occupied by another LOT?
            const { data: targetPos, error: checkErr2 } = await (supabase.from('positions') as any)
                .select('code, lot_id')
                .eq('id', ass.position_id)
                .single()

            if (checkErr2) throw new Error("Không thể kiểm tra thông tin vị trí đích: " + checkErr2.message);

            if (targetPos?.lot_id && targetPos.lot_id !== lotId) {
                const { data: occupiedLot } = await (supabase.from('lots') as any).select('code, daily_seq').eq('id', targetPos.lot_id).single()
                const lotInfo = occupiedLot ? `LOT ${occupiedLot.code} (STT ${occupiedLot.daily_seq || '?'})` : 'một LOT khác';
                throw new Error(`Vị trí ${targetPos.code} ĐÃ CÓ ${lotInfo} lưu trữ. Vui lòng gỡ LOT này khỏi vị trí trước khi gán LOT mới!`);
            }

            // 1. Update position
            const { error: posErr } = await (supabase.from('positions') as any)
                .update({ lot_id: lotId })
                .eq('id', ass.position_id)

            if (posErr) throw new Error("Lỗi cập nhật lúc gán LOT vào vị trí: " + posErr.message)

            // 2. Mark as approved
            const { error: pErr } = await (supabase.from('pending_assignments') as any)
                .update({ status: 'approved' })
                .eq('id', ass.id)

            if (pErr) throw new Error("Lỗi ghi nhận trạng thái đã duyệt: " + pErr.message);

            showToast('Đã khớp nối vị trí thành công!', 'success')
            
            // Remove from pending list
            setPendingList(prev => prev.filter(p => p.id !== ass.id))
            
            // If it matches the currently viewed daily list, add to history
            if (ass.production_date === productionDate) {
                setApprovedList(prev => [{...ass, status: 'approved'}, ...prev])
            }
        } catch (e: any) {
            showToast(e.message || 'Có lỗi xảy ra', 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (ass: PendingAssignment) => {
        const confirmed = await showConfirm(`Bạn có chắc chắn muốn từ chối (hủy) yêu cầu gán STT #${ass.lot_stt} này?`)
        if (!confirmed) return

        setActionLoading(ass.id)
        try {
            const { error } = await (supabase.from('pending_assignments') as any)
                .update({ status: 'rejected' })
                .eq('id', ass.id)

            if (error) throw error

            showToast('Đã hủy yêu cầu', 'success')
            // Remove from pending
            setPendingList(prev => prev.filter(p => p.id !== ass.id))
            
            // Add to rejected history
            if (ass.production_date === productionDate) {
                setRejectedList(prev => [{...ass, status: 'rejected'}, ...prev])
            }
        } catch (e: any) {
            showToast('Lỗi khi hủy: ' + e.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-900 p-6 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
                        <LinkIcon className="text-blue-600" size={32} />
                        Duyệt Gán Vị Trí
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                        Khớp nối STT từ mobile với dữ liệu LOT thực tế.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 uppercase tracking-widest">{currentSystem?.code}</span>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter mt-1">{currentSystem?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                        <Calendar size={18} className="text-zinc-400 ml-2" />
                        <input 
                            type="date"
                            value={productionDate}
                            onChange={(e) => setProductionDate(e.target.value)}
                            className="bg-transparent border-none outline-none font-bold text-sm text-zinc-900 dark:text-white pr-2 cursor-pointer"
                        />
                    </div>
                    <button 
                        onClick={fetchData}
                        className="p-3 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                        title="Tải lại"
                    >
                        <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Pending List (Main) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-2 px-2">
                        <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            Yêu cầu từ Mobile ({pendingList.length})
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-800/50 shadow-sm">
                            <Loader2 size={32} className="text-blue-600 animate-spin mb-4" />
                            <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Đang tải dữ liệu chờ duyệt...</p>
                        </div>
                    ) : pendingList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border-2 border-dashed border-zinc-100 dark:border-zinc-800/50 shadow-sm">
                            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4 text-zinc-300 dark:text-zinc-600">
                                <CheckCircle2 size={32} />
                            </div>
                            <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Tuyệt vời! Không còn vị trí nào chờ duyệt.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingList.map((ass) => {
                                const matchedLot = lotsInDay.find(l => {
                                    const lotInboundDate = l.inbound_date?.split('T')[0]
                                    return l.daily_seq === ass.lot_stt && lotInboundDate === ass.production_date
                                })
                                const isDifferentSystem = matchedLot && matchedLot.system_code !== currentSystem?.code
                                
                                // Deep date check (ignore time)
                                const assDate = ass.production_date
                                const lotInboundDate = matchedLot?.inbound_date?.split('T')[0]
                                const isDifferentDate = matchedLot && lotInboundDate !== assDate

                                return (
                                    <div 
                                        key={ass.id} 
                                        className={`group bg-white dark:bg-zinc-800 border-2 rounded-[28px] p-6 transition-all hover:shadow-xl hover:scale-[1.01] ${
                                            matchedLot 
                                            ? (isDifferentDate || isDifferentSystem ? 'border-amber-100 bg-amber-50/10' : 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20') 
                                            : 'border-zinc-100 dark:border-zinc-800'
                                        }`}
                                    >
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                            {/* Info Section */}
                                            <div className="flex items-center gap-5">
                                                <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black border shadow-sm ${
                                                    matchedLot 
                                                    ? (isDifferentDate || isDifferentSystem ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100') 
                                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>
                                                    <span className="text-[10px] uppercase opacity-50 mb-0.5 leading-none">STT</span>
                                                    {editingId === ass.id ? (
                                                        <input 
                                                            type="number"
                                                            value={editValues.lot_stt}
                                                            onChange={(e) => setEditValues(prev => ({...prev, lot_stt: e.target.value}))}
                                                            className="w-12 bg-white dark:bg-zinc-700 text-center rounded-lg text-lg border border-zinc-200 outline-none"
                                                        />
                                                    ) : (
                                                        <span className="text-2xl leading-none">#{ass.lot_stt}</span>
                                                    )}
                                                </div>
                                                
                                                <ArrowRight className="text-zinc-300 hidden md:block" />

                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin size={16} className="text-red-500" />
                                                        {editingId === ass.id ? (
                                                            <select 
                                                                value={editValues.position_id}
                                                                onChange={(e) => setEditValues(prev => ({...prev, position_id: e.target.value}))}
                                                                className="bg-white dark:bg-zinc-700 border border-zinc-200 rounded-lg py-1 px-2 text-xs font-bold outline-none max-w-[150px]"
                                                            >
                                                                {allPositions.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.code}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{ass.position?.code || '---'}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                                        <Calendar size={12} />
                                                        <span>Lô ngày: {format(new Date(ass.production_date), 'dd/MM/yyyy')}</span>
                                                        <span className="text-zinc-200">|</span>
                                                        <span>Gửi lúc: {format(new Date(ass.created_at), 'HH:mm')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Matching Section */}
                                            <div className="flex-1 w-full md:w-auto">
                                                {matchedLot ? (
                                                    <div className="space-y-3">
                                                        <div className={`flex items-center gap-4 p-4 rounded-2xl border animate-in zoom-in duration-300 relative overflow-hidden ${
                                                            isDifferentDate || isDifferentSystem 
                                                            ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800' 
                                                            : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50'
                                                        }`}>
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                                isDifferentDate || isDifferentSystem 
                                                                ? 'bg-amber-100 text-amber-600' 
                                                                : 'bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-400'
                                                            }`}>
                                                                {isDifferentDate || isDifferentSystem ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${
                                                                    isDifferentDate || isDifferentSystem ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'
                                                                }`}>
                                                                    {isDifferentSystem ? `TÌM THẤY TẠI KHO: ${matchedLot.system_code}` : 'KHỚP TỰ ĐỘNG (99%)'}
                                                                </div>
                                                                <div className="text-xs font-black text-zinc-900 dark:text-white truncate">{matchedLot.code}</div>
                                                                <div className="text-[9px] text-zinc-500 truncate">{matchedLot.product_names?.join(', ')}</div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {editingId === ass.id ? (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => handleSaveEdit(ass)}
                                                                            disabled={!!actionLoading}
                                                                            className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                                                                            title="Lưu thay đổi"
                                                                        >
                                                                            <Save size={18} />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setEditingId(null)}
                                                                            className="p-3 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-all"
                                                                            title="Hủy"
                                                                        >
                                                                            <X size={18} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => handleApprove(ass, matchedLot.id)}
                                                                            disabled={!!actionLoading}
                                                                            className={`px-6 py-2.5 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                                                                                isDifferentDate || isDifferentSystem 
                                                                                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                                                                                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                                                                            }`}
                                                                        >
                                                                            {actionLoading === ass.id ? <Loader2 size={16} className="animate-spin" /> : 'DUYỆT NGAY'}
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => startEdit(ass)}
                                                                            disabled={!!actionLoading}
                                                                            className="p-2 text-zinc-400 hover:text-blue-600 transition-colors"
                                                                            title="Sửa yêu cầu"
                                                                        >
                                                                            <Edit2 size={18} />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleReject(ass)}
                                                                            disabled={!!actionLoading}
                                                                            className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                                                                        >
                                                                            <Trash2 size={18} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {(isDifferentDate || isDifferentSystem) && (
                                                                <div className="absolute top-0 right-0">
                                                                    <div className="bg-amber-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-sm">
                                                                        Dữ liệu lệch
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isDifferentDate && (
                                                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                                                                <AlertTriangle size={14} className="text-amber-500" />
                                                                <span className="text-[10px] font-bold text-amber-700 uppercase">Chú ý:</span>
                                                                <span className="text-[10px] text-amber-600 font-medium">LOT có ngày nhập kho là <span className="font-bold underline">{matchedLot.inbound_date ? format(new Date(matchedLot.inbound_date), 'dd/MM/yyyy') : '---'}</span>, lệch so với yêu cầu ({ass.production_date ? format(new Date(ass.production_date), 'dd/MM/yyyy') : '---'})</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900/20 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                                                                <AlertCircle size={24} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-0.5">KHÔNG TÌM THẤY LOT KHỚP STT</div>
                                                                <div className="text-[9px] text-amber-500 font-medium leading-relaxed">
                                                                    Hãy kiểm tra xem lô hàng STT #{ass.lot_stt} đã được tạo cho kho <b>{currentSystem?.code}</b> chưa?
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {editingId === ass.id ? (
                                                                <>
                                                                    <button 
                                                                        onClick={() => handleSaveEdit(ass)}
                                                                        disabled={!!actionLoading}
                                                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase"
                                                                    >
                                                                        LƯU
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setEditingId(null)}
                                                                        className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-black text-xs uppercase"
                                                                    >
                                                                        HỦY
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button 
                                                                        onClick={() => showToast('Tính năng gán thủ công đang được phát triển', 'info')}
                                                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                                                    >
                                                                        Gán thủ công
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => startEdit(ass)}
                                                                        className="p-2 text-zinc-400 hover:text-blue-500"
                                                                    >
                                                                        <Filter size={18} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleReject(ass)}
                                                                        className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Lịch sử đã gán */}
                    {approvedList.length > 0 && (
                        <div className="mt-12 space-y-4">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle2 size={16} />
                                    Lịch sử đã gán (Lô ngày {format(new Date(productionDate), 'dd/MM/yyyy')}) - {approvedList.length}
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {approvedList.map(ass => {
                                    const matchedLot = lotsInDay.find(l => {
                                        const lotInboundDate = l.inbound_date?.split('T')[0]
                                        return l.daily_seq === ass.lot_stt && lotInboundDate === ass.production_date
                                    })
                                    return (
                                        <div key={ass.id} className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden transition-all hover:border-emerald-200">
                                            <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-xl flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-700 shadow-sm shrink-0 relative z-10">
                                                <span className="text-[8px] uppercase opacity-50 mb-0.5 leading-none">STT</span>
                                                <span className="text-lg font-black leading-none">#{ass.lot_stt}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 relative z-10">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded-lg uppercase">
                                                            {ass.position?.code || '---'}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-600 dark:text-zinc-300 font-bold truncate">
                                                            {matchedLot ? matchedLot.code : '---'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={() => startEdit(ass)}
                                                            className="p-1 text-zinc-400 hover:text-blue-500 transition-colors"
                                                            title="Sửa lại"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleReject(ass)}
                                                            className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                                                            title="Huỷ duyệt"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-[9px] text-zinc-500 font-medium flex flex-wrap gap-x-2">
                                                    <span>Lô: {ass.production_date ? format(new Date(ass.production_date), 'dd/MM') : '---'}</span>
                                                    <span>Duyệt: {ass.created_at ? format(new Date(ass.created_at), 'HH:mm') : '---'}</span>
                                                </div>
                                            </div>
                                            <div className="absolute top-1/2 -translate-y-1/2 right-2 text-emerald-100 dark:text-emerald-900/40 pointer-events-none">
                                                <Check size={48} strokeWidth={3} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Lịch sử đã hủy/từ chối */}
                    {rejectedList.length > 0 && (
                        <div className="mt-8 space-y-4">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-2">
                                    <XCircle size={16} />
                                    Lịch sử đã hủy (Lô ngày {format(new Date(productionDate), 'dd/MM/yyyy')}) - {rejectedList.length}
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {rejectedList.map(ass => {
                                    return (
                                        <div key={ass.id} className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden transition-all hover:border-red-200">
                                            <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-xl flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-700 shadow-sm shrink-0 relative z-10">
                                                <span className="text-[8px] uppercase opacity-50 mb-0.5 leading-none">STT</span>
                                                <span className="text-lg font-black leading-none">#{ass.lot_stt}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 relative z-10">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-400 text-[10px] font-black rounded-lg uppercase">
                                                            {ass.position?.code || '---'}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-600 dark:text-zinc-300 font-bold truncate">
                                                            Đã bị từ chối/hủy
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={() => startEdit(ass)}
                                                            className="p-1 text-zinc-400 hover:text-blue-500 transition-colors"
                                                            title="Sửa"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-[9px] text-zinc-500 font-medium flex flex-wrap gap-x-2">
                                                    <span>Lô: {ass.production_date ? format(new Date(ass.production_date), 'dd/MM') : '---'}</span>
                                                    <span>Tạo lúc: {ass.created_at ? format(new Date(ass.created_at), 'HH:mm') : '---'}</span>
                                                </div>
                                            </div>
                                            <div className="absolute top-1/2 -translate-y-1/2 right-2 text-red-100 dark:text-red-900/40 pointer-events-none">
                                                <X size={48} strokeWidth={3} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Lot Directory (Sidebar) */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between mb-2 px-2">
                        <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            Danh sách LOT trong ngày ({lotsInDay.length})
                        </h2>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-2 space-y-2 sticky top-6">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                <input 
                                    placeholder="Tìm mã LOT hoặc STT..."
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold outline-none"
                                />
                            </div>
                        </div>

                        <div className="max-h-[600px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                            {lotsInDay.length === 0 ? (
                                <div className="text-center py-10 opacity-50">
                                    <Package size={24} className="mx-auto mb-2 text-zinc-300" />
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Ngày này chưa có LOT nào</p>
                                </div>
                            ) : lotsInDay.sort((a,b) => (a.daily_seq||0) - (b.daily_seq||0)).map((lot) => (
                                <div key={lot.id} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-2xl border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 transition-all group">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-zinc-100 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-[10px] font-black text-zinc-900 dark:text-white">
                                                #{lot.daily_seq}
                                            </div>
                                            <span className="text-xs font-black text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">{lot.code}</span>
                                        </div>
                                        {(lot as any).lot_id && (
                                            <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black">CÓ VỊ TRÍ</div>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-zinc-400 line-clamp-1 italic pl-9">{lot.product_names?.join(', ')}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
