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
        label_quantity?: number
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

// --- Components ---
function LabelCard({ job, scale = 1, showBorder = true }: { job: PrintJob, scale?: number, showBorder?: boolean }) {
    const data = job.print_data
    const companyName = (data.company_prefix || 'TOAN THANG').toUpperCase()
    const workArea = (data as any).work_area_name || ''

    return (
        <div
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: scale === 1 ? '100%' : 'auto', height: scale === 1 ? '100%' : 'auto' }}
            className={`bg-white text-black font-sans overflow-hidden transition-all duration-300 ${showBorder ? 'border-[3px] border-black rounded-[2.5rem]' : ''
                }`}
        >
            <div className={`p-10 flex flex-col h-full ${scale < 1 ? 'gap-2' : 'gap-8'}`}>
                {/* Header Section */}
                <div className="text-center space-y-2">
                    <h2 className="text-4xl font-black tracking-tighter leading-none">
                        {workArea ? `${companyName} - ${workArea}` : companyName}
                    </h2>
                    <p className="text-lg font-bold opacity-60 tracking-[0.3em] uppercase">
                        CONTROLLED LOT: {job.lot_code}
                    </p>
                </div>

                {/* Divider Line */}
                <div className="h-[3px] bg-black/20 w-full" />

                {/* Main Content: QR + Info Box */}
                <div className="flex gap-12 items-center flex-1 justify-center">
                    {/* QR Code */}
                    <div className="bg-white p-3 rounded-2xl shadow-inner border border-zinc-200 flex-shrink-0">
                        <QRCode value={data.scan_url} size={scale < 0.5 ? 80 : 200} />
                    </div>

                    {/* Black Info Box */}
                    <div className="flex-1 bg-black text-white p-8 rounded-[2rem] flex flex-col justify-center min-h-[180px] shadow-2xl">
                        <div className="mb-4">
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Inventory Control</span>
                            <h3 className="text-2xl font-black uppercase leading-tight tracking-tight mt-1">Product Details</h3>
                        </div>

                        <div className="space-y-2">
                            {data.products?.slice(0, 1).map((p: any, idx: number) => (
                                <div key={idx}>
                                    <p className="text-2xl font-bold text-emerald-400 leading-tight truncate mb-2">{p.name}</p>
                                    <p className="text-5xl font-black italic tracking-tighter">
                                        {p.quantity} <span className="text-2xl not-italic opacity-60">{p.unit}</span>
                                    </p>
                                </div>
                            ))}
                            {!data.products && (
                                <div>
                                    <p className="text-2xl font-bold text-emerald-400 leading-tight truncate mb-2">{data.product_name}</p>
                                    <p className="text-5xl font-black italic tracking-tighter">
                                        {data.quantity} <span className="text-2xl not-italic opacity-60">{data.unit}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
                        {isAuthenticating && <p className="text-[10px] text-zinc-300 mt-2">Đang thiết lập phiên làm việc với Token...</p>}
                    </div>
                ) : (
                    <div id="print-area" className="block bg-white w-[6in] h-[4in] overflow-hidden relative border border-slate-100">
                        <LabelCard job={lastPrinted} showBorder={false} />
                    </div>
                )}
            </div>
        )
    }

    if (!currentSystem && !silentParam) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                    <WifiOff className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 font-display">Hệ thống chưa kết nối</h2>
                <p className="text-zinc-500 max-w-md italic">Vui lòng quay lại Dashboard để khởi tạo phiên làm việc trước khi sử dụng trạm in.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            {/* --- Dedicated Print Container (Hidden in UI) --- */}
            {lastPrinted && (
                <div id="print-label-container" className="hidden print:block fixed inset-0 z-[9999] bg-white text-black">
                    {Array.from({ length: lastPrinted.print_data.label_quantity || 1 }).map((_, i) => (
                        <div key={i} className="w-[6in] h-[4in] bg-white overflow-hidden p-0 m-0" style={{ pageBreakAfter: 'always' }}>
                            <LabelCard job={lastPrinted} showBorder={false} />
                        </div>
                    ))}
                </div>
            )}

            {/* --- Main UI Content (Hidden during print) --- */}
            <div className="print:hidden">
                {/* --- Background Elements --- */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[45%] bg-emerald-500/10 blur-[120px] rounded-full" />
                    <div className="absolute bottom-[-10%] left-[-5%] w-[45%] h-[45%] bg-blue-500/10 blur-[120px] rounded-full" />
                    <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-zinc-500/5 blur-[80px] rounded-full" />
                </div>

                {/* --- Top Navigation / Header --- */}
                <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur-xl px-6 py-4 shadow-2xl">
                    <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/10">
                                <Printer className="text-white" size={24} />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight flex items-center gap-3 text-white">
                                    PRINT STATION
                                    <span className="text-[10px] bg-zinc-800 px-3 py-1 rounded-full font-mono text-emerald-500 border border-zinc-700">V9.7_REBORN</span>
                                </h1>
                                <p className="text-[10px] text-zinc-500 flex items-center gap-2 uppercase font-black tracking-[0.2em] mt-1">
                                    <Activity size={12} className="text-emerald-500 animate-pulse" />
                                    Monitoring System: <span className="text-emerald-400">ACTIVE</span>
                                    <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[9px] border border-blue-500/30">
                                        REMOTE BOT ACTIVE
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-3 bg-zinc-900 px-5 py-2.5 rounded-2xl border border-zinc-800 text-zinc-400 text-xs font-black tracking-widest uppercase">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                Database Linked
                            </div>
                            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white transition-colors cursor-pointer">
                                <Bell size={18} />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Bot Trigger - Fixed ID for Automation */}
                {lastPrinted && (
                    <button
                        id="bot-print-trigger"
                        className="sr-only"
                        onClick={() => window.print()}
                    >
                        Print Latest
                    </button>
                )}

                <main className="max-w-[1600px] mx-auto p-6 lg:p-10 grid grid-cols-12 gap-8 pb-32">
                    {/* --- Left Column: Dashboard & Preview --- */}
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: 'Tổng hôm nay', value: stats.totalToday, icon: LayoutGrid, color: 'blue' },
                                { label: 'Hoàn thành', value: stats.completed, icon: CheckCircle2, color: 'emerald' },
                                { label: 'Đang đợi', value: stats.pending, icon: Clock, color: 'amber' }
                            ].map((s, i) => (
                                <div key={i} className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-6 backdrop-blur-sm group hover:border-emerald-500/30 transition-all duration-500 shadow-xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-3 rounded-2xl bg-${s.color}-500/10 ring-1 ring-${s.color}-500/20`}>
                                            <s.icon size={22} className={`text-${s.color}-500`} />
                                        </div>
                                        <span className="text-4xl font-black text-white tabular-nums tracking-tighter">{s.value}</span>
                                    </div>
                                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Main Work Area / Preview */}
                        <div className="relative bg-zinc-900/20 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl min-h-[660px] flex flex-col backdrop-blur-md group">
                            {/* Decorative Grid */}
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

                            <div className="absolute top-8 right-10 flex items-center gap-3">
                                <div className="px-4 py-2 rounded-2xl text-[10px] font-black border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 transition-all shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                    <span className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        LIVE SYNC ENABLED
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center p-12">
                                {(lastPrinted || jobs.length > 0) ? (
                                    <div className="animate-in fade-in zoom-in duration-700 flex flex-col items-center text-center">
                                        <div className="text-[10px] font-black text-emerald-400 mb-8 bg-emerald-500/10 px-6 py-2 rounded-full uppercase tracking-[0.3em] border border-emerald-500/20">
                                            {jobs.length > 0 ? 'Current Printing Task' : 'Latest Printed Tag'}
                                        </div>

                                        {/* Label Preview Container */}
                                        <div className="relative p-1 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-[2.5rem] shadow-2xl transition-transform hover:scale-105 duration-500">
                                            <div className="max-w-[600px] w-full aspect-[9/6] overflow-hidden rounded-[2.2rem]">
                                                <LabelCard job={jobs[0] || lastPrinted!} scale={1} />
                                            </div>

                                            {/* Reflection Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none rounded-[2.5rem]" />
                                        </div>

                                        <div className="mt-12 flex flex-col items-center gap-4">
                                            <div className="flex -space-x-3">
                                                {jobs.length > 0 ? (
                                                    <div className="w-10 h-10 rounded-full border-[3px] border-zinc-900 bg-amber-500 flex items-center justify-center shadow-lg animate-pulse">
                                                        <Clock size={18} className="text-zinc-900 font-bold" />
                                                    </div>
                                                ) : (
                                                    [1, 2, 3, 4].map(i => (
                                                        <div key={i} className="w-10 h-10 rounded-full border-[3px] border-zinc-900 bg-emerald-500 flex items-center justify-center shadow-lg">
                                                            <Check size={18} className="text-zinc-900 font-bold" />
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <p className="text-zinc-400 font-bold italic text-sm">
                                                {jobs.length > 0 ? 'Incoming Package: ' : 'Processed Package: '}
                                                <span className="text-white not-italic">{(jobs[0] || lastPrinted!).lot_code}</span>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center group">
                                        <div className="w-32 h-32 bg-zinc-900/50 border border-zinc-800 rounded-[3rem] flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-all duration-700 group-hover:border-emerald-500/30 group-hover:shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                                            <Layers className="text-zinc-700 group-hover:text-emerald-500 transition-colors" size={56} />
                                        </div>
                                        <h3 className="text-2xl font-black text-white tracking-tight">System Ready</h3>
                                        <p className="text-zinc-500 max-w-[320px] mx-auto mt-4 text-sm leading-relaxed font-bold italic uppercase tracking-widest opacity-60">Waiting for Remote Print Signal...</p>
                                    </div>
                                )}
                            </div>

                            {/* Recent History Grid Inside Main Area */}
                            <div className="bg-zinc-950/40 border-t border-zinc-800/60 p-8 backdrop-blur-xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Recently Dispatched</h3>
                                    <button
                                        onClick={() => setActiveTab('history')}
                                        className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors uppercase font-black tracking-widest bg-emerald-500/10 px-4 py-2 rounded-xl"
                                    >
                                        View History
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {history.slice(0, 4).map((h) => (
                                        <div key={h.id} className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 hover:border-emerald-500/40 transition-all group overflow-hidden relative">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                <span className="text-xs font-black text-zinc-300 truncate">{h.lot_code}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-3">
                                                <p className="text-[10px] text-zinc-500 font-black tabular-nums">{format(new Date(h.created_at), 'HH:mm:ss')}</p>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {history.length === 0 && (
                                        <div className="col-span-4 py-8 text-center border-2 border-dashed border-zinc-800 rounded-[2rem]">
                                            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">No Recent Dispatch Data</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- Right Column: Tabs (Queue, Logs) --- */}
                    <div className="col-span-12 lg:col-span-4 space-y-8 h-full">
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full max-h-[1000px] backdrop-blur-xl">
                            {/* Tab Switcher */}
                            <div className="flex p-2 gap-2 border-b border-zinc-800/60 bg-zinc-950/20">
                                {(['queue', 'history', 'logs'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative ${activeTab === tab
                                            ? 'text-white bg-zinc-800 shadow-xl'
                                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                                            }`}
                                    >
                                        {tab === 'queue' ? 'Queue' : tab === 'history' ? 'History' : 'Logs'}
                                        {tab === 'queue' && jobs.length > 0 && (
                                            <span className="absolute top-3 right-4 bg-emerald-500 text-zinc-900 px-2 py-0.5 rounded-full text-[9px] font-black border-2 border-zinc-900">
                                                {jobs.length}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                {activeTab === 'queue' && (
                                    <div className="space-y-4">
                                        {jobs.map((job, idx) => (
                                            <div key={job.id} className="group relative">
                                                {/* Mini Label Design for Queue */}
                                                <div className="bg-zinc-800/40 border border-zinc-800 rounded-[2rem] p-5 hover:border-emerald-500/40 transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">{idx === 0 ? 'NEXT' : `POS ${idx + 1}`}</span>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'}`} />
                                                            </div>
                                                            <h4 className="text-lg font-black text-white tracking-tight">{job.lot_code}</h4>
                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1 italic">
                                                                {(job.print_data as any).work_area_name || 'No Area Assigned'}
                                                            </p>
                                                        </div>
                                                        <div className="bg-zinc-900/80 p-1 rounded-xl shadow-inner border border-zinc-800">
                                                            <QRCode value={job.print_data.scan_url} size={40} />
                                                        </div>
                                                    </div>

                                                    <div className="bg-black/40 rounded-2xl p-3 border border-zinc-800/30 mb-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                                                <Package size={14} className="text-emerald-500" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black text-white truncate uppercase tracking-tight">
                                                                    {job.print_data.products?.[0]?.name || job.print_data.product_name}
                                                                </p>
                                                                <p className="text-xs font-bold text-emerald-400">
                                                                    {job.print_data.products?.[0]?.quantity || job.print_data.quantity} {job.print_data.products?.[0]?.unit || job.print_data.unit}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handlePrioritizeJob(job)}
                                                            className="flex-1 py-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 text-[10px] font-black uppercase tracking-widest"
                                                        >
                                                            Move Up
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteJob(job.id)}
                                                            className="px-4 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintJob(job)}
                                                            className="flex-1 py-3 rounded-xl bg-emerald-500 text-zinc-900 hover:bg-emerald-400 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                                                        >
                                                            Print Tag
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {jobs.length === 0 && (
                                            <div className="text-center py-32 space-y-4 opacity-40">
                                                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700">
                                                    <Printer size={24} className="text-zinc-600" />
                                                </div>
                                                <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Queue is Clear</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'history' && (
                                    <div className="space-y-3">
                                        {history.map(job => (
                                            <div key={job.id} className="flex items-center gap-4 p-4 rounded-[2rem] bg-zinc-900/30 border border-zinc-800 hover:border-emerald-500/20 transition-all group">
                                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/10">
                                                    <CheckCircle2 className="text-emerald-500" size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="text-xs font-black text-white tracking-tight">{job.lot_code}</p>
                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{(job.print_data as any).work_area_name || 'General'}</p>
                                                        </div>
                                                        <span className="text-[10px] font-black text-zinc-600 tabular-nums">{format(new Date(job.created_at), 'HH:mm')}</span>
                                                    </div>
                                                    <p className="text-[10px] text-emerald-400 font-bold truncate mt-2 uppercase">
                                                        {job.print_data.products?.[0]?.name || job.print_data.product_name}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {history.length === 0 && <div className="text-center py-20 text-zinc-600 font-black uppercase tracking-widest text-[10px]">Empty Annals</div>}
                                    </div>
                                )}

                                {activeTab === 'logs' && (
                                    <div className="font-mono text-[9px] space-y-3 bg-black ring-1 ring-zinc-800 p-6 rounded-[2rem] min-h-[600px] shadow-inner">
                                        <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-zinc-500 font-black uppercase tracking-widest">System Tailing...</span>
                                        </div>
                                        {logs.map(log => (
                                            <div key={log.id} className="flex gap-3 leading-relaxed">
                                                <span className="text-zinc-600 flex-shrink-0 font-bold tracking-tighter tabular-nums">{format(log.timestamp, 'HH:mm:ss')}</span>
                                                <span className={`break-all ${log.type === 'error' ? 'text-red-400 font-bold' :
                                                    log.type === 'warning' ? 'text-amber-400' :
                                                        log.type === 'success' ? 'text-emerald-400' : 'text-zinc-400'
                                                    }`}>
                                                    <span className="uppercase opacity-40 mr-2">{log.type}</span>
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))}
                                        {logs.length === 0 && <div className="text-zinc-800 italic uppercase font-black text-center mt-20 tracking-[0.3em]">Listening for events...</div>}
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
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }

                @media print {
                    @page {
                        size: 6in 4in;
                        margin: 0;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 4in !important;
                        width: 6in !important;
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
                        width: 6in !important;
                        height: 4in !important;
                        background: white !important;
                        visibility: visible !important;
                        z-index: 99999 !important;
                    }
                }
            `}</style>
        </div>
    )
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
