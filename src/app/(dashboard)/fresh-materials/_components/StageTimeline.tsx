'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, ChevronRight, CheckCircle2, Clock, AlertCircle, ArrowRight, Trash2, TrendingDown, Leaf, Truck, Package, FileText, Printer, Link as LinkIcon, Target, Scale, Folder, Upload, File, ExternalLink, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import StageModal from './StageModal'
import StageOutputModal from './StageOutputModal'
import BatchReportModal from './BatchReportModal'

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
    const { profile } = useUser()
    const [isStageModalOpen, setIsStageModalOpen] = useState(false)
    const [editingStage, setEditingStage] = useState<any>(null)
    const [expandedStageId, setExpandedStageId] = useState<string | null>(null)
    const [isOutputModalOpen, setIsOutputModalOpen] = useState(false)
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [selectedStageForOutput, setSelectedStageForOutput] = useState<any>(null)
    const [editingOutput, setEditingOutput] = useState<any>(null)
    const [productionLots, setProductionLots] = useState<any[]>([])
    const [isUploading, setIsUploading] = useState<string | null>(null) // stageId

    const stages = (batch.fresh_material_stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order)
    const receivings = batch.fresh_material_receivings || []
    const totalReceived = receivings.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)

    // Fetch linked production lots
    useEffect(() => {
        const fetchLinkedProduction = async () => {
            if (!batch.id) return
            
            // 1. Find productions linked to this batch
            const { data: productionsData } = await supabase
                .from('productions')
                .select('id')
                .eq('fresh_material_batch_id', batch.id)
            
            const productions = (productionsData || []) as any[]
            
            if (productions.length === 0) {
                setProductionLots([])
                return
            }

            const productionIds = productions.map(p => p.id)

            // 2. Get lots and statistics
            const { data: lotsData } = await supabase
                .from('production_lots')
                .select('*, products(name)')
                .in('production_id', productionIds)
            
            const lots = (lotsData || []) as any[]
            
            if (lots.length === 0) {
                setProductionLots([])
                return
            }

            const lotIds = lots.map(l => l.id)

            // 3. Get actual quantities from view
            const { data: statsData } = await supabase
                .from('production_item_statistics' as any)
                .select('production_lot_id, actual_quantity')
                .in('production_lot_id', lotIds) as { data: any[] | null }
            
            const stats = statsData || []
            const statsMap: Record<string, number> = {}
            stats.forEach(s => {
                statsMap[s.production_lot_id] = s.actual_quantity || 0
            })

            // 4. Transform to stage output format
            const linkedOutputs = lots.map(l => ({
                id: `prod-lot-${l.id}`,
                output_type: 'PRODUCT',
                product_id: l.product_id,
                quantity: statsMap[l.id] || 0,
                unit: 'Kg', 
                grade: l.lot_code, 
                notes: `Từ LSX: ${l.lot_code}`,
                products: l.products,
                is_production_virtual: true 
            }))

            setProductionLots(linkedOutputs)
        }

        fetchLinkedProduction()
    }, [batch?.id])

    // Helper to get effective outputs for a stage
    const getEffectiveOutputs = (stage: any) => {
        if (stage.is_production_link) return productionLots
        return stage.fresh_material_stage_outputs || []
    }

    // Calculate total output for each stage
    const getStageOutputTotal = (stage: any) => {
        const outputs = getEffectiveOutputs(stage)
        return outputs.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
    }

    const getStageWaste = (stage: any) => {
        const outputs = getEffectiveOutputs(stage)
        return outputs.filter((o: any) => o.output_type === 'WASTE').reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
    }

    const getStageProducts = (stage: any) => {
        const outputs = getEffectiveOutputs(stage)
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

    const handleUploadDocument = async (stageId: string, companyName: string, warehouseName: string) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = "image/*,application/pdf"
        input.setAttribute('capture', 'environment')
        input.multiple = true
        input.onchange = async (e: any) => {
            const files = e.target.files
            if (!files || files.length === 0) return

            setIsUploading(stageId)
            try {
                const currentStage = stages.find((s: any) => s.id === stageId)
                const currentDocs = currentStage?.document_urls || []
                const newDocs = [...currentDocs]

                for (const file of files) {
                    const formData = new FormData()
                    // Chuẩn hóa file cho Mobile (Tránh lỗi định dạng lạ)
                    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type })
                    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
                    
                    formData.append('file', fileBlob, safeFileName)
                    formData.append('companyName', companyName)
                    formData.append('warehouseName', warehouseName)
                    formData.append('category', 'HoaDon_NguyenLieu')

                    const res = await fetch('/api/google-drive-upload', {
                        method: 'POST',
                        body: formData,
                        keepalive: true,
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    })
                    const data = await res.json()

                    if (data.success) {
                        newDocs.push({
                            name: data.name,
                            link: data.viewLink,
                            fileId: data.fileId,
                            uploadedAt: new Date().toISOString()
                        })
                    } else {
                        throw new Error(data.error || 'Upload failed')
                    }
                }

                // Update stage in DB
                const { error } = await (supabase as any)
                    .from('fresh_material_stages')
                    .update({ document_urls: newDocs })
                    .eq('id', stageId)

                if (error) throw error
                showToast(`Đã tải lên ${files.length} tài liệu`, 'success')
                onRefresh()
            } catch (err: any) {
                showToast('Lỗi upload: ' + err.message, 'error')
            } finally {
                setIsUploading(null)
            }
        }
        input.click()
    }

    const removeDocument = async (stageId: string, fileId: string) => {
        if (!await showConfirm('Xóa tài liệu này?')) return

        const currentStage = stages.find((s: any) => s.id === stageId)
        const newDocs = (currentStage?.document_urls || []).filter((d: any) => d.fileId !== fileId)
    
        const { error } = await (supabase as any)
            .from('fresh_material_stages')
            .update({ document_urls: newDocs })
            .eq('id', stageId)

        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa tài liệu', 'success')
            onRefresh()
        }
    }

    const handleUploadBatchDocument = async (batchId: string, companyName: string, warehouseName: string) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = "image/*,application/pdf"
        input.setAttribute('capture', 'environment')
        input.multiple = true
        input.onchange = async (e: any) => {
            const files = e.target.files
            if (!files || files.length === 0) return

            setIsUploading(`batch-${batchId}`)
            try {
                const currentDocs = batch.document_urls || []
                const newDocs = [...currentDocs]

                for (const file of files) {
                    const formData = new FormData()
                    // Chuẩn hóa file cho Mobile
                    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type })
                    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
                    
                    formData.append('file', fileBlob, safeFileName)
                    formData.append('companyName', companyName)
                    formData.append('warehouseName', warehouseName)
                    formData.append('category', 'HoaDon_Tong_NguyenLieu')

                    const res = await fetch('/api/google-drive-upload', {
                        method: 'POST',
                        body: formData,
                        keepalive: true,
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    })
                    const data = await res.json()

                    if (data.success) {
                        newDocs.push({
                            name: data.name,
                            link: data.viewLink,
                            fileId: data.fileId,
                            uploadedAt: new Date().toISOString()
                        })
                    } else {
                        throw new Error(data.error || 'Upload failed')
                    }
                }

                // Update batch in DB
                const { error } = await (supabase as any)
                    .from('fresh_material_batches')
                    .update({ document_urls: newDocs })
                    .eq('id', batchId)

                if (error) throw error
                showToast(`Đã tải lên ${files.length} hóa đơn bốc xe`, 'success')
                onRefresh()
            } catch (err: any) {
                showToast('Lỗi upload: ' + err.message, 'error')
            } finally {
                setIsUploading(null)
            }
        }
        input.click()
    }

    const removeBatchDocument = async (batchId: string, fileId: string) => {
        if (!await showConfirm('Xóa hóa đơn bốc xe này?')) return

        const newDocs = (batch.document_urls || []).filter((d: any) => d.fileId !== fileId)

        const { error } = await (supabase as any)
            .from('fresh_material_batches')
            .update({ document_urls: newDocs })
            .eq('id', batchId)

        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa hóa đơn', 'success')
            onRefresh()
        }
    }
    
    const handleDeleteOutput = async (outputId: string) => {
        if (!await showConfirm('Xóa kết quả này?')) return

        const { error } = await (supabase as any)
            .from('fresh_material_stage_outputs')
            .delete()
            .eq('id', outputId)

        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa kết quả', 'success')
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
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 text-xs font-bold hover:bg-stone-200 transition-all"
                    >
                        <Printer size={14} /> In báo cáo
                    </button>
                    <button
                        onClick={handleAddStage}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                    >
                        <Plus size={14} /> Thêm giai đoạn
                    </button>
                </div>
            </div>

            <div className="px-6 py-6">
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
                </div>

                {stages.length > 0 ? (
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-2 overflow-x-auto pb-4 no-scrollbar">
                        <div className="flex-shrink-0 w-full md:w-32 text-center bg-stone-50 dark:bg-zinc-800/50 md:bg-transparent p-4 md:p-0 rounded-2xl">
                            <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                                <Truck size={18} className="text-blue-600" />
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 font-black">Bốc xe</div>
                            <div className="text-sm font-black text-stone-800 dark:text-white mt-1 mb-2">
                                {totalReceived.toLocaleString('vi-VN')} <span className="text-[10px] text-stone-400">{batch.initial_unit}</span>
                            </div>
                            
                            {/* Batch Documents UI */}
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    disabled={!!isUploading}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        handleUploadBatchDocument(batch.id, (profile as any)?.companies?.name || 'Công ty', batch.system_code) 
                                    }}
                                    className="w-full py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[9px] font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-1"
                                >
                                    {isUploading === `batch-${batch.id}` ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                                    Hóa đơn
                                </button>
                                
                                <div className="flex flex-col gap-1.5">
                                    {(batch.document_urls || []).map((doc: any) => (
                                        <div key={doc.fileId} className="group/doc relative flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 rounded-lg shadow-sm">
                                            <File size={10} className="text-stone-400 shrink-0" />
                                            <a 
                                                href={doc.link} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-[8px] font-bold text-stone-600 dark:text-stone-300 hover:text-blue-600 truncate text-left"
                                                title={doc.name}
                                            >
                                                {doc.name}
                                            </a>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeBatchDocument(batch.id, doc.fileId) }}
                                                className="p-0.5 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded opacity-0 group-hover/doc:opacity-100 transition-opacity ml-auto"
                                            >
                                                <X size={8} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {stages.map((stage: any) => {
                            const isExpanded = expandedStageId === stage.id
                            const outputTotal = getStageOutputTotal(stage)
                            const productTotal = getStageProducts(stage)
                            const wasteTotal = getStageWaste(stage)
                            const lossRate = getStageLossRate(stage)
                            const statusIcon = STAGE_STATUS_ICON[stage.status as keyof typeof STAGE_STATUS_ICON] || STAGE_STATUS_ICON.PENDING
                            const outputs = getEffectiveOutputs(stage)

                            return (
                                <div key={stage.id} className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-2 w-full md:w-auto">
                                    <div className="flex flex-col md:flex-row items-center pt-0 md:pt-4">
                                        <div className="w-0.5 h-6 md:w-8 md:h-0.5 bg-stone-200 dark:bg-zinc-700" />
                                        <ArrowRight size={14} className="text-stone-300 -mt-1 md:-mt-0 md:-ml-1 rotate-90 md:rotate-0" />
                                    </div>

                                    <div
                                        className={`w-full md:w-52 rounded-2xl border transition-all cursor-pointer ${
                                            isExpanded
                                                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/10'
                                                : 'border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-stone-300'
                                        }`}
                                        onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                                    >
                                        <div className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleStageStatus(stage) }}
                                                    className="hover:scale-110 transition-transform"
                                                >
                                                    {statusIcon}
                                                </button>
                                                <span className="text-xs font-black text-stone-800 dark:text-white truncate max-w-[120px]">{stage.stage_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {stage.is_production_link && (
                                                    <div className="px-1.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-[8px] font-black uppercase flex items-center gap-1">
                                                        <LinkIcon size={8} /> LSX
                                                    </div>
                                                )}
                                                <span className="text-[10px] font-bold text-stone-400">#{stage.stage_order}</span>
                                            </div>
                                        </div>

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
                                                            Giảm: {(stage.input_quantity - outputTotal).toLocaleString('vi-VN')} {stage.input_unit} ({lossRate.toFixed(1)}%)
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-stone-100 dark:border-zinc-700 p-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                <div className="space-y-1.5">
                                                    {outputs.length > 0 ? outputs.map((o: any) => (
                                                        <div key={o.id} className={`group flex items-center justify-between text-[10px] p-2 rounded-lg transition-all ${
                                                            o.output_type === 'WASTE'
                                                                ? 'bg-red-50 dark:bg-red-900/10'
                                                                : 'bg-emerald-50 dark:bg-emerald-900/10'
                                                        }`}>
                                                            <div className="flex flex-col gap-1 w-full relative">
                                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.output_type === 'WASTE' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                                                    <span className="font-black text-stone-800 dark:text-white truncate text-[11px] uppercase tracking-tight">
                                                                        {o.products?.name || o.grade || (o.output_type === 'WASTE' ? 'Phế phẩm' : 'Sản phẩm')}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between pl-3 mt-0.5">
                                                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                                        {o.quantity.toLocaleString('vi-VN')} {o.unit}
                                                                    </span>
                                                                    {!o.is_production_virtual && (
                                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { 
                                                                                    e.stopPropagation(); 
                                                                                    setSelectedStageForOutput(stage);
                                                                                    setEditingOutput(o);
                                                                                    setIsOutputModalOpen(true);
                                                                                }}
                                                                                className="p-1 px-1.5 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded text-blue-500 transition-colors bg-white/50 dark:bg-zinc-800/50"
                                                                            >
                                                                                <FileText size={10} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); handleDeleteOutput(o.id) }}
                                                                                className="p-1 px-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-colors bg-white/50 dark:bg-zinc-800/50"
                                                                            >
                                                                                <Trash2 size={10} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {o.is_production_virtual && (
                                                                        <span className="text-[8px] font-bold text-stone-400 uppercase italic">Tự động</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <p className="text-[10px] text-stone-400 text-center italic">Chưa có output</p>
                                                    )}
                                                </div>
                                                
                                                {/* Documents Section */}
                                                <div className="pt-3 border-t border-stone-100 dark:border-zinc-700 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">
                                                            <Folder size={12} className="text-blue-400" /> Hóa đơn / Chứng từ
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={!!isUploading}
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                handleUploadDocument(stage.id, (profile as any)?.companies?.name || 'Công ty', batch.system_code) 
                                                            }}
                                                            className="p-1 px-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[9px] font-bold hover:bg-blue-100 transition-all flex items-center gap-1"
                                                        >
                                                            {isUploading === stage.id ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                                                            Tải lên
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {(stage.document_urls || []).map((doc: any) => (
                                                            <div key={doc.fileId} className="group/doc relative flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 rounded-lg shadow-sm">
                                                                <File size={10} className="text-stone-400" />
                                                                <a 
                                                                    href={doc.link} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="text-[9px] font-bold text-stone-600 dark:text-stone-300 hover:text-emerald-600 truncate max-w-[80px]"
                                                                    title={doc.name}
                                                                >
                                                                    {doc.name}
                                                                </a>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); removeDocument(stage.id, doc.fileId) }}
                                                                    className="p-0.5 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded opacity-0 group-hover/doc:opacity-100 transition-opacity"
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {(!stage.document_urls || stage.document_urls.length === 0) && !isUploading && (
                                                            <div className="text-[8px] text-stone-400 italic">Chưa có chứng từ</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {!stage.is_production_link && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setSelectedStageForOutput(stage);
                                                            setEditingOutput(null);
                                                            setIsOutputModalOpen(true);
                                                        }}
                                                        className="group w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/30 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-lg hover:shadow-emerald-600/20 transition-all duration-300"
                                                    >
                                                        <Plus size={14} className="group-hover:rotate-90 transition-transform duration-300" />
                                                        Thêm kết quả
                                                    </button>
                                                )}

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
                    </div>
                )}

                {/* Final Summary Card */}
                {stages.length > 0 && (
                    <div className="mt-12 p-8 bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20 rounded-[32px] border border-emerald-100/50 dark:border-emerald-800/30 shadow-inner">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 shadow-sm text-emerald-600">
                                <Target size={18} />
                            </div>
                            <h3 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-widest">
                                Tổng kết hiệu suất lô hàng
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Tổng nhập nguyên liệu</div>
                                <div className="text-xl font-black text-stone-800 dark:text-white">
                                    {totalReceived.toLocaleString('vi-VN')} <span className="text-xs text-stone-400">KG</span>
                                </div>
                            </div>

                            {(() => {
                                const lastStage = stages[stages.length - 1]
                                const finalProducts = getEffectiveOutputs(lastStage).filter((o: any) => o.output_type === 'PRODUCT')
                                const totalProduct = finalProducts.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
                                const totalLoss = totalReceived - totalProduct
                                const yieldRate = totalReceived > 0 ? (totalProduct / totalReceived) * 100 : 0

                                return (
                                    <>
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Thành phẩm cuối cùng</div>
                                            <div className="text-xl font-black text-emerald-600">
                                                {totalProduct.toLocaleString('vi-VN')} <span className="text-xs text-emerald-400">KG</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Hiệu suất thu hồi (Yield)</div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-xl font-black text-blue-600">
                                                    {yieldRate.toFixed(1)}%
                                                </div>
                                                {yieldRate < 80 ? (
                                                    <TrendingDown size={16} className="text-red-500" />
                                                ) : (
                                                    <Scale size={16} className="text-emerald-500" />
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                )}
            </div>

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

            <StageOutputModal
                isOpen={isOutputModalOpen}
                onClose={() => {
                    setIsOutputModalOpen(false)
                    setSelectedStageForOutput(null)
                    setEditingOutput(null)
                }}
                onSuccess={onRefresh}
                stageId={selectedStageForOutput?.id}
                batchId={batch.id}
                systemCode={batch.system_code}
                defaultUnit={selectedStageForOutput?.input_unit || batch.initial_unit}
                stageName={selectedStageForOutput?.stage_name || ''}
                editItem={editingOutput}
            />

            <BatchReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                batch={batch}
            />
        </div>
    )
}
