'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Settings, Plus, X, Save, Trash2, PackageOpen, RefreshCw, AlertTriangle, Factory } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'

interface MO {
    id: string
    code: string
    product_id: string
    quantity: number
    status: string
    products?: any
}

interface DeliverySetting {
    id: string
    system_code: string
    company_id: string | null
    mo_id: string
    mo_code: string
    product_id: string | null
    product_name: string
    product_code: string | null
    quantity: number
    unit: string
    direction: 'warehouse_to_production' | 'production_to_warehouse'
    notes: string | null
    created_at: string
    updated_at: string
}

export default function SanxuatDeliverySettingsPage() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    const [moList, setMoList] = useState<MO[]>([])
    const [moLoading, setMoLoading] = useState(false)
    const [selectedMo, setSelectedMo] = useState<MO | null>(null)
    const [settings, setSettings] = useState<DeliverySetting[]>([])
    const [settingsLoading, setSettingsLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        product_name: '',
        product_code: '',
        quantity: 0,
        unit: 'Cái',
        direction: 'warehouse_to_production' as 'warehouse_to_production' | 'production_to_warehouse',
        notes: '',
    })
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

    const loadMOList = useCallback(async () => {
        if (!currentSystem) return
        setMoLoading(true)
        try {
            const { data, error } = await (supabase as any)
                .from('manufacturing_orders')
                .select('id, code, product_id, quantity, status, products:products(id, name, code, unit)')
                .eq('system_code', currentSystem.code)
                .eq('status', 'IN_PROGRESS')
                .order('created_at', { ascending: false })

            if (error) throw error
            setMoList(data || [])
        } catch (err: any) {
            console.error('Load MO error:', err)
        } finally {
            setMoLoading(false)
        }
    }, [currentSystem])

    useEffect(() => {
        if (currentSystem) loadMOList()
    }, [currentSystem, loadMOList])

    const loadSettings = useCallback(async (moId: string) => {
        if (!currentSystem) return
        setSettingsLoading(true)
        try {
            const params = new URLSearchParams({ system_code: currentSystem.code, mo_id: moId })
            const res = await fetch(`/api/delivery-settings?${params}`)
            const json = await res.json()
            if (json.data) setSettings(json.data)
        } catch (err) {
            console.error('Load settings error:', err)
        } finally {
            setSettingsLoading(false)
        }
    }, [currentSystem])

    const handleSelectMo = (mo: MO) => {
        setSelectedMo(mo)
        loadSettings(mo.id)
    }

    const resetForm = () => {
        setForm({ product_name: '', product_code: '', quantity: 0, unit: 'Cái', direction: 'warehouse_to_production', notes: '' })
        setEditingId(null)
    }

    const openAddForm = () => {
        resetForm()
        setShowForm(true)
    }

    const openEditForm = (s: DeliverySetting) => {
        setForm({
            product_name: s.product_name,
            product_code: s.product_code || '',
            quantity: s.quantity,
            unit: s.unit,
            direction: s.direction,
            notes: s.notes || '',
        })
        setEditingId(s.id)
        setShowForm(true)
    }

    const handleSave = async () => {
        if (!form.product_name.trim() || !selectedMo || !currentSystem) return
        setSaving(true)
        try {
            const payload: any = {
                system_code: currentSystem.code,
                company_id: currentSystem.company_id || profile?.company_id || null,
                mo_id: selectedMo.id,
                mo_code: selectedMo.code,
                product_id: null,
                product_name: form.product_name.trim(),
                product_code: form.product_code.trim() || null,
                quantity: Math.max(0, form.quantity),
                unit: form.unit || 'Cái',
                direction: form.direction,
                notes: form.notes || null,
            }

            if (editingId) {
                await fetch('/api/delivery-settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingId, ...payload }),
                })
            } else {
                await fetch('/api/delivery-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            }

            setShowForm(false)
            resetForm()
            loadSettings(selectedMo.id)
        } catch (err: any) {
            console.error('Save error:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/delivery-settings?id=${id}`, { method: 'DELETE' })
            setDeleteConfirm(null)
            if (selectedMo) loadSettings(selectedMo.id)
        } catch (err) {
            console.error('Delete error:', err)
        }
    }

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
                        <Factory size={28} className="text-indigo-600" />
                        Cài đặt giao nhận
                    </h1>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                        Quản lý cấu hình sản phẩm giao/nhận cho lệnh sản xuất (Sản xuất)
                    </p>
                </div>
                <button
                    onClick={loadMOList}
                    className="p-2.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 transition-colors"
                    title="Tải lại danh sách MO"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: MO List */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
                        <div className="p-4 border-b border-stone-200 dark:border-zinc-700">
                            <h3 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                <PackageOpen size={18} className="text-indigo-600" />
                                Lệnh sản xuất đang chạy
                            </h3>
                            <p className="text-xs text-stone-500 mt-1">Chọn một MO để cấu hình</p>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {moLoading ? (
                                <div className="p-6 text-center text-stone-500 text-sm">Đang tải...</div>
                            ) : moList.length === 0 ? (
                                <div className="p-6 text-center text-stone-400 text-sm">
                                    <PackageOpen size={32} className="mx-auto mb-2 text-stone-300" />
                                    Không có lệnh sản xuất nào đang chạy
                                </div>
                            ) : (
                                moList.map((mo) => (
                                    <div
                                        key={mo.id}
                                        onClick={() => handleSelectMo(mo)}
                                        className={`p-4 cursor-pointer border-b border-stone-100 dark:border-zinc-700/50 transition-colors hover:bg-stone-50 dark:hover:bg-zinc-700/50 ${selectedMo?.id === mo.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600' : ''
                                            }`}
                                    >
                                        <p className="font-bold text-sm text-stone-800 dark:text-stone-200">{mo.code}</p>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            {mo.products?.name || `SP: ${mo.product_id}`} | SL: {mo.quantity} {mo.products?.unit || ''}
                                        </p>
                                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                            Đang chạy
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Settings for selected MO */}
                <div className="lg:col-span-2">
                    {!selectedMo ? (
                        <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 p-8 text-center">
                            <Settings size={48} className="mx-auto mb-3 text-stone-300" />
                            <p className="text-stone-500">Chọn một lệnh sản xuất để cấu hình sản phẩm giao/nhận</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
                            <div className="p-4 border-b border-stone-200 dark:border-zinc-700 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-stone-900 dark:text-white">
                                        {selectedMo.code}
                                    </h3>
                                    <p className="text-xs text-stone-500">
                                        {selectedMo.products?.name || `SP: ${selectedMo.product_id}`} | SL: {selectedMo.quantity}
                                    </p>
                                </div>
                                <button
                                    onClick={openAddForm}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                                >
                                    <Plus size={16} />
                                    Thêm sản phẩm
                                </button>
                            </div>

                            <div className="max-h-[55vh] overflow-y-auto">
                                {settingsLoading ? (
                                    <div className="p-8 text-center text-stone-500">Đang tải...</div>
                                ) : settings.length === 0 ? (
                                    <div className="p-8 text-center text-stone-400">
                                        <AlertTriangle size={32} className="mx-auto mb-2 text-amber-300" />
                                        Chưa có sản phẩm giao/nhận nào cho MO này
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900">
                                                <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">Tên sản phẩm</th>
                                                <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">Mã</th>
                                                <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">SL</th>
                                                <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">ĐVT</th>
                                                <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">Hướng</th>
                                                <th className="text-left px-4 py-2.5 font-bold text-stone-600 dark:text-stone-300 text-xs">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {settings.map((s) => (
                                                <tr key={s.id} className="border-b border-stone-100 dark:border-zinc-700/50 hover:bg-stone-50 dark:hover:bg-zinc-800/50">
                                                    <td className="px-4 py-2.5 font-medium text-stone-800 dark:text-stone-200">{s.product_name}</td>
                                                    <td className="px-4 py-2.5 text-xs text-stone-500 font-mono">{s.product_code || '-'}</td>
                                                    <td className="px-4 py-2.5">{s.quantity}</td>
                                                    <td className="px-4 py-2.5 text-xs">{s.unit}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${s.direction === 'warehouse_to_production'
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                            }`}>
                                                            {s.direction === 'warehouse_to_production' ? 'Kho → SX' : 'SX → Kho'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => openEditForm(s)}
                                                                className="px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                            >
                                                                Sửa
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(s.id)}
                                                                className="px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-stone-900 dark:text-white">
                                    {editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm giao/nhận'}
                                </h3>
                                <button onClick={() => { setShowForm(false); resetForm() }} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Tên sản phẩm *</label>
                                    <input
                                        type="text"
                                        value={form.product_name}
                                        onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                                        placeholder="Ví dụ: Thép tấm 5mm, Bóng đèn LED..."
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Mã sản phẩm</label>
                                    <input
                                        type="text"
                                        value={form.product_code}
                                        onChange={(e) => setForm({ ...form, product_code: e.target.value })}
                                        placeholder="Mã SP (tùy chọn)"
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Số lượng</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="any"
                                            value={form.quantity}
                                            onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Đơn vị</label>
                                        <input
                                            type="text"
                                            value={form.unit}
                                            onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Hướng giao/nhận</label>
                                    <select
                                        value={form.direction}
                                        onChange={(e) => setForm({ ...form, direction: e.target.value as any })}
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="warehouse_to_production">Kho giao cho Sản xuất</option>
                                        <option value="production_to_warehouse">Sản xuất giao lại Kho</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Ghi chú</label>
                                    <input
                                        type="text"
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Ghi chú thêm..."
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button
                                    onClick={() => { setShowForm(false); resetForm() }}
                                    className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!form.product_name.trim() || saving}
                                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                    <Save size={16} />
                                    {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm mới'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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