'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, RotateCcw, Boxes, MapPin, CheckCircle2, Loader2, Keyboard, Camera, X } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'

// Steps: 0 = Scan LOT, 1 = Scan Position, 2 = Success/Result
type ScanStep = 0 | 1 | 2

export default function FastScanPage() {
    const { checkSubscription, profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    // State
    const [step, setStep] = useState<ScanStep>(0)
    const [useCamera, setUseCamera] = useState(true)
    const [manualCode, setManualCode] = useState('')

    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false) // Pause scanner processing

    // Data
    const [lotData, setLotData] = useState<any>(null)
    const [assignedPos, setAssignedPos] = useState<string>('')

    // Check module permission
    const isAllowed = checkSubscription('utility_qr_assign')

    const handleReset = () => {
        setStep(0)
        setLotData(null)
        setAssignedPos('')
        setManualCode('')
        setPaused(false)
    }

    // Process a scanned or typed code
    const handleScanResult = async (rawCode: string) => {
        if (loading || paused || !rawCode) return

        let code = rawCode.trim()

        // Handle URL scanning (e.g. from public trace QR)
        try {
            if (code.startsWith('http')) {
                const url = new URL(code)
                // Assuming URL is like .../trace/LOT123
                const pathParts = url.pathname.split('/')
                const lastPart = pathParts[pathParts.length - 1]
                if (lastPart) {
                    code = lastPart
                }
            }
        } catch (e) {
            // Not a valid URL, ignore and use raw code
        }

        code = code.toUpperCase()

        // Simple logic to avoid re-processing same code if camera sends multiple frames
        // But for different steps we might scan same code? Unlikely.

        setPaused(true) // Stop processing new frames

        if (step === 0) {
            await processLotScan(code)
        } else if (step === 1) {
            await processPositionScan(code)
        }
    }

    const processLotScan = async (code: string) => {
        if (!currentSystem?.code || !profile?.company_id) return

        setLoading(true)
        try {
            // Fetch LOT
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    id, code, packaging_date, company_id,
                    products (name, sku, unit),
                    lot_items (quantity, unit),
                    positions (code)
                `)
                .eq('code', code)
                // .eq('system_code', currentSystem.code) // Always allow finding LOT from other systems
                // [SECURITY] We fetch by Code first to allow handling legacy LOTs (NULL company_id)
                .single()

            if (error || !data) {
                showToast(`Không tìm thấy LOT "${code}"`, 'error')
                setPaused(false) // Resume scanning
            } else {

                // [SECURITY CHECK]
                // 1. If LOT has company_id AND it is different -> Block
                // 2. If LOT has NULL company_id -> Allow (Legacy Data Support)
                if (data.company_id && data.company_id !== profile.company_id) {
                    showToast(`Cảnh báo: LOT này thuộc công ty khác!`, 'error')
                    setPaused(false)
                    return
                }

                setLotData(data)
                setStep(1) // Move to Position Scan
                setManualCode('')
                showToast('Đã nhận diện LOT. Vui lòng quét vị trí.', 'success')

                // Delay slightly to prevent accidental double-scan
                setTimeout(() => setPaused(false), 1000)
            }
        } catch (e: any) {
            console.error(e)
            showToast('Lỗi xử lý: ' + e.message, 'error')
            setPaused(false)
        } finally {
            setLoading(false)
        }
    }

    const processPositionScan = async (posCode: string) => {
        if (!lotData || !currentSystem?.code || !profile?.company_id) return

        setLoading(true)
        try {
            // 1. Find Position
            const { data: posData, error: posError } = await supabase
                .from('positions')
                .select('id, code, lot_id')
                .eq('code', posCode)
                .eq('system_type', currentSystem.code)
                .eq('company_id', profile.company_id)
                .single()

            if (posError || !posData) {
                showToast(`Không tìm thấy vị trí "${posCode}"`, 'error')
                setPaused(false)
                setLoading(false)
                return
            }

            // 2. Assign
            const { error: updateError } = await supabase
                .from('positions')
                .update({ lot_id: lotData.id } as any)
                .eq('id', posData.id)
                .eq('company_id', profile.company_id)

            if (updateError) throw updateError

            // Success
            setAssignedPos(posData.code)
            setStep(2)
            showToast(`Đã gán LOT vào ${posData.code}`, 'success')

            // Auto reset after 2.5 seconds
            setTimeout(() => {
                handleReset()
            }, 2500)

        } catch (e: any) {
            console.error(e)
            showToast('Lỗi gán vị trí: ' + e.message, 'error')
            setPaused(false)
        } finally {
            setLoading(false)
        }
    }

    if (!isAllowed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400">
                    <QrCode size={40} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tính năng chưa kích hoạt</h1>
                <p className="text-slate-500 max-w-md">
                    Vui lòng kích hoạt module "Quét mã QR & Gán vị trí".
                </p>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden relative">

            {/* Header Overlay - Adjusted for light mode */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
                <div>
                    <h1 className="font-bold text-lg text-slate-900 dark:text-white">Gán Vị Trí (Camera)</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{currentSystem?.name}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setUseCamera(!useCamera)}
                        className="p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                    >
                        {useCamera ? <Keyboard size={20} /> : <Camera size={20} />}
                    </button>
                    <button
                        onClick={handleReset}
                        className="p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center pt-16">

                {/* CAMERA VIEW */}
                {useCamera && step !== 2 && (
                    <div className="w-full max-w-xs aspect-square relative bg-black rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-slate-800 mb-6 mx-auto">
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
                            components={{
                                finder: false
                            }}
                            constraints={{
                                facingMode: 'environment'
                            }}
                        />
                        {/* Custom Finder / Overlay UI */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="w-56 h-56 border-2 border-white/50 rounded-3xl relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-orange-500 -mt-0.5 -ml-0.5 rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-orange-500 -mt-0.5 -mr-0.5 rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-orange-500 -mb-0.5 -ml-0.5 rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-orange-500 -mb-0.5 -mr-0.5 rounded-br-xl" />

                                {loading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl backdrop-blur-sm">
                                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* INSTRUCTION TEXT */}
                {useCamera && step !== 2 && (
                    <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {step === 0 ? 'Quét mã LOT' : 'Quét Vị trí'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            {step === 0 ? 'Di chuyển camera đến mã QR trên sản phẩm' : 'Di chuyển camera đến mã QR trên kệ hàng'}
                        </p>
                    </div>
                )}

                {/* MANUAL INPUT VIEW */}
                {(!useCamera && step !== 2) && (
                    <div className="w-full max-w-md p-6 z-10">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 text-center">
                                {step === 0 ? 'Nhập mã LOT' : 'Nhập mã Vị trí'}
                            </h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleScanResult(manualCode); }}>
                                <input
                                    type="text"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                    className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-xl font-bold uppercase mb-4 focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder={step === 0 ? "LOT-..." : "A1-..."}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !manualCode}
                                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Đang xử lý...' : 'Xác nhận'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* SUCCESS VIEW (Step 2) */}
                {step === 2 && (
                    <div className="bg-white dark:bg-slate-900 m-6 p-8 rounded-3xl shadow-2xl z-30 flex flex-col items-center animate-in zoom-in-95 duration-300 max-w-sm w-full">
                        <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">Đã gán thành công!</h2>
                        <p className="text-slate-600 dark:text-slate-300 text-lg mb-6 text-center">
                            Vị trí: <strong className="text-slate-900 dark:text-white">{assignedPos}</strong>
                        </p>
                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 animate-progress-shrink w-full origin-left" style={{ animationDuration: '2.5s' }} />
                        </div>
                    </div>
                )}

            </div>

            {/* Bottom Info Sheet (Always visible if we have data) */}
            {lotData && step !== 2 && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-full duration-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center shrink-0">
                            <Boxes size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <h3 className="font-bold text-slate-900 dark:text-white truncate">{lotData.products?.name}</h3>
                                <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{lotData.code}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                                {lotData.products?.sku} • {new Date(lotData.packaging_date).toLocaleDateString('vi-VN')}
                            </p>
                        </div>
                        {step === 1 && (
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center animate-pulse">
                                <MapPin size={20} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
