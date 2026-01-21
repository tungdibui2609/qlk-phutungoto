'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, Edit, Trash2, Package, Sparkles, Eye } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import Protected from '@/components/auth/Protected'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import ProductDetailModal from '@/components/inventory/ProductDetailModal'
import { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']

type ProductWithCategory = {
    id: string
    sku: string
    name: string
    manufacturer: string | null
    part_number: string | null
    image_url: string | null
    min_stock_level: number
    unit: string | null
    price: number | null
    categories: {
        name: string
    } | null
    product_media: {
        url: string
        type: 'image' | 'video'
    }[]
    product_units: {
        conversion_rate: number
        unit_id: string
    }[]
}

export default function InventoryPage() {
    const router = useRouter()
    const [products, setProducts] = useState<ProductWithCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const { systemType } = useSystem()
    // Add delete confirmation state
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [unitsMap, setUnitsMap] = useState<Record<string, string>>({})

    // View Modal State
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleViewProduct = (product: ProductWithCategory) => {
        // Cast as any or specific type if needed since ProductWithCategory has more fields
        setSelectedProduct(product as any)
        setIsModalOpen(true)
    }

    useEffect(() => {
        fetchProducts()
    }, [])

    async function fetchProducts() {
        setLoading(true)

        // Fetch Dictionary first
        const { data: unitsData } = await supabase.from('units').select('id, name')
        const uMap: Record<string, string> = {}
        if (unitsData) {
            unitsData.forEach((u: any) => {
                uMap[u.id] = u.name
            })
            setUnitsMap(uMap)
        }

        const { data, error } = await supabase
            .from('products')
            .select(`*, categories ( name ), product_media ( url, type ), product_units ( conversion_rate, unit_id )`)
            .eq('system_type', systemType)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching products:', error)
        } else {
            if (data.length > 0) {
                // Determine if any processing is needed or leave empty block / remove completely
            }
            setProducts(data as any)
        }
        setLoading(false)
    }

    // Helper to get display URL (handles Google Drive)
    const getDisplayImage = (product: ProductWithCategory) => {
        let url = product.image_url

        // Prioritize product_media
        if (product.product_media && product.product_media.length > 0) {
            // 1. Try to find an explicit image
            const firstImage = product.product_media.find(m => m.type === 'image')
            if (firstImage) {
                url = firstImage.url
            } else {
                // 2. If no image, but we have a Google Drive link (video?), try it anyway
                const firstDriveMedia = product.product_media.find(m => m.url.includes('drive.google.com'))
                if (firstDriveMedia) {
                    url = firstDriveMedia.url
                }
            }
        }

        if (!url) return null

        // Google Drive check
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/)
        if (idMatch && idMatch[1]) {
            const thumbUrl = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w600`
            if (products.length > 0 && product.id === products[0].id) {
                console.log('Generated Thumbnail URL:', thumbUrl)
            }
            return thumbUrl
        }

        return url
    }

    async function handleSeedData() {
        if (!confirm('Hành động này sẽ thêm dữ liệu mẫu vào danh mục và sản phẩm. Tiếp tục?')) return
        setLoading(true)

        try {
            // 1. Seed Categories
            const categoriesData = [
                { name: 'Động cơ', slug: 'dong-co', description: 'Phụ tùng liên quan đến động cơ' },
                { name: 'Hệ thống điện', slug: 'he-thong-dien', description: 'Các linh kiện điện tử và cảm biến' },
                { name: 'Hệ thống phanh', slug: 'he-thong-phanh', description: 'Má phanh, đĩa phanh, heo dầu...' },
                { name: 'Hệ thống treo', slug: 'he-thong-treo', description: 'Giảm xóc, lò xo, cao su...' },
                { name: 'Dầu nhớt & Phụ gia', slug: 'dau-nhot', description: 'Các loại dầu nhớt động cơ và phụ gia' },
                { name: 'Thân vỏ', slug: 'than-vo', description: 'Cản, gương, đèn, phụ tùng thân vỏ' },
                { name: 'Phụ kiện', slug: 'phu-kien', description: 'Gạt mưa, lốp, phụ kiện các loại' }
            ]

            const { data: insertedCats, error: catError } = await (supabase
                .from('categories') as any)
                .upsert(categoriesData, { onConflict: 'slug' })
                .select()

            if (catError) throw catError

            // Map slugs to IDs
            const catMap: Record<string, string> = {}
            insertedCats?.forEach((c: any) => {
                if (c.slug) catMap[c.slug] = c.id
            })

            // 2. Seed Products
            const productsData = [
                {
                    sku: 'SPK-001',
                    name: 'Bugi Iridium NGK',
                    category_id: catMap['dong-co'],
                    part_number: 'ILZKR7B-11S',
                    price: 250000,
                    unit: 'Cái',
                    manufacturer: 'NGK',
                    min_stock_level: 20,
                    is_active: true
                },
                {
                    sku: 'OIL-FILTER-01',
                    name: 'Lọc dầu Toyota Camry',
                    category_id: catMap['dau-nhot'],
                    part_number: '90915-YZZD4',
                    price: 150000,
                    unit: 'Cái',
                    manufacturer: 'Toyota Genuine Parts',
                    min_stock_level: 50,
                    is_active: true
                },
                {
                    sku: 'BRAKE-PAD-F',
                    name: 'Má phanh trước Mazda CX-5',
                    category_id: catMap['he-thong-phanh'],
                    part_number: 'K0Y1-33-28Z',
                    price: 1200000,
                    unit: 'Bộ',
                    manufacturer: 'Mazda Genuine Parts',
                    min_stock_level: 10,
                    is_active: true
                },
                {
                    sku: 'SHOCK-ABS-R',
                    name: 'Giảm xóc sau Ford Ranger',
                    category_id: catMap['he-thong-treo'],
                    part_number: 'EB3C-18080-AC',
                    price: 2500000,
                    unit: 'Cái',
                    manufacturer: 'Ford Motorcraft',
                    min_stock_level: 5,
                    is_active: true
                },
                {
                    sku: 'BATTERY-12V',
                    name: 'Bình ắc quy GS 12V 60Ah',
                    category_id: catMap['he-thong-dien'],
                    part_number: 'GS-60AH',
                    price: 1600000,
                    unit: 'Bình',
                    manufacturer: 'GS Battery',
                    min_stock_level: 10,
                    is_active: true
                },
                {
                    sku: 'AIR-FILTER-E',
                    name: 'Lọc gió động cơ Hyundai SantaFe',
                    category_id: catMap['dong-co'],
                    part_number: '28113-2W100',
                    price: 350000,
                    unit: 'Cái',
                    manufacturer: 'Hyundai Mobis',
                    min_stock_level: 30,
                    is_active: true
                },
                // --- Mới thêm cho xe du lịch ---
                {
                    sku: 'MIRROR-VIOS-L',
                    name: 'Gương chiếu hậu trái Toyota Vios 2020',
                    category_id: catMap['than-vo'],
                    part_number: '87940-0D680',
                    price: 2800000,
                    unit: 'Cái',
                    manufacturer: 'Toyota Genuine Parts',
                    min_stock_level: 5,
                    is_active: true
                },
                {
                    sku: 'HEADLIGHT-ACCENT-R',
                    name: 'Đèn pha phải Hyundai Accent 2021',
                    category_id: catMap['he-thong-dien'],
                    part_number: '92102-H6510',
                    price: 4500000,
                    unit: 'Cái',
                    manufacturer: 'Hyundai Mobis',
                    min_stock_level: 3,
                    is_active: true
                },
                {
                    sku: 'WIPER-BOSCH-24',
                    name: 'Gạt mưa Bosch Aerotwin 24 inch',
                    category_id: catMap['phu-kien'],
                    part_number: '3397007503',
                    price: 350000,
                    unit: 'Cái',
                    manufacturer: 'Bosch',
                    min_stock_level: 50,
                    is_active: true
                },
                {
                    sku: 'BUMPER-F-CITY',
                    name: 'Cản trước Honda City 2022',
                    category_id: catMap['than-vo'],
                    part_number: '71101-T00-T10',
                    price: 3800000,
                    unit: 'Cái',
                    manufacturer: 'Honda Genuine Parts',
                    min_stock_level: 2,
                    is_active: true
                },
                {
                    sku: 'FUEL-PUMP-CRV',
                    name: 'Bơm xăng Honda CR-V',
                    category_id: catMap['dong-co'],
                    part_number: '17045-TLA-A01',
                    price: 5200000,
                    unit: 'Cái',
                    manufacturer: 'Honda Genuine Parts',
                    min_stock_level: 5,
                    is_active: true
                },
                {
                    sku: 'CABIN-FILTER-MAZDA',
                    name: 'Lọc gió điều hòa Mazda 3/6',
                    category_id: catMap['dong-co'],
                    part_number: 'KD45-61-J6X',
                    price: 450000,
                    unit: 'Cái',
                    manufacturer: 'Mazda Genuine Parts',
                    min_stock_level: 25,
                    is_active: true
                },
                {
                    sku: 'TIRE-MICH-18',
                    name: 'Lốp Michelin Primacy 4 225/55R18',
                    category_id: catMap['phu-kien'],
                    part_number: 'MIC-2255518',
                    price: 3200000,
                    unit: 'Cái',
                    manufacturer: 'Michelin',
                    min_stock_level: 20,
                    is_active: true
                },
                {
                    sku: 'RAD-COOLANT',
                    name: 'Nước làm mát màu xanh Prestone',
                    category_id: catMap['dau-nhot'],
                    part_number: 'AF-3200',
                    price: 180000,
                    unit: 'Can 4L',
                    manufacturer: 'Prestone',
                    min_stock_level: 30,
                    is_active: true
                }
            ]

            const { error: prodError } = await (supabase
                .from('products') as any)
                .upsert(productsData, { onConflict: 'sku' })

            if (prodError) throw prodError

            alert('Đã tạo dữ liệu mẫu thành công!')
            fetchProducts()
        } catch (error: any) {
            console.error(error)
            alert('Lỗi: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Opens confirmation dialog instead of window.confirm
    function handleDelete(id: string) {
        setDeleteConfirmId(id)
    }

    // Actual delete function called by dialog
    const executeDelete = async () => {
        if (!deleteConfirmId) return

        const { error } = await supabase.from('products').delete().eq('id', deleteConfirmId)
        if (error) {
            alert('Lỗi khi xóa: ' + error.message)
        } else {
            setProducts(prev => prev.filter(p => p.id !== deleteConfirmId))
        }
        setDeleteConfirmId(null)
    }

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.part_number && product.part_number.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            {/* PAGE HEADER */}
            {/* SEED BUTTON - TEMP */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Package className="text-orange-500" size={18} />
                        <span className="text-orange-600 text-sm font-medium">Products</span>
                    </div>
                    <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Sản phẩm</h1>
                    <p className="text-stone-500 mt-1">Quản lý danh mục và thông tin linh kiện, phụ tùng</p>
                </div>
                <Protected permission="product.create">
                    <Link
                        href="/products/new"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        <Plus size={20} />
                        Thêm Sản phẩm
                    </Link>
                </Protected>
            </div>

            {/* FILTERS & SEARCH */}
            <div className="bg-white p-4 rounded-2xl flex flex-col sm:flex-row gap-4 border border-stone-200">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo Tên, SKU, Mã phụ tùng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl text-stone-800 transition-all duration-200 outline-none bg-stone-50 border border-stone-200 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                </div>
                <button className="flex items-center gap-2 px-5 py-3 rounded-xl text-stone-600 font-medium bg-stone-50 border border-stone-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200">
                    <Filter size={18} />
                    Bộ lọc
                </button>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-2xl overflow-hidden border border-stone-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-stone-50 border-b border-stone-200">
                                <th className="p-4 text-xs uppercase tracking-wider text-stone-500 font-semibold w-16">#</th>
                                <th className="p-4 text-xs uppercase tracking-wider text-stone-500 font-semibold">Thông tin Sản phẩm</th>
                                <th className="p-4 text-xs uppercase tracking-wider text-stone-500 font-semibold">Danh mục</th>
                                <th className="p-4 text-xs uppercase tracking-wider text-stone-500 font-semibold text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-stone-500">Đang tải dữ liệu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Package className="text-stone-300" size={48} />
                                            <span className="text-stone-500">Chưa có sản phẩm nào.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => handleViewProduct(item)}
                                        className="border-b border-stone-100 hover:bg-orange-50/50 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4 text-stone-400 text-sm font-mono">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center bg-stone-100 overflow-hidden">
                                                    {getDisplayImage(item) ? (
                                                        <img
                                                            src={getDisplayImage(item)!}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <Package className="text-stone-400" size={24} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-stone-800 line-clamp-1">{item.name}</p>
                                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                                        <span className="text-xs px-2 py-0.5 rounded font-mono bg-orange-100 text-orange-700 border border-orange-200">
                                                            {item.sku}
                                                        </span>
                                                        {item.part_number && (
                                                            <span className="text-xs px-2 py-0.5 rounded font-mono bg-stone-100 text-stone-600">
                                                                {item.part_number}
                                                            </span>
                                                        )}
                                                        {/* Base Unit */}
                                                        {item.unit && (
                                                            <span className="text-xs px-2 py-0.5 rounded font-mono bg-blue-50 text-blue-700 border border-blue-100" title="Đơn vị cơ bản">
                                                                1 {item.unit}
                                                            </span>
                                                        )}
                                                        {/* Alternative Units */}
                                                        {item.product_units?.map((u, idx) => (
                                                            <span key={idx} className="text-xs px-2 py-0.5 rounded font-mono bg-stone-100 text-stone-600 border border-stone-200" title={`Quy đổi: 1 ${unitsMap[u.unit_id] || '---'} = ${u.conversion_rate} ${item.unit}`}>
                                                                1 {unitsMap[u.unit_id] || '---'} = {u.conversion_rate} {item.unit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-stone-600">
                                            {item.categories?.name || '---'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleViewProduct(item)
                                                    }}
                                                    className="p-2.5 rounded-lg bg-stone-100 text-stone-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <Link
                                                    href={`/products/${item.id}`}
                                                    className="p-2.5 rounded-lg bg-stone-100 text-stone-500 hover:bg-orange-100 hover:text-orange-600 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Edit size={16} />
                                                </Link>
                                                <Protected permission="product.delete">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDelete(item.id)
                                                        }}
                                                        className="p-2.5 rounded-lg bg-stone-100 text-stone-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </Protected>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                <div className="px-6 py-4 flex justify-between items-center text-sm bg-stone-50 border-t border-stone-200">
                    <span className="text-stone-500">
                        Hiển thị <span className="text-stone-800 font-medium">{filteredProducts.length}</span> kết quả
                    </span>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 rounded-lg bg-white text-stone-400 border border-stone-200 disabled:opacity-40" disabled>
                            Trước
                        </button>
                        <button className="px-4 py-2 rounded-lg bg-white text-stone-400 border border-stone-200 disabled:opacity-40" disabled>
                            Sau
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!deleteConfirmId}
                title="Xóa sản phẩm"
                message="Bạn có chắc chắn muốn xóa sản phẩm này không? Hành động này không thể hoàn tác."
                confirmText="Xóa ngay"
                cancelText="Hủy"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />

            <ProductDetailModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={selectedProduct}
            />
        </div>
    )
}
