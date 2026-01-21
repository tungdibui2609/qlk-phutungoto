'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ProductForm from '@/components/inventory/ProductForm'
import { Database } from '@/lib/database.types'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

type Product = Database['public']['Tables']['products']['Row']

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const searchParams = useSearchParams()
    const isViewMode = searchParams.get('view') === 'true'

    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchProduct() {
            setLoading(true)
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', id)
                .single()

            if (error) {
                console.error('Error fetching product:', error)
                // Optionally redirect to 404
            } else {
                setProduct(data)
            }
            setLoading(false)
        }

        if (id) fetchProduct()
    }, [id])

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
    }

    if (!product) {
        return <div className="text-center p-12">Product not found</div>
    }

    return (
        <div>
            <ProductForm
                initialData={product}
                isEditMode={true}
                readOnly={isViewMode}
            />
        </div>
    )
}
