'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'
import { Search, Building2, Package, Shield, Settings, Archive, Plus, Pencil, Power, Trash2, ArrowRight, Copy, Check } from 'lucide-react'
import ModuleConfigModal from '@/components/admin/ModuleConfigModal'
import CompanyForm from '@/components/admin/CompanyForm'
import { useToast } from '@/components/ui/ToastProvider'

export default function AdminDashboard() {
    const { profile, isLoading } = useUser()
    const router = useRouter()
    const { showToast } = useToast()
    const [companies, setCompanies] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)

    // Modal state
    const [selectedCompany, setSelectedCompany] = useState<any>(null)
    const [isModuleModalOpen, setIsModuleModalOpen] = useState(false)
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState<any>(null)

    useEffect(() => {
        if (!isLoading) {
            // Layout already handles redirection, but double check doesn't hurt
            if (profile?.email !== 'tungdibui2609@gmail.com') {
                return // Layout will redirect
            }
            fetchCompanies()
        }
    }, [profile, isLoading])

    async function fetchCompanies() {
        setLoading(true)
        const { data, error } = await supabase
            .from('companies')
            .select('*, user_profiles(email, account_level)')
            .order('created_at', { ascending: false })

        if (data) setCompanies(data)
        setLoading(false)
    }

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        showToast('Đã sao chép vào bộ nhớ đệm', 'success')
    }

    const handleManageModules = (company: any) => {
        setSelectedCompany(company)
        setIsModuleModalOpen(true)
    }

    const handleEdit = (company: any) => {
        setEditingCompany(company)
        setIsCompanyModalOpen(true)
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

    if (isLoading) return null // Layout handles loader

    return (
        <div className="max-w-7xl mx-auto p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-stone-800 tracking-tight">Quản lý Công ty</h1>
                    <p className="text-stone-500 mt-1">Danh sách tất cả khách hàng và cấu hình hệ thống.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto bg-white p-2 rounded-xl shadow-sm border border-stone-200">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm công ty..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border-none rounded-lg focus:ring-0 outline-none text-stone-700 placeholder:text-stone-400 bg-transparent"
                        />
                    </div>
                    <div className="w-px h-6 bg-stone-200 mx-1"></div>
                    <button
                        onClick={() => { setEditingCompany(null); setIsCompanyModalOpen(true) }}
                        className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-black transition-all font-medium shadow-md shadow-stone-200"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Thêm Mới</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-stone-50 text-stone-700 uppercase font-medium border-b border-stone-200">
                            <tr>
                                <th className="px-6 py-4">Doanh Nghiệp</th>
                                <th className="px-6 py-4">Tài khoản</th>
                                <th className="px-6 py-4">Liên hệ</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {companies.filter(c =>
                                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                c.email?.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map((company) => {
                                // Find Admin User: account_level 2 (Company Admin) or just take first one
                                const adminUser = company.user_profiles?.find((u: any) => u.account_level === 2) || company.user_profiles?.[0]
                                const displayEmail = adminUser?.email || company.email || 'Chưa có Admin'

                                return (
                                    <tr key={company.id} className="hover:bg-stone-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0 border border-orange-200 shadow-sm">
                                                    {company.logo_url ? (
                                                        <img src={company.logo_url} alt="" className="w-full h-full object-contain p-2" />
                                                    ) : (
                                                        <Building2 size={24} />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-base text-stone-800">{company.name}</div>
                                                    <div className="text-xs text-stone-500 font-medium">TG: {new Date(company.created_at).toLocaleDateString('vi-VN')}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-stone-800 font-mono tracking-wide">{company.code}</span>
                                                <span className="text-xs text-stone-500 flex items-center gap-1 group/email">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
                                                    {displayEmail}
                                                    {displayEmail !== 'Chưa có Admin' && (
                                                        <button
                                                            onClick={() => handleCopy(displayEmail)}
                                                            className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 transition-all ml-1"
                                                            title="Sao chép email"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-stone-600">
                                            <span className="text-sm">{company.phone || 'Chưa cập nhật'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${company.is_active
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-red-100 text-red-700 border border-red-200'
                                                }`}>
                                                {company.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2 opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleManageModules(company)}
                                                    className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-semibold text-xs flex items-center gap-2 border border-blue-200"
                                                    title="Cấu hình Module dịch vụ"
                                                >
                                                    <Package size={16} />
                                                    Modules
                                                </button>

                                                <div className="h-4 w-px bg-stone-300 mx-2"></div>

                                                <button
                                                    onClick={() => handleEdit(company)}
                                                    className="p-2 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-200 transition-colors"
                                                    title="Sửa thông tin"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(company.id, company.is_active)}
                                                    className={`p-2 rounded-lg transition-colors ${company.is_active
                                                        ? 'text-stone-400 hover:text-orange-600 hover:bg-orange-50'
                                                        : 'text-stone-400 hover:text-green-600 hover:bg-green-50'
                                                        }`}
                                                    title={company.is_active ? 'Khóa quyền truy cập' : 'Mở quyền truy cập'}
                                                >
                                                    <Power size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(company)}
                                                    className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    title="Xóa Công Ty"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {companies.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-stone-500">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
                                                <Building2 size={32} className="text-stone-300" />
                                            </div>
                                            <p>Chưa có công ty nào trong hệ thống</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Module Config Modal */}
            {selectedCompany && (
                <ModuleConfigModal
                    isOpen={isModuleModalOpen}
                    onClose={() => setIsModuleModalOpen(false)}
                    company={selectedCompany}
                />
            )}

            {/* Company Form Modal */}
            {isCompanyModalOpen && (
                <CompanyForm
                    initialData={editingCompany}
                    onClose={() => setIsCompanyModalOpen(false)}
                    onSuccess={() => {
                        setIsCompanyModalOpen(false)
                        fetchCompanies()
                    }}
                />
            )}
        </div>
    )
}
