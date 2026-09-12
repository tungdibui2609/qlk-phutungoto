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

// Regex to match Markdown image syntax: ![alt](url) hoặc link ảnh [alt](url)
const MARKDOWN_IMAGE_REGEX = /!?\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/g

// Regex to match short friendly display tags: [📷 Ảnh 1], [🖼️ Ảnh 1], [Ảnh 1], <📷 Ảnh 1>, <Ảnh 1>
// Không match nếu đằng trước là ! hoặc đằng sau là ( để tránh phá vỡ cú pháp markdown ![Ảnh 1](url)
export const SHORT_IMAGE_TAG_REGEX = /(?<![!])\[(?:📷|🖼️)?\s*Ảnh\s*(\d+)\](?!\()|(?<![!])<(?:📷|🖼️)?\s*Ảnh\s*(\d+)>(?!\()/gi

export interface ShortImageEntry {
    id: number
    url: string
    alt?: string
}

export interface TextColorOption {
    label: string
    value: string
    bg: string
    ring: string
    desc: string
}

export const TEXT_COLORS: TextColorOption[] = [
    { label: 'Đỏ cảnh báo', value: '#dc2626', bg: 'bg-red-600', ring: 'ring-red-400', desc: 'Cảnh báo hàng hỏng, việc cấm, nguy hiểm' },
    { label: 'Cam lưu ý', value: '#ea580c', bg: 'bg-orange-600', ring: 'ring-orange-400', desc: 'Lưu ý khẩn cấp, việc dở dang' },
    { label: 'Vàng chú ý', value: '#d97706', bg: 'bg-amber-500', ring: 'ring-amber-400', desc: 'Theo dõi tiến độ, cần kiểm tra' },
    { label: 'Xanh lá đạt', value: '#16a34a', bg: 'bg-green-600', ring: 'ring-green-400', desc: 'Đã hoàn thành, hàng đạt chuẩn' },
    { label: 'Xanh dương', value: '#2563eb', bg: 'bg-blue-600', ring: 'ring-blue-400', desc: 'Hướng dẫn công việc, thông tin' },
    { label: 'Tím nổi bật', value: '#9333ea', bg: 'bg-purple-600', ring: 'ring-purple-400', desc: 'Đặc biệt quan trọng' },
    { label: 'Đen đậm', value: '#1c1917', bg: 'bg-stone-900', ring: 'ring-stone-500', desc: 'Chữ đen nổi rõ' },
]

export interface TextSizeOption {
    label: string
    value: string
    preview: string
    title: string
}

export const TEXT_SIZES: TextSizeOption[] = [
    { label: 'Tiêu đề lớn (Rất to)', value: '1.35em', preview: 'text-base font-bold', title: 'Thích hợp cho tiêu đề lô hàng, cảnh báo khẩn cấp' },
    { label: 'Tiêu đề vừa (To vừa)', value: '1.18em', preview: 'text-sm font-semibold', title: 'Thích hợp cho đầu việc chính' },
    { label: 'Chữ to (Rõ nét)', value: '1.08em', preview: 'text-sm font-medium', title: 'Lớn hơn bình thường một chút để dễ đọc' },
    { label: 'Bình thường (Mặc định)', value: '1em', preview: 'text-xs', title: 'Kích cỡ văn bản chuẩn' },
    { label: 'Chữ nhỏ (Ghi chú)', value: '0.85em', preview: 'text-[11px] text-stone-500', title: 'Ghi chú phụ, thông số' },
]

export interface StyleUpdateOptions {
    color?: string
    fontSize?: string
    bold?: boolean
    italic?: boolean
    underline?: boolean
    mark?: boolean
    clear?: boolean
}

/**
 * Áp dụng hoặc thay đổi style (màu sắc, cỡ chữ, in đậm, in nghiêng, gạch chân, dạ quang) cho đoạn text được bôi đen
 */
export const applyStyleToSelectedText = (
    text: string,
    start: number,
    end: number,
    options: StyleUpdateOptions
): { newText: string; newSelectionStart: number; newSelectionEnd: number } => {
    const isCollapsed = start === end
    const selected = isCollapsed ? '' : text.substring(start, end)
    const before = text.substring(0, start)
    const after = text.substring(end)

    // Nếu người dùng chưa bôi đen gì: chèn văn bản mẫu và bôi đen nó để gõ đè
    if (isCollapsed) {
        let sampleText = 'Văn bản cần lưu ý'
        if (options.color === '#dc2626') sampleText = 'Cảnh báo quan trọng'
        else if (options.fontSize && options.fontSize !== '1em') sampleText = 'Tiêu đề công việc'

        let wrapped = sampleText
        if (options.bold) wrapped = `<b>${wrapped}</b>`
        if (options.italic) wrapped = `<i>${wrapped}</i>`
        if (options.underline) wrapped = `<u>${wrapped}</u>`
        if (options.mark) wrapped = `<mark>${wrapped}</mark>`

        const styleAttrs: string[] = []
        if (options.color && options.color !== 'clear') styleAttrs.push(`color:${options.color}`)
        if (options.fontSize && options.fontSize !== 'clear' && options.fontSize !== '1em') styleAttrs.push(`font-size:${options.fontSize}`)

        if (styleAttrs.length > 0) {
            wrapped = `<span style="${styleAttrs.join(';')}">${wrapped}</span>`
        }

        const newText = before + wrapped + after
        const newStart = start + wrapped.indexOf(sampleText)
        const newEnd = newStart + sampleText.length

        return { newText, newSelectionStart: newStart, newSelectionEnd: newEnd }
    }

    // Nếu bấm xóa định dạng
    if (options.clear) {
        const stripped = selected
            .replace(/<\/?(?:span|b|strong|i|em|u|mark|font|s)[^>]*>/gi, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
            .replace(/~~([^~]+)~~/g, '$1')

        const newText = before + stripped + after
        return {
            newText,
            newSelectionStart: start,
            newSelectionEnd: start + stripped.length,
        }
    }

    let result = selected

    // 1. Xử lý Bold, Italic, Underline, Mark
    if (options.bold !== undefined) {
        if (/^<b>[\s\S]*<\/b>$/i.test(result)) {
            result = result.replace(/^<b>([\s\S]*)<\/b>$/i, '$1')
        } else {
            result = `<b>${result}</b>`
        }
    }

    if (options.italic !== undefined) {
        if (/^<i>[\s\S]*<\/i>$/i.test(result)) {
            result = result.replace(/^<i>([\s\S]*)<\/i>$/i, '$1')
        } else {
            result = `<i>${result}</i>`
        }
    }

    if (options.underline !== undefined) {
        if (/^<u>[\s\S]*<\/u>$/i.test(result)) {
            result = result.replace(/^<u>([\s\S]*)<\/u>$/i, '$1')
        } else {
            result = `<u>${result}</u>`
        }
    }

    if (options.mark !== undefined) {
        if (/^<mark>[\s\S]*<\/mark>$/i.test(result)) {
            result = result.replace(/^<mark>([\s\S]*)<\/mark>$/i, '$1')
        } else {
            result = `<mark>${result}</mark>`
        }
    }

    // 2. Xử lý Màu sắc (color) và Cỡ chữ (fontSize) qua thẻ <span style="...">
    if (options.color !== undefined || options.fontSize !== undefined) {
        const spanRegex = /^<span\s+style="([^"]*)">([\s\S]*)<\/span>$/i
        const spanMatch = result.match(spanRegex)

        const stylesMap: Record<string, string> = {}
        let innerText = result

        if (spanMatch) {
            const rawStyle = spanMatch[1]
            innerText = spanMatch[2]
            rawStyle.split(';').forEach(p => {
                const [k, v] = p.split(':').map(s => s?.trim().toLowerCase())
                if (k && v) stylesMap[k] = v
            })
        }

        if (options.color !== undefined) {
            if (options.color === 'clear' || !options.color) {
                delete stylesMap['color']
            } else {
                stylesMap['color'] = options.color
            }
        }

        if (options.fontSize !== undefined) {
            if (options.fontSize === 'clear' || options.fontSize === '1em' || !options.fontSize) {
                delete stylesMap['font-size']
            } else {
                stylesMap['font-size'] = options.fontSize
            }
        }

        const styleEntries = Object.entries(stylesMap)
        if (styleEntries.length > 0) {
            const styleStr = styleEntries.map(([k, v]) => `${k}:${v}`).join(';')
            result = `<span style="${styleStr}">${innerText}</span>`
        } else {
            result = innerText
        }
    }

    const newText = before + result + after
    return {
        newText,
        newSelectionStart: start,
        newSelectionEnd: start + result.length,
    }
}

/**
 * Chuyển đổi văn bản có chứa thẻ rich text (span, b, i, u, mark) và markdown cơ bản (**bold**, *italic*)
 * thành HTML an toàn để render. Tuyệt đối chặn các thẻ nguy hiểm (script, iframe, img, onerror...).
 */
export const formatRichTextToHtml = (text: string | null | undefined): string => {
    if (!text) return ''

    // 1. Xóa đường dẫn ảnh data:image rò rỉ nếu có
    let html = stripRawImageUrlsFromText(text)

    // 2. Xóa triệt để các thẻ nguy hiểm kèm toàn bộ nội dung bên trong chúng (script, style, iframe)
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')

    // 3. Chuyển đổi markdown cơ bản:
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<i>$1</i>')
    html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>')

    // 3. Xử lý dòng tiêu đề markdown: # Tiêu đề -> <h3...>
    html = html.replace(/^#\s+(.+)$/gm, '<h3 style="font-size:1.25em;font-weight:700;margin-top:0.5em;margin-bottom:0.25em;color:#0c0a09">$1</h3>')
    html = html.replace(/^##\s+(.+)$/gm, '<h4 style="font-size:1.1em;font-weight:600;margin-top:0.4em;margin-bottom:0.2em;color:#1c1917">$1</h4>')

    // 4. Lọc an toàn các thẻ HTML được phép:
    // Whitelist tags: span, b, strong, i, em, u, mark, s, h3, h4, br
    html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag, attrs) => {
        const lowerTag = tag.toLowerCase()
        const allowedTags = ['span', 'b', 'strong', 'i', 'em', 'u', 'mark', 's', 'h3', 'h4', 'br']
        if (!allowedTags.includes(lowerTag)) {
            return ''
        }

        if (match.startsWith('</')) {
            return `</${lowerTag}>`
        }

        if (lowerTag === 'span') {
            const styleMatch = attrs.match(/style\s*=\s*"([^"]*)"/i)
            if (styleMatch) {
                const rawStyles = styleMatch[1]
                const safePairs: string[] = []
                rawStyles.split(';').forEach((pair: string) => {
                    const [k, v] = pair.split(':').map((s: string) => s?.trim())
                    if (!k || !v) return
                    const lowerK = k.toLowerCase()
                    const lowerV = v.toLowerCase()
                    if (lowerV.includes('expression') || lowerV.includes('url') || lowerV.includes('javascript')) return

                    if (lowerK === 'color' || lowerK === 'font-size' || lowerK === 'font-weight' || lowerK === 'font-style' || lowerK === 'text-decoration' || lowerK === 'background-color') {
                        safePairs.push(`${lowerK}:${v}`)
                    }
                })
                if (safePairs.length > 0) {
                    return `<span style="${safePairs.join(';')}">`
                }
            }
            return '<span>'
        }

        if (lowerTag === 'mark') {
            return `<mark style="background-color:#fef08a;color:#713f12;padding:0 2px;border-radius:2px">`
        }

        if (lowerTag === 'h3' || lowerTag === 'h4') {
            return match
        }

        return `<${lowerTag}>`
    })

    return html
}

/**
 * Làm sạch hoàn toàn các đường dẫn ảnh thô rò rỉ (đặc biệt là data:image base64) khỏi nội dung văn bản thuần
 */
export const stripRawImageUrlsFromText = (text: string | null | undefined): string => {
    if (!text) return ''
    return text
        // Xóa các đường dẫn data:image dù có đóng mở ngoặc hay không: (data:image/jpeg;base64,...)
        .replace(/\(?data:image\/[^\s)]+\)?/gi, '')
        // Xóa dấu chấm than mồ côi bị sót lại do markdown vỡ
        .replace(/^\s*!\s*$/gm, '')
        // Dọn dẹp khoảng trắng thừa và dòng trống
        .replace(/\n{3,}/g, '\n\n')
}

/**
 * Thay thế an toàn các short tag độc lập [📷 Ảnh 1] bằng markdown ![Ảnh 1](url) từ fallbackImages
 * Tuyệt đối không chạm vào các cú pháp markdown đã có sẵn như ![Ảnh 1](url)
 */
export const replaceShortImageTagsWithMarkdown = (
    text: string | null | undefined,
    fallbackImages: string[] = []
): string => {
    if (!text || fallbackImages.length === 0) return text || ''

    const regex = /(!)?\[(?:📷|🖼️)?\s*Ảnh\s*(\d+)\](\()?|(!)?<(?:📷|🖼️)?\s*Ảnh\s*(\d+)>(\()?/gi
    return text.replace(regex, (fullMatch, excl1, id1, paren1, excl2, id2, paren2) => {
        if (excl1 || excl2 || paren1 || paren2) {
            return fullMatch
        }
        const idStr = id1 || id2
        const id = parseInt(idStr, 10)
        if (id > 0 && id <= fallbackImages.length) {
            return `\n![Ảnh ${id}](${fallbackImages[id - 1]})\n`
        }
        return fullMatch
    })
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

    const regex = /(!)?\[(?:📷|🖼️)?\s*Ảnh\s*(\d+)\](\()?|(!)?<(?:📷|🖼️)?\s*Ảnh\s*(\d+)>(\()?/gi
    return displayText.replace(regex, (fullMatch, excl1, id1, paren1, excl2, id2, paren2) => {
        if (excl1 || excl2 || paren1 || paren2) {
            return fullMatch
        }
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
        const regex = /(!)?\[(?:📷|🖼️)?\s*Ảnh\s*(\d+)\](\()?|(!)?<(?:📷|🖼️)?\s*Ảnh\s*(\d+)>(\()?/gi
        let match: RegExpExecArray | null
        while ((match = regex.exec(text)) !== null) {
            if (match[1] || match[3] || match[4] || match[6]) continue
            const id = parseInt(match[2] || match[5], 10)
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
    let res = text.replace(regex, (_match, alt) => {
        const cleanAlt = (alt || '').trim()
        const isHashOrFileName = /\d{5,}/.test(cleanAlt) || /\.(jpe?g|png|gif|webp)$/i.test(cleanAlt) || /^(IMG_|WP_|PXL_|Screenshot_)/i.test(cleanAlt)
        const label = !cleanAlt || isHashOrFileName || cleanAlt === 'Hình ảnh' || cleanAlt === 'Ảnh' ? 'Hình ảnh' : cleanAlt
        return `[📷 ${label}]`
    })
    // Strip raw image URLs
    res = stripRawImageUrlsFromText(res)
    return res.trim()
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
    // Strip any raw data:image url
    cleaned = stripRawImageUrlsFromText(cleaned)
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

    // Chuyển short tags độc lập thành markdown an toàn (không phá vỡ cú pháp markdown đã có)
    const normalized = replaceShortImageTagsWithMarkdown(text, fallbackImages)

    const regex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g')
    const segments: ContentSegment[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let imgIdx = 0

    while ((match = regex.exec(normalized)) !== null) {
        const textBefore = stripRawImageUrlsFromText(normalized.slice(lastIndex, match.index))
        if (textBefore && textBefore.trim()) {
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

    const remainingText = stripRawImageUrlsFromText(normalized.slice(lastIndex))
    if (remainingText && remainingText.trim()) {
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
