'use client'

import React, { useRef, useState } from 'react'
import { Camera, ImagePlus, X, Maximize2 } from 'lucide-react'
import { PendingWebImage } from '@/lib/operationImages'

interface Props {
    images: PendingWebImage[]
    onChange: (next: PendingWebImage[]) => void
    compact?: boolean
    label?: string
}

export default function OperationImageUploader({
    images,
    onChange,
    compact = false,
    label = 'Ảnh chứng minh (không bắt buộc)',
}: Props) {
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const libraryInputRef = useRef<HTMLInputElement>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    const addFiles = (fileList: FileList | File[] | null) => {
        if (!fileList) return
        const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return

        const added: PendingWebImage[] = files.map((file) => ({
            localId: `web_img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            file,
            previewUrl: URL.createObjectURL(file),
        }))
        onChange([...images, ...added])
    }

    const handleRemove = (localId: string) => {
        const target = images.find((i) => i.localId === localId)
        if (target?.previewUrl) {
            URL.revokeObjectURL(target.previewUrl)
        }
        onChange(images.filter((i) => i.localId !== localId))
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return
        const pastedFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                const f = item.getAsFile()
                if (f) pastedFiles.push(f)
            }
        }
        if (pastedFiles.length > 0) {
            e.preventDefault()
            addFiles(pastedFiles)
        }
    }

    return (
        <div
            onPaste={handlePaste}
            className={`rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-800/50 ${
                compact ? 'p-2.5' : 'p-3'
            }`}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {label} {images.length > 0 ? `(${images.length})` : ''}
                </span>
                <div className="flex items-center gap-1.5">
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                            addFiles(e.target.files)
                            e.target.value = ''
                        }}
                    />
                    <input
                        ref={libraryInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            addFiles(e.target.files)
                            e.target.value = ''
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-500/25 transition-colors"
                    >
                        <Camera className="w-3.5 h-3.5" />
                        Chụp ảnh
                    </button>
                    <button
                        type="button"
                        onClick={() => libraryInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
                    >
                        <ImagePlus className="w-3.5 h-3.5" />
                        Chọn ảnh
                    </button>
                </div>
            </div>

            {images.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2.5">
                    {images.map((img) => (
                        <div key={img.localId} className="relative group w-14 h-14">
                            <img
                                src={img.previewUrl}
                                alt="Preview"
                                onClick={() => setPreviewUrl(img.previewUrl)}
                                className="w-14 h-14 object-cover rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer"
                            />
                            <button
                                type="button"
                                onClick={() => handleRemove(img.localId)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow hover:bg-rose-600"
                                title="Bỏ ảnh"
                            >
                                <X className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewUrl(img.previewUrl)}
                                className="hidden group-hover:flex absolute bottom-1 right-1 w-5 h-5 rounded bg-black/60 text-white items-center justify-center"
                                title="Phóng to"
                            >
                                <Maximize2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Hỗ trợ chụp trực tiếp trên điện thoại, chọn từ thư viện hoặc dán (Ctrl+V).
                </p>
            )}

            {previewUrl && (
                <div
                    className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setPreviewUrl(null)}
                >
                    <button
                        type="button"
                        onClick={() => setPreviewUrl(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={previewUrl}
                        alt="Full preview"
                        className="max-w-full max-h-[88vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    )
}
