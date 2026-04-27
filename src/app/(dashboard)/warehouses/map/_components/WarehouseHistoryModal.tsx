'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Clock, Calendar, Info, AlertTriangle, ArrowRight, Package, Ban, ChevronRight, RefreshCw } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useWarehouseHistory, HistoryPosition, HistoryComparison } from '../_hooks/useWarehouseHistory'
import { useToast } from '@/components/ui/ToastProvider'

interface PositionInfo {
    id: string
    lot_id: string | null
    code: string
    lot_code?: string | null
}

interface WarehouseHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    currentPositions: PositionInfo[]
}

export function WarehouseHistoryModal({ isOpen, onClose, currentPositions }: WarehouseHistoryModalProps) {
    const { showToast } = useToast()
    const {
        historyLoading,
        datesLoading,
        captureLoading,
        snapshotDates,
        fetchSnapshotDates,
        captureSnapshot,
        fetchHistory,
        compareWithCurrent
    } = useWarehouseHistory()

    const [selectedDate, setSelectedDate] = useState<string>(format(subDays(new Date(), 1), 'yyyy-MM-dd'))
    const [historyData, setHistoryData] = useState<HistoryPosition[] | null>(null)
    const [comparison, setComparison] = useState<HistoryComparison | null>(null)

    // Quick select options
    const quickOptions = [
        { label: 'Hôm qua', value: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
        { label: '2 ngày trước', value: format(subDays(new Date(), 2), 'yyyy-MM-dd') },
        { label: '3 ngày trước', value: format(subDays(new Date(), 3), 'yyyy-MM-dd') },
        { label: '7 ngày trước', value: format(subDays(new Date(), 7), 'yyyy-MM-dd') },
        { label: '14 ngày trước', value: format(subDays(new Date(), 14), 'yyyy-MM-dd') },
        { label: '30 ngày trước', value: format(subDays(new Date(), 30), 'yyyy-MM-dd') },
    ]

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setHistoryData(null)
            setComparison(null)
        } else {
            // Load available snapshot dates when modal opens
            fetchSnapshotDates().catch(() => {})
        }
    }, [isOpen])

    const handleQuickSelect = async (dateStr: string) => {
        setSelectedDate(dateStr)
        await loadHistory(dateStr)
    }

    const handleDateSubmit = async () => {
        if (!selectedDate) {
            showToast('Vui lòng chọn ngày!', 'warning')
            return
        }
        if (selectedDate >= format(new Date(), 'yyyy-MM-dd')) {
            showToast('Không thể xem lịch sử của ngày hiện tại hoặc tương lai! Vui lòng chọn ngày trong quá khứ.', 'warning')
            return
        }
        await loadHistory(selectedDate)
    }

    const loadHistory = async (dateStr: string) => {
        try {
            const data = await fetchHistory(dateStr)
            setHistoryData(data)
            if (data.length === 0) {
                showToast('Không có dữ liệu lịch sử cho ngày này. Hãy chụp snapshot trước!', 'info')
                setComparison(null)
            } else {
                // So sánh tự động
                const comp = compareWithCurrent(data, currentPositions)
                setComparison(comp)
            }
        } catch (e: any) {
            showToast('Lỗi khi tải lịch sử: ' + (e.message || 'Không xác định'), 'error')
        }
    }

    const handleCaptureSnapshot = async () => {
        try {
            await captureSnapshot()
            showToast('Đã chụp snapshot trạng thái sơ đồ kho hôm nay!', 'success')
            // Reload snapshot dates
            await fetchSnapshotDates()
        } catch (e: any) {
            showToast('Lỗi khi chụp snapshot: ' + (e.message || 'Không xác định'), 'error')
        }
    }

    // Lấy danh sách các thay đổi từ comparison
    const changedItems = useMemo(() => {
        if (!comparison) return []
        return Object.entries(comparison.changes)
            .filter(([_, info]) => info.change_type !== 'unchanged')
            .map(([positionId, info]) => ({
                positionId,
                ...info
            }))
    }, [comparison])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                            <Clock className="text-amber-600 dark:text-amber-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Lịch sử Sơ đồ Kho
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Xem trạng thái sơ đồ tại ngày trong quá khứ
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Date Selector & Capture */}
                <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                        <div className="flex-1 flex items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                    Chọn ngày
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={format(subDays(new Date(), 1), 'yyyy-MM-dd')}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                />
                            </div>
                            <button
                                onClick={handleDateSubmit}
                                disabled={historyLoading}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                            >
                                {historyLoading ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Calendar size={16} />
                                )}
                                Xem Lịch Sử
                            </button>
                        </div>

                        {/* Capture Snapshot Button */}
                        <button
                            onClick={handleCaptureSnapshot}
                            disabled={captureLoading}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shrink-0"
                            title="Chụp lại trạng thái sơ đồ kho hiện tại"
                        >
                            {captureLoading ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <RefreshCw size={16} />
                            )}
                            Chụp Snapshot Hôm Nay
                        </button>
                    </div>

                    {/* Quick Select */}
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                        {quickOptions.map(opt => (
                            <button
                                key={opt.label}
                                onClick={() => handleQuickSelect(opt.value)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    selectedDate === opt.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Available Snapshot Dates */}
                    {snapshotDates.length > 0 && (
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium self-center mr-1">
                                Có sẵn:
                            </span>
                            {snapshotDates.slice(0, 10).map(d => (
                                <button
                                    key={d.snapshot_date}
                                    onClick={() => handleQuickSelect(d.snapshot_date)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                        selectedDate === d.snapshot_date
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {d.snapshot_date} ({d.position_count})
                                </button>
                            ))}
                            {snapshotDates.length > 10 && (
                                <span className="text-[10px] text-gray-400 self-center">
                                    +{snapshotDates.length - 10} ngày khác
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {historyLoading && (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Đang tải dữ liệu lịch sử...</p>
                            </div>
                        </div>
                    )}

                    {!historyLoading && !historyData && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                            <Clock size={48} className="mb-4 opacity-50" />
                            <p className="text-sm font-medium">Chọn ngày để xem lịch sử sơ đồ kho</p>
                            <p className="text-xs mt-1">Dữ liệu lịch sử được lưu mỗi ngày qua chức năng Chụp Snapshot</p>
                        </div>
                    )}

                    {!historyLoading && historyData && historyData.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-amber-500">
                            <AlertTriangle size={48} className="mb-4 opacity-50" />
                            <p className="text-sm font-medium">Không có dữ liệu lịch sử cho ngày này</p>
                            <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                                Hãy dùng nút "Chụp Snapshot Hôm Nay" để lưu trạng thái sơ đồ kho
                            </p>
                        </div>
                    )}

                    {!historyLoading && historyData && historyData.length > 0 && comparison && (
                        <div>
                            {/* Summary */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{comparison.summary.total}</div>
                                    <div className="text-xs text-gray-500">Tổng vị trí</div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl text-center">
                                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{comparison.summary.added}</div>
                                    <div className="text-xs text-green-600 dark:text-green-400">Đã thêm hàng</div>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center">
                                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">{comparison.summary.removed}</div>
                                    <div className="text-xs text-red-600 dark:text-red-400">Đã xuất hàng</div>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl text-center">
                                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{comparison.summary.changed}</div>
                                    <div className="text-xs text-amber-600 dark:text-amber-400">Đã đổi LOT</div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-center">
                                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{comparison.summary.unchanged}</div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400">Không đổi</div>
                                </div>
                            </div>

                            {/* Time Info */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                                <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <div className="text-sm text-blue-700 dark:text-blue-300">
                                    <strong>Ngày lịch sử:</strong> {format(new Date(selectedDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: vi })}
                                    <span className="mx-2">→</span>
                                    <strong>Hiện tại:</strong> {format(new Date(), 'dd/MM/yyyy', { locale: vi })}
                                </div>
                            </div>

                            {/* Changed Items List */}
                            {changedItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-green-500">
                                    <Info size={32} className="mb-2" />
                                    <p className="text-sm font-medium">Không có thay đổi nào</p>
                                    <p className="text-xs text-gray-400 mt-1">Sơ đồ kho hiện tại giống hệt với ngày lịch sử</p>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                                        {changedItems.length} vị trí có thay đổi
                                    </h3>

                                    <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                                        {changedItems.map(item => (
                                            <div
                                                key={item.positionId}
                                                className="flex items-center gap-3 p-2.5 rounded-xl border bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800"
                                            >
                                                {/* Change type icon */}
                                                <div className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${
                                                    item.change_type === 'added'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                                        : item.change_type === 'removed'
                                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                                            : item.change_type === 'new_position'
                                                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                                                }`}>
                                                    {item.change_type === 'added' && <Package size={16} />}
                                                    {item.change_type === 'removed' && <Ban size={16} />}
                                                    {item.change_type === 'new_position' && <ArrowRight size={16} />}
                                                    {item.change_type === 'changed' && <ArrowRight size={16} />}
                                                </div>

                                                {/* Position Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            item.change_type === 'added'
                                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                                : item.change_type === 'removed'
                                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                                    : item.change_type === 'new_position'
                                                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                        }`}>
                                                            {item.change_type === 'added' ? 'Thêm' : 
                                                             item.change_type === 'removed' ? 'Xóa' : 
                                                             item.change_type === 'new_position' ? 'Vị trí mới' : 'Đổi'}
                                                        </span>
                                                        <span className="text-xs font-bold text-gray-900 dark:text-white">{item.position_code}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                                                        <span className="text-gray-400 dark:text-gray-500">
                                                            {format(new Date(selectedDate + 'T00:00:00'), 'dd/MM', { locale: vi })}:
                                                        </span>
                                                        <span className={`font-mono ${item.history_lot_code ? 'text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600 italic'}`}>
                                                            {item.history_lot_code || '(trống)'}
                                                        </span>
                                                        <ChevronRight size={12} className="text-gray-300" />
                                                        <span className={`font-mono ${item.current_lot_code ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-300 dark:text-gray-600 italic'}`}>
                                                            {item.current_lot_code || '(trống)'}
                                                        </span>
                                                    </div>
                                                </div>

                                            </div>
                                        ))}
                                    </div>

                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}