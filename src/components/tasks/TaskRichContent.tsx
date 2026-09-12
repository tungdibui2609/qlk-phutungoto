'use client'

import React, { useState } from 'react'
import { Maximize2, Image as ImageIcon } from 'lucide-react'
import {
    parseContentWithInlineImages,
    extractInlineImageUrls,
    getOptimizedThumbnailUrl,
    stripRawImageUrlsFromText,
    formatRichTextToHtml,
} from './taskContentUtils'
import ImageLightbox from './ImageLightbox'

interface TaskRichContentProps {
    content: string | null | undefined
    fallbackImages?: string[]
    onImageClick?: (images: string[], index: number) => void
    className?: string
}

export default function TaskRichContent({
    content,
    fallbackImages = [],
    onImageClick,
    className = '',
}: TaskRichContentProps) {
    const [internalLightboxIdx, setInternalLightboxIdx] = useState<number | null>(null)

    if (!content || !content.trim()) return null

    const segments = parseContentWithInlineImages(content, fallbackImages)
    const allInlineUrls = extractInlineImageUrls(content, fallbackImages)

    const handleImageClick = (idx: number) => {
        if (onImageClick) {
            onImageClick(allInlineUrls, idx)
        } else {
            setInternalLightboxIdx(idx)
        }
    }

    return (
        <div className={`space-y-3 leading-relaxed ${className}`}>
            {segments.map((seg, idx) => {
                if (seg.type === 'text') {
                    // Loại bỏ triệt để bất kỳ đường dẫn ảnh thô nào (như base64 data:image) khỏi văn bản hiển thị
                    const cleaned = stripRawImageUrlsFromText(seg.text).trim()
                    if (!cleaned) return null
                    const formattedHtml = formatRichTextToHtml(cleaned)
                    return (
                        <div
                            key={idx}
                            className="whitespace-pre-line text-stone-800 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: formattedHtml }}
                        />
                    )
                }

                if (seg.type === 'image') {
                    const inlineIndex = allInlineUrls.indexOf(seg.url)
                    const targetIndex = inlineIndex !== -1 ? inlineIndex : 0
                    const thumbUrl = getOptimizedThumbnailUrl(seg.url, 480)

                    return (
                        <div
                            key={idx}
                            className="my-2.5 max-w-[240px] sm:max-w-[280px] rounded-xl overflow-hidden border border-stone-200/90 bg-stone-50 shadow-xs hover:shadow-md hover:border-amber-400 transition-all duration-200 group cursor-pointer select-none"
                            onClick={() => handleImageClick(targetIndex)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    handleImageClick(targetIndex)
                                }
                            }}
                            title="Bấm để phóng to xem chi tiết"
                        >
                            {/* Compact thumbnail container */}
                            <div className="relative w-full h-36 sm:h-40 bg-stone-900/5 flex items-center justify-center overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={thumbUrl}
                                    alt={seg.alt || 'Ảnh minh họa'}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />

                                {/* Hover zoom overlay */}
                                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                    <div className="px-2.5 py-1 rounded-full bg-black/75 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md">
                                        <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                                        <span>Phóng to</span>
                                    </div>
                                </div>

                                {/* Corner badge indicating zoomable on tap */}
                                <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/65 backdrop-blur-xs text-white text-[10px] font-medium flex items-center gap-1 opacity-90 group-hover:opacity-0 transition-opacity shadow-xs">
                                    <Maximize2 className="w-2.5 h-2.5 text-amber-300" />
                                    <span>Bấm phóng to</span>
                                </div>
                            </div>

                            {/* Caption if provided and not generic */}
                            {seg.alt && seg.alt !== 'Hình ảnh' && seg.alt !== 'Ảnh' && (
                                <div className="px-2.5 py-1.5 bg-white border-t border-stone-100 flex items-center gap-1.5 text-[11px] font-medium text-stone-600 truncate">
                                    <ImageIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                    <span className="truncate">{seg.alt}</span>
                                </div>
                            )}
                        </div>
                    )
                }

                return null
            })}

            {/* Built-in Lightbox for instant zoom when onImageClick isn't passed (e.g. editor live preview) */}
            {internalLightboxIdx !== null && (
                <ImageLightbox
                    images={allInlineUrls}
                    currentIndex={internalLightboxIdx}
                    onClose={() => setInternalLightboxIdx(null)}
                    onNavigate={setInternalLightboxIdx}
                />
            )}
        </div>
    )
}
