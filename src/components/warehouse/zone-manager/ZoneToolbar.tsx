import { Edit2, RotateCcw, CloudUpload } from 'lucide-react'
import Protected from '@/components/auth/Protected'

interface ZoneToolbarProps {
    hasChanges: boolean
    isSaving: boolean
    handleSaveChanges: () => void
    handleDiscardChanges: () => void
    zones: any[]
    positionsMap: Record<string, any[]>
}

export function ZoneToolbar({ hasChanges, isSaving, handleSaveChanges, handleDiscardChanges, zones, positionsMap }: ZoneToolbarProps) {
    if (!hasChanges) return null

    // Calculate stats
    const zStats = {
        new: zones.filter(z => z._status === 'new').length,
        del: zones.filter(z => z._status === 'deleted').length,
        mod: zones.filter(z => z._status === 'modified').length
    }

    const pStats = {
        new: 0,
        del: 0,
        mod: 0
    }

    Object.values(positionsMap).forEach(list => {
        pStats.new += list.filter(p => p._status === 'new').length
        pStats.del += list.filter(p => p._status === 'deleted').length
        pStats.mod += list.filter(p => p._status === 'modified').length
    })

    const statusText = `${zStats.new + pStats.new} thêm, ${zStats.del + pStats.del} xóa, ${zStats.mod + pStats.mod} sửa`

    return (
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 p-4 rounded-xl border-l-4 border-l-yellow-500 shadow-lg flex items-center justify-between animate-in slide-in-from-top-2 mb-4">
            <div className="flex items-center gap-2">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full">
                    <Edit2 size={20} className="text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                    <p className="font-bold text-gray-900 dark:text-white">Có thay đổi chưa lưu!</p>
                    <p className="text-xs text-gray-500">{statusText}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Protected permission="warehouse.manage">
                    <button
                        onClick={handleDiscardChanges}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        <RotateCcw size={16} />
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-bold shadow-md transition-all transform hover:scale-105 flex items-center gap-2"
                    >
                        {isSaving ? 'Đang lưu...' : (
                            <>
                                <CloudUpload size={18} />
                                Lưu Thay Đổi
                            </>
                        )}
                    </button>
                </Protected>
            </div>
        </div>
    )
}
