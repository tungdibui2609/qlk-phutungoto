'use client'

import { useState, useEffect } from 'react'
import { Image as ImageIcon, Plus, Loader2, X, Trash2, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import DocumentViewerModal from '@/components/ui/DocumentViewerModal'

interface ImageDoc {
    name: string
    link: string
    fileId: string
    uploadedAt: string
}

export function LotItemImageManager({ lot, item, triggerOpen = false, onCloseTrigger, compact = false }: { lot: any, item: any, triggerOpen?: boolean, onCloseTrigger?: () => void, compact?: boolean }) {
    const { showToast } = useToast()
    const [isUploading, setIsUploading] = useState(false)
    const [isGalleryOpen, setIsGalleryOpen] = useState(triggerOpen)
    const [viewDocUrl, setViewDocUrl] = useState<{url: string, title?: string} | null>(null)
    
    const [itemImages, setItemImages] = useState<ImageDoc[]>(() => {
        return (lot.metadata as any)?.item_images?.[item.id] || []
    })

    useEffect(() => {
        if (triggerOpen) setIsGalleryOpen(true)
    }, [triggerOpen])

    const handleUpload = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = "image/*"
        input.multiple = true
        input.onchange = async (ev: any) => {
            const files = ev.target.files
            if (!files || files.length === 0) return

            setIsUploading(true)
            try {
                const newDocs = [...itemImages]

                for (const file of files) {
                    const formData = new FormData()
                    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
                    const finalName = safeFileName || `image_${Date.now()}.jpg`
                    
                    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type })
                    formData.append('file', fileBlob, finalName)

                    const res = await fetch(`${window.location.origin}/api/google-drive-upload`, {
                        method: 'POST',
                        body: formData
                    })
                    const data = await res.json()

                    if (data.success) {
                        newDocs.push({
                            name: data.name,
                            link: data.viewLink,
                            fileId: data.fileId,
                            uploadedAt: new Date().toISOString()
                        })
                    } else {
                        throw new Error(data.error || 'Upload failed')
                    }
                }

                await saveImages(newDocs)
                showToast(`Đã tải lên ${files.length} ảnh`, 'success')
            } catch (err: any) {
                showToast('Lỗi upload: ' + err.message, 'error')
            } finally {
                setIsUploading(false)
            }
        }
        input.click()
    }

    const handleDelete = async (fileId: string) => {
        if (!confirm('Bạn có chắc muốn xóa ảnh này?')) return
        
        const newDocs = itemImages.filter(img => img.fileId !== fileId)
        try {
            await saveImages(newDocs)
            showToast('Đã xóa ảnh', 'success')
        } catch (err: any) {
            showToast('Lỗi xóa ảnh: ' + err.message, 'error')
        }
    }

    const saveImages = async (newDocs: ImageDoc[]) => {
        const updatedMetadata = {
            ...(lot.metadata || {}),
            item_images: {
                ...((lot.metadata as any)?.item_images || {}),
                [item.id]: newDocs
            }
        }

        const { error } = await (supabase.from('lots') as any)
            .update({ metadata: updatedMetadata })
            .eq('id', lot.id)

        if (error) throw error

        setItemImages(newDocs)
        if (!lot.metadata) lot.metadata = {}
        lot.metadata.item_images = updatedMetadata.item_images
    }

    return (
        <div className="flex items-center" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setIsGalleryOpen(true)}
                className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} flex items-center justify-center rounded-lg transition-all border border-transparent shadow-sm relative ${
                    itemImages.length > 0 
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' 
                        : 'text-zinc-400 hover:text-zinc-800 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-200'
                }`}
                title="Quản lý ảnh sản phẩm"
            >
                <ImageIcon size={compact ? 12 : 16} />
                {itemImages.length > 0 && (
                    <span className={`absolute -top-1 -right-1 ${compact ? 'w-3.5 h-3.5 text-[7px]' : 'w-4 h-4 text-[8px]'} bg-emerald-500 text-white font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 animate-in zoom-in`}>
                        {itemImages.length}
                    </span>
                )}
            </button>

            {/* Gallery Modal */}
            {isGalleryOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/30 text-orange-600">
                                    <ImageIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-tight text-zinc-900 dark:text-white">Ảnh sản phẩm</h3>
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase">{item.products?.name || 'Item'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setIsGalleryOpen(false); onCloseTrigger?.(); }} 
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            >
                                <X size={20} className="text-zinc-400" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {itemImages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                                    <ImageIcon size={48} className="mb-4 opacity-20" />
                                    <p className="text-sm font-medium">Chưa có hình ảnh nào</p>
                                    <button
                                        onClick={handleUpload}
                                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                                    >
                                        <Plus size={16} /> Tải ảnh lên ngay
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {itemImages.map((img) => (
                                        <div key={img.fileId} className="group relative aspect-square rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                                            <img 
                                                src={`https://drive.google.com/thumbnail?id=${img.fileId}&sz=w600`} 
                                                alt={img.name}
                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                                                onClick={() => setViewDocUrl({ url: img.link, title: img.name })}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setViewDocUrl({ url: img.link, title: img.name })}
                                                    className="p-2 bg-white/20 hover:bg-white/40 text-white backdrop-blur-md rounded-full transition-all"
                                                    title="Xem ảnh"
                                                >
                                                    <ExternalLink size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(img.fileId)}
                                                    className="p-2 bg-red-500/20 hover:bg-red-500 text-white backdrop-blur-md rounded-full transition-all"
                                                    title="Xóa ảnh"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleUpload}
                                        disabled={isUploading}
                                        className="aspect-square flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all gap-2"
                                    >
                                        {isUploading ? (
                                            <Loader2 size={24} className="animate-spin" />
                                        ) : (
                                            <>
                                                <Plus size={24} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Thêm ảnh</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-900/50">
                             <button
                                onClick={() => { setIsGalleryOpen(false); onCloseTrigger?.(); }}
                                className="px-6 py-2.5 rounded-xl text-xs font-black text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors uppercase tracking-widest"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewDocUrl && (
                <DocumentViewerModal 
                    isOpen={!!viewDocUrl}
                    onClose={() => setViewDocUrl(null)}
                    url={viewDocUrl.url}
                    title={viewDocUrl.title}
                />
            )}
        </div>
    )
}
