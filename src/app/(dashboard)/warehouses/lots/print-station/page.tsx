'use client'

import { useEffect, useState, useRef, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import {
    Printer, Wifi, WifiOff, Loader2, CheckCircle2,
    Activity, LayoutGrid, Clock, Bell,
    Layers, Package, Check
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

    // UI States
    const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'logs'>('queue')

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
        if (!currentSystem) return

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
                    }
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [currentSystem])

    // Silent Print Logic for External Bot
    useEffect(() => {
        if (!silentParam || !jobIdParam || !currentSystem) return

        const runSilentPrint = async () => {
            const { data: job } = await (supabase as any).from('print_queue')
                .select('*')
                .eq('id', jobIdParam)
                .single()

            if (job) {
                setLastPrinted(job)
                await new Promise(r => setTimeout(r, 1000))
                window.print()
            }
        }
        runSilentPrint()
    }, [silentParam, jobIdParam, currentSystem])

    if (silentParam) {
        return (
            <div className="bg-white min-h-screen p-0 m-0">
                {lastPrinted && (
                    <div id="print-area" className="block bg-white w-[90mm] h-[60mm] overflow-hidden">
                        <div className="border-2 border-black h-full p-2 rounded-lg flex flex-col items-center justify-between font-sans text-black">
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
                                <div className="flex gap-6 w-full mt-2 items-center">
                                    <QRCode value={lastPrinted.print_data.scan_url} size={140} />
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

    if (!currentSystem) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <WifiOff className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 font-display">Hệ thống chưa kết nối</h2>
                <p className="text-zinc-500 max-w-md">Vui lòng quay lại Dashboard để khởi tạo phiên làm việc trước khi sử dụng trạm in.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-blue-500/30">
            {/* --- Background Elements --- */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            {/* --- Top Navigation / Header --- */}
            <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl px-6 py-4">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Printer className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                                PRINT STATION
                                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono text-zinc-400">V9.6</span>
                            </h1>
                            <p className="text-xs text-zinc-500 flex items-center gap-1.5 uppercase font-bold tracking-wider">
                                <Activity size={10} className="text-green-500 animate-pulse" />
                                Monitoring: LIVE
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5 text-zinc-500 text-xs font-bold italic">
                            <Wifi size={14} className="text-green-500" />
                            Supabase Connected
                        </div>
                    </div>
                </div>
            </header>

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
                            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm group hover:border-white/20 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <div className={`p-2 rounded-lg bg-${s.color}-500/10`}>
                                        <s.icon size={18} className={`text-${s.color}-500`} />
                                    </div>
                                    <span className="text-2xl font-black">{s.value}</span>
                                </div>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Main Work Area / Preview */}
                    <div className="relative bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm min-h-[500px] flex flex-col">
                        <div className="absolute top-0 right-0 p-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black border bg-green-500/10 text-green-500 border-green-500/20 transition-all">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
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
                                    <h3 className="text-xl font-bold text-zinc-300">Sẵn sàng nhận lệnh</h3>
                                    <p className="text-zinc-500 max-w-[280px] mx-auto mt-2 text-sm leading-relaxed">Gửi lệnh in từ thiết bị cầm tay để bắt đầu quy trình tự động.</p>
                                </div>
                            )}
                        </div>

                        {/* Recent History Grid Inside Main Area */}
                        <div className="bg-white/[0.02] border-t border-white/5 p-6 overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Lịch sử vừa in</h3>
                                <button onClick={() => setActiveTab('history')} className="text-[10px] text-zinc-500 hover:text-white transition-colors">Xem tất cả</button>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {history.slice(0, 4).map((h) => (
                                    <div key={h.id} className="bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            <span className="text-[10px] font-bold text-zinc-300 truncate">{h.lot_code}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 font-mono italic">{format(new Date(h.created_at), 'HH:mm')}</p>
                                    </div>
                                ))}
                                {history.length === 0 && <div className="col-span-4 py-4 text-center text-zinc-600 text-xs italic">Chưa có lịch sử</div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Right Column: Tabs (Queue, Logs) --- */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col h-full max-h-[850px]">
                        {/* Tab Switcher */}
                        <div className="flex border-b border-white/5">
                            {(['queue', 'history', 'logs'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/5' : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    {tab === 'queue' ? 'Hàng chờ' : tab === 'history' ? 'Lịch sử' : 'Nhật ký'}
                                    {tab === 'queue' && jobs.length > 0 && <span className="ml-2 bg-blue-500 text-white px-1.5 rounded-full text-[9px]">{jobs.length}</span>}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {activeTab === 'queue' && (
                                <div className="space-y-3">
                                    {jobs.map((job, idx) => (
                                        <div key={job.id} className="group bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-blue-500/30 transition-all">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Priority: {idx + 1}</span>
                                                    <h4 className="font-bold text-zinc-200 mt-0.5">{job.lot_code}</h4>
                                                    <p className="text-xs text-zinc-500 mt-1 line-clamp-1 italic">{job.print_data.product_name}</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-blue-500/20 group-hover:text-blue-500 transition-all">
                                                    <Package size={18} />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                                <span className="text-[10px] font-mono text-zinc-600">{format(new Date(job.created_at), 'HH:mm:ss')}</span>
                                                <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-full text-[9px] font-black uppercase">
                                                    <Loader2 size={10} className="animate-spin" />
                                                    Pending
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {jobs.length === 0 && (
                                        <div className="text-center py-20">
                                            <Bell size={32} className="mx-auto text-zinc-700 mb-4 opacity-30" />
                                            <p className="text-sm text-zinc-600 font-bold italic">Không có lệnh in nào đang chờ</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="space-y-2">
                                    {history.map(job => (
                                        <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="text-green-500" size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between">
                                                    <p className="text-xs font-bold text-zinc-200 truncate">{job.lot_code}</p>
                                                    <span className="text-[10px] text-zinc-500">{format(new Date(job.created_at), 'HH:mm')}</span>
                                                </div>
                                                <p className="text-[10px] text-zinc-500 truncate">{job.print_data.product_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {history.length === 0 && <div className="text-center py-20 text-zinc-600 italic">Lịch sử trống</div>}
                                </div>
                            )}

                            {activeTab === 'logs' && (
                                <div className="font-mono text-[10px] space-y-2 bg-black/40 p-3 rounded-xl min-h-full">
                                    {logs.map(log => (
                                        <div key={log.id} className="flex gap-2">
                                            <span className="text-zinc-600 flex-shrink-0">[{format(log.timestamp, 'HH:mm:ss')}]</span>
                                            <span className={`${log.type === 'error' ? 'text-red-400' :
                                                    log.type === 'warning' ? 'text-amber-400' :
                                                        log.type === 'success' ? 'text-green-400' : 'text-zinc-400'
                                                }`}>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <div className="text-zinc-700 italic">No logs generated...</div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                @font-face {
                    font-family: 'Inter';
                    src: url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                }
                .font-display { font-family: 'Inter', sans-serif; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
            `}</style>
        </div>
    )
}
