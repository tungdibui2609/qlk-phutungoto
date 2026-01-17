'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Package, TrendingUp, AlertTriangle, Boxes, ArrowUpRight, Sparkles } from 'lucide-react'

type Category = Database['public']['Tables']['categories']['Row']
type Product = Database['public']['Tables']['products']['Row']

export default function Home() {
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const { data: cats } = await supabase.from('categories').select('*')
        const { data: prods } = await supabase.from('products').select('*, categories(name)')

        if (cats) setCategories(cats)
        if (prods) setProducts(prods as any)
        setLoading(false)
    }

    const stats = [
        {
            label: 'Tổng Sản phẩm',
            value: products.length,
            icon: Package,
            color: '#f97316',
            bg: 'rgba(249, 115, 22, 0.08)',
            trend: '+12%',
        },
        {
            label: 'Danh mục',
            value: categories.length,
            icon: Boxes,
            color: '#0891b2',
            bg: 'rgba(8, 145, 178, 0.08)',
            trend: '+3',
        },
        {
            label: 'Tồn kho thấp',
            value: 5,
            icon: AlertTriangle,
            color: '#ca8a04',
            bg: 'rgba(202, 138, 4, 0.08)',
            trend: '-2',
        },
        {
            label: 'Nhập tuần này',
            value: 24,
            icon: TrendingUp,
            color: '#16a34a',
            bg: 'rgba(22, 163, 74, 0.08)',
            trend: '+18%',
        },
    ]

    return (
        <div className="space-y-8">
            {/* PAGE HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="text-orange-500" size={20} />
                        <span className="text-orange-600 text-sm font-medium">Dashboard</span>
                    </div>
                    <h1 className="text-3xl font-bold text-stone-800 tracking-tight">
                        Tổng quan Kho hàng
                    </h1>
                    <p className="text-stone-500 mt-1">
                        Theo dõi và quản lý phụ tùng ô tô hiệu quả
                    </p>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {stats.map((stat, i) => {
                    const Icon = stat.icon
                    return (
                        <div
                            key={i}
                            className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-stone-200 transition-all duration-300 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/50"
                        >
                            {/* Background glow on hover */}
                            <div
                                className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{
                                    background: `radial-gradient(circle, ${stat.color}15 0%, transparent 70%)`,
                                }}
                            />

                            <div className="relative flex items-start justify-between">
                                <div>
                                    <p className="text-stone-500 text-sm mb-1">{stat.label}</p>
                                    <p className="text-3xl font-bold text-stone-800">{stat.value}</p>
                                    <div className="flex items-center gap-1 mt-2">
                                        <ArrowUpRight size={14} style={{ color: stat.color }} />
                                        <span className="text-xs font-medium" style={{ color: stat.color }}>
                                            {stat.trend}
                                        </span>
                                        <span className="text-xs text-stone-400">vs tuần trước</span>
                                    </div>
                                </div>
                                <div
                                    className="p-3 rounded-xl transition-all duration-300"
                                    style={{ background: stat.bg }}
                                >
                                    <Icon size={24} style={{ color: stat.color }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Categories Card */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-stone-800">Danh mục ({categories.length})</h2>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                            Tổng quan
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-12 text-stone-400">
                            <Boxes className="mx-auto mb-3 opacity-50" size={40} />
                            <p>Chưa có danh mục nào</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {categories.map(cat => (
                                <div
                                    key={cat.id}
                                    className="group flex items-center gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100 transition-all duration-200 hover:bg-orange-50 hover:border-orange-200"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
                                    >
                                        <Boxes size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-stone-800">{cat.name}</p>
                                        <p className="text-sm text-stone-500">{cat.description || 'Không có mô tả'}</p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded font-mono bg-stone-100 text-stone-500">
                                        {cat.slug}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Products Card */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-stone-800">Sản phẩm gần đây</h2>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            {products.length} sản phẩm
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-12 text-stone-400">
                            <Package className="mx-auto mb-3 opacity-50" size={40} />
                            <p>Chưa có sản phẩm nào</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {products.slice(0, 5).map(prod => (
                                <div
                                    key={prod.id}
                                    className="group flex items-center gap-4 p-4 rounded-xl bg-stone-50 border border-stone-100 transition-all duration-200 hover:bg-orange-50 hover:border-orange-200"
                                >
                                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-stone-200 overflow-hidden">
                                        {prod.image_url ? (
                                            <img src={prod.image_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Package size={20} className="text-stone-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-stone-800 truncate">{prod.name}</p>
                                        <p className="text-sm text-stone-500">{prod.manufacturer || 'N/A'}</p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded font-mono bg-orange-100 text-orange-700 border border-orange-200">
                                        {prod.sku}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
