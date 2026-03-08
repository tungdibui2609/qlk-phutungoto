import React from 'react'
import BomForm from '@/components/sanxuat/boms/BomForm'
import { FilePlus } from 'lucide-react'

export default function NewBomPage() {
    return (
        <div className="max-w-4xl mx-auto py-6">
            <div className="mb-6 flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                    <FilePlus size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tạo mới Định mức (BOM)</h1>
                    <p className="text-zinc-500">Thiết lập công thức nguyên liệu cho một Thành phẩm mới.</p>
                </div>
            </div>

            <BomForm />
        </div>
    )
}
