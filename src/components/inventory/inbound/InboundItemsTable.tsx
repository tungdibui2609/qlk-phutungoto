import { Trash2, ChevronDown } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { Product, Unit, OrderItem } from '@/components/inventory/types'
import { ItemUnitSelect } from '../shared/ItemUnitSelect'

interface InboundItemsTableProps {
    items: OrderItem[]
    products: Product[]
    units: Unit[]
    updateItem: (id: string, field: keyof OrderItem, value: any) => void
    removeItem: (id: string) => void
    targetUnit: string
    hasModule: (id: string) => boolean
    compact?: boolean
}

export function InboundItemsTable({
    items, products, units, updateItem, removeItem, targetUnit, hasModule, compact
}: InboundItemsTableProps) {
    return (
        <div className="space-y-4">
            <h3 className="font-bold text-stone-900 dark:text-white">Chi tiết hàng hóa</h3>

            {/* Desktop Table View */}
            <div className="hidden md:block border border-stone-200 dark:border-zinc-700 rounded-xl overflow-visible">
                <table className={`w-full text-left ${compact ? 'text-xs' : 'text-xs'}`}>
                    <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium text-center text-xs">
                        <tr className="align-top">
                            <th className="px-4 py-3 w-10">#</th>
                            <th className="px-4 py-3 min-w-[300px] text-left">Sản phẩm</th>
                            <th className="px-4 py-3 w-32">ĐVT</th>
                            <th className="px-4 py-3 w-32 text-right">Số lượng</th>
                            {hasModule('inbound_conversion') && targetUnit && (
                                <th className="px-4 py-3 w-32 text-center text-orange-600">
                                    <div>SL Quy đổi</div>
                                    <div className="text-[10px] font-normal">({targetUnit})</div>
                                </th>
                            )}
                            {hasModule('inbound_financials') && (
                                <>
                                    <th className="px-4 py-3 w-32 text-right">Đơn giá</th>
                                    <th className="px-4 py-3 w-32 text-right">Thành tiền</th>
                                </>
                            )}
                            <th className="px-4 py-3">Ghi chú</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                        {items.map((item, index) => (
                            <tr key={item.id} className="group hover:bg-stone-50 dark:hover:bg-zinc-800/30">
                                <td className="px-4 py-3 text-stone-400">{index + 1}</td>
                                <td className="px-4 py-3 align-top">
                                    <Combobox
                                        options={products.map(p => ({
                                            value: p.id,
                                            label: `${p.sku} - ${p.name}`,
                                            sku: p.sku,
                                            name: p.name
                                        }))}
                                        value={item.productId}
                                        onChange={(val) => updateItem(item.id, 'productId', val)}
                                        placeholder="-- Chọn SP --"
                                        className="w-full"
                                        renderValue={(option) => (
                                            <div className="flex flex-col text-left w-full">
                                                <div className="text-[10px] text-stone-500 font-mono mb-0.5">{option.sku}</div>
                                                <div className="font-medium text-xs text-stone-900 dark:text-gray-100 line-clamp-2 leading-tight">
                                                    {option.name}
                                                </div>
                                            </div>
                                        )}
                                    />
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <ItemUnitSelect
                                        product={products.find(p => p.id === item.productId)}
                                        units={units}
                                        value={item.unit}
                                        onChange={(val) => updateItem(item.id, 'unit', val)}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-2">
                                        <div className="relative group/qty">
                                            <input
                                                type="text"
                                                value={item.quantity ? item.quantity.toLocaleString('vi-VN') : ''}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '')
                                                    updateItem(item.id, 'quantity', Number(val))
                                                }}
                                                className="w-full bg-transparent outline-none text-right font-bold pr-2 focus:text-orange-600 transition-colors"
                                                placeholder="0"
                                            />
                                            {hasModule('inbound_financials') && (
                                                <button
                                                    onClick={() => updateItem(item.id, 'isDocQtyVisible', !item.isDocQtyVisible)}
                                                    className={`absolute -right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all ${item.isDocQtyVisible || (item.document_quantity && item.document_quantity !== item.quantity)
                                                        ? 'text-blue-500 bg-blue-50 opacity-100'
                                                        : 'text-stone-300 opacity-0 group-hover/qty:opacity-100 hover:bg-stone-100 hover:text-stone-500'
                                                        }`}
                                                    tabIndex={-1}
                                                >
                                                    <ChevronDown size={14} className={`transition-transform duration-200 ${item.isDocQtyVisible || (item.document_quantity && item.document_quantity !== item.quantity) ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}
                                        </div>
                                        {hasModule('inbound_financials') && item.isDocQtyVisible && (
                                            <div className="relative animate-in slide-in-from-top-2 duration-200">
                                                <div className="text-[10px] text-stone-500 text-center mb-0.5">SL yêu cầu</div>
                                                <input
                                                    type="text"
                                                    value={item.document_quantity ? item.document_quantity.toLocaleString('vi-VN') : ''}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '')
                                                        updateItem(item.id, 'document_quantity', Number(val))
                                                    }}
                                                    className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 text-right text-xs text-stone-600 outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* Conversion Logic (Simplified display) */}
                                {hasModule('inbound_conversion') && targetUnit && (
                                    <td className="px-4 py-3 text-center font-medium text-orange-600">
                                        {(() => {
                                            if (!item.quantity || !item.unit) return '-'
                                            const product = products.find(p => p.id === item.productId)
                                            if (!product) return '-'

                                            let baseQty = 0
                                            if (item.unit === product.unit) {
                                                baseQty = item.quantity
                                            } else {
                                                const uConfig = product.product_units?.find(pu => units.find(u => u.id === pu.unit_id)?.name === item.unit)
                                                if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                                                else return '-'
                                            }

                                            if (targetUnit === product.unit) return Number.isInteger(baseQty) ? baseQty : baseQty.toFixed(2)

                                            const targetConfig = product.product_units?.find(pu => units.find(u => u.id === pu.unit_id)?.name === targetUnit)
                                            if (targetConfig) {
                                                const val = baseQty / targetConfig.conversion_rate
                                                return Number.isInteger(val) ? val : val.toFixed(2)
                                            }
                                            return '-'
                                        })()}
                                    </td>
                                )}

                                {hasModule('inbound_financials') && (
                                    <>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.price ? item.price.toLocaleString('vi-VN') : ''}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '')
                                                    updateItem(item.id, 'price', Number(val))
                                                }}
                                                className="w-full bg-transparent outline-none text-right font-medium"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-stone-700">
                                            {((item.quantity || 0) * (item.price || 0)).toLocaleString('vi-VN')}
                                        </td>
                                    </>
                                )}

                                <td className="px-4 py-3">
                                    <input
                                        type="text"
                                        value={item.note || ''}
                                        onChange={e => updateItem(item.id, 'note', e.target.value)}
                                        className="w-full bg-transparent outline-none text-sm placeholder:text-stone-300"
                                        placeholder="Ghi chú..."
                                    />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {items.map((item, index) => (
                    <div key={item.id} className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-stone-500">#{index + 1}</span>
                            <button
                                onClick={() => removeItem(item.id)}
                                className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-stone-500">Sản phẩm</label>
                            <Combobox
                                options={products.map(p => ({
                                    value: p.id,
                                    label: `${p.sku} - ${p.name}`,
                                    sku: p.sku,
                                    name: p.name
                                }))}
                                value={item.productId}
                                onChange={(val) => updateItem(item.id, 'productId', val)}
                                placeholder="-- Chọn SP --"
                                className="w-full"
                                renderValue={(option) => (
                                    <div className="flex flex-col text-left w-full">
                                        <div className="text-[10px] text-stone-500 font-mono mb-0.5">{option.sku}</div>
                                        <div className="font-medium text-xs text-stone-900 dark:text-gray-100 line-clamp-2 leading-tight">
                                            {option.name}
                                        </div>
                                    </div>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-stone-500">ĐVT</label>
                                <ItemUnitSelect
                                    product={products.find(p => p.id === item.productId)}
                                    units={units}
                                    value={item.unit}
                                    onChange={(val) => updateItem(item.id, 'unit', val)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-stone-500 text-right block">Số lượng</label>
                                <div className="flex flex-col gap-2">
                                    <div className="relative group/qty">
                                        <input
                                            type="text"
                                            value={item.quantity ? item.quantity.toLocaleString('vi-VN') : ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '')
                                                updateItem(item.id, 'quantity', Number(val))
                                            }}
                                            className="w-full bg-transparent outline-none text-right font-bold pr-2 border-b border-stone-200 dark:border-zinc-700 py-1 focus:border-orange-500 focus:text-orange-600 transition-colors"
                                            placeholder="0"
                                        />
                                        {hasModule('inbound_financials') && (
                                            <button
                                                onClick={() => updateItem(item.id, 'isDocQtyVisible', !item.isDocQtyVisible)}
                                                className={`absolute -right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all ${item.isDocQtyVisible || (item.document_quantity && item.document_quantity !== item.quantity)
                                                    ? 'text-blue-500 bg-blue-50 opacity-100'
                                                    : 'text-stone-300 opacity-100' // Always visible on mobile for accessibility
                                                    }`}
                                            >
                                                <ChevronDown size={14} className={`transition-transform duration-200 ${item.isDocQtyVisible || (item.document_quantity && item.document_quantity !== item.quantity) ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </div>
                                    {hasModule('inbound_financials') && item.isDocQtyVisible && (
                                        <div className="relative animate-in slide-in-from-top-2 duration-200 bg-stone-50 p-2 rounded border border-stone-100">
                                            <div className="text-[10px] text-stone-500 text-center mb-0.5">SL yêu cầu</div>
                                            <input
                                                type="text"
                                                value={item.document_quantity ? item.document_quantity.toLocaleString('vi-VN') : ''}
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '')
                                                    updateItem(item.id, 'document_quantity', Number(val))
                                                }}
                                                className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-right text-xs text-stone-600 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {hasModule('inbound_conversion') && targetUnit && (
                            <div className="flex justify-between items-center text-xs bg-orange-50 dark:bg-orange-900/10 p-2 rounded text-orange-700">
                                <span>SL Quy đổi ({targetUnit}):</span>
                                <span className="font-bold">
                                    {(() => {
                                        if (!item.quantity || !item.unit) return '-'
                                        const product = products.find(p => p.id === item.productId)
                                        if (!product) return '-'

                                        let baseQty = 0
                                        if (item.unit === product.unit) {
                                            baseQty = item.quantity
                                        } else {
                                            const uConfig = product.product_units?.find(pu => units.find(u => u.id === pu.unit_id)?.name === item.unit)
                                            if (uConfig) baseQty = item.quantity * uConfig.conversion_rate
                                            else return '-'
                                        }

                                        if (targetUnit === product.unit) return Number.isInteger(baseQty) ? baseQty : baseQty.toFixed(2)

                                        const targetConfig = product.product_units?.find(pu => units.find(u => u.id === pu.unit_id)?.name === targetUnit)
                                        if (targetConfig) {
                                            const val = baseQty / targetConfig.conversion_rate
                                            return Number.isInteger(val) ? val : val.toFixed(2)
                                        }
                                        return '-'
                                    })()}
                                </span>
                            </div>
                        )}

                        {hasModule('inbound_financials') && (
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-stone-200 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <label className="text-xs text-stone-500">Đơn giá</label>
                                    <input
                                        type="text"
                                        value={item.price ? item.price.toLocaleString('vi-VN') : ''}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '')
                                            updateItem(item.id, 'price', Number(val))
                                        }}
                                        className="w-full bg-transparent outline-none border-b border-stone-200 dark:border-zinc-700 py-1 text-right font-medium text-sm"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1 text-right">
                                    <label className="text-xs text-stone-500">Thành tiền</label>
                                    <div className="font-bold text-stone-700 dark:text-stone-300 text-sm mt-1.5 py-1">
                                        {((item.quantity || 0) * (item.price || 0)).toLocaleString('vi-VN')}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-2">
                            <input
                                type="text"
                                value={item.note || ''}
                                onChange={e => updateItem(item.id, 'note', e.target.value)}
                                className="w-full bg-stone-50 dark:bg-zinc-800/50 rounded px-3 py-2 outline-none text-sm placeholder:text-stone-300"
                                placeholder="Ghi chú..."
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
