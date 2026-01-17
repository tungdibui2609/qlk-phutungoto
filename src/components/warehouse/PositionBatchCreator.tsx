'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Eye, Loader2, Check, AlertCircle, FolderOpen, Trash2, Edit2, ChevronDown, ChevronRight, Save, X } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']

interface PositionBatchCreatorProps {
    onPositionsCreated?: () => void
}

interface BatchGroup {
    batch_name: string
    count: number
}

export default function PositionBatchCreator({ onPositionsCreated }: PositionBatchCreatorProps) {
    const [batchName, setBatchName] = useState('')
    const [prefix, setPrefix] = useState('')
    const [startNum, setStartNum] = useState(1)
    const [endNum, setEndNum] = useState(10)
    const [preview, setPreview] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ success: number; failed: number } | null>(null)

    // Existing batches
    const [batches, setBatches] = useState<BatchGroup[]>([])
    const [loadingBatches, setLoadingBatches] = useState(true)

    // Expanded batch to show positions
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
    const [batchPositions, setBatchPositions] = useState<Position[]>([])
    const [loadingPositions, setLoadingPositions] = useState(false)

    // Edit position
    const [editingPositionId, setEditingPositionId] = useState<string | null>(null)
    const [editCode, setEditCode] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)

    // Edit batch name
    const [editingBatchName, setEditingBatchName] = useState<string | null>(null)
    const [newBatchName, setNewBatchName] = useState('')

    useEffect(() => {
        fetchBatches()
    }, [])

    async function fetchBatches() {
        setLoadingBatches(true)
        const { data } = await supabase.from('positions').select('batch_name')

        if (data) {
            const groups: Record<string, number> = {}
            data.forEach(p => {
                const name = p.batch_name || '(Không có nhóm)'
                groups[name] = (groups[name] || 0) + 1
            })

            const batchList: BatchGroup[] = Object.entries(groups).map(([name, count]) => ({
                batch_name: name,
                count
            })).sort((a, b) => a.batch_name.localeCompare(b.batch_name))

            setBatches(batchList)
        }
        setLoadingBatches(false)
    }

    async function fetchBatchPositions(batchNameToFetch: string) {
        setLoadingPositions(true)

        let query = supabase.from('positions').select('*').order('display_order')

        if (batchNameToFetch === '(Không có nhóm)') {
            query = query.is('batch_name', null)
        } else {
            query = query.eq('batch_name', batchNameToFetch)
        }

        const { data } = await query
        setBatchPositions(data || [])
        setLoadingPositions(false)
    }

    function toggleExpandBatch(batchNameToExpand: string) {
        if (expandedBatch === batchNameToExpand) {
            setExpandedBatch(null)
            setBatchPositions([])
        } else {
            setExpandedBatch(batchNameToExpand)
            fetchBatchPositions(batchNameToExpand)
        }
    }

    // Generate preview list
    function generatePreview() {
        if (!prefix.trim()) {
            setPreview([])
            return
        }
        const codes: string[] = []
        for (let i = startNum; i <= endNum; i++) {
            codes.push(`${prefix.toUpperCase()}${i}`)
        }
        setPreview(codes)
    }

    // Create positions
    async function handleCreate() {
        if (preview.length === 0) {
            alert('Vui lòng tạo preview trước!')
            return
        }
        if (!batchName.trim()) {
            alert('Vui lòng nhập tên nhóm!')
            return
        }

        setLoading(true)
        setResult(null)

        let success = 0
        let failed = 0

        const batchSize = 50
        for (let i = 0; i < preview.length; i += batchSize) {
            const batch = preview.slice(i, i + batchSize).map((code, idx) => ({
                code: code.toUpperCase(),
                display_order: i + idx,
                batch_name: batchName.trim()
            }))

            const { error } = await supabase.from('positions').insert(batch)

            if (error) {
                console.error('Batch insert error:', error)
                failed += batch.length
            } else {
                success += batch.length
            }
        }

        setResult({ success, failed })
        setLoading(false)

        if (success > 0) {
            await fetchBatches()
            if (onPositionsCreated) onPositionsCreated()
        }
    }

    // Delete batch
    async function handleDeleteBatch(batchNameToDelete: string) {
        const batchInfo = batches.find(b => b.batch_name === batchNameToDelete)
        if (!confirm(`Xóa tất cả ${batchInfo?.count || 0} ô trong nhóm "${batchNameToDelete}"?`)) {
            return
        }

        let query = supabase.from('positions').delete()
        if (batchNameToDelete === '(Không có nhóm)') {
            query = query.is('batch_name', null)
        } else {
            query = query.eq('batch_name', batchNameToDelete)
        }

        const { error } = await query

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            alert(`Đã xóa nhóm "${batchNameToDelete}" thành công!`)
            setExpandedBatch(null)
            await fetchBatches()
            if (onPositionsCreated) onPositionsCreated()
        }
    }

    // Rename batch
    async function handleRenameBatch(oldName: string) {
        if (!newBatchName.trim()) {
            alert('Vui lòng nhập tên mới!')
            return
        }

        let query = supabase.from('positions').update({ batch_name: newBatchName.trim() })
        if (oldName === '(Không có nhóm)') {
            query = query.is('batch_name', null)
        } else {
            query = query.eq('batch_name', oldName)
        }

        const { error } = await query

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            alert('Đã đổi tên nhóm thành công!')
            setEditingBatchName(null)
            setNewBatchName('')
            await fetchBatches()
        }
    }

    // Edit single position code
    async function handleSavePositionEdit(positionId: string) {
        if (!editCode.trim()) {
            alert('Mã không được trống!')
            return
        }

        setSavingEdit(true)
        const { error } = await supabase
            .from('positions')
            .update({ code: editCode.trim().toUpperCase() })
            .eq('id', positionId)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            // Update local state
            setBatchPositions(prev => prev.map(p =>
                p.id === positionId ? { ...p, code: editCode.trim().toUpperCase() } : p
            ))
            setEditingPositionId(null)
            setEditCode('')
            if (onPositionsCreated) onPositionsCreated()
        }
        setSavingEdit(false)
    }

    // Delete single position
    async function handleDeletePosition(positionId: string, code: string) {
        if (!confirm(`Xóa ô "${code}"?`)) return

        const { error } = await supabase.from('positions').delete().eq('id', positionId)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            setBatchPositions(prev => prev.filter(p => p.id !== positionId))
            await fetchBatches()
            if (onPositionsCreated) onPositionsCreated()
        }
    }

    return (
        <div className="space-y-6">
            {/* Existing batches */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FolderOpen className="text-orange-600" size={20} />
                    Danh sách Nhóm đã tạo
                </h3>

                {loadingBatches ? (
                    <p className="text-gray-400 text-sm">Đang tải...</p>
                ) : batches.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">Chưa có nhóm nào</p>
                ) : (
                    <div className="space-y-2">
                        {batches.map(b => (
                            <div key={b.batch_name}>
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    {editingBatchName === b.batch_name ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <input
                                                type="text"
                                                value={newBatchName}
                                                onChange={(e) => setNewBatchName(e.target.value)}
                                                className="flex-1 px-2 py-1 border rounded text-sm"
                                                placeholder="Tên mới..."
                                            />
                                            <button onClick={() => handleRenameBatch(b.batch_name)} className="text-green-600 p-1">
                                                <Check size={16} />
                                            </button>
                                            <button onClick={() => setEditingBatchName(null)} className="text-gray-400 p-1">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => toggleExpandBatch(b.batch_name)}
                                                className="flex items-center gap-2 text-left flex-1"
                                            >
                                                {expandedBatch === b.batch_name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                                    {b.batch_name}
                                                </span>
                                                <span className="text-xs text-gray-500">({b.count} ô)</span>
                                            </button>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => { setEditingBatchName(b.batch_name); setNewBatchName(b.batch_name === '(Không có nhóm)' ? '' : b.batch_name) }}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Đổi tên nhóm"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBatch(b.batch_name)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    title="Xóa nhóm"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Expanded position list */}
                                {expandedBatch === b.batch_name && (
                                    <div className="ml-6 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                                        {loadingPositions ? (
                                            <p className="text-gray-400 text-sm">Đang tải...</p>
                                        ) : batchPositions.length === 0 ? (
                                            <p className="text-gray-400 text-sm">Không có ô nào</p>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                {batchPositions.map(pos => (
                                                    <div
                                                        key={pos.id}
                                                        className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600"
                                                    >
                                                        {editingPositionId === pos.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={editCode}
                                                                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                                                    className="w-full px-1 py-0.5 text-xs font-mono border rounded uppercase"
                                                                />
                                                                <button
                                                                    onClick={() => handleSavePositionEdit(pos.id)}
                                                                    disabled={savingEdit}
                                                                    className="text-green-600 p-0.5"
                                                                >
                                                                    <Save size={12} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingPositionId(null)}
                                                                    className="text-gray-400 p-0.5"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                                                                    {pos.code}
                                                                </span>
                                                                <div className="flex items-center gap-0.5">
                                                                    <button
                                                                        onClick={() => { setEditingPositionId(pos.id); setEditCode(pos.code) }}
                                                                        className="text-gray-400 hover:text-blue-600 p-0.5"
                                                                        title="Sửa mã"
                                                                    >
                                                                        <Edit2 size={10} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeletePosition(pos.id, pos.code)}
                                                                        className="text-gray-400 hover:text-red-600 p-0.5"
                                                                        title="Xóa ô"
                                                                    >
                                                                        <Trash2 size={10} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create new batch */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Plus className="text-blue-600" size={20} />
                    Tạo Ô mới theo dải mã
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên nhóm *</label>
                        <input
                            type="text"
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                            placeholder="VD: Khu A - Dãy 1"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prefix</label>
                        <input
                            type="text"
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                            placeholder="VD: A-K3D4T5.PL"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Từ số</label>
                        <input type="number" value={startNum} onChange={(e) => setStartNum(parseInt(e.target.value) || 1)} min={1}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Đến số</label>
                        <input type="number" value={endNum} onChange={(e) => setEndNum(parseInt(e.target.value) || 1)} min={startNum}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" />
                    </div>
                </div>

                <div className="flex gap-3 mb-6">
                    <button onClick={generatePreview}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
                        <Eye size={18} /> Xem trước ({endNum - startNum + 1} mã)
                    </button>
                    <button onClick={handleCreate} disabled={loading || preview.length === 0 || !batchName.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium">
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                        Tạo {preview.length} ô
                    </button>
                </div>

                {result && (
                    <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${result.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {result.failed === 0 ? <Check size={18} /> : <AlertCircle size={18} />}
                        <span>Đã tạo {result.success} ô. {result.failed > 0 && `Thất bại: ${result.failed}`}</span>
                    </div>
                )}

                {preview.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                        <p className="text-xs text-gray-500 mb-2">Nhóm: <strong>{batchName || '?'}</strong></p>
                        <div className="flex flex-wrap gap-2">
                            {preview.map((code, idx) => (
                                <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">{code}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
