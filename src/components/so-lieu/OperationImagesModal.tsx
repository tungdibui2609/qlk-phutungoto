'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, ImagePlus, Trash2, Download, X, Loader2, Images } from 'lucide-react'
import {
    OperationImageRecord,
    listOperationImages,
    uploadOperationImages,
    deleteOperationImage,
    getOperationImageDisplayUrl,
} from '@/lib/operationImages'

export interface WebJournalImageTarget {
    journalId: string
    itemName: string
    itemSku?: string | null
    direction: 'in' | 'out'
    quantity: number
    unit: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
    systemCode: string
    companyId?: string | null
    shiftId: string
    jobName: string
    userId?: string | null
    userName?: string | null
    journalTarget?: WebJournalImageTarget | null
    onCountChange?: (count: number) => void
}

export default function OperationImagesModal({
    isOpen,
    onClose,
    systemCode,
    companyId,
    shiftId,
    jobName,
    userId,
    userName,
    journalTarget,
    onCountChange,
}: Props) {
    const [images, setImages] = useState<OperationImageRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'shift'>('all')
    const [selectedImage, setSelectedImage] = useState<OperationImageRecord | null>(null)
    const cameraRef = useRef<HTMLInputElement>(null)
    const libraryRef = useRef<HTMLInputElement>(null)

    const fetchImages = useCallback(async () => {
        if (!systemCode || !shiftId) return
        setLoading(true)
        try {
            const data = await listOperationImages({
                systemCode,
                companyId,
                shiftId,
            })
            setImages(data)
            onCountChange?.(data.length)
        } catch (err) {
            console.error('Error loading operation images:', err)
        } finally {
            setLoading(false)
        }
    }, [systemCode, companyId, shiftId, onCountChange])

    useEffect(() => {
        if (isOpen) {
            fetchImages()
        }
    }, [isOpen, fetchImages])

    if (!isOpen) return null

    const handleUploadFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return
        const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return
        setUploading(true)
        try {
            await uploadOperationImages({
                files,
                systemCode,
                companyId,
                shiftId,
                scope: journalTarget ? 'journal' : 'shift',
                journalId: journalTarget?.journalId || null,
                jobName,
                itemName: journalTarget?.itemName || null,
                itemSku: journalTarget?.itemSku || null,
                direction: journalTarget?.direction || null,
                quantity: journalTarget?.quantity ?? null,
                unit: journalTarget?.unit || null,
                capturedBy: userId,
                capturedByName: userName,
                notes: journalTarget ? `Bổ sung ảnh đợt ${journalTarget.direction === 'in' ? 'Nhập' : 'Xuất'}` : 'Ảnh đính kèm công việc',
            })
            await fetchImages()
        } catch (err: any) {
            alert('Lỗi tải ảnh: ' + (err?.message || err))
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (img: OperationImageRecord) => {
        if (!confirm('Xác nhận xóa hình ảnh chứng minh này?')) return
        try {
            await deleteOperationImage(img)
            if (selectedImage?.id === img.id) setSelectedImage(null)
            await fetchImages()
        } catch (err: any) {
            alert('Lỗi xóa ảnh: ' + (err?.message || err))
        }
    }

    const baseImages = journalTarget
        ? images.filter((img) => img.journal_id === journalTarget.journalId)
        : images

    const filtered = baseImages.filter((img) => {
        if (filter === 'all') return true
        if (filter === 'in') return img.direction === 'in'
        if (filter === 'out') return img.direction === 'out'
        return img.scope === 'shift' || img.scope === 'sub_shift'
    })

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="min-w-0 flex-1 pr-3">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Images className="w-5 h-5 text-sky-500 shrink-0" />
                            {journalTarget ? 'Ảnh & Bổ Sung Ảnh Đợt Phát Sinh' : 'Album Hình Chứng Minh'}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                            {journalTarget
                                ? `${journalTarget.itemName} (${journalTarget.direction === 'in' ? '+' : '-'}${journalTarget.quantity} ${journalTarget.unit})`
                                : jobName}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[
                            { key: 'all', label: `Tất cả (${baseImages.length})` },
                            { key: 'in', label: 'Nhập' },
                            { key: 'out', label: 'Xuất' },
                            { key: 'shift', label: 'Chung CV / Đợt' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilter(tab.key as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                    filter === tab.key
                                        ? 'bg-sky-600 text-white'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            ref={cameraRef}
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
                            ref={libraryRef}
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
                            disabled={uploading}
                            onClick={() => cameraRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                            Chụp ảnh
                        </button>
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => libraryRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                        >
                            <ImagePlus className="w-3.5 h-3.5" />
                            Thêm ảnh
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                            <span className="text-sm">Đang tải album ảnh...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Images className="w-12 h-12 opacity-40" />
                            <p className="text-sm font-semibold text-slate-500">Chưa có hình ảnh chứng minh nào</p>
                            <p className="text-xs">Nhấn &ldquo;Chụp ảnh&rdquo; hoặc &ldquo;Thêm ảnh&rdquo; để đính kèm.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {filtered.map((img) => (
                                <div
                                    key={img.id}
                                    onClick={() => setSelectedImage(img)}
                                    className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer"
                                >
                                    <img
                                        src={getOperationImageDisplayUrl(img)}
                                        alt={img.item_name || img.job_name || 'Ảnh chứng minh'}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                                        <div className="flex items-center gap-1 mb-0.5">
                                            {img.direction === 'in' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500">NHẬP</span>
                                            )}
                                            {img.direction === 'out' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500">XUẤT</span>
                                            )}
                                            {img.scope !== 'journal' && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500">
                                                    {img.scope === 'sub_shift' ? 'ĐỢT' : 'CV'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] font-semibold truncate">
                                            {img.item_name ? `${img.item_name} (${img.quantity ?? ''} ${img.unit || ''})` : img.notes || 'Ảnh công việc'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedImage && (
                <div
                    className="fixed inset-0 z-[130] bg-black/95 flex flex-col justify-between p-4 sm:p-6"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="flex items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
                        <div className="text-sm">
                            <p className="font-bold">
                                {selectedImage.item_name
                                    ? `${selectedImage.item_name} — ${selectedImage.quantity ?? ''} ${selectedImage.unit || ''}`
                                    : selectedImage.scope === 'sub_shift'
                                    ? 'Ảnh Đợt Chốt Tạm'
                                    : 'Ảnh Công Việc'}
                            </p>
                            <p className="text-xs text-slate-300">
                                {selectedImage.captured_by_name || 'Nhân viên'} •{' '}
                                {new Date(selectedImage.captured_at).toLocaleString('vi-VN')}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={getOperationImageDisplayUrl(selectedImage)}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                                title="Tải về"
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
                    <div className="flex-1 flex items-center justify-center my-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={getOperationImageDisplayUrl(selectedImage)}
                            alt="Full"
                            className="max-w-full max-h-[80vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
