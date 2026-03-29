'use client'

import { X, ZoomIn, Download } from 'lucide-react'

interface DocumentViewerModalProps {
    isOpen: boolean
    onClose: () => void
    url: string
    title?: string
}

export default function DocumentViewerModal({ isOpen, onClose, url, title }: DocumentViewerModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="relative w-full h-full max-w-6xl max-h-[90vh] flex flex-col bg-zinc-900 rounded-[24px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md">
                            <ZoomIn className="text-white w-5 h-5" />
                        </div>
                        <h2 className="text-white font-black uppercase tracking-widest text-sm drop-shadow-md">
                            {title || 'Xem tài liệu'}
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                        >
                            <Download className="w-5 h-5" />
                        </a>
                        <button 
                            onClick={onClose} 
                            className="p-2.5 rounded-full bg-red-500/80 hover:bg-red-600 text-white backdrop-blur-md transition-colors shadow-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 w-full h-full bg-black flex items-center justify-center overflow-auto p-2 pt-20 pb-4">
                    {/* Sử dụng iframe cho PDF hoặc thẻ img cho hình ảnh. Google Drive Thumbnail viewer xử lý rất tốt việc này */}
                    {url ? (
                        <iframe 
                            src={url.includes('drive.google.com') ? url.replace('/view', '/preview') : url} 
                            className="w-full h-full rounded-xl bg-white/5 border-none shadow-inner"
                            title={title || "Document Viewer"}
                            allowFullScreen
                        />
                    ) : (
                        <div className="text-stone-500 font-bold uppercase tracking-widest text-xs">
                            Không tải được tài liệu
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
