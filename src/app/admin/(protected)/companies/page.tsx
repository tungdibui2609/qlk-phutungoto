'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Plus, Pencil, Power, Building, Search, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import CompanyForm from '@/components/admin/CompanyForm'

export default function CompanyManager() {
    const { showToast } = useToast()
    const [companies, setCompanies] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState<any>(null)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchCompanies()
    }, [])

    const fetchCompanies = async () => {
        setLoading(true)
        const { data, error } = await (supabase as any).from('companies').select('*').order('created_at', { ascending: false })
        if (error) {
            showToast('Lỗi tải danh sách công ty: ' + error.message, 'error')
        } else {
            setCompanies(data || [])
        }
        setLoading(false)
    }

    const handleEdit = (company: any) => {
        setEditingCompany(company)
        setIsModalOpen(true)
    }

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        const { error } = await (supabase as any).from('companies').update({ is_active: !currentStatus }).eq('id', id)
        if (error) {
            showToast('Lỗi cập nhật trạng thái: ' + error.message, 'error')
        } else {
            showToast('Đã cập nhật trạng thái', 'success')
            fetchCompanies()
        }
    }

    const handleDelete = async (company: any) => {
        if (confirm(`Bạn có chắc chắn muốn XÓA công ty "${company.name}"?\n\nHành động này sẽ xóa cả tài khoản Admin và dữ liệu liên quan. Không thể hoàn tác!`)) {
            setLoading(true)
            try {
                const response = await fetch('/api/admin/delete-company', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId: company.id })
                })
                const result = await response.json()

                if (!response.ok) throw new Error(result.error)

                showToast('Đã xóa công ty thành công', 'success')
                fetchCompanies()
            } catch (error: any) {
                showToast('Lỗi xóa công ty: ' + error.message, 'error')
            } finally {
                setLoading(false)
            }
        }
    }

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm công ty..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors dark:bg-zinc-800 dark:border-zinc-700"
                    />
                </div>
                <button
                    onClick={() => { setEditingCompany(null); setIsModalOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-sm shadow-orange-200"
                >
                    <Plus size={20} />
                    Thêm Công Ty
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                            <tr>
                                <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Công Ty</th>
                                <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Mã (Slug)</th>
                                <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Liên Hệ</th>
                                <th className="text-center p-4 text-xs font-semibold text-gray-500 uppercase">Trạng Thái</th>
                                <th className="text-right p-4 text-xs font-semibold text-gray-500 uppercase">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {filteredCompanies.map(company => (
                                <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                                                <Building size={20} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{company.name}</div>
                                                <div className="text-xs text-gray-500">{company.tax_code || 'Chưa có MST'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 rounded bg-gray-100 dark:bg-zinc-800 text-xs font-mono text-gray-600 dark:text-gray-400">
                                            {company.code}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                        <div>{company.phone || '-'}</div>
                                        <div className="text-xs">{company.email || '-'}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${company.is_active
                                            ? 'bg-green-50 text-green-700 border border-green-100'
                                            : 'bg-red-50 text-red-700 border border-red-100'
                                            }`}>
                                            {company.is_active ? 'Hoạt động' : 'Tạm khóa'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(company)}
                                                className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="Sửa"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => toggleStatus(company.id, company.is_active)}
                                                className={`p-2 rounded-lg transition-colors ${company.is_active
                                                    ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
                                                    : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                                                    }`}
                                                title={company.is_active ? 'Khóa' : 'Mở khóa'}
                                            >
                                                <Power size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(company)}
                                                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                title="Xóa Công Ty"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <CompanyForm
                    initialData={editingCompany}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false)
                        fetchCompanies()
                    }}
                />
            )}
        </div>
    )
}
