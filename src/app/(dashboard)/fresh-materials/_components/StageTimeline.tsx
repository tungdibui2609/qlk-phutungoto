'use client'

import { useState } from 'react'
import { Plus, ChevronRight, CheckCircle2, Clock, AlertCircle, ArrowRight, Trash2, TrendingDown, Leaf, Truck, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import StageModal from './StageModal'
import StageOutputForm from './StageOutputForm'

interface StageTimelineProps {
    batch: any
    onRefresh: () => void
}

const STAGE_STATUS_ICON = {
    PENDING: <Clock size={16} className="text-stone-400" />,
    IN_PROGRESS: <AlertCircle size={16} className="text-orange-500" />,
    DONE: <CheckCircle2 size={16} className="text-emerald-500" />,
}

export default function StageTimeline({ batch, onRefresh }: StageTimelineProps) {
    const { showToast, showConfirm } = useToast()
    const [isStageModalOpen, setIsStageModalOpen] = useState(false)
    const [editingStage, setEditingStage] = useState<any>(null)
    const [expandedStageId, setExpandedStageId] = useState<string | null>(null)

    const stages = (batch.fresh_material_stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order)
    const receivings = batch.fresh_material_receivings || []
    const totalReceived = receivings.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)

    // Calculate total output for each stage
    const getStageOutputTotal = (stage: any) => {
        const outputs = stage.fresh_material_stage_outputs || []
        return outputs.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
    }

    const getStageWaste = (stage: any) => {
        const outputs = stage.fresh_material_stage_outputs || []
        return outputs.filter((o: any) => o.output_type === 'WASTE').reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
    }

    const getStageProducts = (stage: any) => {
        const outputs = stage.fresh_material_stage_outputs || []
        return outputs.filter((o: any) => o.output_type === 'PRODUCT').reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
    }

    // Loss rate between input and output
    const getStageLossRate = (stage: any) => {
        const input = stage.input_quantity || 0
        if (input <= 0) return 0
        const totalOut = getStageOutputTotal(stage)
        return ((input - totalOut) / input * 100)
    }

    const handleAddStage = () => {
        setEditingStage(null)
        setIsStageModalOpen(true)
    }

    const handleEditStage = (stage: any) => {
        setEditingStage(stage)
        setIsStageModalOpen(true)
    }

    const handleDeleteStage = async (stageId: string) => {
        if (!await showConfirm('Xóa giai đoạn này? Tất cả output sẽ bị xóa.')) return

        const { error } = await (supabase as any)
            .from('fresh_material_stages')
            .delete()
            .eq('id', stageId)

        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa giai đoạn', 'success')
            onRefresh()
        }
    }

    const toggleStageStatus = async (stage: any) => {
        const nextStatus = stage.status === 'DONE' ? 'PENDING' : stage.status === 'IN_PROGRESS' ? 'DONE' : 'IN_PROGRESS'
        const updateData: any = {
            status: nextStatus,
            updated_at: new Date().toISOString()
        }
        if (nextStatus === 'IN_PROGRESS' && !stage.started_at) {
            updateData.started_at = new Date().toISOString()
        }
        if (nextStatus === 'DONE') {
            updateData.completed_at = new Date().toISOString()
        }

        const { error } = await (supabase as any)
            .from('fresh_material_stages')
            .update(updateData)
            .eq('id', stage.id)

        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            onRefresh()
        }
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="px-6 py-5 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                        <Leaf size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-black text-stone-800 dark:text-white">{batch.batch_code}</h3>
                        <p className="text-xs text-stone-400 font-medium">{batch.products?.name || 'Nguyên liệu'} • {batch.suppliers?.name || 'NCC'}</p>
                    </div>
                </div>
                <button
                    onClick={handleAddStage}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                >
                    <Plus size={14} /> Thêm giai đoạn
                </button>
            </div>

            {/* Pipeline Visual */}
            <div className="px-6 py-6">
                {/* Summary Bar */}
                <div className="flex items-center gap-4 mb-6 p-4 bg-stone-50 dark:bg-zinc-800 rounded-2xl">
                    <div className="flex items-center gap-2">
                        <Truck size={16} className="text-blue-500" />
                        <span className="text-xs font-bold text-stone-500">Tổng nhập:</span>
                        <span className="font-black text-stone-800 dark:text-white">{totalReceived.toLocaleString('vi-VN')} {batch.initial_unit}</span>
                    </div>
                    {receivings.length > 0 && (
                        <span className="text-[10px] font-bold text-stone-400 bg-stone-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                            {receivings.length} lần nhập
                        </span>
                    )}
                    {stages.length > 0 && (
                        <>
                            <ArrowRight size={14} className="text-stone-300" />
                            <div className="flex items-center gap-2">
                                <Package size={16} className="text-emerald-500" />
                                <span className="text-xs font-bold text-stone-500">Sau xử lý:</span>
                                <span className="font-black text-emerald-600">
                                    {getStageProducts(stages[stages.length - 1]).toLocaleString('vi-VN')} {batch.initial_unit}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Horizontal Pipeline Stepper */}
                {stages.length > 0 ? (
                    <div className="flex items-start gap-2 overflow-x-auto pb-4">
                        {/* Receiving Node */}
                        <div className="flex-shrink-0 w-32 text-center">
                            <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                                <Truck size={18} className="text-blue-600" />
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">Bốc xe</div>
                            <div className="text-sm font-black text-stone-800 dark:text-white mt-1">{totalReceived.toLocaleString('vi-VN')} {batch.initial_unit}</div>
                        </div>

                        {stages.map((stage: any, idx: number) => {
                            const isExpanded = expandedStageId === stage.id
                            const outputTotal = getStageOutputTotal(stage)
                            const productTotal = getStageProducts(stage)
                            const wasteTotal = getStageWaste(stage)
                            const lossRate = getStageLossRate(stage)
                            const statusIcon = STAGE_STATUS_ICON[stage.status as keyof typeof STAGE_STATUS_ICON] || STAGE_STATUS_ICON.PENDING
                            const outputs = stage.fresh_material_stage_outputs || []

                            return (
                                <div key={stage.id} className="flex items-start gap-2 flex-shrink-0">
                                    {/* Arrow */}
                                    <div className="flex items-center pt-4">
                                        <div className="w-8 h-0.5 bg-stone-200 dark:bg-zinc-700" />
                                        <ArrowRight size={14} className="text-stone-300 -ml-1" />
                                    </div>

                                    {/* Stage Node */}
                                    <div
                                        className={`w-52 rounded-2xl border transition-all cursor-pointer ${
                                            isExpanded
                                                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/10'
                                                : 'border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-stone-300'
                                        }`}
                                        onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                                    >
                                        {/* Stage Header */}
                                        <div className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleStageStatus(stage) }}
                                                    className="hover:scale-110 transition-transform"
                                                    title="Đổi trạng thái"
                                                >
                                                    {statusIcon}
                                                </button>
                                                <span className="text-xs font-black text-stone-800 dark:text-white truncate max-w-[120px]">{stage.stage_name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-stone-400">#{stage.stage_order}</span>
                                        </div>

                                        {/* Stage Stats */}
                                        <div className="px-3 pb-3 space-y-1.5">
                                            <div className="flex justify-between text-[10px]">
                                                <span className="text-stone-400 font-bold">Đầu vào</span>
                                                <span className="font-black text-stone-600 dark:text-stone-300">
                                                    {(stage.input_quantity || 0).toLocaleString('vi-VN')} {stage.input_unit}
                                                </span>
                                            </div>
                                            {outputTotal > 0 && (
                                                <>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-emerald-500 font-bold">Sản phẩm</span>
                                                        <span className="font-black text-emerald-600">{productTotal.toLocaleString('vi-VN')} {stage.input_unit}</span>
                                                    </div>
                                                    {wasteTotal > 0 && (
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-red-400 font-bold">Hao hụt</span>
                                                            <span className="font-black text-red-500">{wasteTotal.toLocaleString('vi-VN')} {stage.input_unit}</span>
                                                        </div>
                                                    )}
                                                    {lossRate > 0 && (
                                                        <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold">
                                                            <TrendingDown size={10} />
                                                            Tỉ lệ giảm: {lossRate.toFixed(1)}%
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Expanded: Outputs Detail + Actions */}
                                        {isExpanded && (
                                            <div className="border-t border-stone-100 dark:border-zinc-700 p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                {/* Output list */}
                                                {outputs.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {outputs.map((o: any) => (
                                                            <div key={o.id} className={`flex items-center justify-between text-[10px] p-2 rounded-lg ${
                                                                o.output_type === 'WASTE'
                                                                    ? 'bg-red-50 dark:bg-red-900/10'
                                                                    : 'bg-emerald-50 dark:bg-emerald-900/10'
                                                            }`}>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${o.output_type === 'WASTE' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                                                    <span className="font-bold text-stone-700 dark:text-stone-300 truncate max-w-[80px]">
                                                                        {o.products?.name || o.grade || o.output_type}
                                                                    </span>
                                                                </div>
                                                                <span className="font-black">{o.quantity.toLocaleString('vi-VN')} {o.unit}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-stone-400 text-center italic">Chưa có output</p>
                                                )}

                                                {/* Output Form */}
                                                <StageOutputForm
                                                    stageId={stage.id}
                                                    batchId={batch.id}
                                                    systemCode={batch.system_code}
                                                    defaultUnit={stage.input_unit || batch.initial_unit}
                                                    onSuccess={onRefresh}
                                                />

                                                {/* Stage Actions */}
                                                <div className="flex items-center gap-1 pt-2 border-t border-stone-100 dark:border-zinc-700">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEditStage(stage) }}
                                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteStage(stage.id) }}
                                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Clock size={32} className="text-stone-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-stone-400">Chưa có giai đoạn xử lý nào</p>
                        <p className="text-xs text-stone-300 mt-1">Nhấn "Thêm giai đoạn" để bắt đầu theo dõi vòng đời</p>
                    </div>
                )}
            </div>

            {/* Stage Modal */}
            <StageModal
                isOpen={isStageModalOpen}
                onClose={() => setIsStageModalOpen(false)}
                onSuccess={onRefresh}
                batchId={batch.id}
                editItem={editingStage}
                nextOrder={stages.length + 1}
                previousStageOutput={stages.length > 0 ? getStageProducts(stages[stages.length - 1]) : totalReceived}
                defaultUnit={batch.initial_unit || 'Kg'}
            />
        </div>
    )
}
