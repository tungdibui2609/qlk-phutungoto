'use client'

import { useEffect, useState, useMemo } from 'react'
import { OperationalNote, getNotes, createNote } from '@/lib/operationalNotes'
import NoteInput from './NoteInput'
import NoteItem from './NoteItem'
import { Loader2 } from 'lucide-react'

export default function NoteTimeline() {
    const [notes, setNotes] = useState<OperationalNote[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchNotes = async () => {
        setIsLoading(true)
        try {
            const data = await getNotes()
            setNotes(data)
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchNotes()
    }, [])

    const handleCreateNote = async (content: string, images: string[]) => {
        try {
            await createNote(content, null, images)
            await fetchNotes()
        } catch (error) {
            console.error(error)
            alert('Không thể tạo ghi chú')
        }
    }

    const handleReply = async (content: string, images: string[], parentId: string) => {
        try {
            await createNote(content, parentId, images)
            await fetchNotes()
        } catch (error) {
            console.error(error)
            alert('Không thể trả lời')
        }
    }

    // Organize notes into tree
    const rootNotes = useMemo(() => {
        return notes.filter(n => !n.parent_id)
    }, [notes])

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Input Area */}
            <div className="mb-8">
                <NoteInput onSubmit={handleCreateNote} />
            </div>

            {/* Timeline */}
            <div className="relative">
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-orange-500" />
                    </div>
                ) : rootNotes.length === 0 ? (
                    <div className="text-center py-10 text-stone-500 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                        Chưa có ghi chú nào. Hãy bắt đầu cuộc thảo luận!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {rootNotes.map(note => {
                            const replies = notes.filter(n => n.parent_id === note.id)
                            return (
                                <NoteItem
                                    key={note.id}
                                    note={note}
                                    replies={replies}
                                    allNotes={notes}
                                    onReply={handleReply}
                                />
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
