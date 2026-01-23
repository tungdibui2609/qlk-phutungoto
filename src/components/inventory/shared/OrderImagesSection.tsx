import { ImageUpload } from '@/components/ui/ImageUpload'
import { OrderSection } from './OrderSection'

interface OrderImagesSectionProps {
    images: string[]
    setImages: (images: string[]) => void
}

export function OrderImagesSection({ images, setImages }: OrderImagesSectionProps) {
    return (
        <OrderSection title="Hình ảnh hóa đơn / Chứng từ" color="bg-purple-500">
            <div className="bg-stone-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-stone-200 dark:border-zinc-700 border-dashed">
                <ImageUpload value={images} onChange={setImages} />
            </div>
        </OrderSection>
    )
}
