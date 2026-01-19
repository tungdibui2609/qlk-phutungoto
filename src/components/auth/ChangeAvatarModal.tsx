'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Camera, Loader2, X, Upload, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface ChangeAvatarModalProps {
    isOpen: boolean
    onClose: () => void
    currentUser: any
}

export default function ChangeAvatarModalProps({ isOpen, onClose, currentUser }: ChangeAvatarModalProps) {
    const router = useRouter()
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
            setMessage({ text: 'Ảnh quá lớn (tối đa 5MB)', type: 'error' })
            return
        }

        if (!selectedFile.type.startsWith('image/')) {
            setMessage({ text: 'Vui lòng chọn file ảnh', type: 'error' })
            return
        }

        setFile(selectedFile)
        setPreviewUrl(URL.createObjectURL(selectedFile))
        setMessage(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) {
            setMessage({ text: 'Vui lòng chọn ảnh', type: 'error' })
            return
        }

        setLoading(true)
        setMessage(null)

        try {
            // 1. Upload to API
            const formData = new FormData()
            formData.append('file', file)
            formData.append('filename', `avatar_${currentUser?.id}`)

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            const uploadData = await uploadRes.json()
            if (!uploadRes.ok) throw new Error(uploadData.error || 'Lỗi tải ảnh')

            const newAvatarUrl = uploadData.secureUrl

            // 2. Update Supabase Auth Metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { avatar_url: newAvatarUrl }
            })
            if (authError) throw authError

            // 3. Update user_profiles table
            if (currentUser?.id) {
                const { error: dbError } = await (supabase.from('user_profiles') as any)
                    .update({ avatar_url: newAvatarUrl })
                    .eq('id', currentUser.id)

                if (dbError) console.error('Error updating profile:', dbError)
            }

            setMessage({ text: 'Đổi ảnh đại diện thành công!', type: 'success' })

            // Refresh logic
            setTimeout(() => {
                onClose()
                router.refresh()
                window.location.reload() // Force reload to update header image
            }, 1000)

        } catch (error: any) {
            console.error(error)
            setMessage({ text: error.message || 'Có lỗi xảy ra', type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                    <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                        <Camera className="text-orange-500" size={18} />
                        Đổi ảnh đại diện
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-200 text-stone-500 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {message && (
                        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${message.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                            {message.text}
                        </div>
                    )}

                    {/* Preview Area */}
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className="relative w-32 h-32 rounded-full border-4 border-stone-100 overflow-hidden cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {previewUrl ? (
                                <Image
                                    src={previewUrl}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                />
                            ) : currentUser?.user_metadata?.avatar_url ? (
                                <Image
                                    src={currentUser.user_metadata.avatar_url}
                                    alt="Current"
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-stone-100 flex items-center justify-center text-stone-300">
                                    <ImageIcon size={48} />
                                </div>
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="text-white" size={24} />
                            </div>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-sm font-medium text-orange-600 hover:text-orange-700"
                            >
                                Chọn ảnh mới
                            </button>
                            <p className="text-xs text-stone-400 mt-1">Hỗ trợ JPG, PNG (Max 5MB)</p>
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3 border-t border-stone-100 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !file}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-md hover:shadow-lg transition-all disabled:opacity-70 flex items-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin" size={16} />}
                            <Upload size={16} />
                            Tải lên & Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
