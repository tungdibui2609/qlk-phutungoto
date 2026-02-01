'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, RotateCcw, Boxes, CheckCircle2, Loader2, Keyboard, Camera, PackageCheck, ArrowLeft, Layers } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import Link from 'next/link'
import { LotExportModal } from '@/components/warehouse/lots/LotExportModal'
import { Lot, Unit, ProductUnit } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'

// Steps: 0 = Scan LOT, 1 = Export Modal/Ready, 2 = Success/Result
type ScanStep = 0 | 1 | 2

export default function ExportScanPage() {
    const { checkSubscription, profile } = useUser()
    const { currentSystem, hasModule } = useSystem()
    const { showToast } = useToast()

    // State
    const [step, setStep] = useState<ScanStep>(0)
    const [useCamera, setUseCamera] = useState(true)
    const [manualCode, setManualCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false)

    // Data
    const [lotData, setLotData] = useState<Lot | null>(null)
    const [units, setUnits] = useState<Unit[]>([])
    const [productUnits, setProductUnits] = useState<ProductUnit[]>([])
    const [isExportingModalOpen, setIsExportingModalOpen] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)

    // Check module permission
    const isAllowed = hasModule('outbound_basic')

    // 0. Pre-fetch units for conversion
    useEffect(() => {
        const fetchCommonData = async () => {
            const [uRes, puRes] = await Promise.all([
                supabase.from('units').select('*').eq('is_active', true).order('name'),
                supabase.from('product_units').select('*')
            ])
            if (uRes.data) setUnits(uRes.data)
            if (puRes.data) setProductUnits(puRes.data)
        }
        fetchCommonData()
    }, [])

    // Auto-focus manual input
    useEffect(() => {
        if (!useCamera && step === 0 && inputRef.current) {
            inputRef.current.focus()
        }
    }, [useCamera, step])

    const handleReset = () => {
        setStep(0)
        setLotData(null)
        setManualCode('')
        setPaused(false)
        setIsExportingModalOpen(false)
    }

    const handleScanResult = async (rawCode: string, isManual = false) => {
        if (loading || (!isManual && paused) || !rawCode) return

        let code = rawCode.trim()

        // Handle URL scanning
        try {
            if (code.startsWith('http')) {
                const url = new URL(code)
                const pathParts = url.pathname.split('/')
                const lastPart = pathParts[pathParts.length - 1]
                if (lastPart) {
                    code = lastPart
                }
            }
        } catch (e) { }

        code = code.toUpperCase()
        setPaused(true)

        if (step === 0) {
            await processLotScan(code)
        }
    }

    const processLotScan = async (code: string) => {
        if (!currentSystem?.code || !profile?.company_id) return

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    *,
                    suppliers (name),
                    qc_info (name),
                    lot_items (
                        id, quantity, unit, product_id,
                        products (name, sku, unit, cost_price)
                    ),
                    positions (id, code),
                    lot_tags (tag, lot_item_id)
                `)
                .eq('code', code)
                .single()

            if (error || !data) {
                showToast(`Không tìm thấy LOT "${code}"`, 'error')
                setPaused(false)
            } else {
                if (data.company_id && data.company_id !== profile.company_id) {
                    showToast(`Cảnh báo: LOT này thuộc công ty khác!`, 'error')
                    setPaused(false)
                    return
                }

                if (data.status === 'exported' || ((data.quantity ?? 0) <= 0.000001)) {
                    showToast(`LOT "${code}" đã xuất hết hoặc không khả dụng`, 'warning')
                    setPaused(false)
                    return
                }

                setLotData(data as any)
                setStep(1)
                setIsExportingModalOpen(true)
                showToast('Đã nhận diện LOT. Vui lòng nhập thông tin xuất.', 'success')
            }
        } catch (e: any) {
            console.error(e)
            showToast('Lỗi xử lý: ' + e.message, 'error')
            setPaused(false)
        } finally {
            setLoading(false)
        }
    }

    const handleExportSuccess = () => {
        setIsExportingModalOpen(false)
        setStep(2)
        // Auto reset after some time
        setTimeout(() => {
            handleReset()
        }, 3000)
    }

    if (!isAllowed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-50 dark:bg-slate-900">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400">
                    <PackageCheck size={40} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tính năng chưa kích hoạt</h1>
                <p className="text-slate-500 max-w-md">
                    Vui lòng liên hệ quản trị viên để kích hoạt quyền xuất kho.
                </p>
                <Link href="/warehouses/lots" className="mt-6 flex items-center gap-2 text-orange-600 font-bold">
                    <ArrowLeft size={18} /> Quay lại danh sách
                </Link>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/warehouses" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="font-bold text-lg text-slate-900 dark:text-white leading-none">Quét Xuất Kho</h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{currentSystem?.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setUseCamera(!useCamera)}
                            className="p-2.5 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                        >
                            {useCamera ? <Keyboard size={18} /> : <Camera size={18} />}
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-2.5 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center pt-24">
                {/* Camera View */}
                {useCamera && step === 0 && (
                    <div className="w-full max-w-xs aspect-square relative bg-black rounded-[40px] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 mb-8 mx-auto">
                        <Scanner
                            onScan={(result) => {
                                if (result && result.length > 0) {
                                    handleScanResult(result[0].rawValue)
                                }
                            }}
                            styles={{
                                container: { width: '100%', height: '100%' },
                                video: { objectFit: 'cover' }
                            }}
                            components={{ finder: false }}
                            constraints={{ facingMode: 'environment' }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="w-56 h-56 border-2 border-white/30 rounded-3xl relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1 rounded-tl-2xl" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1 rounded-tr-2xl" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1 rounded-bl-2xl" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1 rounded-br-2xl" />
                                {loading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl backdrop-blur-[2px]">
                                        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Instruction */}
                {step === 0 && (
                    <div className="text-center space-y-3 mb-8 px-6">
                        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-2">
                            <QrCode size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {useCamera ? 'Sẵn sàng Quét mã' : 'Nhập mã LOT'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-[240px] mx-auto">
                            {useCamera ? 'Đưa mã QR của LOT vào khung hình để bắt đầu xuất kho' : 'Nhập mã định danh của LOT và nhấn Xác nhận'}
                        </p>
                    </div>
                )}

                {/* Manual Input */}
                {step === 0 && !useCamera && (
                    <div className="w-full max-w-md p-6 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-xl border border-slate-200 dark:border-slate-800">
                            <form onSubmit={(e) => { e.preventDefault(); handleScanResult(manualCode, true); }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                    className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center text-2xl font-black uppercase mb-6 focus:ring-4 focus:ring-orange-500/10 outline-none border border-transparent focus:border-orange-500 transition-all text-slate-900 dark:text-white"
                                    placeholder="VÍ DỤ: LOT23..."
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !manualCode}
                                    className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : 'Xác nhận mã'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Success View */}
                {step === 2 && (
                    <div className="bg-white dark:bg-slate-900 m-6 p-10 rounded-[40px] shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-500 max-w-sm w-full border border-slate-100 dark:border-slate-800">
                        <div className="w-28 h-28 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <CheckCircle2 size={60} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-center text-slate-900 dark:text-white mb-2 tracking-tight">Thao tác thành công!</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-center mb-8 font-medium">
                            Dữ liệu xuất kho đã được cập nhật vào hệ thống.
                        </p>
                        <button
                            onClick={handleReset}
                            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold transition-transform active:scale-95"
                        >
                            Tiếp tục quét mã khác
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Integration */}
            {isExportingModalOpen && lotData && (
                <LotExportModal
                    lot={lotData}
                    onClose={() => {
                        setIsExportingModalOpen(false)
                        setStep(0)
                        setPaused(false)
                    }}
                    onSuccess={handleExportSuccess}
                    units={units}
                    productUnits={productUnits}
                    isUtilityEnabled={hasModule}
                />
            )}

            {/* LOT Glance Overlay (when step 1 but modal hidden or loading) */}
            {lotData && step === 1 && !isExportingModalOpen && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30 rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-full duration-500">
                    <div className="max-w-md mx-auto">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center shrink-0">
                                <Boxes size={28} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-xl text-slate-900 dark:text-white truncate leading-tight">{lotData.products?.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 uppercase tracking-wider">{lotData.code}</span>
                                    <span className="text-[10px] font-bold text-slate-400">•</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lotData.products?.sku}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsExportingModalOpen(true)}
                            className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 active:scale-95 transition-transform"
                        >
                            <Layers size={20} />
                            Mở biểu mẫu xuất kho
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
