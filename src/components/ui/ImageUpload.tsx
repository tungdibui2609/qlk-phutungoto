'use client'

import React, { useState, useRef } from 'react'
import { Upload, X, Camera, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

interface ImageUploadProps {
    value: string[]
    onChange: (value: string[]) => void
    maxFiles?: number
    disabled?: boolean
}

export function ImageUpload({ value = [], onChange, maxFiles = 5, disabled = false }: ImageUploadProps) {
    const { showToast } = useToast()
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        if (value.length + files.length > maxFiles) {
            showToast(`Chỉ được tải lên tối đa ${maxFiles} ảnh`, 'error')
            return
        }

        setUploading(true)
        const newUrls: string[] = []

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]

                // Validate size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showToast(`File ${file.name} quá lớn (max 5MB)`, 'warning')
                    continue
                }

                // Validate type
                if (!file.type.startsWith('image/')) {
                    showToast(`File ${file.name} không phải là ảnh`, 'warning')
                    continue
                }

                const formData = new FormData()
                formData.append('file', file)
                formData.append('filename', file.name)

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })

                if (!res.ok) {
                    throw new Error(`Upload failed: ${res.statusText}`)
                }

                const data = await res.json()
                if (data.secureUrl) {
                    newUrls.push(data.secureUrl)
                }
            }

            if (newUrls.length > 0) {
                onChange([...value, ...newUrls])
                showToast('Tải ảnh lên thành công', 'success')
            }
        } catch (error: any) {
            console.error('Upload error:', error)
            showToast('Lỗi khi tải ảnh lên', 'error')
        } finally {
            setUploading(false)
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const removeImage = (index: number) => {
        const newValue = [...value]
        newValue.splice(index, 1)
        onChange(newValue)
    }

    return (
        <div className="space-y-4">
            {/* Image Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {value.map((url, index) => (
                    <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-stone-200 dark:border-zinc-700 bg-stone-100 dark:bg-zinc-800">
                        <img
                            src={url}
                            alt={`Uploaded ${index + 1}`}
                            className="w-full h-full object-cover transition-transform hover:scale-105"
                        />
                        {!disabled && (
                            <button
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                type="button"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                ))}

                {/* Upload Button */}
                {value.length < maxFiles && !disabled && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-stone-300 dark:border-zinc-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-stone-500 dark:text-gray-400 gap-2 relative overflow-hidden"
                    >
                        {uploading ? (
                            <Loader2 className="animate-spin text-orange-600" size={24} />
                        ) : (
                            <>
                                <Camera className="mb-1" size={24} />
                                <span className="text-xs font-medium text-center px-2">
                                    Thêm ảnh <br />
                                    <span className="text-[10px] opacity-70">hoặc chụp</span>
                                </span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
            />

            <div className="text-[10px] text-stone-400 italic">
                * Hỗ trợ tải lên ảnh (tối đa {maxFiles} ảnh, {"<"} 5MB/ảnh)
            </div>
        </div>
    )
}
