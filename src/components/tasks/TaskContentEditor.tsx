'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
    Image as ImageIcon,
    Camera,
    Eye,
    Edit3,
    Loader2,
    X,
    Sparkles,
    UploadCloud,
    AlertCircle,
    Bold,
    Italic,
    Underline,
    Highlighter,
    Palette,
    Type,
    ChevronDown,
    Eraser,
} from 'lucide-react'
import { uploadTaskImage } from './taskUtils'
import {
    ShortImageEntry,
    markdownToDisplayText,
    displayTextToMarkdown,
    SHORT_IMAGE_TAG_REGEX,
    TEXT_COLORS,
    TEXT_SIZES,
    StyleUpdateOptions,
    applyStyleToSelectedText,
} from './taskContentUtils'
import TaskRichContent from './TaskRichContent'

interface TaskContentEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    rows?: number
    disabled?: boolean
    label?: string
    required?: boolean
    className?: string
}

export default function TaskContentEditor({
    value,
    onChange,
    placeholder = 'Mô tả chi tiết công việc hoặc lời nhắc...',
    rows = 4,
    disabled = false,
    label,
    required = false,
    className = '',
}: TaskContentEditorProps) {
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [isDragging, setIsDragging] = useState(false)

    // Rich text styling pickers
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showSizePicker, setShowSizePicker] = useState(false)
    const [hasSelection, setHasSelection] = useState(false)

    // Parse initial value into friendly display text (with short tags like [📷 Ảnh 1]) and entries
    const initialParsed = useRef(markdownToDisplayText(value))
    const [displayText, setDisplayText] = useState(initialParsed.current.displayText)
    const [imageEntries, setImageEntries] = useState<ShortImageEntry[]>(initialParsed.current.entries)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const toolbarRef = useRef<HTMLDivElement>(null)

    // Keep refs synchronized to avoid stale closures during async uploads
    const displayTextRef = useRef(displayText)
    displayTextRef.current = displayText

    const imageEntriesRef = useRef(imageEntries)
    imageEntriesRef.current = imageEntries

    // Keep track of the markdown we emitted so we don't re-parse our own emitted changes
    const lastEmittedMarkdownRef = useRef<string>(value)

    // Close color & size popovers on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                setShowColorPicker(false)
                setShowSizePicker(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // When value changes from parent (e.g. form reset or initial edit load)
    useEffect(() => {
        if (value !== lastEmittedMarkdownRef.current) {
            const parsed = markdownToDisplayText(value)
            setDisplayText(parsed.displayText)
            setImageEntries(parsed.entries)
            displayTextRef.current = parsed.displayText
            imageEntriesRef.current = parsed.entries
            lastEmittedMarkdownRef.current = value
        }
    }, [value])

    // Track cursor selection before file picker or camera dialog opens
    const cursorPosRef = useRef<{ start: number; end: number }>({
        start: displayText.length,
        end: displayText.length,
    })

    const recordCursorPos = useCallback(() => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart ?? (displayTextRef.current || '').length
            const end = textareaRef.current.selectionEnd ?? (displayTextRef.current || '').length
            cursorPosRef.current = { start, end }
            setHasSelection(start !== end)
        }
    }, [])

    /**
     * Áp dụng định dạng văn bản (màu sắc, cỡ chữ, in đậm...) cho đoạn bôi đen
     */
    const handleApplyFormatting = useCallback((opts: StyleUpdateOptions) => {
        const textarea = textareaRef.current
        const currentText = displayTextRef.current || ''
        const start = textarea?.selectionStart ?? cursorPosRef.current.start
        const end = textarea?.selectionEnd ?? cursorPosRef.current.end

        const { newText, newSelectionStart, newSelectionEnd } = applyStyleToSelectedText(
            currentText,
            start,
            end,
            opts
        )

        setDisplayText(newText)
        displayTextRef.current = newText
        cursorPosRef.current = { start: newSelectionStart, end: newSelectionEnd }

        const markdown = displayTextToMarkdown(newText, imageEntriesRef.current)
        lastEmittedMarkdownRef.current = markdown
        onChange(markdown)

        setShowColorPicker(false)
        setShowSizePicker(false)

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus()
                textareaRef.current.setSelectionRange(newSelectionStart, newSelectionEnd)
                setHasSelection(newSelectionStart !== newSelectionEnd)
            }
        }, 30)
    }, [onChange])

    /**
     * Phím tắt tiện lợi: Ctrl+B (Đậm), Ctrl+I (Nghiêng), Ctrl+U (Gạch chân)
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b' || e.key === 'B') {
                e.preventDefault()
                handleApplyFormatting({ bold: true })
            } else if (e.key === 'i' || e.key === 'I') {
                e.preventDefault()
                handleApplyFormatting({ italic: true })
            } else if (e.key === 'u' || e.key === 'U') {
                e.preventDefault()
                handleApplyFormatting({ underline: true })
            }
        }
    }

    /**
     * User types in textarea: update display text and emit corresponding markdown
     */
    const handleTextareaChange = (newDisplayText: string) => {
        setDisplayText(newDisplayText)
        displayTextRef.current = newDisplayText
        recordCursorPos()

        const markdown = displayTextToMarkdown(newDisplayText, imageEntriesRef.current)
        lastEmittedMarkdownRef.current = markdown
        onChange(markdown)
    }

    /**
     * Inserts a short tag like [📷 Ảnh 1] into the textarea at the tracked cursor position
     */
    const insertImageAtCursor = useCallback((imageUrl: string, caption = 'Hình ảnh') => {
        const currentDisplay = displayTextRef.current ?? ''
        const textarea = textareaRef.current

        let startPos = cursorPosRef.current.start
        let endPos = cursorPosRef.current.end

        // Ensure within bounds
        if (startPos > currentDisplay.length) startPos = currentDisplay.length
        if (endPos > currentDisplay.length) endPos = currentDisplay.length
        if (startPos < 0) startPos = 0
        if (endPos < startPos) endPos = startPos

        // Determine next ID
        const existingIds = imageEntriesRef.current.map(e => e.id)
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1

        const cleanAlt = caption && caption !== 'Hình ảnh' ? caption : `Ảnh ${nextId}`
        const newEntry: ShortImageEntry = {
            id: nextId,
            url: imageUrl,
            alt: cleanAlt,
        }

        const updatedEntries = [...imageEntriesRef.current, newEntry]
        setImageEntries(updatedEntries)
        imageEntriesRef.current = updatedEntries

        // Friendly short tag: [📷 Ảnh 1]
        const tag = `[📷 Ảnh ${nextId}]`

        const textBefore = currentDisplay.substring(0, startPos)
        const textAfter = currentDisplay.substring(endPos)

        const needsLeadingNewline = textBefore.length > 0 && !textBefore.endsWith('\n')
        const needsTrailingNewline = textAfter.length > 0 && !textAfter.startsWith('\n')

        const prefix = needsLeadingNewline ? '\n\n' : ''
        const suffix = needsTrailingNewline ? '\n\n' : '\n'
        const insertedSnippet = `${prefix}${tag}${suffix}`

        const updatedDisplay = textBefore + insertedSnippet + textAfter
        setDisplayText(updatedDisplay)
        displayTextRef.current = updatedDisplay

        // Convert to markdown and notify parent
        const updatedMarkdown = displayTextToMarkdown(updatedDisplay, updatedEntries)
        lastEmittedMarkdownRef.current = updatedMarkdown
        onChange(updatedMarkdown)

        // Advance tracked cursor position right after the inserted tag
        const newCursorPos = startPos + insertedSnippet.length
        cursorPosRef.current = { start: newCursorPos, end: newCursorPos }

        // Restore cursor position and focus
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus()
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
            }
        }, 50)
    }, [onChange])

    /**
     * Upload one or multiple files and insert them into the text
     */
    const handleProcessFiles = async (files: FileList | File[]) => {
        const imageFiles: File[] = []
        for (let i = 0; i < files.length; i++) {
            const f = files[i]
            if (f.type.startsWith('image/')) {
                imageFiles.push(f)
            }
        }

        if (imageFiles.length === 0) return

        setUploading(true)
        setUploadError('')

        try {
            // Tải song song (parallel) các ảnh để tốc độ nhanh gấp nhiều lần
            const uploadResults = await Promise.all(
                imageFiles.map(async (file, idx) => {
                    const baseName = file.name ? file.name.replace(/\.[^/.]+$/, '').trim() : ''
                    const isMachineName = !baseName || /^(IMG_|WP_|PXL_|Screenshot_|photo_|image_|\d{4,})/i.test(baseName) || /^\d+[_\d]+$/.test(baseName)
                    const cleanName = isMachineName ? `Ảnh ${idx + 1}` : baseName.slice(0, 30)
                    const url = await uploadTaskImage(file)
                    return { url, cleanName }
                })
            )

            for (const item of uploadResults) {
                insertImageAtCursor(item.url, item.cleanName || 'Hình ảnh')
            }
        } catch (err: any) {
            console.error('Lỗi khi tải ảnh chèn vào văn bản:', err)
            setUploadError(err.message || 'Không thể tải ảnh lên. Vui lòng thử lại.')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (cameraInputRef.current) cameraInputRef.current.value = ''
        }
    }

    /**
     * Handle file input change
     */
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleProcessFiles(e.target.files)
        }
    }

    /**
     * Handle clipboard paste (Ctrl+V) of images directly inside the textarea
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items
        if (!items) return

        const imageFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile()
                if (file) imageFiles.push(file)
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault()
            recordCursorPos()
            handleProcessFiles(imageFiles)
        }
    }

    /**
     * Handle drag and drop of images onto the textarea
     */
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled && !uploading) {
            setIsDragging(true)
        }
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        if (disabled || uploading) return

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            recordCursorPos()
            handleProcessFiles(e.dataTransfer.files)
        }
    }

    /**
     * Remove an inline image from the text by its ID
     */
    const handleRemoveInlineImage = (id: number) => {
        const tagRegex = new RegExp(`\\[(?:📷|🖼️)?\\s*Ảnh\\s*${id}\\]|<(?:📷|🖼️)?\\s*Ảnh\\s*${id}>`, 'gi')
        let updatedDisplay = (displayTextRef.current || displayText).replace(tagRegex, '')
        updatedDisplay = updatedDisplay.replace(/\n{3,}/g, '\n\n').trim()

        const updatedEntries = imageEntriesRef.current.filter(e => e.id !== id)
        setImageEntries(updatedEntries)
        imageEntriesRef.current = updatedEntries

        setDisplayText(updatedDisplay)
        displayTextRef.current = updatedDisplay

        const updatedMarkdown = displayTextToMarkdown(updatedDisplay, updatedEntries)
        lastEmittedMarkdownRef.current = updatedMarkdown
        onChange(updatedMarkdown)
    }

    // List of images currently referenced in the display text
    const activeImagesInText = imageEntries.filter(entry => {
        const tagRegex = new RegExp(`\\[(?:📷|🖼️)?\\s*Ảnh\\s*${entry.id}\\]|<(?:📷|🖼️)?\\s*Ảnh\\s*${entry.id}>`, 'i')
        return tagRegex.test(displayText)
    })

    return (
        <div className={`space-y-1.5 ${className}`}>
            {/* Header / Label + Tabs */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                {label && (
                    <label className="block text-sm font-semibold text-stone-700">
                        {label} {required && <span className="text-red-500">*</span>}
                    </label>
                )}

                {/* Editor / Preview Tabs */}
                <div className="flex items-center gap-1 ml-auto bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                    <button
                        type="button"
                        onClick={() => setActiveTab('edit')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                            activeTab === 'edit'
                                ? 'bg-white text-stone-800 shadow-2xs font-semibold'
                                : 'text-stone-500 hover:text-stone-800'
                        }`}
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Soạn thảo</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('preview')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                            activeTab === 'preview'
                                ? 'bg-white text-stone-800 shadow-2xs font-semibold'
                                : 'text-stone-500 hover:text-stone-800'
                        }`}
                        title="Xem trước định dạng và ảnh chèn giữa đoạn văn"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem trước</span>
                        {activeImagesInText.length > 0 && (
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {activeImagesInText.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Error banner if any */}
            {uploadError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                    <span>{uploadError}</span>
                </div>
            )}

            {/* Main Content Area */}
            {activeTab === 'edit' ? (
                <div
                    className={`relative rounded-xl border transition group ${
                        isDragging
                            ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20'
                            : 'border-stone-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 bg-white'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Hidden inputs */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileInputChange}
                    />
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileInputChange}
                    />

                    {/* Toolbar for inserting inline images & rich text formatting */}
                    <div
                        ref={toolbarRef}
                        className="flex items-center justify-between px-2.5 py-2 border-b border-stone-100 bg-stone-50/75 rounded-t-xl gap-1.5 flex-wrap"
                    >
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Chèn ảnh & chụp ảnh */}
                            <button
                                type="button"
                                disabled={disabled || uploading}
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    recordCursorPos()
                                    fileInputRef.current?.click()
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-stone-700 hover:text-amber-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
                                title="Đặt con trỏ vào vị trí muốn chèn rồi bấm nút này để chọn ảnh từ máy"
                            >
                                <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                                <span>Chèn ảnh tại con trỏ</span>
                            </button>

                            <button
                                type="button"
                                disabled={disabled || uploading}
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    recordCursorPos()
                                    cameraInputRef.current?.click()
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-stone-700 hover:text-amber-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
                                title="Chụp ảnh mới và chèn ngay vào vị trí con trỏ"
                            >
                                <Camera className="w-3.5 h-3.5 text-stone-600" />
                                <span>Chụp ảnh chèn vào</span>
                            </button>

                            {/* Divider */}
                            <div className="h-4 w-px bg-stone-300 mx-0.5 hidden sm:block" />

                            {/* Cỡ chữ Dropdown */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={disabled || uploading}
                                    onClick={() => {
                                        setShowSizePicker(prev => !prev)
                                        setShowColorPicker(false)
                                    }}
                                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition shadow-2xs ${
                                        showSizePicker || hasSelection
                                            ? 'border-amber-400 bg-amber-50/80 text-amber-800 ring-1 ring-amber-400/30'
                                            : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                                    }`}
                                    title="Chọn kích cỡ chữ (Bôi đen đoạn văn bản trước để áp dụng)"
                                >
                                    <Type className="w-3.5 h-3.5 text-stone-600" />
                                    <span className="hidden sm:inline text-[11px]">Cỡ chữ</span>
                                    <ChevronDown className="w-3 h-3 text-stone-400" />
                                </button>

                                {showSizePicker && (
                                    <div className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-stone-200 py-1 z-30 animate-in fade-in-50 zoom-in-95">
                                        <div className="px-3 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
                                            {hasSelection ? 'Áp dụng cho đoạn bôi đen:' : 'Chọn kích cỡ chữ:'}
                                        </div>
                                        {TEXT_SIZES.map((s) => (
                                            <button
                                                key={s.value}
                                                type="button"
                                                onClick={() => handleApplyFormatting({ fontSize: s.value })}
                                                className="w-full px-3 py-1.5 text-left hover:bg-amber-50/70 flex items-center justify-between transition group"
                                                title={s.title}
                                            >
                                                <span className={`${s.preview} text-stone-800 group-hover:text-amber-800`}>
                                                    {s.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Màu chữ Popover */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={disabled || uploading}
                                    onClick={() => {
                                        setShowColorPicker(prev => !prev)
                                        setShowSizePicker(false)
                                    }}
                                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                                        showColorPicker || hasSelection
                                            ? 'border-amber-400 bg-amber-50/80 text-amber-800 ring-1 ring-amber-400/30'
                                            : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                                    }`}
                                    title="Chọn màu sắc chữ (Bôi đen đoạn văn bản trước để áp dụng)"
                                >
                                    <div className="flex items-center gap-0.5">
                                        <span className="font-bold text-xs underline decoration-red-500 decoration-2">A</span>
                                        <Palette className="w-3 h-3 text-amber-600" />
                                    </div>
                                    <span className="hidden sm:inline text-[11px]">Màu sắc</span>
                                    <ChevronDown className="w-3 h-3 text-stone-400" />
                                </button>

                                {showColorPicker && (
                                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-stone-200 p-2 z-30 animate-in fade-in-50 zoom-in-95 space-y-1">
                                        <div className="px-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                            {hasSelection ? 'Đổi màu cho đoạn bôi đen:' : 'Chọn màu chữ:'}
                                        </div>
                                        <div className="grid grid-cols-1 gap-0.5">
                                            {TEXT_COLORS.map((c) => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => handleApplyFormatting({ color: c.value })}
                                                    className="w-full px-2 py-1.5 rounded-lg hover:bg-stone-50 flex items-center gap-2 text-left transition group"
                                                    title={c.desc}
                                                >
                                                    <span className={`w-3.5 h-3.5 rounded-full ${c.bg} flex-shrink-0 shadow-2xs group-hover:scale-110 transition`} />
                                                    <span className="text-xs font-semibold text-stone-700 flex-1">{c.label}</span>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => handleApplyFormatting({ color: 'clear' })}
                                                className="w-full px-2 py-1.5 rounded-lg hover:bg-red-50 text-stone-500 hover:text-red-700 flex items-center gap-2 text-left text-xs transition border-t border-stone-100 pt-1.5 mt-1"
                                            >
                                                <Eraser className="w-3.5 h-3.5" />
                                                <span>Màu mặc định (Xóa màu)</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Cụm định dạng nhanh: B, I, U, Highlight */}
                            <div className="flex items-center gap-0.5 border border-stone-200 rounded-lg p-0.5 bg-white shadow-2xs">
                                <button
                                    type="button"
                                    disabled={disabled || uploading}
                                    onClick={() => handleApplyFormatting({ bold: true })}
                                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-stone-100 text-stone-700 transition"
                                    title="In đậm (Ctrl+B)"
                                >
                                    <Bold className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    disabled={disabled || uploading}
                                    onClick={() => handleApplyFormatting({ italic: true })}
                                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-stone-100 text-stone-700 transition"
                                    title="In nghiêng (Ctrl+I)"
                                >
                                    <Italic className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    disabled={disabled || uploading}
                                    onClick={() => handleApplyFormatting({ underline: true })}
                                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-stone-100 text-stone-700 transition"
                                    title="Gạch chân (Ctrl+U)"
                                >
                                    <Underline className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    disabled={disabled || uploading}
                                    onClick={() => handleApplyFormatting({ mark: true })}
                                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-100 text-amber-700 transition"
                                    title="Dạ quang / Highlight vàng"
                                >
                                    <Highlighter className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Nút xóa định dạng khi đang bôi đen */}
                            {hasSelection && (
                                <button
                                    type="button"
                                    onClick={() => handleApplyFormatting({ clear: true })}
                                    className="px-2 py-1 rounded-lg border border-stone-200 bg-white hover:bg-red-50 hover:border-red-200 text-stone-500 hover:text-red-700 text-xs flex items-center gap-1 transition shadow-2xs animate-in fade-in-50"
                                    title="Xóa toàn bộ màu sắc và định dạng khỏi đoạn bôi đen"
                                >
                                    <Eraser className="w-3 h-3" />
                                    <span className="hidden sm:inline text-[10px] font-medium">Bỏ định dạng</span>
                                </button>
                            )}
                        </div>

                        {/* Gợi ý trạng thái bôi đen */}
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-medium ml-auto">
                            {hasSelection ? (
                                <span className="text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 animate-in fade-in-50 text-[10px]">
                                    ✨ Đã bôi đen: Chọn màu hoặc cỡ chữ
                                </span>
                            ) : (
                                <span className="hidden sm:inline text-[10px]">
                                    💡 Bôi đen chữ để đổi màu & cỡ
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Textarea: User only sees clean short tags like [📷 Ảnh 1], no long URLs! */}
                    <textarea
                        ref={textareaRef}
                        value={displayText}
                        onChange={(e) => handleTextareaChange(e.target.value)}
                        onSelect={recordCursorPos}
                        onClick={recordCursorPos}
                        onMouseUp={recordCursorPos}
                        onKeyUp={recordCursorPos}
                        onKeyDown={handleKeyDown}
                        onBlur={recordCursorPos}
                        onPaste={handlePaste}
                        disabled={disabled}
                        readOnly={uploading}
                        rows={rows}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 text-stone-800 text-sm placeholder:text-stone-400 focus:outline-none bg-transparent transition resize-y min-h-[110px]"
                    />

                    {/* Drag & drop overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 bg-amber-50/90 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center text-amber-800 border-2 border-dashed border-amber-400 pointer-events-none z-10 animate-in fade-in-50">
                            <UploadCloud className="w-8 h-8 text-amber-600 mb-1 animate-bounce" />
                            <span className="text-xs font-bold">Thả ảnh vào đây để chèn vào văn bản</span>
                        </div>
                    )}

                    {/* Uploading progress overlay */}
                    {uploading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs rounded-xl flex items-center justify-center text-stone-700 z-10 gap-2 text-xs font-semibold">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                            <span>Đang nén và chèn ảnh vào văn bản...</span>
                        </div>
                    )}

                    {/* Strip of inline images currently in text with 1-click removal */}
                    {activeImagesInText.length > 0 && (
                        <div className="px-3 py-2 border-t border-stone-100 bg-stone-50/50 rounded-b-xl flex items-center gap-2 overflow-x-auto">
                            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
                                🖼️ Ảnh trong bài ({activeImagesInText.length}):
                            </span>
                            <div className="flex items-center gap-1.5">
                                {activeImagesInText.map((item) => (
                                    <div
                                        key={item.id}
                                        className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg border border-amber-200 bg-amber-50/70 text-xs shadow-2xs group flex-shrink-0"
                                    >
                                        <span className="text-[10px] font-bold text-amber-800 bg-white px-1.5 py-0.5 rounded border border-amber-200 shadow-2xs">
                                            📷 Ảnh {item.id}
                                        </span>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={item.url}
                                            alt={item.alt || `Ảnh ${item.id}`}
                                            className="w-5 h-5 rounded object-cover border border-amber-200"
                                        />
                                        <span className="text-[11px] text-stone-700 max-w-[100px] truncate" title={item.alt}>
                                            {item.alt || `Ảnh ${item.id}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveInlineImage(item.id)}
                                            className="w-4 h-4 rounded-full hover:bg-red-200 hover:text-red-700 text-stone-400 flex items-center justify-center transition ml-0.5"
                                            title={`Xóa [📷 Ảnh ${item.id}] khỏi văn bản`}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Preview mode */
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 min-h-[140px] space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            Xem trước giao diện khi người ca sau đọc:
                        </span>
                        <button
                            type="button"
                            onClick={() => setActiveTab('edit')}
                            className="text-xs text-amber-700 hover:underline font-semibold"
                        >
                            Quay lại soạn thảo
                        </button>
                    </div>

                    {value && value.trim() ? (
                        <TaskRichContent content={value} />
                    ) : (
                        <p className="text-xs text-stone-400 italic">
                            Chưa có nội dung để xem trước...
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
