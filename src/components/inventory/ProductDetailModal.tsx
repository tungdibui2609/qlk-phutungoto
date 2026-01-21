'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog'
import ProductForm from '@/components/inventory/ProductForm'
import { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']

interface ProductDetailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
}

export default function ProductDetailModal({
    open,
    onOpenChange,
    product,
}: ProductDetailModalProps) {
    if (!product) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] overflow-y-auto outline-none p-0 bg-stone-50">
                <DialogTitle className="sr-only">Chi tiết sản phẩm</DialogTitle>
                <div className="p-6">
                    <ProductForm
                        initialData={product}
                        isEditMode={true}
                        readOnly={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
