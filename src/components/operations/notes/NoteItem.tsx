'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { OperationalNote } from '@/lib/operationalNotes'
import { MessageSquare, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import NoteInput from './NoteInput'

interface NoteItemProps {
    note: OperationalNote
    replies: OperationalNote[]
    allNotes: OperationalNote[] // Passed down to find children of children
    onReply: (content: string, images: string[], parentId: string) => Promise<void>
}

export default function NoteItem({ note, replies, allNotes, onReply }: NoteItemProps) {
    const [isReplying, setIsReplying] = useState(false)

    // Helper to get initials
    const getInitials = (name?: string | null) => {
        if (!name) return 'U'
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    }

    const handleReplySubmit = async (content: string, images: string[]) => {
        await onReply(content, images, note.id)
        setIsReplying(false)
    }

    return (
        <div className="flex gap-3 group">
            <div className="flex flex-col items-center">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-orange-100 border-2 border-white shadow-sm flex-shrink-0 flex items-center justify-center text-orange-600 font-bold text-xs">
                    {note.user?.avatar_url ? (
                        <Image src={note.user.avatar_url} alt={note.user?.full_name || 'User'} fill className="object-cover" />
                    ) : (
                        <span>{getInitials(note.user?.full_name)}</span>
                    )}
                </div>
                {/* Connector Line if not last? Actually tricky in recursive.
                    Standard threaded view often just indents.
                    Let's use a simple line if there are replies. */}
                {replies.length > 0 && (
                    <div className="w-0.5 flex-1 bg-stone-200 my-2" />
                )}
            </div>

            <div className="flex-1 pb-6">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-800 text-sm">{note.user?.full_name || 'Unknown User'}</span>
                        <span className="text-xs text-stone-400">
                            {format(new Date(note.created_at), "HH:mm dd/MM/yyyy", { locale: vi })}
                        </span>
                        {!note.system_code && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 font-medium">
                                <AlertCircle size={10} />
                                Chưa phân loại
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm inline-block min-w-[200px] max-w-full">
                    <p className="text-stone-700 text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>

                    {note.images && note.images.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {note.images.map((img, idx) => (
                                <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block relative aspect-square rounded-md overflow-hidden border border-stone-100">
                                    <img src={img} alt="Attachment" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-2 flex items-center gap-4">
                    <button
                        onClick={() => setIsReplying(!isReplying)}
                        className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-orange-600 transition-colors"
                    >
                        <MessageSquare size={14} />
                        Trả lời
                    </button>
                </div>

                {isReplying && (
                    <div className="mt-3">
                        <NoteInput
                            onSubmit={handleReplySubmit}
                            onCancel={() => setIsReplying(false)}
                            isReply={true}
                            autoFocus
                        />
                    </div>
                )}

                {/* Recursive Replies */}
                {replies.length > 0 && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-stone-100">
                        {replies.map(reply => {
                            // Find replies to this reply
                            const childReplies = allNotes.filter(n => n.parent_id === reply.id)
                            return (
                                <NoteItem
                                    key={reply.id}
                                    note={reply}
                                    replies={childReplies}
                                    allNotes={allNotes}
                                    onReply={onReply}
                                />
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
