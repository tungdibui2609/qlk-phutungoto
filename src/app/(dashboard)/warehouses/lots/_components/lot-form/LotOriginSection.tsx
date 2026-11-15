'use client'

import React from 'react'
import { MapPin, Factory, Layers, X, Plus, Tag, Fingerprint } from 'lucide-react'
import { LotSectionHeader } from './shared'
import { formatMaterialZoneProvince } from '@/lib/provinces'

interface LotOriginSectionProps {
    hasAnyTraceModule: boolean
    traceModulesCount: number
    hasMaterialZone: boolean
    hasProductionPlace: boolean
    hasOemInfo: boolean
    hasBatchCode: boolean
    materialZones: string[]
    materialZonesList: any[]
    newMaterialZoneInput: string
    setNewMaterialZoneInput: React.Dispatch<React.SetStateAction<string>>
    setMaterialZones: React.Dispatch<React.SetStateAction<string[]>>
    handleAddMaterialZone: (zoneVal?: string) => void
    handleRemoveMaterialZone: (zoneToRemove: string) => void
    productionPlaces: string[]
    productionPlacesList: any[]
    newProductionPlaceInput: string
    setNewProductionPlaceInput: React.Dispatch<React.SetStateAction<string>>
    setProductionPlace: React.Dispatch<React.SetStateAction<string>>
    setProductionPlaces: React.Dispatch<React.SetStateAction<string[]>>
    handleAddProductionPlace: (placeVal?: string) => void
    handleRemoveProductionPlace: (placeToRemove: string) => void
    customerName: string
    setCustomerName: React.Dispatch<React.SetStateAction<string>>
    batchCode: string
    setBatchCode: React.Dispatch<React.SetStateAction<string>>
}

export function LotOriginSection({
    hasAnyTraceModule,
    traceModulesCount,
    hasMaterialZone,
    hasProductionPlace,
    hasOemInfo,
    hasBatchCode,
    materialZones,
    materialZonesList,
    newMaterialZoneInput,
    setNewMaterialZoneInput,
    setMaterialZones,
    handleAddMaterialZone,
    handleRemoveMaterialZone,
    productionPlaces,
    productionPlacesList,
    newProductionPlaceInput,
    setNewProductionPlaceInput,
    setProductionPlace,
    setProductionPlaces,
    handleAddProductionPlace,
    handleRemoveProductionPlace,
    customerName,
    setCustomerName,
    batchCode,
    setBatchCode,
}: LotOriginSectionProps) {
    return (
        <>
            {hasAnyTraceModule && (
                <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/15 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
                    <LotSectionHeader
                        icon={Fingerprint}
                        tone="teal"
                        title="Truy xuất nguồn gốc & Thông tin mở rộng"
                        trailing={
                            <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                                {traceModulesCount} trường kích hoạt
                            </span>
                        }
                    />

                    <div className={`grid gap-4 ${
                        traceModulesCount === 1 ? 'grid-cols-1 md:grid-cols-2' :
                        traceModulesCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
                        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    }`}>
                        {/* Vùng nguyên liệu */}
                        {hasMaterialZone && (
                            <div className={`space-y-2 ${traceModulesCount === 1 ? 'md:col-span-2' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <MapPin size={13} className="text-emerald-600" />
                                            <span>Vùng nguyên liệu / Vùng trồng</span>
                                        </label>
                                        {materialZones.length > 0 && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                {materialZones.length} vùng
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href="/material-zones"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                                            title="Mở trang Quản lý & Khai báo Vùng trồng"
                                        >
                                            <Plus size={12} />
                                            Khai báo vùng
                                        </a>
                                        {materialZones.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setMaterialZones([])}
                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                title="Xóa tất cả vùng nguyên liệu đã chọn"
                                            >
                                                Xóa tất cả
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Danh sách các vùng nguyên liệu đã chọn (Hiển thị thẻ chip) */}
                                {materialZones.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-emerald-50/40 dark:bg-zinc-800/40 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 max-h-28 overflow-y-auto">
                                        {materialZones.map((mzStr) => {
                                            const label = formatMaterialZoneProvince(mzStr, materialZonesList) || mzStr
                                            return (
                                                <div
                                                    key={mzStr}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-emerald-300/90 dark:border-emerald-700/80 rounded-lg text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-2xs group"
                                                >
                                                    <MapPin size={12} className="text-emerald-600 shrink-0" />
                                                    <span>{label}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMaterialZone(mzStr)}
                                                        className="p-0.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                        title={`Gỡ bỏ ${label}`}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Ô nhập / chọn thêm vùng nguyên liệu */}
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex-1">
                                         <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/70" size={16} />
                                        <input
                                            type="text"
                                            list="material-zones-datalist"
                                            value={newMaterialZoneInput}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                const found = materialZonesList.find(m => {
                                                    const prov = formatMaterialZoneProvince(m.province || m.name, materialZonesList)
                                                    const lbl = m.code ? `${m.code} - ${m.name}` : m.name
                                                    return val === prov || val === lbl || val === m.code || val === m.name || val === m.province
                                                })
                                                if (found) {
                                                    const prov = formatMaterialZoneProvince(found.province || found.name, materialZonesList)
                                                    handleAddMaterialZone(prov)
                                                } else {
                                                    setNewMaterialZoneInput(val)
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddMaterialZone()
                                                }
                                            }}
                                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-emerald-200/90 dark:border-emerald-800/70 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-xs font-medium placeholder:text-zinc-400 shadow-xs"
                                            placeholder="Chọn từ 25 tỉnh hoặc gõ thêm (nhấn Enter hoặc bấm Thêm)..."
                                        />
                                        <datalist id="material-zones-datalist">
                                            {materialZonesList
                                                .map((mz) => {
                                                    const prov = formatMaterialZoneProvince(mz.province || mz.name, materialZonesList)
                                                    return (
                                                        <option key={mz.id} value={prov}>
                                                            {mz.code ? `[${mz.code}] ` : ''}{mz.name} ({prov})
                                                        </option>
                                                    )
                                                })}
                                        </datalist>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAddMaterialZone()}
                                        disabled={!newMaterialZoneInput.trim()}
                                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                        title="Thêm vùng nguyên liệu này vào LOT"
                                    >
                                        <Plus size={14} />
                                        <span>Thêm</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Nơi sản xuất */}
                        {hasProductionPlace && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <Factory size={13} className="text-blue-600" />
                                            <span>Nơi sản xuất / Nhà máy</span>
                                        </label>
                                        {productionPlaces.length > 1 && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                                {productionPlaces.length} cơ sở
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href="/production-places"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                                            title="Mở trang Quản lý & Khai báo Nơi sản xuất / Nhà máy"
                                        >
                                            <Plus size={12} />
                                            Khai báo nơi SX
                                        </a>
                                        {productionPlaces.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProductionPlaces([])
                                                    setProductionPlace('')
                                                }}
                                                className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                                title="Xóa tất cả nơi sản xuất đã chọn"
                                            >
                                                Xóa tất cả
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Danh sách các nơi sản xuất đã chọn (Hiển thị thẻ chip) */}
                                {productionPlaces.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/40 dark:bg-zinc-800/40 rounded-xl border border-blue-200/80 dark:border-blue-800/60 max-h-28 overflow-y-auto">
                                        {productionPlaces.map((pStr) => {
                                            const matched = productionPlacesList.find(p => p.name === pStr || p.code === pStr || (p.code && `[${p.code}] ${p.name}` === pStr))
                                            const label = matched ? (matched.code ? `[${matched.code}] ${matched.name}` : matched.name) : pStr
                                            return (
                                                <div
                                                    key={pStr}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 border border-blue-300/90 dark:border-blue-700/80 rounded-lg text-xs font-bold text-zinc-900 dark:text-zinc-100 shadow-2xs group"
                                                >
                                                    <Factory size={12} className="text-blue-600 shrink-0" />
                                                    <span>{label}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveProductionPlace(pStr)}
                                                        className="p-0.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                                                        title={`Gỡ bỏ ${label}`}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Ô nhập / chọn thêm nơi sản xuất */}
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex-1">
                                        <Factory className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600/70" size={16} />
                                        <input
                                            type="text"
                                            list="production-places-datalist"
                                            value={newProductionPlaceInput}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                const found = productionPlacesList.find(p => {
                                                    const lbl = p.code ? `[${p.code}] ${p.name}` : p.name
                                                    return val === lbl || val === p.code || val === p.name
                                                })
                                                if (found) {
                                                    handleAddProductionPlace(found.name)
                                                } else {
                                                    setNewProductionPlaceInput(val)
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddProductionPlace()
                                                }
                                            }}
                                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-blue-200/90 dark:border-blue-800/70 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-xs font-medium placeholder:text-zinc-400 shadow-xs"
                                            placeholder="Chọn từ cơ sở đã khai báo hoặc gõ thêm (nhấn Enter hoặc bấm Thêm)..."
                                        />
                                        <datalist id="production-places-datalist">
                                            {productionPlacesList
                                                .filter(p => !productionPlaces.includes(p.name) && !productionPlaces.includes(p.code))
                                                .map((p: any) => {
                                                    const label = p.code ? `[${p.code}] ${p.name}` : p.name
                                                    return (
                                                        <option key={p.id} value={p.name}>
                                                            {label}
                                                        </option>
                                                    )
                                                })}
                                        </datalist>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAddProductionPlace()}
                                        disabled={!newProductionPlaceInput.trim()}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
                                        title="Thêm nơi sản xuất này vào LOT"
                                    >
                                        <Plus size={14} />
                                        <span>Thêm</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Thương hiệu & Khách OEM */}
                        {hasOemInfo && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Tag size={13} className="text-purple-600" />
                                        Thương hiệu & Khách OEM
                                    </span>
                                    {customerName && (
                                        <button
                                            type="button"
                                            onClick={() => setCustomerName('')}
                                            className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                        >
                                            Xóa
                                        </button>
                                    )}
                                </label>
                                <div className="relative">
                                    <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-500" size={17} />
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-purple-200/90 dark:border-purple-800/70 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-sm font-medium placeholder:text-zinc-400 shadow-xs"
                                        placeholder="VD: Nhãn OEM, Khách hàng, Nhãn riêng..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* Số Batch / Lô NCC */}
                        {hasBatchCode && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Layers size={13} className="text-amber-600" />
                                        Số Batch / Lô NCC
                                    </span>
                                    {batchCode && (
                                        <button
                                            type="button"
                                            onClick={() => setBatchCode('')}
                                            className="text-[11px] text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                                        >
                                            Xóa
                                        </button>
                                    )}
                                </label>
                                <div className="relative">
                                    <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" size={17} />
                                    <input
                                        type="text"
                                        value={batchCode}
                                        onChange={(e) => setBatchCode(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-amber-200/90 dark:border-amber-800/70 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-zinc-900 dark:text-zinc-100 transition-all text-sm font-medium placeholder:text-zinc-400 shadow-xs"
                                        placeholder="VD: BATCH-01, LOT-NCC..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
