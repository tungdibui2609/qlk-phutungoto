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
} from 'lucide-react'
import { uploadTaskImage } from './taskUtils'
import {
    ShortImageEntry,
    markdownToDisplayText,
    displayTextToMarkdown,
    SHORT_IMAGE_TAG_REGEX,
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

    // Parse initial value into friendly display text (with short tags like [📷 Ảnh 1]) and entries
    const initialParsed = useRef(markdownToDisplayText(value))
    const [displayText, setDisplayText] = useState(initialParsed.current.displayText)
    const [imageEntries, setImageEntries] = useState<ShortImageEntry[]>(initialParsed.current.entries)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    // Keep refs synchronized to avoid stale closures during async uploads
    const displayTextRef = useRef(displayText)
    displayTextRef.current = displayText

    const imageEntriesRef = useRef(imageEntries)
    imageEntriesRef.current = imageEntries

    // Keep track of the markdown we emitted so we don't re-parse our own emitted changes
    const lastEmittedMarkdownRef = useRef<string>(value)

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
        }
    }, [])

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

                    {/* Toolbar for inserting inline images */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 bg-stone-50/70 rounded-t-xl gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                        </div>

                        <span className="text-[11px] text-stone-400 font-medium hidden sm:inline-block">
                            💡 Gõ <code className="px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded text-[10px] font-bold">[📷 Ảnh 1]</code> hoặc dán <kbd className="px-1 py-0.5 bg-stone-200 text-stone-700 rounded text-[10px] font-mono">Ctrl+V</kbd>
                        </span>
                    </div>

                    {/* Textarea: User only sees clean short tags like [📷 Ảnh 1], no long URLs! */}
                    <textarea
                        ref={textareaRef}
                        value={displayText}
                        onChange={(e) => handleTextareaChange(e.target.value)}
                        onSelect={recordCursorPos}
                        onClick={recordCursorPos}
                        onKeyUp={recordCursorPos}
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
