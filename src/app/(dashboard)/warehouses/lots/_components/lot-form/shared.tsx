import React from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Lot, Product, Supplier, QCInfo, Unit, ProductUnit } from '../../_hooks/useLotManagement'

export interface LotItemInput {
    id?: string
    productId: string
    quantity: number | string
    unit: string
    tag?: string
    productionLotId?: string
    categoryId?: string | null
}

export interface LotFormProps {
    isVisible: boolean
    editingLot: Lot | null
    onClose: () => void
    onSuccess: (lot?: any) => Promise<void> | void
    onDelete?: (id: string) => void

    // Common Data Props
    products: Product[]
    suppliers: Supplier[]
    qcList: QCInfo[]
    units: Unit[]
    productUnits: ProductUnit[]
    branches: any[]
    existingTags?: string[]
    initialProductionCode?: string
    /** Mặc định true: tự tính STT tăng dần khi mở form tạo mới. Truyền false để ô STT bỏ trống. */
    autoFillStt?: boolean
    /** Mặc định false: mở form tạo mới ở chế độ "Thu gọn chi tiết". */
    collapseDetailsByDefault?: boolean
    productions?: any[]
    managePermission?: string
}

export const PRODUCTION_FIELDS = '*, products:product_id(*), production_lots(*, products(*))'

export const SECTION_TONES = {
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
} as const

export type SectionTone = keyof typeof SECTION_TONES

export function LotSectionHeader({
    icon: Icon,
    title,
    tone,
    badge,
    trailing,
}: {
    icon: LucideIcon
    title: string
    tone: SectionTone
    badge?: React.ReactNode
    trailing?: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${SECTION_TONES[tone]}`}>
                    <Icon size={15} />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                    {title}
                </span>
                {badge}
            </div>
            {trailing}
        </div>
    )
}
