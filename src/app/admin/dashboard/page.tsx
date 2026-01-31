'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'
import { Search, Building2, Package, Shield, Settings, Archive, Plus, Pencil, Power, Trash2, ArrowRight, Copy, Check } from 'lucide-react'
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
    // Modal state
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
        router.push(`/admin/companies/${company.id}/modules`)
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

    // Color scheme: Gold/Amber (Thổ sinh Kim) + Slate (Kim bản mệnh) - Phong thủy mệnh Kim
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Quản lý Công ty</h1>
                    <p className="text-slate-500 mt-1 text-sm md:text-base">Danh sách tất cả khách hàng và cấu hình hệ thống.</p>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 bg-slate-100 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 transition-all">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm công ty..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border-none rounded-lg focus:ring-0 outline-none text-slate-700 placeholder:text-slate-400 bg-transparent font-medium"
                        />
                    </div>
                    <button
                        onClick={() => { setEditingCompany(null); setIsCompanyModalOpen(true) }}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl hover:from-amber-600 hover:to-yellow-600 active:scale-95 transition-all font-bold shadow-xl shadow-amber-200/50"
                    >
                        <Plus size={18} />
                        <span>Thêm Mới</span>
                    </button>
                </div>
            </div>

            {/* Desktop Table - Hidden on small screens */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Doanh Nghiệp</th>
                                <th className="px-6 py-4">Tài khoản</th>
                                <th className="px-6 py-4">Liên hệ</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {companies.filter(c =>
                                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                c.email?.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map((company) => {
                                const adminUser = company.user_profiles?.find((u: any) => u.account_level === 2) || company.user_profiles?.[0]
                                const displayEmail = adminUser?.email || company.email || 'Chưa có Admin'

                                return (
                                    <tr key={company.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center text-amber-600 font-bold shrink-0 border border-amber-200 shadow-sm">
                                                    {company.logo_url ? (
                                                        <img src={company.logo_url} alt="" className="w-full h-full object-contain p-2" />
                                                    ) : (
                                                        <Building2 size={24} />
                                                    )}
                                                </div>
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() => handleManageModules(company)}
                                                >
                                                    <div className="font-bold text-base text-slate-800 hover:text-amber-600 transition-colors">{company.name}</div>
                                                    <div className="text-xs text-slate-500 font-medium whitespace-nowrap">TG: {new Date(company.created_at).toLocaleDateString('vi-VN')}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-amber-700 font-mono tracking-wide">{company.code}</span>
                                                <span className="text-xs text-slate-600 flex items-center gap-1 group/email">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                    {displayEmail}
                                                    {displayEmail !== 'Chưa có Admin' && (
                                                        <button
                                                            onClick={() => handleCopy(displayEmail)}
                                                            className="p-1 hover:bg-amber-100 rounded text-amber-400 hover:text-amber-600 transition-all ml-1"
                                                            title="Sao chép email"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <span className="text-sm font-medium">{company.phone || 'Chưa cập nhật'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${company.is_active
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-red-100 text-red-700 border border-red-200'
                                                }`}>
                                                {company.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(company)}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                                    title="Sửa thông tin"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(company.id, company.is_active)}
                                                    className={`p-2 rounded-lg transition-colors ${company.is_active
                                                        ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                                        : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                                        }`}
                                                    title={company.is_active ? 'Khóa quyền truy cập' : 'Mở quyền truy cập'}
                                                >
                                                    <Power size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(company)}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    title="Xóa Công Ty"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards Layout - Shown only on small screens */}
            <div className="md:hidden space-y-4">
                {companies.filter(c =>
                    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((company) => {
                    const adminUser = company.user_profiles?.find((u: any) => u.account_level === 2) || company.user_profiles?.[0]
                    const displayEmail = adminUser?.email || company.email || 'Chưa có Admin'

                    return (
                        <div key={company.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 border border-amber-200">
                                        {company.logo_url ? (
                                            <img src={company.logo_url} alt="" className="w-full h-full object-contain p-2" />
                                        ) : (
                                            <Building2 size={24} />
                                        )}
                                    </div>
                                    <div onClick={() => handleManageModules(company)}>
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight hover:text-amber-600 transition-colors">{company.name}</h3>
                                        <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{company.code}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${company.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                    }`}>
                                    {company.is_active ? 'Active' : 'Locked'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-100">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Email</p>
                                    <p className="text-xs text-amber-600 font-bold truncate">{displayEmail}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Điện thoại</p>
                                    <p className="text-xs text-slate-700 font-bold">{company.phone || '-'}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(company)}
                                        className="p-2.5 rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(company.id, company.is_active)}
                                        className={`p-2.5 rounded-xl transition-colors ${company.is_active
                                            ? 'bg-amber-50 text-amber-600 active:bg-amber-100'
                                            : 'bg-green-50 text-green-600 active:bg-green-100'
                                            }`}
                                    >
                                        <Power size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(company)}
                                        className="p-2.5 rounded-xl bg-red-50 text-red-600 active:bg-red-100 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => handleManageModules(company)}
                                    className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
                                >
                                    Module
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {companies.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                            <Building2 size={32} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-medium">Chưa có công ty nào trong hệ thống</p>
                    </div>
                </div>
            )}



            {/* Company Form Modal */}
            {
                isCompanyModalOpen && (
                    <CompanyForm
                        initialData={editingCompany}
                        onClose={() => setIsCompanyModalOpen(false)}
                        onSuccess={() => {
                            setIsCompanyModalOpen(false)
                            fetchCompanies()
                        }}
                    />
                )
            }
        </div >
    )
}
