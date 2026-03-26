'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, Hammer, AlertCircle, RefreshCw, CheckCircle2, Factory, Edit2, Trash2, ChevronDown, ChevronUp, Package, MoreVertical, Info, X, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { LoanIssueModal } from './LoanIssueModal'
import { LoanReturnModal } from './LoanReturnModal'
import { LoanEditModal } from './LoanEditModal'
import { format } from 'date-fns'

interface LoanDashboardProps {
    isInboundOpen: boolean
    setIsInboundOpen: (open: boolean) => void
}

interface BatchGroup {
    batchId: string | null
    loans: any[]
    workerName: string
    loanDate: string
    production: any | null
    notes: string | null
}

export const LoanDashboard: React.FC<LoanDashboardProps> = ({ isInboundOpen, setIsInboundOpen }) => {
    const { systemType } = useSystem()
    const { showToast } = useToast()
    const [loans, setLoans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
    const [appendingBatch, setAppendingBatch] = useState<BatchGroup | null>(null) // For appending to existing batch
    const [editingBatch, setEditingBatch] = useState<BatchGroup | null>(null) // For batch info edit
    const [viewingBatch, setViewingBatch] = useState<BatchGroup | null>(null) // For viewing full details
    const [selectedBatch, setSelectedBatch] = useState<any[] | null>(null) // For return modal (array of loans)
    const [editingLoan, setEditingLoan] = useState<any>(null) // For edit modal
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedProductionId, setSelectedProductionId] = useState<string>('all')
    const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    const [error, setError] = useState<any>(null)

    useEffect(() => {
        if (systemType) fetchLoans()
    }, [systemType])

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fetchLoans = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await productionLoanService.getActiveLoans(supabase, systemType!)
            setLoans(data || [])
        } catch (error: any) {
            console.error('Fetch Loans Error:', JSON.stringify(error, null, 2))
            setError(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteBatch = async (batch: BatchGroup) => {
        if (!window.confirm(`Bạn có chắc muốn XÓA TOÀN BỘ lệnh cấp phát này?\n- Người nhận: ${batch.workerName}\n- Số lượng: ${batch.loans.length} sản phẩm\n\nHệ thống sẽ tự động HOÀN LẠI tồn kho cho toàn bộ sản phẩm.`)) {
            return
        }

        setLoading(true)
        try {
            for (const loan of batch.loans) {
                await productionLoanService.deleteLoan(supabase, loan)
            }
            showToast('Đã xóa toàn bộ lệnh và hoàn lại tồn kho', 'success')
            fetchLoans()
        } catch (error: any) {
            showToast(error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (loan: any) => {
        if (!window.confirm(`Bạn có chắc muốn XÓA cấp phát này?\n- Vật tư: ${loan.products?.name}\n- Người nhận: ${loan.worker_name}\n\nLưu ý: Hệ thống sẽ tự động HOÀN LẠI số lượng tồn kho tương ứng.`)) {
            return
        }

        try {
            await productionLoanService.deleteLoan(supabase, loan)
            showToast('Đã xóa và hoàn lại tồn kho', 'success')
            fetchLoans()
        } catch (error: any) {
            showToast(error.message, 'error')
        }
    }

    // Group loans by batch_id
    const groupByBatch = (loanList: any[]): BatchGroup[] => {
        const groups: Record<string, BatchGroup> = {}
        const standalone: BatchGroup[] = []

        loanList.forEach(loan => {
            if (loan.batch_id) {
                if (!groups[loan.batch_id]) {
                    groups[loan.batch_id] = {
                        batchId: loan.batch_id,
                        loans: [],
                        workerName: loan.worker_name || 'Không tên',
                        loanDate: loan.loan_date || loan.created_at,
                        production: (Array.isArray(loan.productions) ? loan.productions[0] : loan.productions) || null,
                        notes: loan.notes
                    }
                }
                groups[loan.batch_id].loans.push(loan)
            } else {
                // Loans without batch_id → standalone card
                standalone.push({
                    batchId: loan.id, // use loan id as key
                    loans: [loan],
                    workerName: loan.worker_name || 'Không tên',
                    loanDate: loan.loan_date || loan.created_at,
                    production: (Array.isArray(loan.productions) ? loan.productions[0] : loan.productions) || null,
                    notes: loan.notes
                })
            }
        })

        return [...Object.values(groups), ...standalone].sort(
            (a, b) => new Date(b.loanDate || 0).getTime() - new Date(a.loanDate || 0).getTime()
        )
    }

    // Get unique productions from current loans to build the filter
    const uniqueProductions = Array.from(new Set(
        loans.filter(l => l.productions).map(l => {
            const p = Array.isArray(l.productions) ? l.productions[0] : l.productions
            if (!p) return null
            return JSON.stringify({ id: p.id, code: p.code, name: p.name })
        }).filter(Boolean)
    )).map(s => JSON.parse(s as string))

    const filteredLoans = loans.filter(loan => {
        const wn = (loan.worker_name || '').toLowerCase()
        const pn = (loan.products?.name || '').toLowerCase()
        const ps = (loan.products?.sku || '').toLowerCase()
        const st = searchTerm.toLowerCase()
        const matchesSearch = wn.includes(st) || pn.includes(st) || ps.includes(st)
        
        const matchesProduction = selectedProductionId === 'all' || loan.production_id === selectedProductionId

        return matchesSearch && matchesProduction
    })

    const batches = groupByBatch(filteredLoans)

    const toggleBatch = (batchId: string) => {
        setExpandedBatches(prev => {
            const next = new Set(prev)
            if (next.has(batchId)) next.delete(batchId)
            else next.add(batchId)
            return next
        })
    }

    const formatQty = (n: number) => Number(n).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-center animate-in fade-in zoom-in-95 duration-200">
                <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Đã xảy ra lỗi khi tải dữ liệu</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mb-4 max-w-md mx-auto">
                    {error.message || 'Lỗi không xác định.'}
                </p>
                <button
                    onClick={fetchLoans}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                    <RefreshCw size={16} /> Thử lại
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-stone-200 dark:border-zinc-700">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên người nhận, tên vật tư..."
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border-none rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative w-full md:w-64">
                    <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <select
                        value={selectedProductionId}
                        onChange={e => setSelectedProductionId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border-none rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500/20 appearance-none text-sm"
                    >
                        <option value="all">Tất cả Lệnh sản xuất</option>
                        {uniqueProductions.map((p: any) => (
                            <option key={p.id} value={p.id}>Lệnh: {p.code}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setIsInboundOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        <Plus size={20} />
                        Nhập hàng
                    </button>
                    <button
                        onClick={() => setIsIssueModalOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                    >
                        <Plus size={20} />
                        Cấp phát
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-stone-400" /></div>
            ) : batches.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border border-dashed border-stone-200 dark:border-zinc-700">
                    <Hammer className="mx-auto text-stone-300 dark:text-zinc-600 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-stone-500 dark:text-zinc-400">Chưa có vật tư nào được cấp phát</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {batches.map(batch => {
                        const isExpanded = expandedBatches.has(batch.batchId!)
                        const isMulti = batch.loans.length > 1
                        const totalItems = batch.loans.length
                        const totalRemaining = batch.loans.reduce((sum, l) => sum + (Number(l.quantity) - (Number(l.returned_quantity) || 0)), 0)

                        return (
                            <div key={batch.batchId} className="bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all overflow-hidden">
                                {/* Batch Header */}
                                <div className="p-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-zinc-700 flex items-center justify-center font-black text-stone-600 dark:text-gray-300 text-sm flex-shrink-0">
                                        {batch.workerName?.charAt(0) || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {batch.production && (
                                            <div className="font-black text-base text-blue-600 dark:text-blue-400 truncate leading-tight uppercase tracking-tight">
                                                {batch.production.name}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="font-bold text-xs text-stone-800 dark:text-gray-200">{batch.workerName}</span>
                                            {batch.production && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-700 text-stone-500 border border-stone-200 dark:border-zinc-600">
                                                    {batch.production.code}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[9px] text-stone-400 font-bold mt-0.5">
                                            📅 {batch.loanDate ? format(new Date(batch.loanDate), 'dd/MM/yyyy HH:mm') : '---'}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => setViewingBatch(batch)}
                                                className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-xl transition-colors text-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <div className="bg-orange-600 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-lg shadow-orange-500/20 flex flex-col items-center min-w-[70px]">
                                                <span className="text-[9px] font-bold uppercase opacity-80 leading-none mb-0.5">Đang cấp</span>
                                                <span>{formatQty(totalRemaining)}</span>
                                            </div>
                                            <div className="relative" ref={openMenuId === batch.batchId ? menuRef : undefined}>
                                                <button 
                                                    onClick={() => setOpenMenuId(openMenuId === batch.batchId ? null : batch.batchId)}
                                                    className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-xl transition-colors text-stone-400"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>
                                                {openMenuId === batch.batchId && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-stone-100 dark:border-zinc-700 py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <button 
                                                            onClick={() => { setOpenMenuId(null); setEditingBatch(batch) }}
                                                            className="w-full px-4 py-2.5 text-left text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-zinc-700 flex items-center gap-2"
                                                        >
                                                            <Edit2 size={14} className="text-orange-500" /> Sửa thông tin lệnh
                                                        </button>
                                                        <button 
                                                            onClick={() => { setOpenMenuId(null); handleDeleteBatch(batch) }}
                                                            className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                        >
                                                            <Trash2 size={14} /> Xóa toàn bộ lệnh
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {isMulti && (
                                            <span className="text-[9px] font-black text-stone-400 uppercase">{totalItems} sản phẩm</span>
                                        )}
                                    </div>
                                </div>

                                {/* Batch Notes Summary */}
                                {batch.notes && (
                                    <div className="px-4 pb-3 flex items-start gap-2">
                                        <Info className="text-stone-300 flex-shrink-0 mt-0.5" size={12} />
                                        <p className="text-[10px] text-stone-500 italic font-medium line-clamp-1">{batch.notes}</p>
                                    </div>
                                )}

                                {/* Product List */}
                                <div className="border-t border-stone-100 dark:border-zinc-700">
                                    {(isMulti && !isExpanded ? batch.loans.slice(0, 2) : batch.loans).map((loan, idx) => {
                                        const remaining = Number(loan.quantity) - (Number(loan.returned_quantity) || 0)
                                        return (
                                            <div key={loan.id} className={`px-4 py-2.5 flex items-center justify-between gap-2 ${idx > 0 ? 'border-t border-stone-50 dark:border-zinc-700/50' : ''}`}>
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="w-5 h-5 rounded-full bg-stone-100 dark:bg-zinc-700 text-[9px] font-black flex items-center justify-center text-stone-400 flex-shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-xs text-stone-700 dark:text-gray-300 truncate flex items-center gap-1.5">
                                                            {loan.products?.name}
                                                            {loan.tag && (
                                                                <span className="px-1 py-0.5 rounded bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-[8px] font-bold font-mono flex-shrink-0">
                                                                    {loan.tag.replace('@', loan.products?.sku || '')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[9px] text-stone-400 font-medium mt-0.5">
                                                            {(loan.loan_date || loan.created_at) ? format(new Date(loan.loan_date || loan.created_at), 'HH:mm dd/MM') : '---'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-black text-orange-600">{formatQty(remaining)} {loan.unit}</div>
                                                        {Number(loan.returned_quantity) > 0 && (
                                                            <div className="text-[9px] text-emerald-500 font-bold">Đã hoàn trả: {formatQty(loan.returned_quantity)}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* Expand/Collapse for multi-item batches */}
                                    {isMulti && batch.loans.length > 2 && (
                                        <button
                                            onClick={() => toggleBatch(batch.batchId!)}
                                            className="w-full py-1.5 text-[10px] font-black text-blue-500 hover:text-blue-600 uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors border-t border-stone-50 dark:border-zinc-700/50"
                                        >
                                            {isExpanded ? <><ChevronUp size={12} /> Thu gọn</> : <><ChevronDown size={12} /> Xem thêm {batch.loans.length - 2} sản phẩm</>}
                                        </button>
                                    )}
                                </div>

                                {/* Action Footer */}
                                <div className="border-t border-stone-100 dark:border-zinc-700 p-3 flex gap-2">
                                    <button
                                        onClick={() => setAppendingBatch(batch)}
                                        className="flex-1 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-900 font-bold text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        Thêm vật tư
                                    </button>
                                    <button
                                        onClick={() => setSelectedBatch(batch.loans)}
                                        className="flex-1 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold text-xs text-stone-600 dark:text-stone-400 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <CheckCircle2 size={14} />
                                        Hoàn trả / Trả dư
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <LoanIssueModal
                isOpen={isIssueModalOpen || !!appendingBatch}
                onClose={() => { setIsIssueModalOpen(false); setAppendingBatch(null) }}
                onSuccess={() => fetchLoans()}
                existingBatchId={appendingBatch?.batchId || undefined}
                defaultWorkerName={appendingBatch?.workerName || undefined}
                defaultProductionId={appendingBatch?.production?.id || undefined}
            />

            {selectedBatch && (
                <LoanReturnModal
                    loans={selectedBatch}
                    onClose={() => setSelectedBatch(null)}
                    onSuccess={() => fetchLoans()}
                />
            )}

            {editingLoan && (
                <LoanEditModal
                    loan={editingLoan}
                    onClose={() => setEditingLoan(null)}
                    onSuccess={fetchLoans}
                />
            )}

            {editingBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-tight">Cập nhật thông tin Lệnh</h3>
                            <button onClick={() => setEditingBatch(null)}><X size={18} className="text-stone-400" /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-stone-400 uppercase">Người nhận mới</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 rounded-xl bg-stone-50 dark:bg-zinc-800 border-none font-bold text-sm"
                                    value={editingBatch.workerName}
                                    onChange={e => setEditingBatch({...editingBatch, workerName: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-stone-400 uppercase">Lệnh sản xuất</label>
                                <select 
                                    className="w-full p-3 rounded-xl bg-stone-50 dark:bg-zinc-800 border-none font-bold text-sm"
                                    value={editingBatch.production?.id || ''}
                                    onChange={e => {
                                        const pId = e.target.value
                                        const p = uniqueProductions.find(up => up.id === pId)
                                        setEditingBatch({...editingBatch, production: p || null})
                                    }}
                                >
                                    <option value="">-- Tự do --</option>
                                    {uniqueProductions.map((p: any) => (
                                        <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-stone-400 uppercase">Ghi chú lệnh</label>
                                <textarea 
                                    className="w-full p-3 rounded-xl bg-stone-50 dark:bg-zinc-800 border-none font-medium text-xs h-20 resize-none"
                                    value={editingBatch.notes || ''}
                                    onChange={e => setEditingBatch({...editingBatch, notes: e.target.value})}
                                    placeholder="Ghi chú chung cho tất cả sản phẩm..."
                                />
                            </div>
                        </div>

                        <button 
                            onClick={async () => {
                                setLoading(true)
                                try {
                                    for (const loan of editingBatch.loans) {
                                        await (supabase.from('production_loans') as any)
                                            .update({ 
                                                worker_name: editingBatch.workerName,
                                                production_id: editingBatch.production?.id || null,
                                                notes: editingBatch.notes
                                            })
                                            .eq('id', loan.id)
                                    }
                                    showToast('Đã cập nhật thông tin lệnh thành công', 'success')
                                    setEditingBatch(null)
                                    fetchLoans()
                                } catch (e: any) {
                                    showToast(e.message, 'error')
                                } finally {
                                    setLoading(false)
                                }
                            }}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            Lưu thay đổi
                        </button>
                    </div>
                </div>
            )}
            {viewingBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-stone-900 dark:text-white uppercase tracking-tight">Chi tiết sổ cấp phát</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs font-bold text-blue-600 uppercase">{viewingBatch.production?.name || 'Cấp tự do'}</span>
                                    <span className="text-xs font-medium text-stone-400">•</span>
                                    <span className="text-xs font-bold text-stone-500 uppercase">{viewingBatch.workerName}</span>
                                </div>
                            </div>
                            <button onClick={() => setViewingBatch(null)} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl"><X size={24} className="text-stone-400" /></button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-6 space-y-6">
                            {viewingBatch.notes && (
                                <div className="bg-stone-50 dark:bg-zinc-800/50 p-4 rounded-2xl italic text-sm text-stone-600 dark:text-zinc-400 border border-stone-100 dark:border-zinc-800">
                                    " {viewingBatch.notes} "
                                </div>
                            )}

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2">Danh sách vật tư</h4>
                                <div className="divide-y divide-stone-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                    {viewingBatch.loans.map((loan, idx) => {
                                         const remaining = Number(loan.quantity) - (Number(loan.returned_quantity) || 0)
                                         return (
                                            <div key={loan.id} className="p-4 flex items-center justify-between hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs font-black text-stone-300">{(idx + 1).toString().padStart(2, '0')}</span>
                                                    <div>
                                                        <div className="font-bold text-sm text-stone-800 dark:text-gray-200">{loan.products?.name}</div>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">👤 {loan.worker_name || 'Không tên'}</span>
                                                            <span className="text-[10px] text-stone-300">•</span>
                                                            <span className="text-[10px] font-bold text-stone-400 italic">
                                                                📅 {(loan.loan_date || loan.created_at) ? format(new Date(loan.loan_date || loan.created_at), 'HH:mm dd/MM/yyyy') : '---'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right flex flex-col items-end">
                                                        <div className="text-sm font-black text-orange-600">{formatQty(remaining)} {loan.unit}</div>
                                                        <div className="text-[10px] font-bold text-stone-400">Đã cấp: {formatQty(loan.quantity)}</div>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => { setViewingBatch(null); setEditingLoan(loan) }}
                                                            className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-500 rounded-lg transition-colors"
                                                            title="Sửa"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                if(confirm('Bạn có chắc muốn xóa dòng này?')) {
                                                                    setLoading(true)
                                                                    try {
                                                                        await productionLoanService.deleteLoan(supabase, loan)
                                                                        showToast('Đã xóa thành công', 'success')
                                                                        fetchLoans()
                                                                        setViewingBatch(null)
                                                                    } catch (e: any) {
                                                                        showToast(e.message, 'error')
                                                                    } finally {
                                                                        setLoading(false)
                                                                    }
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                         )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-stone-100 dark:border-zinc-800">
                            <button 
                                onClick={() => setViewingBatch(null)}
                                className="w-full py-3 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-300 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
