'use client'
import React, { useEffect, useState, use } from 'react'
import { Settings, Loader2, FileText, Package, ArrowRight, ClipboardCheck, AlertTriangle, Trash2, Plus, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
    'DRAFT': 'bg-zinc-100 text-zinc-600 border-zinc-200',
    'PLANNED': 'bg-blue-50 text-blue-600 border-blue-200',
    'IN_PROGRESS': 'bg-amber-50 text-amber-600 border-amber-200',
    'DONE': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'CANCELED': 'bg-rose-50 text-rose-600 border-rose-200',
}
const STATUS_LABELS: Record<string, string> = {
    'DRAFT': 'Nháp', 'PLANNED': 'Đã lên KH', 'IN_PROGRESS': 'Đang SX', 'DONE': 'Hoàn thành', 'CANCELED': 'Đã hủy',
}
const REQ_STATUS_LABELS: Record<string, string> = {
    'PENDING': 'Chờ duyệt', 'APPROVED': 'Đã duyệt', 'PICKING': 'Đang nhặt hàng', 'DONE': 'Đã xuất', 'CANCELED': 'Đã hủy',
}

export default function MoDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { showToast } = useToast()
    const router = useRouter()
    const [mo, setMo] = useState<any>(null)
    const [bomLines, setBomLines] = useState<any[]>([])
    const [requisitions, setRequisitions] = useState<any[]>([])
    const [productionRecords, setProductionRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'requisitions' | 'production'>('overview')
    const [creatingReq, setCreatingReq] = useState(false)
    const [recordingProduction, setRecordingProduction] = useState(false)
    const [produceQty, setProduceQty] = useState(0)
    const [scrapQty, setScrapQty] = useState(0)
    const [produceNotes, setProduceNotes] = useState('')

    const fetchAll = async () => {
        setLoading(true)
        // Fetch MO
        const { data: rawMoData } = await supabase
            .from('manufacturing_orders' as any)
            .select('*, products!manufacturing_orders_product_id_fkey(id, name, unit, sku), boms(id, name, code, quantity)')
            .eq('id', id)
            .single()
        const moData = rawMoData as any
        setMo(moData)

        // Fetch BOM Lines if MO has bom_id
        if (moData?.boms?.id) {
            const { data: lines } = await supabase
                .from('bom_lines' as any)
                .select('*, products!bom_lines_material_id_fkey(name, unit, sku)')
                .eq('bom_id', moData.boms.id)
            setBomLines(lines || [])
        }

        // Fetch requisitions
        const { data: reqs } = await supabase
            .from('material_requisitions' as any)
            .select('*, material_requisition_lines(*, products!material_requisition_lines_material_id_fkey(name, unit))')
            .eq('mo_id', id)
            .order('created_at', { ascending: false })
        setRequisitions(reqs || [])

        // Fetch production records
        const { data: records } = await supabase
            .from('production_records' as any)
            .select('*')
            .eq('mo_id', id)
            .order('created_at', { ascending: false })
        setProductionRecords(records || [])

        setLoading(false)
    }

    useEffect(() => { if (id) fetchAll() }, [id])

    // Calculate needed materials based on BOM ratio
    const calculateMaterials = () => {
        if (!mo || !mo.boms || bomLines.length === 0) return []
        const ratio = mo.target_quantity / mo.boms.quantity
        return bomLines.map(line => ({
            ...line,
            requiredQty: Math.ceil(line.quantity * ratio * 100) / 100,
            scrapAdjusted: Math.ceil(line.quantity * ratio * (1 + (line.scrap_percentage || 0) / 100) * 100) / 100,
        }))
    }

    // Create Material Requisition from BOM
    const handleCreateRequisition = async () => {
        const materials = calculateMaterials()
        if (materials.length === 0) {
            showToast('Không có nguyên liệu để tạo phiếu xuất', 'error')
            return
        }

        setCreatingReq(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Chưa đăng nhập')
            const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

            const reqCode = `REQ-${mo.code}-${(requisitions.length + 1).toString().padStart(2, '0')}`

            const { data: newReq, error: reqErr } = await supabase.from('material_requisitions' as any).insert({
                mo_id: id,
                code: reqCode,
                status: 'PENDING',
                requested_by: user.id,
                notes: `Yêu cầu xuất NL cho Lệnh SX ${mo.code}`,
                company_id: profile?.company_id
            }).select().single()

            if (reqErr) throw reqErr

            const lines = materials.map(m => ({
                requisition_id: (newReq as any).id,
                material_id: m.products?.id || m.material_id,
                required_quantity: m.scrapAdjusted,
                unit: m.products?.unit || m.unit,
                company_id: profile?.company_id
            }))

            const { error: linesErr } = await supabase.from('material_requisition_lines' as any).insert(lines)
            if (linesErr) throw linesErr

            // Update MO status to IN_PROGRESS if it's still PLANNED or DRAFT
            if (mo.status === 'DRAFT' || mo.status === 'PLANNED') {
                await supabase.from('manufacturing_orders' as any).update({ status: 'IN_PROGRESS', updated_at: new Date().toISOString() }).eq('id', id)
            }

            showToast('Đã tạo Phiếu yêu cầu xuất NL thành công!', 'success')
            fetchAll()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setCreatingReq(false)
        }
    }

    // Record production
    const handleRecordProduction = async () => {
        if (produceQty <= 0 && scrapQty <= 0) {
            showToast('Vui lòng nhập số lượng thành phẩm hoặc phế phẩm', 'error')
            return
        }

        setRecordingProduction(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Chưa đăng nhập')
            const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
            const records: any[] = []

            if (produceQty > 0) {
                records.push({
                    mo_id: id,
                    record_type: 'PRODUCE',
                    product_id: mo.products.id,
                    quantity: produceQty,
                    unit: mo.products.unit,
                    recorded_by: user.id,
                    notes: produceNotes || `Ghi nhận sản lượng cho ${mo.code}`,
                    company_id: profile?.company_id
                })
            }

            if (scrapQty > 0) {
                records.push({
                    mo_id: id,
                    record_type: 'SCRAP',
                    product_id: mo.products.id,
                    quantity: scrapQty,
                    unit: mo.products.unit,
                    recorded_by: user.id,
                    notes: produceNotes || `Ghi nhận phế phẩm cho ${mo.code}`,
                    company_id: profile?.company_id
                })
            }

            const { error } = await supabase.from('production_records' as any).insert(records)
            if (error) throw error

            // Update produced_quantity on MO
            const totalProduced = productionRecords
                .filter(r => r.record_type === 'PRODUCE')
                .reduce((sum, r) => sum + r.quantity, 0) + produceQty

            await supabase.from('manufacturing_orders' as any).update({
                produced_quantity: totalProduced,
                updated_at: new Date().toISOString()
            }).eq('id', id)

            showToast('Đã ghi nhận sản lượng thành công!', 'success')
            setProduceQty(0)
            setScrapQty(0)
            setProduceNotes('')
            fetchAll()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setRecordingProduction(false)
        }
    }

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>
    }
    if (!mo) {
        return <div className="text-center p-12 text-zinc-500">Không tìm thấy lệnh sản xuất</div>
    }

    const materials = calculateMaterials()
    const totalProduced = productionRecords.filter(r => r.record_type === 'PRODUCE').reduce((s, r) => s + r.quantity, 0)
    const totalScrap = productionRecords.filter(r => r.record_type === 'SCRAP').reduce((s, r) => s + r.quantity, 0)
    const progressPercent = mo.target_quantity > 0 ? Math.min(100, Math.round((totalProduced / mo.target_quantity) * 100)) : 0

    return (
        <div className="space-y-6 animate-fade-in px-4 pt-4 max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                            <Settings size={28} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{mo.code}</h1>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full border ${STATUS_COLORS[mo.status || 'DRAFT']}`}>
                                    {STATUS_LABELS[mo.status || 'DRAFT']}
                                </span>
                            </div>
                            <p className="text-zinc-500 mt-1">
                                Sản phẩm: <strong className="text-zinc-700 dark:text-zinc-300">{mo.products?.name}</strong>
                                {mo.boms && <span className="ml-3 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">BOM: {mo.boms.name}</span>}
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/sanxuat/mo/${id}`}
                        className="px-4 py-2 text-sm font-bold rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-zinc-600 dark:text-zinc-300"
                    >
                        Sửa thông tin MO
                    </Link>
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Tiến độ sản xuất</span>
                        <span className="text-sm font-black text-emerald-600">{progressPercent}%</span>
                    </div>
                    <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-zinc-500">
                        <span>Mục tiêu: <strong>{mo.target_quantity} {mo.products?.unit}</strong></span>
                        <span>Đã SX: <strong className="text-emerald-600">{totalProduced}</strong> • Phế phẩm: <strong className="text-rose-500">{totalScrap}</strong></span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                {[
                    { key: 'overview', label: 'Tổng quan NVL', icon: FileText },
                    { key: 'requisitions', label: 'Phiếu Xuất NL', icon: Package, count: requisitions.length },
                    { key: 'production', label: 'Ghi nhận Sản lượng', icon: ClipboardCheck, count: productionRecords.length },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition ${activeTab === tab.key
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                            : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-black">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Nguyên Vật Liệu cần dùng (tính từ BOM)</h2>
                        <button
                            onClick={handleCreateRequisition}
                            disabled={creatingReq || materials.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm hover:from-emerald-600 hover:to-teal-700 transition disabled:opacity-50 shadow-sm"
                        >
                            {creatingReq ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            Tạo Phiếu Xuất NL
                        </button>
                    </div>

                    {materials.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" />
                            <p>BOM chưa có nguyên liệu hoặc Lệnh SX chưa gắn BOM.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase text-zinc-400">
                                    <th className="py-3">Nguyên liệu</th>
                                    <th className="py-3 text-right">Theo BOM (Base)</th>
                                    <th className="py-3 text-right">Cần cho MO này</th>
                                    <th className="py-3 text-right">+ Hao hụt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {materials.map(m => (
                                    <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="py-3">
                                            <p className="font-medium text-zinc-800 dark:text-zinc-200">{m.products?.name}</p>
                                            <p className="text-xs text-zinc-500">{m.products?.sku || '---'}</p>
                                        </td>
                                        <td className="py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                                            {m.quantity} {m.products?.unit}
                                        </td>
                                        <td className="py-3 text-right font-mono font-bold text-emerald-600">
                                            {m.requiredQty} {m.products?.unit}
                                        </td>
                                        <td className="py-3 text-right font-mono font-bold text-amber-600">
                                            {m.scrapAdjusted} {m.products?.unit}
                                            {m.scrap_percentage > 0 && <span className="text-[10px] ml-1 text-zinc-400">(+{m.scrap_percentage}%)</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'requisitions' && (
                <div className="space-y-4">
                    {requisitions.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 p-10 rounded-[24px] border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500">
                            <Package size={40} className="mx-auto mb-3 text-zinc-300" />
                            <p className="font-bold">Chưa có Phiếu Xuất Nguyên Liệu nào</p>
                            <p className="text-sm mt-1">Vào tab "Tổng quan NVL" và bấm "Tạo Phiếu Xuất NL" để bắt đầu.</p>
                        </div>
                    ) : (
                        requisitions.map((req: any) => (
                            <div key={req.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{req.code}</h3>
                                        <p className="text-xs text-zinc-500">{new Date(req.created_at).toLocaleString('vi-VN')}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${STATUS_COLORS[req.status === 'PENDING' ? 'PLANNED' : req.status === 'DONE' ? 'DONE' : 'IN_PROGRESS']}`}>
                                        {REQ_STATUS_LABELS[req.status] || req.status}
                                    </span>
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-zinc-400 font-bold border-b border-zinc-100 dark:border-zinc-800">
                                            <th className="py-2 text-left">Nguyên liệu</th>
                                            <th className="py-2 text-right">Yêu cầu</th>
                                            <th className="py-2 text-right">Đã xuất</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                                        {(req.material_requisition_lines || []).map((line: any) => (
                                            <tr key={line.id}>
                                                <td className="py-2 text-zinc-700 dark:text-zinc-300">{line.products?.name || '---'}</td>
                                                <td className="py-2 text-right font-mono text-emerald-600">{line.required_quantity} {line.unit}</td>
                                                <td className="py-2 text-right font-mono text-zinc-500">{line.issued_quantity || 0} {line.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'production' && (
                <div className="space-y-4">
                    {/* Record form */}
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-emerald-200 dark:border-emerald-900/40 shadow-sm space-y-4">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Plus size={20} className="text-emerald-600" /> Ghi nhận Sản lượng mới
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-zinc-600">Thành phẩm (SL tốt)</label>
                                <div className="relative">
                                    <input
                                        type="number" min="0" step="any"
                                        value={produceQty}
                                        onChange={e => setProduceQty(parseFloat(e.target.value) || 0)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 focus:ring-2 focus:ring-emerald-500 outline-none text-right font-mono font-bold text-emerald-600 pr-14"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">{mo.products?.unit}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-zinc-600">Phế phẩm (Hư hỏng)</label>
                                <div className="relative">
                                    <input
                                        type="number" min="0" step="any"
                                        value={scrapQty}
                                        onChange={e => setScrapQty(parseFloat(e.target.value) || 0)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10 focus:ring-2 focus:ring-rose-500 outline-none text-right font-mono font-bold text-rose-600 pr-14"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">{mo.products?.unit}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-zinc-600">Ghi chú</label>
                                <input
                                    type="text"
                                    value={produceNotes}
                                    onChange={e => setProduceNotes(e.target.value)}
                                    placeholder="Mẻ sáng, ca 1..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleRecordProduction}
                            disabled={recordingProduction}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-700 transition disabled:opacity-50 shadow-sm"
                        >
                            {recordingProduction ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                            {recordingProduction ? 'Đang lưu...' : 'Ghi nhận Sản lượng'}
                        </button>
                    </div>

                    {/* History */}
                    {productionRecords.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Lịch sử ghi nhận</h3>
                            <div className="space-y-2">
                                {productionRecords.map(r => (
                                    <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl border ${r.record_type === 'PRODUCE' ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 'bg-rose-50/50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30'}`}>
                                        <div className="flex items-center gap-3">
                                            {r.record_type === 'PRODUCE' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-rose-500" />}
                                            <div>
                                                <span className={`font-bold text-sm ${r.record_type === 'PRODUCE' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {r.record_type === 'PRODUCE' ? 'Thành phẩm' : 'Phế phẩm'}
                                                </span>
                                                <p className="text-[11px] text-zinc-500">{r.notes}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-mono font-bold ${r.record_type === 'PRODUCE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {r.record_type === 'PRODUCE' ? '+' : '-'}{r.quantity} {r.unit || mo.products?.unit}
                                            </span>
                                            <p className="text-[10px] text-zinc-400">{new Date(r.created_at).toLocaleString('vi-VN')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
