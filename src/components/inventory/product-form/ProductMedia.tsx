import { useState } from 'react'
import { Image as ImageIcon, Plus, X, Video, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog'

interface ProductMediaProps {
    mediaItems: { id?: string, url: string, type: 'image' | 'video' }[]
    setMediaItems: React.Dispatch<React.SetStateAction<{ id?: string, url: string, type: 'image' | 'video' }[]>>
    readOnly: boolean
    inputClass: string
}

export function ProductMedia({ mediaItems, setMediaItems, readOnly, inputClass }: ProductMediaProps) {
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)

    const openLightbox = (index: number) => {
        setCurrentImageIndex(index)
        setLightboxOpen(true)
    }

    const nextImage = () => {
        setCurrentImageIndex(prev => (prev + 1) % mediaItems.filter(m => m.url).length)
    }

    const prevImage = () => {
        setCurrentImageIndex(prev => (prev - 1 + mediaItems.filter(m => m.url).length) % mediaItems.filter(m => m.url).length)
    }

    return (
        <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
            <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                <ImageIcon size={20} className="text-orange-500" />
                Thư viện Media
            </h2>

            {!readOnly && (
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-stone-700">Links (Ảnh / Video)</label>
                    {mediaItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <select
                                value={item.type}
                                onChange={(e) => {
                                    const newItems = [...mediaItems]
                                    newItems[index].type = e.target.value as any
                                    setMediaItems(newItems)
                                }}
                                className="w-24 p-2 bg-stone-50 border border-stone-200 rounded-lg text-sm"
                            >
                                <option value="image">Ảnh</option>
                                <option value="video">Video</option>
                            </select>
                            <input
                                value={item.url}
                                onChange={(e) => {
                                    const newItems = [...mediaItems]
                                    newItems[index].url = e.target.value
                                    setMediaItems(newItems)
                                }}
                                className={`${inputClass} text-sm py-2`}
                                placeholder="URL..."
                            />
                            <button
                                type="button"
                                onClick={() => setMediaItems(prev => prev.filter((_, i) => i !== index))}
                                className="p-2 text-stone-400 hover:text-red-500 hover:bg-stone-50 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => setMediaItems(prev => [...prev, { url: '', type: 'image' }])}
                        className="flex items-center gap-2 text-sm text-orange-600 font-medium hover:text-orange-700 px-2"
                    >
                        <Plus size={16} />
                        Thêm Link Media
                    </button>
                </div>
            )}

            {/* Preview Grid / Gallery */}
            {mediaItems.some(m => m.url) && (
                <>
                    <div className={`grid gap-2 mt-4 ${readOnly ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
                        {mediaItems.filter(m => m.url).map((item, idx) => {
                            const getDriveId = (url: string) => {
                                const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/)
                                return match ? match[1] : null
                            }

                            const driveId = getDriveId(item.url)
                            const displayUrl = driveId
                                ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w600`
                                : item.url

                            return (
                                <div
                                    key={idx}
                                    onClick={() => readOnly && openLightbox(idx)}
                                    className={`relative aspect-square rounded-xl overflow-hidden bg-black border border-stone-200 group ${readOnly ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                                >
                                    {item.type === 'image' ? (
                                        <img
                                            src={displayUrl}
                                            alt={`Preview ${idx}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center');
                                                (e.target as HTMLImageElement).parentElement!.innerHTML += `<span class="text-white text-xs">Invalid Image</span>`
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center relative">
                                            {driveId ? (
                                                <iframe
                                                    src={`https://drive.google.com/file/d/${driveId}/preview`}
                                                    className="w-full h-full pointer-events-none" // Disable interaction in thumb
                                                    title={`Drive Video ${idx}`}
                                                />
                                            ) : item.url.match(/\.(mp4|webm|ogg)$/i) ? (
                                                <video src={item.url} className="w-full h-full object-contain pointer-events-none" />
                                            ) : (
                                                <div className="flex flex-col items-center text-white gap-2">
                                                    <Video size={32} />
                                                    <span className="text-xs max-w-[80%] text-center truncate px-2 text-stone-300">{item.url}</span>
                                                </div>
                                            )}
                                            {/* Play Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                    <Video size={20} className="text-white fill-white" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!readOnly && (
                                        <div className="absolute top-1 right-1 px-2 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium uppercase">
                                            {item.type}
                                        </div>
                                    )}

                                    {readOnly && (
                                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-sm">
                                                <Maximize2 size={14} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Lightbox Dialog */}
                    <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                        <DialogContent className="max-w-[95vw] w-full h-[95vh] bg-black/95 border-none p-0 flex flex-col justify-center items-center">
                            <DialogTitle className="sr-only">Image Gallery</DialogTitle>
                            <button
                                onClick={() => setLightboxOpen(false)}
                                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <button
                                onClick={prevImage}
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                <ChevronLeft size={32} />
                            </button>

                            <button
                                onClick={nextImage}
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                <ChevronRight size={32} />
                            </button>

                            <div className="relative w-full h-full flex items-center justify-center p-4">
                                {(() => {
                                    const currentItem = mediaItems.filter(m => m.url)[currentImageIndex]
                                    if (!currentItem) return null

                                    const getDriveId = (url: string) => {
                                        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/)
                                        return match ? match[1] : null
                                    }
                                    const driveId = getDriveId(currentItem.url)

                                    if (currentItem.type === 'video') {
                                        return (
                                            <div className="w-full h-full flex items-center justify-center max-w-5xl">
                                                {driveId ? (
                                                    <iframe
                                                        src={`https://drive.google.com/file/d/${driveId}/preview`}
                                                        className="w-full h-full aspect-video rounded-lg"
                                                        allow="autoplay"
                                                        title="Video Player"
                                                    />
                                                ) : currentItem.url.match(/\.(mp4|webm|ogg)$/i) ? (
                                                    <video src={currentItem.url} controls autoPlay className="max-w-full max-h-full rounded-lg" />
                                                ) : (
                                                    <div className="text-white text-center">
                                                        <p className="mb-4">Video Link: {currentItem.url}</p>
                                                        <a href={currentItem.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-orange-500 rounded-lg text-white">Open External Link</a>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }

                                    // Image
                                    const displayUrl = driveId
                                        ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`
                                        : currentItem.url

                                    return (
                                        <img
                                            src={displayUrl}
                                            alt="Gallery View"
                                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                        />
                                    )
                                })()}
                            </div>

                            {/* Thumbnails strip */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90%] p-2 bg-black/50 backdrop-blur-md rounded-2xl">
                                {mediaItems.filter(m => m.url).map((item, idx) => {
                                    const getDriveId = (url: string) => {
                                        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/)
                                        return match ? match[1] : null
                                    }
                                    const driveId = getDriveId(item.url)
                                    const thumbUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w200` : item.url

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentImageIndex(idx)}
                                            className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${currentImageIndex === idx ? 'border-orange-500 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                        >
                                            {item.type === 'image' ? (
                                                <img src={thumbUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-stone-800 flex items-center justify-center">
                                                    <Video size={20} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    )
}
