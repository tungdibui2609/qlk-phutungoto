// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
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

import {
    type StampRule,
    type StampFieldConfig,
    type StampLineConfig,
    type StampFormat,
    COLOR_THEMES,
    STAMP_CATEGORIES,
} from './_components/constants'
import { StampLiveSimulator } from './_components/StampLiveSimulator'
import { StampDictionariesTab } from './_components/StampDictionariesTab'
import { StampFormatSchemasTab } from './_components/StampFormatSchemasTab'
import { FormatBuilderModal } from './_components/FormatBuilderModal'
import { DictionaryRuleModal } from './_components/DictionaryRuleModal'

export type { StampRule, StampFieldConfig, StampLineConfig, StampFormat }
export { COLOR_THEMES, STAMP_CATEGORIES }

export default function StampRulesPage() {
    const { showToast } = useToast()
    const { hasModule } = useSystem()

    if (!hasModule('stamp_rules')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 m-6">
                <div className="w-20 h-20 bg-slate-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-6">
                    <Stamp size={40} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                    Cấu hình Dấu Đóng
                </h2>
                <p className="text-stone-500 max-w-md">
                    Module "Cấu hình Dấu Đóng" chưa được kích hoạt cho kho này.
                    Vui lòng vào Cài đặt {'>'} Phân hệ để kích hoạt.
                </p>
            </div>
        )
    }

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
    const [showTechnicalL1, setShowTechnicalL1] = useState(false)

    // Modal Create / Edit Rule states
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<StampRule | null>(null)
    const [formCategory, setFormCategory] = useState<string>('fruit_type')
    const [formCode, setFormCode] = useState('')
    const [formName, setFormName] = useState('')
    const [formDesc, setFormDesc] = useState('')
    const [formProductSku, setFormProductSku] = useState('')
    const [formSortOrder, setFormSortOrder] = useState('1')
    const [isSavingRule, setIsSavingRule] = useState(false)
    const [warehouseProducts, setWarehouseProducts] = useState<{ id: string; sku: string; name: string }[]>([])

    // Load danh sách sản phẩm kho để người dùng chọn nhanh SKU khi tạo/sửa quy tắc ngoại lệ 12 số
    useEffect(() => {
        supabase
            .from('products')
            .select('id, sku, name')
            .order('sku', { ascending: true })
            .then(({ data }) => {
                if (data) setWarehouseProducts(data)
            })
    }, [])

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

        // Kiểm tra trường hợp ngoại lệ ưu tiên (12 ký tự đầu tiên)
        const digitsOnlyL1 = clean1.replace(/[^0-9]/g, '')
        const code12 = digitsOnlyL1.length >= 12 ? digitsOnlyL1.substring(0, 12) : null
        const special12Name = code12 ? dictMap['special_12']?.[code12] : null
        const special12Match = (code12 && special12Name) ? {
            code: code12,
            name: special12Name
        } : null

        return { l1Segments, l2Segments, special12Match }
    }, [activeFormat, simLine1, simLine2, dictMap])

    // Open Modal Create Rule
    const handleOpenCreateRule = (categoryKey?: string) => {
        setEditingRule(null)
        setFormCategory(categoryKey || selectedCategory !== 'all' ? selectedCategory : 'fruit_type')
        setFormCode('')
        setFormName('')
        setFormDesc('')
        setFormProductSku('')
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
        setFormProductSku(rule.product_sku || '')
        setFormSortOrder(String(rule.sort_order || 1))
        setIsRuleModalOpen(true)
    }

    // Save Rule (Insert or Update)
    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formCode.trim() || !formName.trim()) {
            showToast('Vui lòng nhập đầy đủ mã và tên', 'warning')
            return
        }

        setIsSavingRule(true)
        try {
            const payload: any = {
                category: formCategory,
                code: formCode.trim().toUpperCase(),
                name: formName.trim(),
                description: formDesc.trim() || null,
                product_sku: formProductSku.trim().toUpperCase() || null,
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

            // Tự động đồng bộ sang bảng production_places nếu là Mã nhà máy (factory)
            if (formCategory === 'factory') {
                try {
                    const normCode = formCode.trim()
                    const paddedCode = normCode.padStart(2, '0')
                    const { data: existingPlaces } = await supabase
                        .from('production_places')
                        .select('id, code, name')

                    const match = existingPlaces?.find((p: any) => 
                        p.code === normCode || 
                        p.code === paddedCode ||
                        p.name.trim().toLowerCase() === formName.trim().toLowerCase()
                    )

                    const inferredProvince = formName.includes('Đắk Lắk') ? 'Tỉnh Đắk Lắk' : (formName.includes('Bến Tre') ? 'Tỉnh Bến Tre' : null)

                    if (match) {
                        await supabase
                            .from('production_places')
                            .update({
                                name: formName.trim(),
                                address: formDesc.trim() || undefined,
                                province: inferredProvince || undefined,
                                is_active: true,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', match.id)
                    } else {
                        await supabase
                            .from('production_places')
                            .insert([{
                                code: paddedCode,
                                name: formName.trim(),
                                address: formDesc.trim() || null,
                                province: inferredProvince,
                                is_active: true,
                                updated_at: new Date().toISOString()
                            }])
                    }
                } catch (placeSyncErr) {
                    console.warn('Lỗi đồng bộ production_places từ stamp-rules:', placeSyncErr)
                }
            }

            // Tự động đồng bộ sang bảng material_zones nếu là Vùng nguyên liệu (province)
            if (formCategory === 'province') {
                try {
                    const normCode = formCode.trim().padStart(2, '0')
                    const provName = formName.trim()
                    const { data: existingZones } = await supabase
                        .from('material_zones')
                        .select('id, code, name, province')

                    const match = existingZones?.find((z: any) => 
                        z.code === `VN-${normCode}-01` || 
                        z.code?.includes(`-${normCode}-`) ||
                        (z.province && z.province.toLowerCase().includes(provName.toLowerCase())) ||
                        (z.name && z.name.toLowerCase().includes(provName.toLowerCase()))
                    )

                    const fullProvName = provName.startsWith('Tỉnh') || provName.startsWith('Thành phố') ? provName : `Tỉnh ${provName}`

                    if (match) {
                        await supabase
                            .from('material_zones')
                            .update({
                                province: fullProvName,
                                is_active: true,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', match.id)
                    } else {
                        await supabase
                            .from('material_zones')
                            .insert([{
                                code: `VN-${normCode}-01`,
                                name: `Vùng trồng ${provName}`,
                                location: fullProvName,
                                province: fullProvName,
                                certification: 'Mã số PUC xuất khẩu',
                                notes: `Mã dập dấu hành chính: ${normCode}`,
                                is_active: true,
                                updated_at: new Date().toISOString()
                            }])
                    }
                } catch (zoneSyncErr) {
                    console.warn('Lỗi đồng bộ material_zones từ stamp-rules:', zoneSyncErr)
                }
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

            <StampLiveSimulator
                formats={formats}
                activeFormatId={activeFormatId}
                activeFormat={activeFormat}
                handleSelectFormatForSimulator={handleSelectFormatForSimulator}
                simLine1={simLine1}
                setSimLine1={setSimLine1}
                simLine2={simLine2}
                setSimLine2={setSimLine2}
                showTechnicalL1={showTechnicalL1}
                setShowTechnicalL1={setShowTechnicalL1}
                decodedSimulation={decodedSimulation}
            />

            {/* 3. Main Switcher Tabs (Từ Điển vs Cấu Trúc Khuôn Định Dạng vs Hàng Đợi AI) */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
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
                    <Link
                        href="/warehouses/pallets"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
                        title="Mở Quản lý quét Pallet & Hàng đợi AI"
                    >
                        <Sparkles size={16} />
                        <span>Mở Quản Lý Quét Pallet (Hàng Đợi AI)</span>
                        <ExternalLink size={14} className="opacity-75" />
                    </Link>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Smartphone size={15} className="text-emerald-500" />
                    <span>App mobile quét sẽ đồng bộ tự động cả từ điển và khuôn mẫu</span>
                </div>
            </div>

            <StampDictionariesTab
                mainTab={mainTab as any}
                rules={rules}
                filteredRules={filteredRules}
                isLoadingRules={isLoadingRules}
                selectedLine={selectedLine}
                setSelectedLine={setSelectedLine}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                handleToggleActiveRule={handleToggleActiveRule}
                handleOpenEditRule={handleOpenEditRule}
                handleDeleteRule={handleDeleteRule}
            />

            <StampFormatSchemasTab
                mainTab={mainTab as any}
                formats={formats}
                activeFormatId={activeFormatId}
                setActiveFormatId={setActiveFormatId}
                setSimLine1={setSimLine1}
                setSimLine2={setSimLine2}
                handleSetDefaultFormat={handleSetDefaultFormat}
                handleOpenEditFormat={handleOpenEditFormat}
                handleDeleteFormat={handleDeleteFormat}
                showToast={showToast}
            />

            <FormatBuilderModal
                isFormatModalOpen={isFormatModalOpen}
                setIsFormatModalOpen={setIsFormatModalOpen}
                editingFormat={editingFormat}
                isFormatModalFullscreen={isFormatModalFullscreen}
                setIsFormatModalFullscreen={setIsFormatModalFullscreen}
                formatSubTab={formatSubTab}
                setFormatSubTab={setFormatSubTab}
                formFmtCode={formFmtCode}
                setFormFmtCode={setFormFmtCode}
                formFmtName={formFmtName}
                setFormFmtName={setFormFmtName}
                formFmtDesc={formFmtDesc}
                setFormFmtDesc={setFormFmtDesc}
                formFmtIsDefault={formFmtIsDefault}
                setFormFmtIsDefault={setFormFmtIsDefault}
                formLine1Config={formLine1Config}
                setFormLine1Config={setFormLine1Config}
                formLine2Config={formLine2Config}
                setFormLine2Config={setFormLine2Config}
                expandedFields={expandedFields}
                toggleFieldExpand={toggleFieldExpand}
                toggleAllFields={toggleAllFields}
                handleAddField={handleAddField}
                handleUpdateField={handleUpdateField}
                handleRemoveField={handleRemoveField}
                handleAutoAlignFields={handleAutoAlignFields}
                renderVisualTape={renderVisualTape}
                isSavingFormat={isSavingFormat}
                handleSaveFormat={handleSaveFormat}
            />

            <DictionaryRuleModal
                isRuleModalOpen={isRuleModalOpen}
                setIsRuleModalOpen={setIsRuleModalOpen}
                editingRule={editingRule}
                formCategory={formCategory}
                setFormCategory={setFormCategory}
                formCode={formCode}
                setFormCode={setFormCode}
                formName={formName}
                setFormName={setFormName}
                formDesc={formDesc}
                setFormDesc={setFormDesc}
                formProductSku={formProductSku}
                setFormProductSku={setFormProductSku}
                formSortOrder={formSortOrder}
                setFormSortOrder={setFormSortOrder}
                warehouseProducts={warehouseProducts}
                isSavingRule={isSavingRule}
                handleSaveRule={handleSaveRule}
            />
        </div>
    )
}
