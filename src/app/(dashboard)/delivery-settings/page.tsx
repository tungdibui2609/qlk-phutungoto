'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Settings, Plus, X, Save, Trash2, PackageOpen, RefreshCw, AlertTriangle, CheckCircle, ArrowRightLeft } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'

interface Production {
    id: string
    code: string
    name: string
    status: string
    company_id?: string
    production_lots?: ProductionLot[]
}

interface ProductionLot {
    id: string
    code?: string
    production_id: string
    product_id?: string
    target_quantity?: number
    products?: {
        name: string
        sku?: string
        unit?: string
    } | null
}

interface DeliverySetting {
    id: string
    system_code: string
    company_id: string | null
    mo_id: string
    mo_code: string
    product_id: string | null
    production_lot_id?: string | null
    product_name: string
    product_code: string | null
    quantity: number
    unit: string
    direction: 'warehouse_to_production' | 'production_to_warehouse'
    notes: string | null
    created_at: string
    updated_at: string
}

export default function DeliverySettingsPage() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    const [productionList, setProductionList] = useState<Production[]>([])
    const [moLoading, setMoLoading] = useState(false)
    const [selectedMo, setSelectedMo] = useState<Production | null>(null)
    const [settings, setSettings] = useState<DeliverySetting[]>([])
    const [settingsLoading, setSettingsLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    
    // Direction cho từng lot được chọn
    const [lotDirections, setLotDirections] = useState<Record<string, 'warehouse_to_production' | 'production_to_warehouse'>>({})

    const loadMOList = useCallback(async () => {
        if (!currentSystem) return
        setMoLoading(true)
        try {
            const { data, error } = await (supabase as any)
                .from('productions')
                .select('id, code, name, status, company_id, production_lots(*, products(name, sku, unit))')
                .eq('company_id', currentSystem.company_id)
                .eq('status', 'IN_PROGRESS')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Supabase query error:', JSON.stringify(error))
                throw new Error(error.message || error.details || 'Unknown query error')
            }
            setProductionList(data || [])
        } catch (err: any) {
            console.error('Load Production error:', err?.message || err)
            try {
                const { data: fallbackData, error: fbError } = await (supabase as any)
                    .from('productions')
                    .select('id, code, name, status, company_id')
                    .eq('company_id', currentSystem?.company_id)
                    .eq('status', 'IN_PROGRESS')
                    .order('created_at', { ascending: false })
                if (!fbError && fallbackData) setProductionList(fallbackData)
            } catch (fbErr: any) {
                console.error('Fallback error:', fbErr)
            }
        } finally {
            setMoLoading(false)
        }
    }, [currentSystem])

    useEffect(() => {
        if (currentSystem) loadMOList()
    }, [currentSystem, loadMOList])

    // Load settings for selected MO
    const loadSettings = useCallback(async (moId: string) => {
        if (!currentSystem) return
        setSettingsLoading(true)
        try {
            const { data, error } = await (supabase as any)
                .from('delivery_settings')
                .select('*')
                .eq('system_code', currentSystem.code)
                .eq('mo_id', moId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setSettings(data || [])
        } catch (err) {
            console.error('Load settings error:', err)
        } finally {
            setSettingsLoading(false)
        }
    }, [currentSystem])

    // Select MO
    const handleSelectMo = (mo: Production) => {
        setSelectedMo(mo)
        setLotDirections({})
        loadSettings(mo.id)
    }

    // Toggle lot direction
    const toggleLotDirection = (lotId: string, currentDir?: 'warehouse_to_production' | 'production_to_warehouse') => {
        setLotDirections(prev => {
            const existing = prev[lotId]
            if (existing) {
                // Cycle: warehouse_to_production -> production_to_warehouse -> remove
                if (existing === 'warehouse_to_production') {
                    return { ...prev, [lotId]: 'production_to_warehouse' }
                }
                // Remove selection
                const next = { ...prev }
                delete next[lotId]
                return next
            }
            // Default to warehouse_to_production when first selected
            return { ...prev, [lotId]: currentDir || 'warehouse_to_production' }
        })
    }

    // Get all lots that are NOT already in settings
    const getAvailableLots = (): ProductionLot[] => {
        if (!selectedMo?.production_lots) return []
        const existingProductNames = new Set(settings.map((s: DeliverySetting) => s.product_name.toLowerCase()))
        return selectedMo.production_lots.filter((lot: ProductionLot) => {
            const name = lot.products?.name || ''
            return !existingProductNames.has(name.toLowerCase())
        })
    }

    // Save selected lots as delivery settings
    const handleSaveLots = async () => {
        if (!currentSystem || !selectedMo) return
        const selectedLots = Object.entries(lotDirections)
        if (selectedLots.length === 0) return

        setSaving(true)
        try {
            const payloads = selectedLots.map(([lotId, direction]) => {
                const lot = selectedMo.production_lots?.find((l: ProductionLot) => l.id === lotId)
                if (!lot) return null
                
                return {
                    system_code: currentSystem.code,
                    company_id: currentSystem.company_id || profile?.company_id || null,
                    mo_id: selectedMo.id,
                    mo_code: selectedMo.code,
                    production_lot_id: lotId,
                    product_id: lot.product_id || null,
                    product_name: lot.products?.name || 'Sản phẩm không tên',
                    product_code: lot.products?.sku || null,
                    quantity: lot.target_quantity || 0,
                    unit: lot.products?.unit || 'Cái',
                    direction,
                    notes: null,
                    updated_at: new Date().toISOString(),
                }
            }).filter(Boolean) as any[]

            if (payloads.length > 0) {
                const { error } = await (supabase as any)
                    .from('delivery_settings')
                    .insert(payloads)
                if (error) throw error
            }

            setLotDirections({})
            loadSettings(selectedMo.id)
        } catch (err: any) {
            console.error('Save error:', err)
            alert('Lỗi lưu cấu hình: ' + (err?.message || err))
        } finally {
            setSaving(false)
        }
    }

    // Delete setting
    const handleDelete = async (id: string) => {
        try {
            const { error } = await (supabase as any)
                .from('delivery_settings')
                .delete()
                .eq('id', id)
            if (error) throw error
            setDeleteConfirm(null)
            if (selectedMo) loadSettings(selectedMo.id)
        } catch (err: any) {
            console.error('Delete error:', err)
            alert('Lỗi xóa cấu hình: ' + (err?.message || err))
        }
    }

    // Update direction of existing setting
    const handleUpdateDirection = async (setting: DeliverySetting, newDirection: 'warehouse_to_production' | 'production_to_warehouse') => {
        try {
            const { error } = await (supabase as any)
                .from('delivery_settings')
                .update({ direction: newDirection, updated_at: new Date().toISOString() })
                .eq('id', setting.id)
            if (error) throw error
            if (selectedMo) loadSettings(selectedMo.id)
        } catch (err: any) {
            console.error('Update direction error:', err)
            alert('Lỗi cập nhật hướng giao nhận: ' + (err?.message || err))
        }
    }

    // Get direction badge color and label
    const getDirectionBadge = (dir: string) => {
        if (dir === 'warehouse_to_production') {
            return {
                label: 'Kho → SX',
                className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }
        }
        return {
            label: 'SX → Kho',
            className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        }
    }

    const availableLots = getAvailableLots()
    const hasSelectedLots = Object.keys(lotDirections).length > 0

    if (!currentSystem) {
        return (
            <div className="p-6 text-center text-stone-500">
                Vui lòng chọn phân hệ kho
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        <Settings size={28} className="text-indigo-600" />
                        Cài đặt giao nhận
                    </h1>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                        Chọn lệnh sản xuất và cấu hình hướng giao/nhận cho từng sản phẩm
                    </p>
                </div>
                <button
                    onClick={loadMOList}
                    className="p-2.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 transition-colors"
                    title="Tải lại danh sách"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Lệnh sản xuất */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
                        <div className="p-4 border-b border-stone-200 dark:border-zinc-700">
                            <h3 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                <PackageOpen size={18} className="text-indigo-600" />
                                Lệnh sản xuất đang chạy
                            </h3>
                            <p className="text-xs text-stone-500 mt-1">Chọn lệnh để cấu hình sản phẩm</p>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {moLoading ? (
                                <div className="p-6 text-center text-stone-500 text-sm">Đang tải...</div>
                            ) : productionList.length === 0 ? (
                                <div className="p-6 text-center text-stone-400 text-sm">
                                    <PackageOpen size={32} className="mx-auto mb-2 text-stone-300" />
                                    Không có lệnh sản xuất nào đang chạy
                                </div>
                            ) : (
                                productionList.map((prod) => {
                                    const lotCount = prod.production_lots?.length || 0
                                    return (
                                    <div
                                        key={prod.id}
                                        onClick={() => handleSelectMo(prod)}
                                        className={`p-4 cursor-pointer border-b border-stone-100 dark:border-zinc-700/50 transition-colors hover:bg-stone-50 dark:hover:bg-zinc-700/50 ${
                                            selectedMo?.id === prod.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600' : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-sm text-stone-800 dark:text-stone-200">{prod.code}</p>
                                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                {lotCount} SP
                                            </span>
                                        </div>
                                        <p className="text-xs text-stone-500 mt-0.5">{prod.name}</p>
                                    </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Settings */}
                <div className="lg:col-span-2 space-y-6">
                    {!selectedMo ? (
                        <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 p-8 text-center">
                            <Settings size={48} className="mx-auto mb-3 text-stone-300" />
                            <p className="text-stone-500">Chọn một lệnh sản xuất bên trái để cấu hình</p>
                        </div>
                    ) : (
                        <>
                            {/* Panel: Sản phẩm chưa cấu hình */}
                            {availableLots.length > 0 && (
                                <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
                                    <div className="p-4 border-b border-stone-200 dark:border-zinc-700 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                                <Plus size={18} className="text-amber-500" />
                                                Sản phẩm chưa cấu hình ({availableLots.length})
                                            </h3>
                                            <p className="text-xs text-stone-500 mt-0.5">
                                                Chọn sản phẩm và hướng giao/nhận, sau đó nhấn Lưu
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleSaveLots}
                                            disabled={!hasSelectedLots || saving}
                                            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                        >
                                            <Save size={16} />
                                            {saving ? 'Đang lưu...' : `Lưu (${Object.keys(lotDirections).length})`}
                                        </button>
                                    </div>
                                    <div className="max-h-[40vh] overflow-y-auto">
                                        {availableLots.map((lot) => {
                                            const currentDir = lotDirections[lot.id]
                                            const isSelected = !!currentDir
                                            return (
                                                <div
                                                    key={lot.id}
                                                    className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-zinc-700/50 hover:bg-stone-50 dark:hover:bg-zinc-800/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <button
                                                            onClick={() => toggleLotDirection(lot.id)}
                                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                                isSelected
                                                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                                                    : 'border-stone-300 dark:border-zinc-600'
                                                            }`}
                                                        >
                                                            {isSelected && <CheckCircle size={14} />}
                                                        </button>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-sm text-stone-800 dark:text-stone-200 truncate">
                                                                {lot.products?.name || 'Sản phẩm không tên'}
                                                            </p>
                                                            <p className="text-xs text-stone-500 truncate">
                                                                {lot.products?.sku && `Mã: ${lot.products.sku}`}
                                                                {lot.target_quantity && ` | SL: ${lot.target_quantity}`}
                                                                {lot.products?.unit && ` ${lot.products.unit}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-3">
                                                        {isSelected ? (
                                                            <button
                                                                onClick={() => toggleLotDirection(lot.id)}
                                                                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                                                                    currentDir === 'warehouse_to_production'
                                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200'
                                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1">
                                                                    <ArrowRightLeft size={12} />
                                                                    {currentDir === 'warehouse_to_production' ? 'Kho → SX' : 'SX → Kho'}
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-[11px] text-stone-400">Click để chọn</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Panel: Đã cấu hình */}
                            <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
                                <div className="p-4 border-b border-stone-200 dark:border-zinc-700">
                                    <h3 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                        <CheckCircle size={18} className="text-emerald-500" />
                                        Đã cấu hình ({settings.length})
                                    </h3>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Lệnh: {selectedMo.code} - {selectedMo.name}
                                    </p>
                                </div>
                                <div className="max-h-[55vh] overflow-y-auto">
                                    {settingsLoading ? (
                                        <div className="p-8 text-center text-stone-500">Đang tải...</div>
                                    ) : settings.length === 0 ? (
                                        <div className="p-8 text-center text-stone-400">
                                            <AlertTriangle size={32} className="mx-auto mb-2 text-amber-300" />
                                            Chưa có sản phẩm nào được cấu hình
                                        </div>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900">
                                                    <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">Sản phẩm</th>
                                                    <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">Mã</th>
                                                    <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">SL</th>
                                                    <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">ĐVT</th>
                                                    <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">Hướng</th>
                                                    <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {settings.map((s) => {
                                                    const badge = getDirectionBadge(s.direction)
                                                    return (
                                                        <tr key={s.id} className="border-b border-stone-100 dark:border-zinc-700/50 hover:bg-stone-50 dark:hover:bg-zinc-800/50">
                                                            <td className="px-4 py-2.5 font-medium text-stone-800 dark:text-stone-200">{s.product_name}</td>
                                                            <td className="px-4 py-2.5 text-xs text-stone-500 font-mono">{s.product_code || '-'}</td>
                                                            <td className="px-4 py-2.5">{s.quantity}</td>
                                                            <td className="px-4 py-2.5 text-xs">{s.unit}</td>
                                                            <td className="px-4 py-2.5">
                                                                <button
                                                                    onClick={() => {
                                                                        const newDir = s.direction === 'warehouse_to_production' ? 'production_to_warehouse' : 'warehouse_to_production'
                                                                        handleUpdateDirection(s, newDir)
                                                                    }}
                                                                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors hover:opacity-80 ${badge.className}`}
                                                                >
                                                                    {badge.label}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <button
                                                                    onClick={() => setDeleteConfirm(s.id)}
                                                                    className="px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-stone-900 dark:text-white">Xác nhận xóa?</h3>
                        </div>
                        <p className="text-sm text-stone-500 mb-4">Hành động này không thể hoàn tác.</p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-colors"
                            >
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}