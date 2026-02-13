'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, RotateCcw, Boxes, MapPin, CheckCircle2, Loader2, Keyboard, Camera, X } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'

import { ZoneCascadeSelector } from './_components/ZoneCascadeSelector'
import { Database } from '@/lib/database.types'

type ScanStep = 0 | 1 | 2
type Zone = Database['public']['Tables']['zones']['Row']

export default function FastScanPage() {
    const { checkSubscription, profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    // State
    const [step, setStep] = useState<ScanStep>(0)
    const [assignMode, setAssignMode] = useState<'manual' | 'scan' | 'auto'>('manual') // Mode 3: Auto
    const [useCamera, setUseCamera] = useState(true)
    const [manualCode, setManualCode] = useState('')

    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false) // Pause scanner processing
    const [cameraError, setCameraError] = useState<string | null>(null)

    // Data
    const [lotData, setLotData] = useState<any>(null)
    const [assignedPos, setAssignedPos] = useState<string>('')
    const [allPositions, setAllPositions] = useState<{ id: string, code: string, lot_id: string | null }[]>([])
    const [suggestions, setSuggestions] = useState<{ id: string, code: string, lot_id: string | null }[]>([])

    // Auto Assign Data
    const [zones, setZones] = useState<Zone[]>([])
    const [zonePositions, setZonePositions] = useState<{ zone_id: string, position_id: string }[]>([])
    const [selectedTargetZoneId, setSelectedTargetZoneId] = useState<string | null>(null)

    const inputRef = useRef<HTMLInputElement>(null)

    // Check module permission
    const isAllowed = checkSubscription('utility_qr_assign')

    // 0. Fetch Data
    useEffect(() => {
        const fetchPositions = async () => {
            if (!currentSystem?.code) return
            console.log('Fetching positions for system:', currentSystem.code)
            const { data, error } = await supabase
                .from('positions')
                .select('id, code, lot_id')
                .eq('system_type', currentSystem.code)

            if (error) {
                console.error('Error fetching positions:', error)
            }
            if (data) {
                console.log(`Loaded ${data.length} positions`)
                setAllPositions(data)
            }
        }

        const fetchZonesAndMap = async () => {
            if (!currentSystem?.code) return

            // Zones
            const { data: zData } = await supabase
                .from('zones')
                .select('*')
                .eq('system_type', currentSystem.code)
                .order('level')
                .order('code')
            if (zData) setZones(zData)

            // Zone Positions
            const { data: zpData } = await supabase
                .from('zone_positions')
                .select('zone_id, position_id, positions!inner(system_type)')
                .eq('positions.system_type', currentSystem.code)

            if (zpData) setZonePositions(zpData.map((x: any) => ({ zone_id: x.zone_id, position_id: x.position_id })))
        }

        fetchPositions()
        fetchZonesAndMap()
    }, [currentSystem])

    // Normalize utility
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

    // 1. Compute suggestions based on manualCode (Legacy Manual Mode)
    useEffect(() => {
        if (step === 1 && assignMode === 'manual' && manualCode.length >= 1) {
            const normalizedInput = normalize(manualCode)
            const matches = allPositions
                .filter(p => {
                    const normalizedTarget = normalize(p.code)
                    // Only suggest if not occupied (lot_id is null) and matches input
                    return !p.lot_id && normalizedTarget.includes(normalizedInput)
                })
                .sort((a, b) => a.code.length - b.code.length) // Shorter (more exact) matches first
                .slice(0, 8) // Limit to 8 suggestions for better variety
            setSuggestions(matches)
        } else {
            setSuggestions([])
        }
    }, [manualCode, step, assignMode, allPositions])

    // COMPUTE AUTO-ASSIGN QUEUE
    const autoQueue = useMemo(() => {
        if (!selectedTargetZoneId || zones.length === 0 || allPositions.length === 0) return []

        // 1. Find all descendant zones
        const validZoneIds = new Set<string>()
        const collect = (pId: string) => {
            validZoneIds.add(pId)
            zones.filter(z => z.parent_id === pId).forEach(child => collect(child.id))
        }
        collect(selectedTargetZoneId)

        // 2. Find positions in these zones
        const validPositionIds = new Set<string>()
        zonePositions.forEach(zp => {
            if (validZoneIds.has(zp.zone_id)) validPositionIds.add(zp.position_id)
        })

        // 3. Filter positions: Must match zone AND be empty (lot_id is null)
        const queue = allPositions.filter(p => validPositionIds.has(p.id) && !p.lot_id)

        // 4. Sort naturally (A-01, A-02...)
        return queue.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }))
    }, [selectedTargetZoneId, zones, allPositions, zonePositions])


    // Auto-focus manual input when step 1 and mode manual
    useEffect(() => {
        if (step === 1 && assignMode === 'manual' && inputRef.current) {
            inputRef.current.focus()
        }
    }, [step, assignMode])

    const handleReset = () => {
        setStep(0)
        setLotData(null)
        setAssignedPos('')
        setManualCode('')
        setPaused(false)
    }

    // Process a scanned or typed code
    const handleScanResult = async (rawCode: string, isManual = false) => {
        if (loading || (!isManual && paused) || !rawCode) return

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

        if (assignMode === 'auto') {
            await processAutoAssign(code)
        } else {
            if (step === 0) {
                await processLotScan(code)
            } else if (step === 1) {
                await processPositionScan(code)
            }
        }
    }

    const processAutoAssign = async (lotCode: string) => {
        if (!currentSystem?.code || !profile?.company_id) return

        // 1. Validate Queue
        if (autoQueue.length === 0) {
            showToast('Khu vực này đã đầy hoặc chưa cấu hình!', 'error')
            setPaused(false)
            return
        }

        setLoading(true)
        try {
            // 2. Find LOT
            const { data: lot, error } = await supabase
                .from('lots')
                .select('id, code, products(name)')
                .eq('code', lotCode)
                .single()

            if (error || !lot) {
                showToast(`Không tìm thấy LOT "${lotCode}"`, 'error')
                setPaused(false)
                setLoading(false)
                return
            }

            // 3. Pick Destination
            const targetPos = autoQueue[0]

            // [FIX] Clear LOT from any previous positions first to avoid duplicates
            await supabase
                .from('positions')
                .update({ lot_id: null } as any)
                .eq('lot_id', lot.id)

            // 4. Assign
            const { error: updateError } = await supabase
                .from('positions')
                .update({ lot_id: lot.id } as any)
                .eq('id', targetPos.id)

            if (updateError) throw updateError

            // 5. Update Local State (Optimistic)
            setAllPositions(prev => prev.map(p => p.id === targetPos.id ? { ...p, lot_id: lot.id } : p))

            // 6. Success Feedback
            setAssignedPos(`${targetPos.code}`)
            setLotData(lot) // Show brief info
            setStep(2) // Show success screen
            showToast(`Gán ${lot.code} vào ${targetPos.code} thành công!`, 'success')

            // 7. Auto Continue
            setTimeout(() => {
                setStep(0) // Back to scanning (Note: in Reset we clear lots, but we want to stay in Auto mode)
                setLotData(null)
                setAssignedPos('')
                setManualCode('')
                setPaused(false) // Ready for next scan
            }, 1500) // Faster reset for auto mode

        } catch (e: any) {
            console.error(e)
            showToast('Lỗi: ' + e.message, 'error')
            setPaused(false)
        } finally {
            setLoading(false)
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
                showToast('Đã nhận diện LOT. Vui lòng xác định vị trí.', 'success')

                // If in scan mode, we let camera continue. If manual, we pause camera logic.
                if (assignMode === 'manual') {
                    setPaused(true)
                } else {
                    setTimeout(() => setPaused(false), 1000)
                }
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
            // Fuzzy Match Logic
            const normalizedInput = normalize(posCode)
            let targetPos = null

            // 1. Try exact match first
            const { data: exactData } = await supabase
                .from('positions')
                .select('id, code')
                .eq('code', posCode)
                .eq('system_type', currentSystem.code)
                .single()

            if (exactData) {
                targetPos = exactData
            } else if (assignMode === 'manual') {
                // 2. Try fuzzy match from pre-fetched list
                const fuzzyMatch = allPositions.find(p => normalize(p.code) === normalizedInput)
                if (fuzzyMatch) {
                    targetPos = fuzzyMatch
                }
            }

            if (!targetPos) {
                showToast(`Không tìm thấy vị trí "${posCode}"`, 'error')
                setPaused(false)
                setLoading(false)
                return
            }

            // [FIX] Clear LOT from any previous positions first
            await supabase
                .from('positions')
                .update({ lot_id: null } as any)
                .eq('lot_id', lotData.id)

            // 2. Assign
            const { error: updateError } = await supabase
                .from('positions')
                .update({ lot_id: lotData.id } as any)
                .eq('id', targetPos.id)

            if (updateError) throw updateError

            // Success
            setAssignedPos(targetPos.code)
            setStep(2)
            showToast(`Đã gán LOT vào ${targetPos.code}`, 'success')

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

            {/* Header - Static Layout to avoid covering content */}
            <div className="z-20 p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="font-bold text-lg text-slate-900 dark:text-white">Gán Vị Trí</h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{currentSystem?.name}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setUseCamera(!useCamera)}
                            className="p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                        >
                            {useCamera ? <Keyboard size={18} /> : <Camera size={18} />}
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>

                {/* MODE SELECTOR - Compact */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setAssignMode('manual')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${assignMode === 'manual' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Nhập tay
                    </button>
                    <button
                        onClick={() => setAssignMode('scan')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${assignMode === 'scan' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Quét mã
                    </button>
                    <button
                        onClick={() => setAssignMode('auto')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${assignMode === 'auto' ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        Tự động
                    </button>
                </div>
            </div>

            {/* Main Content Area - No top padding needed now */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">

                {/* AUTO ASSIGN MODE UI */}
                {assignMode === 'auto' && step !== 2 && (
                    <div className="w-full max-w-2xl space-y-4 md:space-y-6 animate-in slide-in-from-bottom-5 pb-20">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <MapPin className="text-orange-600" />
                                Cấu hình Tự động
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-500 mb-2 block">Khu vực gán:</label>
                                    <ZoneCascadeSelector
                                        zones={zones}
                                        selectedZoneId={selectedTargetZoneId}
                                        onSelect={setSelectedTargetZoneId}
                                    />
                                </div>

                                {/* Queue Status */}
                                {selectedTargetZoneId && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Hàng chờ vị trí</span>
                                            <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-mono">
                                                {autoQueue.length} trống
                                            </span>
                                        </div>

                                        {autoQueue.length > 0 ? (
                                            <div className="flex flex-col gap-2">
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">Tiếp theo:</div>
                                                    <div className="text-xl md:text-2xl font-black text-orange-600 dark:text-orange-500 font-mono tracking-tight break-all leading-snug">
                                                        {autoQueue[0].code}
                                                    </div>
                                                </div>

                                                {autoQueue[1] && (
                                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                                        <div className="flex items-center gap-2 opacity-70">
                                                            <div className="text-[10px] text-slate-400 font-medium">Sau đó:</div>
                                                            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 font-mono break-all">
                                                                {autoQueue[1].code}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2 text-red-500 text-sm font-medium">
                                                Khu vực này đã đầy hoặc không có vị trí!
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Scanner for Auto Mode */}
                        {selectedTargetZoneId && autoQueue.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                                <h3 className="text-center font-bold text-slate-900 dark:text-white mb-4">Quét mã LOT để gán vào {autoQueue[0].code}</h3>
                                {useCamera ? (
                                    <div className="w-full max-w-xs aspect-square relative bg-black rounded-2xl overflow-hidden shadow-inner mx-auto border-2 border-slate-100 dark:border-slate-800">
                                        {cameraError ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-100 dark:bg-slate-800">
                                                <X className="w-8 h-8 text-red-500 mb-2" />
                                                <p className="text-xs text-red-500 font-medium mb-2">Không thể mở camera</p>
                                                <button
                                                    onClick={() => { setCameraError(null); setUseCamera(false); setTimeout(() => setUseCamera(true), 100); }}
                                                    className="px-3 py-1 bg-white dark:bg-slate-700 shadow-sm border rounded-lg text-xs font-bold"
                                                >
                                                    Thử lại
                                                </button>
                                            </div>
                                        ) : (
                                            <Scanner
                                                onScan={(result) => {
                                                    if (result && result.length > 0) {
                                                        handleScanResult(result[0].rawValue)
                                                    }
                                                }}
                                                onError={(error: any) => {
                                                    console.error('Scanner Error:', error)
                                                    setCameraError(error?.message || 'Lỗi camera')
                                                }}
                                                styles={{ container: { width: '100%', height: '100%' } }}
                                                components={{ finder: false }}
                                                constraints={{ facingMode: 'environment' }}
                                            />
                                        )}
                                        <div className="absolute inset-0 border-2 border-orange-500/50 rounded-2xl animate-pulse pointer-events-none"></div>
                                        {loading && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl backdrop-blur-sm">
                                                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <form onSubmit={(e) => { e.preventDefault(); handleScanResult(manualCode, true); }}>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={manualCode}
                                            onChange={(e) => setManualCode(e.target.value)}
                                            className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-xl font-bold uppercase mb-4 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white"
                                            placeholder="Nhập mã LOT..."
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            disabled={loading || !manualCode}
                                            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                                        >
                                            {loading ? 'Đang xử lý...' : 'Xác nhận gán'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* CAMERA VIEW (Step 0 or Step 1 with scan mode) for MANUAL/SCAN modes */}
                {assignMode !== 'auto' && useCamera && step !== 2 && (step === 0 || assignMode === 'scan') && (
                    <div className="w-full max-w-xs aspect-square relative bg-black rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-slate-800 mb-6 mx-auto">
                        {cameraError ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-100 dark:bg-slate-800 z-10">
                                <X className="w-12 h-12 text-red-500 mb-4" />
                                <p className="text-sm text-red-500 font-bold mb-1">Lỗi Camera</p>
                                <p className="text-xs text-slate-500 mb-4">{cameraError}</p>
                                <button
                                    onClick={() => { setCameraError(null); setUseCamera(false); setTimeout(() => setUseCamera(true), 100); }}
                                    className="px-4 py-2 bg-white dark:bg-slate-700 shadow-sm border rounded-xl text-sm font-bold hover:bg-slate-50"
                                >
                                    Thử lại
                                </button>
                            </div>
                        ) : (
                            <Scanner
                                onScan={(result) => {
                                    if (result && result.length > 0) {
                                        handleScanResult(result[0].rawValue)
                                    }
                                }}
                                onError={(error: any) => {
                                    console.error('Scanner Error:', error)
                                    setCameraError(error?.message || 'Lỗi kết nối camera')
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
                        )}
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
                {assignMode !== 'auto' && step !== 2 && (
                    <div className="text-center space-y-2 mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {step === 0 ? 'Quét mã LOT' : (assignMode === 'manual' ? 'Nhập Vị trí' : 'Quét Vị trí')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {step === 0
                                ? 'Đưa camera đến mã QR trên sản phẩm'
                                : (assignMode === 'manual' ? 'Nhập mã định danh kệ hàng' : 'Đưa camera đến mã QR trên kệ hàng')}
                        </p>
                    </div>
                )}

                {/* MANUAL INPUT VIEW (ALWAYS for Step 1 Manual Mode, or Step 0 if useCamera is false) */}
                {assignMode !== 'auto' && step !== 2 && (
                    <div className={`w-full max-w-md p-6 z-10 transition-all duration-300 ${((step === 0 && !useCamera) || (step === 1 && assignMode === 'manual')) ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute'}`}>
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 text-center">
                                {step === 0 ? 'Nhập mã LOT' : 'Nhập mã Vị trí'}
                            </h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleScanResult(manualCode, true); }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                    className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-xl font-bold uppercase mb-4 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white"
                                    placeholder={step === 0 ? "LOT-..." : "Vị trí..."}
                                    autoFocus={step === 0 && !useCamera}
                                />

                                {/* Suggestions Dropdown/List */}
                                {suggestions.length > 0 && (
                                    <div className="mb-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 ml-2 mb-1">Gợi ý vị trí:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestions.map(s => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setManualCode(s.code)
                                                        handleScanResult(s.code)
                                                    }}
                                                    className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors"
                                                >
                                                    {s.code}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
                        {step === 1 && assignMode !== 'auto' && (
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center animate-pulse">
                                {assignMode === 'manual' ? <Keyboard size={20} /> : <MapPin size={20} />}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
