'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
    Scale, Upload, FileSpreadsheet, Download, Loader2, AlertTriangle, CheckCircle2,
    X, Search, ArrowDownRight, ArrowUpRight, PackageMinus, PackagePlus, Info, Trash2
} from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { parseStocktakeFile, ParsedStocktake, StocktakeFormat } from '@/lib/stocktakeSnapshotParser'
import { reconcileStocktake, StocktakeDiffRow, DiffKind, describeLocation } from '@/lib/stocktakeReconciliation'
import { exportStocktakeDiffToExcel } from '@/lib/stocktakeDiffExcelExport'

interface PairState {
    before: ParsedStocktake | null
    after: ParsedStocktake | null
    error: string | null
}

const EMPTY_PAIR: PairState = { before: null, after: null, error: null }

const FORMAT_LABEL: Record<StocktakeFormat, string> = {
    table: 'Dạng Bảng',
    grid: 'Dạng Lưới',
    lot: 'Tồn theo LOT',
}

const TAB_ORDER: StocktakeFormat[] = ['table', 'grid', 'lot']

const FILE_SOURCE_HINT: Record<StocktakeFormat, string> = {
    table: 'sơ đồ kho dạng Bảng',
    grid: 'sơ đồ kho dạng Lưới',
    lot: 'tồn kho xuất từ tab "Theo LOT"',
}

const KIND_LABEL: Record<DiffKind, string> = {
    changed: 'Lệch SL',
    only_before: 'Mất ở mốc sau',
    only_after: 'Phát sinh ở mốc sau',
    same: 'Không đổi',
}

function formatQty(value: number): string {
    return value.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function SlotCard({
    title,
    accent,
    snapshot,
    loading,
    onPick,
    onClear,
}: {
    title: string
    accent: string
    snapshot: ParsedStocktake | null
    loading: boolean
    onPick: (file: File) => void
    onClear: () => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)

    return (
        <div className={`flex-1 rounded-xl border-2 border-dashed p-4 ${snapshot ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-300 bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wide ${accent}`}>{title}</span>
                {snapshot && (
                    <button onClick={onClear} className="text-slate-400 hover:text-red-500" title="Bỏ file này">
                        <Trash2 size={15} />
                    </button>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) onPick(file)
                    e.target.value = ''
                }}
            />

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500 py-3">
                    <Loader2 size={18} className="animate-spin" /> Đang đọc file...
                </div>
            ) : snapshot ? (
                <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-slate-800 break-all">
                        <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                        {snapshot.fileName}
                    </div>
                    <div className="text-xs text-slate-500">
                        Kho: <b>{snapshot.systemName || snapshot.zoneName || '—'}</b> · Ngày xuất: <b>{snapshot.exportDate || '—'}</b>
                    </div>
                    <div className="text-xs text-slate-500">
                        {snapshot.format === 'lot' ? (
                            <>
                                <b>{snapshot.rows.length}</b> mục sản phẩm × ĐVT · {new Set(snapshot.rows.map(r => r.unit)).size} đơn vị tính
                            </>
                        ) : (
                            <>
                                {snapshot.rows.length} dòng · Tổng đọc được: <b>{formatQty(snapshot.parsedTotal)}</b>
                                {snapshot.declaredTotal !== null && ` · Tổng file ghi: ${formatQty(snapshot.declaredTotal)}`}
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => inputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1 py-5 w-full text-slate-500 hover:text-indigo-600"
                >
                    <Upload size={20} />
                    <span className="text-sm font-medium">Chọn file Excel đã tải</span>
                </button>
            )}
        </div>
    )
}

export default function StocktakeDiffPage() {
    const { currentSystem, hasModule } = useSystem()
    const { showToast } = useToast()
    const { companyInfo } = usePrintCompanyInfo()

    const [activeFormat, setActiveFormat] = useState<StocktakeFormat>('table')
    const [pairs, setPairs] = useState<Record<StocktakeFormat, PairState>>({ table: EMPTY_PAIR, grid: EMPTY_PAIR, lot: EMPTY_PAIR })
    const [loadingSlot, setLoadingSlot] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [kindFilter, setKindFilter] = useState<'all' | DiffKind>('all')
    const [minDiff, setMinDiff] = useState('')
    const [showSame, setShowSame] = useState(false)

    const guard = currentSystem && !hasModule('report_stocktake_diff')

    const pair = pairs[activeFormat]

    const handlePick = useCallback(async (format: StocktakeFormat, slot: 'before' | 'after', file: File) => {
        setLoadingSlot(`${format}:${slot}`)
        try {
            const snapshot = await parseStocktakeFile(file)
            if (snapshot.format !== format) {
                showToast(`File này thuộc ${FORMAT_LABEL[snapshot.format]} — đã đặt vào đúng tab ${FORMAT_LABEL[snapshot.format]}.`, 'info')
            }
            const targetFormat = snapshot.format
            setPairs(prev => {
                const next = { ...prev, [targetFormat]: { ...prev[targetFormat], error: null } }
                if (slot === 'before' || !next[targetFormat].before) next[targetFormat].before = snapshot
                else next[targetFormat].after = snapshot
                return next
            })
        } catch (err: any) {
            const message = err?.message || 'Không đọc được file Excel này.'
            setPairs(prev => ({ ...prev, [format]: { ...prev[format], error: message } }))
            showToast(message, 'error')
        } finally {
            setLoadingSlot(null)
        }
    }, [showToast])

    const clearSlot = useCallback((format: StocktakeFormat, slot: 'before' | 'after') => {
        setPairs(prev => ({
            ...prev,
            [format]: { ...prev[format], [slot]: null, error: null },
        }))
    }, [])

    const reconciliation = useMemo(() => {
        if (!pair.before || !pair.after) return null
        try {
            return reconcileStocktake(pair.before, pair.after)
        } catch (err: any) {
            return { error: err?.message || 'Không đối chiếu được 2 file này.' } as const
        }
    }, [pair.before, pair.after])

    const result = reconciliation && 'format' in reconciliation ? reconciliation : null
    const reconcileError = reconciliation && 'error' in reconciliation ? reconciliation.error : null

    const visibleRows = useMemo(() => {
        if (!result) return []
        const threshold = Math.abs(parseFloat(minDiff.replace(',', '.'))) || 0
        const term = searchTerm.trim().toLowerCase()
        return result.allRows.filter(row => {
            if (!showSame && row.kind === 'same') return false
            if (kindFilter !== 'all' && row.kind !== kindFilter) return false
            if (Math.abs(row.diff) < threshold) return false
            if (!term) return true
            return [row.warehouse, row.rowName, row.binName, row.levelName, row.positionCode, row.lotCode, row.sku, row.productName, row.unit, row.category]
                .some(part => (part || '').toLowerCase().includes(term))
        })
    }, [result, searchTerm, kindFilter, minDiff, showSame])

    const unitSummary = useMemo(() => {
        if (!result) return []
        const map = new Map<string, { before: number; after: number; rows: number }>()
        visibleRows.forEach(row => {
            const unit = row.unit || '(không rõ ĐVT)'
            const acc = map.get(unit) || { before: 0, after: 0, rows: 0 }
            acc.before += row.beforeQty
            acc.after += row.afterQty
            acc.rows += 1
            map.set(unit, acc)
        })
        return Array.from(map.entries())
            .map(([unit, acc]) => ({
                unit,
                before: Math.round(acc.before * 1000) / 1000,
                after: Math.round(acc.after * 1000) / 1000,
                diff: Math.round((acc.after - acc.before) * 1000) / 1000,
                rows: acc.rows,
            }))
            .sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }))
    }, [result, visibleRows])

    const systemMismatch = useMemo(() => {
        if (!currentSystem?.code) return null
        const currentCode = currentSystem.code.toUpperCase()
        const names = [pair.before?.systemName, pair.after?.systemName].filter((name): name is string => Boolean(name))
        return names.find(name => name.toUpperCase() !== currentCode) || null
    }, [currentSystem?.code, pair.before, pair.after])

    const handleExport = async () => {
        if (!result) return
        try {
            await exportStocktakeDiffToExcel(result, visibleRows.filter(row => row.kind !== 'same'), { companyInfo })
            showToast(`Đã xuất báo cáo đối chiếu với ${visibleRows.filter(r => r.kind !== 'same').length} dòng sai lệch.`, 'success')
        } catch (err: any) {
            showToast(err?.message || 'Không xuất được file Excel.', 'error')
        }
    }

    const renderStats = () => {
        if (!result) return null
        const cards = [
            { label: 'Dòng lệch số lượng', value: result.changedCount, tone: 'text-indigo-600', icon: ArrowUpRight },
            { label: 'Mất ở mốc sau', value: result.onlyBeforeCount, tone: 'text-red-600', icon: PackageMinus },
            { label: 'Phát sinh ở mốc sau', value: result.onlyAfterCount, tone: 'text-amber-600', icon: PackagePlus },
            { label: result.format === 'lot' ? 'Sản phẩm có sai lệch' : 'Vị trí có sai lệch', value: result.positionCount, tone: 'text-slate-800', icon: Search },
        ]
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cards.map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                        <card.icon size={20} className={card.tone} />
                        <div>
                            <div className={`text-2xl font-bold ${card.tone}`}>{card.value.toLocaleString('vi-VN')}</div>
                            <div className="text-xs text-slate-500">{card.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    const renderTable = () => {
        if (!result) return null
        const isTable = result.format === 'table'
        const isLot = result.format === 'lot'
        const showSku = isTable || isLot
        const columnCount = isTable ? 9 : 8
        const capped = visibleRows.slice(0, 800)
        return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="max-h-[60vh] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-slate-600 text-xs uppercase">
                            <tr>
                                <th className="px-2 py-2 text-left">STT</th>
                                <th className="px-2 py-2 text-left">{isLot ? 'Danh mục' : 'Vị trí'}</th>
                                {isTable && <th className="px-2 py-2 text-left">Số lô</th>}
                                <th className="px-2 py-2 text-left">Sản phẩm</th>
                                <th className="px-2 py-2 text-center">ĐVT</th>
                                <th className="px-2 py-2 text-right">SL trước</th>
                                <th className="px-2 py-2 text-right">SL sau</th>
                                <th className="px-2 py-2 text-right">Chênh</th>
                                <th className="px-2 py-2 text-left">Loại</th>
                            </tr>
                        </thead>
                        <tbody>
                            {capped.map((row: StocktakeDiffRow, index) => (
                                <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-2 py-1.5 text-slate-400">{index + 1}</td>
                                    <td className="px-2 py-1.5 font-medium text-slate-700">
                                        {isLot ? (row.category || '—') : describeLocation(row)}
                                    </td>
                                    {isTable && <td className="px-2 py-1.5 text-slate-600">{row.lotCode || '—'}</td>}
                                    <td className="px-2 py-1.5 text-slate-700">
                                        {row.productName || row.sku || '—'}
                                        {showSku && row.sku && row.productName !== row.sku && (
                                            <span className="text-xs text-slate-400"> ({row.sku})</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-slate-500">{row.unit || '—'}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-600">{row.kind === 'only_after' ? '—' : formatQty(row.beforeQty)}</td>
                                    <td className="px-2 py-1.5 text-right text-slate-600">{row.kind === 'only_before' ? '—' : formatQty(row.afterQty)}</td>
                                    <td className={`px-2 py-1.5 text-right font-bold ${row.diff < 0 ? 'text-red-600' : row.diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {row.diff > 0 ? '+' : ''}{formatQty(row.diff)}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            row.kind === 'changed' ? 'bg-indigo-50 text-indigo-700'
                                                : row.kind === 'only_before' ? 'bg-red-50 text-red-700'
                                                    : row.kind === 'only_after' ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {KIND_LABEL[row.kind]}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {capped.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-4 py-10 text-center text-emerald-600">
                                        <CheckCircle2 size={22} className="inline mr-2" />
                                        Không có sai lệch theo bộ lọc hiện tại.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {visibleRows.length > capped.length && (
                    <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-200">
                        Đang hiển thị {capped.length} / {visibleRows.length} dòng. File Excel xuất đủ toàn bộ.
                    </div>
                )}
            </div>
        )
    }

    if (guard) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-6">
                    <Scale size={40} className="text-stone-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">Đối chiếu kiểm kê</h2>
                <p className="text-stone-500 max-w-md">
                    Tính năng chưa được kích hoạt cho kho này. Vui lòng vào Cài đặt phân hệ → Tính năng → nhóm Báo cáo để bật.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Scale size={24} className="text-indigo-600" /> Đối chiếu kiểm kê
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Mỗi tab đối chiếu 2 file cùng loại: sơ đồ kho dạng Bảng, dạng Lưới, hoặc tồn kho theo LOT (trước kiểm kê ↔ sau kiểm kê).
                        File báo cáo gồm 2 sheet chép nguyên bản file gốc (dòng/ô lệch tô đỏ) kèm chi tiết và các bảng tổng hợp.
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={!result}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700"
                >
                    <Download size={17} /> Xuất Excel sai lệch
                </button>
            </div>

            {/* Tab peer: mỗi định dạng file một lượt đối chiếu riêng */}
            <div className="flex gap-2 border-b border-slate-200">
                {TAB_ORDER.map(format => {
                    const isActive = activeFormat === format
                    const loaded = pairs[format].before && pairs[format].after
                    return (
                        <button
                            key={format}
                            onClick={() => setActiveFormat(format)}
                            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                                isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {FORMAT_LABEL[format]}
                            {loaded && <span className="ml-2 text-emerald-600">•</span>}
                        </button>
                    )
                })}
            </div>

            {activeFormat === 'grid' && (
                <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <Info size={15} className="shrink-0 mt-0.5" />
                    <span>
                        File dạng Lưới không chứa Mã vị trí và Số lô, nên kết quả chỉ truy vết tới cấp <b>Khu vực / Dãy / Ô / Tầng</b> theo tên hàng.
                        Muốn biết chính xác pallet nào lệch, dùng tab <b>Dạng Bảng</b>. Hai file cần xuất với cùng bộ lọc và cùng cấu hình &quot;Mã nội bộ&quot;.
                    </span>
                </div>
            )}

            {activeFormat === 'lot' && (
                <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <Info size={15} className="shrink-0 mt-0.5" />
                    <span>
                        File tồn theo LOT lấy từ trang <b>Tồn kho</b> (tab &quot;Theo LOT&quot;) rồi bấm Xuất Excel. Lượt này đọc sheet <b>&quot;Tổng hợp&quot;</b> của 2 file —
                        mỗi sản phẩm × ĐVT đúng một dòng — nên kết quả <b>không có vị trí, mã pallet</b> lẫn chi tiết tháng nhập / LSX / mã phụ.
                        Muốn biết pallet nào lệch hay mã phụ nào thay đổi, dùng tab <b>Dạng Bảng</b>.
                        File báo cáo mở đầu bằng sheet <b>Biên bản kiểm kê</b> khổ A4 ngang để in: liệt kê toàn bộ hàng hóa theo nhóm danh mục, cột ghi nguyên nhân chênh lệch và 4 ô chữ ký.
                    </span>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-3">
                <SlotCard
                    title="Mốc TRƯỚC kiểm kê"
                    accent="text-slate-500"
                    snapshot={pair.before}
                    loading={loadingSlot === `${activeFormat}:before`}
                    onPick={file => handlePick(activeFormat, 'before', file)}
                    onClear={() => clearSlot(activeFormat, 'before')}
                />
                <div className="hidden md:flex items-center text-slate-400"><ArrowDownRight size={20} /></div>
                <SlotCard
                    title="Mốc SAU kiểm kê"
                    accent="text-indigo-600"
                    snapshot={pair.after}
                    loading={loadingSlot === `${activeFormat}:after`}
                    onPick={file => handlePick(activeFormat, 'after', file)}
                    onClear={() => clearSlot(activeFormat, 'after')}
                />
            </div>

            {pair.error && (
                <div className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {pair.error}
                </div>
            )}
            {reconcileError && (
                <div className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {reconcileError}
                </div>
            )}
            {systemMismatch && (
                <div className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    File thuộc phân hệ &quot;{systemMismatch}&quot; nhưng bạn đang làm việc với kho {currentSystem?.code}. Kiểm tra lại để không đối chiếu nhầm kho.
                </div>
            )}

            {!pair.before || !pair.after ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500 text-sm">
                    <Upload size={26} className="mx-auto mb-3 text-slate-300" />
                    Chọn 2 file {FILE_SOURCE_HINT[activeFormat]} — một file xuất <b>trước</b> khi đi kiểm kê và một file xuất <b>sau</b> khi đã điều chỉnh xong.
                </div>
            ) : (
                <div className="space-y-4">
                    {renderStats()}

                    {result && result.warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                            {result.warnings.map((warning, index) => (
                                <div key={index} className="flex gap-2 text-xs text-amber-800">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{warning}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {result && unitSummary.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-3">
                            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Chênh lệch trong từng đơn vị tính</div>
                            <div className="flex flex-wrap gap-2">
                                {unitSummary.map(item => (
                                    <div key={item.unit} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                                        <span className="font-semibold text-slate-700">{item.unit}</span>
                                        <span className="text-slate-400 mx-1">·</span>
                                        {formatQty(item.before)} → {formatQty(item.after)}
                                        <span className={`ml-1 font-bold ${item.diff < 0 ? 'text-red-600' : item.diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            ({item.diff > 0 ? '+' : ''}{formatQty(item.diff)})
                                        </span>
                                        <span className="text-slate-400 ml-1">· {item.rows} dòng</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
                        <div className="relative">
                            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Tìm vị trí, mã lot, sản phẩm..."
                                className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                        <select
                            value={kindFilter}
                            onChange={e => setKindFilter(e.target.value as any)}
                            className="text-sm border border-slate-200 rounded-lg px-3 py-2"
                        >
                            <option value="all">Mọi loại sai lệch</option>
                            <option value="changed">Chỉ lệch số lượng</option>
                            <option value="only_before">Chỉ mất ở mốc sau</option>
                            <option value="only_after">Chỉ phát sinh ở mốc sau</option>
                        </select>
                        <label className="text-sm text-slate-600 flex items-center gap-2">
                            Ngưỡng lệch từ
                            <input
                                value={minDiff}
                                onChange={e => setMinDiff(e.target.value)}
                                placeholder="0"
                                className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                            />
                        </label>
                        <label className="text-sm text-slate-600 flex items-center gap-2">
                            <input type="checkbox" checked={showSame} onChange={e => setShowSame(e.target.checked)} className="rounded" />
                            Hiện cả dòng không đổi
                        </label>
                        <button
                            onClick={() => { setSearchTerm(''); setKindFilter('all'); setMinDiff(''); setShowSame(false) }}
                            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                            <X size={14} /> Xoá lọc
                        </button>
                        <div className="ml-auto text-xs text-slate-500">
                            {result ? `${visibleRows.length} dòng / tổng ${result.allRows.length} dòng khớp khoá` : ''}
                        </div>
                    </div>

                    {renderTable()}
                </div>
            )}
        </div>
    )
}
