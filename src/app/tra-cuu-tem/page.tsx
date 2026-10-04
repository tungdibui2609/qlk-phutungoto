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
    Copy, 
    Check, 
    Share2, 
    RefreshCw, 
    X, 
    Box, 
    Factory, 
    Calendar, 
    MapPin, 
    User, 
    AlertCircle, 
    ArrowRight,
    ExternalLink,
    Maximize2,
    SlidersHorizontal,
    QrCode
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

const SAMPLES = [
    { label: 'Sầu riêng Monthong Cấp đông A (Đắk Lắk)', l1: '102010204001-0', l2: '2120908092600166' },
    { label: 'Sầu riêng Ri6 Nguyên quả VIP (Tiền Giang)', l1: '101020101002-0', l2: '1151010102600163' },
    { label: 'Sầu riêng Cấp đông Múi B (Bến Tre)', l1: '102010304001-0', l2: '1201018102600264' }
]

function StampCheckerContent() {
    const searchParams = useSearchParams()

    // Form states
    const [line1, setLine1] = useState(searchParams?.get('l1') || '102010204001-0')
    const [line2, setLine2] = useState(searchParams?.get('l2') || '2120908092600166')
    const [rawPasted, setRawPasted] = useState('')

    // Schema and dictionary states
    const [activeFormat, setActiveFormat] = useState<any>(null)
    const [dictMap, setDictMap] = useState<Record<string, Record<string, string>>>(DEFAULT_DICT)
    const [isLoading, setIsLoading] = useState(true)
    const [copiedLink, setCopiedLink] = useState(false)

    // Camera states
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    const [isScanningOCR, setIsScanningOCR] = useState(false)
    const [cameraError, setCameraError] = useState('')
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)

    // Load active format and dictionaries from Supabase
    useEffect(() => {
        async function loadConfig() {
            setIsLoading(true)
            try {
                // Fetch default format
                const { data: fmtData } = await supabase
                    .from('stamp_formats')
                    .select('*')
                    .eq('is_active', true)
                    .order('is_default', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (fmtData) {
                    setActiveFormat(fmtData)
                }

                // Fetch dictionary rules
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
                console.warn('Không thể tải cấu hình Supabase, dùng mẫu mặc định:', err)
            } finally {
                setIsLoading(false)
            }
        }
        loadConfig()
    }, [])

    const l1Config = activeFormat?.line1_config || DEFAULT_LINE1_CONFIG
    const l2Config = activeFormat?.line2_config || DEFAULT_LINE2_CONFIG

    // Decoding Line 1
    const decodedLine1 = useMemo(() => {
        const clean = (line1 || '').trim().replace(/\s+/g, '')
        const hasDelim = l1Config.has_delimiter
        const delimChar = l1Config.delimiter_char || '-'

        return (l1Config.fields || []).map((field: any) => {
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

            let value = code ? `Mã ${code}` : 'Chưa nhập'
            if (code) {
                if (field.type === 'dictionary' && field.dictCategory) {
                    value = dictMap[field.dictCategory]?.[code] || `Mã ${code} (Chưa khai báo)`
                } else if (field.type === 'supplier') {
                    const suppName = dictMap['supplier']?.[code]
                    value = suppName ? `${code} - ${suppName}` : code
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
    const decodedLine2 = useMemo(() => {
        const clean = (line2 || '').trim().replace(/\s+/g, '')
        const hasDelim = l2Config.has_delimiter
        const delimChar = l2Config.delimiter_char || '-'

        return (l2Config.fields || []).map((field: any) => {
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

            let value = code ? `Mã ${code}` : 'Chưa nhập'
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

    // Computed Product Full Title
    const productFullTitle = useMemo(() => {
        const fruit = decodedLine1.find(d => d.field.key === 'fruit_type')?.value || ''
        const variety = decodedLine1.find(d => d.field.key === 'variety')?.value || ''
        const style = decodedLine1.find(d => d.field.key === 'freeze_style')?.value || ''
        const grade = decodedLine1.find(d => d.field.key === 'product_grade')?.value || ''

        const parts = [fruit, variety, style, grade].filter(p => p && !p.startsWith('Mã ?') && !p.startsWith('Chưa'))
        return parts.length > 0 ? parts.join(' - ') : 'Chưa xác định tên sản phẩm'
    }, [decodedLine1])

    // Quick paste handler (paste 2 lines together or space-separated)
    const handlePasteRaw = (text: string) => {
        setRawPasted(text)
        const lines = text.trim().split(/\r?\n|\s{2,}|[,;/]/).map(s => s.trim()).filter(Boolean)
        if (lines.length >= 2) {
            setLine1(lines[0])
            setLine2(lines[1])
        } else if (lines.length === 1) {
            const single = lines[0]
            if (single.length >= 26) {
                // Try auto-split by length
                setLine1(single.substring(0, l1Config.total_length || 14))
                setLine2(single.substring(l1Config.total_length || 14))
            } else {
                setLine1(single)
            }
        }
    }

    // Share result link
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
            setCameraError('Không thể mở camera. Vui lòng cho phép quyền truy cập camera trên trình duyệt.')
        }
    }

    // Stop Live Camera
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setIsCameraOpen(false)
        setCameraError('')
    }

    // Capture photo from video and run OCR
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

                // Dynamic import Tesseract.js to avoid SSR overhead
                const { createWorker } = await import('tesseract.js')
                const worker = await createWorker('eng')
                const ret = await worker.recognize(dataUrl)
                await worker.terminate()

                const extractedText = ret.data.text || ''
                // Filter digits and dashes
                const lines = extractedText.split('\n').map(l => l.trim().replace(/[^0-9\-]/g, '')).filter(l => l.length >= 8)
                if (lines.length >= 2) {
                    setLine1(lines[0])
                    setLine2(lines[1])
                    stopCamera()
                } else if (lines.length === 1) {
                    setLine1(lines[0])
                    stopCamera()
                } else {
                    alert('Chưa nhận diện rõ mã số từ ảnh chụp. Bạn hãy để camera lại gần con dấu hơn và chụp lại, hoặc nhập tay.')
                }
            }
        } catch (err: any) {
            console.error('OCR error:', err)
            alert('Lỗi quét ảnh: ' + (err.message || 'Vui lòng thử lại'))
        } finally {
            setIsScanningOCR(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col selection:bg-purple-500 selection:text-white">
            {/* Top Brand Banner */}
            <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 shrink-0">
                            <Stamp size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                                    Cổng Tra Cứu Tem Dấu Đóng
                                </h1>
                                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    <ShieldCheck size={12} /> CHÍNH THỨC
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Xác thực tiêu chuẩn sản phẩm & truy xuất nguồn gốc nông sản xuất khẩu
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleShareLink}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title="Sao chép liên kết tra cứu này để gửi cho người khác"
                        >
                            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                            <span className="hidden sm:inline">{copiedLink ? 'Đã sao chép link!' : 'Chia sẻ'}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
                
                {/* 1. Input Box & Quick Presets */}
                <div className="p-4 sm:p-6 rounded-3xl bg-slate-850/80 border border-slate-800 shadow-xl backdrop-blur-sm space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                            <Search size={16} className="text-purple-400" />
                            Nhập 2 dòng mã dấu đóng trên thùng carton
                        </h2>

                        {/* Camera Scan Button */}
                        <button
                            type="button"
                            onClick={startCamera}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
                        >
                            <Camera size={15} />
                            <span>Quét bằng Camera</span>
                        </button>
                    </div>

                    {/* Inputs for Line 1 and Line 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Dòng 1: Phân cấp & Quy cách</span>
                                <span className="font-mono text-[10px] text-slate-400">Chuẩn 14 ký tự (kèm dấu -)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={line1}
                                    onChange={(e) => setLine1(e.target.value.trim().toUpperCase())}
                                    placeholder="vd: 102010204001-0"
                                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-900 border-2 border-slate-700/80 focus:border-purple-500 text-white font-mono text-sm sm:text-base font-black tracking-wider outline-none transition-all shadow-inner"
                                />
                                {line1 && (
                                    <button
                                        type="button"
                                        onClick={() => setLine1('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center justify-between">
                                <span>Dòng 2: Nguồn gốc & Truy xuất</span>
                                <span className="font-mono text-[10px] text-slate-400">Chuẩn 16 chữ số</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={line2}
                                    onChange={(e) => setLine2(e.target.value.trim())}
                                    placeholder="vd: 2120908092600166"
                                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-900 border-2 border-slate-700/80 focus:border-indigo-500 text-white font-mono text-sm sm:text-base font-black tracking-wider outline-none transition-all shadow-inner"
                                />
                                {line2 && (
                                    <button
                                        type="button"
                                        onClick={() => setLine2('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Samples for Client */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                            <Sparkles size={12} className="text-amber-400" /> Bấm thử mẫu sẵn:
                        </span>
                        {SAMPLES.map((s, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => { setLine1(s.l1); setLine2(s.l2); }}
                                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Visual Box Simulation (Bản Mô Phỏng Thực Tế Thùng Hàng) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-900 border border-amber-500/20 shadow-xl space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                                <Box size={18} />
                            </div>
                            <div>
                                <h3 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider">
                                    Mô phỏng Dấu đóng thực tế trên Thùng Carton
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    Vị trí cắt và màu sắc tương ứng theo tiêu chuẩn xuất khẩu
                                </p>
                            </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {line1.length}kt / {line2.length} số
                        </span>
                    </div>

                    {/* Stamp Carton Card Mockup */}
                    <div className="p-4 sm:p-6 rounded-2xl bg-amber-950/30 border-2 border-amber-800/40 text-amber-100 font-mono space-y-3 shadow-inner">
                        {/* Line 1 Tape */}
                        <div className="space-y-1">
                            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                                Dòng 1: {l1Config.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-950/90 border border-amber-900/40 w-full overflow-hidden">
                                {decodedLine1.map(({ field, code, prefix, theme }, idx) => (
                                    <div key={idx} className="flex items-center gap-1 shrink-0">
                                        {prefix && (
                                            <span className="text-slate-500 font-black text-sm px-0.5">{prefix}</span>
                                        )}
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span 
                                                className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-black text-white shadow-xs"
                                                style={{ backgroundColor: theme.hexPreview }}
                                            >
                                                {code}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-300 max-w-[65px] truncate">
                                                {field.shortName || field.name}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Line 2 Tape */}
                        <div className="space-y-1 pt-1">
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                                Dòng 2: {l2Config.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-950/90 border border-indigo-900/40 w-full overflow-hidden">
                                {decodedLine2.map(({ field, code, prefix, theme }, idx) => (
                                    <div key={idx} className="flex items-center gap-1 shrink-0">
                                        {prefix && (
                                            <span className="text-slate-500 font-black text-sm px-0.5">{prefix}</span>
                                        )}
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span 
                                                className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-black text-white shadow-xs"
                                                style={{ backgroundColor: theme.hexPreview }}
                                            >
                                                {code}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-300 max-w-[65px] truncate">
                                                {field.shortName || field.name}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Detailed Decoded Results (Bảng Giải Mã Chi Tiết) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Column 1: Product Specifications */}
                    <div className="p-5 rounded-3xl bg-slate-850/90 border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                                    <Sparkles size={16} />
                                </div>
                                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                                    Tiêu Chuẩn Sản Phẩm (Dòng 1)
                                </h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                                Hợp chuẩn
                            </span>
                        </div>

                        <div className="space-y-3">
                            {decodedLine1.map(({ field, code, value, theme }, idx) => (
                                <div key={idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span 
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                            style={{ backgroundColor: theme.hexPreview }}
                                        />
                                        <div className="truncate">
                                            <div className="text-[11px] font-medium text-slate-400 truncate">
                                                {field.name}
                                            </div>
                                            <div className="text-xs sm:text-sm font-black text-white truncate">
                                                {value}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                                            {code}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Traceability & Origin */}
                    <div className="p-5 rounded-3xl bg-slate-850/90 border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                                    <Factory size={16} />
                                </div>
                                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                                    Truy Xuất Nguồn Gốc (Dòng 2)
                                </h3>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                Minh bạch
                            </span>
                        </div>

                        <div className="space-y-3">
                            {decodedLine2.map(({ field, code, value, theme }, idx) => (
                                <div key={idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span 
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                                            style={{ backgroundColor: theme.hexPreview }}
                                        />
                                        <div className="truncate">
                                            <div className="text-[11px] font-medium text-slate-400 truncate">
                                                {field.name}
                                            </div>
                                            <div className="text-xs sm:text-sm font-black text-white truncate">
                                                {value}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                                            {code}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4. Trust & Export Certification Footer */}
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-black text-emerald-300 uppercase">
                                Xác thực bởi Hệ thống Truy xuất Nguồn gốc Chánh Thu
                            </h4>
                            <p className="text-[11px] text-slate-400">
                                Dữ liệu được đồng bộ trực tiếp từ phòng quản lý chất lượng & đóng gói nhà máy
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-slate-500">
                            Thời gian: {new Date().toLocaleDateString('vi-VN')}
                        </span>
                    </div>
                </div>
            </main>

            {/* Live Camera Scanner Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Camera size={18} className="text-indigo-400" />
                                <h3 className="font-black text-sm text-white uppercase">Quét Con Dấu Bằng Camera</h3>
                            </div>
                            <button
                                type="button"
                                onClick={stopCamera}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Video Viewport */}
                        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                            {cameraError ? (
                                <div className="p-4 text-center text-xs text-red-400 space-y-2">
                                    <AlertCircle size={24} className="mx-auto" />
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
                                    {/* Reticle Overlay */}
                                    <div className="absolute inset-4 border-2 border-indigo-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                                        <div className="w-full flex justify-between">
                                            <span className="w-4 h-4 border-t-2 border-l-2 border-white" />
                                            <span className="w-4 h-4 border-t-2 border-r-2 border-white" />
                                        </div>
                                        <div className="text-center font-mono text-[10px] text-white/80 bg-black/50 py-0.5 px-2 rounded-full self-center">
                                            Đưa 2 dòng số vào khung hình
                                        </div>
                                        <div className="w-full flex justify-between">
                                            <span className="w-4 h-4 border-b-2 border-l-2 border-white" />
                                            <span className="w-4 h-4 border-b-2 border-r-2 border-white" />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={stopCamera}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                disabled={isScanningOCR || !!cameraError}
                                onClick={captureAndOCR}
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
                            >
                                {isScanningOCR ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" /> Đang nhận diện số...
                                    </>
                                ) : (
                                    <>
                                        <Camera size={15} /> Chụp & Nhận diện số
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
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-mono">
                Đang tải cổng tra cứu tem dấu đóng...
            </div>
        }>
            <StampCheckerContent />
        </Suspense>
    )
}
