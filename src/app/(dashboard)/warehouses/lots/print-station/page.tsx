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
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
    const [jobs, setJobs] = useState<PrintJob[]>([])
    const [lastPrinted, setLastPrinted] = useState<PrintJob | null>(null)
    const [showHelp, setShowHelp] = useState(false)
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
                    setJobs(prev => [...prev, newJob])
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setStatus('connected')
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    setStatus('error')
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem])

    // Auto-print effect
    useEffect(() => {
        const processNextJob = async () => {
            if (jobs.length === 0) return

            const nextJob = jobs[0]

            // Mark as processing
            await (supabase as any).from('print_queue')
                .update({ status: 'processing' })
                .eq('id', nextJob.id)

            // Trigger Print
            setLastPrinted(nextJob)

            // Short delay to ensure DOM is updated for the print view
            setTimeout(() => {
                window.print()

                // Mark as completed after print dialog closes
                // Note: user still has to confirm the print dialog, but this is as close as we can get with web tech
                // In a real production environment, a dedicated print agent might be better
                handleJobCompletion(nextJob.id)
            }, 500)
        }

        processNextJob()
    }, [jobs])

    const handleJobCompletion = async (id: string) => {
        await (supabase as any).from('print_queue')
            .update({ status: 'printed' })
            .eq('id', id)

        setJobs(prev => prev.filter(j => j.id !== id))
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
                                <div className="flex items-center gap-3 text-orange-600 mb-2">
                                    <CheckCircle2 size={24} />
                                    <h2 className="text-xl font-bold uppercase tracking-wide">Đang xử lý in</h2>
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
                        <div className="flex items-center gap-2 text-zinc-400 px-2 pt-4">
                            <History size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Hàng đợi ({jobs.length})</span>
                        </div>
                        <div className="space-y-2">
                            {jobs.map(job => (
                                <div key={job.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{job.lot_code}</p>
                                        <p className="text-[10px] text-zinc-500">{new Date(job.created_at).toLocaleTimeString('vi-VN')}</p>
                                    </div>
                                    <div className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-500">
                                        PENDING
                                    </div>
                                </div>
                            ))}
                            {jobs.length === 0 && (
                                <p className="text-center py-8 text-xs text-zinc-400 italic">Trống</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actual Print Content - ONLY visible when printing */}
                <div className="hidden print:block font-sans text-black bg-white w-[100mm] h-auto p-2" ref={printRef}>
                    {lastPrinted && (
                        <div className="border-2 border-black p-3 rounded-lg flex flex-col items-center space-y-2">
                            <div className="flex justify-between items-start w-full border-b border-black pb-1 mb-1">
                                <div className="text-left flex-1">
                                    <h1 className="font-black text-xl leading-none">{(lastPrinted.print_data.company_prefix || 'ANY').toUpperCase()} LOT</h1>
                                    <p className="text-[10px] uppercase font-bold text-zinc-600">TRACEABILITY SYSTEM</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold font-mono">{lastPrinted.lot_code}</p>
                                    <p className="text-[9px]">{new Date(lastPrinted.created_at).toLocaleDateString('vi-VN')}</p>
                                </div>
                            </div>

                            <div className="flex gap-4 w-full">
                                <div className="border border-black p-1 bg-white shrink-0">
                                    <QRCode value={lastPrinted.print_data.scan_url} size={100} />
                                </div>
                                <div className="flex-1 space-y-2 min-w-0">
                                    <div className="space-y-2">
                                        {lastPrinted.print_data.products.map((p: any, idx: number) => (
                                            <div key={idx} className="space-y-1 border-b border-black/5 pb-1 last:border-0">
                                                <div>
                                                    <p className="text-[8px] font-bold opacity-60 uppercase border-b border-black/5 inline-block">Sản phẩm:</p>
                                                    <p className="text-[11px] font-black leading-tight break-words">{p.name}</p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-[8px] font-bold opacity-60 uppercase border-b border-black/5 inline-block">Mã SP:</p>
                                                        <p className="text-[9px] font-black font-mono truncate">{p.sku || '---'}</p>
                                                    </div>
                                                    {p.internal_code && (
                                                        <div>
                                                            <p className="text-[8px] font-bold opacity-60 uppercase border-b border-black/5 inline-block">Mã phụ:</p>
                                                            <p className="text-[9px] font-black font-mono truncate">{p.internal_code}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <p className="text-[8px] font-bold opacity-60 uppercase border-b border-black/5 inline-block">Số lượng:</p>
                                                    <p className="text-[13px] font-black text-orange-600">{p.quantity} {p.unit}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="w-full flex justify-between items-center text-[7px] font-bold uppercase opacity-60 pt-1 border-t border-black/10">
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
                    body {
                        background-color: white !important;
                    }
                    .print-hidden, header, sidebar, nav {
                        display: none !important;
                    }
                    main {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    @page {
                        margin: 0;
                        size: auto;
                    }
                }
            `}</style>
        </div>
    )
}
