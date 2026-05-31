'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { Printer, Sparkles, Plus, Minus, Check, Tag, Eye, Info, AlertTriangle, Layers, Calendar, ChevronRight, RefreshCw } from 'lucide-react'
import QRCode from "react-qr-code"
import { createPortal } from 'react-dom'

// Cấu trúc kiểu dữ liệu sản phẩm
interface Product {
    id: string
    name: string
    sku: string
    unit: string | null
    internal_name: string | null
    internal_code: string | null
}

// Cấu trúc kiểu dữ liệu LOT để gợi ý
interface LotSuggest {
    id: string
    code: string
    lot_type: string | null
    lot_items: {
        product_id: string
        quantity: number
        unit: string | null
        products: {
            name: string
            sku: string
            unit: string | null
        } | null
    }[] | null
}

export default function PrintLabelsPage() {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    // Refs để click outside
    const semiRef = useRef<HTMLDivElement>(null)
    const finishedRef = useRef<HTMLDivElement>(null)

    // Form states
    const [semiLotCode, setSemiLotCode] = useState('') // Lô bán thành phẩm đầu vào
    const [finishedLotCode, setFinishedLotCode] = useState('') // Lô thành phẩm đầu ra
    const [selectedProductId, setSelectedProductId] = useState('')
    const [weight, setWeight] = useState(10)
    const [unit, setUnit] = useState('kg')
    const [printQty, setPrintQty] = useState(10)
    const [notes, setNotes] = useState('')
    const [reference, setReference] = useState('') // Thông tin tham chiếu

    // Data states
    interface ProductionLotSys {
        id: string
        lot_code: string
        product_id: string
        weight_per_unit: number
        products: {
            id: string
            name: string
            sku: string
            unit: string | null
            internal_name: string | null
            internal_code: string | null
        } | null
    }

    interface ManufacturingOrder {
        id: string
        code: string
        name: string | null
        status: string | null
        created_at: string
        production_lots: ProductionLotSys[] | null
    }

    const [products, setProducts] = useState<Product[]>([])
    const [manufacturingOrders, setManufacturingOrders] = useState<ManufacturingOrder[]>([])
    const [selectedMoId, setSelectedMoId] = useState('')
    const [availableProductionLots, setAvailableProductionLots] = useState<ProductionLotSys[]>([])
    const [semiSuggestions, setSemiSuggestions] = useState<LotSuggest[]>([])
    const [finishedSuggestions, setFinishedSuggestions] = useState<LotSuggest[]>([])
    const [showSemiSuggestions, setShowSemiSuggestions] = useState(false)
    const [showFinishedSuggestions, setShowFinishedSuggestions] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshingLots, setIsRefreshingLots] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)

    // Generated labels preview state
    const [generatedLabels, setGeneratedLabels] = useState<{ code: string; index: number }[]>([])

    // Hàm tải danh sách lô gợi ý
    const fetchLotsData = async (silent = false) => {
        if (!currentSystem?.code) return
        if (!silent) setIsRefreshingLots(true)
        try {
            const { data: lotData, error: lotErr } = await supabase
                .from('production_custom_lots')
                .select('id, code, lot_type, status')
                .eq('system_code', currentSystem.code)
                .neq('status', 'hidden')
                .order('created_at', { ascending: false })

            if (lotErr) {
                if (lotErr.code === '42P01' || lotErr.message?.includes('relation "production_custom_lots" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw lotErr
            }

            const allLots = lotData as any || []
            const semiLots = allLots.filter((l: any) => l.lot_type === 'semi_finished')
            const finLots = allLots.filter((l: any) => l.lot_type === 'finished')

            setSemiSuggestions(semiLots)
            setFinishedSuggestions(finLots.slice(0, 15))
        } catch (err: any) {
            if (err.message === 'TABLE_NOT_EXIST') {
                // Tải từ localStorage fallback
                const localSemi = localStorage.getItem(`local_custom_semi_finished_lots_${currentSystem.code}`)
                const localFin = localStorage.getItem(`local_custom_finished_lots_${currentSystem.code}`)
                
                const parsedSemi = localSemi ? JSON.parse(localSemi) : []
                const parsedFin = localFin ? JSON.parse(localFin) : []
                
                const formattedSemi = parsedSemi.map((l: any) => ({ ...l, lot_type: 'semi_finished', lot_items: null }))
                const formattedFin = parsedFin.map((l: any) => ({ ...l, lot_type: 'finished', lot_items: null }))

                setSemiSuggestions(formattedSemi)
                setFinishedSuggestions(formattedFin.slice(0, 15))
            } else {
                console.error('Lỗi tải danh sách lô gợi ý:', err)
                showToast('Không thể tải danh sách lô gợi ý: ' + err.message, 'error')
            }
        } finally {
            if (!silent) setIsRefreshingLots(false)
        }
    }

    // Đóng gợi ý khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (semiRef.current && !semiRef.current.contains(event.target as Node)) {
                setShowSemiSuggestions(false)
            }
            if (finishedRef.current && !finishedRef.current.contains(event.target as Node)) {
                setShowFinishedSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Load dữ liệu ban đầu từ Supabase
    useEffect(() => {
        if (!currentSystem?.code) return

        async function fetchData() {
            setIsLoading(true)
            try {
                // 1. Tải danh sách Lệnh sản xuất (productions) kèm lô sản phẩm đầu ra gốc
                const { data: moData, error: moErr } = await supabase
                    .from('productions')
                    .select(`
                        id,
                        code,
                        name,
                        status,
                        created_at,
                        production_lots (
                            id,
                            lot_code,
                            product_id,
                            weight_per_unit,
                            products (
                                id,
                                name,
                                sku,
                                unit,
                                internal_name,
                                internal_code
                            )
                        )
                    `)
                    .eq('target_system_code', currentSystem.code)
                    .eq('status', 'IN_PROGRESS')
                    .order('created_at', { ascending: false })

                if (moErr) throw moErr
                setManufacturingOrders(moData as any || [])

                // 2. Tải danh sách sản phẩm dự phòng để chọn tự do nếu cần
                const { data: prodData, error: prodErr } = await supabase
                    .from('products')
                    .select('id, name, sku, unit, internal_name, internal_code')
                    .eq('system_code', currentSystem.code)
                    .order('name')

                if (prodErr) throw prodErr
                setProducts(prodData || [])

                // 3. Tải danh sách lô
                await fetchLotsData(true)
            } catch (err: any) {
                console.error('Lỗi khi tải dữ liệu:', err)
                showToast('Không thể tải dữ liệu: ' + err.message, 'error')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [currentSystem?.code])

    // Tự động nhận diện mo_id từ URL query param và chọn lệnh sản xuất
    useEffect(() => {
        if (manufacturingOrders.length > 0 && typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const moIdParam = params.get('mo_id') || params.get('production_id')
            if (moIdParam) {
                const selectedMo = manufacturingOrders.find(mo => mo.id === moIdParam)
                if (selectedMo) {
                    setSelectedMoId(moIdParam)
                    if (selectedMo.production_lots) {
                        setAvailableProductionLots(selectedMo.production_lots)
                        showToast(`Đã tự động chọn lệnh sản xuất: ${selectedMo.code}`, 'success')
                    }
                }
            }
        }
    }, [manufacturingOrders])

    // Xử lý khi chọn Lệnh sản xuất
    const handleMoChange = (moId: string) => {
        setSelectedMoId(moId)
        
        if (!moId) {
            setAvailableProductionLots([])
            return
        }

        const selectedMo = manufacturingOrders.find(mo => mo.id === moId)
        if (selectedMo && selectedMo.production_lots) {
            setAvailableProductionLots(selectedMo.production_lots)
            showToast(`Đã chọn lệnh sản xuất: ${selectedMo.code}`, 'success')
        } else {
            setAvailableProductionLots([])
        }
    }

    // Xử lý khi chọn Lô Sản phẩm của lệnh
    const handleProductionLotChange = (prodLotId: string) => {
        if (!prodLotId) {
            setSelectedProductId('')
            return
        }

        const prodLot = availableProductionLots.find(pl => pl.id === prodLotId)
        if (prodLot && prodLot.products) {
            setSelectedProductId(prodLot.product_id)
            if (prodLot.weight_per_unit) setWeight(Number(prodLot.weight_per_unit))
            if (prodLot.products.unit) setUnit(prodLot.products.unit)
            showToast(`Đã chọn sản phẩm của lệnh: ${prodLot.products.internal_name || prodLot.products.name}`, 'success')
        }
    }

    // Xử lý khi chọn LOT bán thành phẩm gợi ý
    const handleSelectSemiLot = (lot: LotSuggest) => {
        setSemiLotCode(lot.code)
        setShowSemiSuggestions(false)
        showToast(`Đã chọn Lô BTP: ${lot.code}`, 'success')
    }

    // Xử lý khi chọn LOT thành phẩm gợi ý
    const handleSelectFinishedLot = (lot: LotSuggest) => {
        setFinishedLotCode(lot.code)
        setShowFinishedSuggestions(false)
        showToast(`Đã chọn Lô Thành phẩm: ${lot.code}`, 'success')
    }

    // Tự động sinh danh sách tem preview khi thông tin thay đổi
    useEffect(() => {
        // Mã nền để sinh QR: ưu tiên mã thành phẩm đầu ra, nếu chưa có thì dùng mã bán thành phẩm
        const baseCode = finishedLotCode.trim() || semiLotCode.trim()
        
        if (!baseCode) {
            setGeneratedLabels([])
            return
        }

        const labels = Array.from({ length: printQty }).map((_, i) => {
            const index = i + 1
            const indexStr = String(index).padStart(3, '0')
            const cleanBase = baseCode.replace(/\s+/g, '').toUpperCase()
            return {
                code: `BOX-${cleanBase}-${indexStr}`,
                index
            }
        })
        setGeneratedLabels(labels)
    }, [semiLotCode, finishedLotCode, printQty])

    const handlePrint = async () => {
        if (!semiLotCode.trim()) {
            showToast('Vui lòng điền mã Lô Bán Thành Phẩm!', 'warning')
            return
        }
        if (!finishedLotCode.trim()) {
            showToast('Vui lòng điền mã Lô Thành Phẩm!', 'warning')
            return
        }
        if (!selectedProductId) {
            showToast('Vui lòng chọn sản phẩm!', 'warning')
            return
        }

        setIsPrinting(true)
        try {
            // Chuẩn bị dữ liệu lưu vào DB bảng box_labels
            const labelsToInsert = generatedLabels.map(lbl => ({
                code: lbl.code,
                product_id: selectedProductId,
                quantity: weight,
                unit: unit,
                semi_finished_lot_code: semiLotCode.trim().toUpperCase(),
                finished_lot_code: finishedLotCode.trim().toUpperCase(),
                system_code: currentSystem.code,
                company_id: profile?.company_id || null,
                status: 'printed'
            }))

            // Thử lưu vào DB. Lập trình phòng vệ nếu bảng chưa tồn tại
            const { error: dbErr } = await supabase
                .from('box_labels')
                .insert(labelsToInsert as any)

            if (dbErr) {
                console.warn('[DB WARNING] Không thể lưu tem vào bảng box_labels:', dbErr.message)
                showToast('Chưa lưu vào DB (Hãy chạy SQL migration). Tiếp tục mở trình in...', 'warning')
            } else {
                showToast('Đã lưu thông tin liên kết thùng hàng thành công!', 'success')
            }

            // Mở cửa sổ in của trình duyệt
            setTimeout(() => {
                window.print()
                setIsPrinting(false)
            }, 500)

        } catch (err: any) {
            console.error('Lỗi in ấn:', err)
            window.print()
            setIsPrinting(false)
        }
    }

    // Tìm thông tin sản phẩm: Ưu tiên tìm trong lô sản phẩm của Lệnh sản xuất đang chọn trước, sau đó mới tìm trong danh sách products dự phòng
    const selectedProductInLot = availableProductionLots.find(pl => pl.product_id === selectedProductId)?.products
    const selectedProduct = selectedProductInLot || products.find(p => p.id === selectedProductId)
    
    const productName = selectedProduct 
        ? (selectedProduct.internal_name || selectedProduct.name) 
        : 'CHƯA CHỌN SẢN PHẨM'
    const productSku = selectedProduct ? selectedProduct.sku : '---'

    return (
        <section className="space-y-6 pb-12">
            {/* Stylesheet tối ưu cho việc in ấn nhãn 3.54in x 2.36in */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body > *:not(#print-labels-container) { 
                        display: none !important; 
                    }
                    
                    html, body { 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        height: auto !important;
                        background: white !important;
                        overflow: visible !important;
                    }
                    
                    #print-labels-container { 
                        display: block !important;
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 3.54in !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    
                    #print-labels-container * { 
                        visibility: visible !important; 
                    }
                    
                    .print-label-page { 
                        width: 3.54in !important; 
                        height: 2.36in !important; 
                        page-break-after: always !important; 
                        break-after: page !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        box-sizing: border-box !important;
                        padding: 0.12in !important;
                        overflow: hidden !important;
                        background: white !important;
                        color: black !important;
                        font-family: 'Inter', sans-serif !important;
                    }
                    
                    .print-label-page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    @page { margin: 0; size: 3.54in 2.36in; }
                }
            ` }} />

            {/* Container In Ấn Thực Tế (Ẩn trên màn hình Web) */}
            {typeof document !== 'undefined' && createPortal(
                <div id="print-labels-container" className="hidden print:block bg-white text-black">
                    {generatedLabels.map((lbl) => (
                        <div key={lbl.code} className="print-label-page border border-black">
                            {/* Header nhãn */}
                            <div className="flex justify-between items-center border-b border-dashed border-black pb-1 w-full">
                                <div className="text-[16px] font-black text-black uppercase tracking-tighter leading-none py-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                    LOT: {finishedLotCode.trim() || 'PENDING'}
                                </div>
                            </div>

                            {/* Nội dung chính nhãn */}
                            <div className="flex items-center gap-2 flex-1 py-1 w-full">
                                {/* Cột thông tin bên trái */}
                                <div className="flex-1 space-y-0.5 min-w-0">
                                    <div>
                                        <div className="text-[6px] font-bold text-black uppercase tracking-wider">Product Name</div>
                                        <div className="text-[10.5px] font-black text-black uppercase whitespace-normal break-words">
                                            {productName}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <div className="text-[6px] font-bold text-black uppercase tracking-wider">SKU Code</div>
                                            <div className="text-[8px] font-bold text-black font-mono truncate">{productSku}</div>
                                        </div>
                                        <div>
                                            <div className="text-[6px] font-bold text-black uppercase tracking-wider">Net Weight</div>
                                            <div className="text-[9px] font-black text-black leading-none">
                                                {weight} {unit}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-black my-0.5 pt-1 grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-[6px] font-bold text-black uppercase tracking-wider">Carton / Thùng Số</div>
                                            <div className="text-[14px] font-black text-black font-mono leading-none mt-1">
                                                {lbl.index}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[6px] font-bold text-black uppercase tracking-wider">Reference / Tham chiếu</div>
                                            <div className="text-[10px] font-black text-black uppercase leading-tight mt-1 truncate">
                                                {reference.trim() || 'NONE'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Cột Mã QR bên phải */}
                                <div className="flex flex-col items-center justify-center shrink-0">
                                    <QRCode
                                        value={lbl.code}
                                        size={72}
                                        className="h-[72px] w-[72px]"
                                    />
                                </div>
                            </div>

                            {/* Chân nhãn */}
                            <div className="flex justify-between items-center border-t border-black pt-1 w-full text-[7.5px] text-black font-bold">
                                <div className="uppercase">CHANH THU GROUP</div>
                                <div>Date/Time: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {/* Giao diện Web cao cấp */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
                        Trạm In Tem Thùng & Liên Kết Nguồn Gốc
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-1">
                        Quản lý định danh thùng hàng và liên kết trực tiếp giữa Lô Bán Thành Phẩm nguyên liệu và Lô Thành Phẩm đầu ra.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Cột trái: Form cấu hình */}
                <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-5">
                    <div className="flex items-center gap-2 border-b border-stone-100 dark:border-zinc-800 pb-3">
                        <Sparkles className="text-emerald-500" size={18} />
                        <h3 className="font-bold text-stone-800 dark:text-white">Cấu hình liên kết thùng</h3>
                    </div>

                    <div className="space-y-4">
                        {/* 1. Lô Bán Thành Phẩm (BTP) */}
                        <div ref={semiRef} className="space-y-1.5 relative">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    Bước 1: Lô Bán Thành Phẩm (BTP) <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <a
                                        href="/sanxuat/semi-finished-lots"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                    >
                                        Quản lý lô →
                                    </a>
                                    <button
                                        onClick={() => fetchLotsData()}
                                        disabled={isRefreshingLots}
                                        type="button"
                                        className="text-[10px] text-stone-500 hover:text-stone-700 font-bold flex items-center gap-0.5 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                                        title="Tải lại danh sách"
                                    >
                                        <RefreshCw size={9} className={isRefreshingLots ? "animate-spin" : ""} />
                                        Tải lại
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                value={semiLotCode}
                                onChange={(e) => {
                                    setSemiLotCode(e.target.value)
                                    setShowSemiSuggestions(true)
                                }}
                                onFocus={() => setShowSemiSuggestions(true)}
                                placeholder="Nhập hoặc chọn Lô Bán thành phẩm..."
                                className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono uppercase"
                            />
                            {/* Semi Suggestions Dropdown */}
                            {showSemiSuggestions && semiSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-700">
                                    <div className="p-2 text-[9px] font-black tracking-widest text-stone-400 dark:text-stone-500 uppercase bg-stone-50 dark:bg-zinc-800/50 flex justify-between items-center">
                                        <span>Gợi ý Lô Bán Thành Phẩm</span>
                                        <button onClick={() => setShowSemiSuggestions(false)} className="hover:text-stone-600 font-bold">Đóng</button>
                                    </div>
                                    {semiSuggestions
                                        .filter(l => l.code.toLowerCase().includes(semiLotCode.toLowerCase()))
                                        .map((lot) => (
                                            <div
                                                key={lot.id}
                                                onClick={() => handleSelectSemiLot(lot)}
                                                className="px-4 py-2 hover:bg-stone-50 dark:hover:bg-zinc-700/50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                                            >
                                                <span className="font-mono font-bold text-stone-800 dark:text-white">{lot.code}</span>
                                                <ChevronRight size={12} className="text-stone-400" />
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        {/* 2. Lô Thành Phẩm (TP) */}
                        <div ref={finishedRef} className="space-y-1.5 relative">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                    Bước 2: Lô Thành Phẩm (TP) <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <a
                                        href="/sanxuat/finished-lots"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-orange-600 dark:text-orange-400 font-bold hover:underline"
                                    >
                                        Quản lý lô →
                                    </a>
                                    <button
                                        onClick={() => fetchLotsData()}
                                        disabled={isRefreshingLots}
                                        type="button"
                                        className="text-[10px] text-stone-500 hover:text-stone-700 font-bold flex items-center gap-0.5 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                                        title="Tải lại danh sách"
                                    >
                                        <RefreshCw size={9} className={isRefreshingLots ? "animate-spin" : ""} />
                                        Tải lại
                                    </button>
                                </div>
                            </div>
                            <input
                                type="text"
                                value={finishedLotCode}
                                onChange={(e) => {
                                    setFinishedLotCode(e.target.value)
                                    setShowFinishedSuggestions(true)
                                }}
                                onFocus={() => setShowFinishedSuggestions(true)}
                                placeholder="Nhập hoặc chọn Lô Thành phẩm..."
                                className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-mono uppercase"
                            />
                            {/* Finished Suggestions Dropdown */}
                            {showFinishedSuggestions && finishedSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-700">
                                    <div className="p-2 text-[9px] font-black tracking-widest text-stone-400 dark:text-stone-500 uppercase bg-stone-50 dark:bg-zinc-800/50 flex justify-between items-center">
                                        <span>Gợi ý Lô Thành Phẩm</span>
                                        <button onClick={() => setShowFinishedSuggestions(false)} className="hover:text-stone-600 font-bold">Đóng</button>
                                    </div>
                                    {finishedSuggestions
                                        .filter(l => l.code.toLowerCase().includes(finishedLotCode.toLowerCase()))
                                        .map((lot) => (
                                            <div
                                                key={lot.id}
                                                onClick={() => handleSelectFinishedLot(lot)}
                                                className="px-4 py-2 hover:bg-stone-50 dark:hover:bg-zinc-700/50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                                            >
                                                <span className="font-mono font-bold text-stone-800 dark:text-white">{lot.code}</span>
                                                <ChevronRight size={12} className="text-stone-400" />
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        {/* 3. Lệnh sản xuất (MO) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Bước 3: Lệnh sản xuất (MO)
                                </label>
                                <a
                                    href="/production"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-black flex items-center gap-0.5 hover:underline transition-all"
                                >
                                    Xem Lệnh sản xuất gốc →
                                </a>
                            </div>
                            <select
                                value={selectedMoId}
                                onChange={(e) => handleMoChange(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                            >
                                <option value="">-- Chọn Lệnh sản xuất (MO) --</option>
                                {manufacturingOrders.map((mo) => {
                                    const displayName = mo.name ? `${mo.name} (${mo.code})` : mo.code
                                    return (
                                        <option key={mo.id} value={mo.id}>
                                            {displayName}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>

                        {/* 4. Chọn Sản Phẩm Đầu Ra */}
                        {selectedMoId ? (
                            /* Chọn sản phẩm thuộc MO */
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                        Sản phẩm đầu ra của lệnh <span className="text-red-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-stone-400 font-medium">Lấy dữ liệu từ MO</span>
                                </div>
                                <select
                                    value={availableProductionLots.find(pl => pl.product_id === selectedProductId)?.id || ''}
                                    onChange={(e) => handleProductionLotChange(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
                                >
                                    <option value="">-- Chọn sản phẩm đầu ra của lệnh --</option>
                                    {availableProductionLots.map((pl) => (
                                        <option key={pl.id} value={pl.id}>
                                            {pl.products ? (pl.products.internal_name || pl.products.name) : 'Không rõ sản phẩm'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            /* Chọn sản phẩm tự do */
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                                        Sản Phẩm Đầu Ra <span className="text-red-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-stone-400 font-medium">Tự chọn sản phẩm</span>
                                </div>
                                <select
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 transition-all outline-none"
                                >
                                    <option value="">-- Chọn sản phẩm đầu ra thủ công --</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.internal_name || p.name} ({p.sku})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Quy cách và đơn vị */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                    Quy Cách Thùng
                                </label>
                                <div className="flex items-center rounded-2xl border border-stone-200 dark:border-zinc-700 overflow-hidden bg-stone-50/50 dark:bg-zinc-800/50">
                                    <button
                                        onClick={() => setWeight(prev => Math.max(1, prev - 1))}
                                        className="px-3 py-3 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-400 transition-colors"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <input
                                        type="number"
                                        value={weight}
                                        onChange={(e) => setWeight(Math.max(1, Number(e.target.value)))}
                                        className="w-full text-center bg-transparent border-0 text-stone-800 dark:text-white font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => setWeight(prev => prev + 1)}
                                        className="px-3 py-3 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-400 transition-colors"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                    Đơn vị tính
                                </label>
                                <select
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                                >
                                    <option value="kg">kg</option>
                                    <option value="thùng">thùng</option>
                                    <option value="bao">bao</option>
                                    <option value="hộp">hộp</option>
                                </select>
                            </div>
                        </div>

                        {/* Thông tin tham chiếu */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                                Thông tin tham chiếu (Reference)
                            </label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Ví dụ: PO-123, Tên KH, Ghi chú..."
                                className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                            />
                        </div>

                        {/* Số lượng tem cần in */}
                        <div className="space-y-1.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl p-4 border border-emerald-100/50 dark:border-emerald-900/20">
                            <label className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block text-center mb-2">
                                Số lượng tem cần in
                            </label>
                            <div className="flex items-center justify-center gap-6">
                                <button
                                    onClick={() => setPrintQty(prev => Math.max(1, prev - 1))}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-400 shadow-sm active:scale-90 transition-transform"
                                    disabled={printQty <= 1}
                                >
                                    <Minus size={18} />
                                </button>
                                <span className="text-3xl font-black text-stone-800 dark:text-white tabular-nums min-w-[3rem] text-center">
                                    {printQty}
                                </span>
                                <button
                                    onClick={() => setPrintQty(prev => prev + 1)}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-400 shadow-sm active:scale-90 transition-transform"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Nút in tem */}
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting || !semiLotCode || !finishedLotCode || !selectedProductId}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Printer size={18} />
                            {isPrinting ? 'Đang gửi lệnh in...' : `Xác nhận & In ${printQty} tem`}
                        </button>
                    </div>
                </div>

                {/* Cột phải: Xem trước tem (Live Preview) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Eye className="text-stone-500" size={18} />
                            <h3 className="font-bold text-stone-800 dark:text-white">Xem trước nhãn in (Live Preview)</h3>
                        </div>
                        <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">Kích thước 90mm x 60mm</span>
                    </div>

                    {generatedLabels.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {generatedLabels.slice(0, 4).map((lbl) => (
                                <div 
                                    key={lbl.code} 
                                    className="bg-white text-black rounded-2xl p-5 border-2 border-black shadow-md flex flex-col justify-between aspect-[3.54/2.36] relative overflow-hidden"
                                >
                                    {/* Nhãn nước mờ preview */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] select-none rotate-12">
                                        <span className="text-5xl font-black">PREVIEW</span>
                                    </div>

                                    {/* Header */}
                                    <div className="flex justify-between items-center border-b border-dashed border-black pb-1.5 w-full">
                                        <div className="text-[16px] font-black text-black uppercase tracking-tighter leading-none py-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                            LOT: {finishedLotCode.trim() || 'PENDING'}
                                        </div>
                                    </div>

                                    {/* Nội dung chính */}
                                    <div className="flex items-center gap-2 flex-1 py-1 w-full">
                                        <div className="flex-1 space-y-0.5 min-w-0">
                                            <div>
                                                <div className="text-[6px] font-semibold text-black uppercase tracking-wider">Product Name</div>
                                                <div className="text-[11px] font-black text-black leading-tight uppercase whitespace-normal break-words">
                                                    {productName}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1">
                                                <div>
                                                    <div className="text-[6px] font-semibold text-black uppercase tracking-wider">SKU Code</div>
                                                    <div className="text-[8.5px] font-bold text-black font-mono truncate">{productSku}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[6px] font-semibold text-black uppercase tracking-wider">Net Weight</div>
                                                    <div className="text-[9.5px] font-black text-black leading-none">
                                                        {weight} {unit}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="border-t border-dashed border-black my-0.5 pt-1 grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="text-[6px] font-semibold text-black uppercase tracking-wider">Carton / Thùng Số</div>
                                                    <div className="text-[14px] font-black text-black font-mono leading-none mt-1">
                                                        {lbl.index}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[6px] font-semibold text-black uppercase tracking-wider">Reference / Tham chiếu</div>
                                                    <div className="text-[10px] font-black text-black uppercase leading-tight mt-1 truncate">
                                                        {reference.trim() || 'NONE'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cột mã QR */}
                                        <div className="flex flex-col items-center justify-center shrink-0">
                                            <QRCode
                                                value={lbl.code}
                                                size={64}
                                                className="h-16 w-16"
                                            />
                                        </div>
                                      </div>
  
                                      {/* Footer */}
                                      <div className="flex justify-between items-center border-t border-black pt-1.5 w-full text-[7.5px] text-black font-bold">
                                          <div className="uppercase">CHANH THU GROUP</div>
                                          <div>Date/Time: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                                      </div>
                                  </div>
                            ))}
                            {generatedLabels.length > 4 && (
                                <div className="md:col-span-2 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl p-4 border border-stone-200/50 dark:border-zinc-800/50 text-center text-xs text-stone-500 dark:text-stone-400">
                                    Và {generatedLabels.length - 4} tem thùng khác cùng quy cách đã sẵn sàng in ấn...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-3xl text-center space-y-3 bg-white dark:bg-zinc-900/50">
                            <Tag className="text-stone-300 dark:text-zinc-700" size={48} />
                            <div>
                                <h4 className="font-bold text-stone-700 dark:text-zinc-300">Chưa nhập thông tin lô</h4>
                                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-sm">
                                    Vui lòng điền Lô Bán Thành Phẩm và Lô Thành Phẩm để tự động sinh xem trước tem nhãn.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
