'use client'
import { Package, Users, Activity } from 'lucide-react'

export default function SanxuatDashboard() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-stone-800">Tổng Quan Sản Xuất</h1>
                <p className="text-stone-500 mt-1">Thông tin và trạng thái chung của phân hệ sản xuất</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-stone-500">Sản phẩm dùng chung</p>
                        <h3 className="text-2xl font-bold text-stone-800 mt-1">Sẵn sàng</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-stone-500">Người dùng hệ thống</p>
                        <h3 className="text-2xl font-bold text-stone-800 mt-1">Hoạt động</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-stone-500">Yêu cầu sản xuất</p>
                        <h3 className="text-2xl font-bold text-stone-800 mt-1">0</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center text-stone-500">
                Phân hệ sản xuất đang trong quá trình phát triển. Vui lòng sử dụng menu bên trái để điều hướng chức năng.
            </div>
        </div>
    )
}
