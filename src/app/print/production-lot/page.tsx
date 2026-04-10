'use client'

import React, { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Printer, Loader2, Hash, BarChart3, RotateCcw, Package, Building2, Calendar, ShieldAlert, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { LotLabel } from '@/components/warehouse/lots/LotLabel'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'

interface ProductionLotData {
    id: string
    lot_code: string
    actual_quantity: number
    planned_quantity: number
    created_at: string
    products: {
        name: string
        sku: string
        unit: string
    }
    productions: {
        code: string
        name: string
    }
}

export default function ProductionLotPrintPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-zinc-500">Đang khởi tạo hệ thống in...</div>}>
            <ProductionLotPrintContent />
        </Suspense>
    )
}

function ProductionLotPrintContent() {
    const searchParams = useSearchParams()
    const lotId = searchParams.get('id')
    const type = searchParams.get('type') || 'label' // 'label' or 'sheet'
    const token = searchParams.get('token')

    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [data, setData] = useState<any | null>(null)
    const { companyInfo, logoSrc } = usePrintCompanyInfo({ token })

    const [isDamagedMode, setIsDamagedMode] = useState(false)
    const [showDamagedModal, setShowDamagedModal] = useState(false)

    // Custom Modal States
    const [showReasonModal, setShowReasonModal] = useState(false)
    const [damagedReason, setDamagedReason] = useState('')
    const [showResetModal, setShowResetModal] = useState(false)
    const [resetPassword, setResetPassword] = useState('')
    const [resetStep, setResetStep] = useState<'password' | 'confirm'>('password')
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

    // Print Config State
    const [printConfig, setPrintConfig] = useState({
        specification: '',
        net_weight: '',
        production_date: new Date().toISOString().split('T')[0],
        packing_date: new Date().toISOString().split('T')[0],
        label_count: 1,
        start_index: 1,
        show_production_date: true,
        show_packing_date: true
    })

    useEffect(() => {
        async function fetchData() {
            if (!lotId) {
                setLoading(false)
                return
            }

            if (token) {
                await supabase.auth.setSession({
                    access_token: token,
                    refresh_token: ''
                })
            }

            const { data: rawData, error } = await supabase
                .from('production_lots')
                .select(`
                    *,
                    products (name, sku, unit),
                    productions (*, customers:customer_id(name))
                `)
                .eq('id', lotId)
                .single()

            const lotData = rawData as any

            if (lotData) {
                setData(lotData)
                
                // Prioritize DB config
                const dbConfig = lotData.print_config || {}
                const localConfigStr = localStorage.getItem(`print_config_${lotId}`)
                const localConfig = localConfigStr ? JSON.parse(localConfigStr) : {}

                const mergedConfig = {
                    ...printConfig,
                    ...localConfig,
                    ...dbConfig
                }

                setPrintConfig(prev => ({
                    ...prev,
                    ...mergedConfig,
                    // Default index logic: Next after last printed
                    start_index: (lotData.last_printed_index || 0) + 1,
                    specification: mergedConfig.specification || lotData.products?.name?.match(/\((.*?)\)/)?.[1] || '',
                    net_weight: mergedConfig.net_weight || (lotData.weight_per_unit ? `${lotData.weight_per_unit} kg` : '')
                }))
            }
            setLoading(false)
        }

        fetchData()
    }, [lotId, token])

    // Autosave config to DB whenever it changes
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (lotId && data && !loading) {
                console.log('Autosaving config to DB...')
                await ((supabase.from('production_lots') as any)
                    .update({ print_config: printConfig })
                    .eq('id', lotId))
                
                // Also update local for redundancy
                localStorage.setItem(`print_config_${lotId}`, JSON.stringify(printConfig))
            }
        }, 1000) // Debounce 1s to avoid spamming DB

        return () => clearTimeout(timer)
    }, [printConfig, lotId, data, loading])

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type })
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
    }

    const handlePrint = async () => {
        if (!data || !lotId) return

        const count = Number(printConfig.label_count) || 0
        const startIndex = Number(printConfig.start_index) || 1

        // Chế độ in hỏng: Mở modal nhập lý do
        if (isDamagedMode) {
            setDamagedReason('')
            setShowReasonModal(true)
            return
        }

        await executePrint('', count, startIndex)
    }

    const executePrint = async (reason: string, count: number, startIndex: number) => {
        setIsSaving(true)
        const lot = data as any
        const updates: any = {
            last_printed_at: new Date().toISOString()
        }

        if (isDamagedMode) {
            updates.damaged_printed_labels = (Number(lot.damaged_printed_labels) || 0) + count

            const { data: { user } } = await supabase.auth.getUser()
            
            const logEntry = {
                timestamp: new Date().toISOString(),
                user_id: user?.id || 'unknown',
                user_email: user?.email || 'unknown',
                quantity: count,
                start_index: startIndex,
                reason: reason
            }

            const existingLogs = Array.isArray(lot.damaged_print_logs) ? lot.damaged_print_logs : []
            updates.damaged_print_logs = [...existingLogs, logEntry]
        } else {
            updates.total_printed_labels = (Number(lot.total_printed_labels) || 0) + count
            updates.last_printed_index = startIndex + count - 1
        }
        
        try {
            const { error } = await ((supabase.from('production_lots') as any)
                .update(updates)
                .eq('id', lotId))

            if (error) throw error

            setData((prev: any) => prev ? { ...prev, ...updates } : null)

            const nextIndex = isDamagedMode ? undefined : updates.last_printed_index + 1
            setTimeout(() => {
                window.print()
                if (nextIndex !== undefined) {
                    setPrintConfig(prev => ({ ...prev, start_index: nextIndex }))
                }
                setIsSaving(false)
            }, 300)
        } catch (err: any) {
            console.error('Lỗi khi lưu sản lượng in:', err)
            showToast('Không thể lưu sản lượng vào Database: ' + (err.message || 'Unknown error'), 'error')
            setIsSaving(false)
        }
    }

    const handleReset = () => {
        setResetPassword('')
        setResetStep('password')
        setShowResetModal(true)
    }

    const executeReset = async () => {
        if (!lotId) return
        const updates = {
            total_printed_labels: 0,
            damaged_printed_labels: 0,
            last_printed_index: 0,
            last_printed_at: null,
            print_config: {},
            damaged_print_logs: []
        }
        const { error } = await ((supabase.from('production_lots') as any).update(updates).eq('id', lotId))
        if (!error) {
            setData((prev: any) => prev ? { ...prev, ...updates } : null)
            setPrintConfig(prev => ({ ...prev, start_index: 1 }))
            setShowResetModal(false)
            showToast('Reset thành công! Tất cả dữ liệu in đã được xóa trắng.', 'success')
        } else {
            showToast('Lỗi khi reset: ' + error.message, 'error')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Đang tải dữ liệu lô hàng...</p>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="text-center p-8 bg-white rounded-3xl border border-zinc-200 shadow-sm">
                    <Hash className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                    <p className="text-rose-500 font-bold">Không tìm thấy dữ liệu lô hàng</p>
                </div>
            </div>
        )
    }

    if (type === 'label') {
        const todayStr = new Date().toLocaleDateString('vi-VN')
        // Generate labels array
        const labels = Array.from({ length: Number(printConfig.label_count) || 0 }).map((_, i) => ({
            index: (Number(printConfig.start_index) || 1) + i
        }))

        return (
            <div className="min-h-screen bg-zinc-100 p-8 flex flex-col items-center gap-6 print:bg-white print:p-0">
                {/* Print Config Form */}
                <div className="print:hidden bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-2xl w-full max-w-4xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-4 bg-orange-500 rounded-2xl text-white shadow-lg shadow-orange-500/20">
                            <Printer size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Cấu hình In Tem Sản Xuất</h2>
                            <p className="text-zinc-500 text-sm font-medium italic">Vui lòng kiểm tra thông tin trước khi in hàng loạt</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Quy cách</label>
                            <input
                                type="text"
                                value={printConfig.specification}
                                onChange={e => setPrintConfig(prev => ({ ...prev, specification: e.target.value }))}
                                className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-bold text-sm text-zinc-800"
                                placeholder="VD: Thùng 12 túi"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Khối lượng tịnh</label>
                            <input
                                type="text"
                                value={printConfig.net_weight}
                                onChange={e => setPrintConfig(prev => ({ ...prev, net_weight: e.target.value }))}
                                className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-bold text-sm text-zinc-800"
                                placeholder="VD: 10 kg"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Ngày Sản Xuất</label>
                            <input
                                type="date"
                                value={printConfig.production_date}
                                onChange={e => setPrintConfig(prev => ({ ...prev, production_date: e.target.value }))}
                                className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-bold text-sm text-zinc-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Ngày đóng gói</label>
                            <input
                                type="date"
                                value={printConfig.packing_date}
                                onChange={e => setPrintConfig(prev => ({ ...prev, packing_date: e.target.value }))}
                                className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-bold text-sm text-zinc-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 px-1">Số lượng Tem cần in</label>
                            <input
                                type="number"
                                min={1}
                                value={printConfig.label_count}
                                onChange={e => setPrintConfig(prev => ({ ...prev, label_count: parseInt(e.target.value) || 1 }))}
                                className="w-full px-4 py-3 rounded-2xl bg-orange-50 border border-orange-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-black text-sm text-orange-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">STT Bắt đầu</label>
                            <input
                                type="number"
                                min={1}
                                value={printConfig.start_index}
                                onChange={e => setPrintConfig(prev => ({ ...prev, start_index: parseInt(e.target.value) || 1 }))}
                                className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all font-bold text-sm text-zinc-800"
                            />
                        </div>
                        
                        <div className="flex flex-col justify-center px-4">
                            <label className="text-[10px] font-black uppercase text-zinc-400 mb-2">Chế độ in</label>
                            <label className="relative inline-flex items-center cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={isDamagedMode} 
                                    onChange={e => {
                                        const goingToDamaged = e.target.checked
                                        setIsDamagedMode(goingToDamaged)
                                        if (!goingToDamaged) {
                                            // Chuyển về chế độ chuẩn: khôi phục STT từ DB
                                            const lastIndex = Number((data as any).last_printed_index) || 0
                                            setPrintConfig(prev => ({ ...prev, start_index: lastIndex + 1 }))
                                        }
                                    }} 
                                    className="sr-only peer" 
                                />
                                <div className="w-14 h-8 bg-zinc-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-500 shadow-inner"></div>
                                <span className={`ml-3 text-sm font-black uppercase tracking-tight transition-colors ${isDamagedMode ? 'text-rose-500' : 'text-zinc-500'}`}>
                                    {isDamagedMode ? 'In bù tem hỏng' : 'In sản xuất chuẩn'}
                                </span>
                            </label>
                        </div>
                        
                        {/* Summary of printed labels */}
                        <div className="md:col-span-2 lg:col-span-4 bg-zinc-900 p-6 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-zinc-900/30">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <BarChart3 className={isDamagedMode ? "text-rose-400" : "text-orange-400"} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-none">Báo cáo sản lượng in</h3>
                                    <div className="flex items-baseline gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black">{(data as any).total_printed_labels || 0}</span>
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase">Tem Đạt</span>
                                        </div>
                                        <div className="w-px h-8 bg-white/10" />
                                        <button 
                                            onClick={() => setShowDamagedModal(true)}
                                            className="flex flex-col text-rose-400 hover:text-rose-300 transition-colors cursor-pointer group/dam"
                                            title="Bấm để xem lịch sử in bù"
                                        >
                                            <span className="text-2xl font-black group-hover/dam:underline">{(data as any).damaged_printed_labels || 0}</span>
                                            <span className="text-[9px] font-bold uppercase">Tem Hỏng ▸</span>
                                        </button>
                                        <div className="w-px h-8 bg-white/10" />
                                        <div className="flex flex-col text-emerald-400">
                                            <span className="text-2xl font-black">{(data as any).last_printed_index || 0}</span>
                                            <span className="text-[9px] font-bold uppercase">STT Cuối</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                    <span className="text-[10px] font-black uppercase text-zinc-500 block leading-none mb-1">Cập nhật lần cuối</span>
                                    <div className="text-xs font-bold text-zinc-300">{(data as any).last_printed_at ? new Date((data as any).last_printed_at).toLocaleString('vi-VN') : '---'}</div>
                                </div>
                                <button 
                                    onClick={handleReset}
                                    className="p-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20"
                                    title="Reset toàn bộ thông số về 0"
                                >
                                    <RotateCcw size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Modal Lịch sử In bù tem hỏng */}
                    {showDamagedModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setShowDamagedModal(false)}>
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <div className="px-6 py-5 bg-gradient-to-r from-rose-500 to-rose-600 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-black text-white uppercase tracking-tight">Lịch sử In bù Tem hỏng</h2>
                                        <p className="text-rose-200 text-xs font-medium mt-0.5">Tổng cộng: {(data as any).damaged_printed_labels || 0} tem / {(Array.isArray((data as any).damaged_print_logs) ? (data as any).damaged_print_logs.length : 0)} lần in</p>
                                    </div>
                                    <button onClick={() => setShowDamagedModal(false)} className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xl font-black transition-colors">✕</button>
                                </div>
                                <div className="overflow-y-auto max-h-[60vh]">
                                    {(() => {
                                        const logs = (data as any).damaged_print_logs
                                        if (!Array.isArray(logs) || logs.length === 0) {
                                            return <div className="p-12 text-center text-zinc-400 font-bold">Chưa có lịch sử in bù tem hỏng</div>
                                        }
                                        return (
                                            <div className="divide-y divide-zinc-100">
                                                {logs.map((log: any, idx: number) => {
                                                    const start = Number(log.start_index) || 1
                                                    const qty = Number(log.quantity) || 0
                                                    const sttList = Array.from({ length: qty }, (_, i) => (start + i).toString().padStart(2, '0'))
                                                    return (
                                                        <div key={idx} className="px-6 py-4 hover:bg-zinc-50/50 transition-colors">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 text-xs font-black flex items-center justify-center">{idx + 1}</span>
                                                                        <div>
                                                                            <div className="text-sm font-bold text-zinc-800">{log.user_email || 'Không xác định'}</div>
                                                                            <div className="text-[10px] text-zinc-400 font-medium">{log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '---'}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="ml-10">
                                                                        <div className="text-xs text-zinc-500 mb-1.5"><span className="font-bold text-zinc-700">Lý do:</span> <span className="italic">{log.reason || '---'}</span></div>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-[10px] font-bold text-zinc-400 uppercase">STT in lại:</span>
                                                                            {sttList.map((stt: string, i: number) => (
                                                                                <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-xs font-black">{stt}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-center bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
                                                                    <span className="text-xl font-black text-rose-600">{qty}</span>
                                                                    <span className="text-[8px] font-bold text-rose-400 uppercase">tem</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-zinc-50 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Xem trước</span>
                            <span className="text-zinc-600 font-bold text-sm italic">Sẵn sàng in {printConfig.label_count} tem từ {printConfig.start_index.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex items-center px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm shadow-emerald-500/5">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                                Đã đồng bộ Database
                            </div>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 bg-zinc-900 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-zinc-900/20"
                            >
                                <Printer size={20} />
                                RA LỆNH IN
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal: Nhập lý do in bù tem hỏng */}
                {showReasonModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setShowReasonModal(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="px-6 py-5 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <AlertTriangle className="text-white" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">In bù tem hỏng</h2>
                                    <p className="text-amber-100 text-xs font-medium">Vui lòng nhập lý do trước khi in</p>
                                </div>
                            </div>
                            <div className="p-6">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Lý do in bù *</label>
                                <textarea
                                    value={damagedReason}
                                    onChange={(e) => setDamagedReason(e.target.value)}
                                    placeholder="VD: Tem bị nhòe mực, tem dán sai vị trí..."
                                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-300 transition-all text-sm text-zinc-800 resize-none h-24"
                                    autoFocus
                                />
                                <div className="flex gap-3 mt-5">
                                    <button
                                        onClick={() => setShowReasonModal(false)}
                                        className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-500 font-bold text-sm hover:bg-zinc-50 transition-all"
                                    >
                                        Huỷ bỏ
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!damagedReason.trim()) return
                                            setShowReasonModal(false)
                                            const count = Number(printConfig.label_count) || 0
                                            const startIndex = Number(printConfig.start_index) || 1
                                            executePrint(damagedReason.trim(), count, startIndex)
                                        }}
                                        disabled={!damagedReason.trim()}
                                        className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm uppercase tracking-wider hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                    >
                                        Xác nhận & In
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal: Reset mật khẩu */}
                {showResetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setShowResetModal(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            {resetStep === 'password' ? (
                                <>
                                    <div className="px-6 py-5 bg-gradient-to-r from-rose-500 to-red-600 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                            <ShieldAlert className="text-white" size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Xác minh bảo mật</h2>
                                            <p className="text-rose-200 text-xs font-medium">Nhập mật khẩu để tiếp tục Reset</p>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block">Mật khẩu quản trị</label>
                                        <input
                                            type="password"
                                            value={resetPassword}
                                            onChange={(e) => setResetPassword(e.target.value)}
                                            placeholder="Nhập mật khẩu..."
                                            className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 transition-all text-sm text-zinc-800"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && resetPassword === 'Chanhthu123') setResetStep('confirm')
                                            }}
                                        />
                                        <div className="flex gap-3 mt-5">
                                            <button
                                                onClick={() => setShowResetModal(false)}
                                                className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-500 font-bold text-sm hover:bg-zinc-50 transition-all"
                                            >
                                                Huỷ bỏ
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (resetPassword === 'Chanhthu123') {
                                                        setResetStep('confirm')
                                                    } else {
                                                        showToast('Sai mật khẩu! Vui lòng thử lại.', 'error')
                                                    }
                                                }}
                                                className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-black text-sm uppercase tracking-wider hover:shadow-lg hover:shadow-rose-500/30 transition-all active:scale-95"
                                            >
                                                Tiếp tục
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
                                            <AlertTriangle className="text-white" size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Xác nhận xóa dữ liệu</h2>
                                            <p className="text-red-200 text-xs font-medium">Hành động này không thể hoàn tác!</p>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5">
                                            <p className="text-sm text-red-700 font-medium leading-relaxed">
                                                Toàn bộ dữ liệu in sẽ bị xóa trắng bao gồm:
                                            </p>
                                            <ul className="mt-2 space-y-1 text-xs text-red-600 font-bold">
                                                <li>• Số lượng Tem Đạt → 0</li>
                                                <li>• Số lượng Tem Hỏng → 0</li>
                                                <li>• STT cuối cùng → 0</li>
                                                <li>• Lịch sử in bù → Xóa sạch</li>
                                            </ul>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setShowResetModal(false)}
                                                className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-500 font-bold text-sm hover:bg-zinc-50 transition-all"
                                            >
                                                Giữ lại
                                            </button>
                                            <button
                                                onClick={executeReset}
                                                className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 text-white font-black text-sm uppercase tracking-wider hover:shadow-lg hover:shadow-red-500/30 transition-all active:scale-95"
                                            >
                                                Xóa tất cả
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Toast Notification */}
                {toast.show && (
                    <div className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 print:hidden ${
                        toast.type === 'success' 
                            ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' 
                            : 'bg-red-50/95 border-red-200 text-red-800'
                    }`}>
                        {toast.type === 'success' 
                            ? <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" /> 
                            : <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
                        }
                        <span className="text-sm font-bold max-w-[300px]">{toast.message}</span>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 text-zinc-400 hover:text-zinc-600">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Labels Preview (90x60mm) */}
                <div id="print-area" className="flex flex-col gap-4 print:gap-0 print:block">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            body * { visibility: hidden !important; }
                            #print-area, #print-area * { visibility: visible !important; }
                            #print-area { 
                                position: absolute !important; 
                                left: 0 !important; 
                                top: 0 !important; 
                                width: 100% !important;
                                display: block !important;
                                background: white !important;
                            }
                            .print-page-break { 
                                page-break-after: always !important; 
                                break-after: page !important;
                                display: block !important;
                                height: 0 !important;
                            }
                            @page { margin: 0; size: 90mm 60mm; }
                        }
                    ` }} />
                    
                    {labels.map((label, idx) => (
                        <div key={idx} className="relative w-[90mm] h-[60mm] bg-white border border-zinc-200 print:border-none overflow-hidden px-4 py-2 flex flex-col justify-between shadow-lg print:shadow-none">
                            {/* Header: LSX Code */}
                            <div className="border-b-2 border-black pb-2">
                                <span className="text-[8px] font-black uppercase text-zinc-500 leading-none">Lệnh sản xuất / Prod. Order</span>
                                <div className="text-2xl font-black text-black leading-none tracking-tighter mt-1">{(data as any).productions?.code}</div>
                            </div>

                            {/* Body: Product Name & SKU */}
                            <div className="flex-1 flex flex-col justify-center py-2">
                                <span className="text-[9px] font-black uppercase text-zinc-400 mb-0.5 leading-none tracking-widest">Sản phẩm / Product</span>
                                <h1 className="text-xl font-black text-black leading-[1.1] uppercase line-clamp-2">{(data as any).products?.name}</h1>
                                <div className="text-[11px] font-black text-zinc-600 mt-1 uppercase tracking-tight">SKU: {(data as any).products?.sku}</div>
                            </div>

                            {/* Details Grid & Dates - Grouped at the bottom */}
                            <div className="flex flex-col border-t border-black pt-1">
                                {/* Row 1: Spec & Weight */}
                                <div className="flex justify-between items-end mb-1">
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-black uppercase text-zinc-400 leading-none">Quy cách / Spec</span>
                                        <span className="text-[11px] font-black text-black leading-tight">{printConfig.specification || '---'}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[7px] font-black uppercase text-zinc-400 leading-none">Khối lượng / Weight</span>
                                        <span className="text-[11px] font-black text-black leading-tight">{printConfig.net_weight || '---'}</span>
                                    </div>
                                </div>

                                {/* Row 2: Customer & STT */}
                                <div className="flex justify-between items-end border-t border-zinc-100 pt-1 mb-1">
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-black uppercase text-zinc-400 leading-none">Khách hàng / Customer</span>
                                        <span className="text-[10px] font-bold text-black leading-tight truncate max-w-[180px]">{(data as any).productions?.customers?.name || 'CHANH THU GROUP'}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[7px] font-black uppercase text-zinc-400 leading-none">STT / Index</span>
                                        <span className="text-xl font-black text-black leading-none">{label.index.toString().padStart(2, '0')}</span>
                                    </div>
                                </div>

                                {/* Row 3: Dates */}
                                <div className="flex justify-between items-center border-t-2 border-dashed border-zinc-200 pt-1">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] font-black uppercase text-zinc-400">Ngày SX:</span>
                                        <span className="text-[10px] font-black text-zinc-900">{new Date(printConfig.production_date).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[7px] font-black uppercase text-zinc-400">Ngày ĐG:</span>
                                        <span className="text-[10px] font-black text-zinc-900">{new Date(printConfig.packing_date).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Print Break */}
                            <div className="print-page-break" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // Sheet mode (A4)
    return (
        <div className="min-h-screen bg-zinc-100 py-12 px-6 flex flex-col items-center gap-8 print:bg-white print:p-0 print:block">
             {/* Print Control UI */}
             <div className="print:hidden bg-white px-6 py-4 rounded-3xl border border-zinc-200 shadow-xl flex items-center gap-6">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Chế độ in</span>
                    <span className="text-sm font-bold text-zinc-800">Phiếu thông tin lô (Sheet A4)</span>
                </div>
                <div className="h-8 w-px bg-zinc-100" />
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-zinc-900 border border-zinc-200 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg"
                >
                    <Printer size={18} />
                    In Phiếu
                </button>
            </div>

            {/* A4 Content Container */}
            <div id="print-sheet" className="bg-white w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl print:shadow-none print:p-0 print:w-full border border-zinc-100 print:border-none">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        body * { visibility: hidden !important; }
                        #print-sheet, #print-sheet * { visibility: visible !important; }
                        #print-sheet { 
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important;
                            height: auto !important;
                            padding: 15mm !important;
                        }
                        @page { margin: 0; size: A4 portrait; }
                    }
                ` }} />

                {/* Header */}
                <PrintHeader companyInfo={companyInfo} logoSrc={logoSrc} size="compact" />

                <div className="mt-12 text-center mb-10">
                    <h1 className="text-3xl font-black uppercase tracking-widest text-zinc-900 mb-2">Phiếu Thông Tin Lô Sản Phẩm</h1>
                    <div className="w-24 h-1.5 bg-orange-500 mx-auto rounded-full" />
                </div>

                <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                    {/* Production Info */}
                    <div className="space-y-6">
                        <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 border-b border-zinc-100 pb-2">Thông tin lệnh sản xuất</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Hash size={16} className="text-orange-500" />
                                    <span className="text-zinc-500 text-sm">Mã lệnh:</span>
                                    <span className="font-bold text-zinc-900 border-b border-dashed border-zinc-200 flex-1">{data.productions?.code}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Package size={16} className="text-orange-500" />
                                    <span className="text-zinc-500 text-sm">Tên lệnh:</span>
                                    <span className="font-bold text-zinc-900 border-b border-dashed border-zinc-200 flex-1">{data.productions?.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Building2 size={16} className="text-orange-500" />
                                    <span className="text-zinc-500 text-sm">Khách hàng:</span>
                                    <span className="font-bold text-zinc-900 border-b border-dashed border-zinc-200 flex-1">{data.productions?.customers?.name || 'CHANH THU GROUP'}</span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 border-b border-zinc-100 pb-2">Thông tin sản phẩm</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Building2 size={16} className="text-blue-500" />
                                    <span className="text-zinc-500 text-sm">Tên SP:</span>
                                    <span className="font-bold text-zinc-900 border-b border-dashed border-zinc-200 flex-1">{data.products?.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Hash size={16} className="text-blue-500" />
                                    <span className="text-zinc-500 text-sm">SKU:</span>
                                    <span className="font-bold text-zinc-900 border-b border-dashed border-zinc-200 flex-1">{data.products?.sku}</span>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Lot Info */}
                    <div className="space-y-6">
                        <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 border-b border-zinc-100 pb-2">Thông tin lô hàng (Lot)</h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mã định danh LOT</div>
                                    <div className="text-2xl font-black text-zinc-900 tracking-tight">{data.lot_code}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar size={16} className="text-emerald-500" />
                                    <span className="text-zinc-500 text-sm">Ngày tạo:</span>
                                    <span className="font-bold text-zinc-900 border-b border-dashed border-zinc-200 flex-1">
                                        {new Date(data.created_at).toLocaleDateString('vi-VN')} {new Date(data.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Package size={16} className="text-emerald-500" />
                                    <span className="text-zinc-500 text-sm">Số lượng thực tế:</span>
                                    <div className="flex-1 flex items-baseline gap-1 border-b border-dashed border-zinc-200 font-bold text-emerald-600 text-lg">
                                        <span>{Number(data.actual_quantity || 0).toLocaleString('vi-VN')}</span>
                                        <span className="text-xs font-bold text-zinc-400 uppercase">{data.products?.unit}</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Additional Details or Signature */}
                <div className="mt-20 grid grid-cols-3 gap-8 text-center">
                    <div>
                        <p className="text-sm font-bold text-zinc-900 mb-16">Người lập phiếu</p>
                        <div className="w-32 h-px bg-zinc-200 mx-auto" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-zinc-900 mb-16">Quản lý sản xuất</p>
                        <div className="w-32 h-px bg-zinc-200 mx-auto" />
                    </div>
                    <div>
                        <p className="text-[10px] font-medium text-zinc-400 italic mb-2">Ngày ..... tháng ..... năm 202...</p>
                        <p className="text-sm font-bold text-zinc-900 mb-16">Thủ kho</p>
                        <div className="w-32 h-px bg-zinc-200 mx-auto" />
                    </div>
                </div>

                <div className="mt-32 pt-6 border-t border-zinc-100 text-[10px] text-zinc-400 text-center font-medium uppercase tracking-[0.2em]">
                    Hệ thống quản lý kho Modular WMS - Chánh Thu Group
                </div>
            </div>
        </div>
    )
}
