'use client'

import NoteTimeline from '@/components/operations/notes/NoteTimeline'

export default function OperationalNotesPage() {
    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800">Ghi chú vận hành</h1>
                    <p className="text-stone-500 text-sm mt-1">Ghi lại và thảo luận các vấn đề phát sinh trong quá trình vận hành</p>
                </div>
            </div>

            <div className="mt-6">
                <NoteTimeline />
            </div>
        </div>
    )
}
