'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAudit } from './_hooks/useAudit'
import { AuditSessionList } from './_components/AuditSessionList'
import { CreateAuditModal } from './_components/CreateAuditModal'

export default function AuditPage() {
    const { sessions, loading, fetchSessions, createSession, deleteSession } = useAudit()
    const [showCreateModal, setShowCreateModal] = useState(false)

    useEffect(() => {
        fetchSessions()
    }, [fetchSessions])

    return (
        <div className="max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Kiểm kê kho</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Quản lý các đợt kiểm kê và cân bằng kho hàng.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                >
                    <Plus size={20} />
                    <span>Tạo phiếu kiểm</span>
                </button>
            </div>

            {/* List */}
<<<<<<< HEAD
            <AuditSessionList
                sessions={sessions}
                loading={loading}
=======
            <AuditSessionList
                sessions={sessions}
                loading={loading}
>>>>>>> origin/main
                onDelete={deleteSession}
            />

            {/* Modal */}
<<<<<<< HEAD
            <CreateAuditModal
                isOpen={showCreateModal}
=======
            <CreateAuditModal
                isOpen={showCreateModal}
>>>>>>> origin/main
                onClose={() => setShowCreateModal(false)}
                onCreate={createSession}
            />
        </div>
    )
}
