import { OrderSection } from './OrderSection'

interface Branch {
    id: string
    name: string
}

interface OrderType {
    id: string
    name: string
    code?: string
}

interface Unit {
    id: string
    name: string
}

interface OrderGeneralInfoProps {
    code: string
    setCode: (v: string) => void
    warehouseName: string
    setWarehouseName: (v: string) => void
    branches: Branch[]
    orderTypeId: string
    setOrderTypeId: (v: string) => void
    orderTypes: OrderType[]
    targetUnit: string
    setTargetUnit: (v: string) => void
    units: Unit[]
    hasModule: (id: string) => boolean
    type: 'inbound' | 'outbound'
}

export function OrderGeneralInfo({
    code, setCode,
    warehouseName, setWarehouseName, branches,
    orderTypeId, setOrderTypeId, orderTypes,
    targetUnit, setTargetUnit, units,
    hasModule, type
}: OrderGeneralInfoProps) {
    const modulePrefix = type === 'inbound' ? 'inbound' : 'outbound'

    return (
        <OrderSection title="Thông tin phiếu" color="bg-orange-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Mã phiếu</label>
                    <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="w-full px-4 py-2.5 bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-stone-800 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">
                        {type === 'inbound' ? 'Kho nhập hàng' : 'Kho xuất hàng'}
                    </label>
                    <select
                        value={warehouseName}
                        onChange={e => setWarehouseName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                    >
                        {branches.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                    </select>
                </div>

                {hasModule(`${modulePrefix}_type`) && (
                    <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Loại phiếu</label>
                        <select
                            value={orderTypeId}
                            onChange={e => setOrderTypeId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">-- Chọn loại phiếu --</option>
                            {orderTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.code ? `${t.code} - ` : ''}{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {hasModule(`${modulePrefix}_conversion`) && (
                    <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Hiển thị quy đổi theo</label>
                        <select
                            value={targetUnit}
                            onChange={e => setTargetUnit(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">-- Không --</option>
                            {units.map(u => (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </OrderSection>
    )
}
