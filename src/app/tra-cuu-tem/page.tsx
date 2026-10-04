'use client'

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
    Stamp, 
    Sparkles, 
    Search, 
    Camera, 
    CheckCircle2, 
    ShieldCheck, 
    Share2, 
    Check, 
    RefreshCw, 
    X, 
    Box, 
    Factory, 
    Calendar, 
    MapPin, 
    User, 
    AlertCircle, 
    ArrowRight,
    QrCode,
    RotateCcw
} from 'lucide-react'

// Theme definition matching stamp rules
const COLOR_THEMES: Record<string, { label: string; hexPreview: string; bgClass: string; textClass: string }> = {
    purple: { label: 'Tím', hexPreview: '#8b5cf6', bgClass: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200', textClass: 'text-purple-700 dark:text-purple-300' },
    blue: { label: 'Xanh dương', hexPreview: '#2563eb', bgClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200', textClass: 'text-blue-700 dark:text-blue-300' },
    emerald: { label: 'Xanh lá', hexPreview: '#059669', bgClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200', textClass: 'text-emerald-700 dark:text-emerald-300' },
    amber: { label: 'Vàng cam', hexPreview: '#d97706', bgClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200', textClass: 'text-amber-700 dark:text-amber-300' },
    cyan: { label: 'Xanh cyan', hexPreview: '#0891b2', bgClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-200', textClass: 'text-cyan-700 dark:text-cyan-300' },
    fuchsia: { label: 'Hồng tím', hexPreview: '#c026d3', bgClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 dark:bg-fuchsia-950/80 dark:text-fuchsia-200', textClass: 'text-fuchsia-700 dark:text-fuchsia-300' },
    rose: { label: 'Đỏ hồng', hexPreview: '#e11d48', bgClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200', textClass: 'text-rose-700 dark:text-rose-300' }
}

interface DecodedField {
    field: {
        key: string
        name: string
        shortName?: string
        start: number
        length: number
        type: string
        dictCategory?: string
        color?: string
        afterDelimiter?: boolean
        format?: string
    }
    code: string
    prefix: string
    value: string
    theme: { label: string; hexPreview: string; bgClass: string; textClass: string }
}

const DEFAULT_LINE1_CONFIG = {
    title: 'Dòng 1: Phân cấp & Quy cách',
    total_length: 14,
    has_delimiter: true,
    delimiter_char: '-',
    fields: [
        { key: 'fruit_type', name: 'Chủng loại trái cây', shortName: 'Chủng loại', start: 0, length: 1, type: 'dictionary', dictCategory: 'fruit_type', color: 'purple' },
        { key: 'freeze_style', name: 'Hình thức cấp đông', shortName: 'Hình thức', start: 1, length: 2, type: 'dictionary', dictCategory: 'freeze_style', color: 'blue' },
        { key: 'variety', name: 'Giống trái cây', shortName: 'Giống', start: 3, length: 2, type: 'dictionary', dictCategory: 'variety', color: 'emerald' },
        { key: 'product_grade', name: 'Phân loại phẩm cấp', shortName: 'Phẩm cấp', start: 5, length: 2, type: 'dictionary', dictCategory: 'product_grade', color: 'amber' },
        { key: 'package_spec', name: 'Quy cách đóng gói', shortName: 'Quy cách', start: 7, length: 2, type: 'dictionary', dictCategory: 'package_spec', color: 'cyan' },
        { key: 'freeze_method', name: 'Phương pháp cấp đông', shortName: 'Phương pháp', start: 9, length: 3, type: 'dictionary', dictCategory: 'freeze_method', color: 'fuchsia' },
        { key: 'customer_quality', name: 'Chất lượng theo KH', shortName: 'Chất lượng', start: 13, length: 1, type: 'dictionary', dictCategory: 'customer_quality', color: 'rose', afterDelimiter: true }
    ]
}

const DEFAULT_LINE2_CONFIG = {
    title: 'Dòng 2: Truy xuất & Nguồn gốc',
    total_length: 16,
    has_delimiter: false,
    delimiter_char: '-',
    fields: [
        { key: 'factory', name: 'Nhà máy chế biến', shortName: 'Nhà máy', start: 0, length: 1, type: 'dictionary', dictCategory: 'factory', color: 'rose' },
        { key: 'pkg_date', name: 'Ngày đóng gói', shortName: 'Đóng gói', start: 1, length: 4, type: 'date_ddmm', format: 'DD/MM', color: 'amber' },
        { key: 'inbound_date', name: 'Ngày nhập nguyên liệu', shortName: 'Nhập NL', start: 5, length: 6, type: 'date_ddmmyy', format: 'DD/MM/20YY', color: 'purple' },
        { key: 'supplier', name: 'Nhà cung cấp', shortName: 'Nhà CC', start: 11, length: 3, type: 'supplier', dictCategory: 'supplier', color: 'cyan' },
        { key: 'province', name: 'Vùng nguyên liệu (Tỉnh)', shortName: 'Vùng NL', start: 14, length: 2, type: 'dictionary', dictCategory: 'province', color: 'emerald' }
    ]
}

const DEFAULT_DICT: Record<string, Record<string, string>> = {
    fruit_type: { '1': 'TP cấp đông sầu riêng', '2': 'Sầu riêng tươi xuất khẩu' },
    freeze_style: { '01': 'Cấp đông nguyên quả', '02': 'Cấp đông múi' },
    variety: { '01': 'Monthong (Dona)', '02': 'Ri6', '03': 'Musang King', '04': 'Chín Hóa' },
    product_grade: { '01': 'Loại VIP', '02': 'Loại A', '03': 'Loại B', '04': 'Loại C' },
    package_spec: { '01': 'Thùng 10kg', '02': 'Thùng 15kg', '04': '4 Túi/ thùng' },
    freeze_method: { '001': 'Hãm đông', '002': 'Cấp đông nhanh IQF', '003': 'Cấp đông gió' },
    customer_quality: { '0': 'Không phân chia', '1': 'Xuất khẩu Trung Quốc', '2': 'Xuất khẩu Mỹ' },
    factory: { '1': 'Nhà máy Tiền Giang', '2': 'Nhà máy Đắk Lắk' },
    province: { '66': 'Đắk Lắk', '63': 'Tiền Giang', '64': 'Bến Tre' },
    supplier: { '001': 'HTX Nông Nghiệp Krông Pắc' }
}

const DEMO_SAMPLES = [
    { label: 'Sầu riêng Monthong Cấp đông A (Đắk Lắk)', l1: '102010204001-0', l2: '2120908092600166' },
    { label: 'Sầu riêng Ri6 Nguyên quả VIP (Tiền Giang)', l1: '101020101002-0', l2: '1151010102600163' }
]

function StampCheckerContent() {
    const searchParams = useSearchParams()

    // Form inputs: initially empty unless provided in URL
    const urlL1 = searchParams?.get('l1') || ''
    const urlL2 = searchParams?.get('l2') || ''
    const [line1, setLine1] = useState(urlL1)
    const [line2, setLine2] = useState(urlL2)
    const [hasSearched, setHasSearched] = useState(!!(urlL1 || urlL2))

    // Config states
    const [activeFormat, setActiveFormat] = useState<any>(null)
    const [dictMap, setDictMap] = useState<Record<string, Record<string, string>>>(DEFAULT_DICT)
    const [copiedLink, setCopiedLink] = useState(false)

    // Camera states
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [isScanningOCR, setIsScanningOCR] = useState(false)
    const [cameraError, setCameraError] = useState('')
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const resultsRef = useRef<HTMLDivElement | null>(null)

    // Load active format and dictionaries from Supabase
    useEffect(() => {
        async function loadConfig() {
            try {
                const { data: fmtData } = await supabase
                    .from('stamp_formats')
                    .select('*')
                    .eq('is_active', true)
                    .order('is_default', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (fmtData) setActiveFormat(fmtData)

                const { data: dictData } = await supabase
                    .from('stamp_dictionaries')
                    .select('*')
                    .eq('is_active', true)

                if (dictData && dictData.length > 0) {
                    const mapped: Record<string, Record<string, string>> = { ...DEFAULT_DICT }
                    dictData.forEach((item: any) => {
                        if (!mapped[item.category]) mapped[item.category] = {}
                        mapped[item.category][item.code] = item.name
                    })
                    setDictMap(mapped)
                }
            } catch (err) {
                console.warn('Lỗi tải cấu hình, dùng mặc định:', err)
            }
        }
        loadConfig()
    }, [])

    const l1Config = activeFormat?.line1_config || DEFAULT_LINE1_CONFIG
    const l2Config = activeFormat?.line2_config || DEFAULT_LINE2_CONFIG

    // Decoding Line 1
    const decodedLine1 = useMemo<DecodedField[]>(() => {
        const clean = (line1 || '').trim().replace(/\s+/g, '')
        const hasDelim = l1Config.has_delimiter
        const delimChar = l1Config.delimiter_char || '-'

        return ((l1Config?.fields as any[]) || []).map((field: any): DecodedField => {
            let code = ''
            let prefix = ''

            if (field.afterDelimiter && hasDelim) {
                prefix = delimChar
                const dIdx = clean.indexOf(delimChar)
                if (dIdx !== -1) {
                    code = clean.substring(dIdx + 1, dIdx + 1 + field.length)
                } else if (clean.length >= field.start + field.length) {
                    code = clean.substring(field.start, field.start + field.length)
                }
            } else {
                if (clean.length >= field.start + field.length) {
                    code = clean.substring(field.start, field.start + field.length)
                }
            }

            let value = code ? `Mã ${code}` : 'Chưa có'
            if (code) {
                if (field.type === 'dictionary' && field.dictCategory) {
                    value = dictMap[field.dictCategory]?.[code] || `Mã ${code} (Chưa khai báo)`
                } else if (field.type === 'supplier') {
                    const suppName = dictMap['supplier']?.[code]
                    value = suppName ? `${code} - ${suppName}` : `Mã NCC: ${code}`
                } else if (field.type === 'date_ddmm' && code.length === 4) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}`
                } else if (field.type === 'date_ddmmyy' && code.length === 6) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}/20${code.substring(4, 6)}`
                } else if (field.type === 'raw') {
                    value = code
                }
            }

            const theme = COLOR_THEMES[field.color] || COLOR_THEMES.purple
            return { field, code: code || '?', prefix, value, theme }
        })
    }, [line1, l1Config, dictMap])

    // Decoding Line 2
    const decodedLine2 = useMemo<DecodedField[]>(() => {
        const clean = (line2 || '').trim().replace(/\s+/g, '')
        const hasDelim = l2Config.has_delimiter
        const delimChar = l2Config.delimiter_char || '-'

        return ((l2Config?.fields as any[]) || []).map((field: any): DecodedField => {
            let code = ''
            let prefix = ''

            if (field.afterDelimiter && hasDelim) {
                prefix = delimChar
                const dIdx = clean.indexOf(delimChar)
                if (dIdx !== -1) {
                    code = clean.substring(dIdx + 1, dIdx + 1 + field.length)
                } else if (clean.length >= field.start + field.length) {
                    code = clean.substring(field.start, field.start + field.length)
                }
            } else {
                if (clean.length >= field.start + field.length) {
                    code = clean.substring(field.start, field.start + field.length)
                }
            }

            let value = code ? `Mã ${code}` : 'Chưa có'
            if (code) {
                if (field.type === 'dictionary' && field.dictCategory) {
                    value = dictMap[field.dictCategory]?.[code] || `Mã ${code} (Chưa khai báo)`
                } else if (field.type === 'supplier') {
                    const suppName = dictMap['supplier']?.[code]
                    value = suppName ? `${code} (${suppName})` : `Mã NCC: ${code}`
                } else if (field.type === 'date_ddmm' && code.length === 4) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}`
                } else if (field.type === 'date_ddmmyy' && code.length === 6) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}/20${code.substring(4, 6)}`
                } else if (field.type === 'raw') {
                    value = code
                }
            }

            const theme = COLOR_THEMES[field.color] || COLOR_THEMES.blue
            return { field, code: code || '?', prefix, value, theme }
        })
    }, [line2, l2Config, dictMap])

    // Product Title
    const productTitle = useMemo(() => {
        const fruit = decodedLine1.find((d: DecodedField) => d.field.key === 'fruit_type')?.value || ''
        const variety = decodedLine1.find((d: DecodedField) => d.field.key === 'variety')?.value || ''
        const style = decodedLine1.find((d: DecodedField) => d.field.key === 'freeze_style')?.value || ''
        const grade = decodedLine1.find((d: DecodedField) => d.field.key === 'product_grade')?.value || ''

        const parts = [fruit, variety, style, grade].filter(p => p && !p.startsWith('Mã ?') && !p.startsWith('Chưa'))
        return parts.length > 0 ? parts.join(' • ') : 'Sản phẩm chưa xác định'
    }, [decodedLine1])

    // Handle Search click
    const handleDoSearch = (l1?: string, l2?: string) => {
        const val1 = l1 !== undefined ? l1 : line1
        const val2 = l2 !== undefined ? l2 : line2
        if (!val1.trim() && !val2.trim()) {
            alert('Vui lòng nhập mã Dòng 1 hoặc Dòng 2 để tra cứu.')
            return
        }
        setHasSearched(true)
        setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 150)
    }

    // Reset Search
    const handleReset = () => {
        setLine1('')
        setLine2('')
        setHasSearched(false)
    }

    // Share link
    const handleShareLink = () => {
        const url = `${window.location.origin}/tra-cuu-tem?l1=${encodeURIComponent(line1)}&l2=${encodeURIComponent(line2)}`
        navigator.clipboard.writeText(url)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2500)
    }

    // Start Live Camera
    const startCamera = async () => {
        setCameraError('')
        setIsCameraOpen(true)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch (err: any) {
            console.error('Camera error:', err)
            setCameraError('Không thể mở camera. Vui lòng cho phép quyền truy cập camera trên thiết bị.')
        }
    }

    // Stop Camera
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setIsCameraOpen(false)
        setCameraError('')
    }

    // Capture & OCR
    const captureAndOCR = async () => {
        if (!videoRef.current) return
        setIsScanningOCR(true)
        try {
            const video = videoRef.current
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth || 1280
            canvas.height = video.videoHeight || 720
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

                const { createWorker } = await import('tesseract.js')
                const worker = await createWorker('eng')
                const ret = await worker.recognize(dataUrl)
                await worker.terminate()

                const extractedText = ret.data.text || ''
                const lines = extractedText.split('\n').map(l => l.trim().replace(/[^0-9\-]/g, '')).filter(l => l.length >= 8)
                if (lines.length >= 2) {
                    setLine1(lines[0])
                    setLine2(lines[1])
                    setHasSearched(true)
                    stopCamera()
                } else if (lines.length === 1) {
                    setLine1(lines[0])
                    setHasSearched(true)
                    stopCamera()
                } else {
                    alert('Chưa nhận diện rõ mã số. Hãy đưa camera lại gần con dấu hơn và bấm chụp lại.')
                }
            }
        } catch (err: any) {
            alert('Lỗi quét ảnh: ' + (err.message || 'Thử lại sau'))
        } finally {
            setIsScanningOCR(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
            
            {/* Header tối giản */}
            <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                            <Stamp size={17} />
                        </div>
                        <div>
                            <h1 className="text-xs sm:text-sm font-black tracking-tight text-white uppercase">
                                Tra Cứu Tem Dấu Đóng
                            </h1>
                            <p className="text-[10px] text-slate-400">
                                Xác thực thùng hàng xuất khẩu
                            </p>
                        </div>
                    </div>

                    {hasSearched && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleShareLink}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all"
                            >
                                {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
                                <span>{copiedLink ? 'Đã chép link' : 'Chia sẻ'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1 transition-all"
                            >
                                <RotateCcw size={13} />
                                <span>Quét mã khác</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Container */}
            <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">

                {/* KHUNG THAO TÁC CHÍNH (CAMERA + NHẬP MÃ) */}
                <div className="p-5 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
                    
                    {/* Nút bật Camera quét lớn & nổi bật nhất */}
                    <button
                        type="button"
                        onClick={startCamera}
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                    >
                        <Camera size={22} />
                        <span>BẬT CAMERA QUÉT DẤU ĐÓNG</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-800" />
                        <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Hoặc nhập mã tay</span>
                        <div className="flex-1 h-px bg-slate-800" />
                    </div>

                    {/* 2 Ô nhập Dòng 1 & Dòng 2 */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Dòng 1 (Phân cấp sản phẩm - 14 ký tự)
                            </label>
                            <input
                                type="text"
                                value={line1}
                                onChange={(e) => {
                                    const val = e.target.value.trim()
                                    // Tự động phân tách nếu dán cả 2 dòng
                                    const parts = val.split(/[\r\n\s]+/)
                                    if (parts.length >= 2 && parts[0].length >= 8 && parts[1].length >= 8) {
                                        setLine1(parts[0].toUpperCase())
                                        setLine2(parts[1])
                                    } else {
                                        setLine1(val.toUpperCase())
                                    }
                                }}
                                placeholder="vd: 102010204001-0"
                                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm sm:text-base font-bold outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Dòng 2 (Truy xuất nguồn gốc - 16 chữ số)
                            </label>
                            <input
                                type="text"
                                value={line2}
                                onChange={(e) => setLine2(e.target.value.trim())}
                                placeholder="vd: 2120908092600166"
                                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm sm:text-base font-bold outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => handleDoSearch()}
                            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] shadow-lg shadow-indigo-600/20"
                        >
                            <Search size={17} />
                            <span>TRA CỨU THÔNG TIN</span>
                        </button>
                    </div>
                </div>

                {/* KHI CHƯA TRA CỨU: Chỉ hiện hướng dẫn đơn giản */}
                {!hasSearched && (
                    <div className="p-8 rounded-3xl border border-dashed border-slate-800/80 text-center space-y-2 text-slate-500">
                        <Stamp size={28} className="mx-auto text-slate-600 mb-1" />
                        <p className="text-xs font-semibold text-slate-400">
                            Chưa có dữ liệu tra cứu
                        </p>
                        <p className="text-[11px] max-w-sm mx-auto">
                            Bạn hãy bấm <strong>"Bật Camera quét dấu đóng"</strong> hoặc nhập mã số ở trên rồi bấm <strong>"Tra cứu kết quả"</strong> để xem thông tin thùng hàng.
                        </p>
                    </div>
                )}

                {/* KHI ĐÃ TRA CỨU: HIỆN KẾT QUẢ PHÍA DƯỚI */}
                {hasSearched && (
                    <div ref={resultsRef} className="space-y-5 animate-in fade-in duration-300">
                        
                        {/* Tiêu đề sản phẩm nổi bật */}
                        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    <ShieldCheck size={13} /> XÁC THỰC THÀNH CÔNG
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {new Date().toLocaleDateString('vi-VN')}
                                </span>
                            </div>

                            <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Tên sản phẩm đầy đủ
                                </div>
                                <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                                    {productTitle}
                                </h2>
                            </div>

                            {/* Dấu đóng trực quan thu nhỏ */}
                            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Con dấu trên thùng:</span>
                                    <span className="font-mono text-slate-500">{line1} / {line2}</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {decodedLine1.map(({ code, theme, field }: DecodedField, i: number) => (
                                        <span 
                                            key={i} 
                                            className="px-2 py-0.5 rounded-md text-xs font-mono font-black text-white shadow-2xs"
                                            style={{ backgroundColor: theme.hexPreview }}
                                            title={field.name}
                                        >
                                            {code}
                                        </span>
                                    ))}
                                    <span className="px-1 text-slate-500 font-bold self-center">|</span>
                                    {decodedLine2.map(({ code, theme, field }: DecodedField, i: number) => (
                                        <span 
                                            key={i} 
                                            className="px-2 py-0.5 rounded-md text-xs font-mono font-black text-white shadow-2xs"
                                            style={{ backgroundColor: theme.hexPreview }}
                                            title={field.name}
                                        >
                                            {code}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Chi tiết phân giải 2 phần */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Cột 1: Tiêu chuẩn sản phẩm */}
                            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                                <h3 className="text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                                    <Box size={14} /> Tiêu chuẩn sản phẩm (Dòng 1)
                                </h3>

                                <div className="space-y-2">
                                    {decodedLine1.map(({ field, value }: DecodedField, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
                                            <span className="text-slate-400 text-[11px]">{field.name}:</span>
                                            <strong className="text-white font-bold">{value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cột 2: Truy xuất nguồn gốc */}
                            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-800">
                                    <Factory size={14} /> Nguồn gốc & Truy xuất (Dòng 2)
                                </h3>

                                <div className="space-y-2">
                                    {decodedLine2.map(({ field, value }: DecodedField, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
                                            <span className="text-slate-400 text-[11px]">{field.name}:</span>
                                            <strong className="text-white font-bold">{value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Nút reset tra cứu mã khác */}
                        <div className="pt-2 text-center">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 inline-flex items-center gap-2 cursor-pointer transition-colors"
                            >
                                <RotateCcw size={14} />
                                <span>Tra cứu thùng hàng khác</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800/60 py-4 text-center text-[11px] text-slate-500">
                Hệ thống truy xuất nguồn gốc con dấu nông sản xuất khẩu
            </footer>

            {/* Live Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Camera size={16} className="text-indigo-400" />
                                <h3 className="font-bold text-xs text-white uppercase">Quét Con Dấu Thùng</h3>
                            </div>
                            <button
                                type="button"
                                onClick={stopCamera}
                                className="p-1 text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                            {cameraError ? (
                                <div className="p-4 text-center text-xs text-red-400 space-y-1">
                                    <AlertCircle size={20} className="mx-auto" />
                                    <p>{cameraError}</p>
                                </div>
                            ) : (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-4 border-2 border-indigo-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                                        <div className="w-full flex justify-between">
                                            <span className="w-3 h-3 border-t-2 border-l-2 border-white" />
                                            <span className="w-3 h-3 border-t-2 border-r-2 border-white" />
                                        </div>
                                        <div className="text-center font-mono text-[9px] text-white/80 bg-black/60 py-0.5 px-2 rounded-full self-center">
                                            Đưa 2 dòng số vào khung hình
                                        </div>
                                        <div className="w-full flex justify-between">
                                            <span className="w-3 h-3 border-b-2 border-l-2 border-white" />
                                            <span className="w-3 h-3 border-b-2 border-r-2 border-white" />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={stopCamera}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                disabled={isScanningOCR || !!cameraError}
                                onClick={captureAndOCR}
                                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {isScanningOCR ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" /> Đang nhận diện...
                                    </>
                                ) : (
                                    <>
                                        <Camera size={14} /> Chụp & Quét số
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function StampCheckerPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs font-mono">
                Đang tải cổng tra cứu tem...
            </div>
        }>
            <StampCheckerContent />
        </Suspense>
    )
}
