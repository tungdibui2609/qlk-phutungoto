'use client'

import React from 'react'
import { MapPin, X, AlertTriangle, Edit2 } from 'lucide-react'
import { type PendingAssignment, type Lot } from './helpers'

interface AssignmentModalsProps {
    editingId: string | null
    setEditingId: React.Dispatch<React.SetStateAction<string | null>>
    pendingList: PendingAssignment[]
    editValues: { lot_stt: string; position_id: string; position_code: string }
    setEditValues: React.Dispatch<React.SetStateAction<{ lot_stt: string; position_id: string; position_code: string }>>
    allPositions: any[]
    handleSaveEdit: (ass: PendingAssignment) => Promise<void>
    showOrphanedModal: boolean
    setShowOrphanedModal: React.Dispatch<React.SetStateAction<boolean>>
    orphanedPositions: any[]
    actionLoading: string | null
    handleReleaseOrphanedPositions: (targetPosIds: string[]) => Promise<void>
}

export function AssignmentModals({
    editingId,
    setEditingId,
    pendingList,
    editValues,
    setEditValues,
    allPositions,
    handleSaveEdit,
    showOrphanedModal,
    setShowOrphanedModal,
    orphanedPositions,
    actionLoading,
    handleReleaseOrphanedPositions,
}: AssignmentModalsProps) {
    return (
        <>
            {/* Edit Modal */}
            {editingId && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-[40px] p-8 w-full max-w-md shadow-2xl border border-zinc-100 dark:border-zinc-800 animate-in zoom-in duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600"><Edit2 size={24} /></div>
                            <div>
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Chỉnh sửa yêu cầu</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mt-0.5">Mobile Assignment Fix</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1.5 ml-1">Số STT Lô hàng</label>
                                <input type="text" autoCapitalize="characters" value={editValues.lot_stt} onChange={e => setEditValues(prev => ({...prev, lot_stt: e.target.value.toUpperCase()}))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-base font-black text-zinc-900 dark:text-white outline-none focus:border-blue-500 shadow-inner uppercase" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-1.5 ml-1">Mã số vị trí kệ hàng</label>
                                <input value={editValues.position_code} list="edit-pos-list" onChange={e => setEditValues(prev => ({...prev, position_code: e.target.value}))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-base font-black uppercase text-zinc-900 dark:text-white outline-none focus:border-blue-500 shadow-inner" />
                                <datalist id="edit-pos-list">{allPositions.map(p => <option key={p.id} value={p.code} />)}</datalist>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setEditingId(null)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 font-black rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95">Hủy bỏ</button>
                            <button onClick={() => handleSaveEdit(pendingList.find(a => a.id === editingId)!)} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Lưu nháp</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Dọn dẹp vị trí kẹt */}
            {showOrphanedModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-[40px] p-8 w-full max-w-lg shadow-2xl border border-zinc-100 dark:border-zinc-800 animate-in zoom-in duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-600"><AlertTriangle size={24} /></div>
                                <div>
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Dọn dẹp vị trí kẹt</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mt-0.5">Phát hiện dữ liệu mồ côi</p>
                                </div>
                            </div>
                            <button onClick={() => setShowOrphanedModal(false)} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20 rounded-3xl p-5 mb-6 text-xs text-red-750 dark:text-red-400 font-semibold leading-relaxed">
                            ⚠️ Các vị trí dưới đây đang liên kết với lô sản xuất đã bị xóa trực tiếp. Vị trí này sẽ không được xem là "Trống" trên Mobile và gây sai lệch bản đồ kho. Vui lòng bấm <strong>Giải phóng</strong> để đưa vị trí về trống.
                        </div>

                        <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                            {orphanedPositions.map((pos) => (
                                <div key={pos.id} className="flex items-center justify-between p-4 bg-zinc-50/50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl flex items-center justify-center font-black text-sm"><MapPin size={18} /></div>
                                        <div>
                                            <div className="text-sm font-black text-zinc-900 dark:text-white uppercase">{pos.code}</div>
                                            <div className="text-[10px] text-zinc-550 dark:text-zinc-450 font-bold uppercase tracking-wider">Lot ID kẹt: {pos.lot_id?.slice(0, 8)}...</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleReleaseOrphanedPositions([pos.id])}
                                        disabled={actionLoading === 'orphans-release'}
                                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-black text-[10px] uppercase rounded-xl shadow-md shadow-red-500/10 transition-all active:scale-95"
                                    >
                                        Giải phóng
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button 
                                onClick={() => setShowOrphanedModal(false)} 
                                className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-black rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95"
                            >
                                Đóng lại
                            </button>
                            {orphanedPositions.length > 1 && (
                                <button 
                                    onClick={() => handleReleaseOrphanedPositions(orphanedPositions.map(p => p.id))}
                                    disabled={actionLoading === 'orphans-release'}
                                    className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-red-650/20 active:scale-95 transition-all"
                                >
                                    Giải phóng tất cả ({orphanedPositions.length})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
