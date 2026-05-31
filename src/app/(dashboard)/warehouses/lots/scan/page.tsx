'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { 
    Boxes, QrCode, ScanLine, Search, ClipboardCheck, Trash2, 
    ArrowLeft, Loader2, RefreshCw, AlertCircle, Calendar, Hash, MapPin, Package, User,
    Camera, Keyboard
} from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import Link from 'next/link'
import { parseQuantity, encodeSTT, decodeSTT } from '@/lib/numberUtils'

export default function LotLabelBindingPage() {
    const { currentSystem, hasModule } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()

    // 1. States cho việc tìm kiếm LOT theo STT
    const [sttInput, setSttInput] = useState('')
    const [inboundDate, setInboundDate] = useState(() => new Date().toISOString().split('T')[0])
    const [selectedLot, setSelectedLot] = useState<any | null>(null)
    const [isSearchingLot, setIsSearchingLot] = useState(false)
    const [searchError, setSearchError] = useState('')

    // 2. States cho việc quét và quản lý tem thùng
    const [scannedBoxLabels, setScannedBoxLabels] = useState<any[]>([])
    const [scanInput, setScanInput] = useState('')
    const [scanError, setScanError] = useState('')
    const [isCheckingScan, setIsCheckingScan] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [useCamera, setUseCamera] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)

    const scanInputRef = useRef<HTMLInputElement>(null)

    // Tự động focus vào ô quét tem khi LOT đã được chọn
    useEffect(() => {
        if (selectedLot && scanInputRef.current) {
            scanInputRef.current.focus()
        }
    }, [selectedLot])

    // ==========================================
    // HÀM TÌM KIẾM LOT THEO STT VÀ NGÀY NHẬP KHO
    // ==========================================
    const handleSearchLot = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!sttInput.trim() || isSearchingLot) return

        setIsSearchingLot(true)
        setSearchError('')
        setSelectedLot(null)
        setScannedBoxLabels([])
        setScanError('')

        try {
            const parsedSeq = encodeSTT(sttInput.trim())
            if (parsedSeq === null || isNaN(parsedSeq)) {
                setSearchError('Số Thứ Tự (STT) nhập vào không hợp lệ!')
                return
            }

            // Truy vấn LOT theo STT, Ngày nhập kho, System Code, Company ID
            const { data: lots, error } = await (supabase
                .from('lots') as any)
                .select(`
                    id, 
                    code, 
                    inbound_date, 
                    daily_seq, 
                    warehouse_name,
                    status,
                    suppliers ( name ),
                    lot_items (
                        id, quantity, unit,
                        products ( name, sku )
                    )
                `)
                .eq('daily_seq', parsedSeq)
                .eq('inbound_date', inboundDate)
                .eq('system_code', currentSystem?.code || '')
                .eq('company_id', profile?.company_id || '')
                .neq('status', 'hidden')

            if (error) throw error

            if (!lots || lots.length === 0) {
                const formattedDate = inboundDate.split('-').reverse().join('/')
                setSearchError(`Không tìm thấy Pallet/LOT nào có STT "${sttInput.trim()}" nhập kho ngày ${formattedDate}!`)
                return
            }

            // Gán LOT tìm thấy (lấy LOT đầu tiên nếu có trùng lặp hy hữu)
            const lotFound = lots[0]
            setSelectedLot(lotFound)

            // Tải danh sách các tem thùng box_labels đã được liên kết với LOT này trước đó (nếu có)
            const { data: linkedLabels, error: labelError } = await (supabase
                .from('box_labels') as any)
                .select('id, code, semi_finished_lot_code, finished_lot_code, quantity, unit, status, product_id, products(name, sku)')
                .eq('lot_id', lotFound.id)
                .eq('system_code', currentSystem?.code || '')

            if (labelError) throw labelError
            setScannedBoxLabels(linkedLabels || [])

            showToast(`Đã tải thành công Pallet: ${lotFound.code}`, 'success')
        } catch (err: any) {
            console.error('Lỗi khi tìm kiếm LOT theo STT:', err)
            setSearchError('Lỗi kết nối cơ sở dữ liệu: ' + err.message)
        } finally {
            setIsSearchingLot(false)
        }
    }

    // ==========================================
    // HÀM XỬ LÝ QUÉT MÃ TEM DÙNG CHUNG (CHO CẢ CAMERA & ĐẦU QUÉT)
    // ==========================================
    const processScannedBoxLabel = async (inputCode: string) => {
        if (!inputCode.trim() || isCheckingScan || !selectedLot) return

        setIsCheckingScan(true)
        setScanError('')

        try {
            const codeFormatted = inputCode.trim().toUpperCase()

            // Tránh quét trùng tem đã có trong danh sách local
            if (scannedBoxLabels.some(item => item.code === codeFormatted)) {
                setScanError('Tem này đã được quét và có trong danh sách xếp Pallet phía dưới.')
                return false
            }

            // Truy vấn kiểm tra tem thùng trong DB
            const { data: labelData, error } = await (supabase
                .from('box_labels') as any)
                .select('id, code, semi_finished_lot_code, finished_lot_code, quantity, unit, status, lot_id, product_id, products(name, sku), lots(code)')
                .eq('code', codeFormatted)
                .eq('system_code', currentSystem?.code || '')
                .maybeSingle()

            if (error) throw error

            if (!labelData) {
                setScanError('Không tìm thấy mã tem thùng này trong hệ thống hoặc khác phân hệ kho!')
                return false
            }

            // Kiểm tra xem tem đã thuộc pallet khác chưa
            if (labelData.lot_id && labelData.lot_id !== selectedLot.id) {
                const confirmed = window.confirm(`Cảnh báo: Tem thùng này đang được xếp ở Pallet "${labelData.lots?.code || 'chưa rõ mã'}". Bạn có chắc chắn muốn chuyển tem này sang Pallet hiện tại không?`)
                if (!confirmed) {
                    return false
                }
            }

            // Thêm vào danh sách local
            setScannedBoxLabels(prev => [...prev, labelData])
            showToast(`Đã thêm tem ${codeFormatted}`, 'success')

            // Phản hồi rung nhẹ trên di động (nếu được hỗ trợ)
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(100)
            }
            return true
        } catch (err: any) {
            console.error('Lỗi kiểm tra tem quét:', err)
            setScanError('Lỗi kết nối hoặc truy vấn tem!')
            return false
        } finally {
            setIsCheckingScan(false)
        }
    }

    // Xử lý khi nhấn nút Thêm hoặc nhấn Enter ở ô nhập
    const handleScanBoxLabel = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!scanInput.trim() || isCheckingScan || !selectedLot) return

        const code = scanInput.trim()
        setScanInput('')
        await processScannedBoxLabel(code)

        // Focus lại vào input để quét tiếp
        setTimeout(() => {
            scanInputRef.current?.focus()
        }, 50)
    }

    // Xử lý khi quét được mã từ Camera điện thoại
    const handleCameraScan = async (resultCode: string) => {
        if (!resultCode || isCheckingScan || !selectedLot) return
        
        // Tránh quét liên tục cùng 1 mã khi camera đang mở
        if (scannedBoxLabels.some(item => item.code === resultCode.trim().toUpperCase())) {
            return
        }

        await processScannedBoxLabel(resultCode)
    }

    // ==========================================
    // HÀM ĐỒNG BỘ LIÊN KẾT LÊN DATABASE (SYNC)
    // ==========================================
    const handleSyncBinding = async () => {
        if (!selectedLot || isSyncing) return

        setIsSyncing(true)
        try {
            const scannedIds = scannedBoxLabels.map(l => l.id)
            const lotId = selectedLot.id

            // 1. Tải danh sách tem đang liên kết hiện tại trên DB để đối chiếu
            const { data: currentLinked, error: fetchLinkedErr } = await (supabase
                .from('box_labels') as any)
                .select('id')
                .eq('lot_id', lotId)

            if (fetchLinkedErr) throw fetchLinkedErr

            const currentLinkedIds = currentLinked?.map((l: any) => l.id) || []
            const removedIds = currentLinkedIds.filter((id: any) => !scannedIds.includes(id))

            // 2. Gỡ liên kết của các con tem cũ trước đây thuộc pallet này nhưng nay bị loại bỏ
            if (removedIds.length > 0) {
                const { error: unlinkError } = await (supabase
                    .from('box_labels') as any)
                    .update({ lot_id: null, status: 'printed' })
                    .in('id', removedIds)

                if (unlinkError) throw unlinkError
            }

            // 2. Thiết lập liên kết pallet mới cho các con tem quét được
            if (scannedIds.length > 0) {
                const { error: boxUpdateErr } = await (supabase
                    .from('box_labels') as any)
                    .update({ lot_id: lotId, status: 'linked' })
                    .in('id', scannedIds)

                if (boxUpdateErr) throw boxUpdateErr
            }

            showToast(`Đồng bộ liên kết Pallet ${selectedLot.code} thành công!`, 'success')
            
            // Cập nhật lại danh sách tem từ DB để đồng bộ trạng thái
            const { data: updatedLabels } = await (supabase
                .from('box_labels') as any)
                .select('id, code, semi_finished_lot_code, finished_lot_code, quantity, unit, status, product_id, products(name, sku)')
                .eq('lot_id', lotId)
                .eq('system_code', currentSystem?.code || '')
            
            if (updatedLabels) {
                setScannedBoxLabels(updatedLabels)
            }
        } catch (err: any) {
            console.error('Lỗi khi đồng bộ liên kết tem thùng:', err)
            showToast('Lỗi đồng bộ dữ liệu: ' + err.message, 'error')
        } finally {
            setIsSyncing(false)
        }
    }

    // Tính toán thống kê tem đã quét
    const totalBoxes = scannedBoxLabels.length
    const totalWeight = scannedBoxLabels.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)
    const displayUnit = scannedBoxLabels[0]?.unit || 'Kg'

    return (
        <section className="space-y-6 pb-16 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/warehouses/lots"
                    className="p-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-300 rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                >
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2.5">
                        <QrCode className="text-orange-600 animate-pulse" size={28} />
                        Quản Lý & Quét Liên Kết Tem Pallet
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm">
                        Nhập số thứ tự Pallet/LOT và thực hiện quét liên kết mã QR tem thùng xếp lên Pallet đó.
                    </p>
                </div>
            </div>

            {/* BƯỚC 1: TÌM KIẾM PALLET / LOT */}
            <div className="bg-white dark:bg-zinc-900 border border-stone-250/60 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-zinc-800">
                    <Search className="text-orange-600" size={18} />
                    <h3 className="font-bold text-sm text-stone-850 dark:text-stone-300 uppercase tracking-wider">Bước 1: Tìm kiếm Pallet/LOT mục tiêu</h3>
                </div>

                <form onSubmit={handleSearchLot} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    {/* Ô chọn ngày nhập kho */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-stone-450 dark:text-stone-500 flex items-center gap-1">
                            <Calendar size={10} />
                            Ngày nhập kho
                        </label>
                        <input
                            type="date"
                            value={inboundDate}
                            onChange={(e) => setInboundDate(e.target.value)}
                            className="w-full px-4 py-2.5 text-xs rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-850 dark:text-white font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
                            style={{ colorScheme: 'light dark' }}
                        />
                    </div>

                    {/* Ô nhập STT Pallet */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-stone-450 dark:text-stone-500 flex items-center gap-1">
                            <Hash size={10} />
                            Số thứ tự Pallet (STT)
                        </label>
                        <input
                            type="text"
                            value={sttInput}
                            onChange={(e) => setSttInput(e.target.value)}
                            placeholder="Nhập STT của LOT (VD: 3, 15...)"
                            className="w-full px-4 py-2.5 text-xs rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-850 dark:text-white font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none font-mono"
                        />
                    </div>

                    {/* Nút tìm kiếm */}
                    <button
                        type="submit"
                        disabled={isSearchingLot || !sttInput.trim()}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl transition-all active:scale-95 shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 cursor-pointer h-[38px]"
                    >
                        {isSearchingLot ? (
                            <>
                                <RefreshCw className="animate-spin" size={14} />
                                Đang tìm kiếm...
                            </>
                        ) : (
                            <>
                                <Search size={14} />
                                Tìm Pallet
                            </>
                        )}
                    </button>
                </form>

                {searchError && (
                    <div className="flex items-center gap-2 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 text-red-600 dark:text-red-405 text-xs font-semibold rounded-2xl">
                        <AlertCircle size={16} />
                        {searchError}
                    </div>
                )}
            </div>

            {/* HIỂN THỊ THÔNG TIN PALLET ĐƯỢC CHỌN VÀ BƯỚC 2 QUÉT MÃ TEM */}
            {selectedLot && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    
                    {/* Sơ yếu lý lịch Pallet / LOT được tìm thấy */}
                    <div className="bg-white dark:bg-zinc-900 border border-stone-250/60 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-zinc-800">
                            <Boxes className="text-orange-600" size={18} />
                            <h3 className="font-bold text-sm text-stone-850 dark:text-stone-300 uppercase tracking-wider">Thông tin Pallet đang liên kết</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                            <div className="p-3 bg-stone-50/50 dark:bg-zinc-800/20 rounded-2xl border border-stone-100/40 dark:border-zinc-850/50">
                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">Mã LOT Nội Bộ</div>
                                <div className="font-mono font-black text-stone-900 dark:text-white uppercase leading-normal text-sm">{selectedLot.code}</div>
                            </div>
                            <div className="p-3 bg-stone-50/50 dark:bg-zinc-800/20 rounded-2xl border border-stone-100/40 dark:border-zinc-850/50">
                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">Nhà Cung Cấp</div>
                                <div className="font-bold text-stone-800 dark:text-zinc-300 truncate text-sm">{selectedLot.suppliers?.name || '---'}</div>
                            </div>
                            <div className="p-3 bg-stone-50/50 dark:bg-zinc-800/20 rounded-2xl border border-stone-100/40 dark:border-zinc-850/50">
                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">Ngày Nhập Kho</div>
                                <div className="font-bold text-stone-800 dark:text-zinc-300 text-sm">
                                    {selectedLot.inbound_date ? selectedLot.inbound_date.split('-').reverse().join('/') : '---'}
                                </div>
                            </div>
                            <div className="p-3 bg-stone-50/50 dark:bg-zinc-800/20 rounded-2xl border border-stone-100/40 dark:border-zinc-850/50">
                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">Kho Lưu Hàng</div>
                                <div className="font-bold text-stone-800 dark:text-zinc-300 text-sm">{selectedLot.warehouse_name || '---'}</div>
                            </div>
                        </div>

                        {/* Sản phẩm chính khai báo trên LOT */}
                        <div className="space-y-2 pt-2">
                            <div className="text-[10px] font-bold text-stone-400 uppercase flex items-center gap-1">
                                <Package size={10} />
                                Sản phẩm khai báo trên LOT:
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedLot.lot_items?.map((item: any) => (
                                    <div key={item.id} className="flex items-center gap-2 bg-stone-50 dark:bg-zinc-800/40 border border-stone-150 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs">
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.products?.sku}</span>
                                        <span className="font-bold text-stone-900 dark:text-white truncate max-w-[200px]">{item.products?.name}</span>
                                        <span className="font-bold text-orange-650 bg-orange-500/5 px-2 py-0.5 rounded-lg border border-orange-500/10 tabular-nums">
                                            {item.quantity} {item.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* BƯỚC 2: QUÉT MÃ QR XẾP THÙNG */}
                    <div className="bg-white dark:bg-zinc-900 border border-stone-250/60 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-6">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-100 dark:border-zinc-800 gap-2">
                            <div className="flex items-center gap-2">
                                <ScanLine className="text-orange-600 animate-pulse" size={18} />
                                <h3 className="font-bold text-sm text-stone-850 dark:text-stone-300 uppercase tracking-wider">Bước 2: Quét mã QR Thùng Hàng xếp Pallet</h3>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4">
                                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                    <span>Thùng: <strong className="text-stone-900 dark:text-white text-sm">{totalBoxes}</strong></span>
                                    <span>Trọng lượng: <strong className="text-emerald-600 dark:text-emerald-400 text-sm">{totalWeight.toFixed(2)}</strong> {displayUnit}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUseCamera(!useCamera)
                                        setCameraError(null)
                                    }}
                                    className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                                        useCamera 
                                            ? 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950/20 dark:border-orange-900/30' 
                                            : 'bg-stone-50 border-stone-200 text-stone-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-stone-300 hover:bg-stone-100'
                                    }`}
                                    title={useCamera ? "Dùng đầu quét/Nhập tay" : "Dùng Camera điện thoại quét"}
                                >
                                    {useCamera ? <Keyboard size={16} /> : <Camera size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Giao diện quét camera */}
                        {useCamera && (
                            <div className="flex flex-col items-center justify-center p-4 bg-stone-50/50 dark:bg-zinc-800/10 border border-stone-200 dark:border-zinc-800 rounded-3xl space-y-3 max-w-sm mx-auto w-full animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="w-full aspect-square relative bg-black rounded-2xl overflow-hidden shadow-inner border border-stone-200 dark:border-zinc-800">
                                    {cameraError ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-stone-50 dark:bg-zinc-800 text-xs">
                                            <AlertCircle className="text-red-500 mb-2" size={24} />
                                            <p className="text-red-500 font-semibold mb-1">Không thể mở camera</p>
                                            <p className="text-stone-400 dark:text-stone-500 text-[10px] mb-3 leading-relaxed">Hãy cấp quyền truy cập Camera cho trình duyệt trong cài đặt của máy.</p>
                                            <button
                                                onClick={() => { setCameraError(null); setUseCamera(false); setTimeout(() => setUseCamera(true), 100); }}
                                                className="px-3 py-1.5 bg-white dark:bg-slate-700 shadow-sm border dark:border-zinc-600 rounded-xl text-[10px] font-bold cursor-pointer"
                                            >
                                                Thử lại
                                            </button>
                                        </div>
                                    ) : (
                                        <Scanner
                                            onScan={(result) => {
                                                if (result && result.length > 0) {
                                                    handleCameraScan(result[0].rawValue)
                                                }
                                            }}
                                            onError={(error: any) => {
                                                console.error('Camera Scanner Error:', error)
                                                setCameraError(error?.message || 'Lỗi camera')
                                            }}
                                            styles={{ container: { width: '100%', height: '100%' } }}
                                            components={{ finder: false }}
                                            constraints={{ facingMode: 'environment' }}
                                        />
                                    )}
                                    <div className="absolute inset-0 border-2 border-orange-500/30 rounded-2xl animate-pulse pointer-events-none"></div>
                                    {isCheckingScan && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl backdrop-blur-[2px]">
                                            <Loader2 className="text-orange-500 animate-spin" size={24} />
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 text-center animate-pulse">
                                    Đưa mã QR Tem Thùng vào khung hình để quét
                                </span>
                            </div>
                        )}

                        {/* Form quét tem */}
                        <div className="max-w-xl">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                                    {useCamera ? "Nhập tay hoặc bổ sung mã tem thùng tại đây" : "Sử dụng đầu quét quét mã tem thùng (BOX-...) dán trên hộp hàng"}
                                </label>
                                <div className="relative">
                                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                                    <input
                                        type="text"
                                        ref={scanInputRef}
                                        value={scanInput}
                                        onChange={(e) => setScanInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                handleScanBoxLabel(e)
                                            }
                                        }}
                                        placeholder="Quét mã QR thùng hàng tại đây..."
                                        disabled={isCheckingScan}
                                        className="w-full pl-10 pr-24 py-2.5 bg-stone-50/50 dark:bg-zinc-800/40 border border-stone-250 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-stone-900 dark:text-zinc-100 text-xs font-mono transition-all placeholder:font-sans uppercase"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleScanBoxLabel}
                                        disabled={isCheckingScan || !scanInput.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                        {isCheckingScan ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            'Thêm'
                                        )}
                                    </button>
                                </div>
                                {scanError && (
                                    <p className="text-xs text-red-500 font-medium pl-1 mt-1">
                                        ⚠️ {scanError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Bảng Danh sách tem đã quét */}
                        {scannedBoxLabels.length > 0 ? (
                            <div className="border border-stone-150 dark:border-zinc-800 rounded-2xl overflow-hidden bg-stone-50/10 dark:bg-zinc-900/20 max-h-[350px] overflow-y-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-stone-150 dark:border-zinc-800 bg-stone-100/50 dark:bg-zinc-800/30 text-[9px] font-black tracking-widest text-stone-400 dark:text-stone-500 uppercase">
                                            <th className="px-4 py-3">Mã QR tem thùng</th>
                                            <th className="px-4 py-3">Lô Bán Thành Phẩm</th>
                                            <th className="px-4 py-3">Lô Thành Phẩm</th>
                                            <th className="px-4 py-3">Sản phẩm</th>
                                            <th className="px-4 py-3 text-right">Trọng lượng</th>
                                            <th className="px-4 py-3 text-center">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-150/40 dark:divide-zinc-800/50">
                                        {scannedBoxLabels.map((label, idx) => {
                                            const prodName = label.products 
                                                ? (label.products.internal_name || label.products.name)
                                                : 'Sản phẩm không rõ'
                                            const prodSku = label.products ? label.products.sku : '---'

                                            return (
                                                <tr key={label.id || idx} className="hover:bg-stone-50/20 dark:hover:bg-zinc-800/10 transition-colors">
                                                    <td className="px-4 py-3 font-mono font-bold text-stone-900 dark:text-zinc-100 uppercase">
                                                        {label.code}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400 uppercase">
                                                        {label.semi_finished_lot_code || '---'}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400 uppercase">
                                                        {label.finished_lot_code || '---'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-stone-950 dark:text-white line-clamp-1 leading-normal uppercase">
                                                            {prodName}
                                                        </div>
                                                        <div className="text-[9px] text-stone-450 font-mono leading-none mt-0.5">{prodSku}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-stone-900 dark:text-zinc-200 tabular-nums">
                                                        {label.quantity} {label.unit}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setScannedBoxLabels(prev => prev.filter((_, i) => i !== idx))
                                                            }}
                                                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                                                            title="Gỡ khỏi Pallet"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900/10 border border-dashed border-stone-200 dark:border-zinc-800 rounded-3xl text-center space-y-3">
                                <QrCode className="text-stone-300 dark:text-zinc-700" size={48} />
                                <div>
                                    <h5 className="text-xs font-bold text-stone-700 dark:text-zinc-300">Chưa xếp thùng hàng nào</h5>
                                    <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5 max-w-xs mx-auto leading-relaxed">
                                        Vui lòng quét xếp mã thùng lên Pallet để thiết lập liên kết nguồn gốc.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* NÚT BẤM ĐỒNG BỘ LIÊN KẾT (SYNC BUTTON) */}
                        <div className="flex items-center justify-between gap-3 pt-6 border-t border-stone-100 dark:border-zinc-800 mt-4">
                            <span className="text-[10px] font-bold text-stone-450 dark:text-stone-500 italic">
                                * Lưu ý: Nhấn nút Đồng bộ liên kết để lưu danh sách tem này vào Pallet DB.
                            </span>
                            <button
                                onClick={handleSyncBinding}
                                disabled={isSyncing}
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[150px] cursor-pointer"
                            >
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Đang đồng bộ...
                                    </>
                                ) : (
                                    <>
                                        <ClipboardCheck size={16} />
                                        Đồng bộ liên kết
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </section>
    )
}
