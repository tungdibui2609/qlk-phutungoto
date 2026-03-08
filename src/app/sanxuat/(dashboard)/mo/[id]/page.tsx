'use client'
import React, { useEffect, useState, use } from 'react'
import MoForm from '@/components/sanxuat/mo/MoForm'
import { Settings, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function EditMoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [mo, setMo] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchMo() {
            setLoading(true)
            const { data, error } = await supabase
                .from('manufacturing_orders' as any)
                .select('*, products!manufacturing_orders_product_id_fkey(name, unit), boms(name, code)')
                .eq('id', id)
                .single()

            if (error) {
                console.error('Error fetching MO:', error)
            } else {
                setMo(data)
            }
            setLoading(false)
        }

        if (id) fetchMo()
    }, [id])

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>
    }

    if (!mo) {
        return <div className="text-center p-12 text-zinc-500">Không tìm thấy lệnh sản xuất</div>
    }

    return (
        <div className="max-w-4xl mx-auto py-6">
            <div className="mb-6 flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                    <Settings size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Chi tiết Lệnh Sản Xuất</h1>
                    <p className="text-zinc-500">Mã: {mo.code || '---'} • {mo.products?.name}</p>
                </div>
            </div>

            <MoForm initialData={mo} isEditMode={true} />
        </div>
    )
}
