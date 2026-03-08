import React from 'react'
import MoForm from '@/components/sanxuat/mo/MoForm'
import { Settings } from 'lucide-react'

export default function NewMoPage() {
    return (
        <div className="max-w-4xl mx-auto py-6">
            <div className="mb-6 flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                    <Settings size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tạo Lệnh Sản Xuất (MO)</h1>
                    <p className="text-zinc-500">Khởi tạo một Lệnh sản xuất mới dựa theo Định mức (BOM).</p>
                </div>
            </div>

            <MoForm />
        </div>
    )
}
