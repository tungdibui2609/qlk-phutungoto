// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { 
    Stamp, 
    Plus, 
    Search, 
    Edit, 
    Trash2, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    ArrowRight, 
    SlidersHorizontal, 
    Smartphone, 
    Sparkles, 
    X, 
    Check, 
    Layers, 
    Calendar, 
    Factory, 
    MapPin, 
    Box, 
    FileText,
    Star,
    Copy,
    Settings,
    ListFilter,
    HelpCircle,
    ListOrdered,
    ChevronDown,
    ChevronUp,
    Pin,
    Maximize2,
    Minimize2,
    ExternalLink
} from 'lucide-react'

// Types
export interface StampRule {
    id: string
    category: string
    code: string
    name: string
    description?: string | null
    system_code?: string
    is_active: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

export interface StampFieldConfig {
    key: string
    name: string
    shortName: string
    start: number
    length: number
    type: 'dictionary' | 'supplier' | 'date_ddmm' | 'date_ddmmyy' | 'raw'
    dictCategory?: string
    format?: string
    color: string
    afterDelimiter?: boolean
}

export interface StampLineConfig {
    title: string
    total_length: number
    has_delimiter?: boolean
    delimiter_char?: string
    sample?: string
    fields: StampFieldConfig[]
}

export interface StampFormat {
    id: string
    code: string
    name: string
    description?: string | null
    system_code?: string
    is_default: boolean
    is_active: boolean
    line1_config: StampLineConfig
    line2_config: StampLineConfig
    created_at?: string
    updated_at?: string
}

// Bảng màu cho các phân đoạn mã dấu đóng - Đảm bảo độ tương phản cao, chữ đậm sắc nét, dễ đọc trên cả nền sáng và tối
export const COLOR_THEMES: Record<string, { 
    label: string
    cardBadge: string
    cardPill: string
    bgClass: string
    badgeClass: string
    textClass: string
    borderClass: string
    hexPreview: string
}> = {
    purple: {
        label: 'Tím hoa cà',
        cardBadge: 'bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-purple-950 dark:text-purple-200 border border-purple-300/80 dark:border-purple-700',
        bgClass: 'bg-purple-500/25 text-purple-300 border-purple-500/50',
        badgeClass: 'bg-purple-500/30 text-purple-200 border-purple-400/60 shadow-sm shadow-purple-500/20',
        textClass: 'text-purple-300',
        borderClass: 'border-purple-500',
        hexPreview: '#8b5cf6'
    },
    blue: {
        label: 'Xanh dương đậm',
        cardBadge: 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-blue-950 dark:text-blue-200 border border-blue-300/80 dark:border-blue-700',
        bgClass: 'bg-blue-500/25 text-blue-300 border-blue-500/50',
        badgeClass: 'bg-blue-500/30 text-blue-200 border-blue-400/60 shadow-sm shadow-blue-500/20',
        textClass: 'text-blue-300',
        borderClass: 'border-blue-500',
        hexPreview: '#2563eb'
    },
    emerald: {
        label: 'Xanh lá ngọc',
        cardBadge: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-emerald-950 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700',
        bgClass: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50',
        badgeClass: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/60 shadow-sm shadow-emerald-500/20',
        textClass: 'text-emerald-300',
        borderClass: 'border-emerald-500',
        hexPreview: '#059669'
    },
    amber: {
        label: 'Vàng hổ phách',
        cardBadge: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700',
        bgClass: 'bg-amber-500/25 text-amber-300 border-amber-500/50',
        badgeClass: 'bg-amber-500/30 text-amber-200 border-amber-400/60 shadow-sm shadow-amber-500/20',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-500',
        hexPreview: '#d97706'
    },
    cyan: {
        label: 'Xanh cyan sáng',
        cardBadge: 'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-cyan-950 dark:text-cyan-200 border border-cyan-300/80 dark:border-cyan-700',
        bgClass: 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50',
        badgeClass: 'bg-cyan-500/30 text-cyan-200 border-cyan-400/60 shadow-sm shadow-cyan-500/20',
        textClass: 'text-cyan-300',
        borderClass: 'border-cyan-500',
        hexPreview: '#0891b2'
    },
    teal: {
        label: 'Xanh mòng két',
        cardBadge: 'bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-teal-950 dark:text-teal-200 border border-teal-300/80 dark:border-teal-700',
        bgClass: 'bg-teal-500/25 text-teal-300 border-teal-500/50',
        badgeClass: 'bg-teal-500/30 text-teal-200 border-teal-400/60 shadow-sm shadow-teal-500/20',
        textClass: 'text-teal-300',
        borderClass: 'border-teal-500',
        hexPreview: '#0d9488'
    },
    rose: {
        label: 'Hồng đỏ ruby',
        cardBadge: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-rose-950 dark:text-rose-200 border border-rose-300/80 dark:border-rose-700',
        bgClass: 'bg-rose-500/25 text-rose-300 border-rose-500/50',
        badgeClass: 'bg-rose-500/30 text-rose-200 border-rose-400/60 shadow-sm shadow-rose-500/20',
        textClass: 'text-rose-300',
        borderClass: 'border-rose-500',
        hexPreview: '#e11d48'
    },
    sky: {
        label: 'Xanh mây trời',
        cardBadge: 'bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-sky-950 dark:text-sky-200 border border-sky-300/80 dark:border-sky-700',
        bgClass: 'bg-sky-500/25 text-sky-300 border-sky-500/50',
        badgeClass: 'bg-sky-500/30 text-sky-200 border-sky-400/60 shadow-sm shadow-sky-500/20',
        textClass: 'text-sky-300',
        borderClass: 'border-sky-500',
        hexPreview: '#0284c7'
    },
    violet: {
        label: 'Tím violet',
        cardBadge: 'bg-violet-100 text-violet-950 border-violet-300 dark:bg-violet-950/70 dark:text-violet-200 dark:border-violet-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-violet-950 dark:text-violet-200 border border-violet-300/80 dark:border-violet-700',
        bgClass: 'bg-violet-500/25 text-violet-300 border-violet-500/50',
        badgeClass: 'bg-violet-500/30 text-violet-200 border-violet-400/60 shadow-sm shadow-violet-500/20',
        textClass: 'text-violet-300',
        borderClass: 'border-violet-500',
        hexPreview: '#7c3aed'
    },
    fuchsia: {
        label: 'Hồng cánh sen',
        cardBadge: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300 dark:bg-fuchsia-950/70 dark:text-fuchsia-200 dark:border-fuchsia-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-fuchsia-950 dark:text-fuchsia-200 border border-fuchsia-300/80 dark:border-fuchsia-700',
        bgClass: 'bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/50',
        badgeClass: 'bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-400/60 shadow-sm shadow-fuchsia-500/20',
        textClass: 'text-fuchsia-300',
        borderClass: 'border-fuchsia-500',
        hexPreview: '#c026d3'
    },
    orange: {
        label: 'Cam tươi rực rỡ',
        cardBadge: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-orange-950 dark:text-orange-200 border border-orange-300/80 dark:border-orange-700',
        bgClass: 'bg-orange-500/25 text-orange-300 border-orange-500/50',
        badgeClass: 'bg-orange-500/30 text-orange-200 border-orange-400/60 shadow-sm shadow-orange-500/20',
        textClass: 'text-orange-300',
        borderClass: 'border-orange-500',
        hexPreview: '#ea580c'
    }
}

export const STAMP_CATEGORIES: Record<string, { 
    label: string
    line: 'line1' | 'line2'
    position: string
    length: string
    description: string
    colorBadge: string
}> = {
    fruit_type: { 
        label: 'Chủng loại trái cây', 
        line: 'line1', 
        position: 'Ký tự 1', 
        length: '1 ký tự', 
        description: 'Loại trái cây thành phẩm cấp đông (Sầu riêng, Mít, Dưa hấu, Nhãn...)',
        colorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
    },
    freeze_style: { 
        label: 'Hình thức cấp đông', 
        line: 'line1', 
        position: 'Ký tự 2, 3', 
        length: '2 ký tự', 
        description: 'Nguyên trái, múi, cắt lát...',
        colorBadge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    },
    variety: { 
        label: 'Giống trái cây', 
        line: 'line1', 
        position: 'Ký tự 4, 5', 
        length: '2 ký tự', 
        description: 'Monthong (Dona), Ri-6, Musang King...',
        colorBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    },
    product_grade: { 
        label: 'Phân loại thành phẩm', 
        line: 'line1', 
        position: 'Ký tự 6, 7', 
        length: '2 ký tự', 
        description: 'Loại VIP, Loại A, Loại B, Loại C...',
        colorBadge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    },
    package_spec: { 
        label: 'Quy cách đóng gói', 
        line: 'line1', 
        position: 'Ký tự 8, 9', 
        length: '2 ký tự', 
        description: 'Số lượng túi trong 1 thùng (1 túi/thùng, 4 túi/thùng...)',
        colorBadge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800'
    },
    freeze_method: { 
        label: 'Phương pháp cấp đông', 
        line: 'line1', 
        position: 'Ký tự 10, 11, 12', 
        length: '3 ký tự', 
        description: 'Hầm đông, Nitơ, IQF...',
        colorBadge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800'
    },
    customer_quality: { 
        label: 'Chất lượng theo khách hàng', 
        line: 'line1', 
        position: 'Ký tự 14', 
        length: '1 ký tự', 
        description: 'Không phân chia (0), hoặc theo tiêu chuẩn riêng của từng khách hàng',
        colorBadge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
    },
    factory: { 
        label: 'Mã nhà máy', 
        line: 'line2', 
        position: 'Ký tự 1 (F)', 
        length: '1 ký tự', 
        description: 'Mã định danh nhà máy chế biến (1: Bến Tre, 2: Đắk Lắk...)',
        colorBadge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    },
    supplier: { 
        label: 'Mã nhà cung cấp', 
        line: 'line2', 
        position: 'Ký tự 12, 13, 14 (XXX)', 
        length: '3 ký tự', 
        description: 'Mã hóa nhà cung cấp nguyên liệu theo danh sách được duyệt (001, 002, 047...)',
        colorBadge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
    },
    province: { 
        label: 'Vùng nguyên liệu (Tỉnh)', 
        line: 'line2', 
        position: 'Ký tự 15, 16 (ZZ)', 
        length: '2 ký tự', 
        description: 'Mã hóa các đơn vị hành chính cấp tỉnh (66: Đắk Lắk, 71: Bến Tre...)',
        colorBadge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
    }
}

export default function StampRulesPage() {
    const { showToast } = useToast()

    // Main navigation tab: 'dictionaries' vs 'formats'
    const [mainTab, setMainTab] = useState<'dictionaries' | 'formats'>('dictionaries')

    // Rules state
    const [rules, setRules] = useState<StampRule[]>([])
    const [isLoadingRules, setIsLoadingRules] = useState(true)
    const [selectedLine, setSelectedLine] = useState<'all' | 'line1' | 'line2'>('all')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    // Formats (Templates) state
    const [formats, setFormats] = useState<StampFormat[]>([])
    const [activeFormatId, setActiveFormatId] = useState<string>('')
    const [isLoadingFormats, setIsLoadingFormats] = useState(true)

    // Simulator states
    const [simLine1, setSimLine1] = useState('102010204001-0')
    const [simLine2, setSimLine2] = useState('2120908092600166')

    // Modal Create / Edit Rule states
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<StampRule | null>(null)
    const [formCategory, setFormCategory] = useState<string>('fruit_type')
    const [formCode, setFormCode] = useState('')
    const [formName, setFormName] = useState('')
    const [formDesc, setFormDesc] = useState('')
    const [formSortOrder, setFormSortOrder] = useState('1')
    const [isSavingRule, setIsSavingRule] = useState(false)

    // Modal Create / Edit Format (Template) states
    const [isFormatModalOpen, setIsFormatModalOpen] = useState(false)
    const [editingFormat, setEditingFormat] = useState<StampFormat | null>(null)
    const [formatSubTab, setFormatSubTab] = useState<'general' | 'line1' | 'line2'>('line1')
    const [formFmtCode, setFormFmtCode] = useState('')
    const [formFmtName, setFormFmtName] = useState('')
    const [formFmtDesc, setFormFmtDesc] = useState('')
    const [formFmtIsDefault, setFormFmtIsDefault] = useState(false)
    const [formLine1Config, setFormLine1Config] = useState<StampLineConfig>({
        title: 'Dòng 1: Phân cấp & Quy cách',
        total_length: 14,
        has_delimiter: true,
        delimiter_char: '-',
        sample: '102010204001-0',
        fields: []
    })
    const [formLine2Config, setFormLine2Config] = useState<StampLineConfig>({
        title: 'Dòng 2: Truy xuất & Nguồn gốc',
        total_length: 16,
        has_delimiter: false,
        delimiter_char: '-',
        sample: '2120908092600166',
        fields: []
    })
    const [isSavingFormat, setIsSavingFormat] = useState(false)
    const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({})
    const [showTapeMeaning, setShowTapeMeaning] = useState(true)
    const [isFormatModalFullscreen, setIsFormatModalFullscreen] = useState(false)

    const toggleFieldExpand = (line: 'line1' | 'line2', idx: number) => {
        const key = `${line}_${idx}`
        setExpandedFields(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const toggleAllFields = (line: 'line1' | 'line2', count: number) => {
        setExpandedFields(prev => {
            const next = { ...prev }
            const anyOpen = Array.from({ length: count }).some((_, i) => prev[`${line}_${i}`])
            const targetState = !anyOpen
            for (let i = 0; i < count; i++) {
                next[`${line}_${i}`] = targetState
            }
            return next
        })
    }

    // Fetch rules from Supabase
    const fetchRules = useCallback(async () => {
        setIsLoadingRules(true)
        try {
            const { data, error } = await supabase
                .from('stamp_dictionaries')
                .select('*')
                .order('category', { ascending: true })
                .order('sort_order', { ascending: true })
                .order('code', { ascending: true })

            if (error) throw error
            setRules(data || [])
        } catch (err: any) {
            console.error('Lỗi khi tải quy tắc dấu đóng:', err)
            showToast('Không thể tải danh mục quy tắc: ' + err.message, 'error')
        } finally {
            setIsLoadingRules(false)
        }
    }, [showToast])

    // Fetch formats from Supabase
    const fetchFormats = useCallback(async () => {
        setIsLoadingFormats(true)
        try {
            const { data, error } = await supabase
                .from('stamp_formats')
                .select('*')
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: true })

            if (error) throw error
            const list = data || []
            setFormats(list)
            if (list.length > 0) {
                const defaultFmt = list.find((f: StampFormat) => f.is_default) || list[0]
                setActiveFormatId(prev => prev || defaultFmt.id)
            }
        } catch (err: any) {
            console.error('Lỗi khi tải cấu trúc định dạng dấu đóng:', err)
        } finally {
            setIsLoadingFormats(false)
        }
    }, [])

    useEffect(() => {
        fetchRules()
        fetchFormats()
    }, [fetchRules, fetchFormats])

    // Active format object
    const activeFormat = useMemo(() => {
        return formats.find(f => f.id === activeFormatId) || formats.find(f => f.is_default) || formats[0] || null
    }, [formats, activeFormatId])

    // Update simulator sample if user switches format
    const handleSelectFormatForSimulator = (fmtId: string) => {
        setActiveFormatId(fmtId)
        const target = formats.find(f => f.id === fmtId)
        if (target) {
            if (target.line1_config?.sample) setSimLine1(target.line1_config.sample)
            if (target.line2_config?.sample) setSimLine2(target.line2_config.sample)
        }
    }

    // Filter rules
    const filteredRules = useMemo(() => {
        return rules.filter(r => {
            const catInfo = STAMP_CATEGORIES[r.category]
            if (selectedLine === 'line1' && catInfo?.line !== 'line1') return false
            if (selectedLine === 'line2' && catInfo?.line !== 'line2') return false
            if (selectedCategory !== 'all' && r.category !== selectedCategory) return false

            if (!searchTerm.trim()) return true
            const q = searchTerm.toLowerCase().trim()
            return (
                r.code.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q) ||
                (catInfo?.label || '').toLowerCase().includes(q)
            )
        })
    }, [rules, selectedLine, selectedCategory, searchTerm])

    // Fast dictionary map for simulator & display
    const dictMap = useMemo(() => {
        const map: Record<string, Record<string, string>> = {}
        rules.forEach(r => {
            if (!map[r.category]) map[r.category] = {}
            map[r.category][r.code.toUpperCase()] = r.name
        })
        return map
    }, [rules])

    // Dynamic Simulator decoding with colored segments based on activeFormat schema!
    const decodedSimulation = useMemo(() => {
        const clean1 = (simLine1 || '').trim().replace(/\s+/g, '')
        const clean2 = (simLine2 || '').trim().replace(/\s+/g, '')

        if (!activeFormat) {
            return { l1Segments: [], l2Segments: [] }
        }

        // Line 1 decoding
        const l1Fields = activeFormat.line1_config?.fields || []
        const hasDelim = activeFormat.line1_config?.has_delimiter
        const delimChar = activeFormat.line1_config?.delimiter_char || '-'

        const l1Segments = l1Fields.map(field => {
            let code = ''
            let prefix = ''

            if (field.afterDelimiter && hasDelim) {
                prefix = delimChar
                const delimIdx = clean1.indexOf(delimChar)
                if (delimIdx !== -1) {
                    code = clean1.substring(delimIdx + 1, delimIdx + 1 + field.length)
                } else if (clean1.length >= field.start + field.length) {
                    code = clean1.substring(field.start, field.start + field.length)
                }
            } else {
                if (clean1.length >= field.start + field.length) {
                    code = clean1.substring(field.start, field.start + field.length)
                }
            }

            let value = code ? `Mã ${code}` : 'Chưa nhập'
            if (code) {
                if (field.type === 'dictionary' && field.dictCategory) {
                    value = dictMap[field.dictCategory]?.[code] || `Mã ${code} (Chưa cấu hình)`
                } else if (field.type === 'supplier') {
                    const suppName = dictMap['supplier']?.[code]
                    value = suppName ? `${code} (${suppName})` : code
                } else if (field.type === 'date_ddmm' && code.length === 4) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}`
                } else if (field.type === 'date_ddmmyy' && code.length === 6) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}/20${code.substring(4, 6)}`
                } else if (field.type === 'raw') {
                    value = code
                }
            }

            const theme = COLOR_THEMES[field.color] || COLOR_THEMES.purple
            return {
                key: field.key,
                code: code || '?',
                prefix,
                shortLabel: field.shortName || field.name,
                label: field.name,
                value,
                bgClass: theme.bgClass,
                badgeClass: theme.badgeClass,
                textClass: theme.textClass
            }
        })

        // Line 2 decoding
        const l2Fields = activeFormat.line2_config?.fields || []
        const hasDelim2 = activeFormat.line2_config?.has_delimiter
        const delimChar2 = activeFormat.line2_config?.delimiter_char || '-'

        const l2Segments = l2Fields.map(field => {
            let code = ''
            let prefix = ''

            if (field.afterDelimiter && hasDelim2) {
                prefix = delimChar2
                const delimIdx = clean2.indexOf(delimChar2)
                if (delimIdx !== -1) {
                    code = clean2.substring(delimIdx + 1, delimIdx + 1 + field.length)
                } else if (clean2.length >= field.start + field.length) {
                    code = clean2.substring(field.start, field.start + field.length)
                }
            } else {
                if (clean2.length >= field.start + field.length) {
                    code = clean2.substring(field.start, field.start + field.length)
                }
            }

            let value = code ? `Mã ${code}` : 'Chưa nhập'
            if (code) {
                if (field.type === 'dictionary' && field.dictCategory) {
                    value = dictMap[field.dictCategory]?.[code] || `Mã ${code} (Chưa cấu hình)`
                } else if (field.type === 'supplier') {
                    const suppName = dictMap['supplier']?.[code]
                    value = suppName ? `${code} (${suppName})` : code
                } else if (field.type === 'date_ddmm' && code.length === 4) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}`
                } else if (field.type === 'date_ddmmyy' && code.length === 6) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}/20${code.substring(4, 6)}`
                } else if (field.type === 'raw') {
                    value = code
                }
            }

            const theme = COLOR_THEMES[field.color] || COLOR_THEMES.blue
            return {
                key: field.key,
                code: code || '?',
                shortLabel: field.shortName || field.name,
                label: field.name,
                value,
                bgClass: theme.bgClass,
                badgeClass: theme.badgeClass,
                textClass: theme.textClass
            }
        })

        return { l1Segments, l2Segments }
    }, [activeFormat, simLine1, simLine2, dictMap])

    // Open Modal Create Rule
    const handleOpenCreateRule = (categoryKey?: string) => {
        setEditingRule(null)
        setFormCategory(categoryKey || selectedCategory !== 'all' ? selectedCategory : 'fruit_type')
        setFormCode('')
        setFormName('')
        setFormDesc('')
        setFormSortOrder(String(rules.filter(r => r.category === (categoryKey || formCategory)).length + 1))
        setIsRuleModalOpen(true)
    }

    // Open Modal Edit Rule
    const handleOpenEditRule = (rule: StampRule) => {
        setEditingRule(rule)
        setFormCategory(rule.category)
        setFormCode(rule.code)
        setFormName(rule.name)
        setFormDesc(rule.description || '')
        setFormSortOrder(String(rule.sort_order || 1))
        setIsRuleModalOpen(true)
    }

    // Save Rule (Insert or Update)
    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formCode.trim() || !formName.trim()) {
            showToast('Vui lòng nhập đầy đủ mã và diễn giải', 'warning')
            return
        }

        setIsSavingRule(true)
        try {
            const payload: any = {
                category: formCategory,
                code: formCode.trim().toUpperCase(),
                name: formName.trim(),
                description: formDesc.trim() || null,
                sort_order: parseInt(formSortOrder, 10) || 0,
                updated_at: new Date().toISOString()
            }

            if (editingRule) {
                const { error } = await supabase
                    .from('stamp_dictionaries')
                    .update(payload)
                    .eq('id', editingRule.id)
                if (error) throw error
                showToast(`Đã cập nhật quy tắc "${payload.code}" thành công`, 'success')
            } else {
                const { error } = await supabase
                    .from('stamp_dictionaries')
                    .insert([payload])
                if (error) throw error
                showToast(`Đã thêm mới quy tắc "${payload.code}" thành công`, 'success')
            }

            setIsRuleModalOpen(false)
            fetchRules()
        } catch (err: any) {
            console.error('Lỗi khi lưu quy tắc:', err)
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSavingRule(false)
        }
    }

    // Delete Rule
    const handleDeleteRule = async (rule: StampRule) => {
        const confirmed = window.confirm(`Bạn có chắc muốn xóa mã quy ước "${rule.code} - ${rule.name}" không?`)
        if (!confirmed) return

        try {
            const { error } = await supabase
                .from('stamp_dictionaries')
                .delete()
                .eq('id', rule.id)

            if (error) throw error
            showToast(`Đã xóa quy tắc ${rule.code}`, 'success')
            setRules(prev => prev.filter(r => r.id !== rule.id))
        } catch (err: any) {
            console.error('Lỗi khi xóa quy tắc:', err)
            showToast('Không thể xóa: ' + err.message, 'error')
        }
    }

    // Toggle Active State for Rule
    const handleToggleActiveRule = async (rule: StampRule) => {
        try {
            const newActive = !rule.is_active
            const { error } = await supabase
                .from('stamp_dictionaries')
                .update({ is_active: newActive, updated_at: new Date().toISOString() })
                .eq('id', rule.id)

            if (error) throw error
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: newActive } : r))
            showToast(`Đã ${newActive ? 'bật' : 'tắt'} kích hoạt mã ${rule.code}`, 'success')
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        }
    }

    // --- TEMPLATE FORMAT MANAGEMENT ---

    // Open Modal Create Format
    const handleOpenCreateFormat = () => {
        setEditingFormat(null)
        setFormFmtCode(`STAMP_FMT_${Date.now().toString().slice(-4)}`)
        setFormFmtName('Khuôn định dạng dấu đóng mới')
        setFormFmtDesc('')
        setFormFmtIsDefault(formats.length === 0)
        // Clone default template if exists, or use sample
        if (activeFormat) {
            const l1 = JSON.parse(JSON.stringify(activeFormat.line1_config || {}))
            const l2 = JSON.parse(JSON.stringify(activeFormat.line2_config || {}))
            setFormLine1Config({ ...l1, has_delimiter: !!l1.has_delimiter, delimiter_char: l1.delimiter_char || '-' })
            setFormLine2Config({ ...l2, has_delimiter: !!l2.has_delimiter, delimiter_char: l2.delimiter_char || '-' })
        }
        setFormatSubTab('line1')
        setIsFormatModalOpen(true)
    }

    // Open Modal Edit Format
    const handleOpenEditFormat = (fmt: StampFormat) => {
        setEditingFormat(fmt)
        setFormFmtCode(fmt.code)
        setFormFmtName(fmt.name)
        setFormFmtDesc(fmt.description || '')
        setFormFmtIsDefault(fmt.is_default)
        const l1 = JSON.parse(JSON.stringify(fmt.line1_config || {}))
        const l2 = JSON.parse(JSON.stringify(fmt.line2_config || {}))
        setFormLine1Config({ ...l1, has_delimiter: !!l1.has_delimiter, delimiter_char: l1.delimiter_char || '-' })
        setFormLine2Config({ ...l2, has_delimiter: !!l2.has_delimiter, delimiter_char: l2.delimiter_char || '-' })
        setFormatSubTab('line1')
        setIsFormatModalOpen(true)
    }

    // Set Format as Default
    const handleSetDefaultFormat = async (fmt: StampFormat) => {
        try {
            // First unset all
            await supabase
                .from('stamp_formats')
                .update({ is_default: false, updated_at: new Date().toISOString() })
                .neq('id', '00000000-0000-0000-0000-000000000000')

            // Then set target as default
            const { error } = await supabase
                .from('stamp_formats')
                .update({ is_default: true, updated_at: new Date().toISOString() })
                .eq('id', fmt.id)

            if (error) throw error
            showToast(`Đã đặt "${fmt.name}" làm khuôn định dạng mặc định cho toàn hệ thống & app mobile!`, 'success')
            fetchFormats()
        } catch (err: any) {
            showToast('Lỗi khi đặt mặc định: ' + err.message, 'error')
        }
    }

    // Save Format (Schema & Metadata)
    const handleSaveFormat = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formFmtCode.trim() || !formFmtName.trim()) {
            showToast('Vui lòng nhập đầy đủ mã và tên khuôn định dạng', 'warning')
            return
        }

        setIsSavingFormat(true)
        try {
            const payload: any = {
                code: formFmtCode.trim().toUpperCase(),
                name: formFmtName.trim(),
                description: formFmtDesc.trim() || null,
                is_default: formFmtIsDefault,
                is_active: true,
                line1_config: formLine1Config,
                line2_config: formLine2Config,
                updated_at: new Date().toISOString()
            }

            if (formFmtIsDefault) {
                // If setting this as default, unset others first
                await supabase
                    .from('stamp_formats')
                    .update({ is_default: false })
                    .neq('id', '00000000-0000-0000-0000-000000000000')
            }

            if (editingFormat) {
                const { error } = await supabase
                    .from('stamp_formats')
                    .update(payload)
                    .eq('id', editingFormat.id)
                if (error) throw error
                showToast(`Đã lưu cấu trúc khuôn định dạng "${payload.name}" thành công`, 'success')
            } else {
                const { error } = await supabase
                    .from('stamp_formats')
                    .insert([payload])
                if (error) throw error
                showToast(`Đã tạo khuôn định dạng "${payload.name}" thành công`, 'success')
            }

            setIsFormatModalOpen(false)
            fetchFormats()
        } catch (err: any) {
            console.error('Lỗi khi lưu khuôn định dạng:', err)
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSavingFormat(false)
        }
    }

    // Delete Format
    const handleDeleteFormat = async (fmt: StampFormat) => {
        if (fmt.is_default) {
            showToast('Không thể xóa khuôn mẫu đang là mặc định của hệ thống!', 'warning')
            return
        }
        const confirmed = window.confirm(`Bạn có chắc muốn xóa khuôn định dạng "${fmt.name}" không?`)
        if (!confirmed) return

        try {
            const { error } = await supabase
                .from('stamp_formats')
                .delete()
                .eq('id', fmt.id)
            if (error) throw error
            showToast(`Đã xóa khuôn định dạng ${fmt.name}`, 'success')
            fetchFormats()
        } catch (err: any) {
            showToast('Không thể xóa: ' + err.message, 'error')
        }
    }

    // Field mutation helpers for Format Editor
    const handleAddField = (targetLine: 'line1' | 'line2') => {
        const config = targetLine === 'line1' ? formLine1Config : formLine2Config
        const currentFields = config.fields || []
        const lastField = currentFields[currentFields.length - 1]
        const newStart = lastField ? lastField.start + lastField.length : 0

        const newField: StampFieldConfig = {
            key: `field_${currentFields.length + 1}`,
            name: `Trường mới ${currentFields.length + 1}`,
            shortName: `Trường ${currentFields.length + 1}`,
            start: newStart,
            length: 1,
            type: 'dictionary',
            dictCategory: 'fruit_type',
            color: Object.keys(COLOR_THEMES)[currentFields.length % Object.keys(COLOR_THEMES).length]
        }

        const updated = {
            ...config,
            fields: [...currentFields, newField]
        }

        if (targetLine === 'line1') setFormLine1Config(updated)
        else setFormLine2Config(updated)
    }

    const handleUpdateField = (targetLine: 'line1' | 'line2', index: number, updates: Partial<StampFieldConfig>) => {
        const config = targetLine === 'line1' ? formLine1Config : formLine2Config
        const updatedFields = [...config.fields]
        updatedFields[index] = { ...updatedFields[index], ...updates }

        const updated = {
            ...config,
            fields: updatedFields
        }

        if (targetLine === 'line1') setFormLine1Config(updated)
        else setFormLine2Config(updated)
    }

    const handleRemoveField = (targetLine: 'line1' | 'line2', index: number) => {
        const config = targetLine === 'line1' ? formLine1Config : formLine2Config
        const updatedFields = config.fields.filter((_, idx) => idx !== index)

        const updated = {
            ...config,
            fields: updatedFields
        }

        if (targetLine === 'line1') setFormLine1Config(updated)
        else setFormLine2Config(updated)
    }

    // Auto align start positions of fields sequentially
    const handleAutoAlignFields = (targetLine: 'line1' | 'line2') => {
        const config = targetLine === 'line1' ? formLine1Config : formLine2Config
        let currentPos = 0
        const updatedFields = config.fields.map(f => {
            const start = currentPos
            currentPos += f.length
            return { ...f, start }
        })

        const updated = {
            ...config,
            fields: updatedFields
        }

        if (targetLine === 'line1') setFormLine1Config(updated)
        else setFormLine2Config(updated)
        showToast('Đã tự động tính toán lại vị trí nối tiếp liên tục cho các trường!', 'info')
    }

    // Render interactive visual format tape with sample string
    const renderVisualTape = (config: StampLineConfig, lineType: 'line1' | 'line2') => {
        const sample = config.sample || (lineType === 'line1' ? '102010204001-0' : '2120908092600166')
        const cleanSample = sample.trim().replace(/\s+/g, '')
        const hasDelim = config.has_delimiter
        const delimChar = config.delimiter_char || '-'

        const decodedPreview = config.fields.map(field => {
            let code = ''
            let prefix = ''

            if (field.afterDelimiter && hasDelim) {
                prefix = delimChar
                const delimIdx = cleanSample.indexOf(delimChar)
                if (delimIdx !== -1) {
                    code = cleanSample.substring(delimIdx + 1, delimIdx + 1 + field.length)
                } else if (cleanSample.length >= field.start + field.length) {
                    code = cleanSample.substring(field.start, field.start + field.length)
                }
            } else {
                if (cleanSample.length >= field.start + field.length) {
                    code = cleanSample.substring(field.start, field.start + field.length)
                }
            }

            let value = code ? `Mã ${code}` : 'Chưa nhập'
            if (code) {
                if (field.type === 'dictionary' && field.dictCategory) {
                    value = dictMap[field.dictCategory]?.[code] || `Mã ${code} (Chưa cấu hình)`
                } else if (field.type === 'supplier') {
                    const suppName = dictMap['supplier']?.[code]
                    value = suppName ? `${code} (${suppName})` : code
                } else if (field.type === 'date_ddmm' && code.length === 4) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}`
                } else if (field.type === 'date_ddmmyy' && code.length === 6) {
                    value = `${code.substring(0, 2)}/${code.substring(2, 4)}/20${code.substring(4, 6)}`
                } else if (field.type === 'raw') {
                    value = code
                }
            }

            const theme = COLOR_THEMES[field.color] || COLOR_THEMES.purple
            return {
                field,
                code: code || '?',
                prefix,
                value,
                theme
            }
        })

        return (
            <div className="p-3 rounded-2xl bg-slate-900 text-white border border-slate-700/80 space-y-2 shadow-lg transition-all">
                {/* Header Dãy số mẫu */}
                <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Sparkles size={14} className="text-amber-400 shrink-0" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                            Mô phỏng trực quan
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <input
                            type="text"
                            value={sample}
                            onChange={(e) => {
                                const val = e.target.value
                                if (lineType === 'line1') setFormLine1Config({ ...formLine1Config, sample: val })
                                else setFormLine2Config({ ...formLine2Config, sample: val })
                            }}
                            placeholder="Mẫu thử..."
                            className="px-2 py-0.5 text-xs font-mono font-bold rounded-lg bg-slate-800 border border-slate-700 text-amber-300 w-32 sm:w-36 outline-none focus:ring-1 focus:ring-purple-400 shadow-inner"
                            title="Chuỗi mẫu thử"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const defSample = lineType === 'line1' ? '102010204001-0' : '2120908092600166'
                                if (lineType === 'line1') setFormLine1Config({ ...formLine1Config, sample: defSample })
                                else setFormLine2Config({ ...formLine2Config, sample: defSample })
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-semibold cursor-pointer"
                            title="Khôi phục chuỗi mẫu mặc định"
                        >
                            Mặc định
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowTapeMeaning(!showTapeMeaning)}
                            className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold cursor-pointer transition-colors"
                            title={showTapeMeaning ? 'Ẩn bảng giải nghĩa' : 'Hiện bảng giải nghĩa'}
                        >
                            {showTapeMeaning ? 'Ẩn nghĩa' : 'Hiện nghĩa'}
                        </button>
                    </div>
                </div>

                {/* Tape phân đoạn trực quan */}
                <div className="space-y-1">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Chạm khối để cuộn tới trường:</span>
                        <span className="font-mono text-slate-400">
                            Độ dài: <strong className="text-white">{cleanSample.length}</strong> / {config.total_length} kt
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 w-full overflow-hidden">
                        {decodedPreview.map(({ field, code, prefix, value, theme }, idx) => (
                            <div key={idx} className="flex items-center gap-1 shrink-0">
                                {prefix && (
                                    <div className="flex flex-col items-center justify-center px-0.5 font-mono font-black text-slate-500 text-xs">
                                        <span>{prefix}</span>
                                        <span className="text-[7px] text-slate-600 uppercase">Dấu</span>
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-0.5">
                                    {/* Khối ô mã số cắt được - Nhấp vào để cuộn tới và mở trường */}
                                    <div 
                                        onClick={() => {
                                            setExpandedFields(prev => ({ ...prev, [`${lineType}_${idx}`]: true }))
                                            const el = document.getElementById(`field-card-${lineType}-${idx}`)
                                            if (el) {
                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                            }
                                        }}
                                        className="px-2 py-0.5 rounded-lg font-mono font-black text-xs border-2 shadow-xs flex flex-col items-center justify-center min-w-[34px] transition-all hover:scale-105 active:scale-95 cursor-pointer hover:shadow-md hover:ring-1 hover:ring-white/40"
                                        style={{
                                            borderColor: theme.hexPreview,
                                            backgroundColor: theme.hexPreview + '25',
                                            color: '#ffffff'
                                        }}
                                        title={`Nhấp để mở chi tiết & chỉnh sửa: ${field.shortName || field.name}`}
                                    >
                                        <span className="tracking-wider">{code}</span>
                                    </div>

                                    {/* Nhãn trường và chỉ số vị trí */}
                                    <span 
                                        className="text-[9px] font-black text-slate-200 text-center max-w-[62px] truncate"
                                        title={field.shortName || field.name}
                                    >
                                        {field.shortName || field.name}
                                    </span>
                                    <span className="text-[8px] font-mono font-bold text-slate-400 bg-slate-800/80 px-1 py-0.2 rounded border border-slate-700 whitespace-nowrap">
                                        kt {field.start}{field.length > 1 ? `..${field.start + field.length - 1}` : ''} ({field.length}kt)
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Kết quả giải mã tức thì từ dãy số tượng trưng */}
                {showTapeMeaning && (
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-1 animate-in fade-in duration-150">
                        <span className="text-[9px] font-bold text-indigo-300 block uppercase tracking-wider">
                            Ý nghĩa giải mã tương ứng:
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px]">
                            {decodedPreview.map(({ field, value, theme }, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: theme.hexPreview }} />
                                    <span className="text-slate-400">{field.shortName || field.name}:</span>
                                    <strong className="text-white font-bold">{value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* 1. Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0 mt-0.5">
                        <Stamp size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                                Cấu Hình Quy Tắc Dấu Đóng
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                {rules.length} quy tắc • {formats.length} khuôn định dạng
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                            Quản lý khuôn định dạng động và bộ từ điển giải mã dấu mực đóng trên thùng kraft. Toàn bộ thiết bị mobile sẽ tải quy tắc này từ server để giải mã linh hoạt offline mà không cần cập nhật mã nguồn ứng dụng.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <a
                        href="/tra-cuu-tem"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 transition-all shadow-xs cursor-pointer"
                        title="Mở cổng tra cứu tem công khai dành cho khách hàng & đối tác"
                    >
                        <ExternalLink size={15} />
                        <span>Cổng khách hàng</span>
                    </a>
                    <button
                        onClick={() => { fetchRules(); fetchFormats(); }}
                        disabled={isLoadingRules || isLoadingFormats}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw size={16} className={(isLoadingRules || isLoadingFormats) ? 'animate-spin' : ''} />
                    </button>
                    {mainTab === 'dictionaries' ? (
                        <button
                            onClick={() => handleOpenCreateRule()}
                            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-purple-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={16} />
                            Thêm quy tắc mã mới
                        </button>
                    ) : (
                        <button
                            onClick={() => handleOpenCreateFormat()}
                            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                            <Plus size={16} />
                            Tạo khuôn định dạng mới
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Live Simulator (Bộ Thử Nghiệm Giải Mã Động Dấu Đóng) */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-900/50 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-400" />
                            <h3 className="font-bold text-sm sm:text-base text-white">
                                Bộ Kiểm Tra & Thử Nghiệm Giải Mã Dấu Đóng (Live Engine)
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-indigo-200 font-semibold">Khuôn mẫu áp dụng:</label>
                            <select
                                value={activeFormatId}
                                onChange={(e) => handleSelectFormatForSimulator(e.target.value)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-indigo-700 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-purple-400"
                            >
                                {formats.map(fmt => (
                                    <option key={fmt.id} value={fmt.id}>
                                        {fmt.name} {fmt.is_default ? '★ (Mặc định)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Input Dòng 1 */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-200 flex items-center justify-between">
                                <span>{activeFormat?.line1_config?.title || 'Dòng 1: Phân cấp & Quy cách'} ({activeFormat?.line1_config?.total_length || 14} ký tự)</span>
                                {activeFormat?.line1_config?.sample && (
                                    <button 
                                        type="button"
                                        onClick={() => setSimLine1(activeFormat.line1_config.sample || '')}
                                        className="font-mono text-[10px] text-indigo-400 hover:text-amber-300 underline cursor-pointer"
                                    >
                                        Mẫu: {activeFormat.line1_config.sample}
                                    </button>
                                )}
                            </label>
                            <input
                                type="text"
                                value={simLine1}
                                onChange={(e) => setSimLine1(e.target.value)}
                                placeholder="Nhập dãy ký tự dòng 1..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-indigo-700/60 font-mono font-black text-sm tracking-wider text-amber-300 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner"
                            />
                            {/* Dãy số phân đoạn màu Dòng 1 */}
                            {decodedSimulation.l1Segments.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                                        <span>Phân đoạn mã tương ứng theo khuôn:</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-950/70 rounded-xl border border-indigo-900/60 shadow-inner">
                                        {decodedSimulation.l1Segments.map((seg: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-1">
                                                {seg.prefix && <span className="font-mono text-slate-500 font-bold px-0.5">{seg.prefix}</span>}
                                                <div className="flex flex-col items-center">
                                                    <span className={`px-2 py-0.5 rounded-lg font-mono font-black text-xs border shadow-sm ${seg.bgClass}`}>
                                                        {seg.code}
                                                    </span>
                                                    <span className="text-[9px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">{seg.shortLabel}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Dòng 2 */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-indigo-200 flex items-center justify-between">
                                <span>{activeFormat?.line2_config?.title || 'Dòng 2: Truy xuất & Nguồn gốc'} ({activeFormat?.line2_config?.total_length || 16} chữ số)</span>
                                {activeFormat?.line2_config?.sample && (
                                    <button 
                                        type="button"
                                        onClick={() => setSimLine2(activeFormat.line2_config.sample || '')}
                                        className="font-mono text-[10px] text-indigo-400 hover:text-emerald-300 underline cursor-pointer"
                                    >
                                        Mẫu: {activeFormat.line2_config.sample}
                                    </button>
                                )}
                            </label>
                            <input
                                type="text"
                                value={simLine2}
                                onChange={(e) => setSimLine2(e.target.value)}
                                placeholder="Nhập dãy ký tự dòng 2..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-indigo-700/60 font-mono font-black text-sm tracking-wider text-emerald-300 focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner"
                            />
                            {/* Dãy số phân đoạn màu Dòng 2 */}
                            {decodedSimulation.l2Segments.length > 0 && (
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                                        <span>Phân đoạn mã tương ứng theo khuôn:</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-950/70 rounded-xl border border-indigo-900/60 shadow-inner">
                                        {decodedSimulation.l2Segments.map((seg: any, idx: number) => (
                                            <div key={idx} className="flex flex-col items-center">
                                                <span className={`px-2 py-0.5 rounded-lg font-mono font-black text-xs border shadow-sm ${seg.bgClass}`}>
                                                    {seg.code}
                                                </span>
                                                <span className="text-[9px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">{seg.shortLabel}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Result Output với Nhãn mã & Màu sắc đồng bộ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Kết quả Dòng 1 */}
                        <div className="p-4 rounded-2xl bg-slate-800/70 border border-indigo-800/50 space-y-2.5 text-xs shadow-md">
                            <div className="font-bold text-amber-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                <span className="flex items-center gap-1.5">
                                    <Box size={14} /> KẾT QUẢ GIẢI MÃ DÒNG 1:
                                </span>
                                <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                            </div>
                            {decodedSimulation.l1Segments.length > 0 ? (
                                <div className="space-y-1.5">
                                    {decodedSimulation.l1Segments.map((seg: any, idx: number) => (
                                        <div 
                                            key={idx}
                                            className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                                        >
                                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.badgeClass}`}>
                                                {seg.code}
                                            </span>
                                            <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.label}:</span>
                                            <strong className={`text-xs font-bold truncate ${seg.textClass}`}>
                                                {seg.value}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 italic">Chưa có trường nào được cấu hình cho dòng 1.</p>
                            )}
                        </div>

                        {/* Kết quả Dòng 2 */}
                        <div className="p-4 rounded-2xl bg-slate-800/70 border border-indigo-800/50 space-y-2.5 text-xs shadow-md">
                            <div className="font-bold text-emerald-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                <span className="flex items-center gap-1.5">
                                    <Factory size={14} /> KẾT QUẢ GIẢI MÃ DÒNG 2:
                                </span>
                                <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                            </div>
                            {decodedSimulation.l2Segments.length > 0 ? (
                                <div className="space-y-1.5">
                                    {decodedSimulation.l2Segments.map((seg: any, idx: number) => (
                                        <div 
                                            key={idx}
                                            className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                                        >
                                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.badgeClass}`}>
                                                {seg.code}
                                            </span>
                                            <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.label}:</span>
                                            <strong className={`text-xs font-bold truncate ${seg.textClass}`}>
                                                {seg.value}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 italic">Chưa có trường nào được cấu hình cho dòng 2.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Main Switcher Tabs (Từ Điển vs Cấu Trúc Khuôn Định Dạng) */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMainTab('dictionaries')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                            mainTab === 'dictionaries'
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        <FileText size={16} />
                        <span>Từ Điển Quy Ước Mã ({rules.length})</span>
                    </button>
                    <button
                        onClick={() => setMainTab('formats')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                            mainTab === 'formats'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        <SlidersHorizontal size={16} />
                        <span>Khuôn Cấu Trúc Định Dạng Động ({formats.length})</span>
                    </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Smartphone size={15} className="text-emerald-500" />
                    <span>App mobile quét sẽ đồng bộ tự động cả từ điển và khuôn mẫu</span>
                </div>
            </div>

            {/* ========================================================= */}
            {/* TAB 1: TỪ ĐIỂN QUY ƯỚC MÃ (DICTIONARIES)                 */}
            {/* ========================================================= */}
            {mainTab === 'dictionaries' && (
                <div className="space-y-4">
                    {/* Toolbar & Filters */}
                    <div className="space-y-3">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            {/* Tabs Lọc theo Dòng 1 / Dòng 2 */}
                            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs shrink-0 self-start">
                                <button
                                    onClick={() => { setSelectedLine('all'); setSelectedCategory('all'); }}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                        selectedLine === 'all'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Tất cả ({rules.length})
                                </button>
                                <button
                                    onClick={() => { setSelectedLine('line1'); setSelectedCategory('all'); }}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                        selectedLine === 'line1'
                                            ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Dòng 1: Quy cách ({rules.filter(r => STAMP_CATEGORIES[r.category]?.line === 'line1').length})
                                </button>
                                <button
                                    onClick={() => { setSelectedLine('line2'); setSelectedCategory('all'); }}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                                        selectedLine === 'line2'
                                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Dòng 2: Nguồn gốc ({rules.filter(r => STAMP_CATEGORIES[r.category]?.line === 'line2').length})
                                </button>
                            </div>

                            {/* Tìm kiếm */}
                            <div className="relative flex-1 max-w-md">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm theo mã số quy ước, tên giải mã, mô tả..."
                                    className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-200 shadow-2xs"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Sub-pills: Lọc theo từng danh mục cụ thể */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all border cursor-pointer ${
                                    selectedCategory === 'all'
                                        ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                }`}
                            >
                                Tất cả danh mục
                            </button>
                            {Object.entries(STAMP_CATEGORIES)
                                .filter(([catKey, cat]) => selectedLine === 'all' || cat.line === selectedLine)
                                .map(([catKey, cat]) => {
                                    const count = rules.filter(r => r.category === catKey).length
                                    const isSelected = selectedCategory === catKey
                                    return (
                                        <button
                                            key={catKey}
                                            onClick={() => setSelectedCategory(catKey)}
                                            className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-purple-300'
                                            }`}
                                        >
                                            <span>{cat.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-purple-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {count}
                                            </span>
                                        </button>
                                    )
                                })}
                        </div>
                    </div>

                    {/* Table of Rules */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                        {isLoadingRules ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                <RefreshCw className="text-purple-600 animate-spin" size={32} />
                                <p className="text-xs font-semibold text-slate-500">Đang tải danh mục quy tắc...</p>
                            </div>
                        ) : filteredRules.length === 0 ? (
                            <div className="text-center py-16 px-4 space-y-3">
                                <AlertCircle className="text-slate-300 dark:text-slate-700 mx-auto" size={40} />
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Không tìm thấy quy tắc nào</h4>
                                <p className="text-xs text-slate-400">Không có quy tắc nào khớp với bộ lọc hoặc từ khóa tìm kiếm.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            <th className="px-4 py-3.5">Danh mục phân cấp</th>
                                            <th className="px-4 py-3.5">Vị trí ký tự</th>
                                            <th className="px-4 py-3.5 text-center">Ký hiệu / Mã</th>
                                            <th className="px-4 py-3.5">Diễn giải tiếng Việt</th>
                                            <th className="px-4 py-3.5">Mô tả chi tiết</th>
                                            <th className="px-4 py-3.5 text-center">Trạng thái</th>
                                            <th className="px-4 py-3.5 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150/70 dark:divide-slate-800/70">
                                        {filteredRules.map((rule) => {
                                            const catInfo = STAMP_CATEGORIES[rule.category]
                                            return (
                                                <tr 
                                                    key={rule.id}
                                                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                                                >
                                                    {/* Danh mục */}
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catInfo?.colorBadge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                            {catInfo?.label || rule.category}
                                                        </span>
                                                    </td>

                                                    {/* Vị trí */}
                                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                        {catInfo ? (
                                                            <span>
                                                                <strong className="text-slate-700 dark:text-slate-300">{catInfo.line === 'line1' ? 'Dòng 1' : 'Dòng 2'}</strong> • {catInfo.position}
                                                            </span>
                                                        ) : '---'}
                                                    </td>

                                                    {/* Ký hiệu / Mã */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                            {rule.code}
                                                        </span>
                                                    </td>

                                                    {/* Tên giải mã */}
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                            {rule.name}
                                                        </div>
                                                    </td>

                                                    {/* Mô tả */}
                                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                                        {rule.description || '---'}
                                                    </td>

                                                    {/* Trạng thái */}
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleToggleActiveRule(rule)}
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                                                rule.is_active
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                            }`}
                                                        >
                                                            {rule.is_active ? 'Kích hoạt' : 'Tạm ẩn'}
                                                        </button>
                                                    </td>

                                                    {/* Thao tác */}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                                                            <button
                                                                onClick={() => handleOpenEditRule(rule)}
                                                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition-colors cursor-pointer"
                                                                title="Chỉnh sửa"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRule(rule)}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: CẤU TRÚC ĐỊNH DẠNG ĐỘNG (FORMAT SCHEMAS)           */}
            {/* ========================================================= */}
            {mainTab === 'formats' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {formats.map((fmt) => {
                            const isDefault = fmt.is_default
                            const isSelected = fmt.id === activeFormatId
                            return (
                                <div 
                                    key={fmt.id}
                                    className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 sm:p-6 transition-all shadow-sm ${
                                        isDefault 
                                            ? 'border-indigo-500/60 ring-2 ring-indigo-500/20 shadow-md' 
                                            : 'border-slate-200 dark:border-slate-800'
                                    }`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                                                    {fmt.name}
                                                </h3>
                                                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {fmt.code}
                                                </span>
                                                {isDefault && (
                                                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                                        <Star size={12} className="fill-indigo-500 text-indigo-500" />
                                                        Mặc định App Mobile
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                        Đang dùng ở Live Simulator
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {fmt.description || 'Không có mô tả chi tiết.'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                            {!isDefault && (
                                                <button
                                                    onClick={() => handleSetDefaultFormat(fmt)}
                                                    className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                                >
                                                    <Star size={13} />
                                                    Đặt làm mặc định
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setActiveFormatId(fmt.id)
                                                    if (fmt.line1_config?.sample) setSimLine1(fmt.line1_config.sample)
                                                    if (fmt.line2_config?.sample) setSimLine2(fmt.line2_config.sample)
                                                    showToast(`Đã đưa khuôn "${fmt.name}" lên Live Simulator`, 'info')
                                                }}
                                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <Sparkles size={13} className="text-amber-500" />
                                                Thử nghiệm
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditFormat(fmt)}
                                                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                            >
                                                <Edit size={13} />
                                                Chỉnh sửa cấu trúc
                                            </button>
                                            {!isDefault && (
                                                <button
                                                    onClick={() => handleDeleteFormat(fmt)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                                                    title="Xóa khuôn này"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview sơ đồ các trường của Dòng 1 & Dòng 2 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                        {/* Line 1 breakdown */}
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                                <span className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                                                    <Box size={14} className="text-purple-600 dark:text-purple-400" />
                                                    {fmt.line1_config?.title || 'Dòng 1'}
                                                </span>
                                                <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/80 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-2xs">
                                                    Tổng {fmt.line1_config?.total_length || 14} ký tự {fmt.line1_config?.has_delimiter ? `(Dấu phân cách "${fmt.line1_config.delimiter_char || '-'}")` : ''}
                                                </span>
                                            </div>

                                            {/* Dãy số mẫu minh họa trực quan - TÔ MÀU TỪNG PHÂN ĐOẠN KHỐI */}
                                            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono flex-wrap shadow-inner">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 shrink-0 flex items-center gap-1">
                                                    <Sparkles size={12} className="text-amber-400" />
                                                    Mẫu số:
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-wrap font-mono font-black">
                                                    {(fmt.line1_config?.fields || []).map((f, i) => {
                                                        const theme = COLOR_THEMES[f.color] || COLOR_THEMES.purple
                                                        const sampleStr = (fmt.line1_config?.sample || '102010204001-0').trim().replace(/\s+/g, '')
                                                        const hasDelim = !!fmt.line1_config?.has_delimiter
                                                        const delimChar = fmt.line1_config?.delimiter_char || '-'
                                                        let sampleCode = ''
                                                        if (f.afterDelimiter && hasDelim) {
                                                            const dIdx = sampleStr.indexOf(delimChar)
                                                            if (dIdx !== -1) {
                                                                sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                            }
                                                        } else {
                                                            sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                        }
                                                        return (
                                                            <React.Fragment key={i}>
                                                                {f.afterDelimiter && hasDelim && (
                                                                    <span className="px-0.5 text-slate-500 font-black text-xs">{delimChar}</span>
                                                                )}
                                                                <span
                                                                    className="px-2 py-0.5 rounded-lg text-xs font-black tracking-wider transition-all hover:scale-110 shadow-xs"
                                                                    style={{
                                                                        backgroundColor: theme.hexPreview + '30',
                                                                        color: '#ffffff',
                                                                        border: `1.5px solid ${theme.hexPreview}`
                                                                    }}
                                                                    title={`${f.shortName || f.name} (${f.length}kt)`}
                                                                >
                                                                    {sampleCode || '?'}
                                                                </span>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {(fmt.line1_config?.fields || []).map((f, i) => {
                                                    const theme = COLOR_THEMES[f.color] || COLOR_THEMES.purple
                                                    const sampleStr = (fmt.line1_config?.sample || '102010204001-0').trim().replace(/\s+/g, '')
                                                    const hasDelim = !!fmt.line1_config?.has_delimiter
                                                    const delimChar = fmt.line1_config?.delimiter_char || '-'
                                                    let sampleCode = ''
                                                    if (f.afterDelimiter && hasDelim) {
                                                        const dIdx = sampleStr.indexOf(delimChar)
                                                        if (dIdx !== -1) {
                                                            sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                        }
                                                    } else {
                                                        sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                    }
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 transition-transform hover:scale-105 shadow-2xs ${theme.cardBadge}`}
                                                            title={`Mã mẫu: ${sampleCode || '?'} | Vị trí: kt ${f.start}..${f.start + f.length - 1}`}
                                                        >
                                                            {/* Ô số mẫu nhỏ tô màu nổi bật theo đúng màu trường */}
                                                            <span 
                                                                className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded-md shadow-2xs text-white"
                                                                style={{ backgroundColor: theme.hexPreview }}
                                                            >
                                                                {f.afterDelimiter && hasDelim ? `${delimChar}${sampleCode || '?'}` : (sampleCode || '?')}
                                                            </span>
                                                            <span>{f.shortName || f.name}</span>
                                                            <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                {f.length}kt
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Line 2 breakdown */}
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                                                <span className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                                                    <Factory size={14} className="text-indigo-600 dark:text-indigo-400" />
                                                    {fmt.line2_config?.title || 'Dòng 2'}
                                                </span>
                                                <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/80 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-2xs">
                                                    Tổng {fmt.line2_config?.total_length || 16} chữ số {fmt.line2_config?.has_delimiter ? `(Dấu phân cách "${fmt.line2_config.delimiter_char || '-'}")` : ''}
                                                </span>
                                            </div>

                                            {/* Dãy số mẫu minh họa trực quan - TÔ MÀU TỪNG PHÂN ĐOẠN KHỐI */}
                                            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono flex-wrap shadow-inner">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 shrink-0 flex items-center gap-1">
                                                    <Sparkles size={12} className="text-amber-400" />
                                                    Mẫu số:
                                                </span>
                                                <div className="flex items-center gap-1.5 flex-wrap font-mono font-black">
                                                    {(fmt.line2_config?.fields || []).map((f, i) => {
                                                        const theme = COLOR_THEMES[f.color] || COLOR_THEMES.blue
                                                        const sampleStr = (fmt.line2_config?.sample || '2120908092600166').trim().replace(/\s+/g, '')
                                                        const hasDelim = !!fmt.line2_config?.has_delimiter
                                                        const delimChar = fmt.line2_config?.delimiter_char || '-'
                                                        let sampleCode = ''
                                                        if (f.afterDelimiter && hasDelim) {
                                                            const dIdx = sampleStr.indexOf(delimChar)
                                                            if (dIdx !== -1) {
                                                                sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                            }
                                                        } else {
                                                            sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                        }
                                                        return (
                                                            <React.Fragment key={i}>
                                                                {f.afterDelimiter && hasDelim && (
                                                                    <span className="px-0.5 text-slate-500 font-black text-xs">{delimChar}</span>
                                                                )}
                                                                <span
                                                                    className="px-2 py-0.5 rounded-lg text-xs font-black tracking-wider transition-all hover:scale-110 shadow-xs"
                                                                    style={{
                                                                        backgroundColor: theme.hexPreview + '30',
                                                                        color: '#ffffff',
                                                                        border: `1.5px solid ${theme.hexPreview}`
                                                                    }}
                                                                    title={`${f.shortName || f.name} (${f.length}kt)`}
                                                                >
                                                                    {sampleCode || '?'}
                                                                </span>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {(fmt.line2_config?.fields || []).map((f, i) => {
                                                    const theme = COLOR_THEMES[f.color] || COLOR_THEMES.blue
                                                    const sampleStr = (fmt.line2_config?.sample || '2120908092600166').trim().replace(/\s+/g, '')
                                                    const hasDelim = !!fmt.line2_config?.has_delimiter
                                                    const delimChar = fmt.line2_config?.delimiter_char || '-'
                                                    let sampleCode = ''
                                                    if (f.afterDelimiter && hasDelim) {
                                                        const dIdx = sampleStr.indexOf(delimChar)
                                                        if (dIdx !== -1) {
                                                            sampleCode = sampleStr.substring(dIdx + 1, dIdx + 1 + f.length)
                                                        }
                                                    } else {
                                                        sampleCode = sampleStr.substring(f.start, f.start + f.length)
                                                    }
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 transition-transform hover:scale-105 shadow-2xs ${theme.cardBadge}`}
                                                            title={`Mã mẫu: ${sampleCode || '?'} | Vị trí: kt ${f.start}..${f.start + f.length - 1}`}
                                                        >
                                                            {/* Ô số mẫu nhỏ tô màu nổi bật theo đúng màu trường */}
                                                            <span 
                                                                className="font-mono text-[11px] font-black px-1.5 py-0.5 rounded-md shadow-2xs text-white"
                                                                style={{ backgroundColor: theme.hexPreview }}
                                                            >
                                                                {f.afterDelimiter && hasDelim ? `${delimChar}${sampleCode || '?'}` : (sampleCode || '?')}
                                                            </span>
                                                            <span>{f.shortName || f.name}</span>
                                                            <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                {f.length}kt
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 4. MODAL: TẠO / SỬA KHUÔN ĐỊNH DẠNG ĐỘNG (FORMAT BUILDER) */}
            {/* ========================================================= */}
            {isFormatModalOpen && (
                <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-150 ${isFormatModalFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
                    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden transition-all ${
                        isFormatModalFullscreen 
                            ? 'w-full h-full rounded-none' 
                            : 'w-full max-w-7xl h-[94vh] max-h-[94vh] rounded-3xl'
                    }`}>
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-150 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                                    <SlidersHorizontal size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                                        {editingFormat ? 'Chỉnh Sửa Khuôn Định Dạng Dấu Đóng' : 'Tạo Mới Khuôn Định Dạng Dấu Đóng'}
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                        Bảng thiết kế trực quan chia 2 cột: Live Inspector xem trước bên trái & tùy chỉnh trường bên phải
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setIsFormatModalFullscreen(!isFormatModalFullscreen)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title={isFormatModalFullscreen ? "Thu nhỏ cửa sổ" : "Phóng to toàn màn hình"}
                                >
                                    {isFormatModalFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button
                                    onClick={() => setIsFormatModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Subtabs in modal: Cấu hình chung vs Dòng 1 vs Dòng 2 */}
                        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                            <button
                                type="button"
                                onClick={() => setFormatSubTab('line1')}
                                className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                                    formatSubTab === 'line1'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Cấu trúc Dòng 1 ({formLine1Config.fields.length} trường)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormatSubTab('line2')}
                                className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                                    formatSubTab === 'line2'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Cấu trúc Dòng 2 ({formLine2Config.fields.length} trường)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormatSubTab('general')}
                                className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                                    formatSubTab === 'general'
                                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                }`}
                            >
                                Thông tin chung
                            </button>
                        </div>

                        {/* Body Modal */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* TAB: CẤU HÌNH DÒNG 1 */}
                            {formatSubTab === 'line1' && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                    {/* CỘT TRÁI: Dải băng quan sát trực quan & Cài đặt chung Dòng 1 (Rộng 5/12 để hiển thị trọn vẹn, không cuộn ngang) */}
                                    <div className="lg:col-span-5 xl:col-span-5 space-y-3 lg:sticky lg:top-0">
                                        {renderVisualTape(formLine1Config, 'line1')}

                                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5 shadow-xs">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                                    <Settings size={13} />
                                                    Cài đặt quy cách Dòng 1
                                                </h5>
                                                <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900">
                                                    Tổng {formLine1Config.total_length} ký tự
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="space-y-0.5">
                                                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tên định danh dòng</label>
                                                    <input
                                                        type="text"
                                                        value={formLine1Config.title}
                                                        onChange={(e) => setFormLine1Config({ ...formLine1Config, title: e.target.value })}
                                                        className="w-full px-2.5 py-1 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tổng độ dài (kt)</label>
                                                        <input
                                                            type="number"
                                                            value={formLine1Config.total_length}
                                                            onChange={(e) => setFormLine1Config({ ...formLine1Config, total_length: parseInt(e.target.value, 10) || 0 })}
                                                            className="w-full px-2.5 py-1 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                            <span>Dấu ngăn cách</span>
                                                            <span className="text-[9px] text-slate-400 font-normal">(-)</span>
                                                        </label>
                                                        <div className="flex items-center gap-1.5 pt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                id="chk_has_delim"
                                                                checked={!!formLine1Config.has_delimiter}
                                                                onChange={(e) => setFormLine1Config({ ...formLine1Config, has_delimiter: e.target.checked })}
                                                                className="rounded text-indigo-600 cursor-pointer"
                                                            />
                                                            <label htmlFor="chk_has_delim" className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer">Bật</label>
                                                            <input
                                                                type="text"
                                                                value={formLine1Config.delimiter_char || '-'}
                                                                onChange={(e) => setFormLine1Config({ ...formLine1Config, delimiter_char: e.target.value })}
                                                                className="w-9 px-1.5 py-0.5 text-center font-mono font-black rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 text-xs shadow-xs"
                                                                maxLength={1}
                                                                title="Ký tự dấu ngăn cách (mặc định là dấu -)"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CỘT PHẢI: Danh sách các phân đoạn mã để chỉnh sửa (7/12) */}
                                    <div className="lg:col-span-7 xl:col-span-7 space-y-3">
                                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                                    Danh sách các phân đoạn mã ({formLine1Config.fields.length} trường)
                                                </h4>
                                                <p className="text-[11px] text-slate-400">
                                                    Bấm vào từng trường để mở rộng / thu gọn chi tiết cài đặt
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllFields('line1', formLine1Config.fields.length)}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    {formLine1Config.fields.some((_, i) => expandedFields[`line1_${i}`]) ? (
                                                        <>
                                                            <ChevronUp size={13} />
                                                            Thu gọn tất cả
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown size={13} />
                                                            Mở rộng tất cả
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAutoAlignFields('line1')}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                    title="Tự động tính toán lại start = vị trí liền kề của trường trước"
                                                >
                                                    <ListOrdered size={13} />
                                                    Nối tiếp vị trí
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddField('line1')}
                                                    className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shadow-xs"
                                                >
                                                    <Plus size={13} /> Thêm trường
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {formLine1Config.fields.map((field, idx) => {
                                                const isExpanded = !!expandedFields[`line1_${idx}`]
                                                const theme = COLOR_THEMES[field.color] || COLOR_THEMES.purple
                                                return (
                                                    <div 
                                                        id={`field-card-line1-${idx}`}
                                                        key={idx}
                                                        className={`rounded-2xl border transition-all ${
                                                            isExpanded 
                                                                ? 'bg-white dark:bg-slate-800 border-indigo-400 dark:border-indigo-600 shadow-sm ring-1 ring-indigo-500/20' 
                                                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                                                        }`}
                                                    >
                                                        {/* Thanh tóm tắt gọn gàng - Click để sổ ra / đóng lại */}
                                                        <div 
                                                            onClick={() => toggleFieldExpand('line1', idx)}
                                                            className="flex items-center justify-between p-3 cursor-pointer select-none gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors rounded-2xl"
                                                        >
                                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-mono text-[11px] font-black text-slate-700 dark:text-slate-300 shrink-0">
                                                                    {idx + 1}
                                                                </span>

                                                                {/* Badge màu trực quan */}
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 shrink-0 ${theme.cardBadge}`}>
                                                                    <span>{field.shortName || field.name}</span>
                                                                    <span className={`font-mono text-[10px] font-black px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                        {field.length}kt
                                                                    </span>
                                                                </span>

                                                                {/* Tên trường & vị trí */}
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                                        {field.name}
                                                                    </span>
                                                                    <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono font-medium whitespace-nowrap">
                                                                        (kt: {field.start}..{field.start + field.length - 1})
                                                                    </span>
                                                                    {field.afterDelimiter && (
                                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                                                            Sau dấu {formLine1Config.delimiter_char || '-'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Nút thao tác nhanh & mũi tên sổ xuống */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="hidden md:inline-flex text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                    {STAMP_CATEGORIES[field.dictCategory]?.label || field.dictCategory || 'Từ điển'}
                                                                </span>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleRemoveField('line1', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                                                    title="Xóa trường này"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); toggleFieldExpand('line1', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Khung chi tiết cài đặt - Chỉ mở ra khi bấm vào */}
                                                        {isExpanded && (
                                                            <div className="p-4 border-t border-slate-150 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 space-y-3.5 animate-in fade-in duration-150 rounded-b-2xl">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên trường đầy đủ</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.name}
                                                                            onChange={(e) => handleUpdateField('line1', idx, { name: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Chủng loại trái cây"
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên ngắn gọn (Nhãn thẻ)</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.shortName}
                                                                            onChange={(e) => handleUpdateField('line1', idx, { shortName: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Chủng loại"
                                                                        />
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vị trí (start)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.start}
                                                                                onChange={(e) => handleUpdateField('line1', idx, { start: parseInt(e.target.value, 10) || 0 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={0}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Độ dài (len)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.length}
                                                                                onChange={(e) => handleUpdateField('line1', idx, { length: parseInt(e.target.value, 10) || 1 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={1}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Từ điển liên kết</label>
                                                                        <select
                                                                            value={field.dictCategory || 'fruit_type'}
                                                                            onChange={(e) => handleUpdateField('line1', idx, { dictCategory: e.target.value, type: 'dictionary' })}
                                                                            className="w-full px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                        >
                                                                            {Object.entries(STAMP_CATEGORIES).map(([catK, catV]) => (
                                                                                <option key={catK} value={catK}>{catV.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                                                    {/* Chọn màu sắc thẻ */}
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Màu sắc thẻ:</label>
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            {Object.entries(COLOR_THEMES).map(([cKey, cVal]) => (
                                                                                <button
                                                                                    key={cKey}
                                                                                    type="button"
                                                                                    onClick={() => handleUpdateField('line1', idx, { color: cKey })}
                                                                                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${field.color === cKey ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                                                                    style={{ backgroundColor: cVal.hexPreview, borderColor: cVal.hexPreview }}
                                                                                    title={cVal.label}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Tùy chọn Nằm sau dấu ngăn cách */}
                                                                    {formLine1Config.has_delimiter && (
                                                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!field.afterDelimiter}
                                                                                onChange={(e) => handleUpdateField('line1', idx, { afterDelimiter: e.target.checked })}
                                                                                className="rounded text-amber-600 cursor-pointer"
                                                                            />
                                                                            <span className="text-[11px] text-amber-800 dark:text-amber-300">
                                                                                Nằm sau dấu ({formLine1Config.delimiter_char || '-'})
                                                                            </span>
                                                                        </label>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleFieldExpand('line1', idx)}
                                                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                                                                    >
                                                                        <span>Thu gọn</span>
                                                                        <ChevronUp size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: CẤU HÌNH DÒNG 2 */}
                            {formatSubTab === 'line2' && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                    {/* CỘT TRÁI: Dải băng quan sát trực quan & Cài đặt chung Dòng 2 (Rộng 5/12 để hiển thị trọn vẹn, không cuộn ngang) */}
                                    <div className="lg:col-span-5 xl:col-span-5 space-y-3 lg:sticky lg:top-0">
                                        {renderVisualTape(formLine2Config, 'line2')}

                                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5 shadow-xs">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                                    <Settings size={13} />
                                                    Cài đặt quy cách Dòng 2
                                                </h5>
                                                <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900">
                                                    Tổng {formLine2Config.total_length} chữ số
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="space-y-0.5">
                                                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tên định danh dòng</label>
                                                    <input
                                                        type="text"
                                                        value={formLine2Config.title}
                                                        onChange={(e) => setFormLine2Config({ ...formLine2Config, title: e.target.value })}
                                                        className="w-full px-2.5 py-1 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Tổng độ dài (kt)</label>
                                                        <input
                                                            type="number"
                                                            value={formLine2Config.total_length}
                                                            onChange={(e) => setFormLine2Config({ ...formLine2Config, total_length: parseInt(e.target.value, 10) || 0 })}
                                                            className="w-full px-2.5 py-1 rounded-xl text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                            <span>Dấu ngăn cách</span>
                                                            <span className="text-[9px] text-slate-400 font-normal">(-)</span>
                                                        </label>
                                                        <div className="flex items-center gap-1.5 pt-0.5">
                                                            <input
                                                                type="checkbox"
                                                                id="chk_has_delim_line2"
                                                                checked={!!formLine2Config.has_delimiter}
                                                                onChange={(e) => setFormLine2Config({ ...formLine2Config, has_delimiter: e.target.checked })}
                                                                className="rounded text-indigo-600 cursor-pointer"
                                                            />
                                                            <label htmlFor="chk_has_delim_line2" className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer">Bật</label>
                                                            <input
                                                                type="text"
                                                                value={formLine2Config.delimiter_char || '-'}
                                                                onChange={(e) => setFormLine2Config({ ...formLine2Config, delimiter_char: e.target.value })}
                                                                className="w-9 px-1.5 py-0.5 text-center font-mono font-black rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 text-xs shadow-xs"
                                                                maxLength={1}
                                                                title="Ký tự dấu ngăn cách (mặc định là dấu -)"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CỘT PHẢI: Danh sách các phân đoạn mã Dòng 2 để chỉnh sửa (7/12) */}
                                    <div className="lg:col-span-7 xl:col-span-7 space-y-3">
                                        <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                                            <div>
                                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                                    Danh sách các phân đoạn mã Dòng 2 ({formLine2Config.fields.length} trường)
                                                </h4>
                                                <p className="text-[11px] text-slate-400">
                                                    Bấm vào từng trường để mở rộng / thu gọn chi tiết cài đặt
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllFields('line2', formLine2Config.fields.length)}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    {formLine2Config.fields.some((_, i) => expandedFields[`line2_${i}`]) ? (
                                                        <>
                                                            <ChevronUp size={13} />
                                                            Thu gọn tất cả
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown size={13} />
                                                            Mở rộng tất cả
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAutoAlignFields('line2')}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                    title="Tự động tính toán lại start = vị trí liền kề của trường trước"
                                                >
                                                    <ListOrdered size={13} />
                                                    Nối tiếp vị trí
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddField('line2')}
                                                    className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer shadow-xs"
                                                >
                                                    <Plus size={13} /> Thêm trường
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {formLine2Config.fields.map((field, idx) => {
                                                const isExpanded = !!expandedFields[`line2_${idx}`]
                                                const theme = COLOR_THEMES[field.color] || COLOR_THEMES.blue
                                                const typeLabel = 
                                                    field.type === 'supplier' ? 'Nhà cung cấp (NCC)' :
                                                    field.type === 'date_ddmm' ? 'Ngày (DD/MM)' :
                                                    field.type === 'date_ddmmyy' ? 'Ngày (DD/MM/YY)' :
                                                    field.type === 'raw' ? 'Văn bản thô' : 'Từ điển'

                                                return (
                                                    <div 
                                                        id={`field-card-line2-${idx}`}
                                                        key={idx}
                                                        className={`rounded-2xl border transition-all ${
                                                            isExpanded 
                                                                ? 'bg-white dark:bg-slate-800 border-indigo-400 dark:border-indigo-600 shadow-sm ring-1 ring-indigo-500/20' 
                                                                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                                                        }`}
                                                    >
                                                        {/* Thanh tóm tắt gọn gàng - Click để sổ ra / đóng lại */}
                                                        <div 
                                                            onClick={() => toggleFieldExpand('line2', idx)}
                                                            className="flex items-center justify-between p-3 cursor-pointer select-none gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors rounded-2xl"
                                                        >
                                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-mono text-[11px] font-black text-slate-700 dark:text-slate-300 shrink-0">
                                                                    {idx + 1}
                                                                </span>

                                                                {/* Badge màu trực quan */}
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 shrink-0 ${theme.cardBadge}`}>
                                                                    <span>{field.shortName || field.name}</span>
                                                                    <span className={`font-mono text-[10px] font-black px-1.5 py-0.2 rounded-md ${theme.cardPill}`}>
                                                                        {field.length}kt
                                                                    </span>
                                                                </span>

                                                                {/* Tên trường & vị trí */}
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                                        {field.name}
                                                                    </span>
                                                                    <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono font-medium whitespace-nowrap">
                                                                        (kt: {field.start}..{field.start + field.length - 1})
                                                                    </span>
                                                                    {field.afterDelimiter && (
                                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                                                            Sau dấu {formLine2Config.delimiter_char || '-'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Nút thao tác nhanh & mũi tên sổ xuống */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="hidden md:inline-flex text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                    {typeLabel}
                                                                </span>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleRemoveField('line2', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                                                                    title="Xóa trường này"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); toggleFieldExpand('line2', idx); }}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Khung chi tiết cài đặt - Chỉ mở ra khi bấm vào */}
                                                        {isExpanded && (
                                                            <div className="p-4 border-t border-slate-150 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 space-y-3.5 animate-in fade-in duration-150 rounded-b-2xl">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên trường đầy đủ</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.name}
                                                                            onChange={(e) => handleUpdateField('line2', idx, { name: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Nhà máy chế biến"
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tên ngắn gọn (Nhãn thẻ)</label>
                                                                        <input
                                                                            type="text"
                                                                            value={field.shortName}
                                                                            onChange={(e) => handleUpdateField('line2', idx, { shortName: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                            placeholder="vd: Nhà máy"
                                                                        />
                                                                    </div>

                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Vị trí (start)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.start}
                                                                                onChange={(e) => handleUpdateField('line2', idx, { start: parseInt(e.target.value, 10) || 0 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={0}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Độ dài (len)</label>
                                                                            <input
                                                                                type="number"
                                                                                value={field.length}
                                                                                onChange={(e) => handleUpdateField('line2', idx, { length: parseInt(e.target.value, 10) || 1 })}
                                                                                className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                                min={1}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Kiểu phân giải</label>
                                                                        <select
                                                                            value={field.type}
                                                                            onChange={(e) => handleUpdateField('line2', idx, { type: e.target.value })}
                                                                            className="w-full px-3 py-1.5 text-xs font-medium rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                                                        >
                                                                            <option value="dictionary">Tra từ điển quy ước</option>
                                                                            <option value="supplier">Mã nhà cung cấp (NCC)</option>
                                                                            <option value="date_ddmm">Ngày tháng (DD/MM)</option>
                                                                            <option value="date_ddmmyy">Ngày tháng năm (DD/MM/YY)</option>
                                                                            <option value="raw">Văn bản thô (giữ nguyên)</option>
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                                                    {/* Danh mục từ điển (nếu kiểu từ điển) & Màu sắc thẻ */}
                                                                    <div className="flex items-center gap-4 flex-wrap">
                                                                        {(field.type === 'dictionary' || field.type === 'supplier') && (
                                                                            <div className="flex items-center gap-2">
                                                                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Từ điển:</label>
                                                                                <select
                                                                                    value={field.dictCategory || 'factory'}
                                                                                    onChange={(e) => handleUpdateField('line2', idx, { dictCategory: e.target.value })}
                                                                                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                                                                >
                                                                                    {Object.entries(STAMP_CATEGORIES).map(([catK, catV]) => (
                                                                                        <option key={catK} value={catK}>{catV.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex items-center gap-2">
                                                                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Màu sắc:</label>
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                {Object.entries(COLOR_THEMES).map(([cKey, cVal]) => (
                                                                                    <button
                                                                                        key={cKey}
                                                                                        type="button"
                                                                                        onClick={() => handleUpdateField('line2', idx, { color: cKey })}
                                                                                        className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${field.color === cKey ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                                                                        style={{ backgroundColor: cVal.hexPreview, borderColor: cVal.hexPreview }}
                                                                                        title={cVal.label}
                                                                                    />
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Tùy chọn Nằm sau dấu ngăn cách */}
                                                                    {formLine2Config.has_delimiter && (
                                                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!field.afterDelimiter}
                                                                                onChange={(e) => handleUpdateField('line2', idx, { afterDelimiter: e.target.checked })}
                                                                                className="rounded text-amber-600 cursor-pointer"
                                                                            />
                                                                            <span className="text-[11px] text-amber-800 dark:text-amber-300">
                                                                                Nằm sau dấu ({formLine2Config.delimiter_char || '-'})
                                                                            </span>
                                                                        </label>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleFieldExpand('line2', idx)}
                                                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                                                                    >
                                                                        <span>Thu gọn</span>
                                                                        <ChevronUp size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: THÔNG TIN CHUNG */}
                            {formatSubTab === 'general' && (
                                <div className="space-y-4 max-w-xl">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Mã định danh khuôn <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formFmtCode}
                                            onChange={(e) => setFormFmtCode(e.target.value.toUpperCase())}
                                            placeholder="vd: DEFAULT_FROZEN_STAMP"
                                            required
                                            className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Tên khuôn định dạng <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formFmtName}
                                            onChange={(e) => setFormFmtName(e.target.value)}
                                            placeholder="vd: Tiêu chuẩn Dấu đóng Thùng Cấp đông"
                                            required
                                            className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            Mô tả chi tiết / Tiêu chuẩn đóng dấu
                                        </label>
                                        <textarea
                                            value={formFmtDesc}
                                            onChange={(e) => setFormFmtDesc(e.target.value)}
                                            placeholder="Ghi chú về văn bản ban hành hoặc các phân xưởng áp dụng..."
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <input
                                            type="checkbox"
                                            id="fmt_chk_default"
                                            checked={formFmtIsDefault}
                                            onChange={(e) => setFormFmtIsDefault(e.target.checked)}
                                            className="rounded"
                                        />
                                        <label htmlFor="fmt_chk_default" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                            Đặt làm khuôn mặc định của hệ thống (Tất cả điện thoại quét sẽ áp dụng khuôn này)
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="flex items-center justify-between p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                            <span className="text-[11px] text-slate-500">
                                Khi lưu, khuôn mới sẽ được đồng bộ ngay lập tức tới mọi thiết bị di động
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFormatModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveFormat}
                                    disabled={isSavingFormat}
                                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingFormat ? (
                                        <>
                                            <RefreshCw size={13} className="animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            Lưu cấu trúc khuôn
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 5. MODAL: THÊM / CHỈNH SỬA TỪ ĐIỂN QUY TẮC MÃ           */}
            {/* ========================================================= */}
            {isRuleModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
                            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                                <Stamp size={18} className="text-purple-600" />
                                {editingRule ? 'Chỉnh Sửa Quy Tắc Dấu Đóng' : 'Thêm Mới Quy Tắc Dấu Đóng'}
                            </h3>
                            <button
                                onClick={() => setIsRuleModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRule} className="space-y-4">
                            {/* Chọn Danh mục */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Danh mục phân cấp <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formCategory}
                                    onChange={(e) => setFormCategory(e.target.value)}
                                    disabled={!!editingRule}
                                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {Object.entries(STAMP_CATEGORIES).map(([key, cat]) => (
                                        <option key={key} value={key}>
                                            [{cat.line === 'line1' ? 'Dòng 1' : 'Dòng 2'}] {cat.label} ({cat.position})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400">
                                    {STAMP_CATEGORIES[formCategory]?.description}
                                </p>
                            </div>

                            {/* Mã quy ước & Tên giải mã */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Mã số <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formCode}
                                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                        placeholder="vd: 01, 001"
                                        required
                                        className="w-full px-3 py-2 rounded-xl text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <span className="text-[10px] text-slate-400">
                                        Độ dài: {STAMP_CATEGORIES[formCategory]?.length}
                                    </span>
                                </div>

                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        Tên / Diễn giải tiếng Việt <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="vd: Cấp đông múi, Monthong..."
                                        required
                                        className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Mô tả chi tiết */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Mô tả thêm / Tiêu chuẩn áp dụng (Tùy chọn)
                                </label>
                                <textarea
                                    value={formDesc}
                                    onChange={(e) => setFormDesc(e.target.value)}
                                    placeholder="Ghi chú thêm về tiêu chuẩn hoặc văn bản quy định..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* Thứ tự sắp xếp */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Thứ tự hiển thị
                                </label>
                                <input
                                    type="number"
                                    value={formSortOrder}
                                    onChange={(e) => setFormSortOrder(e.target.value)}
                                    min="0"
                                    className="w-24 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsRuleModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingRule}
                                    className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {isSavingRule ? (
                                        <>
                                            <RefreshCw size={12} className="animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            {editingRule ? 'Lưu cập nhật' : 'Thêm quy tắc'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
