'use client'

import React, { useState, useRef, useMemo } from 'react'
import {
    X,
    Upload,
    FileSpreadsheet,
    Download,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    ArrowRight,
    HelpCircle,
    Package,
    Check,
    FileUp,
    Info,
    AlertCircle
} from 'lucide-react'
import {
    downloadProductImportTemplate,
    parseProductsFromExcel,
    importProductsToSupabase,
    ParseResult,
    ParsedProductRow,
    ImportSummary
} from '@/lib/productExcelImport'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

interface ProductImportModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function ProductImportModal({ isOpen, onClose, onSuccess }: ProductImportModalProps) {
    const { showToast } = useToast()
    const { systemType } = useSystem()
    const { profile } = useUser()

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isParsing, setIsParsing] = useState(false)
    const [parseResult, setParseResult] = useState<ParseResult | null>(null)
    const [conflictMode, setConflictMode] = useState<'update' | 'skip'>('update')
    const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'existing' | 'invalid'>('all')

    // Import progress state
    const [isImporting, setIsImporting] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [importResult, setImportResult] = useState<ImportSummary | null>(null)

    if (!isOpen) return null

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setSelectedFile(file)
        setIsParsing(true)
        setParseResult(null)
        setImportResult(null)

        try {
            const result = await parseProductsFromExcel(file, systemType)
            setParseResult(result)
            if (result.validRows.length === 0) {
                showToast('Không tìm thấy dòng sản phẩm hợp lệ nào trong file!', 'warning')
            } else {
                showToast(`Đã nhận diện ${result.validRows.length} sản phẩm từ file Excel`, 'success')
            }
        } catch (err: any) {
            console.error('Parse error:', err)
            showToast('Lỗi đọc file Excel: ' + err.message, 'error')
            setSelectedFile(null)
        } finally {
            setIsParsing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDownloadTemplate = async () => {
        try {
            await downloadProductImportTemplate(systemType)
            showToast('Đã tải xuống file mẫu Excel', 'success')
        } catch (err: any) {
            showToast('Lỗi tải file mẫu: ' + err.message, 'error')
        }
    }

    const handleStartImport = async () => {
        if (!parseResult || parseResult.validRows.length === 0) return

        setIsImporting(true)
        setProgress({ current: 0, total: parseResult.validRows.length })

        try {
            const summary = await importProductsToSupabase(parseResult.validRows, {
                conflictMode,
                systemType,
                companyId: profile?.company_id,
                onProgress: (processed, total) => setProgress({ current: processed, total })
            })

            setImportResult(summary)
            showToast(`Đã nạp xong: ${summary.inserted} thêm mới, ${summary.updated} cập nhật`, 'success')
            onSuccess()
        } catch (err: any) {
            console.error('Import error:', err)
            showToast('Lỗi khi nạp dữ liệu: ' + err.message, 'error')
        } finally {
            setIsImporting(false)
        }
    }

    const handleReset = () => {
        setSelectedFile(null)
        setParseResult(null)
        setImportResult(null)
        setProgress({ current: 0, total: 0 })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-stone-900 rounded-[28px] shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-inner">
                            <FileSpreadsheet size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900 dark:text-white text-base">
                                Nạp Sản Phẩm Từ File Excel
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                Nhập danh sách linh kiện, phụ tùng hàng loạt từ bảng tính
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Step 1: Upload or Template Area (When no file parsed yet) */}
                    {!parseResult && !importResult && (
                        <div className="space-y-4">
                            {/* Download Template Banner */}
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-stone-800 dark:to-stone-850 border border-orange-100 dark:border-stone-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-stone-700 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 shadow-sm">
                                        <Download size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-stone-900 dark:text-white">
                                            Chưa có file mẫu chuẩn?
                                        </p>
                                        <p className="text-xs text-stone-500 dark:text-stone-400">
                                            Tải file mẫu Excel chuẩn để điền dữ liệu đúng định dạng
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="px-4 py-2 bg-white dark:bg-stone-700 hover:bg-orange-50 dark:hover:bg-stone-600 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-stone-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                                >
                                    <Download size={14} />
                                    Tải file mẫu (.xlsx)
                                </button>
                            </div>

                            {/* Dropzone Upload */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                                    isParsing
                                        ? 'border-orange-400 bg-orange-50/40 dark:bg-stone-800/60'
                                        : 'border-stone-200 dark:border-stone-700 hover:border-orange-400 hover:bg-orange-50/20 dark:hover:bg-stone-800/40'
                                }`}
                            >
                                <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center">
                                    {isParsing ? (
                                        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FileUp size={32} className="text-orange-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                                        {isParsing ? 'Đang đọc và kiểm tra file Excel...' : 'Bấm để chọn file Excel hoặc kéo thả vào đây'}
                                    </p>
                                    <p className="text-xs text-stone-400 mt-1">
                                        Hỗ trợ định dạng .xlsx, .xls (Tối đa 5.000 dòng)
                                    </p>
                                </div>
                            </div>

                            {/* Tip Alert */}
                            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
                                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                <div className="space-y-1">
                                    <p className="font-bold">Không cần khai báo trước Đơn vị tính & Danh mục:</p>
                                    <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
                                        • Nếu đơn vị tính (ví dụ: <span className="font-semibold text-stone-800 dark:text-stone-200">m², Cuộn, Tấm, Hộp...</span>) hoặc danh mục trong file Excel chưa có, hệ thống sẽ <strong>tự động tạo mới</strong> ngay khi nạp.<br />
                                        • Nếu bạn để trống cột Đơn vị tính, hệ thống sẽ tự động đặt mặc định là <strong>"Cái"</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Parsed Preview & Settings */}
                    {parseResult && !importResult && (
                        <div className="space-y-4">
                            {/* File Bar */}
                            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <FileSpreadsheet className="text-green-600 shrink-0" size={20} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                                            {selectedFile?.name}
                                        </p>
                                        <p className="text-[11px] text-stone-400">
                                            {(selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : 0)} KB • {parseResult.rows.length} dòng dữ liệu
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReset}
                                    disabled={isImporting}
                                    className="text-xs font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 px-3 py-1.5 rounded-lg hover:bg-stone-200/50 transition-colors"
                                >
                                    Chọn file khác
                                </button>
                            </div>

                            {/* Stat Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setPreviewFilter('all')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                                        previewFilter === 'all'
                                            ? 'bg-stone-100 dark:bg-stone-700 border-stone-400 dark:border-stone-500 ring-2 ring-stone-400 shadow-sm'
                                            : 'bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-stone-300'
                                    }`}
                                >
                                    <span className="text-[10px] uppercase font-bold text-stone-400 block">Tổng số dòng</span>
                                    <span className="text-lg font-black text-stone-800 dark:text-stone-200">
                                        {parseResult.rows.length}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewFilter('valid')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                                        previewFilter === 'valid'
                                            ? 'bg-green-100/70 dark:bg-green-900/40 border-green-500 ring-2 ring-green-500 shadow-sm'
                                            : 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 hover:border-green-400'
                                    }`}
                                >
                                    <span className="text-[10px] uppercase font-bold text-green-600 block">Hợp lệ (Mới)</span>
                                    <span className="text-lg font-black text-green-700 dark:text-green-400">
                                        {parseResult.newInDbCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewFilter('existing')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                                        previewFilter === 'existing'
                                            ? 'bg-blue-100/70 dark:bg-blue-900/40 border-blue-500 ring-2 ring-blue-500 shadow-sm'
                                            : 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 hover:border-blue-400'
                                    }`}
                                >
                                    <span className="text-[10px] uppercase font-bold text-blue-600 block">Đã có trong kho</span>
                                    <span className="text-lg font-black text-blue-700 dark:text-blue-400">
                                        {parseResult.existingInDbCount}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewFilter('invalid')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                                        previewFilter === 'invalid'
                                            ? 'bg-rose-100/80 dark:bg-rose-900/40 border-rose-500 ring-2 ring-rose-500 shadow-sm'
                                            : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 hover:border-rose-400'
                                    }`}
                                >
                                    <span className="text-[10px] uppercase font-bold text-rose-600 block">Lỗi / Thiếu tin</span>
                                    <span className="text-lg font-black text-rose-700 dark:text-rose-400">
                                        {parseResult.invalidRows.length}
                                    </span>
                                </button>
                            </div>

                            {/* Detailed Error Box when invalid rows exist */}
                            {parseResult.invalidRows.length > 0 && (
                                <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-850 space-y-2.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                                            <AlertCircle size={16} className="text-rose-600 shrink-0" />
                                            <span>Danh sách {parseResult.invalidRows.length} dòng lỗi (sẽ bị bỏ qua khi nạp):</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFilter(previewFilter === 'invalid' ? 'all' : 'invalid')}
                                            className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 text-xs font-bold hover:bg-rose-200 transition-colors"
                                        >
                                            {previewFilter === 'invalid' ? 'Xem lại tất cả dòng' : `Lọc xem ${parseResult.invalidRows.length} dòng này`}
                                        </button>
                                    </div>

                                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-rose-100/70 dark:divide-rose-900/40">
                                        {parseResult.invalidRows.map((r, i) => (
                                            <div key={i} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="font-mono font-black px-1.5 py-0.5 rounded bg-rose-200/80 dark:bg-rose-800 text-rose-900 dark:text-rose-100 text-[11px] shrink-0">
                                                        Dòng {r.rowNumber}
                                                    </span>
                                                    <span className="font-semibold text-stone-800 dark:text-stone-200 truncate" title={r.name || r.sku}>
                                                        {r.name || '(Chưa có tên SP)'}
                                                    </span>
                                                    {r.sku && (
                                                        <span className="font-mono text-[10px] text-stone-500 shrink-0">
                                                            [{r.sku}]
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-rose-700 dark:text-rose-400 shrink-0 text-[11px] bg-rose-100/70 dark:bg-rose-900/40 px-2 py-0.5 rounded-full">
                                                    {r.errorReason}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-stone-500 dark:text-stone-400 italic">
                                        💡 Mở file Excel tại các số dòng trên để bổ sung <b>Mã SKU</b> hoặc <b>Tên sản phẩm</b>, rồi tải lại file.
                                    </p>
                                </div>
                            )}

                            {/* Conflict Resolution Setting */}
                            <div className="p-4 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2">
                                <label className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                                    Xử lý khi mã SKU đã tồn tại trong hệ thống:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label
                                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                            conflictMode === 'update'
                                                ? 'border-orange-500 bg-orange-50/40 dark:bg-stone-750 ring-1 ring-orange-500 text-stone-900 dark:text-white'
                                                : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="conflictMode"
                                            checked={conflictMode === 'update'}
                                            onChange={() => setConflictMode('update')}
                                            className="text-orange-500 focus:ring-orange-400"
                                        />
                                        <div className="text-xs">
                                            <span className="font-bold block">Cập nhật thông tin mới</span>
                                            <span className="text-[11px] text-stone-400">Ghi đè giá, danh mục, quy cách từ file</span>
                                        </div>
                                    </label>

                                    <label
                                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                            conflictMode === 'skip'
                                                ? 'border-orange-500 bg-orange-50/40 dark:bg-stone-750 ring-1 ring-orange-500 text-stone-900 dark:text-white'
                                                : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="conflictMode"
                                            checked={conflictMode === 'skip'}
                                            onChange={() => setConflictMode('skip')}
                                            className="text-orange-500 focus:ring-orange-400"
                                        />
                                        <div className="text-xs">
                                            <span className="font-bold block">Bỏ qua sản phẩm đã có</span>
                                            <span className="text-[11px] text-stone-400">Chỉ thêm những sản phẩm có SKU mới</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Preview Table */}
                            {(() => {
                                const rowsToDisplay = previewFilter === 'invalid'
                                    ? parseResult.invalidRows
                                    : previewFilter === 'valid'
                                    ? parseResult.rows.filter(r => r.isValid && !r.isExistingInDb)
                                    : previewFilter === 'existing'
                                    ? parseResult.rows.filter(r => r.isValid && r.isExistingInDb)
                                    : parseResult.rows

                                const previewCount = Math.min(rowsToDisplay.length, previewFilter === 'invalid' ? 100 : 25)

                                return (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                                                    Xem trước dữ liệu ({previewCount} / {rowsToDisplay.length} dòng):
                                                </span>
                                                {previewFilter !== 'all' && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                                                        Đang lọc: {previewFilter === 'invalid' ? 'Chỉ dòng lỗi' : previewFilter === 'valid' ? 'Hợp lệ mới' : 'Đã có trong kho'}
                                                    </span>
                                                )}
                                            </div>
                                            {rowsToDisplay.length > previewCount && (
                                                <span className="text-[11px] text-stone-400">
                                                    + {rowsToDisplay.length - previewCount} dòng khác
                                                </span>
                                            )}
                                        </div>

                                        <div className="border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden">
                                            <div className="max-h-60 overflow-y-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-stone-50 dark:bg-stone-800 text-stone-500 sticky top-0 border-b border-stone-200 dark:border-stone-700">
                                                        <tr>
                                                            <th className="p-2.5 font-bold text-center w-16">Dòng</th>
                                                            <th className="p-2.5 font-bold">Mã SKU</th>
                                                            <th className="p-2.5 font-bold">Tên sản phẩm</th>
                                                            <th className="p-2.5 font-bold">Danh mục</th>
                                                            <th className="p-2.5 font-bold">ĐVT</th>
                                                            <th className="p-2.5 font-bold text-right">Giá bán lẻ</th>
                                                            <th className="p-2.5 font-bold text-center">Trạng thái</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                                                        {rowsToDisplay.slice(0, previewCount).map((r, idx) => (
                                                            <tr
                                                                key={idx}
                                                                className={`transition-colors ${
                                                                    !r.isValid
                                                                        ? 'bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/50'
                                                                        : 'hover:bg-stone-50/60 dark:hover:bg-stone-800/40'
                                                                }`}
                                                            >
                                                                <td className="p-2.5 font-mono text-center font-bold text-stone-400">
                                                                    #{r.rowNumber}
                                                                </td>
                                                                <td className="p-2.5 font-mono font-bold text-stone-800 dark:text-stone-200">
                                                                    {r.sku || <span className="text-rose-500 italic font-normal">Thiếu SKU</span>}
                                                                </td>
                                                                <td className="p-2.5 font-medium text-stone-800 dark:text-stone-200 max-w-[180px] truncate" title={r.name}>
                                                                    {r.name || <span className="text-rose-500 italic font-normal">Thiếu tên sản phẩm</span>}
                                                                </td>
                                                                <td className="p-2.5 text-stone-500">
                                                                    {r.category_name || 'Chưa phân loại'}
                                                                </td>
                                                                <td className="p-2.5 text-stone-500">
                                                                    {r.unit || 'Cái'}
                                                                </td>
                                                                <td className="p-2.5 text-right font-mono text-stone-700 dark:text-stone-300">
                                                                    {r.retail_price > 0 ? r.retail_price.toLocaleString('vi-VN') + ' đ' : '---'}
                                                                </td>
                                                                <td className="p-2.5 text-center">
                                                                    {r.isValid ? (
                                                                        r.isExistingInDb ? (
                                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                                                {conflictMode === 'update' ? 'Cập nhật' : 'Bỏ qua'}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                                                                                Mới
                                                                            </span>
                                                                        )
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" title={r.errorReason}>
                                                                            ⚠️ {r.errorReason}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    )}

                    {/* Progress during import */}
                    {isImporting && (
                        <div className="p-6 rounded-2xl bg-orange-50/50 dark:bg-stone-800 border border-orange-200 dark:border-stone-700 space-y-3 text-center">
                            <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                                Đang nạp sản phẩm vào hệ thống... ({progress.current}/{progress.total})
                            </p>
                            <div className="w-full bg-stone-200 dark:bg-stone-700 h-2.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-orange-500 h-full transition-all duration-300 rounded-full"
                                    style={{
                                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success Report */}
                    {importResult && (
                        <div className="p-6 rounded-3xl bg-green-50/60 dark:bg-stone-800 border border-green-200 dark:border-green-800 space-y-4 text-center">
                            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto shadow-sm">
                                <Check size={28} />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-stone-900 dark:text-white">
                                    Nạp sản phẩm thành công!
                                </h4>
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                                    Dữ liệu danh mục và sản phẩm đã được đồng bộ vào hệ thống.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                                <div className="p-3 bg-white dark:bg-stone-700/50 rounded-xl border border-green-100 dark:border-stone-700">
                                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Thêm mới</span>
                                    <span className="text-lg font-black text-green-600 dark:text-green-400">{importResult.inserted}</span>
                                </div>
                                <div className="p-3 bg-white dark:bg-stone-700/50 rounded-xl border border-blue-100 dark:border-stone-700">
                                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Cập nhật</span>
                                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">{importResult.updated}</span>
                                </div>
                                <div className="p-3 bg-white dark:bg-stone-700/50 rounded-xl border border-amber-100 dark:border-stone-700">
                                    <span className="text-[10px] text-stone-400 font-bold block uppercase">Bỏ qua</span>
                                    <span className="text-lg font-black text-amber-600 dark:text-amber-400">{importResult.skipped}</span>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-left text-xs text-rose-700 dark:text-rose-400 max-h-32 overflow-y-auto space-y-1">
                                    <p className="font-bold">Một số dòng bị lỗi khi lưu:</p>
                                    {importResult.errors.map((err, i) => (
                                        <p key={i}>• {err}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isImporting}
                        className="px-4 py-2.5 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                        {importResult ? 'Đóng' : 'Hủy bỏ'}
                    </button>

                    {parseResult && !importResult && (
                        <button
                            type="button"
                            onClick={handleStartImport}
                            disabled={isImporting || parseResult.validRows.length === 0}
                            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all active:scale-95"
                        >
                            {isImporting ? (
                                'Đang nạp...'
                            ) : (
                                <>
                                    <FileUp size={16} />
                                    Nạp {parseResult.validRows.length} Sản phẩm
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
