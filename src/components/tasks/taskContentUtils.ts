/**
 * Utilities for parsing and formatting task content with inline images
 */

export interface InlineImageItem {
    alt: string
    url: string
    fullMatch: string
    index: number
}

export type ContentSegment =
    | { type: 'text'; text: string }
    | { type: 'image'; alt: string; url: string; index: number }

// Regex to match Markdown image syntax: ![alt](url)
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g

// Regex to match short friendly display tags: [📷 Ảnh 1], [🖼️ Ảnh 1], [Ảnh 1], <📷 Ảnh 1>, <Ảnh 1>
export const SHORT_IMAGE_TAG_REGEX = /\[(?:📷|🖼️)?\s*Ảnh\s*(\d+)\]|<(?:📷|🖼️)?\s*Ảnh\s*(\d+)>/gi

export interface ShortImageEntry {
    id: number
    url: string
    alt?: string
}

/**
 * Converts stored Markdown containing long ![alt](url) into clean text containing [📷 Ảnh 1], [📷 Ảnh 2]...
 * So the user never has to see ugly, long URLs in the editor.
 */
export const markdownToDisplayText = (
    markdown: string | null | undefined
): { displayText: string; entries: ShortImageEntry[] } => {
    if (!markdown) return { displayText: '', entries: [] }

    const entries: ShortImageEntry[] = []
    let nextId = 1

    const regex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g')
    const displayText = markdown.replace(regex, (_fullMatch, alt, url) => {
        const id = nextId++
        entries.push({
            id,
            url,
            alt: (alt || '').trim() || `Ảnh ${id}`,
        })
        return `[📷 Ảnh ${id}]`
    })

    return { displayText, entries }
}

/**
 * Converts editor text containing short tags [📷 Ảnh 1], [📷 Ảnh 2] back into standard Markdown
 */
export const displayTextToMarkdown = (
    displayText: string | null | undefined,
    entries: ShortImageEntry[]
): string => {
    if (!displayText) return ''

    const entryMap = new Map<number, ShortImageEntry>()
    for (const e of entries) {
        entryMap.set(e.id, e)
    }

    const regex = new RegExp(SHORT_IMAGE_TAG_REGEX.source, 'gi')
    return displayText.replace(regex, (fullMatch, id1, id2) => {
        const idStr = id1 || id2
        const id = parseInt(idStr, 10)
        const entry = entryMap.get(id)
        if (entry) {
            const cleanAlt = entry.alt && entry.alt !== 'Hình ảnh' ? entry.alt : `Ảnh ${id}`
            return `\n![${cleanAlt}](${entry.url})\n`
        }
        return fullMatch
    })
}

/**
 * Extracts all inline markdown images from task content text
 */
export const extractInlineImages = (text: string | null | undefined): InlineImageItem[] => {
    if (!text) return []
    const regex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g')
    const items: InlineImageItem[] = []
    let match: RegExpExecArray | null
    let idx = 0

    while ((match = regex.exec(text)) !== null) {
        items.push({
            alt: match[1] || 'Hình ảnh',
            url: match[2],
            fullMatch: match[0],
            index: idx++,
        })
    }
    return items
}

/**
 * Extract just the array of URLs of inline images
 */
export const extractInlineImageUrls = (
    text: string | null | undefined,
    fallbackImages: string[] = []
): string[] => {
    const urls = extractInlineImages(text).map(item => item.url)
    if (fallbackImages.length > 0 && text) {
        const shortRegex = new RegExp(SHORT_IMAGE_TAG_REGEX.source, 'gi')
        let match: RegExpExecArray | null
        while ((match = shortRegex.exec(text)) !== null) {
            const id = parseInt(match[1] || match[2], 10)
            if (id > 0 && id <= fallbackImages.length) {
                const url = fallbackImages[id - 1]
                if (!urls.includes(url)) {
                    urls.push(url)
                }
            }
        }
    }
    return urls
}

/**
 * Formats task content for a short preview (e.g. in push notifications)
 * Replaces ![alt](url) with [📷 alt] so raw URLs don't break the preview
 */
export const formatTaskContentPreview = (text: string | null | undefined): string => {
    if (!text) return ''
    const regex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g')
    return text.replace(regex, (_match, alt) => {
        const cleanAlt = (alt || '').trim()
        const isHashOrFileName = /\d{5,}/.test(cleanAlt) || /\.(jpe?g|png|gif|webp)$/i.test(cleanAlt) || /^(IMG_|WP_|PXL_|Screenshot_)/i.test(cleanAlt)
        const label = !cleanAlt || isHashOrFileName || cleanAlt === 'Hình ảnh' || cleanAlt === 'Ảnh' ? 'Hình ảnh' : cleanAlt
        return `[📷 ${label}]`
    }).trim()
}

/**
 * Strips all inline markdown images and [📷 ...] tags from task content,
 * leaving only genuine readable text for card previews (since thumbnails are already rendered).
 */
export const getCardContentPreview = (text: string | null | undefined): string => {
    if (!text) return ''
    // Strip markdown images: ![alt](url)
    const mdRegex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g')
    let cleaned = text.replace(mdRegex, '')
    // Strip short image tags: [📷 ...] or <📷 ...>
    const shortTagRegex = /\[(?:📷|🖼️)?\s*[^\]]*\]|<(?:📷|🖼️)?\s*[^>]*>/gi
    cleaned = cleaned.replace(shortTagRegex, '')
    // Clean up whitespace & multiple empty lines
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    return cleaned
}

/**
 * Parses content into a sequential list of text segments and image segments
 */
export const parseContentWithInlineImages = (
    text: string | null | undefined,
    fallbackImages: string[] = []
): ContentSegment[] => {
    if (!text) return []

    // If text contains short tags like [📷 Ảnh 1] and fallbackImages is provided,
    // convert short tags to markdown images first
    let normalized = text
    if (fallbackImages.length > 0) {
        const shortRegex = new RegExp(SHORT_IMAGE_TAG_REGEX.source, 'gi')
        normalized = normalized.replace(shortRegex, (fullMatch, id1, id2) => {
            const id = parseInt(id1 || id2, 10)
            if (id > 0 && id <= fallbackImages.length) {
                return `\n![Ảnh ${id}](${fallbackImages[id - 1]})\n`
            }
            return fullMatch
        })
    }

    const regex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g')
    const segments: ContentSegment[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let imgIdx = 0

    while ((match = regex.exec(normalized)) !== null) {
        const textBefore = normalized.slice(lastIndex, match.index)
        if (textBefore) {
            segments.push({ type: 'text', text: textBefore })
        }
        segments.push({
            type: 'image',
            alt: match[1] || 'Hình ảnh',
            url: match[2],
            index: imgIdx++,
        })
        lastIndex = match.index + match[0].length
    }

    const remainingText = normalized.slice(lastIndex)
    if (remainingText) {
        segments.push({ type: 'text', text: remainingText })
    }

    return segments
}

/**
 * Removes an inline image from content by its URL
 */
export const removeInlineImageFromContent = (content: string, imageUrl: string): string => {
    if (!content) return ''
    const regex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g')
    let updated = content.replace(regex, (fullMatch, _alt, url) => {
        if (url === imageUrl) {
            return ''
        }
        return fullMatch
    })
    // Clean up excessive blank lines (more than 2 consecutive newlines)
    updated = updated.replace(/\n{3,}/g, '\n\n')
    return updated.trim()
}

/**
 * Returns an optimized thumbnail URL for inline rendering (faster load, minimal bandwidth)
 */
export const getOptimizedThumbnailUrl = (url: string | null | undefined, width = 480): string => {
    if (!url) return ''

    // Google Drive Thumbnail API
    if (url.includes('drive.google.com/thumbnail')) {
        if (/sz=[ws]?\d+/i.test(url)) {
            return url.replace(/sz=[ws]?\d+/i, `sz=w${width}`)
        }
        const separator = url.includes('?') ? '&' : '?'
        return `${url}${separator}sz=w${width}`
    }

    // Google Drive direct link: convert to fast thumbnail API
    if (url.includes('drive.google.com/uc')) {
        const idMatch = url.match(/[?&]id=([^&]+)/)
        if (idMatch && idMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w${width}`
        }
    }

    // Cloudinary transformation
    if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/c_scale')) {
        return url.replace('/upload/', `/upload/c_scale,w_${width},q_auto,f_auto/`)
    }

    return url
}

/**
 * Returns a high-resolution URL suitable for lightbox full-screen viewing
 */
export const getHighResImageUrl = (url: string | null | undefined, width = 1600): string => {
    if (!url) return ''

    // Google Drive Thumbnail API: scale up for high-res clarity
    if (url.includes('drive.google.com/thumbnail')) {
        if (/sz=[ws]?\d+/i.test(url)) {
            return url.replace(/sz=[ws]?\d+/i, `sz=w${width}`)
        }
        const separator = url.includes('?') ? '&' : '?'
        return `${url}${separator}sz=w${width}`
    }

    if (url.includes('drive.google.com/uc')) {
        const idMatch = url.match(/[?&]id=([^&]+)/)
        if (idMatch && idMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w${width}`
        }
    }

    return url
}
