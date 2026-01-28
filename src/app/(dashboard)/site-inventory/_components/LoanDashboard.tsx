'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Hammer, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { loanService } from '@/services/site-inventory/loanService'
import { useSystem } from '@/contexts/SystemContext'
import { LoanIssueModal } from './LoanIssueModal'
import { LoanReturnModal } from './LoanReturnModal'
import { format } from 'date-fns'

export const LoanDashboard = () => {
    const { systemType } = useSystem()
    const [loans, setLoans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
    const [selectedLoan, setSelectedLoan] = useState<any>(null) // For return modal
    const [searchTerm, setSearchTerm] = useState('')

    const [error, setError] = useState<any>(null)

    useEffect(() => {
        if (systemType) fetchLoans()
    }, [systemType])

    const fetchLoans = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await loanService.getActiveLoans(supabase, systemType!)
            setLoans(data || [])
        } catch (error: any) {
            console.error('Fetch Loans Error:', JSON.stringify(error, null, 2))
            setError(error)
        } finally {
            setLoading(false)
        }
    }

    const filteredLoans = loans.filter(loan =>
        loan.worker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.products?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-center animate-in fade-in zoom-in-95 duration-200">
                <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Đã xảy ra lỗi khi tải dữ liệu</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mb-4 max-w-md mx-auto">
                    {error.message || 'Lỗi không xác định. Vui lòng kiểm tra Console để biết chi tiết.'}
                </p>
                <div className="text-left bg-white dark:bg-black/20 p-4 rounded border border-red-100 dark:border-red-900/50 text-xs font-mono overflow-auto max-h-40 mb-4 mx-auto max-w-lg">
                    <pre>{JSON.stringify(error, null, 2)}</pre>
                </div>
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
                        placeholder="Tìm theo tên người mượn, tên công cụ..."
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border-none rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setIsIssueModalOpen(true)}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Cho Mượn Đồ
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-stone-400" /></div>
            ) : filteredLoans.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border border-dashed border-stone-200 dark:border-zinc-700">
                    <Hammer className="mx-auto text-stone-300 dark:text-zinc-600 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-stone-500 dark:text-zinc-400">Không có công cụ nào đang được mượn</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLoans.map(loan => (
                        <div key={loan.id} className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-bold text-stone-900 dark:text-gray-100 line-clamp-1">{loan.products?.name}</h4>
                                    <p className="text-xs text-stone-500">{loan.products?.sku}</p>
                                </div>
                                <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-bold px-2.5 py-1 rounded-lg border border-orange-100 dark:border-orange-800/50">
                                    {loan.quantity} {loan.unit}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 mb-4 p-3 bg-stone-50 dark:bg-zinc-900/50 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-stone-600 dark:text-gray-300 text-xs">
                                    {loan.worker_name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-stone-800 dark:text-gray-200">{loan.worker_name}</div>
                                    <div className="text-[10px] text-stone-500">Mượn: {format(new Date(loan.loan_date), 'dd/MM/yyyy HH:mm')}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedLoan(loan)}
                                className="w-full py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold text-sm text-stone-600 dark:text-stone-400 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={16} />
                                Trả đồ
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <LoanIssueModal
                isOpen={isIssueModalOpen}
                onClose={() => setIsIssueModalOpen(false)}
                onSuccess={() => fetchLoans()}
            />

            {selectedLoan && (
                <LoanReturnModal
                    loan={selectedLoan}
                    onClose={() => setSelectedLoan(null)}
                    onSuccess={() => fetchLoans()}
                />
            )}
        </div>
    )
}
