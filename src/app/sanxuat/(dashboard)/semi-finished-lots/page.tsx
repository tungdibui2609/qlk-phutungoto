'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { 
    Plus, Trash2, Layers, Sparkles, Loader2, RefreshCw, 
    ClipboardList, Settings, X, Edit, Sliders, Eye, 
    Check, AlertCircle, Save, Info 
} from 'lucide-react'

interface CustomField {
    id: string
    name: string
    type: 'text' | 'number' | 'date' | 'boolean' | 'select'
    required: boolean
    options?: string[]
}

interface SemiFinishedLot {
    id: string
    code: string
    created_at: string
    status: string | null
    custom_values?: Record<string, any> | null
}

const generateNextShortCode = (existingLots: SemiFinishedLot[]): string => {
    let maxSeq = 0
    existingLots.forEach(lot => {
        const codeUpper = lot.code.trim().toUpperCase()
        
        // 1. Check if it's pure number (1-999)
        if (/^\d+$/.test(codeUpper)) {
            const num = parseInt(codeUpper, 10)
            if (!isNaN(num) && num >= 1 && num <= 999) {
                maxSeq = Math.max(maxSeq, num)
            }
        } else {
            // 2. Check if it's letter + number (e.g. A1, B999)
            const match = codeUpper.match(/^([A-Z])(\d+)$/)
            if (match) {
                const char = match[1]
                const num = parseInt(match[2], 10)
                if (!isNaN(num) && num >= 1 && num <= 999) {
                    const k = char.charCodeAt(0) - 65 + 1 // 'A' -> 1, 'B' -> 2
                    const seq = k * 999 + num
                    maxSeq = Math.max(maxSeq, seq)
                }
            }
        }
    })

    const nextSeq = maxSeq + 1
    if (nextSeq <= 999) {
        return `${nextSeq}`
    } else {
        const k = Math.floor((nextSeq - 1) / 999)
        const num = ((nextSeq - 1) % 999) + 1
        const charCode = 65 + ((k - 1) % 26) // A-Z
        const char = String.fromCharCode(charCode)
        return `${char}${num}`
    }
}

export default function SemiFinishedLotsPage() {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    // States chính
    const [newLotCode, setNewLotCode] = useState('')
    const [lots, setLots] = useState<SemiFinishedLot[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // States Cấu hình trường động
    const [customFields, setCustomFields] = useState<CustomField[]>([])
    const [customValues, setCustomValues] = useState<Record<string, any>>({})
    const [isConfigOpen, setIsConfigOpen] = useState(false)
    const [isSavingConfig, setIsSavingConfig] = useState(false)

    // Form thêm trường mới trong Drawer Cấu hình
    const [newFieldName, setNewFieldName] = useState('')
    const [newFieldType, setNewFieldType] = useState<CustomField['type']>('text')
    const [newFieldRequired, setNewFieldRequired] = useState(false)
    const [newFieldOptions, setNewFieldOptions] = useState('')

    // States Xem/Sửa Chi tiết lô
    const [selectedLot, setSelectedLot] = useState<SemiFinishedLot | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [detailCode, setDetailCode] = useState('')
    const [detailValues, setDetailValues] = useState<Record<string, any>>({})
    const [isSavingDetail, setIsSavingDetail] = useState(false)

    // State cho Custom Confirm Modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean
        title: string
        message: string
        confirmText?: string
        cancelText?: string
        isDanger?: boolean
        onConfirm: () => void
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    })

    // 1. Tải danh sách lô bán thành phẩm
    const fetchLots = async () => {
        if (!currentSystem?.code) return
        setIsLoading(true)
        try {
            const { data, error } = await (supabase
                .from('production_custom_lots' as any) as any)
                .select('id, code, created_at, status, custom_values')
                .eq('system_code', currentSystem.code)
                .eq('lot_type', 'semi_finished')
                .neq('status', 'hidden')
                .order('created_at', { ascending: false })

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation "production_custom_lots" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw error
            }
            setLots(data || [])
        } catch (err: any) {
            if (err.message === 'TABLE_NOT_EXIST') {
                const localLots = localStorage.getItem(`local_custom_semi_finished_lots_${currentSystem.code}`)
                setLots(localLots ? JSON.parse(localLots) : [])
                showToast('Hệ thống đang chạy chế độ tạm thời. Hãy chạy script SQL Migration để lưu trữ trên Database vĩnh viễn!', 'warning')
            } else {
                console.error('Lỗi khi tải danh sách LOT:', err)
                showToast('Không thể tải danh sách lô: ' + err.message, 'error')
            }
        } finally {
            setIsLoading(false)
        }
    }

    // 2. Tải cấu hình các trường động
    const fetchConfig = async () => {
        if (!currentSystem?.code) return
        try {
            const { data, error } = await (supabase
                .from('production_custom_field_configs' as any) as any)
                .select('fields')
                .eq('system_code', currentSystem.code)
                .eq('lot_type', 'semi_finished')
                .maybeSingle()

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation "production_custom_field_configs" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw error
            }
            setCustomFields(data?.fields || [])
        } catch (err: any) {
            if (err.message === 'TABLE_NOT_EXIST') {
                const localConfig = localStorage.getItem(`local_custom_fields_config_${currentSystem.code}_semi_finished`)
                setCustomFields(localConfig ? JSON.parse(localConfig) : [])
            } else {
                console.error('Lỗi khi tải cấu hình trường động:', err)
                showToast('Không thể tải cấu hình trường động: ' + err.message, 'error')
            }
        }
    }

    useEffect(() => {
        if (currentSystem?.code) {
            fetchLots()
            fetchConfig()
            // Reset các states nhập liệu
            setCustomValues({})
            setNewLotCode('')
        }
    }, [currentSystem?.code])

    // 3. Lưu cấu hình các trường động
    const handleSaveConfig = async (updatedFields: CustomField[]) => {
        if (!currentSystem?.code) return
        setIsSavingConfig(true)
        try {
            // Kiểm tra xem đã có bản ghi cấu hình chưa
            const { data: existing, error: checkError } = await (supabase
                .from('production_custom_field_configs' as any) as any)
                .select('id')
                .eq('system_code', currentSystem.code)
                .eq('lot_type', 'semi_finished')
                .maybeSingle()

            if (checkError) {
                if (checkError.code === '42P01' || checkError.message?.includes('relation "production_custom_field_configs" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw checkError
            }

            let error;
            if (existing) {
                const { error: updateError } = await (supabase
                    .from('production_custom_field_configs' as any) as any)
                    .update({
                        fields: updatedFields,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', (existing as any).id)
                error = updateError
            } else {
                const { error: insertError } = await (supabase
                    .from('production_custom_field_configs' as any) as any)
                    .insert({
                        system_code: currentSystem.code,
                        lot_type: 'semi_finished',
                        fields: updatedFields,
                        company_id: profile?.company_id || null
                    })
                error = insertError
            }

            if (error) throw error

            showToast('Đã cập nhật cấu hình trường thông tin thành công!', 'success')
            setCustomFields(updatedFields)
            setIsConfigOpen(false)
        } catch (err: any) {
            if (err.message === 'TABLE_NOT_EXIST') {
                const localKey = `local_custom_fields_config_${currentSystem.code}_semi_finished`
                localStorage.setItem(localKey, JSON.stringify(updatedFields))
                showToast('Đã lưu cấu hình trường động tạm thời (Local Storage)', 'success')
                setCustomFields(updatedFields)
                setIsConfigOpen(false)
            } else {
                console.error('Lỗi khi lưu cấu hình trường động:', err)
                showToast('Lỗi khi lưu cấu hình: ' + err.message, 'error')
            }
        } finally {
            setIsSavingConfig(false)
        }
    }

    // 4. Thêm trường mới vào danh sách tạm thời trong Drawer
    const handleAddField = (e: React.FormEvent) => {
        e.preventDefault()
        const cleanName = newFieldName.trim()
        if (!cleanName) {
            showToast('Vui lòng nhập tên trường thông tin!', 'warning')
            return
        }

        const isDuplicate = customFields.some(f => f.name.toLowerCase() === cleanName.toLowerCase())
        if (isDuplicate) {
            showToast('Tên trường này đã tồn tại trong danh sách cấu hình!', 'warning')
            return
        }

        // Tạo mã ID ngẫu nhiên, thân thiện
        const fieldId = 'field_' + Date.now()
        const optionsList = newFieldType === 'select'
            ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
            : undefined

        if (newFieldType === 'select' && (!optionsList || optionsList.length === 0)) {
            showToast('Vui lòng điền ít nhất một lựa chọn cho kiểu Lựa chọn!', 'warning')
            return
        }

        const newField: CustomField = {
            id: fieldId,
            name: cleanName,
            type: newFieldType,
            required: newFieldRequired,
            options: optionsList
        }

        const updated = [...customFields, newField]
        handleSaveConfig(updated)

        // Reset form thêm trường
        setNewFieldName('')
        setNewFieldType('text')
        setNewFieldRequired(false)
        setNewFieldOptions('')
    }

    // 5. Xóa một trường khỏi cấu hình
    const handleRemoveField = (id: string, name: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Xóa trường thông tin',
            message: `Bạn có chắc chắn muốn xóa trường "${name}"? Các dữ liệu đã nhập trước đây của trường này sẽ không hiển thị nữa.`,
            confirmText: 'Xóa ngay',
            cancelText: 'Quay lại',
            isDanger: true,
            onConfirm: () => {
                const updated = customFields.filter(f => f.id !== id)
                handleSaveConfig(updated)
            }
        })
    }

    // 6. Xử lý tạo mới lô bán thành phẩm
    const handleCreateLot = async (e: React.FormEvent) => {
        e.preventDefault()
        const cleanOriginalCode = newLotCode.trim().toUpperCase() // Đây là mã gốc dài do người dùng nhập

        if (!cleanOriginalCode) {
            showToast('Vui lòng nhập mã lô gốc!', 'warning')
            return
        }

        if (!currentSystem?.code) {
            showToast('Không tìm thấy thông tin phân hệ kho hiện tại!', 'error')
            return
        }

        // Tự động sinh mã lô ngắn từ 1-999, sau đó A1-A999, B1-B999...
        const shortCode = generateNextShortCode(lots)

        setIsSaving(true)
        try {
            const { data, error } = await (supabase
                .from('production_custom_lots' as any) as any)
                .insert({
                    code: shortCode,
                    lot_type: 'semi_finished',
                    status: 'active',
                    system_code: currentSystem.code,
                    company_id: profile?.company_id || null,
                    custom_values: { original_code: cleanOriginalCode } // Lưu mã gốc dài vào custom_values
                })
                .select()

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation "production_custom_lots" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw error
            }

            showToast(`Đã tạo thành công lô bán thành phẩm ngắn: ${shortCode} (Mã gốc: ${cleanOriginalCode})`, 'success')
            setNewLotCode('')
            setCustomValues({})
            fetchLots() // Refresh list
        } catch (err: any) {
            if (err.message === 'TABLE_NOT_EXIST') {
                const localKey = `local_custom_semi_finished_lots_${currentSystem.code}`
                const localLots = localStorage.getItem(localKey)
                const currentLocal = localLots ? JSON.parse(localLots) : []
                const newLocalItem = {
                    id: 'local-' + Date.now(),
                    code: shortCode,
                    created_at: new Date().toISOString(),
                    status: 'active',
                    custom_values: { original_code: cleanOriginalCode }
                }
                localStorage.setItem(localKey, JSON.stringify([newLocalItem, ...currentLocal]))
                showToast(`Đã lưu tạm thời lô bán thành phẩm ngắn: ${shortCode} (Mã gốc: ${cleanOriginalCode})`, 'success')
                setNewLotCode('')
                setCustomValues({})
                fetchLots()
            } else {
                console.error('Lỗi khi lưu LOT:', err)
                showToast('Lỗi khi tạo lô: ' + err.message, 'error')
            }
        } finally {
            setIsSaving(false)
        }
    }

    // 7. Xóa lô bán thành phẩm
    const handleDeleteLot = async (id: string, code: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Xóa lô bán thành phẩm',
            message: `Bạn có chắc chắn muốn xóa lô bán thành phẩm ${code}? Hành động này sẽ ẩn lô khỏi hệ thống.`,
            confirmText: 'Xóa ngay',
            cancelText: 'Quay lại',
            isDanger: true,
            onConfirm: async () => {
                try {
                    if (id.startsWith('local-')) {
                        const localKey = `local_custom_semi_finished_lots_${currentSystem?.code}`
                        const localLots = localStorage.getItem(localKey)
                        if (localLots) {
                            const parsed = JSON.parse(localLots) as any[]
                            const filtered = parsed.filter(l => l.id !== id)
                            localStorage.setItem(localKey, JSON.stringify(filtered))
                        }
                        showToast(`Đã xóa lô bán thành phẩm: ${code}`, 'success')
                        fetchLots()
                        return
                    }

                    const { error } = await (supabase
                        .from('production_custom_lots' as any) as any)
                        .update({ status: 'hidden' })
                        .eq('id', id)

                    if (error) throw error

                    showToast(`Đã xóa lô bán thành phẩm: ${code}`, 'success')
                    fetchLots()
                } catch (err: any) {
                    console.error('Lỗi khi xóa LOT:', err)
                    showToast('Không thể xóa lô: ' + err.message, 'error')
                }
            }
        })
    }

    // 8. Mở Drawer Xem/Sửa Chi tiết lô
    const handleOpenDetail = (lot: SemiFinishedLot) => {
        setSelectedLot(lot)
        setDetailCode(lot.code)
        setDetailValues(lot.custom_values || {})
        setIsDetailOpen(true)
    }

    // 9. Lưu cập nhật chi tiết lô bán thành phẩm
    const handleUpdateLotDetail = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedLot) return

        const cleanCode = detailCode.trim().toUpperCase()
        if (!cleanCode) {
            showToast('Mã lô không được để trống!', 'warning')
            return
        }

        // Kiểm tra trùng lặp mã lô (trừ chính lô đang sửa)
        const isDuplicate = lots.some(l => l.id !== selectedLot.id && l.code === cleanCode)
        if (isDuplicate) {
            showToast(`Mã lô ${cleanCode} đã tồn tại trong danh sách!`, 'warning')
            return
        }

        // Kiểm tra các trường động bắt buộc
        const missingFields = customFields.filter(f => f.required && (detailValues[f.id] === undefined || detailValues[f.id] === ''))
        if (missingFields.length > 0) {
            showToast(`Vui lòng nhập đủ các thông tin bắt buộc: ${missingFields.map(f => f.name).join(', ')}`, 'warning')
            return
        }

        setIsSavingDetail(true)
        try {
            if (selectedLot.id.startsWith('local-')) {
                const localKey = `local_custom_semi_finished_lots_${currentSystem?.code}`
                const localLots = localStorage.getItem(localKey)
                if (localLots) {
                    const parsed = JSON.parse(localLots) as any[]
                    const updated = parsed.map(l => {
                        if (l.id === selectedLot.id) {
                            return {
                                ...l,
                                code: cleanCode,
                                custom_values: detailValues
                            }
                        }
                        return l
                    })
                    localStorage.setItem(localKey, JSON.stringify(updated))
                }
                showToast(`Đã cập nhật lô bán thành phẩm: ${cleanCode}`, 'success')
                fetchLots()
                setIsDetailOpen(false)
                return
            }

            const { error } = await (supabase
                .from('production_custom_lots' as any) as any)
                .update({
                    code: cleanCode,
                    custom_values: detailValues
                })
                .eq('id', selectedLot.id)

            if (error) throw error

            showToast(`Đã cập nhật chi tiết lô bán thành phẩm: ${cleanCode}`, 'success')
            fetchLots()
            setIsDetailOpen(false)
        } catch (err: any) {
            console.error('Lỗi khi cập nhật LOT:', err)
            showToast('Không thể lưu cập nhật: ' + err.message, 'error')
        } finally {
            setIsSavingDetail(false)
        }
    }

    // Helper render giá trị động trên bảng
    const renderFieldSummary = (values: Record<string, any> | null | undefined) => {
        if (!values || Object.keys(values).length === 0) return <span className="text-stone-400 italic text-[11px]">Không có chi tiết</span>
        
        return (
            <div className="flex flex-wrap gap-1 max-w-[320px]">
                {customFields.map(field => {
                    const val = values[field.id]
                    if (val === undefined || val === null || val === '') return null
                    const displayVal = typeof val === 'boolean' ? (val ? 'Có' : 'Không') : val
                    return (
                        <span 
                            key={field.id} 
                            className="inline-flex items-center text-[10px] bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 rounded font-medium border border-stone-200/50 dark:border-zinc-700/50"
                        >
                            {field.name}: <strong className="ml-1 text-stone-800 dark:text-stone-100">{displayVal}</strong>
                        </span>
                    )
                })}
            </div>
        )
    }

    return (
        <section className="space-y-6 pb-12 font-sans text-stone-800 dark:text-stone-200 relative">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
                        Lô bán thành phẩm
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-1">
                        Khai báo các mã lô bán thành phẩm nguyên liệu để sử dụng trong in ấn và truy xuất nguồn gốc.
                    </p>
                </div>
                
                {/* Nút cài đặt trường động */}
                <button
                    onClick={() => setIsConfigOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-800/80 rounded-2xl font-bold transition-all shadow-sm active:scale-95 cursor-pointer text-sm"
                >
                    <Settings size={16} className="text-stone-500" />
                    Cài đặt trường thông tin
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Cột trái: Form khai báo nhanh */}
                <form 
                    onSubmit={handleCreateLot}
                    className="lg:col-span-4 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-5"
                >
                    <div className="flex items-center gap-2 border-b border-stone-100 dark:border-zinc-800 pb-3">
                        <Sparkles className="text-emerald-500 animate-pulse" size={18} />
                        <h3 className="font-bold text-stone-800 dark:text-white">Khai báo nhanh lô mới</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Input mã lô chính */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                Mã lô gốc thực tế (Mã dài) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={newLotCode}
                                onChange={(e) => setNewLotCode(e.target.value)}
                                placeholder="Ví dụ: DCD-RIMA1-2305260TN"
                                disabled={isSaving}
                                className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono uppercase text-sm"
                            />
                        </div>


                        <button
                            type="submit"
                            disabled={isSaving || !newLotCode.trim()}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSaving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Plus size={18} />
                            )}
                            {isSaving ? 'Đang lưu...' : 'Tạo nhanh & Lưu lại'}
                        </button>
                    </div>
                </form>

                {/* Cột phải: Danh sách lô đã khai báo */}
                <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="text-stone-500" size={18} />
                            <h3 className="font-bold text-stone-800 dark:text-white">Danh sách lô bán thành phẩm</h3>
                        </div>
                        <button 
                            onClick={fetchLots}
                            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            title="Tải lại danh sách"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-2">
                            <Loader2 className="text-emerald-500 animate-spin" size={32} />
                            <span className="text-xs text-stone-400">Đang tải danh sách lô...</span>
                        </div>
                    ) : lots.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-stone-100 dark:border-zinc-800 text-[11px] font-black uppercase tracking-wider text-stone-400">
                                        <th className="py-3 text-left">Mã lô ngắn</th>
                                        <th className="py-3 text-left">Mã lô gốc</th>
                                        <th className="py-3 text-left">Thông tin chi tiết</th>
                                        <th className="py-3 text-left">Ngày tạo</th>
                                        <th className="py-3 text-right w-28">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {lots.map((lot) => (
                                        <tr key={lot.id} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                            <td className="py-3.5 font-mono font-bold text-stone-800 dark:text-stone-200 text-sm">
                                                <span className="bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-zinc-200 px-2.5 py-1 rounded-xl border border-stone-200/60 dark:border-zinc-700/60">
                                                    {lot.code}
                                                </span>
                                            </td>
                                            <td className="py-3.5 font-mono text-stone-600 dark:text-stone-400 text-xs">
                                                {lot.custom_values?.original_code || '---'}
                                            </td>
                                            <td className="py-3.5">
                                                {renderFieldSummary(lot.custom_values)}
                                            </td>
                                            <td className="py-3.5 text-stone-500 text-xs">
                                                {new Date(lot.created_at).toLocaleDateString('vi-VN')} {new Date(lot.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-3.5 text-right space-x-1.5">
                                                <button
                                                    onClick={() => handleOpenDetail(lot)}
                                                    className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl transition-colors cursor-pointer"
                                                    title="Chỉnh sửa thông tin chi tiết"
                                                >
                                                    <Edit size={15} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLot(lot.id, lot.code)}
                                                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
                                                    title="Xóa mã lô"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl text-center space-y-3 bg-stone-50/30 dark:bg-zinc-900/30">
                            <Layers className="text-stone-300 dark:text-zinc-700" size={48} />
                            <div>
                                <h4 className="font-bold text-stone-700 dark:text-zinc-300">Chưa có lô bán thành phẩm</h4>
                                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-sm">
                                    Sử dụng biểu mẫu bên trái để khai báo nhanh mã lô bán thành phẩm đầu tiên của bạn.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* DRAWER 1: Cấu hình các trường động (isConfigOpen) */}
            {isConfigOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-stone-900/40 dark:bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                        onClick={() => setIsConfigOpen(false)}
                    />
                    
                    {/* Panel */}
                    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-50 border-l border-stone-200 dark:border-zinc-800 flex flex-col h-full animate-slide-in">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sliders className="text-emerald-500" size={20} />
                                <h3 className="font-bold text-stone-800 dark:text-white text-lg">Cấu hình trường thông tin</h3>
                            </div>
                            <button 
                                onClick={() => setIsConfigOpen(false)}
                                className="p-1.5 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-full text-stone-400 hover:text-stone-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {/* Section 1: Form thêm trường mới */}
                            <form onSubmit={handleAddField} className="bg-stone-50 dark:bg-zinc-800/40 rounded-2xl p-4 border border-stone-200/50 dark:border-zinc-800/80 space-y-4">
                                <h4 className="font-bold text-sm text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                                    <Plus size={16} className="text-emerald-500" />
                                    Thêm trường thông tin mới
                                </h4>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Tên trường (ví dụ: Độ ẩm, Nhiệt độ...)</label>
                                        <input
                                            type="text"
                                            value={newFieldName}
                                            onChange={(e) => setNewFieldName(e.target.value)}
                                            placeholder="Tên trường..."
                                            className="w-full px-3 py-1.8 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-white text-xs"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Kiểu dữ liệu</label>
                                            <select
                                                value={newFieldType}
                                                onChange={(e) => setNewFieldType(e.target.value as CustomField['type'])}
                                                className="w-full px-3 py-1.8 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-white text-xs"
                                            >
                                                <option value="text">Văn bản (Text)</option>
                                                <option value="number">Số (Number)</option>
                                                <option value="date">Ngày tháng (Date)</option>
                                                <option value="boolean">Đúng / Sai (Boolean)</option>
                                                <option value="select">Lựa chọn (Select)</option>
                                            </select>
                                        </div>

                                        <div className="flex items-end pb-1.5">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={newFieldRequired}
                                                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                                                    className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-xs font-bold text-stone-600 dark:text-stone-400">Bắt buộc nhập</span>
                                            </label>
                                        </div>
                                    </div>

                                    {newFieldType === 'select' && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                                                Các lựa chọn
                                                <Info size={12} title="Nhập các lựa chọn cách nhau bằng dấu phẩy" />
                                            </label>
                                            <input
                                                type="text"
                                                value={newFieldOptions}
                                                onChange={(e) => setNewFieldOptions(e.target.value)}
                                                placeholder="VD: Hàng loại A, Hàng loại B, Hàng loại C"
                                                className="w-full px-3 py-1.8 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-white text-xs"
                                            />
                                            <span className="text-[10px] text-stone-400 block mt-0.5">Nhập các lựa chọn, phân tách nhau bằng dấu phẩy.</span>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-200 dark:hover:bg-stone-100 dark:text-zinc-900 rounded-xl font-bold transition-all text-xs cursor-pointer"
                                    >
                                        {isSavingConfig ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Check size={14} />
                                        )}
                                        Thêm & Lưu trường
                                    </button>
                                </div>
                            </form>

                            {/* Section 2: Danh sách các trường đang có */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-sm text-stone-700 dark:text-stone-300">Danh sách các trường cấu hình hiện tại</h4>
                                {customFields.length > 0 ? (
                                    <div className="divide-y divide-stone-100 dark:divide-zinc-800 border border-stone-200/50 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                                        {customFields.map((field) => (
                                            <div key={field.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-stone-50 dark:hover:bg-zinc-800/40 transition-colors">
                                                <div className="space-y-1">
                                                    <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                                                        {field.name}
                                                        {field.required && (
                                                            <span className="text-[10px] px-1 py-0.2 bg-red-50 text-red-500 border border-red-200 rounded">bắt buộc</span>
                                                        )}
                                                    </span>
                                                    <span className="text-stone-400 block">
                                                        Kiểu: {
                                                            field.type === 'text' ? 'Văn bản' :
                                                            field.type === 'number' ? 'Số' :
                                                            field.type === 'date' ? 'Ngày tháng' :
                                                            field.type === 'boolean' ? 'Đúng/Sai' : 'Lựa chọn'
                                                        }
                                                        {field.options && field.options.length > 0 && ` (${field.options.join(', ')})`}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => handleRemoveField(field.id, field.name)}
                                                    className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                                    title="Xóa trường cấu hình"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-8 border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl text-stone-400 text-xs">
                                        Chưa có cấu hình trường tùy chỉnh nào. Hãy thêm trường thông tin đầu tiên bên trên.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-5 border-t border-stone-100 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 flex justify-end gap-3 text-xs">
                            <button
                                onClick={() => setIsConfigOpen(false)}
                                className="px-4 py-2 border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                            >
                                Đóng lại
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* DRAWER 2: Xem/Sửa Chi tiết lô (isDetailOpen) */}
            {isDetailOpen && selectedLot && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-stone-900/40 dark:bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                        onClick={() => setIsDetailOpen(false)}
                    />
                    
                    {/* Panel */}
                    <form 
                        onSubmit={handleUpdateLotDetail}
                        className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl z-50 border-l border-stone-200 dark:border-zinc-800 flex flex-col h-full animate-slide-in"
                    >
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Info className="text-emerald-500" size={20} />
                                <h3 className="font-bold text-stone-800 dark:text-white text-lg">Chi tiết lô bán thành phẩm</h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsDetailOpen(false)}
                                className="p-1.5 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-full text-stone-400 hover:text-stone-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Chỉnh sửa Mã lô chính */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                    Mã lô bán thành phẩm ngắn <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={detailCode}
                                    onChange={(e) => setDetailCode(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-stone-800 dark:text-white font-mono font-bold uppercase text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    placeholder="Mã lô..."
                                    required
                                />
                            </div>

                            {/* Chỉnh sửa Mã lô gốc */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                    Mã lô gốc thực tế (Mã dài)
                                </label>
                                <input
                                    type="text"
                                    value={detailValues['original_code'] || ''}
                                    onChange={(e) => setDetailValues({...detailValues, original_code: e.target.value.toUpperCase()})}
                                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-stone-800 dark:text-white font-mono font-bold uppercase text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    placeholder="Ví dụ: DCD-RIMA1-2305260TN"
                                />
                            </div>

                            {/* Danh sách các trường động */}
                            {customFields.length > 0 ? (
                                <div className="border-t border-dashed border-stone-100 dark:border-zinc-800/80 pt-4 space-y-4">
                                    <span className="text-xs font-bold text-stone-400 block mb-2 uppercase tracking-wide">Các trường thông tin tùy chỉnh</span>
                                    {customFields.map((field) => (
                                        <div key={field.id} className="space-y-1.5">
                                            <label className="text-xs font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1">
                                                {field.name}
                                                {field.required && <span className="text-red-500">*</span>}
                                            </label>

                                            {field.type === 'text' && (
                                                <input
                                                    type="text"
                                                    value={detailValues[field.id] || ''}
                                                    onChange={(e) => setDetailValues({...detailValues, [field.id]: e.target.value})}
                                                    placeholder={`Nhập ${field.name.toLowerCase()}...`}
                                                    className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                            )}

                                            {field.type === 'number' && (
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={detailValues[field.id] || ''}
                                                    onChange={(e) => setDetailValues({...detailValues, [field.id]: e.target.value})}
                                                    placeholder="0.0"
                                                    className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                            )}

                                            {field.type === 'date' && (
                                                <input
                                                    type="date"
                                                    value={detailValues[field.id] || ''}
                                                    onChange={(e) => setDetailValues({...detailValues, [field.id]: e.target.value})}
                                                    className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                />
                                            )}

                                            {field.type === 'boolean' && (
                                                <label className="flex items-center gap-2 cursor-pointer py-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!detailValues[field.id]}
                                                        onChange={(e) => setDetailValues({...detailValues, [field.id]: e.target.checked})}
                                                        className="w-4.5 h-4.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-sm text-stone-600 dark:text-stone-400">Kích hoạt / Đúng</span>
                                                </label>
                                            )}

                                            {field.type === 'select' && (
                                                <select
                                                    value={detailValues[field.id] || ''}
                                                    onChange={(e) => setDetailValues({...detailValues, [field.id]: e.target.value})}
                                                    className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                >
                                                    <option value="">-- Chọn một giá trị --</option>
                                                    {field.options?.map((opt, idx) => (
                                                        <option key={idx} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center p-8 bg-stone-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-stone-200 dark:border-zinc-800 text-stone-400 text-xs">
                                    Không có trường thông tin tùy chỉnh nào được cấu hình cho phân hệ này. Bấm vào nút "Cài đặt trường thông tin" ngoài màn hình chính để thiết lập.
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-5 border-t border-stone-100 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 flex justify-end gap-3 text-xs">
                            <button
                                type="button"
                                onClick={() => setIsDetailOpen(false)}
                                className="px-4 py-2.5 border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={isSavingDetail}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-emerald-600/10 active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {isSavingDetail ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Save size={14} />
                                )}
                                Lưu thay đổi
                            </button>
                        </div>
                    </form>
                </>
            )}
            {/* Custom Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-stone-950/60 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    />
                    
                    {/* Modal Card */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full p-6 relative z-10 transform transition-all duration-300 scale-100 animate-in zoom-in-95 ease-out">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className={`p-4 rounded-2xl ${confirmModal.isDanger ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'}`}>
                                <AlertCircle size={32} className="stroke-[2.5]" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-extrabold text-stone-900 dark:text-white tracking-tight">
                                    {confirmModal.title}
                                </h3>
                                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed px-2">
                                    {confirmModal.message}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3 text-sm">
                            <button
                                type="button"
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 px-4 py-3 border border-stone-200 dark:border-zinc-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-zinc-800/80 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer bg-white dark:bg-zinc-900"
                            >
                                {confirmModal.cancelText || 'Hủy bỏ'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    confirmModal.onConfirm()
                                    setConfirmModal(prev => ({ ...prev, isOpen: false }))
                                }}
                                className={`flex-1 px-4 py-3 text-white rounded-2xl font-bold transition-all active:scale-95 cursor-pointer ${
                                    confirmModal.isDanger 
                                        ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/10 hover:shadow-red-600/20' 
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20'
                                }`}
                            >
                                {confirmModal.confirmText || 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
