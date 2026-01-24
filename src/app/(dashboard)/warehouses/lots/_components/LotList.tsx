import { Boxes } from 'lucide-react'
import { Lot } from '../_hooks/useLotManagement'
import { LotCard } from './LotCard'

interface LotListProps {
    loading: boolean
    lots: Lot[]
    isModuleEnabled: (moduleId: string) => boolean
    onEdit: (lot: Lot) => void
    onDelete: (id: string) => void
    onView: (lot: Lot) => void
    onQr: (lot: Lot) => void
    onAssignTag: (lot: Lot) => void
}

export function LotList({ loading, lots, isModuleEnabled, onEdit, onDelete, onView, onQr, onAssignTag }: LotListProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 animate-pulse h-64"></div>
                ))}
            </div>
        )
    }

    if (lots.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                    <Boxes className="text-slate-300" size={48} />
                    <p className="text-slate-500">Chưa có LOT nào được tạo</p>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lots.map(lot => (
                <LotCard
                    key={lot.id}
                    lot={lot}
                    isModuleEnabled={isModuleEnabled}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onView={onView}
                    onQr={onQr}
                    onAssignTag={onAssignTag}
                />
            ))}
        </div>
    )
}
