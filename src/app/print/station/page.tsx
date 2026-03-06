'use client'

import { useEffect, useState, useRef, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import {
    Printer, Wifi, WifiOff, Loader2, CheckCircle2,
    Activity, LayoutGrid, Clock, Bell,
    Layers, Package, Check, Trash2, ArrowUp
} from 'lucide-react'
import QRCode from 'react-qr-code'
import { format } from 'date-fns'

// --- Types ---
interface PrintJob {
    id: string
    lot_code: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    created_at: string
    print_data: {
        scan_url: string
        product_name: string
        quantity: number
        unit: string
        products: any[]
        company_prefix?: string
    }
}

interface LogEntry {
    id: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    timestamp: Date
}

export default function PrintStationPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
                <p className="italic text-zinc-400">Đang khởi động hệ thống in...</p>
            </div>
        }>
            <PrintStationContent />
        </Suspense>
    )
}

function PrintStationContent() {
    const searchParams = useSearchParams()
    const jobIdParam = searchParams.get('jobId')
    const silentParam = searchParams.get('silent') === 'true'

    const { currentSystem } = useSystem()
    const [jobs, setJobs] = useState<PrintJob[]>([])
    const [history, setHistory] = useState<PrintJob[]>([])
    const [lastPrinted, setLastPrinted] = useState<PrintJob | null>(null)
    const [logs, setLogs] = useState<LogEntry[]>([])

    // Auth & System bypass
    const token = searchParams.get('token')
    const [isAuthenticating, setIsAuthenticating] = useState(!!token)

    // UI States
    const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'logs'>('queue')
    const hasPrintedRef = useRef(false)

    // Scoped client for Bot/Silent mode (uses token if provided)
    const scopedSupabase = useMemo(() => {
        if (silentParam && token && typeof window !== 'undefined') {
            try {
                return createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    token
                )
            } catch (e) {
                console.error("Failed to create scoped client", e)
            }
        }
        return supabase
    }, [silentParam, token])

    // Statistics
    const stats = useMemo(() => {
        const completed = history.length
        const pending = jobs.length
        const totalToday = completed + pending
        return { totalToday, completed, pending }
    }, [history, jobs])

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const newLog: LogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            message,
            type,
            timestamp: new Date()
        }
        setLogs(prev => [newLog, ...prev].slice(0, 100))
    }

    // Load initial data
    useEffect(() => {
        if (!currentSystem && !silentParam) return

        const fetchJobs = async () => {
            const { data: pendingJobs } = await (supabase as any).from('print_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })

            if (pendingJobs) setJobs(pendingJobs)

            const { data: historyJobs } = await (supabase as any).from('print_queue')
                .select('*')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(20)

            if (historyJobs) setHistory(historyJobs)
        }

        fetchJobs()

        const channel = supabase.channel('print_queue_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'print_queue'
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newJob = payload.new as PrintJob
                    setJobs(prev => [...prev, newJob])
                    addLog(`Nhiệm vụ mới: ${newJob.lot_code}`, 'info')
                } else if (payload.eventType === 'UPDATE') {
                    const updatedJob = payload.new as PrintJob
                    if (updatedJob.status === 'completed') {
                        setJobs(prev => prev.filter(j => j.id !== updatedJob.id))
                        setHistory(prev => [updatedJob, ...prev].slice(0, 20))
                        setLastPrinted(updatedJob)
                    } else if (updatedJob.status === 'pending') {
                        // Update existing pending job (for prioritization/re-ordering)
                        setJobs(prev => {
                            const filtered = prev.filter(j => j.id !== updatedJob.id)
                            const newQueue = [...filtered, updatedJob].sort((a, b) =>
                                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                            )
                            return newQueue
                        })
                    }
                } else if (payload.eventType === 'DELETE') {
                    const deletedId = payload.old.id
                    setJobs(prev => prev.filter(j => j.id !== deletedId))
                    addLog(`Đã xóa lệnh in: ${deletedId}`, 'warning')
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [currentSystem, isAuthenticating])

    // Auth Token Handling
    useEffect(() => {
        if (token) {
            // If token is present, we consider auth "handled" by scopedSupabase or setSession
            setIsAuthenticating(false)
        }
    }, [token])

    // Silent Print Logic for External Bot (Double-trigger protection)
    useEffect(() => {
        if (!silentParam || !jobIdParam || hasPrintedRef.current) return

        const runSilentPrint = async () => {
            hasPrintedRef.current = true // Chặn ngay lập tức
            const { data: job } = await (supabase as any).from('print_queue')
                .select('*')
                .eq('id', jobIdParam)
                .single()

            if (job) {
                setLastPrinted(job)
                addLog(`Bot yêu cầu in: ${job.lot_code}`, 'success')
                await new Promise(r => setTimeout(r, 1000))
                // window.print() // Tạm dừng in theo yêu cầu để kiểm tra
            }
        }
        runSilentPrint()
    }, [silentParam, jobIdParam, currentSystem])

    // --- Action Handlers ---
    const handleDeleteJob = async (jobId: string) => {
        console.log('Deleting job:', jobId)
        // Optimistic UI update
        setJobs(prev => prev.filter(j => j.id !== jobId))

        try {
            const { error } = await (scopedSupabase as any).from('print_queue').delete().eq('id', jobId)
            if (error) {
                console.error('Delete error:', error)
                addLog(`Lỗi khi xóa: ${error.message}`, 'error')
                // Re-fetch to restore state if error
                const { data } = await (supabase as any).from('print_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true })
                if (data) setJobs(data)
            } else {
                addLog(`Đã gửi lệnh xóa: ${jobId}`, 'info')
            }
        } catch (error: any) {
            console.error('Delete catch:', error)
            addLog(`Lỗi ngoại lệ: ${error.message}`, 'error')
        }
    }

    const handlePrioritizeJob = async (job: PrintJob) => {
        console.log('Prioritizing job:', job.lot_code)
        if (jobs.length <= 1) return

        // 1. Calculate new date
        const earliest = new Date(jobs[0].created_at).getTime()
        const newDate = new Date(earliest - 2000).toISOString() // Move explicitly 2 seconds before start

        // 2. Optimistic UI update
        const updatedJob = { ...job, created_at: newDate }
        setJobs(prev => {
            const filtered = prev.filter(j => j.id !== job.id)
            return [updatedJob, ...filtered].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
        })

        try {
            const { error } = await (scopedSupabase as any)
                .from('print_queue')
                .update({ created_at: newDate })
                .eq('id', job.id)

            if (error) {
                console.error('Prioritize error:', error)
                addLog(`Lỗi khi ưu tiên: ${error.message}`, 'error')
                // Re-fetch to restore state if error
                const { data } = await (supabase as any).from('print_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true })
                if (data) setJobs(data)
            } else {
                addLog(`Đã đẩy bài: ${job.lot_code} lên đầu`, 'success')
            }
        } catch (error: any) {
            console.error('Prioritize catch:', error)
            addLog(`Lỗi ngoại lệ: ${error.message}`, 'error')
        }
    }

    const handlePrintJob = async (job: PrintJob) => {
        try {
            setLastPrinted(job)
            addLog(`Đang gửi lệnh in: ${job.lot_code}`, 'info')

            // Trigger print
            setTimeout(() => window.print(), 100)

            // Update status to completed in database
            const { error } = await (scopedSupabase as any)
                .from('print_queue')
                .update({ status: 'completed' })
                .eq('id', job.id)

            if (error) {
                console.error('Update status error:', error)
                addLog(`Lỗi cập nhật trạng thái: ${error.message}`, 'error')
            } else {
                addLog(`Đã in xong: ${job.lot_code}`, 'success')
            }
        } catch (error: any) {
            console.error('Print handler catch:', error)
            addLog(`Lỗi in: ${error.message}`, 'error')
        }
    }

    if (silentParam) {
        return (
            <div className="bg-white min-h-screen p-8 flex items-center justify-center">
                {!lastPrinted ? (
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto mb-4" />
                        <p className="text-slate-400 italic">Đang tải dữ liệu nhãn in (Job: {jobIdParam})...</p>
                        {isAuthenticating && <p className="text-[10px] text-slate-300 mt-2">Đang thiết lập phiên làm việc với Token...</p>}
                    </div>
                ) : (
                    <div id="print-area" className="block bg-white w-[90mm] h-[60mm] overflow-hidden relative border border-slate-100">
                        <div className="border border-black h-full p-2.5 flex flex-col items-center justify-between font-sans text-black box-border">
                            <div className="w-full text-left">
                                <div className="flex justify-between items-start w-full border-b border-black pb-1 mb-1">
                                    <div className="text-left flex-1">
                                        <h1 className="font-black text-lg leading-none">{(lastPrinted.print_data.company_prefix || 'TOAN THANG').toUpperCase()}</h1>
                                        <p className="text-[9px] uppercase font-bold opacity-60">SYSTEM TRACEABILITY</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black font-mono">{lastPrinted.lot_code}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 w-full mt-2 items-center">
                                    <QRCode value={lastPrinted.print_data.scan_url} size={150} />
                                    <div className="flex-1 space-y-2">
                                        {lastPrinted.print_data.products?.slice(0, 1).map((p: any, idx: number) => (
                                            <div key={idx}>
                                                <p className="text-[13px] font-black uppercase leading-tight">{p.name}</p>
                                                <p className="text-[18px] font-black italic mt-1">{p.quantity} {p.unit}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (!currentSystem && !silentParam) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <WifiOff className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2 font-display">Hệ thống chưa kết nối</h2>
                <p className="text-slate-500 max-w-md">Vui lòng quay lại Dashboard để khởi tạo phiên làm việc trước khi sử dụng trạm in.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500/30">
            {/* --- Dedicated Print Container (Hidden in UI) --- */}
            {lastPrinted && (
                <div id="print-label-container" className="hidden print:block fixed inset-0 z-[9999] bg-white">
                    <div className="w-[90mm] h-[60mm] text-black bg-white overflow-hidden p-0 m-0">
                        <div className="border border-black h-full p-2.5 flex flex-col items-center justify-between font-sans text-black box-border">
                            <div className="w-full text-left">
                                <div className="flex justify-between items-start w-full border-b border-black pb-1 mb-1">
                                    <div className="text-left flex-1">
                                        <h1 className="font-black text-lg leading-none">{(lastPrinted.print_data.company_prefix || 'TOAN THANG').toUpperCase()}</h1>
                                        <p className="text-[9px] uppercase font-bold opacity-60">SYSTEM TRACEABILITY</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black font-mono">{lastPrinted.lot_code}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 w-full mt-2 items-center">
                                    <QRCode value={lastPrinted.print_data.scan_url} size={150} />
                                    <div className="flex-1 space-y-2">
                                        {lastPrinted.print_data.products?.slice(0, 1).map((p: any, idx: number) => (
                                            <div key={idx}>
                                                <p className="text-[13px] font-black uppercase leading-tight">{p.name}</p>
                                                <p className="text-[18px] font-black italic mt-1">{p.quantity} {p.unit}</p>
                                            </div>
                                        ))}
                                        {!lastPrinted.print_data.products && (
                                            <div>
                                                <p className="text-[13px] font-black uppercase leading-tight">{lastPrinted.print_data.product_name}</p>
                                                <p className="text-[18px] font-black italic mt-1">{lastPrinted.print_data.quantity} {lastPrinted.print_data.unit}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Main UI Content (Hidden during print) --- */}
            <div className="print:hidden">
                {/* --- Background Elements --- */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[45%] bg-emerald-100/40 blur-[120px] rounded-full" />
                    <div className="absolute bottom-[-10%] left-[-5%] w-[45%] h-[45%] bg-blue-100/40 blur-[120px] rounded-full" />
                </div>

                {/* --- Top Navigation / Header --- */}
                <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur-xl px-6 py-4">
                    <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Printer className="text-white" size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-slate-900">
                                    PRINT STATION
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-mono text-slate-500">V9.6</span>
                                </h1>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5 uppercase font-bold tracking-wider">
                                    <Activity size={10} className="text-emerald-500 animate-pulse" />
                                    Monitoring: LIVE
                                    <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full text-[9px] animate-pulse border border-blue-200">
                                        BOT ACTIVE
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold italic">
                                <Wifi size={14} className="text-emerald-500" />
                                Supabase Connected
                            </div>
                        </div>
                    </div>
                </header>

                {/* Bot Trigger - Fixed ID for Automation */}
                {lastPrinted && (
                    <button
                        id="bot-print-trigger"
                        className="sr-only" // Screen reader only (hidden from UI but clickable by bot)
                        onClick={() => window.print()}
                    >
                        Print Latest
                    </button>
                )}

                <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6 pb-20">
                    {/* --- Left Column: Dashboard & Preview --- */}
                    <div className="col-span-12 lg:col-span-8 space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: 'Tổng in hôm nay', value: stats.totalToday, icon: LayoutGrid, color: 'blue' },
                                { label: 'Hoàn thành', value: stats.completed, icon: CheckCircle2, color: 'green' },
                                { label: 'Đang xếp hàng', value: stats.pending, icon: Clock, color: 'amber' }
                            ].map((s, i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm group hover:border-emerald-500/30 transition-all duration-300">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className={`p-2 rounded-lg bg-${s.color}-500/10`}>
                                            <s.icon size={18} className={`text-${s.color}-500`} />
                                        </div>
                                        <span className="text-2xl font-black text-slate-800">{s.value}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Main Work Area / Preview */}
                        <div className="relative bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-md min-h-[500px] flex flex-col">
                            <div className="absolute top-0 right-0 p-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black border bg-emerald-50 text-emerald-600 border-emerald-100 transition-all">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    REAL-TIME SYNC: ACTIVE
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center p-12">
                                {lastPrinted ? (
                                    <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center text-center">
                                        <div className="text-xs font-black text-blue-500 mb-4 bg-blue-500/10 px-4 py-1.5 rounded-full uppercase tracking-[0.2em]">
                                            Ready for Next
                                        </div>

                                        {/* Glass Preview Card */}
                                        <div className="bg-white p-6 rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.1)] scale-110">
                                            <div className="w-[90mm] h-[60mm] text-black">
                                                <div className="border-2 border-black h-full p-3 rounded-lg flex flex-col justify-between">
                                                    <div className="border-b border-black pb-2 mb-2">
                                                        <h2 className="font-black text-xl leading-none">{(lastPrinted.print_data.company_prefix || 'ANY').toUpperCase()} AREA</h2>
                                                        <p className="text-[10px] font-bold opacity-70">CONTROLLED LOT: {lastPrinted.lot_code}</p>
                                                    </div>
                                                    <div className="flex gap-4 items-center text-left">
                                                        <QRCode value={lastPrinted.print_data.scan_url} size={150} />
                                                        <div className="space-y-3">
                                                            <div className="bg-black text-white px-3 py-1 text-[11px] font-black rounded w-fit uppercase">
                                                                Warehouse Product
                                                            </div>
                                                            <p className="text-lg font-black uppercase leading-[1.1]">{lastPrinted.print_data.product_name}</p>
                                                            <p className="text-2xl font-black italic">{lastPrinted.print_data.quantity} {lastPrinted.print_data.unit}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-8 flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-green-500/20 flex items-center justify-center"><Check size={14} className="text-green-500" /></div>)}
                                            </div>
                                            <p className="text-sm text-zinc-500 italic">Vừa xử lý xong: {lastPrinted.lot_code}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center group">
                                        <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-500 group-hover:border-blue-500/50">
                                            <Layers className="text-zinc-600 group-hover:text-blue-500 transition-colors" size={40} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-700">Sẵn sàng nhận lệnh</h3>
                                        <p className="text-slate-400 max-w-[280px] mx-auto mt-2 text-sm leading-relaxed">Gửi lệnh in từ thiết bị cầm tay để bắt đầu quy trình tự động.</p>
                                    </div>
                                )}
                            </div>

                            {/* Recent History Grid Inside Main Area */}
                            <div className="bg-slate-50/50 border-t border-slate-100 p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Lịch sử vừa in</h3>
                                    <button onClick={() => setActiveTab('history')} className="text-[10px] text-slate-500 hover:text-emerald-600 transition-colors uppercase font-bold">Xem tất cả</button>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    {history.slice(0, 4).map((h) => (
                                        <div key={h.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-all">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-bold text-slate-700 truncate">{h.lot_code}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-mono italic">{format(new Date(h.created_at), 'HH:mm')}</p>
                                        </div>
                                    ))}
                                    {history.length === 0 && <div className="col-span-4 py-4 text-center text-slate-300 text-xs italic">Chưa có lịch sử</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- Right Column: Tabs (Queue, Logs) --- */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden flex flex-col h-full max-h-[850px]">
                            {/* Tab Switcher */}
                            <div className="flex border-b border-slate-100 bg-slate-50/50">
                                {(['queue', 'history', 'logs'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-emerald-600 border-b-2 border-emerald-500 bg-white' : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {tab === 'queue' ? 'Hàng chờ' : tab === 'history' ? 'Lịch sử' : 'Nhật ký'}
                                        {tab === 'queue' && jobs.length > 0 && <span className="ml-2 bg-emerald-500 text-white px-1.5 rounded-full text-[9px]">{jobs.length}</span>}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {activeTab === 'queue' && (
                                    <div className="space-y-3">
                                        {jobs.map((job, idx) => (
                                            <div key={job.id} className="group bg-slate-50 border border-slate-100 rounded-2xl p-4 hover:border-emerald-300 transition-all shadow-sm">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">Priority: {idx + 1}</span>
                                                        <h4 className="font-bold text-slate-800 mt-0.5">{job.lot_code}</h4>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">{job.print_data.product_name}</p>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handlePrioritizeJob(job)}
                                                                className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-all border border-blue-100"
                                                                title="Ưu tiên (Karaoke style)"
                                                            >
                                                                <ArrowUp size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteJob(job.id)}
                                                                className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-100"
                                                                title="Xóa lệnh này"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                            <button
                                                                id={`job-print-${job.id}`}
                                                                onClick={() => handlePrintJob(job)}
                                                                className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                                                                title="In nhãn này"
                                                            >
                                                                <Printer size={16} />
                                                            </button>
                                                        </div>
                                                        <div className="w-10 h-10 rounded-xl bg-slate-200/50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                                                            <Package size={18} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                                    <span className="text-[10px] font-mono text-slate-400">{format(new Date(job.created_at), 'HH:mm:ss')}</span>
                                                    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-amber-100">
                                                        <Loader2 size={10} className="animate-spin" />
                                                        Pending
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {jobs.length === 0 && (
                                            <div className="text-center py-20">
                                                <Bell size={32} className="mx-auto text-slate-200 mb-4" />
                                                <p className="text-sm text-slate-400 font-bold italic">Không có lệnh in nào đang chờ</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'history' && (
                                    <div className="space-y-2">
                                        {history.map(job => (
                                            <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle2 className="text-emerald-500" size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between">
                                                        <p className="text-xs font-bold text-slate-700 truncate">{job.lot_code}</p>
                                                        <span className="text-[10px] text-slate-400">{format(new Date(job.created_at), 'HH:mm')}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 truncate">{job.print_data.product_name}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {history.length === 0 && <div className="text-center py-20 text-slate-300 italic">Lịch sử trống</div>}
                                    </div>
                                )}

                                {activeTab === 'logs' && (
                                    <div className="font-mono text-[10px] space-y-2 bg-slate-900 p-3 rounded-xl min-h-full">
                                        {logs.map(log => (
                                            <div key={log.id} className="flex gap-2">
                                                <span className="text-slate-500 flex-shrink-0">[{format(log.timestamp, 'HH:mm:ss')}]</span>
                                                <span className={`${log.type === 'error' ? 'text-red-400' :
                                                    log.type === 'warning' ? 'text-amber-400' :
                                                        log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'
                                                    }`}>
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))}
                                        {logs.length === 0 && <div className="text-slate-500 italic">No logs generated...</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <style jsx global>{`
                @font-face {
                    font-family: 'Inter';
                    src: url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                }
                .font-display { font-family: 'Inter', sans-serif; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }

                @media print {
                    @page {
                        size: 90mm 60mm;
                        margin: 0;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 60mm !important;
                        width: 90mm !important;
                        overflow: hidden !important;
                    }
                    .print\:hidden {
                        display: none !important;
                    }
                    #print-label-container {
                        display: block !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 90mm !important;
                        height: 60mm !important;
                        background: white !important;
                        visibility: visible !important;
                        z-index: 99999 !important;
                    }
                }
            `}</style>
        </div>
    )
}
