'use client'

import React, { useState } from 'react'
import {
    Boxes, Calendar, Package, Factory, ShieldCheck,
    Globe, MapPin, CheckCircle2,
    Thermometer, Droplets
} from 'lucide-react'
import Image from 'next/image'

interface TraceViewProps {
    lot: any
    companyInfo: {
        name: string
        logo: string | null
    }
}

type Language = 'vi' | 'en' | 'zh' | 'ja'

const translations = {
    vi: {
        title: 'Truy xuất nguồn gốc',
        certified: 'Sản phẩm chính hãng',
        lot_code: 'Mã lô hàng',
        weight: 'Khối lượng',
        supplier: 'Nhà cung cấp',
        packing_date: 'Ngày đóng gói',
        product_code: 'Mã sản phẩm',
        description: 'Mô tả sản phẩm',
        origin: 'Nguồn gốc xuất xứ',
        quality_status: 'Trạng thái kiểm định',
        quality_desc: 'Đạt chuẩn xuất khẩu',
        more_items: 'Tổng cộng {count} mặt hàng trong lô này',
        not_found: 'Sản phẩm không tên',
        powered_by: 'Phát triển bởi AnyWarehouse Technology',
        sections: {
            info: 'Thông tin chung',
            supplier: 'Nguồn gốc',
            quality: 'Chất lượng',
            logistics: 'Vận chuyển'
        }
    },
    en: {
        title: 'Product Traceability',
        certified: 'Authentic Product',
        lot_code: 'LOT Code',
        weight: 'Weight',
        supplier: 'Supplier',
        packing_date: 'Packing Date',
        product_code: 'Product SKU',
        description: 'Description',
        origin: 'Origin',
        quality_status: 'Quality Status',
        quality_desc: 'Export Standard Certified',
        more_items: 'Total {count} items in this lot',
        not_found: 'Unnamed Product',
        powered_by: 'Powered by AnyWarehouse Technology',
        sections: {
            info: 'General Info',
            supplier: 'Origin',
            quality: 'Quality',
            logistics: 'Logistics'
        }
    },
    zh: {
        title: '产品溯源',
        certified: '正品保证',
        lot_code: '批次代码',
        weight: '重量',
        supplier: '供应商',
        packing_date: '包装日期',
        product_code: '产品编号',
        description: '产品描述',
        origin: '原产地',
        quality_status: '质量状态',
        quality_desc: '出口标准认证',
        more_items: '该批次共有 {count} 件物品',
        not_found: '未命名产品',
        powered_by: '由 AnyWarehouse Technology 提供技术支持',
        sections: {
            info: '基本信息',
            supplier: '来源',
            quality: '质量',
            logistics: '物流'
        }
    },
    ja: {
        title: '製品トレーサビリティ',
        certified: '正規品保証',
        lot_code: 'ロット番号',
        weight: '重量',
        supplier: '供給元',
        packing_date: '梱包日',
        product_code: '製品コード',
        description: '商品説明',
        origin: '原産地',
        quality_status: '品質状態',
        quality_desc: '輸出基準認定済み',
        more_items: 'このロットには合計 {count} 個のアイテムがあります',
        not_found: '未設定の製品',
        powered_by: 'AnyWarehouse Technology 提供',
        sections: {
            info: '基本情報',
            supplier: '原産地',
            quality: '品質',
            logistics: '物流'
        }
    }
}

export default function TraceView({ lot, companyInfo }: TraceViewProps) {
    const [lang, setLang] = useState<Language>('vi')
    const t = translations[lang]

    const items = (lot.lot_items as any[]) || []
    const firstItem = items[0]
    const product = firstItem?.products
    const tags = (lot.lot_tags as any[])?.map(t => t.tag) || []
    const supplier = lot.suppliers as any

    const languages = [
        { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
        { code: 'en', label: 'English', flag: '🇺🇸' },
        { code: 'zh', label: '中文', flag: '🇨🇳' },
        { code: 'ja', label: '日本語', flag: '🇯🇵' }
    ]

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans selection:bg-orange-100 selection:text-orange-900">
            {/* STICKY LANGUAGE SWITCHER */}
            <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-orange-100 p-3 shadow-sm">
                <div className="max-w-xl mx-auto flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <Globe size={12} className="text-orange-500 animate-pulse" />
                        <span>Ngôn ngữ / Language</span>
                    </div>
                    <div className="flex justify-center gap-2 overflow-x-auto no-scrollbar w-full px-2">
                        {languages.map((l) => (
                            <button
                                key={l.code}
                                onClick={() => setLang(l.code as Language)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap border-2 ${lang === l.code
                                        ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/30 scale-105'
                                        : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-100'
                                    }`}
                            >
                                <span className="text-lg leading-none">{l.flag}</span>
                                <span>{l.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-4 mt-8 space-y-8">
                {/* BRAND HEADER */}
                <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <div className="relative w-20 h-20 bg-white rounded-[2rem] shadow-2xl shadow-slate-200 border border-white flex items-center justify-center p-3 transform hover:rotate-6 transition-transform">
                        {companyInfo.logo ? (
                            <Image src={companyInfo.logo} alt={companyInfo.name} width={80} height={80} className="object-contain" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-inner">
                                {companyInfo.name.charAt(0)}
                            </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                            <ShieldCheck size={16} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-[11px] font-black tracking-[0.3em] uppercase text-orange-600/80">{t.title}</h1>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{companyInfo.name}</h2>
                    </div>
                </div>

                {/* PRODUCT MAIN CARD */}
                <div className="group bg-white rounded-[3rem] shadow-2xl shadow-slate-200/60 overflow-hidden relative border border-white transition-all hover:shadow-orange-200/40">
                    {/* Header Decoration */}
                    <div className="h-32 bg-gradient-to-br from-slate-900 to-slate-800 relative">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                        <div className="absolute top-6 right-8 flex flex-col items-end">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{t.lot_code}</span>
                            <span className="text-white font-mono font-bold text-sm bg-white/10 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                                {lot.code}
                            </span>
                        </div>
                    </div>

                    {/* Product Image & Title */}
                    <div className="px-8 -mt-20 relative z-10 flex flex-col items-center">
                        <div className="relative w-48 h-48 rounded-[3rem] overflow-hidden bg-white shadow-2xl border-[6px] border-white group-hover:scale-105 transition-transform duration-500">
                            {product?.image_url ? (
                                <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                            ) : (
                                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                                    <Package size={60} className="text-slate-200" />
                                </div>
                            )}
                        </div>

                        <div className="mt-8 text-center space-y-3 px-4">
                            <h1 className="text-3xl font-black text-slate-900 leading-[1.1] tracking-tight">
                                {product?.name || (items.length > 1 ? t.not_found : t.not_found)}
                            </h1>
                            <p className="text-slate-400 font-bold tracking-widest uppercase text-[10px] bg-slate-100 px-4 py-1.5 rounded-full inline-block">
                                SKU: {product?.sku || 'N/A'}
                            </p>

                            {tags.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-2 mt-4 pt-2">
                                    {tags.map((tag, i) => (
                                        <span key={i} className="text-[10px] px-3 py-1 font-black bg-orange-50 text-orange-600 rounded-lg border border-orange-100 uppercase tracking-wider">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DETAIL SECTIONS */}
                    <div className="p-10 space-y-8 mt-4">

                        {/* Highlights Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#f1f5f9] rounded-3xl p-6 flex flex-col items-center text-center space-y-2 border border-white hover:bg-orange-50 transition-colors">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.weight}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-900">
                                        {firstItem?.quantity || '--'}
                                    </span>
                                    <span className="text-sm font-bold text-slate-500">
                                        {firstItem?.unit || product?.unit || ''}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-[#f1f5f9] rounded-3xl p-6 flex flex-col items-center text-center space-y-2 border border-white hover:bg-orange-50 transition-colors">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.packing_date}</span>
                                <span className="text-[15px] font-black text-slate-900">
                                    {lot.packaging_date ? new Date(lot.packaging_date).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : '--'}
                                </span>
                            </div>
                        </div>

                        {/* Supplier Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-4 bg-orange-600 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{t.sections.supplier}</h3>
                            </div>
                            <div className="flex gap-5 p-2 group/card">
                                <div className="w-14 h-14 rounded-2xl bg-white shadow-xl shadow-slate-200 flex items-center justify-center shrink-0 border border-slate-100 group-hover/card:bg-orange-600 group-hover/card:text-white transition-all">
                                    <Factory size={24} />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold text-slate-900 text-lg leading-tight">{supplier?.name || '---'}</p>
                                    <div className="flex items-start gap-1 text-slate-500">
                                        <MapPin size={14} className="mt-0.5 shrink-0" />
                                        <p className="text-sm leading-relaxed">{supplier?.address || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quality Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{t.sections.quality}</h3>
                            </div>
                            <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100 flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                                    <CheckCircle2 size={28} />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold text-emerald-900 text-lg">{t.quality_status}</p>
                                    <p className="text-sm text-emerald-700 font-medium">{t.quality_desc}</p>
                                </div>
                            </div>
                        </div>

                        {/* Logistics (Mockup) */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-4 bg-blue-500 rounded-full" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{t.sections.logistics}</h3>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1 bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex items-center gap-3">
                                    <Thermometer size={18} className="text-blue-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase">Temp</span>
                                        <span className="font-black text-blue-900 text-sm">2-5°C</span>
                                    </div>
                                </div>
                                <div className="flex-1 bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex items-center gap-3">
                                    <Droplets size={18} className="text-blue-500" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase">Humi</span>
                                        <span className="font-black text-blue-900 text-sm">85-90%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {items.length > 1 && (
                            <div className="text-center pt-4">
                                <p className="text-[11px] text-slate-400 font-bold italic">
                                    * {t.more_items.replace('{count}', items.length.toString())}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* CERTIFIED FOOTER */}
                    <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                            <div className="flex items-center justify-center gap-2 text-white font-black text-xl tracking-tight">
                                <ShieldCheck size={28} className="text-orange-500" />
                                <span>{t.certified}</span>
                            </div>
                            <div className="flex items-center gap-4 text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">
                                <span>Global GAP</span>
                                <div className="w-1 h-1 bg-white/20 rounded-full" />
                                <span>Organic</span>
                                <div className="w-1 h-1 bg-white/20 rounded-full" />
                                <span>ISO 22000</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="flex flex-col items-center gap-6 pt-10">
                    <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
                        {t.powered_by}
                    </p>
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-slate-200/50" />
                        <div className="w-8 h-8 rounded-full bg-slate-200/50" />
                        <div className="w-8 h-8 rounded-full bg-slate-200/50" />
                    </div>
                </div>
            </div>

            {/* FLOATING ACTION (Mockup) */}
            <div className="fixed bottom-6 right-6 z-40">
                <button className="w-14 h-14 bg-orange-600 text-white rounded-2xl shadow-2xl shadow-orange-600/40 flex items-center justify-center transform active:scale-95 transition-all hover:rotate-12">
                    <Globe size={24} />
                </button>
            </div>
        </div>
    )
}
