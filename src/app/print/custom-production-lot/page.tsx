'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Printer, Loader2, Hash, ArrowLeft, CheckCircle2, AlertTriangle, X, RotateCcw } from 'lucide-react'

export default function CustomLabelPrintPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-zinc-500">Đang tải...</div>}>
            <CustomLabelContent />
        </Suspense>
    )
}

// ─── Tính ngày Julian ─────────────────────────────────────────────────────────
function getJulianDay(dateString: string): string {
    if (!dateString) return '000'
    const date = new Date(dateString)
    const start = new Date(date.getFullYear(), 0, 0)
    const diff = date.getTime() - start.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24)).toString().padStart(3, '0')
}

// ─── Mẫu tem khách hàng (dạng bảng) ─────────────────────────────────────────
function CustomLabel({ data, config, index }: { data: any; config: any; index: number }) {
    const julian = getJulianDay(config.production_date)
    const lotCode = `${config.product_sign || 'MG'}${config.group_sign || '004'}F${julian}N7`
    const productName = config.product_name_custom || data?.products?.name || ''
    const nsxDisplay = config.production_date ? new Date(config.production_date).toLocaleDateString('vi-VN') : '---'
    const hsdDisplay = config.expiry_date ? new Date(config.expiry_date).toLocaleDateString('vi-VN') : '---'
    const barcode = config.barcode || data?.lot_code || ''
    // Cột cố định thẳng hàng: C1=25% | C2=25% | C3=25% | C4=25%
    const cell = 'border-b border-r border-zinc-400 px-1.5 py-[4px]'
    const cellLast = 'border-b border-zinc-400 px-1.5 py-[4px]'
    const lbl = 'text-[9px] font-black text-black uppercase tracking-tighter'
    const val = 'text-[10px] font-black text-black'
    const valLg = 'text-[12px] font-black text-black'

    return (
        <div className="bg-white border border-zinc-400 overflow-hidden flex flex-col shadow-lg print:shadow-none print:border-zinc-300" style={{ width: '90mm', height: '60mm', boxSizing: 'border-box', fontFamily: "'Inter', 'Segoe UI', Roboto, system-ui, sans-serif" }}>
            {/* ── Header: Tên sản phẩm (Cân đối lại) ── */}
            <div className="bg-white px-2 py-3 flex-shrink-0 border-b border-zinc-400 min-h-[15mm] flex items-center justify-center overflow-hidden">
                <h1
                    className="font-black text-black leading-[1.1] uppercase text-center tracking-tight"
                    style={{
                        fontSize: productName.length > 80 ? '10px' :
                                 productName.length > 60 ? '11px' :
                                 productName.length > 40 ? '13px' : '15px',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                        maxHeight: '48px'
                    }}
                >
                    {productName}
                </h1>
            </div>

            {/* ── Bảng thông tin (Chiếm không gian trung tâm) ── */}
            <div className="flex-1 flex flex-col text-[9px]" style={{ fontFamily: "'Inter', 'Segoe UI', Roboto, system-ui, sans-serif" }}>
                {/* NCC | value */}
                <div className="flex border-b border-zinc-400">
                    <div className={`w-[18%] ${cell} ${lbl}`}>NCC</div>
                    <div className={`flex-1 border-b border-zinc-400 px-1.5 py-[2px] ${val} text-center`}>{config.customer_name || 'CT'}</div>
                </div>

                {/* Số Lot | value | TL | value */}
                <div className="flex border-b border-zinc-400">
                    <div className={`w-[18%] ${cell} ${lbl}`}>Số Lot</div>
                    <div className={`w-[40%] ${cell} ${valLg} tracking-tight`}>
                        {config.product_sign || 'MG'}{config.group_sign || '004'}F{julian}N7
                    </div>
                    <div className={`w-[12%] ${cell} ${lbl}`}>TL</div>
                    <div className={`w-[30%] ${cellLast} ${val} text-right`}>{config.net_weight || '10'}</div>
                </div>

                {/* Kiện số | value | NSX | value */}
                <div className="flex border-b border-zinc-400">
                    <div className={`w-[18%] ${cell} ${lbl}`}>Kiện số</div>
                    <div className={`w-[40%] ${cell} ${valLg}`}>{index.toString().padStart(2, '0')}</div>
                    <div className={`w-[12%] ${cell} ${lbl}`}>NSX</div>
                    <div className={`w-[30%] ${cellLast} ${val} text-right`}>{nsxDisplay}</div>
                </div>

                {/* ĐVT | value | HSD | value */}
                <div className="flex border-b border-zinc-400">
                    <div className={`w-[18%] ${cell} ${lbl}`}>ĐVT</div>
                    <div className={`w-[40%] ${cell} ${val}`}>{config.unit || 'Kg'}</div>
                    <div className={`w-[12%] ${cell} ${lbl}`}>HSD</div>
                    <div className={`w-[30%] ${cellLast} ${val} text-right`}>{hsdDisplay}</div>
                </div>

                {/* Đơn hàng | value | Tham chiếu */}
                <div className="flex border-b border-zinc-400">
                    <div className={`w-[18%] ${cell} ${lbl}`}>Đơn hàng</div>
                    <div className={`w-[40%] ${cell} ${val} text-right font-black`}>{config.order_code || 'NF-CT'}</div>
                    <div className={`flex-1 border-b border-zinc-400 px-1.5 py-[2px] text-center ${lbl}`}>BARCODE</div>
                </div>

                {/* Tham chiếu text | Barcode sọc (Mã Lot) ── */}
                <div className="flex text-zinc-800" style={{ height: '12mm' }}>
                    <div className="w-[58%] border-r border-zinc-400 flex items-center justify-center px-1 text-[10px] font-black tracking-tight text-center break-all leading-tight">
                        {config.barcode || '---'}
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-1 overflow-hidden px-4">
                        <div className="barcode-font leading-none select-none text-[20px] whitespace-nowrap">
                            *{index.toString().padStart(2, '0')}*
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Nội dung chính ───────────────────────────────────────────────────────────
function CustomLabelContent() {
    const searchParams = useSearchParams()
    const lotId = searchParams.get('id')
    const token = searchParams.get('token')

    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [data, setData] = useState<any>(null)
    const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' })

    const [config, setConfig] = useState({
        product_name_custom: '',
        customer_name: 'CT',
        product_sign: 'MG',
        group_sign: '004',
        order_code: 'NF-CT',
        net_weight: '10',
        unit: 'Kg',
        production_date: new Date().toISOString().split('T')[0],
        expiry_years: 2,
        expiry_date: '',
        barcode: '',
        label_count: 1,
        start_index: 1,
    })

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, msg, type })
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3000)
    }

    // ── Fetch data ──
    useEffect(() => {
        async function fetch() {
            if (!lotId) { setLoading(false); return }
            if (token) await supabase.auth.setSession({ access_token: token, refresh_token: '' })

            const { data: raw } = await (supabase
                .from('production_lots')
                .select('*, products(name,sku,unit), productions(*,customers:customer_id(name))')
                .eq('id', lotId)
                .single() as any)

            if (raw) {
                setData(raw)
                const db = raw.print_config || {}
                const local = (() => { try { return JSON.parse(localStorage.getItem(`cpl_${lotId}`) || '{}') } catch { return {} } })()
                const merged = { ...config, ...local, ...db }
                const expYears = merged.expiry_years || 2
                const pDate = merged.production_date || new Date().toISOString().split('T')[0]
                const eDate = merged.expiry_date || new Date(new Date(pDate).setFullYear(new Date(pDate).getFullYear() + expYears)).toISOString().split('T')[0]
                setConfig({
                    ...merged,
                    product_name_custom: merged.product_name_custom || raw.products?.name || '',
                    customer_name: merged.customer_name || raw.productions?.customers?.name || 'CT',
                    net_weight: merged.net_weight || (raw.weight_per_unit ? `${raw.weight_per_unit}` : '10'),
                    barcode: merged.barcode || raw.lot_code || '',
                    expiry_years: expYears,
                    expiry_date: eDate,
                    start_index: (raw.last_printed_index || 0) + 1,
                })
            }
            setLoading(false)
        }
        fetch()
    }, [lotId, token])

    // ── Autosave ──
    useEffect(() => {
        const t = setTimeout(async () => {
            if (!lotId || !data || loading) return
            localStorage.setItem(`cpl_${lotId}`, JSON.stringify(config))
            await (supabase.from('production_lots') as any).update({ print_config: config }).eq('id', lotId)
        }, 800)
        return () => clearTimeout(t)
    }, [config, lotId, data, loading])

    // ── In ──
    const handlePrint = async () => {
        if (!data || !lotId) return
        setIsSaving(true)
        const count = Number(config.label_count) || 1
        const startIdx = Number(config.start_index) || 1
        try {
            const updates = {
                total_printed_labels: (Number(data.total_printed_labels) || 0) + count,
                last_printed_index: startIdx + count - 1,
                last_printed_at: new Date().toISOString(),
            }
            await (supabase.from('production_lots') as any).update(updates).eq('id', lotId)
            setData((p: any) => ({ ...p, ...updates }))
            setTimeout(() => {
                window.print()
                setConfig(p => ({ ...p, start_index: updates.last_printed_index + 1 }))
                setIsSaving(false)
                showToast(`Đã in ${count} tem khách hàng!`)
            }, 300)
        } catch (e: any) {
            showToast('Lỗi khi lưu: ' + e.message, 'error')
            setIsSaving(false)
        }
    }

    // ── Update expiry khi đổi NSX hoặc số năm ──
    const updateExpiry = (pDate: string, years: number) => {
        const eDate = new Date(new Date(pDate).setFullYear(new Date(pDate).getFullYear() + years)).toISOString().split('T')[0]
        setConfig(p => ({ ...p, production_date: pDate, expiry_years: years, expiry_date: eDate }))
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
            <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
        </div>
    )

    if (!data) return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
            <div className="text-center p-8 bg-white rounded-3xl shadow border">
                <Hash className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <p className="text-rose-500 font-bold">Không tìm thấy lô hàng</p>
            </div>
        </div>
    )

    const labels = Array.from({ length: Number(config.label_count) || 1 }, (_, i) => ({
        index: (Number(config.start_index) || 1) + i
    }))

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-rose-50 print:bg-white print:p-0">
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap');
                .barcode-font { font-family: 'Libre Barcode 39', cursive; font-size: 35px; }
            `}} />

            {/* ── Thanh điều hướng ── */}
            <div className="print:hidden bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-zinc-900 uppercase tracking-tight">In Tem Khách Hàng</h1>
                        <p className="text-xs text-zinc-400 font-medium">{data.lot_code} · {data.products?.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                        Đã in: {data.total_printed_labels || 0} tem
                    </span>
                    <button
                        onClick={handlePrint}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-orange-500/20 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />}
                        Xác nhận & In
                    </button>
                </div>
            </div>

            {/* ── Form cấu hình ── */}
            <div className="print:hidden max-w-5xl mx-auto px-6 py-8">
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl p-8">
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-6">Thông số tem</h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {/* Tên SP */}
                        <div className="lg:col-span-4 space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Tên sản phẩm (hiển thị trên tem)</label>
                            <input value={config.product_name_custom}
                                onChange={e => setConfig(p => ({ ...p, product_name_custom: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="VD: Xoài Kaew/ IQF/ 20x20mm/ TC Châu Âu..." />
                        </div>

                        {/* NCC / Customer */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">NCC (Khách hàng)</label>
                            <input value={config.customer_name}
                                onChange={e => setConfig(p => ({ ...p, customer_name: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="CT" />
                        </div>

                        {/* Ký hiệu SP */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Ký hiệu SP</label>
                            <input value={config.product_sign}
                                onChange={e => setConfig(p => ({ ...p, product_sign: e.target.value.toUpperCase() }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="MG" />
                        </div>

                        {/* Ký hiệu nhóm */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Ký hiệu nhóm</label>
                            <input value={config.group_sign}
                                onChange={e => setConfig(p => ({ ...p, group_sign: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="004" />
                        </div>

                        {/* Trọng lượng */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Trọng lượng</label>
                            <input value={config.net_weight}
                                onChange={e => setConfig(p => ({ ...p, net_weight: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="10" />
                        </div>

                        {/* ĐVT */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">ĐVT</label>
                            <input value={config.unit}
                                onChange={e => setConfig(p => ({ ...p, unit: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="Kg" />
                        </div>

                        {/* Đơn hàng */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Đơn hàng</label>
                            <input value={config.order_code}
                                onChange={e => setConfig(p => ({ ...p, order_code: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="NF-CT" />
                        </div>

                        {/* NSX */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Ngày SX (NSX)</label>
                            <input type="date" value={config.production_date}
                                onChange={e => updateExpiry(e.target.value, config.expiry_years)}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        </div>

                        {/* HSD years */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Hạn sử dụng (năm)</label>
                            <input type="number" min={1} value={config.expiry_years}
                                onChange={e => updateExpiry(config.production_date, parseInt(e.target.value) || 2)}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        </div>

                        {/* HSD manual */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">HSD (tự chỉnh)</label>
                            <input type="date" value={config.expiry_date}
                                onChange={e => setConfig(p => ({ ...p, expiry_date: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        </div>

                        {/* Barcode text */}
                        <div className="lg:col-span-2 space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">Tham chiếu</label>
                            <input value={config.barcode}
                                onChange={e => setConfig(p => ({ ...p, barcode: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="G010801213TC06P023CTF" />
                        </div>

                        {/* Số lượng */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-orange-500">Số lượng tem</label>
                            <input type="number" min={1} value={config.label_count}
                                onChange={e => setConfig(p => ({ ...p, label_count: parseInt(e.target.value) || 1 }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-sm font-black text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        </div>

                        {/* STT bắt đầu */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-400">STT bắt đầu</label>
                            <input type="number" min={1} value={config.start_index}
                                onChange={e => setConfig(p => ({ ...p, start_index: parseInt(e.target.value) || 1 }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-200" />
                        </div>
                    </div>

                    {/* Preview Julian & LOT */}
                    <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-200">
                        <p className="text-[10px] font-black uppercase text-orange-500 mb-1">Xem trước Số Lot</p>
                        <p className="text-xl font-black tracking-wider">
                            {config.product_sign}{config.group_sign}F
                            <span className="text-orange-500 underline">{getJulianDay(config.production_date)}</span>
                            N7
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">Julian ngày {getJulianDay(config.production_date)} · NSX {config.production_date} · HSD {config.expiry_date}</p>
                    </div>
                </div>

                {/* Preview tem */}
                <div className="mt-8">
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Xem trước tem (1 tem mẫu)</h2>
                    <div className="inline-block">
                        <CustomLabel data={data} config={config} index={config.start_index} />
                    </div>
                </div>
            </div>

            {/* ── Vùng in ── */}
            <div id="custom-print-area" className="hidden print:block">
                <style dangerouslySetInnerHTML={{ __html: `
                    @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap');
                    @media print {
                        body * { visibility: hidden !important; }
                        #custom-print-area, #custom-print-area * { visibility: visible !important; }
                        #custom-print-area { position: absolute !important; left: 0 !important; top: 0 !important; }
                        .cpl-break { page-break-after: always; break-after: page; display: block; height: 0; }
                        @page { margin: 0; size: 90mm 60mm; }
                    }
                    .barcode-font { font-family: 'Libre Barcode 39', cursive; font-size: 32px; }
                `}} />
                {labels.map((lbl, i) => (
                    <React.Fragment key={i}>
                        <CustomLabel data={data} config={config} index={lbl.index} />
                        <div className="cpl-break" />
                    </React.Fragment>
                ))}
            </div>

            {/* ── Toast ── */}
            {toast.show && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300 print:hidden ${
                    toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-red-500" />}
                    <span className="text-sm font-bold">{toast.msg}</span>
                    <button onClick={() => setToast(p => ({ ...p, show: false }))}><X size={16} /></button>
                </div>
            )}
        </div>
    )
}
