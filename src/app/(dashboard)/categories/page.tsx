'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Plus, Search, FolderTree, Edit, Trash2, Save, X, Loader2 } from 'lucide-react'

type Category = Database['public']['Tables']['categories']['Row']

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
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
        fetchCategories()
    }, [])

    async function fetchCategories() {
        setLoading(true)
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name')

        if (data) setCategories(data)
        setLoading(false)
    }

    async function addCategory() {
        if (!newName.trim()) return
        setSaving(true)

        const slug = newName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

        const { error } = await (supabase.from('categories') as any).insert([{
            name: newName.trim(),
            description: newDescription.trim() || null,
            slug
        }])

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            setNewName('')
            setNewDescription('')
            setShowAddForm(false)
            fetchCategories()
        }
        setSaving(false)
    }

    async function updateCategory(id: string) {
        if (!editName.trim()) return
        setSaving(true)

        const { error } = await (supabase.from('categories') as any).update({
            name: editName.trim(),
            description: editDescription.trim() || null
        }).eq('id', id)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            setEditingId(null)
            fetchCategories()
        }
        setSaving(false)
    }

    async function deleteCategory(id: string) {
        if (!confirm('Bạn có chắc muốn xóa danh mục này?')) return

        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            fetchCategories()
        }
    }

    const startEdit = (cat: Category) => {
        setEditingId(cat.id)
        setEditName(cat.name)
        setEditDescription(cat.description || '')
    }

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800">Danh mục sản phẩm</h1>
                    <p className="text-stone-500 text-sm mt-1">Phân loại phụ tùng theo danh mục</p>
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
                    Thêm danh mục
                </button>
            </div>

            {/* ADD FORM */}
            {showAddForm && (
                <div className="bg-orange-50 rounded-2xl p-5 border border-orange-200">
                    <h3 className="font-semibold text-stone-800 mb-4">Thêm danh mục mới</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                Tên danh mục <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                placeholder="VD: Hệ thống phanh"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Mô tả</label>
                            <input
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                placeholder="Mô tả ngắn về danh mục..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={addCategory}
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
                        placeholder="Tìm danh mục..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                </div>
            </div>

            {/* CATEGORIES LIST */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-stone-500">Đang tải...</div>
                ) : filteredCategories.length === 0 ? (
                    <div className="p-8 text-center text-stone-500">
                        <FolderTree className="mx-auto mb-3 opacity-30" size={48} />
                        <p>Chưa có danh mục nào</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Tên danh mục</th>
                                <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Mô tả</th>
                                <th className="text-left px-5 py-4 text-sm font-semibold text-stone-600">Slug</th>
                                <th className="text-center px-5 py-4 text-sm font-semibold text-stone-600 w-32">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredCategories.map((cat) => (
                                <tr key={cat.id} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-5 py-4">
                                        {editingId === cat.id ? (
                                            <input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <FolderTree size={16} className="text-orange-500" />
                                                <span className="font-medium text-stone-800">{cat.name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-stone-600">
                                        {editingId === cat.id ? (
                                            <input
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                            />
                                        ) : (
                                            cat.description || '-'
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="font-mono text-sm text-stone-500 bg-stone-100 px-2 py-1 rounded">
                                            {cat.slug || '-'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            {editingId === cat.id ? (
                                                <>
                                                    <button
                                                        onClick={() => updateCategory(cat.id)}
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
                                                        onClick={() => startEdit(cat)}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteCategory(cat.id)}
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

            {/* STATS */}
            <div className="text-sm text-stone-500 text-right">
                Tổng cộng {filteredCategories.length} danh mục
            </div>
        </div>
    )
}
