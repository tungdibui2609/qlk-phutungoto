'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { Boxes, Printer, Wifi, WifiOff, Loader2, CheckCircle2, AlertCircle, History, X } from 'lucide-react'
import QRCode from "react-qr-code"

interface PrintJob {
    id: string
    created_at: string
    lot_code: string
    print_data: any
    status: 'pending' | 'processing' | 'completed' | 'failed'
}

export default function PrintStationPage() {
    const { currentSystem } = useSystem()
    const [isPrinting, setIsPrinting] = useState(false)
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
    const [jobs, setJobs] = useState<PrintJob[]>([])
    const [lastPrinted, setLastPrinted] = useState<PrintJob | null>(null)
    const [showHelp, setShowHelp] = useState(false)
    const isProcessingRef = useRef(false)
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!currentSystem) return

        // 1. Initial Fetch
        const fetchInitialJobs = async () => {
            const { data, error } = await (supabase as any).from('print_queue')
                .select('*')
                .eq('system_id', currentSystem.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching jobs:', error)
                setStatus('error')
                return
            }

            setJobs(data || [])
            setStatus('connected')
        }

        fetchInitialJobs()

        // 2. Realtime Subscription
        const channel = supabase
            .channel('print_station')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'print_queue',
                    filter: `system_id=eq.${currentSystem.id}`
                },
                (payload: any) => {
                    console.log('New print job received:', payload.new)
                    const newJob = payload.new as PrintJob
                    if (newJob.status === 'pending') {
                        setJobs((prev: PrintJob[]) => {
                            // Avoid duplicates
                            if (prev.some((j: PrintJob) => j.id === newJob.id)) return prev
                            return [...prev, newJob]
                        })
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Realtime connected!')
                    setStatus('connected')
                } else {
                    console.log('Realtime status:', status)
                    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        setStatus('connecting')
                    }
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem])

    // Auto-print effect
    useEffect(() => {
        let isCancelled = false;

        const processNextJob = async () => {
            // Use both state and ref for maximum safety
            if (jobs.length === 0 || isPrinting || isProcessingRef.current) return

            isProcessingRef.current = true
            setIsPrinting(true)

            const nextJob = jobs[0]

            try {
                // 1. Update status to processing on server
                await (supabase as any).from('print_queue')
                    .update({ status: 'processing' })
                    .eq('id', nextJob.id)

                // 2. Load data to UI
                setLastPrinted(nextJob)

                // 3. Short delay to ensure DOM is updated
                await new Promise(resolve => setTimeout(resolve, 1000))

                if (isCancelled) return

                // 4. Trigger Print
                console.log('Triggering print for:', nextJob.id)
                window.print()

                // 5. Short delay after print dialog closes/finishes
                await new Promise(resolve => setTimeout(resolve, 800))

                if (isCancelled) return

                // 6. Mark as completed and remove from local queue
                await handleJobCompletion(nextJob.id)

            } catch (error) {
                console.error('Print process error:', error)
            } finally {
                if (!isCancelled) {
                    setIsPrinting(false)
                    isProcessingRef.current = false
                }
            }
        }

        processNextJob()

        return () => {
            isCancelled = true
        }
    }, [jobs, isPrinting])

    const handleJobCompletion = async (id: string) => {
        // Mark as printed on server
        await (supabase as any).from('print_queue')
            .update({ status: 'printed' })
            .eq('id', id)

        // Remove from local state
        setJobs((prev: PrintJob[]) => prev.filter((j: PrintJob) => j.id !== id))
    }

    const clearQueue = async () => {
        if (!currentSystem) return
        if (!window.confirm('Bạn có chắc muốn xóa sạch hàng đợi không?')) return

        await (supabase as any).from('print_queue')
            .update({ status: 'failed' })
            .eq('system_id', currentSystem.id)
            .eq('status', 'pending')

        setJobs([])
    }

    if (!currentSystem) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 text-center">
                <Loader2 className="w-12 h-12 text-zinc-300 animate-spin mb-4" />
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Đang tải cấu hình hệ thống...</h1>
            </div>
        )
    }

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
        } else {
            document.exitFullscreen()
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            {/* Header - Hidden during print */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-10 print:hidden">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-none">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-zinc-900 dark:text-white leading-none mb-1">Trạm In Tem Tự Động</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 font-medium">{currentSystem.name}</span>
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status === 'connected' ? 'bg-emerald-100 text-emerald-700' :
                                    status === 'connecting' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                    {status === 'connected' ? <Wifi size={10} /> : status === 'connecting' ? <Loader2 size={10} className="animate-spin" /> : <WifiOff size={10} />}
                                    {status === 'connected' ? 'Máy in trực tuyến' : status === 'connecting' ? 'Đang kết nối...' : 'Mất kết nối'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Hàng đợi</p>
                            <p className="text-lg font-black text-zinc-900 dark:text-white leading-none">{jobs.length}</p>
                        </div>
                        <button
                            onClick={() => setShowHelp(!showHelp)}
                            className={`p-2.5 rounded-xl border transition-all ${showHelp ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500'}`}
                            title="Hướng dẫn cấu hình"
                        >
                            <AlertCircle size={18} />
                        </button>
                        <button
                            onClick={toggleFullScreen}
                            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
                            title="Toàn màn hình"
                        >
                            <History size={18} />
                        </button>
                    </div>
                </div>

                {/* Expandable Help Section */}
                {showHelp && (
                    <div className="max-w-5xl mx-auto mt-4 px-2 pb-2">
                        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-900/50 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                    <AlertCircle size={20} />
                                    <h3 className="text-sm font-bold uppercase tracking-wider">Cấu hình in tự động (Silent Print)</h3>
                                </div>
                                <button onClick={() => setShowHelp(false)} className="text-orange-400 hover:text-orange-600">
                                    <X size={18} />
                                </button>
                            </div>
                            <ol className="text-xs text-orange-800 dark:text-orange-300 space-y-3 list-decimal ml-4 font-medium leading-relaxed">
                                <li>Chuột phải vào Shortcut Chrome trên Desktop {'>'} <b>Properties</b>.</li>
                                <li>Tại tab <b>Shortcut</b>, tìm ô <b>Target</b> (KHÔNG PHẢI ô "Start in").</li>
                                <li>Để con trỏ xuống cuối cùng của ô <b>Target</b>, cách ra 1 dấu cách rồi dán: <code> --kiosk-printing</code></li>
                                <li><i>Lưu ý: Dán nó đằng sau dấu ngoặc kép cuối cùng (ví dụ: ...chrome.exe" --kiosk-printing).</i></li>
                                <li>Bấm OK và mở lại Chrome từ chính Shortcut đó để kích hoạt in tự động.</li>
                            </ol>
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-1 max-w-5xl mx-auto w-full p-6 print:p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Active/Last Job Info */}
                    <div className="md:col-span-2 space-y-6 print:hidden">
                        {lastPrinted ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border-2 border-orange-500 shadow-xl space-y-6">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 text-orange-600">
                                        <CheckCircle2 size={24} />
                                        <h2 className="text-xl font-bold uppercase tracking-wide">Đang xử lý in</h2>
                                    </div>
                                    <button
                                        onClick={() => window.print()}
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95"
                                    >
                                        <Printer size={14} />
                                        IN LẠI / IN THỦ CÔNG
                                    </button>
                                </div>

                                <div className="flex gap-8">
                                    <div className="bg-white p-4 rounded-2xl shadow-inner border border-zinc-100 shrink-0">
                                        <QRCode value={lastPrinted.print_data.scan_url} size={150} />
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <p className="text-xs font-bold text-zinc-400 uppercase">Mã LOT</p>
                                            <p className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{lastPrinted.lot_code}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-400 uppercase">Sản phẩm</p>
                                            <div className="space-y-1">
                                                {lastPrinted.print_data.products.map((p: any, idx: number) => (
                                                    <p key={idx} className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                                        {p.name} - <span className="text-orange-600">{p.quantity} {p.unit}</span>
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-500 font-medium italic">
                                    <p>Máy in sẽ tự động mở hộp thoại in...</p>
                                    <p>{new Date(lastPrinted.created_at).toLocaleTimeString('vi-VN')}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 border border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-300 dark:text-zinc-700 mb-4 font-bold border-2 border-white dark:border-zinc-800">
                                    <Boxes size={32} />
                                </div>
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Chờ lệnh in mới</h2>
                                <p className="text-sm text-zinc-500 max-w-xs uppercase tracking-wide font-medium opacity-70">Nhân viên kho gửi lệnh in từ điện thoại sẽ xuất hiện tại đây</p>
                            </div>
                        )}
                    </div>

                    {/* Right: History/Queue */}
                    <div className="space-y-4 print:hidden">
                        <div className="flex items-center justify-between px-2 pt-4 mb-2">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <History size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Hàng đợi ({jobs.length})</span>
                            </div>
                            {jobs.length > 0 && (
                                <button
                                    onClick={clearQueue}
                                    className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-tighter transition-colors"
                                >
                                    Xóa tất cả
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-400 px-2 mb-2 italic">Bấm vào bất kỳ job nào để in thủ công nếu cần.</p>
                        <div className="space-y-2">
                            {jobs.map((job: PrintJob) => (
                                <button
                                    key={job.id}
                                    onClick={() => {
                                        setLastPrinted(job)
                                        setTimeout(() => window.print(), 100)
                                    }}
                                    className="w-full text-left bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between hover:border-orange-300 dark:hover:border-orange-900 transition-all group active:scale-[0.98]"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-orange-600 transition-colors">{job.lot_code}</p>
                                        <p className="text-[10px] text-zinc-500">{new Date(job.created_at).toLocaleTimeString('vi-VN')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-500">
                                            PENDING
                                        </div>
                                        <Printer size={14} className="text-zinc-300 group-hover:text-orange-500" />
                                    </div>
                                </button>
                            ))}
                            {jobs.length === 0 && (
                                <p className="text-center py-8 text-xs text-zinc-400 italic">Trống</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actual Print Content - ONLY visible when printing */}
                <div id="print-area" className="hidden print:block font-sans text-black bg-white w-[90mm] h-[60mm] overflow-hidden" ref={printRef}>
                    {lastPrinted && (
                        <div className="border-2 border-black h-full p-2 rounded-lg flex flex-col items-center justify-between">
                            <div className="w-full">
                                <div className="flex justify-between items-start w-full border-b border-black pb-1 mb-1">
                                    <div className="text-left flex-1">
                                        <h1 className="font-black text-lg leading-none">{(lastPrinted.print_data.company_prefix || 'ANY').toUpperCase()} LOT</h1>
                                        <p className="text-[9px] uppercase font-bold text-zinc-600">TRACEABILITY SYSTEM</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold font-mono">{lastPrinted.lot_code}</p>
                                        <p className="text-[8px]">{new Date(lastPrinted.created_at).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>

                                <div className="flex gap-6 w-full mt-2 items-center flex-1 min-h-0">
                                    <div className="bg-white shrink-0 flex flex-col justify-center h-full">
                                        <QRCode value={lastPrinted.print_data.scan_url} size={135} />
                                    </div>
                                    <div className="flex-1 space-y-1.5 min-w-0">
                                        <div className="space-y-1">
                                            {lastPrinted.print_data.products.slice(0, 1).map((p: any, idx: number) => (
                                                <div key={idx} className="space-y-2 pt-1">
                                                    <div className="flex flex-col gap-0.5 leading-tight">
                                                        <span className="text-[9px] font-bold opacity-70 uppercase">Sản phẩm:</span>
                                                        <span className="text-[12px] font-black uppercase break-words leading-tight">{p.name}</span>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-bold opacity-70 uppercase shrink-0">Mã SP:</span>
                                                            <span className="text-[9px] font-black font-mono">{p.sku || '---'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-bold opacity-70 uppercase shrink-0">Mã phụ:</span>
                                                            <span className="text-[9px] font-black font-mono">{p.internal_code || '---'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 pt-0.5">
                                                        <span className="text-[9px] font-bold opacity-70 uppercase shrink-0">Số lượng:</span>
                                                        <span className="text-[14px] font-black text-orange-600 italic tracking-tight">{p.quantity} {p.unit}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full flex justify-between items-center text-[7px] font-bold uppercase opacity-60 pt-1 border-t border-black/10 mt-auto">
                                <span>{(lastPrinted.print_data.company_prefix || 'ANY').toUpperCase()} OPERATING SYSTEM</span>
                                <span>{currentSystem.name}</span>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    /* 1. Hide the known UI parts from the current page */
                    header, 
                    main > div.grid,
                    .print-hidden,
                    footer, 
                    [role="banner"], 
                    [role="contentinfo"] {
                        display: none !important;
                    }

                    /* 2. Reset the main container to the standard flow */
                    main {
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                    }

                    /* 3. Force the page to be exactly the size of one label */
                    html, body {
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 90mm !important;
                        height: 60mm !important;
                        overflow: hidden !important;
                    }

                    /* 4. Fix our print area exactly at the top-left */
                    #print-area {
                        display: block !important;
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 90mm !important;
                        height: 60mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        z-index: 9999 !important;
                    }

                    /* 5. Ensure all elements inside the print area are visible */
                    #print-area * {
                        visibility: visible !important;
                    }

                    @page {
                        size: 90mm 60mm;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
    )
}
