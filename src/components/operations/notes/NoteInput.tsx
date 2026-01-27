'use client'

import { useState, useRef } from 'react'
import { Image as ImageIcon, Send, X, Loader2 } from 'lucide-react'
import { uploadNoteImage } from '@/lib/operationalNotes'

interface NoteInputProps {
    onSubmit: (content: string, images: string[]) => Promise<void>
    placeholder?: string
    autoFocus?: boolean
    onCancel?: () => void
    isReply?: boolean
}

export default function NoteInput({ onSubmit, placeholder = 'Viết ghi chú...', autoFocus = false, onCancel, isReply = false }: NoteInputProps) {
    const [content, setContent] = useState('')
    const [images, setImages] = useState<string[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        setIsUploading(true)
        try {
            const files = Array.from(e.target.files)
            const uploadPromises = files.map(file => uploadNoteImage(file))
            const urls = await Promise.all(uploadPromises)
            setImages(prev => [...prev, ...urls])
        } catch (error) {
            console.error('Error uploading images:', error)
            alert('Upload ảnh thất bại')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim() && images.length === 0) return

        setIsSubmitting(true)
        try {
            await onSubmit(content, images)
            setContent('')
            setImages([])
            if (onCancel) onCancel()
        } catch (error) {
            console.error('Error submitting note:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className={`bg-white rounded-lg border border-stone-200 p-4 ${isReply ? 'mt-3 shadow-sm' : 'shadow-md'}`}>
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                className="w-full resize-none outline-none text-sm text-stone-700 placeholder:text-stone-400 min-h-[80px]"
                autoFocus={autoFocus}
            />

            {/* Image Preview */}
            {images.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto py-2">
                    {images.map((url, idx) => (
                        <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border border-stone-200 group">
                            <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {isUploading && (
                        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center rounded-md border border-stone-200 bg-stone-50">
                            <Loader2 className="animate-spin text-stone-400" size={20} />
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isSubmitting}
                        className="text-stone-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50"
                        title="Thêm hình ảnh"
                    >
                        <ImageIcon size={20} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                    />
                </div>
                <div className="flex items-center gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
                        >
                            Hủy
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={(!content.trim() && images.length === 0) || isSubmitting || isUploading}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <Send size={16} />
                        )}
                        <span>{isReply ? 'Trả lời' : 'Gửi ghi chú'}</span>
                    </button>
                </div>
            </div>
        </form>
    )
}
