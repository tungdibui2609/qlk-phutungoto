'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Filter, X, Search, Package, Layers, Tag } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'

type Zone = Database['public']['Tables']['zones']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Product = Database['public']['Tables']['products']['Row']

export interface FilterState {
    status: 'all' | 'empty' | 'occupied'
    zoneId: string | null
    productId: string | null
    categoryId: string | null
    searchTerm: string
}

interface FilterPanelProps {
    filters: FilterState
    onChange: (filters: FilterState) => void
    zones: Zone[]
}

export default function FilterPanel({ filters, onChange, zones }: FilterPanelProps) {
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [showProductDropdown, setShowProductDropdown] = useState(false)
    const productInputRef = useRef<HTMLInputElement>(null)

    // Fetch categories on mount
    useEffect(() => {
        async function fetchCategories() {
            const { data } = await supabase
                .from('categories')
                .select('*')
                .order('name')
            if (data) setCategories(data)
        }
        fetchCategories()
    }, [])

    // Fetch products when product search changes
    useEffect(() => {
        async function fetchProducts() {
            let query = supabase
                .from('products')
                .select('id, sku, name')
                .order('name')
                .limit(20)

            if (productSearch) {
                query = query.or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`)
            }

            const { data } = await query
            if (data) setProducts(data as Product[])
        }
        fetchProducts()
    }, [productSearch])

    // Get root zones (level 0 or no parent)
    const rootZones = useMemo(() => {
        return zones.filter(z => !z.parent_id).sort((a, b) => a.code.localeCompare(b.code))
    }, [zones])

    // Get child zones for selected parent
    const getChildZones = (parentId: string) => {
        return zones.filter(z => z.parent_id === parentId).sort((a, b) => a.code.localeCompare(b.code))
    }

    // Build hierarchical zone options
    const zoneOptions = useMemo(() => {
        const options: { id: string; label: string; level: number }[] = []

        function addZone(zone: Zone, depth: number) {
            options.push({
                id: zone.id,
                label: `${'  '.repeat(depth)}${zone.code} - ${zone.name}`,
                level: depth
            })
            const children = getChildZones(zone.id)
            children.forEach(child => addZone(child, depth + 1))
        }

        rootZones.forEach(zone => addZone(zone, 0))
        return options
    }, [zones, rootZones])

    const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        onChange({ ...filters, [key]: value })
    }

    const resetFilters = () => {
        onChange({
            status: 'all',
            zoneId: null,
            productId: null,
            categoryId: null,
            searchTerm: ''
        })
        setProductSearch('')
    }

    const hasActiveFilters = filters.status !== 'all' ||
        filters.zoneId !== null ||
        filters.productId !== null ||
        filters.categoryId !== null

    const selectedProduct = products.find(p => p.id === filters.productId)

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Filter size={18} />
                    <span className="font-medium">Bộ lọc</span>
                    {hasActiveFilters && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs rounded-full">
                            Đang lọc
                        </span>
                    )}
                </div>
                {hasActiveFilters && (
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
                    >
                        <X size={14} />
                        Xóa lọc
                    </button>
                )}
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Status Filter */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Package size={12} />
                        Trạng thái
                    </label>
                    <select
                        value={filters.status}
                        onChange={(e) => updateFilter('status', e.target.value as FilterState['status'])}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="all">Tất cả</option>
                        <option value="empty">Trống</option>
                        <option value="occupied">Có hàng</option>
                    </select>
                </div>

                {/* Zone Filter */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Layers size={12} />
                        Zone
                    </label>
                    <select
                        value={filters.zoneId || ''}
                        onChange={(e) => updateFilter('zoneId', e.target.value || null)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="">Tất cả zone</option>
                        {zoneOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Category Filter */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Tag size={12} />
                        Danh mục
                    </label>
                    <select
                        value={filters.categoryId || ''}
                        onChange={(e) => updateFilter('categoryId', e.target.value || null)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    >
                        <option value="">Tất cả danh mục</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Product Search */}
                <div className="space-y-1.5 relative">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Search size={12} />
                        Sản phẩm
                    </label>
                    <div className="relative">
                        <input
                            ref={productInputRef}
                            type="text"
                            value={selectedProduct ? `${selectedProduct.sku} - ${selectedProduct.name}` : productSearch}
                            onChange={(e) => {
                                setProductSearch(e.target.value)
                                if (filters.productId) {
                                    updateFilter('productId', null)
                                }
                            }}
                            onFocus={() => setShowProductDropdown(true)}
                            onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                            placeholder="Tìm sản phẩm..."
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-8"
                        />
                        {filters.productId && (
                            <button
                                onClick={() => {
                                    updateFilter('productId', null)
                                    setProductSearch('')
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Product Dropdown */}
                    {showProductDropdown && products.length > 0 && !filters.productId && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {products.map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => {
                                        updateFilter('productId', product.id)
                                        setShowProductDropdown(false)
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <span className="font-mono text-blue-600 dark:text-blue-400">{product.sku}</span>
                                    <span className="mx-2 text-gray-400">-</span>
                                    <span className="text-gray-700 dark:text-gray-300">{product.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Position Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={(e) => updateFilter('searchTerm', e.target.value)}
                    placeholder="Tìm kiếm vị trí theo mã..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
            </div>
        </div>
    )
}
