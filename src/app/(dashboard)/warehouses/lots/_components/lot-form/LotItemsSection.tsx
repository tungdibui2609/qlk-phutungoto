'use client'

import React from 'react'
import { Package, Plus, Trash2, Lock, Tag } from 'lucide-react'
import { LotSectionHeader, type LotItemInput } from './shared'
import type { Lot, Product, Unit, ProductUnit } from '../../_hooks/useLotManagement'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { matchSearch } from '@/lib/searchUtils'
import { Combobox } from '@/components/ui/Combobox'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { convertUnit } from '@/lib/unitConversion'

interface LotItemsSectionProps {
    editingLot: Lot | null
    lotItems: LotItemInput[]
    setLotItems: React.Dispatch<React.SetStateAction<LotItemInput[]>>
    products: Product[]
    units: Unit[]
    productUnits: ProductUnit[]
    existingTags?: string[]
    availableProducts: Product[]
    categories: any[]
    hasCategories: boolean
    showRowDelete: boolean
    rowGridClass: string
    unitNameMap: Map<string, string>
    conversionMap: Map<string, Map<string, number>>
    selectedProduction: any
    selectedProductionId: string
    isFetchingProduction: boolean
    setPeelingDate: React.Dispatch<React.SetStateAction<string>>
    setPeelingDates: React.Dispatch<React.SetStateAction<string[]>>
    hasModule: (moduleId: string) => boolean
}

export function LotItemsSection({
    editingLot,
    lotItems,
    setLotItems,
    products,
    units,
    productUnits,
    existingTags,
    availableProducts,
    categories,
    hasCategories,
    showRowDelete,
    rowGridClass,
    unitNameMap,
    conversionMap,
    selectedProduction,
    selectedProductionId,
    isFetchingProduction,
    setPeelingDate,
    setPeelingDates,
    hasModule,
}: LotItemsSectionProps) {
    return (
        <>
            <div className="space-y-3">
                        <LotSectionHeader
                            icon={Package}
                            tone="emerald"
                            title="Danh sách sản phẩm"
                            badge={
                                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 tabular-nums">
                                    {lotItems.length}
                                </span>
                            }
                            trailing={!editingLot?.is_locked ? (
                                <button
                                    onClick={() => setLotItems([...lotItems, { productId: '', quantity: '', unit: '', tag: '' }])}
                                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors active:scale-95"
                                >
                                    <Plus size={14} />
                                    Thêm dòng
                                </button>
                            ) : undefined}
                        />

                        {/* Tiêu đề cột — chỉ hiện trên màn hình rộng */}
                        <div className={`hidden lg:grid ${rowGridClass} gap-2 px-1 text-[10px] font-black uppercase tracking-wider text-slate-400`}>
                            <span className="text-center">#</span>
                            <span>Sản phẩm</span>
                            <span>Số lượng</span>
                            <span>Đơn vị</span>
                            <span>Mã phụ</span>
                            {hasCategories && <span>Danh mục</span>}
                            {showRowDelete && <span></span>}
                        </div>

                        <div className="space-y-2">
                            {lotItems.map((item, index) => (
                                <div key={index} className={`flex flex-col lg:grid ${rowGridClass} gap-2 items-stretch lg:items-center bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors`}>
                                    <span className="hidden lg:flex items-center justify-center h-6 w-6 rounded-md bg-slate-100 dark:bg-zinc-800 text-[11px] font-black text-slate-500 dark:text-zinc-400 tabular-nums">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="relative">
                                            <Combobox
                                                disabled={!!editingLot?.is_locked}
                                                isLoading={isFetchingProduction}
                                                options={selectedProductionId && selectedProduction?.production_lots?.length > 0 
                                                    ? selectedProduction.production_lots
                                                        .filter((pl: any) => !pl.is_locked)
                                                        .map((pl: any) => ({
                                                            value: `${pl.products?.id || pl.product_id}|${pl.id}`,
                                                            label: `${pl.lot_code} - ${pl.products?.name || 'Sản phẩm'}`,
                                                            sku: pl.lot_code,
                                                            name: pl.products?.name || 'Sản phẩm',
                                                            lotCode: pl.lot_code,
                                                            aliases: (pl.products as any)?.aliases || ''
                                                        }))
                                                    : availableProducts.map(p => ({
                                                        value: p.id,
                                                        label: hasModule('internal_products') && (p as any).internal_code
                                                            ? `${(p as any).internal_code} - ${(p as any).internal_name || p.name}`
                                                            : `${p.sku} - ${p.name}`,
                                                        sku: hasModule('internal_products') && (p as any).internal_code ? (p as any).internal_code : p.sku,
                                                        name: hasModule('internal_products') && (p as any).internal_name ? (p as any).internal_name : p.name,
                                                        aliases: (p as any).aliases || '',
                                                        internal_code: (p as any).internal_code || '',
                                                        internal_name: (p as any).internal_name || '',
                                                        originalSku: p.sku,
                                                        originalName: p.name
                                                    }))}
                                                value={item.productionLotId ? `${item.productId}|${item.productionLotId}` : item.productId}
                                                onChange={(val) => {
                                                    let productId = val || ''
                                                    let lotId = ''

                                                    if (productId.includes('|')) {
                                                        const parts = productId.split('|')
                                                        productId = parts[0]
                                                        lotId = parts[1]

                                                        // Tự động điền ngày sản xuất khi chọn mã lot
                                                        if (selectedProduction && selectedProduction.production_lots) {
                                                            const pLot = selectedProduction.production_lots.find((pl: any) => pl.id === lotId)
                                                            if (pLot && pLot.production_date) {
                                                                const formatted = pLot.production_date.includes('T')
                                                                    ? pLot.production_date.split('T')[0]
                                                                    : pLot.production_date
                                                                setPeelingDates(prev => prev.includes(formatted) ? prev : [...prev, formatted].sort())
                                                                setPeelingDate(prev => prev || formatted)
                                                            }
                                                        }
                                                    }

                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        const product = products.find(p => p.id === productId)
                                                        const baseUnit = product?.unit || ''
                                                        let baseWeight = (product as any)?.weight_kg || 0

                                                        // Fallback: If base unit is Kg and weight is not set, assume 1kg
                                                        const normBase = normalizeUnit(baseUnit)
                                                        if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
                                                            baseWeight = 1
                                                        }

                                                        // Strategy: Find a default unit to show. Prefer "Thùng" > Base Unit.
                                                        const pUnits = productUnits.filter(pu => pu.product_id === productId)
                                                        const thungUnit = pUnits.find(pu => {
                                                            const u = units.find(ux => ux.id === pu.unit_id)
                                                            if (!u) return false
                                                            const normName = normalizeUnit(u.name)
                                                            return normName === 'thùng' || normName === 'thung'
                                                        })

                                                        let initialUnit = baseUnit
                                                        let unitWeight = baseWeight

                                                        if (thungUnit) {
                                                            const u = units.find(ux => ux.id === thungUnit.unit_id)
                                                            if (u) {
                                                                initialUnit = u.name
                                                                unitWeight = (thungUnit.conversion_rate || 1) * baseWeight
                                                            }
                                                        }

                                                        const normInitial = normalizeUnit(initialUnit)
                                                        const isKg = normInitial === 'kg' || normInitial === 'kilogram'

                                                        const formattedUnit = formatUnitWeight(initialUnit, unitWeight)

                                                        newItems[index] = { 
                                                            ...newItems[index], 
                                                            productId: productId || '',
                                                            unit: formattedUnit,
                                                            productionLotId: lotId,
                                                            categoryId: product?.category_id || ''
                                                        }
                                                        return newItems
                                                    })
                                                }}
                                                placeholder="-- Chọn sản phẩm --"
                                                className="w-full"
                                                renderValue={(option) => (
                                                    <div className="flex flex-col text-left w-full">
                                                        <div className="text-[10px] text-zinc-500 font-mono mb-0.5 leading-none">{option.sku}</div>
                                                        <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1 leading-tight">
                                                            {option.name}
                                                        </div>
                                                    </div>
                                                )}
                                                suggestionLabel="Gợi ý sản phẩm"
                                                renderOption={(option: any, term: string) => {
                                                    // Badge cho biết vì sao kết quả này hiện ra: tên gõ tắt khớp > mã nội bộ khớp > SKU khớp
                                                    const aliasHit = option.aliases
                                                        ? String(option.aliases)
                                                            .split(/[,;\n]/)
                                                            .map((s: string) => s.trim())
                                                            .filter(Boolean)
                                                            .find((a: string) => matchSearch(a, term))
                                                        : undefined
                                                    const skuText = option.originalSku || option.sku
                                                    return (
                                                        <div className="flex flex-col text-left w-full py-0.5 min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate max-w-full">
                                                                    {option.name || option.label}
                                                                </span>
                                                                {aliasHit && (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shrink-0 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                                                        ⚡ {aliasHit}
                                                                    </span>
                                                                )}
                                                                {!aliasHit && option.internal_code && matchSearch(option.internal_code, term) && (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wide shrink-0 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                                                                        NB: {option.internal_code}
                                                                    </span>
                                                                )}
                                                                {option.lotCode && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md font-bold shrink-0">
                                                                        LOT: {option.lotCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {skuText && (
                                                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-mono">
                                                                    SKU: {skuText}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-row gap-2 w-full lg:contents">
                                        <div className="flex-1 lg:flex-none min-w-0">
                                            <QuantityInput
                                                disabled={!!editingLot?.is_locked}
                                                placeholder="SL"
                                                className="h-10 py-0 text-center font-bold"
                                                value={item.quantity}
                                                onChange={(val) => {
                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { ...newItems[index], quantity: val }
                                                        return newItems
                                                    })
                                                }}
                                            />
                                        </div>

                                        {/* Unit Selection */}
                                        <div className="flex-1 lg:flex-none min-w-0">
                                            <select
                                                disabled={!!editingLot?.is_locked}
                                                value={item.unit}
                                                onChange={(e) => {
                                                    const newVal = e.target.value
                                                    const oldVal = item.unit
                                                    const product = products.find(p => p.id === item.productId)
                                                    const baseUnitName = product?.unit || ''

                                                    if (!item.productId) {
                                                        setLotItems(prev => {
                                                            const newItems = [...prev]
                                                            newItems[index] = { ...newItems[index], unit: newVal }
                                                            return newItems
                                                        })
                                                        return
                                                    }

                                                    const currentQty = typeof item.quantity === 'string' 
                                                        ? parseFloat(item.quantity) || 0 
                                                        : item.quantity || 0

                                                    const newQty = convertUnit(
                                                        item.productId,
                                                        oldVal,
                                                        newVal,
                                                        currentQty,
                                                        baseUnitName,
                                                        unitNameMap,
                                                        conversionMap
                                                    )

                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { 
                                                            ...newItems[index], 
                                                            unit: newVal,
                                                            quantity: Number(newQty.toFixed(3))
                                                        }
                                                        return newItems
                                                    })
                                                }}
                                                className="w-full h-10 px-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all"
                                            >
                                                {(() => {
                                                    const product = products.find(p => p.id === item.productId)
                                                    if (!product) return <option value="">Đơn vị</option>

                                                    const availableUnits = new Set<string>()
                                                    // Base Unit with weight if available
                                                    const baseUnit = product.unit || ''
                                                    let baseWeight = (product as any).weight_kg || 0
                                                    // Fallback: If base unit is Kg and weight is not set, assume 1kg
                                                    const normBase = normalizeUnit(baseUnit)
                                                    if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
                                                        baseWeight = 1
                                                    }
                                                    const formattedBaseUnit = formatUnitWeight(baseUnit, baseWeight)

                                                    if (baseUnit) availableUnits.add(formattedBaseUnit)

                                                    const pUnitsOfProduct = productUnits.filter((pu: any) => pu.product_id === item.productId)

                                                    pUnitsOfProduct
                                                        .forEach((pu: any) => {
                                                            const u = units.find((u: any) => u.id === pu.unit_id)
                                                            if (u) {
                                                                const normU = normalizeUnit(u.name)
                                                                if (normU === normalizeUnit(baseUnit)) return // Skip base unit

                                                                const weight = (pu.conversion_rate || 1) * baseWeight
                                                                const labelStr = formatUnitWeight(u.name, weight)
                                                                availableUnits.add(labelStr)
                                                            }
                                                        })

                                                    return Array.from(availableUnits).map(u => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))
                                                })()}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Secondary Code (Tag) */}
                                    <div className="w-full min-w-0">
                                        <div className="relative group">
                                            <input
                                                disabled={!!editingLot?.is_locked}
                                                type="text"
                                                list={`tags-list-${index}`}
                                                placeholder="Mã phụ..."
                                                value={item.tag || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value.toUpperCase()
                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { ...newItems[index], tag: val }
                                                        return newItems
                                                    })
                                                }}
                                                className="w-full h-10 px-3 pr-8 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all uppercase"
                                            />
                                            {!editingLot?.is_locked && (
                                                <button
                                                    onClick={() => {
                                                        const currentVal = item.tag || '';
                                                        const newVal = currentVal + (currentVal.endsWith('>') || currentVal === '' ? '@' : '>@');
                                                        setLotItems(prev => {
                                                            const newItems = [...prev]
                                                            newItems[index] = { ...newItems[index], tag: newVal }
                                                            return newItems
                                                        })
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md text-[10px] font-bold hover:bg-orange-200"
                                                    title="Chèn placeholder @ (mã SKU)"
                                                >
                                                    @
                                                </button>
                                            )}
                                        </div>
                                        <datalist id={`tags-list-${index}`}>
                                            {existingTags?.map(tag => (
                                                <option key={tag} value={tag} />
                                            ))}
                                        </datalist>
                                    </div>

                                    {/* Category Selection — mặc định theo khai báo sản phẩm, chỉnh được theo từng dòng */}
                                    {hasCategories && (
                                        <div className="w-full min-w-0">
                                            <select
                                                disabled={!!editingLot?.is_locked}
                                                value={item.categoryId || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    setLotItems(prev => {
                                                        const newItems = [...prev]
                                                        newItems[index] = { ...newItems[index], categoryId: val }
                                                        return newItems
                                                    })
                                                }}
                                                title="Danh mục của dòng hàng này"
                                                className="w-full h-10 px-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-zinc-900 dark:text-zinc-100 text-sm transition-all"
                                            >
                                                <option value="">-- Danh mục --</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {lotItems.length > 1 && !editingLot?.is_locked && (
                                        <button
                                            onClick={() => {
                                                const newItems = lotItems.filter((_, i) => i !== index)
                                                setLotItems(newItems)
                                            }}
                                            className="h-10 w-9 shrink-0 self-end lg:self-center lg:justify-self-center flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Xóa dòng"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {lotItems.length === 0 && (
                                <div className="py-8 px-4 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 text-center">
                                    <Package size={22} className="mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
                                    <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                                        Chưa có sản phẩm nào — bấm <span className="font-bold text-emerald-600">Thêm dòng</span> để bắt đầu.
                                    </p>
                                </div>
                            )}

                            {!editingLot?.is_locked && lotItems.length > 0 && (
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic px-1">
                                    Mã phụ: dùng <span className="font-bold not-italic">@</span> để chèn mã SKU, <span className="font-bold not-italic">&gt;</span> để phân tách nhiều mã.
                                    {hasCategories && <> Danh mục mặc định lấy theo khai báo của sản phẩm và có thể đổi riêng cho từng dòng.</>}
                                </p>
                            )}

                            {editingLot?.is_locked && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                    <Lock size={14} />
                                    <span>Lô hàng đã bị khóa, không thể chỉnh sửa chi tiết sản phẩm.</span>
                                </div>
                            )}
                        </div>
                    </div>
        </>
    )
}
