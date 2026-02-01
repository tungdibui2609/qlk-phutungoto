'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, ArrowRight, Loader2, Boxes, MapPin, CheckCircle2, RotateCcw, AlertCircle, Package } from 'lucide-react'

// Steps: 0 = Scan LOT, 1 = Scan Position, 2 = Success/Result
type ScanStep = 0 | 1 | 2

export default function FastScanPage() {
    const { checkSubscription, profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    // State
    const [step, setStep] = useState<ScanStep>(0)
    const [inputValue, setInputValue] = useState('')
    const [loading, setLoading] = useState(false)

    // Data
    const [lotData, setLotData] = useState<any>(null)
    const [assignedPos, setAssignedPos] = useState<string>('')

    // Refs for auto-focus
    const inputRef = useRef<HTMLInputElement>(null)

    // Check module permission
    const isAllowed = checkSubscription('utility_qr_assign')

    // Auto-focus input on step change
    useEffect(() => {
        if (inputRef.current && !loading) {
            inputRef.current.focus()
        }
    }, [step, loading])

    const handleReset = () => {
        setStep(0)
        setLotData(null)
        setAssignedPos('')
        setInputValue('')
        if (inputRef.current) inputRef.current.focus()
    }

    const processLotScan = async (code: string) => {
        if (!currentSystem?.code || !profile?.company_id) return

        setLoading(true)
        try {
            // Fetch LOT
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    id, code, packaging_date,
                    products (name, sku, unit),
                    lot_items (quantity, unit),
                    positions (code)
                `)
                .eq('code', code)
                .eq('system_code', currentSystem.code)
                .eq('company_id', profile.company_id)
                .single()

            if (error || !data) {
                showToast('Không tìm thấy LOT hoặc lỗi kết nối', 'error')
                setInputValue('') // Clear to retry
            } else {
                setLotData(data)
                setStep(1) // Move to Position Scan
                setInputValue('')
                showToast('Đã tìm thấy LOT. Vui lòng quét vị trí.', 'success')
            }
        } catch (e) {
            console.error(e)
            showToast('Lỗi xử lý', 'error')
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
                setInputValue('') // Clear to retry
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

            // Auto reset after 2 seconds
            setTimeout(() => {
                handleReset()
            }, 2500)

        } catch (e: any) {
            console.error(e)
            showToast('Lỗi gán vị trí: ' + e.message, 'error')
            setInputValue('')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const val = inputValue.trim().toUpperCase()
        if (!val) return

        if (step === 0) {
            processLotScan(val)
        } else if (step === 1) {
            processPositionScan(val)
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
        <div className="max-w-xl mx-auto py-6 px-4">

            {/* Header / Status Bar */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gán vị trí nhanh</h1>
                    <p className="text-sm text-slate-500">{currentSystem?.name || '...'}</p>
                </div>
                <button onClick={handleReset} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:rotate-180 transition-transform duration-500">
                    <RotateCcw size={20} className="text-slate-500" />
                </button>
            </div>

            {/* Main Workstation Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden relative">

                {/* Visual Step Indicator */}
                <div className="flex w-full h-1.5 bg-slate-100 dark:bg-slate-800">
                    <div className={`h-full transition-all duration-300 ${step >= 0 ? 'bg-orange-500 w-1/2' : 'w-0'}`} />
                    <div className={`h-full transition-all duration-300 ${step >= 1 ? 'bg-indigo-500 w-1/2' : 'w-0'}`} />
                </div>

                <div className="p-8 text-center space-y-6 min-h-[400px] flex flex-col justify-center">

                    {/* STEP 0: SCAN LOT */}
                    {step === 0 && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                                <Boxes size={48} />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Bước 1: Quét mã LOT</h2>
                            <p className="text-slate-500 text-lg">Dùng máy quét hoặc nhập mã LOT</p>
                        </div>
                    )}

                    {/* STEP 1: SCAN POSITION */}
                    {step === 1 && lotData && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            {/* Lot Info Card */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left">
                                <div className="flex items-start justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Đang gán cho LOT</span>
                                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded text-xs font-bold font-mono">
                                        {lotData.code}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                                    {lotData.products?.name}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {lotData.products?.sku} • {new Date(lotData.packaging_date).toLocaleDateString('vi-VN')}
                                </p>
                            </div>

                            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                                <MapPin size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-indigo-600 dark:text-indigo-400">
                                Bước 2: Quét Vị trí
                            </h2>
                        </div>
                    )}

                    {/* STEP 2: SUCCCESS */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="w-28 h-28 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 size={56} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">Thành công!</h2>
                                <p className="text-slate-600 dark:text-slate-300 text-lg">
                                    Đã gán vào vị trí <strong className="text-slate-900 dark:text-white px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">{assignedPos}</strong>
                                </p>
                            </div>
                            <div className="pt-8">
                                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-300 dark:bg-slate-600 animate-progress-shrink w-full origin-left" style={{ animationDuration: '2.5s' }} />
                                </div>
                                <p className="text-xs text-slate-400 mt-2">Tự động chuyển tiếp...</p>
                            </div>
                        </div>
                    )}

                    {/* INPUT AREA (Hidden on Step 2) */}
                    {step !== 2 && (
                        <form onSubmit={handleSubmit} className="mt-8 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={loading}
                                className={`w-full text-center py-4 bg-transparent border-b-2 focus:outline-none text-2xl font-bold uppercase tracking-widest transition-all
                                    ${step === 0
                                        ? 'border-orange-200 focus:border-orange-500 placeholder:text-orange-200'
                                        : 'border-indigo-200 focus:border-indigo-500 placeholder:text-indigo-200'
                                    }
                                    disabled:opacity-50
                                `}
                                placeholder={step === 0 ? "SCAN LOT..." : "SCAN POSITION..."}
                                autoFocus
                                onBlur={() => {
                                    // Keep focus unless user explicitly clicks away?
                                    // Optional: setTimeout(() => inputRef.current?.focus(), 100)
                                }}
                            />
                            {loading && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                    <Loader2 className="animate-spin text-slate-400" />
                                </div>
                            )}
                        </form>
                    )}
                </div>
            </div>

            <div className="mt-6 text-center">
                <p className="text-xs text-slate-400 font-mono">
                    Hỗ trợ: Enter để xác nhận • Nhấn nút Reset (Góc trên phải) để quét lại từ đầu
                </p>
            </div>
        </div>
    )
}
