import React, { useState } from 'react'
import { Trash2, ChevronDown } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { Product, Unit, OrderItem } from '@/components/inventory/types'
import { ItemUnitSelect } from '../shared/ItemUnitSelect'

interface OutboundItemsTableProps {
    items: OrderItem[]
    products: Product[]
    units: Unit[]
    updateItem: (id: string, field: keyof OrderItem, value: any) => void
    removeItem: (id: string) => void
    targetUnit: string
    hasModule: (id: string) => boolean
    compact?: boolean
}

export function OutboundItemsTable({
    items, products, units, updateItem, removeItem, targetUnit, hasModule, compact
}: OutboundItemsTableProps) {
    const [editingValue, setEditingValue] = useState<{ id: string, field: string, value: string } | null>(null)

    const handleInputFocus = (id: string, field: string, currentVal: number | string | null | undefined) => {
        const displayVal = currentVal?.toString().replace('.', ',') || ''
        setEditingValue({ id, field, value: displayVal })
    }

    const handleInputChange = (id: string, field: keyof OrderItem, rawValue: string) => {
        setEditingValue({ id, field, value: rawValue })
        const normalized = rawValue.replace(',', '.')
        const numericVal = parseFloat(normalized)
        if (!isNaN(numericVal)) {
            updateItem(id, field, numericVal)
        } else if (rawValue === '') {
            updateItem(id, field, 0)
        }
    }
    return (
        <div className="space-y-4">
            <h3 className="font-bold text-stone-900 dark:text-white">Chi tiết hàng hóa</h3>

            {/* Desktop Table View */}
            <div className="hidden md:block border border-stone-200 dark:border-zinc-700 rounded-xl overflow-visible">
                <table className={`w-full text-left ${compact ? 'text-xs' : 'text-xs'}`}>
                    <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium text-center text-xs">
                        <tr className="align-top">
                            <th className="px-4 py-3 w-10">#</th>
                            <th className="px-4 py-3 min-w-[370px] text-left">Sản phẩm</th>
                            <th className="px-4 py-3 w-32">ĐVT</th>
                            <th className="px-4 py-3 w-48 text-right">
                                <div className="flex flex-col items-center w-fit ml-auto">
                                    <span>SL</span>
                                    <span>Thực xuất</span>
                                </div>
                            </th>
                            {hasModule('outbound_conversion') && targetUnit && (
                                <th className="px-4 py-3 w-32 text-center text-orange-600">
                                    <div>SL Quy đổi</div>
                                    <div className="text-[10px] font-normal">({targetUnit})</div>
                                </th>
                            )}
                            {hasModule('outbound_financials') && (
                                <>
                                    <th className="px-4 py-3 w-40 text-right">Đơn giá</th>
                                    <th className="px-4 py-3 w-32 text-right">Thành tiền</th>
                                </>
                            )}
                            <th className="px-4 py-3">Ghi chú</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                        {items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId)
                            // Basic stock validation display
                            const stockAvailable = product?.stock_quantity ?? 0
                            const isOverStock = product && item.quantity > stockAvailable
                            const isStockZero = product && stockAvailable <= 0

                            return (
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
                                        {/* Stock Balance Display */}
                                        {product && (
                                            <div className="mt-1 flex items-center gap-2 text-[10px]">
                                                <span className="text-stone-500">Tồn kho:</span>
                                                <span className={`font-medium ${stockAvailable <= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                                                    {stockAvailable.toLocaleString('vi-VN')} {product.unit}
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                        <ItemUnitSelect
                                            product={product}
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
                                                    value={editingValue?.id === item.id && editingValue?.field === 'quantity' ? editingValue.value : (item.quantity ? item.quantity.toLocaleString('vi-VN') : '')}
                                                    onFocus={() => handleInputFocus(item.id, 'quantity', item.quantity)}
                                                    onBlur={() => setEditingValue(null)}
                                                    onChange={e => handleInputChange(item.id, 'quantity', e.target.value)}
                                                    className={`w-full bg-transparent outline-none text-right font-medium pr-6 ${isOverStock ? 'text-red-600 font-bold' : ''
                                                        }`}
                                                />
                                                {/* Warning Indicator */}
                                                {item.needsUnbundle && (
                                                    <div className="text-[10px] text-orange-500 text-right font-medium animate-pulse">
                                                        {item.unbundleInfo}
                                                    </div>
                                                )}
                                                {isOverStock && !item.needsUnbundle && (
                                                    <div className="text-[10px] text-red-500 text-right font-medium">
                                                        Vượt quá tồn!
                                                    </div>
                                                )}

                                                {hasModule('outbound_financials') && (
                                                    <button
                                                        onClick={() => updateItem(item.id, 'isDocQtyVisible', !item.isDocQtyVisible)}
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100"
                                                        tabIndex={-1}
                                                    >
                                                        <ChevronDown size={14} className={`transition-transform duration-200 ${item.isDocQtyVisible ? 'rotate-180' : ''}`} />
                                                    </button>
                                                )}
                                            </div>

                                            {hasModule('outbound_financials') && item.isDocQtyVisible && (
                                                <div className="relative animate-in slide-in-from-top-2 duration-200">
                                                    <div className="text-[10px] text-stone-500 text-center mb-0.5">SL yêu cầu</div>
                                                    <input
                                                        type="text"
                                                        value={editingValue?.id === item.id && editingValue?.field === 'document_quantity' ? editingValue.value : (item.document_quantity ? item.document_quantity.toLocaleString('vi-VN') : '')}
                                                        onFocus={() => handleInputFocus(item.id, 'document_quantity', item.document_quantity)}
                                                        onBlur={() => setEditingValue(null)}
                                                        onChange={e => handleInputChange(item.id, 'document_quantity', e.target.value)}
                                                        className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 text-right text-xs text-stone-600 outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Conversion Logic */}
                                    {hasModule('outbound_conversion') && targetUnit && (
                                        <td className="px-4 py-3 text-center font-medium text-orange-600">
                                            {(() => {
                                                if (!item.quantity || !item.unit || !product) return '-'
                                                let baseQty = 0
                                                if (item.unit === product.unit) baseQty = item.quantity
                                                else {
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

                                    {hasModule('outbound_financials') && (
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
                                            <td className="px-4 py-3 text-right">
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
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {items.map((item, index) => {
                    const product = products.find(p => p.id === item.productId)
                    // Basic stock validation display
                    const stockAvailable = product?.stock_quantity ?? 0
                    const isOverStock = product && item.quantity > stockAvailable

                    return (
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
                                {/* Stock Balance Display */}
                                {product && (
                                    <div className="flex justify-between items-center text-[10px] mt-1 bg-stone-50 dark:bg-zinc-800/50 p-1.5 rounded">
                                        <span className="text-stone-500">Tồn kho hiện tại:</span>
                                        <span className={`font-medium ${stockAvailable <= 0 ? 'text-red-500' : 'text-blue-600'}`}>
                                            {stockAvailable.toLocaleString('vi-VN')} {product.unit}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-stone-500">ĐVT</label>
                                    <ItemUnitSelect
                                        product={product}
                                        units={units}
                                        value={item.unit}
                                        onChange={(val) => updateItem(item.id, 'unit', val)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-stone-500 text-right block">Thực xuất</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="relative group/qty">
                                            <input
                                                type="text"
                                                value={editingValue?.id === item.id && editingValue?.field === 'quantity' ? editingValue.value : (item.quantity ? item.quantity.toLocaleString('vi-VN') : '')}
                                                onFocus={() => handleInputFocus(item.id, 'quantity', item.quantity)}
                                                onBlur={() => setEditingValue(null)}
                                                onChange={e => handleInputChange(item.id, 'quantity', e.target.value)}
                                                className={`w-full bg-transparent outline-none text-right font-bold pr-2 border-b border-stone-200 dark:border-zinc-700 py-1 transition-colors ${isOverStock ? 'text-red-600 border-red-200' : 'focus:border-blue-500'}`}
                                                placeholder="0"
                                            />
                                            {hasModule('outbound_financials') && (
                                                <button
                                                    onClick={() => updateItem(item.id, 'isDocQtyVisible', !item.isDocQtyVisible)}
                                                    className={`absolute -right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all ${item.isDocQtyVisible || (item.document_quantity && item.document_quantity !== item.quantity)
                                                        ? 'text-blue-500 bg-blue-50 opacity-100'
                                                        : 'text-stone-300 opacity-100'
                                                        }`}
                                                >
                                                    <ChevronDown size={14} className={`transition-transform duration-200 ${item.isDocQtyVisible || (item.document_quantity && item.document_quantity !== item.quantity) ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}
                                        </div>
                                        {item.needsUnbundle && (
                                            <div className="text-[10px] text-orange-500 text-right font-bold animate-pulse">
                                                {item.unbundleInfo}
                                            </div>
                                        )}
                                        {isOverStock && !item.needsUnbundle && (
                                            <div className="text-[10px] text-red-500 text-right font-bold animate-pulse">
                                                Vượt quá tồn kho!
                                            </div>
                                        )}
                                        {hasModule('outbound_financials') && item.isDocQtyVisible && (
                                            <div className="relative animate-in slide-in-from-top-2 duration-200 bg-stone-50 p-2 rounded border border-stone-100">
                                                <div className="text-[10px] text-stone-500 text-center mb-0.5">SL yêu cầu</div>
                                                <input
                                                    type="text"
                                                    value={editingValue?.id === item.id && editingValue?.field === 'document_quantity' ? editingValue.value : (item.document_quantity ? item.document_quantity.toLocaleString('vi-VN') : '')}
                                                    onFocus={() => handleInputFocus(item.id, 'document_quantity', item.document_quantity)}
                                                    onBlur={() => setEditingValue(null)}
                                                    onChange={e => handleInputChange(item.id, 'document_quantity', e.target.value)}
                                                    className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-right text-xs text-stone-600 outline-none focus:border-blue-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {hasModule('outbound_conversion') && targetUnit && (
                                <div className="flex justify-between items-center text-xs bg-orange-50 dark:bg-orange-900/10 p-2 rounded text-orange-700">
                                    <span>SL Quy đổi ({targetUnit}):</span>
                                    <span className="font-bold">
                                        {(() => {
                                            if (!item.quantity || !item.unit || !product) return '-'
                                            let baseQty = 0
                                            if (item.unit === product.unit) baseQty = item.quantity
                                            else {
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

                            {hasModule('outbound_financials') && (
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
                    )
                })}
            </div>
        </div>
    )
}
