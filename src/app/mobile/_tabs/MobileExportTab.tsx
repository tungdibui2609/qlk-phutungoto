'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, Loader2, Camera, Keyboard, RotateCcw, CheckCircle2, Boxes } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { LotExportModal } from '@/components/warehouse/lots/LotExportModal'
import { Lot, Unit, ProductUnit } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'

type ScanStep = 0 | 1 | 2

export default function MobileExportTab() {
    const { profile } = useUser()
    const { currentSystem, hasModule } = useSystem()
    const { showToast } = useToast()

    const [step, setStep] = useState<ScanStep>(0)
    const [useCamera, setUseCamera] = useState(true)
    const [manualCode, setManualCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false)

    const [lotData, setLotData] = useState<Lot | null>(null)
    const [units, setUnits] = useState<Unit[]>([])
    const [productUnits, setProductUnits] = useState<ProductUnit[]>([])
    const [isExportingModalOpen, setIsExportingModalOpen] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        Promise.all([
            supabase.from('units').select('*').eq('is_active', true).order('name'),
            supabase.from('product_units').select('*')
        ]).then(([uRes, puRes]) => {
            if (uRes.data) setUnits(uRes.data)
            if (puRes.data) setProductUnits(puRes.data)
        })
    }, [])

    useEffect(() => {
        if (!useCamera && step === 0 && inputRef.current) inputRef.current.focus()
    }, [useCamera, step])

    function handleReset() {
        setStep(0); setLotData(null); setManualCode(''); setPaused(false); setIsExportingModalOpen(false)
    }

    async function handleScanResult(rawCode: string, isManual = false) {
        if (loading || (!isManual && paused) || !rawCode) return
        let code = rawCode.trim()
        try { if (code.startsWith('http')) { const url = new URL(code); const parts = url.pathname.split('/'); code = parts[parts.length - 1] || code } } catch { }
        code = code.toUpperCase()
        setPaused(true)
        if (step === 0) await processLotScan(code)
    }

    async function processLotScan(code: string) {
        if (!profile?.company_id) return
        setLoading(true)
        try {
            const { data, error } = await supabase.from('lots')
                .select(`*, suppliers (name), qc_info (name), lot_items (id, quantity, unit, product_id, products (name, sku, unit, cost_price)), positions (id, code), lot_tags (tag, lot_item_id)`)
                .eq('code', code).single()

            if (error || !data) { showToast(`Không tìm thấy LOT "${code}"`, 'error'); setPaused(false); return }
            if (data.company_id && data.company_id !== profile.company_id) { showToast(`LOT thuộc công ty khác!`, 'error'); setPaused(false); return }
            if (data.status === 'exported' || ((data.quantity ?? 0) <= 0.000001)) { showToast(`LOT "${code}" đã xuất hết`, 'warning'); setPaused(false); return }

            setLotData(data as any); setStep(1); setIsExportingModalOpen(true)
            showToast('Đã nhận diện LOT. Nhập thông tin xuất.', 'success')
        } catch (e: any) { showToast('Lỗi: ' + e.message, 'error'); setPaused(false) }
        finally { setLoading(false) }
    }

    function handleExportSuccess() {
        setIsExportingModalOpen(false); setStep(2)
        setTimeout(handleReset, 3000)
    }

    return (
        <div className="mobile-animate-fade-in">
            <div className="mobile-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div className="mobile-header-brand">Sarita Workspace</div>
                        <div className="mobile-header-title">Xuất Kho</div>
                        <div className="mobile-header-subtitle">{currentSystem?.name || ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="mobile-btn mobile-btn--ghost" onClick={() => setUseCamera(!useCamera)}>
                            {useCamera ? <Keyboard size={16} /> : <Camera size={16} />}
                        </button>
                        <button className="mobile-btn mobile-btn--ghost" onClick={handleReset}>
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Step 0: Scan */}
                {step === 0 && (
                    <>
                        {useCamera && (
                            <div className="mobile-scanner" style={{ marginBottom: 20 }}>
                                <Scanner
                                    onScan={(result) => { if (result?.length > 0) handleScanResult(result[0].rawValue) }}
                                    styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' as any } }}
                                    components={{ finder: false }}
                                    constraints={{ facingMode: 'environment' }}
                                />
                                <div className="mobile-scanner-corner mobile-scanner-corner--tl" />
                                <div className="mobile-scanner-corner mobile-scanner-corner--tr" />
                                <div className="mobile-scanner-corner mobile-scanner-corner--bl" />
                                <div className="mobile-scanner-corner mobile-scanner-corner--br" />
                                {loading && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
                                        <Loader2 size={36} className="animate-spin" style={{ color: '#e11d48' }} />
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#e11d48' }}>
                                <QrCode size={28} />
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#18181b' }}>{useCamera ? 'Quét mã LOT' : 'Nhập mã LOT'}</div>
                            <p style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 500, maxWidth: 280, margin: '6px auto 0' }}>
                                {useCamera ? 'Đưa mã QR vào khung hình để bắt đầu xuất kho' : 'Nhập mã LOT và nhấn Xác nhận'}
                            </p>
                        </div>

                        {!useCamera && (
                            <div style={{ width: '100%', maxWidth: 380 }} className="mobile-animate-slide-up">
                                <div className="mobile-card" style={{ padding: 24 }}>
                                    <form onSubmit={e => { e.preventDefault(); handleScanResult(manualCode, true) }}>
                                        <input ref={inputRef} type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
                                            className="mobile-input" style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}
                                            placeholder="VÍ DỤ: LOT23..." />
                                        <button type="submit" disabled={loading || !manualCode} className="mobile-btn mobile-btn--danger mobile-btn--lg">
                                            {loading ? <Loader2 size={22} className="animate-spin" /> : 'Xác nhận'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Step 2: Success */}
                {step === 2 && (
                    <div className="mobile-card-premium mobile-animate-slide-up" style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 360, width: '100%' }}>
                        <div style={{ width: 80, height: 80, borderRadius: 999, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: '#16a34a' }}>
                            <CheckCircle2 size={42} strokeWidth={2.5} />
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#18181b', marginBottom: 8, textAlign: 'center' }}>Xuất kho thành công!</h2>
                        <p style={{ color: '#a1a1aa', textAlign: 'center', fontSize: 13, marginBottom: 24 }}>
                            Dữ liệu đã được cập nhật vào hệ thống.
                        </p>
                        <button onClick={handleReset} className="mobile-btn mobile-btn--lg" style={{ background: '#18181b', color: '#fff' }}>
                            Tiếp tục quét mã khác
                        </button>
                    </div>
                )}
            </div>

            {/* LOT Overlay when modal closed */}
            {lotData && step === 1 && !isExportingModalOpen && (
                <div style={{ position: 'fixed', bottom: 72, left: 0, right: 0, padding: 16, background: '#fff', borderTop: '1px solid #e4e4e7', zIndex: 30, borderRadius: '24px 24px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,0.08)' }}
                    className="mobile-animate-slide-up">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 18, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                            <Boxes size={24} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(lotData as any)?.products?.name || lotData.code}</div>
                            <div style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{lotData.code}</div>
                        </div>
                    </div>
                    <button onClick={() => setIsExportingModalOpen(true)} className="mobile-btn mobile-btn--danger mobile-btn--lg">
                        Mở biểu mẫu xuất kho
                    </button>
                </div>
            )}

            {isExportingModalOpen && lotData && (
                <LotExportModal
                    lot={lotData}
                    onClose={() => { setIsExportingModalOpen(false); setStep(0); setPaused(false) }}
                    onSuccess={handleExportSuccess}
                    units={units}
                    productUnits={productUnits}
                    isUtilityEnabled={hasModule}
                />
            )}
        </div>
    )
}
