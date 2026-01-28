'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DollarSign, Search, Download, Building2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

interface Supplier {
    id: string
    code: string
    name: string
    phone: string | null
    is_active: boolean | null
}

export default function SupplierDebtsPage() {
    const { currentSystem } = useSystem()
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (currentSystem?.code) {
            fetchSuppliers()
        }
    }, [currentSystem?.code])

    async function fetchSuppliers() {
        if (!currentSystem?.code) return

        setLoading(true)
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('is_active', true)
            .or(`system_code.eq.${currentSystem.code},system_code.is.null`)
            .order('name')

        if (data) setSuppliers(data as Supplier[])
        setLoading(false)
    }

    const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Note: Debt tracking requires additional tables (supplier_transactions, payables)
    // For now showing suppliers list - can be extended when debt tables are created

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                        <DollarSign className="text-orange-500" size={24} />
                        Công nợ Nhà cung cấp ({currentSystem?.name})
                    </h1>
                    <p className="text-stone-500 text-xs mt-0.5">Theo dõi và quản lý công nợ với NCC</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200">
                    <Download size={16} /> Xuất Excel
                </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-700">
                    <strong>Lưu ý:</strong> Để theo dõi công nợ chi tiết, cần tạo thêm bảng <code>supplier_transactions</code> và <code>payables</code> trong database.
                    Hiện tại đang hiển thị danh sách NCC đang hoạt động.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                    <p className="text-xs text-stone-500">Số NCC hoạt động</p>
                    <p className="text-2xl font-bold text-stone-800">{suppliers.length}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <p className="text-xs text-blue-600">Tổng công nợ</p>
                    <p className="text-xl font-bold text-blue-700">Chưa có dữ liệu</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                    <p className="text-xs text-red-600">Quá hạn</p>
                    <p className="text-xl font-bold text-red-700">Chưa có dữ liệu</p>
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-stone-200">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input type="text" placeholder="Tìm NCC..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm focus:outline-none" />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-stone-500 text-sm">Đang tải...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-stone-500">
                        <Building2 className="mx-auto mb-2 opacity-30" size={40} />
                        <p className="text-sm">Chưa có NCC nào</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Nhà cung cấp</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">SĐT</th>
                                <th className="text-right px-4 py-3 font-semibold text-stone-600">Tổng công nợ</th>
                                <th className="text-right px-4 py-3 font-semibold text-stone-600">Quá hạn</th>
                                <th className="text-center px-4 py-3 font-semibold text-stone-600">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filtered.map(s => (
                                <tr key={s.id} className="hover:bg-stone-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={16} className="text-stone-400" />
                                            <div>
                                                <p className="font-medium text-stone-800">{s.name}</p>
                                                <p className="text-xs text-stone-400">{s.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-stone-600">{s.phone || '-'}</td>
                                    <td className="px-4 py-3 text-right text-stone-400">-</td>
                                    <td className="px-4 py-3 text-right text-stone-400">-</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            <CheckCircle size={12} /> Hoạt động
                                        </span>
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
