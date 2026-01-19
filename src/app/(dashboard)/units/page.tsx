'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Plus, Search, Scale, Edit, Trash2, Save, X, Loader2 } from 'lucide-react'

// Define the Unit type locally or extend Database if not yet generated
type Unit = {
    id: string
    created_at: string
    name: string
    description: string | null
    is_active: boolean
}

export default function UnitsPage() {
    const [units, setUnits] = useState<Unit[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchUnits()
    }, [])

    async function fetchUnits() {
        setLoading(true)
        const { data } = await supabase
            .from('units')
            .select('*')
            .order('name')

        if (data) setUnits(data as Unit[])
        setLoading(false)
    }

    async function addUnit() {
        if (!newName.trim()) return
        setSaving(true)

        const { error } = await (supabase.from('units') as any).insert([{
            name: newName.trim(),
            description: newDescription.trim() || null,
            is_active: true
        }])

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            setNewName('')
            setNewDescription('')
            setShowAddForm(false)
            fetchUnits()
        }
        setSaving(false)
    }

    async function updateUnit(id: string) {
        if (!editName.trim()) return
        setSaving(true)

        const { error } = await (supabase.from('units') as any).update({
            name: editName.trim(),
            description: editDescription.trim() || null
        }).eq('id', id)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            setEditingId(null)
            fetchUnits()
        }
        setSaving(false)
    }

    async function deleteUnit(id: string) {
        if (!confirm('Bạn có chắc muốn xóa đơn vị này?')) return

        const { error } = await supabase.from('units').delete().eq('id', id)
        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            fetchUnits()
        }
    }

    const startEdit = (unit: Unit) => {
        setEditingId(unit.id)
        setEditName(unit.name)
        setEditDescription(unit.description || '')
    }

    const filteredUnits = units.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.description && u.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800">Quản lý Đơn vị</h1>
                    <p className="text-stone-500 text-sm mt-1">Danh sách đơn vị tính sản phẩm</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                    }}
                >
                    <Plus size={20} />
                    Thêm đơn vị
                </button>
            </div>

            {/* ADD FORM */}
            {showAddForm && (
                <div className="bg-orange-50 rounded-2xl p-5 border border-orange-200">
                    <h3 className="font-semibold text-stone-800 mb-4">Thêm đơn vị mới</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                Tên đơn vị <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                placeholder="VD: Cái, Hộp, Bộ..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Mô tả</label>
                            <input
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                placeholder="Mô tả thêm..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={addUnit}
                            disabled={saving || !newName.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Lưu
                        </button>
                        <button
                            onClick={() => { setShowAddForm(false); setNewName(''); setNewDescription('') }}
                            className="px-4 py-2 rounded-xl bg-stone-100 text-stone-600 font-medium hover:bg-stone-200 transition-colors"
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            )}

            {/* SEARCH */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm đơn vị..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                </div>
            </div>

            {/* UNITS LIST */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-stone-500">Đang tải...</div>
                ) : filteredUnits.length === 0 ? (
                    <div className="p-8 text-center text-stone-500">
                        <Scale className="mx-auto mb-3 opacity-30" size={48} />
                        <p>Chưa có đơn vị nào</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Tên đơn vị</th>
                                <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Mô tả</th>
                                <th className="text-center px-5 py-4 text-sm font-semibold text-stone-600 w-32">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredUnits.map((unit) => (
                                <tr key={unit.id} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-5 py-4">
                                        {editingId === unit.id ? (
                                            <input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Scale size={16} className="text-orange-500" />
                                                <span className="font-medium text-stone-800">{unit.name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-stone-600">
                                        {editingId === unit.id ? (
                                            <input
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                            />
                                        ) : (
                                            unit.description || '-'
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            {editingId === unit.id ? (
                                                <>
                                                    <button
                                                        onClick={() => updateUnit(unit.id)}
                                                        disabled={saving}
                                                        className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                                    >
                                                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(unit)}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteUnit(unit.id)}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
