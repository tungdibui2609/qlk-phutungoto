'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
    Images,
    Search,
    Calendar,
    ArrowLeft,
    Trash2,
    Download,
    X,
    Loader2,
    Camera,
    ImagePlus,
    FolderOpen,
    FolderPlus,
    Folder,
    ChevronRight,
    ChevronDown,
    Grid3X3,
    Layers,
    Cloud,
    CloudUpload,
    RefreshCw,
    Settings,
    Copy,
    Check,
    ExternalLink,
    Pencil,
    FolderInput,
} from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'
import {
    OperationImageRecord,
    listOperationImages,
    uploadOperationImages,
    deleteOperationImage,
    moveOperationImageToFolder,
    getOperationImageDisplayUrl,
    normalizeSearchText,
} from '@/lib/operationImages'
import {
    OperationFolder,
    OperationDriveSettings,
    GOOGLE_APPS_SCRIPT_TEMPLATE,
    listOperationFolders,
    createOperationFolder,
    renameOperationFolder,
    deleteOperationFolder,
    buildFolderPathMap,
    getDriveSettings,
    saveDriveSettings,
    syncImagesToGoogleDrive,
    testGoogleDriveWebhook,
} from '@/lib/operationDriveSync'

interface ShiftOption {
    id: string
    status: string
    opened_at: string
    notes?: string | null
    summary_data?: {
        job_name?: string
    } | null
}

function toLocalDateInput(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export default function SoLieuAlbumPage() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    const today = useMemo(() => new Date(), [])
    const defaultFrom = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() - 14)
        return toLocalDateInput(d)
    }, [])

    const [fromDate, setFromDate] = useState(defaultFrom)
    const [toDate, setToDate] = useState(toLocalDateInput(today))
    const [direction, setDirection] = useState<'all' | 'in' | 'out' | 'shift'>('all')
    const [searchText, setSearchText] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)
    const [viewMode, setViewMode] = useState<'album' | 'grid'>('album')

    const [folders, setFolders] = useState<OperationFolder[]>([])
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
    const [newFolderName, setNewFolderName] = useState('')
    const [creatingFolder, setCreatingFolder] = useState(false)

    // Cây thư mục tự động theo Tháng -> Ngày -> Công việc hoặc Công việc -> Ngày
    const [treeMode, setTreeMode] = useState<'date' | 'job'>('date')
    const [selectedTreeMonth, setSelectedTreeMonth] = useState<string | null>(null)
    const [selectedTreeDate, setSelectedTreeDate] = useState<string | null>(null)
    const [selectedTreeJob, setSelectedTreeJob] = useState<string | null>(null)
    const [selectedJobName, setSelectedJobName] = useState<string | null>(null)
    const [selectedJobDateKey, setSelectedJobDateKey] = useState<string | null>(null)
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})
    const [expandedJobNames, setExpandedJobNames] = useState<Record<string, boolean>>({})

    const [images, setImages] = useState<OperationImageRecord[]>([])
    const [products, setProducts] = useState<{ sku: string; name: string; aliases?: string | null; internal_code?: string | null; internal_name?: string | null }[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedImage, setSelectedImage] = useState<OperationImageRecord | null>(null)

    const [shifts, setShifts] = useState<ShiftOption[]>([])
    const [uploadShiftId, setUploadShiftId] = useState('')
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    // Google Drive states
    const [driveModalOpen, setDriveModalOpen] = useState(false)
    const [driveSettings, setDriveSettings] = useState<OperationDriveSettings>({
        system_code: '',
        webhook_url: '',
        root_folder_name: 'WMS_HinhAnh_Kho',
        auto_sync_enabled: false,
    })
    const [savingDrive, setSavingDrive] = useState(false)
    const [testingDrive, setTestingDrive] = useState(false)
    const [syncingDrive, setSyncingDrive] = useState(false)
    const [copiedScript, setCopiedScript] = useState(false)

    const folderPathMap = useMemo(() => buildFolderPathMap(folders), [folders])

    const fetchFolders = useCallback(async () => {
        if (!currentSystem?.code) return
        try {
            const list = await listOperationFolders(currentSystem.code, profile?.company_id)
            setFolders(list)
        } catch (err) {
            console.error('Lỗi tải thư mục:', err)
        }
    }, [currentSystem?.code, profile?.company_id])

    const fetchDriveConfig = useCallback(async () => {
        if (!currentSystem?.code) return
        try {
            const cfg = await getDriveSettings(currentSystem.code)
            setDriveSettings(cfg)
        } catch (err) {
            console.error('Lỗi tải cấu hình Drive:', err)
        }
    }, [currentSystem?.code])

    const fetchShifts = useCallback(async () => {
        if (!currentSystem?.code) return
        const shiftSys = `${currentSystem.code}__solieu`
        let query = (supabase.from('delivery_shifts' as any) as any)
            .select('id, status, opened_at, notes, summary_data')
            .or(`system_code.eq.${shiftSys},system_code.eq.${currentSystem.code}`)
            .order('opened_at', { ascending: false })
            .limit(50)

        if (profile?.company_id) {
            query = query.eq('company_id', profile.company_id)
        }

        const { data } = await query
        const list = (data || []) as ShiftOption[]
        setShifts(list)
        if (!uploadShiftId && list.length > 0) {
            setUploadShiftId(list[0].id)
        }
    }, [currentSystem?.code, profile?.company_id, uploadShiftId])

    const fetchProducts = useCallback(async () => {
        if (!currentSystem?.code) return
        let query = (supabase.from('products' as any) as any)
            .select('sku, name, aliases, internal_code, internal_name')
            .or(`system_code.eq.${currentSystem.code},system_type.eq.${currentSystem.code}`)
            .order('name', { ascending: true })
            .limit(2000)
        if (profile?.company_id) {
            query = query.eq('company_id', profile.company_id)
        }
        const { data } = await query
        if (Array.isArray(data)) {
            setProducts(data.filter((p: any) => p.sku && p.name))
        }
    }, [currentSystem?.code, profile?.company_id])

    const fetchImages = useCallback(async () => {
        if (!currentSystem?.code) return
        setLoading(true)
        try {
            const list = await listOperationImages({
                systemCode: currentSystem.code,
                companyId: profile?.company_id,
                folderId: selectedFolderId || undefined,
                fromDate,
                toDate,
                direction,
                limit: 500,
            })
            setImages(list)
        } catch (err) {
            console.error('Lỗi tải album hình ảnh:', err)
        } finally {
            setLoading(false)
        }
    }, [currentSystem?.code, profile?.company_id, selectedFolderId, fromDate, toDate, direction])

    useEffect(() => {
        fetchFolders()
        fetchDriveConfig()
        fetchShifts()
    }, [fetchFolders, fetchDriveConfig, fetchShifts])

    useEffect(() => {
        fetchImages()
    }, [fetchImages])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    const getImageDayInfo = (capturedAt: string) => {
        const dt = new Date(capturedAt)
        const y = dt.getFullYear()
        const m = String(dt.getMonth() + 1).padStart(2, '0')
        const d = String(dt.getDate()).padStart(2, '0')
        return {
            monthKey: `${y}-${m}`,
            monthLabel: `Tháng ${m}/${y}`,
            dateKey: `${y}-${m}-${d}`,
            dateLabel: `${d}/${m}/${y}`,
        }
    }

    const autoFolderTree = useMemo(() => {
        type JobNode = { jobKey: string; shiftId: string; jobName: string; count: number }
        type DateNode = { dateKey: string; dateLabel: string; count: number; jobs: Map<string, JobNode> }
        type MonthNode = { monthKey: string; monthLabel: string; count: number; dates: Map<string, DateNode> }

        const months = new Map<string, MonthNode>()
        for (const img of images) {
            const { monthKey, monthLabel, dateKey, dateLabel } = getImageDayInfo(img.captured_at)
            const jobName = img.job_name || 'Công việc không tên'
            const jobKey = `${dateKey}::${img.shift_id}`

            let mNode = months.get(monthKey)
            if (!mNode) {
                mNode = { monthKey, monthLabel, count: 0, dates: new Map() }
                months.set(monthKey, mNode)
            }
            mNode.count++

            let dNode = mNode.dates.get(dateKey)
            if (!dNode) {
                dNode = { dateKey, dateLabel, count: 0, jobs: new Map() }
                mNode.dates.set(dateKey, dNode)
            }
            dNode.count++

            let jNode = dNode.jobs.get(jobKey)
            if (!jNode) {
                jNode = { jobKey, shiftId: img.shift_id, jobName, count: 0 }
                dNode.jobs.set(jobKey, jNode)
            }
            jNode.count++
        }

        return Array.from(months.values())
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
            .map((m) => ({
                ...m,
                dates: Array.from(m.dates.values())
                    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
                    .map((d) => ({
                        ...d,
                        jobs: Array.from(d.jobs.values()).sort((a, b) => a.jobName.localeCompare(b.jobName)),
                    })),
            }))
    }, [images])

    const autoJobTree = useMemo(() => {
        type JobDateNode = { dateKey: string; dateLabel: string; count: number }
        type JobRootNode = { jobName: string; count: number; latestDateKey: string; dates: Map<string, JobDateNode> }

        const jobs = new Map<string, JobRootNode>()
        for (const img of images) {
            const { dateKey, dateLabel } = getImageDayInfo(img.captured_at)
            const jobName = img.job_name || 'Công việc không tên'

            let jNode = jobs.get(jobName)
            if (!jNode) {
                jNode = { jobName, count: 0, latestDateKey: dateKey, dates: new Map() }
                jobs.set(jobName, jNode)
            }
            jNode.count++
            if (dateKey > jNode.latestDateKey) jNode.latestDateKey = dateKey

            let dNode = jNode.dates.get(dateKey)
            if (!dNode) {
                dNode = { dateKey, dateLabel, count: 0 }
                jNode.dates.set(dateKey, dNode)
            }
            dNode.count++
        }

        return Array.from(jobs.values())
            .sort((a, b) => b.latestDateKey.localeCompare(a.latestDateKey) || a.jobName.localeCompare(b.jobName))
            .map((j) => ({
                ...j,
                dates: Array.from(j.dates.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
            }))
    }, [images])

    const { skuToMetaMap, nameToMetaMap } = useMemo(() => {
        const sMap = new Map<string, string>()
        const nMap = new Map<string, string>()
        for (const p of products) {
            const extra = [p.sku, p.name, p.aliases, p.internal_code, p.internal_name].filter(Boolean).join(' ')
            sMap.set(normalizeSearchText(p.sku), extra)
            nMap.set(normalizeSearchText(p.name), extra)
        }
        return { skuToMetaMap: sMap, nameToMetaMap: nMap }
    }, [products])

    const filteredImages = useMemo(() => {
        let list = images
        if (treeMode === 'job') {
            if (selectedJobDateKey) {
                const sepIdx = selectedJobDateKey.lastIndexOf('::')
                const jName = selectedJobDateKey.slice(0, sepIdx)
                const dKey = selectedJobDateKey.slice(sepIdx + 2)
                list = list.filter((img) => {
                    const info = getImageDayInfo(img.captured_at)
                    return (img.job_name || 'Công việc không tên') === jName && info.dateKey === dKey
                })
            } else if (selectedJobName) {
                list = list.filter((img) => (img.job_name || 'Công việc không tên') === selectedJobName)
            }
        } else if (selectedTreeJob) {
            const [dKey, sId] = selectedTreeJob.split('::')
            list = list.filter((img) => {
                const info = getImageDayInfo(img.captured_at)
                return info.dateKey === dKey && img.shift_id === sId
            })
        } else if (selectedTreeDate) {
            list = list.filter((img) => getImageDayInfo(img.captured_at).dateKey === selectedTreeDate)
        } else if (selectedTreeMonth) {
            list = list.filter((img) => getImageDayInfo(img.captured_at).monthKey === selectedTreeMonth)
        }

        const normQ = normalizeSearchText(searchText)
        if (!normQ) return list
        const tokens = normQ.split(/\s+/).filter(Boolean)

        // Suy luận Tên sản phẩm / Tên gõ tắt (aliases) / Mã nội bộ -> danh sách SKU khớp
        const matchedSkus = new Set<string>()
        for (const p of products) {
            const pText = normalizeSearchText(`${p.sku} ${p.name} ${p.aliases || ''} ${p.internal_code || ''} ${p.internal_name || ''}`)
            if (tokens.every((t) => pText.includes(t))) {
                matchedSkus.add(normalizeSearchText(p.sku))
            }
        }

        return list.filter((img) => {
            const skuNorm = normalizeSearchText(img.item_sku)
            if (skuNorm && matchedSkus.has(skuNorm)) return true

            const fName = img.folder_id ? folderPathMap.get(img.folder_id) || '' : ''
            const resolvedMeta =
                (skuNorm ? skuToMetaMap.get(skuNorm) : '') ||
                (img.item_name ? nameToMetaMap.get(normalizeSearchText(img.item_name)) : '') ||
                ''
            const dirWord = img.direction === 'in' ? 'nhap' : img.direction === 'out' ? 'xuat' : 'cv dot'
            const { dateLabel } = getImageDayInfo(img.captured_at)
            const hay = normalizeSearchText(
                [
                    img.item_sku,
                    resolvedMeta,
                    img.item_name,
                    img.job_name,
                    img.captured_by_name,
                    img.notes,
                    img.quantity != null ? String(img.quantity) : '',
                    img.unit,
                    dirWord,
                    dateLabel,
                    fName,
                ]
                    .filter(Boolean)
                    .join(' ')
            )
            return tokens.every((t) => hay.includes(t))
        })
    }, [images, searchText, folderPathMap, products, skuToMetaMap, nameToMetaMap, treeMode, selectedTreeMonth, selectedTreeDate, selectedTreeJob, selectedJobName, selectedJobDateKey])

    const unsyncedIds = useMemo(
        () => filteredImages.filter((img) => !img.drive_file_id).map((img) => img.id),
        [filteredImages]
    )

    const searchSuggestions = useMemo(() => {
        const normQ = normalizeSearchText(searchText)
        if (!normQ) return []
        const tokens = normQ.split(/\s+/).filter(Boolean)

        const skuCountMap = new Map<string, number>()
        const nameCountMap = new Map<string, number>()
        const jobMap = new Map<string, number>()
        for (const img of images) {
            if (img.item_sku) {
                const k = normalizeSearchText(img.item_sku)
                skuCountMap.set(k, (skuCountMap.get(k) || 0) + 1)
            }
            if (img.item_name) {
                const k = normalizeSearchText(img.item_name)
                nameCountMap.set(k, (nameCountMap.get(k) || 0) + 1)
            }
            if (img.job_name) {
                jobMap.set(img.job_name, (jobMap.get(img.job_name) || 0) + 1)
            }
        }

        type SuggestionItem = {
            kind: 'product' | 'job'
            key: string
            value: string
            title: string
            sku?: string
            aliases?: string | null
            imageCount: number
            score: number
        }

        const results: SuggestionItem[] = []
        for (const p of products) {
            const aliasesNorm = normalizeSearchText(p.aliases || '')
            const skuNorm = normalizeSearchText(p.sku)
            const internalNorm = normalizeSearchText(`${p.internal_code || ''} ${p.internal_name || ''}`)
            const nameNorm = normalizeSearchText(p.name)
            const fullNorm = `${aliasesNorm} ${skuNorm} ${internalNorm} ${nameNorm}`
            if (!tokens.every((t) => fullNorm.includes(t))) continue

            const imgCount = (skuNorm ? skuCountMap.get(skuNorm) : 0) || nameCountMap.get(nameNorm) || 0
            let score = imgCount > 0 ? 10 : 0
            if (aliasesNorm && tokens.every((t) => aliasesNorm.includes(t))) score += 50
            if (aliasesNorm && aliasesNorm.startsWith(normQ)) score += 30
            if (skuNorm && tokens.every((t) => skuNorm.includes(t))) score += 20

            results.push({
                kind: 'product',
                key: `p-${p.sku}`,
                value: p.name,
                title: p.name,
                sku: p.sku,
                aliases: p.aliases,
                imageCount: imgCount,
                score,
            })
        }

        for (const [jobName, cnt] of jobMap.entries()) {
            const jNorm = normalizeSearchText(jobName)
            if (tokens.every((t) => jNorm.includes(t))) {
                results.push({
                    kind: 'job',
                    key: `j-${jobName}`,
                    value: jobName,
                    title: jobName,
                    imageCount: cnt,
                    score: 5 + cnt,
                })
            }
        }

        return results.sort((a, b) => b.score - a.score || b.imageCount - a.imageCount).slice(0, 10)
    }, [searchText, products, images])

    const groupedAlbums = useMemo(() => {
        const map = new Map<
            string,
            { key: string; shiftId: string; dateLabel: string; jobName: string; latestAt: string; items: OperationImageRecord[] }
        >()
        for (const img of filteredImages) {
            const { dateKey, dateLabel } = getImageDayInfo(img.captured_at)
            const key = `${dateKey}::${img.shift_id}`
            const existing = map.get(key)
            if (existing) {
                existing.items.push(img)
            } else {
                map.set(key, {
                    key,
                    shiftId: img.shift_id,
                    dateLabel,
                    jobName: img.job_name || 'Công việc không tên',
                    latestAt: img.captured_at,
                    items: [img],
                })
            }
        }
        return Array.from(map.values())
    }, [filteredImages])

    const handleCreateFolder = async (parentId: string | null = selectedFolderId) => {
        if (!newFolderName.trim() || !currentSystem?.code || creatingFolder) return
        setCreatingFolder(true)
        try {
            const created = await createOperationFolder({
                systemCode: currentSystem.code,
                companyId: profile?.company_id,
                parentId,
                name: newFolderName.trim(),
                userId: profile?.id,
                userName: profile?.full_name || 'Nhân viên',
            })
            setNewFolderName('')
            await fetchFolders()
            setSelectedFolderId(created.id)
        } catch (err: any) {
            alert('Lỗi tạo thư mục: ' + (err?.message || err))
        } finally {
            setCreatingFolder(false)
        }
    }

    const handleRenameFolder = async (folder: OperationFolder) => {
        const nextName = prompt('Nhập tên mới cho thư mục:', folder.name)
        if (!nextName || !nextName.trim() || nextName.trim() === folder.name) return
        try {
            await renameOperationFolder(folder.id, nextName.trim())
            await fetchFolders()
        } catch (err: any) {
            alert('Lỗi đổi tên thư mục: ' + (err?.message || err))
        }
    }

    const handleDeleteFolder = async (folder: OperationFolder) => {
        if (!confirm(`Xóa thư mục "${folder.name}"? (Ảnh bên trong vẫn được giữ lại ở mục Tất cả)`)) return
        try {
            await deleteOperationFolder(folder.id)
            if (selectedFolderId === folder.id) {
                setSelectedFolderId(folder.parent_id || null)
            }
            await fetchFolders()
            await fetchImages()
        } catch (err: any) {
            alert('Lỗi xóa thư mục: ' + (err?.message || err))
        }
    }

    const handleUploadFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0 || !currentSystem?.code) return
        if (!uploadShiftId) {
            alert('Vui lòng chọn Công việc cần gắn ảnh trước khi tải lên.')
            return
        }
        const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return
        const targetShift = shifts.find((s) => s.id === uploadShiftId)
        const jobName = targetShift?.summary_data?.job_name || targetShift?.notes || 'Công việc'

        setUploading(true)
        try {
            await uploadOperationImages({
                files,
                systemCode: currentSystem.code,
                companyId: profile?.company_id,
                shiftId: uploadShiftId,
                folderId: selectedFolderId,
                scope: 'shift',
                jobName,
                capturedBy: profile?.id,
                capturedByName: profile?.full_name || profile?.email || 'Nhân viên',
                notes: 'Tải lên từ trang Album',
            })
            await fetchImages()
        } catch (err: any) {
            alert('Lỗi tải ảnh lên: ' + (err?.message || err))
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (img: OperationImageRecord) => {
        if (!confirm('Xác nhận xóa vĩnh viễn hình ảnh chứng minh này?')) return
        try {
            await deleteOperationImage(img)
            if (selectedImage?.id === img.id) setSelectedImage(null)
            await fetchImages()
        } catch (err: any) {
            alert('Lỗi xóa ảnh: ' + (err?.message || err))
        }
    }

    const handleMoveImageFolder = async (imgId: string, nextFolderId: string | null) => {
        try {
            await moveOperationImageToFolder(imgId, nextFolderId)
            await fetchImages()
            if (selectedImage?.id === imgId) {
                setSelectedImage((prev) => (prev ? { ...prev, folder_id: nextFolderId } : null))
            }
        } catch (err: any) {
            alert('Lỗi chuyển thư mục: ' + (err?.message || err))
        }
    }

    const handleSyncDrive = async (ids: string[]) => {
        if (!currentSystem?.code || ids.length === 0 || syncingDrive) return
        if (!driveSettings.webhook_url?.trim()) {
            setDriveModalOpen(true)
            return
        }
        setSyncingDrive(true)
        try {
            const res = await syncImagesToGoogleDrive(ids, currentSystem.code)
            await fetchImages()
            if (selectedImage && ids.includes(selectedImage.id)) {
                const updated = images.find((i) => i.id === selectedImage.id)
                if (updated) setSelectedImage(updated)
            }
            if (res.failedCount > 0) {
                alert(`Đã đẩy ${res.syncedCount} ảnh lên Google Drive. Lỗi ${res.failedCount} ảnh:\n${res.errors.slice(0, 3).join('\n')}`)
            } else {
                alert(`Đã đồng bộ thành công ${res.syncedCount} ảnh lên Google Drive!`)
            }
        } catch (err: any) {
            alert('Lỗi đồng bộ Drive: ' + (err?.message || err))
        } finally {
            setSyncingDrive(false)
        }
    }

    const handleSaveDriveSettings = async () => {
        if (!currentSystem?.code || savingDrive) return
        setSavingDrive(true)
        try {
            await saveDriveSettings({
                ...driveSettings,
                system_code: currentSystem.code,
                company_id: profile?.company_id || null,
                userId: profile?.id || null,
            })
            alert('Đã lưu cấu hình Google Drive!')
            setDriveModalOpen(false)
        } catch (err: any) {
            alert('Lỗi lưu cấu hình: ' + (err?.message || err))
        } finally {
            setSavingDrive(false)
        }
    }

    const handleTestDrive = async () => {
        if (!driveSettings.webhook_url?.trim() || testingDrive) {
            alert('Vui lòng nhập Webhook URL trước khi kiểm tra.')
            return
        }
        setTestingDrive(true)
        try {
            const res = await testGoogleDriveWebhook(
                driveSettings.webhook_url.trim(),
                driveSettings.root_folder_name || 'WMS_HinhAnh_Kho'
            )
            if (res.success) {
                alert('Kết nối Google Drive thành công!')
            } else {
                alert('Kết nối thất bại: ' + (res.error || 'Không rõ nguyên nhân'))
            }
        } catch (err: any) {
            alert('Lỗi kiểm tra kết nối: ' + (err?.message || err))
        } finally {
            setTestingDrive(false)
        }
    }

    const handleCopyScript = async () => {
        try {
            await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE)
            setCopiedScript(true)
            setTimeout(() => setCopiedScript(false), 2000)
        } catch {
            alert('Không thể tự động copy, vui lòng chọn và copy thủ công.')
        }
    }

    const childFolders = useMemo(
        () => folders.filter((f) => (f.parent_id || null) === selectedFolderId),
        [folders, selectedFolderId]
    )

    const breadcrumbFolders = useMemo(() => {
        const chain: OperationFolder[] = []
        let curId = selectedFolderId
        let guard = 0
        while (curId && guard < 10) {
            const f = folders.find((item) => item.id === curId)
            if (!f) break
            chain.unshift(f)
            curId = f.parent_id || null
            guard++
        }
        return chain
    }, [folders, selectedFolderId])

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <Link href="/so-lieu" className="inline-flex items-center gap-1 hover:text-sky-600 font-semibold">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Quay lại Số liệu
                        </Link>
                        <span>/</span>
                        <span>{currentSystem?.name || currentSystem?.code || 'Kho'}</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <Images className="w-6 h-6 text-sky-500" />
                        Album & Thư Mục Hình Ảnh
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Quản lý cây thư mục ảnh chứng minh nhập xuất và đồng bộ lên Google Drive.
                    </p>
                </div>

                {/* Upload nhanh + Google Drive */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 shadow-sm">
                        <select
                            value={uploadShiftId}
                            onChange={(e) => setUploadShiftId(e.target.value)}
                            className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 max-w-[180px]"
                        >
                            {shifts.length === 0 && <option value="">Chưa có công việc</option>}
                            {shifts.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.summary_data?.job_name || s.notes || 'Công việc'} ({new Date(s.opened_at).toLocaleDateString('vi-VN')})
                                </option>
                            ))}
                        </select>
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                                handleUploadFiles(e.target.files)
                                e.target.value = ''
                            }}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                handleUploadFiles(e.target.files)
                                e.target.value = ''
                            }}
                        />
                        <button
                            type="button"
                            disabled={uploading || !uploadShiftId}
                            onClick={() => cameraInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
                        >
                            <Camera className="w-3.5 h-3.5" />
                            Chụp
                        </button>
                        <button
                            type="button"
                            disabled={uploading || !uploadShiftId}
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                            Tải ảnh
                        </button>
                    </div>

                    <button
                        type="button"
                        disabled={syncingDrive || unsyncedIds.length === 0}
                        onClick={() => handleSyncDrive(unsyncedIds)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 shadow-sm"
                        title="Đẩy toàn bộ ảnh chưa đồng bộ trong danh sách hiện tại lên Google Drive"
                    >
                        {syncingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                        Đẩy Drive ({unsyncedIds.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setDriveModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm"
                    >
                        <Settings className="w-4 h-4 text-slate-500" />
                        Cài đặt Drive
                    </button>
                </div>
            </div>

            {/* Cây Thư Mục / Album Đa Cấp */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setSelectedFolderId(null)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                                selectedFolderId === null
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                        >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Tất cả thư mục
                        </button>
                        {breadcrumbFolders.map((bf) => (
                            <React.Fragment key={bf.id}>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                <button
                                    type="button"
                                    onClick={() => setSelectedFolderId(bf.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                                        selectedFolderId === bf.id
                                            ? 'bg-sky-600 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    <Folder className="w-3.5 h-3.5" />
                                    {bf.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder(selectedFolderId)
                            }}
                            placeholder={selectedFolderId ? 'Tên thư mục con mới...' : 'Tên thư mục mới...'}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 w-44 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                            type="button"
                            disabled={!newFolderName.trim() || creatingFolder}
                            onClick={() => handleCreateFolder(selectedFolderId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 dark:bg-sky-600 hover:bg-slate-900 text-white disabled:opacity-40"
                        >
                            <FolderPlus className="w-3.5 h-3.5" />
                            Tạo
                        </button>
                    </div>
                </div>

                {childFolders.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {childFolders.map((folder) => (
                            <div
                                key={folder.id}
                                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-sky-400 transition-colors"
                            >
                                <button
                                    type="button"
                                    onClick={() => setSelectedFolderId(folder.id)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
                                >
                                    <Folder className="w-4 h-4 text-amber-500" />
                                    {folder.name}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRenameFolder(folder)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-sky-500"
                                    title="Đổi tên"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteFolder(folder)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500"
                                    title="Xóa thư mục"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bộ lọc */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(e) => {
                            setSearchText(e.target.value)
                            setSearchFocused(true)
                        }}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setSearchFocused(false)
                        }}
                        placeholder="Tìm theo tên gõ tắt (alias), mã SP, tên SP, công việc, ngày..."
                        className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {searchText && (
                        <button
                            type="button"
                            onClick={() => setSearchText('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title="Xóa từ khóa"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    {searchFocused && searchText.trim().length > 0 && searchSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                            <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800">
                                Gợi ý sản phẩm / công việc ({searchSuggestions.length})
                            </div>
                            {searchSuggestions.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        setSearchText(item.value)
                                        setSearchFocused(false)
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-sky-50 dark:hover:bg-sky-900/30 flex items-center justify-between gap-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800/70 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${item.kind === 'product' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'}`}>
                                                {item.kind === 'product' ? 'SP' : 'CV'}
                                            </span>
                                            {item.aliases && (
                                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                                    {item.aliases}
                                                </span>
                                            )}
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                                {item.title}
                                            </span>
                                        </div>
                                        {item.sku && (
                                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                                SKU: {item.sku}
                                            </div>
                                        )}
                                    </div>
                                    {item.imageCount > 0 && (
                                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                            {item.imageCount} ảnh
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'in', label: 'Nhập' },
                            { key: 'out', label: 'Xuất' },
                            { key: 'shift', label: 'CV / Đợt' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setDirection(tab.key as any)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                    direction === tab.key
                                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setViewMode('album')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                viewMode === 'album'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            Album
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                viewMode === 'grid'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500'
                            }`}
                        >
                            <Grid3X3 className="w-3.5 h-3.5" />
                            Lưới
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fetchImages}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        title="Làm mới"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Bố cục 2 cột: Cây Thư Mục (Trái) + Album/Lưới Ảnh (Phải) */}
            <div className="flex flex-col lg:flex-row gap-4 items-start">
                {/* Cột Trái: Cây thư mục tự động (Theo Ngày hoặc Theo Công Việc) */}
                <aside className="w-full lg:w-72 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                            {treeMode === 'date' ? 'Cây thư mục theo ngày' : 'Cây thư mục theo việc'}
                        </span>
                        {(selectedTreeMonth || selectedTreeDate || selectedTreeJob || selectedJobName || selectedJobDateKey) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedTreeMonth(null)
                                    setSelectedTreeDate(null)
                                    setSelectedTreeJob(null)
                                    setSelectedJobName(null)
                                    setSelectedJobDateKey(null)
                                }}
                                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                            >
                                Xem tất cả
                            </button>
                        )}
                    </div>

                    {/* Chuyển đổi cấu trúc cây: Theo Ngày <-> Theo Công Việc */}
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                        <button
                            type="button"
                            onClick={() => {
                                setTreeMode('date')
                                setSelectedJobName(null)
                                setSelectedJobDateKey(null)
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                                treeMode === 'date'
                                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            Ngày → Việc
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setTreeMode('job')
                                setSelectedTreeMonth(null)
                                setSelectedTreeDate(null)
                                setSelectedTreeJob(null)
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                                treeMode === 'job'
                                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            Việc → Ngày
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedTreeMonth(null)
                            setSelectedTreeDate(null)
                            setSelectedTreeJob(null)
                            setSelectedJobName(null)
                            setSelectedJobDateKey(null)
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                            !selectedTreeMonth && !selectedTreeDate && !selectedTreeJob && !selectedJobName && !selectedJobDateKey
                                ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-sky-500" />
                            Tất cả ngày &amp; công việc
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {images.length}
                        </span>
                    </button>

                    {treeMode === 'job' ? (
                        autoJobTree.length === 0 ? (
                            <p className="text-xs text-slate-400 px-2 py-3 text-center">
                                Chưa có dữ liệu ảnh trong khoảng ngày này
                            </p>
                        ) : (
                            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-0.5">
                                {autoJobTree.map((jobNode, jIdx) => {
                                    const isJobOpen = expandedJobNames[jobNode.jobName] ?? jIdx === 0
                                    const isJobSelected = selectedJobName === jobNode.jobName && !selectedJobDateKey
                                    return (
                                        <div key={jobNode.jobName} className="space-y-0.5">
                                            <div
                                                className={`flex items-center gap-1 px-1.5 py-1.5 rounded-xl text-xs transition-colors ${
                                                    isJobSelected
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold'
                                                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedJobNames((prev) => ({
                                                            ...prev,
                                                            [jobNode.jobName]: !isJobOpen,
                                                        }))
                                                    }
                                                    className="p-0.5 text-slate-400 hover:text-slate-600"
                                                >
                                                    {isJobOpen ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedJobName(jobNode.jobName)
                                                        setSelectedJobDateKey(null)
                                                        setExpandedJobNames((prev) => ({ ...prev, [jobNode.jobName]: true }))
                                                    }}
                                                    className="flex-1 flex items-center justify-between text-left min-w-0"
                                                >
                                                    <span className="flex items-center gap-1.5 truncate">
                                                        <FolderOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                        <span className="truncate">{jobNode.jobName}</span>
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 ml-1 shrink-0">{jobNode.count}</span>
                                                </button>
                                            </div>

                                            {isJobOpen && (
                                                <div className="pl-4 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-3">
                                                    {jobNode.dates.map((dt) => {
                                                        const key = `${jobNode.jobName}::${dt.dateKey}`
                                                        const activeDate = selectedJobDateKey === key
                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedJobName(jobNode.jobName)
                                                                    setSelectedJobDateKey(key)
                                                                }}
                                                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors ${
                                                                    activeDate
                                                                        ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800'
                                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5 truncate">
                                                                    <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                                                                    <span className="truncate">{dt.dateLabel}</span>
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 ml-1 shrink-0">{dt.count}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    ) : autoFolderTree.length === 0 ? (
                        <p className="text-xs text-slate-400 px-2 py-3 text-center">
                            Chưa có dữ liệu ảnh trong khoảng ngày này
                        </p>
                    ) : (
                        <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-0.5">
                            {autoFolderTree.map((month, mIdx) => {
                                const isMonthOpen = expandedMonths[month.monthKey] ?? mIdx === 0
                                const isMonthSelected =
                                    selectedTreeMonth === month.monthKey && !selectedTreeDate && !selectedTreeJob
                                return (
                                    <div key={month.monthKey} className="space-y-0.5">
                                        <div
                                            className={`flex items-center gap-1 px-1.5 py-1.5 rounded-xl text-xs transition-colors ${
                                                isMonthSelected
                                                    ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-bold'
                                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedMonths((prev) => ({
                                                        ...prev,
                                                        [month.monthKey]: !isMonthOpen,
                                                    }))
                                                }
                                                className="p-0.5 text-slate-400 hover:text-slate-600"
                                            >
                                                {isMonthOpen ? (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedTreeMonth(month.monthKey)
                                                    setSelectedTreeDate(null)
                                                    setSelectedTreeJob(null)
                                                    setExpandedMonths((prev) => ({ ...prev, [month.monthKey]: true }))
                                                }}
                                                className="flex-1 flex items-center justify-between text-left"
                                            >
                                                <span className="flex items-center gap-1.5 truncate">
                                                    <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                    <span className="truncate">{month.monthLabel}</span>
                                                </span>
                                                <span className="text-[11px] text-slate-400 ml-1">{month.count}</span>
                                            </button>
                                        </div>

                                        {isMonthOpen && (
                                            <div className="pl-4 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-3">
                                                {month.dates.map((dt, dIdx) => {
                                                    const isDateOpen = expandedDates[dt.dateKey] ?? (mIdx === 0 && dIdx === 0)
                                                    const isDateSelected =
                                                        selectedTreeDate === dt.dateKey && !selectedTreeJob
                                                    return (
                                                        <div key={dt.dateKey} className="space-y-0.5">
                                                            <div
                                                                className={`flex items-center gap-1 px-1.5 py-1.5 rounded-xl text-xs transition-colors ${
                                                                    isDateSelected
                                                                        ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-bold'
                                                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                                                                }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setExpandedDates((prev) => ({
                                                                            ...prev,
                                                                            [dt.dateKey]: !isDateOpen,
                                                                        }))
                                                                    }
                                                                    className="p-0.5 text-slate-400 hover:text-slate-600"
                                                                >
                                                                    {isDateOpen ? (
                                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                                    )}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedTreeMonth(month.monthKey)
                                                                        setSelectedTreeDate(dt.dateKey)
                                                                        setSelectedTreeJob(null)
                                                                        setExpandedDates((prev) => ({
                                                                            ...prev,
                                                                            [dt.dateKey]: true,
                                                                        }))
                                                                    }}
                                                                    className="flex-1 flex items-center justify-between text-left"
                                                                >
                                                                    <span className="flex items-center gap-1.5 truncate">
                                                                        <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                                        <span className="truncate">{dt.dateLabel}</span>
                                                                    </span>
                                                                    <span className="text-[11px] text-slate-400 ml-1">
                                                                        {dt.count}
                                                                    </span>
                                                                </button>
                                                            </div>

                                                            {isDateOpen && (
                                                                <div className="pl-4 space-y-0.5 border-l border-slate-200 dark:border-slate-800 ml-3">
                                                                    {dt.jobs.map((job) => {
                                                                        const activeJob = selectedTreeJob === job.jobKey
                                                                        return (
                                                                            <button
                                                                                key={job.jobKey}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSelectedTreeMonth(month.monthKey)
                                                                                    setSelectedTreeDate(dt.dateKey)
                                                                                    setSelectedTreeJob(job.jobKey)
                                                                                }}
                                                                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors ${
                                                                                    activeJob
                                                                                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800'
                                                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                }`}
                                                                            >
                                                                                <span className="flex items-center gap-1.5 truncate">
                                                                                    <FolderOpen className="w-3 h-3 text-emerald-500 shrink-0" />
                                                                                    <span className="truncate">
                                                                                        {job.jobName}
                                                                                    </span>
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 ml-1 shrink-0">
                                                                                    {job.count}
                                                                                </span>
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </aside>

                {/* Cột Phải: Breadcrumb + Thống kê + Danh sách Album / Lưới ảnh */}
                <div className="flex-1 w-full space-y-3">
                    {/* Thống kê & Đường dẫn thư mục đang chọn */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {treeMode === 'job' && selectedJobDateKey
                                    ? `${selectedJobName || 'Công việc'} › ${selectedJobDateKey.slice(selectedJobDateKey.lastIndexOf('::') + 2).split('-').reverse().join('/')}`
                                    : treeMode === 'job' && selectedJobName
                                    ? `Công việc: ${selectedJobName}`
                                    : selectedTreeJob
                                    ? `${
                                          autoFolderTree
                                              .flatMap((m) => m.dates)
                                              .find((d) => d.dateKey === selectedTreeDate)?.dateLabel || ''
                                      } › ${groupedAlbums[0]?.jobName || 'Công việc'}`
                                    : selectedTreeDate
                                    ? `Ngày ${
                                          autoFolderTree
                                              .flatMap((m) => m.dates)
                                              .find((d) => d.dateKey === selectedTreeDate)?.dateLabel || selectedTreeDate
                                      }`
                                    : selectedTreeMonth
                                    ? autoFolderTree.find((m) => m.monthKey === selectedTreeMonth)?.monthLabel ||
                                      selectedTreeMonth
                                    : treeMode === 'job'
                                    ? 'Tất cả công việc'
                                    : 'Tất cả ngày'}
                            </span>
                            <span>•</span>
                            <span>
                                Hiển thị <strong className="text-slate-800 dark:text-slate-200">{filteredImages.length}</strong> ảnh trong{' '}
                                <strong className="text-slate-800 dark:text-slate-200">{groupedAlbums.length}</strong> nhóm
                            </span>
                        </div>
                        <span className="inline-flex items-center gap-1.5">
                            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                            Đã đồng bộ Drive:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                                {filteredImages.length - unsyncedIds.length}/{filteredImages.length}
                            </strong>
                        </span>
                    </div>

                    {/* Nội dung */}
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                            <span className="text-sm">Đang tải thư viện hình ảnh...</span>
                        </div>
                    ) : filteredImages.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <FolderOpen className="w-12 h-12 opacity-40" />
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                Chưa có hình ảnh nào trong mục này
                            </p>
                        </div>
                    ) : viewMode === 'album' ? (
                        <div className="space-y-4">
                            {groupedAlbums.map((album) => (
                                <div
                                    key={album.key}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
                                >
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                    {album.dateLabel}
                                                </span>
                                                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                                    {album.jobName}
                                                </h2>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {album.items.length} hình ảnh • Cập nhật:{' '}
                                                {new Date(album.latestAt).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                                        {album.items.map((img) => (
                                            <ImageTile key={img.id} img={img} onClick={() => setSelectedImage(img)} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {filteredImages.map((img) => (
                                <ImageTile key={img.id} img={img} onClick={() => setSelectedImage(img)} showJob />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[130] bg-black/95 flex flex-col justify-between p-4 sm:p-6"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="flex flex-wrap items-center justify-between text-white gap-3" onClick={(e) => e.stopPropagation()}>
                        <div className="min-w-0">
                            <p className="font-bold text-sm sm:text-base truncate">
                                {selectedImage.job_name || 'Công việc'}
                                {selectedImage.item_name
                                    ? ` • ${selectedImage.item_name} (${selectedImage.quantity ?? ''} ${selectedImage.unit || ''})`
                                    : ''}
                            </p>
                            <p className="text-xs text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                                <span>{selectedImage.captured_by_name || 'Nhân viên'}</span>
                                <span>•</span>
                                <span>{new Date(selectedImage.captured_at).toLocaleString('vi-VN')}</span>
                                {selectedImage.drive_web_url ? (
                                    <a
                                        href={selectedImage.drive_web_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                                    >
                                        <Cloud className="w-3.5 h-3.5" /> Mở trên Drive <ExternalLink className="w-3 h-3" />
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={syncingDrive}
                                        onClick={() => handleSyncDrive([selectedImage.id])}
                                        className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                                    >
                                        <CloudUpload className="w-3.5 h-3.5" /> Đẩy lên Drive
                                    </button>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2 py-1">
                                <FolderInput className="w-4 h-4 text-amber-300" />
                                <select
                                    value={selectedImage.folder_id || ''}
                                    onChange={(e) => handleMoveImageFolder(selectedImage.id, e.target.value || null)}
                                    className="bg-transparent text-xs text-white focus:outline-none"
                                >
                                    <option value="" className="text-slate-900">Chưa phân thư mục</option>
                                    {folders.map((f) => (
                                        <option key={f.id} value={f.id} className="text-slate-900">
                                            {folderPathMap.get(f.id) || f.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <a
                                href={getOperationImageDisplayUrl(selectedImage)}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                                title="Tải ảnh"
                            >
                                <Download className="w-5 h-5" />
                            </a>
                            <button
                                type="button"
                                onClick={() => handleDelete(selectedImage)}
                                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300"
                                title="Xóa ảnh"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedImage(null)}
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div
                        className="flex-1 flex items-center justify-center my-4 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={getOperationImageDisplayUrl(selectedImage)}
                            alt={selectedImage.item_name || 'Ảnh chứng minh'}
                            className="max-w-full max-h-[80vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}

            {/* Modal Cài đặt Google Drive */}
            {driveModalOpen && (
                <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Cloud className="w-5 h-5 text-emerald-500" />
                                Cài Đặt Đồng Bộ Google Drive ({currentSystem?.code})
                            </h3>
                            <button
                                type="button"
                                onClick={() => setDriveModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto text-sm">
                            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                                <p className="font-bold">💡 Cơ chế lưu trữ Google Drive &amp; dùng chung đa thiết bị:</p>
                                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                                    <li>Ảnh <strong>không lưu lên server</strong>: giữ trên máy nhân viên khi offline và tự động đẩy thẳng lên Google Drive khi có mạng.</li>
                                    <li>Bạn <strong>chỉ cần cài đặt 1 lần tại đây</strong>: App điện thoại (Android APK) và iOS Web của kho <strong>{currentSystem?.code}</strong> sẽ tự động dùng chung cấu hình này.</li>
                                </ul>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Google Apps Script Webhook URL
                                </label>
                                <input
                                    type="url"
                                    value={driveSettings.webhook_url || ''}
                                    onChange={(e) => setDriveSettings((prev) => ({ ...prev, webhook_url: e.target.value }))}
                                    placeholder="https://script.google.com/macros/s/.../exec"
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Tên thư mục gốc trên Google Drive
                                </label>
                                <input
                                    type="text"
                                    value={driveSettings.root_folder_name || ''}
                                    onChange={(e) => setDriveSettings((prev) => ({ ...prev, root_folder_name: e.target.value }))}
                                    placeholder="WMS_HinhAnh_Kho"
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Ảnh sẽ được sắp xếp tự động theo cấu trúc: <code>{driveSettings.root_folder_name || 'WMS_HinhAnh_Kho'} / Mã_Kho / Năm-Tháng / Thư_Mục_hoặc_Công_Việc</code>
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Lưu ý: Trên App điện thoại, file nén tạm luôn tự xóa ngay sau khi đẩy lên Drive; mỗi nhân viên có thể tự chọn số ngày giữ/xóa ảnh gốc ngay trên máy của mình.
                                </p>
                            </div>

                            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/25 p-3.5 space-y-2 text-xs text-slate-700 dark:text-slate-200">
                                <div className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center justify-between">
                                    <span>📘 Hướng dẫn cài đặt từng bước (chỉ làm 1 lần)</span>
                                    <a
                                        href="https://script.google.com"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        Mở script.google.com
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                                <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                                    <li>
                                        Bấm nút <strong>Copy Script</strong> ở khung bên dưới.
                                    </li>
                                    <li>
                                        Mở <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">script.google.com</a> → tạo <strong>Dự án mới (New project)</strong> → xóa code mặc định, dán toàn bộ script vào file <code>Code.gs</code> và bấm <strong>Lưu (Ctrl + S)</strong>.
                                    </li>
                                    <li>
                                        Trên thanh công cụ phía trên, chọn hàm <code>khoiTaoQuyenDrive</code> → bấm <strong>Chạy (Run)</strong> → Chọn tài khoản Google → <em>Nâng cao (Advanced)</em> → <em>Đi tới dự án (không an toàn)</em> → <strong>Cho phép (Allow)</strong> để cấp quyền Google Drive.
                                    </li>
                                    <li>
                                        Bấm <strong>Triển khai (Deploy)</strong> → <strong>Tạo bản triển khai mới (New deployment)</strong> → Loại: <strong>Ứng dụng web (Web app)</strong>:
                                        <div className="mt-0.5 pl-2 text-slate-600 dark:text-slate-300">
                                            • Thực thi dưới tư cách (<em>Execute as</em>): <strong>Tôi (Me)</strong><br />
                                            • Ai có quyền truy cập (<em>Who has access</em>): <strong>Bất kỳ ai (Anyone)</strong>
                                        </div>
                                    </li>
                                    <li>
                                        Copy <strong>URL ứng dụng web</strong> (dạng <code>https://script.google.com/macros/s/.../exec</code>) dán vào ô <strong>Google Apps Script Webhook URL</strong> ở trên.
                                    </li>
                                    <li>
                                        Bấm <strong>Kiểm tra kết nối</strong> → thấy báo thành công thì bấm <strong>Lưu cấu hình</strong>.
                                    </li>
                                </ol>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-lg px-2.5 py-1.5">
                                    <strong>Mẹo khi cập nhật script mới:</strong> Dán đè code mới và lưu lại → vào <strong>Deploy → Manage deployments</strong> → bấm biểu tượng cây bút (Edit) → chọn Version: <strong>New version</strong> → bấm <strong>Deploy</strong> (sẽ giữ nguyên được URL cũ).
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                        Mẫu Google Apps Script (Copy & Dán vào script.google.com)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyScript}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copiedScript ? 'Đã copy!' : 'Copy Script'}
                                    </button>
                                </div>
                                <pre className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 max-h-40 overflow-auto">
                                    {GOOGLE_APPS_SCRIPT_TEMPLATE}
                                </pre>
                            </div>
                        </div>

                        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                disabled={testingDrive}
                                onClick={handleTestDrive}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                            >
                                {testingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Kiểm tra kết nối
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDriveModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    disabled={savingDrive}
                                    onClick={handleSaveDriveSettings}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5"
                                >
                                    {savingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                    Lưu cấu hình
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ImageTile({
    img,
    onClick,
    showJob = false,
}: {
    img: OperationImageRecord
    onClick: () => void
    showJob?: boolean
}) {
    return (
        <div
            onClick={onClick}
            className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer"
        >
            <img
                src={getOperationImageDisplayUrl(img)}
                alt={img.item_name || img.job_name || 'Ảnh'}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {img.drive_file_id && (
                <div
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow"
                    title="Đã đồng bộ Google Drive"
                >
                    <Cloud className="w-3.5 h-3.5" />
                </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                <div className="flex items-center gap-1 mb-0.5">
                    {img.direction === 'in' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500">NHẬP</span>
                    )}
                    {img.direction === 'out' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500">XUẤT</span>
                    )}
                    {img.scope !== 'journal' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500">
                            {img.scope === 'sub_shift' ? 'ĐỢT' : 'CV'}
                        </span>
                    )}
                </div>
                <p className="text-[11px] font-semibold truncate">
                    {img.item_name
                        ? `${img.item_name} (${img.quantity ?? ''} ${img.unit || ''})`
                        : showJob
                        ? img.job_name || 'Ảnh công việc'
                        : img.notes || 'Ảnh công việc'}
                </p>
            </div>
        </div>
    )
}
