'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import SupplierForm from '@/components/suppliers/SupplierForm'
import { Loader2 } from 'lucide-react'

type Supplier = Database['public']['Tables']['suppliers']['Row']

export default function EditSupplierPage() {
    const params = useParams()
    const [supplier, setSupplier] = useState<Supplier | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchSupplier() {
            const { data } = await supabase
                .from('suppliers')
                .select('*')
                .eq('id', params.id)
                .single()

            if (data) setSupplier(data)
            setLoading(false)
        }

        if (params.id) fetchSupplier()
    }, [params.id])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
        )
    }

    if (!supplier) {
        return (
            <div className="text-center py-12 text-stone-500">
                Không tìm thấy nhà cung cấp
            </div>
        )
    }

    return (
        <div>
            <SupplierForm initialData={supplier} isEditMode />
        </div>
    )
}
