'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import CustomerForm from '@/components/customers/CustomerForm'
import { Loader2 } from 'lucide-react'

export default function EditCustomerPage() {
    const params = useParams()
    const [customer, setCustomer] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchCustomer() {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', params.id as string)
                .single()

            if (data) setCustomer(data)
            setLoading(false)
        }
        fetchCustomer()
    }, [params.id])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
        )
    }

    if (!customer) {
        return (
            <div className="text-center py-12 text-stone-500">
                Không tìm thấy khách hàng
            </div>
        )
    }

    return <CustomerForm initialData={customer} isEditMode />
}
