import { useState, useEffect } from 'react'
import { X, TrendingDown, Target, Scale, ArrowRight, PieChart, Activity, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface BatchAnalyticsModalProps {
    isOpen: boolean
    onClose: () => void
    batch: any
}

export default function BatchAnalyticsModal({ isOpen, onClose, batch }: BatchAnalyticsModalProps) {
    const [productionLots, setProductionLots] = useState<any[]>([])

    // Fetch linked production lots (similar logic to StageTimeline)
    useEffect(() => {
        const fetchLinkedProduction = async () => {
            if (!isOpen || !batch?.id) return
            
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
            const { data: lotsData } = await supabase
                .from('production_lots')
                .select('*, products(name)')
                .in('production_id', productionIds)
            
            const lots = (lotsData || []) as any[]
            if (lots.length === 0) {
                setProductionLots([])
                return
            }

            const { data: statsData } = await supabase
                .from('production_item_statistics' as any)
                .select('production_lot_id, actual_quantity')
                .in('production_lot_id', lots.map(l => l.id)) as { data: any[] | null }
            
            const statsMap: Record<string, number> = {}
            statsData?.forEach(s => { statsMap[s.production_lot_id] = s.actual_quantity || 0 })

            const linkedOutputs = lots.map(l => ({
                id: `prod-lot-${l.id}`,
                output_type: 'PRODUCT',
                product_id: l.product_id,
                quantity: statsMap[l.id] || 0,
                products: l.products
            }))

            setProductionLots(linkedOutputs)
        }

        fetchLinkedProduction()
    }, [isOpen, batch?.id])

    if (!isOpen || !batch) return null

    const receivings = batch.fresh_material_receivings || []
    const totalInput = receivings.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)
    
    const stages = (batch.fresh_material_stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order)
    
    // Helper to get effective outputs for a stage
    const getEffectiveOutputs = (stage: any) => {
        if (stage.is_production_link) return productionLots
        return stage.fresh_material_stage_outputs || []
    }

    // Calculate final output based on the last stage
    const finalStage = stages.length > 0 ? stages[stages.length - 1] : null
    const finalOutputs = finalStage ? getEffectiveOutputs(finalStage).filter((o: any) => o.output_type === 'PRODUCT') : []
    const totalFinalProduct = finalOutputs.reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
    
    const totalLoss = totalInput - totalFinalProduct
    const yieldRate = totalInput > 0 ? (totalFinalProduct / totalInput) * 100 : 0
    const lossRate = 100 - yieldRate

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600">
                            <PieChart size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900 dark:text-white">Phân tích hiệu suất Lô hàng</h2>
                            <p className="text-xs text-stone-500 font-medium">Mã lô: <span className="text-emerald-600 underline">{batch.batch_code}</span> • {batch.products?.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={24} className="text-stone-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-stone-50/30 dark:bg-zinc-950/20">
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-stone-100 dark:border-zinc-800 shadow-sm">
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Tổng nhập kho</div>
                            <div className="text-2xl font-black text-stone-900 dark:text-white">{totalInput.toLocaleString('vi-VN')} <span className="text-xs text-stone-400">KG</span></div>
                        </div>
                        <div className="p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-stone-100 dark:border-zinc-800 shadow-sm">
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Thành phẩm cuối</div>
                            <div className="text-2xl font-black text-emerald-600">{totalFinalProduct.toLocaleString('vi-VN')} <span className="text-xs text-emerald-400">KG</span></div>
                        </div>
                        <div className="p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-stone-100 dark:border-zinc-800 shadow-sm">
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Tỉ lệ thu hồi (Yield)</div>
                            <div className="flex items-end gap-2">
                                <div className="text-2xl font-black text-blue-600">{yieldRate.toFixed(1)}%</div>
                                <Activity size={16} className="text-blue-400 mb-1.5" />
                            </div>
                        </div>
                        <div className="p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-stone-100 dark:border-zinc-800 shadow-sm">
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Hao hụt toàn bộ</div>
                            <div className="flex items-end gap-2">
                                <div className="text-2xl font-black text-red-500">{lossRate.toFixed(1)}%</div>
                                <TrendingDown size={16} className="text-red-400 mb-1.5" />
                            </div>
                        </div>
                    </div>

                    {/* Process Flow Visualization */}
                    <div className="p-8 bg-white dark:bg-zinc-800 rounded-[32px] border border-stone-100 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-2">
                            <Target size={18} className="text-emerald-500" /> Dòng chảy khối lượng
                        </h3>
                        
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* Input Circle */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-20 h-20 rounded-full border-4 border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 shadow-inner">
                                    <span className="text-xs font-black text-emerald-600">100%</span>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Đầu xe</div>
                                    <div className="font-bold text-stone-700 dark:text-white">{totalInput.toLocaleString()} kg</div>
                                </div>
                            </div>

                            {/* Stages Loops */}
                            {stages.map((stage: any, idx: number) => {
                                const effectiveOutputs = getEffectiveOutputs(stage)
                                const stageProduct = effectiveOutputs.filter((o: any) => o.output_type === 'PRODUCT').reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
                                
                                return (
                                    <div key={stage.id} className="flex flex-col md:flex-row items-center gap-4 group">
                                        <ArrowRight className="text-stone-200 dark:text-zinc-700 md:rotate-0 rotate-90" />
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="px-6 py-4 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 group-hover:border-emerald-200 transition-colors">
                                                <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap mb-1">GĐ #{idx + 1}: {stage.stage_name}</div>
                                                <div className="font-bold text-stone-800 dark:text-white text-center">
                                                    {stageProduct.toLocaleString()} kg
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            <ArrowRight className="text-stone-200 dark:text-zinc-700 md:rotate-0 rotate-90" />

                            {/* Final Circle */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-20 h-20 rounded-full border-4 border-blue-100 dark:border-blue-900/30 flex items-center justify-center bg-blue-50 dark:bg-blue-950/20 shadow-inner ring-4 ring-emerald-50 dark:ring-emerald-950/10">
                                    <span className="text-xs font-black text-blue-600">{yieldRate.toFixed(1)}%</span>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Thành phẩm</div>
                                    <div className="font-bold text-stone-700 dark:text-white">{totalFinalProduct.toLocaleString()} kg</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Analysis Table */}
                    <div className="p-8 bg-white dark:bg-zinc-800 rounded-[32px] border border-stone-100 dark:border-zinc-800 shadow-sm overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 dark:border-zinc-700 text-left">
                                    <th className="pb-4 pr-4">Giai đoạn</th>
                                    <th className="pb-4 px-4 text-right">Đầu vào (kg)</th>
                                    <th className="pb-4 px-4 text-right">Đầu ra sản phẩm (kg)</th>
                                    <th className="pb-4 px-4 text-right">Hao hụt/Phế (kg)</th>
                                    <th className="pb-4 px-4 text-right">Hao hụt (%)</th>
                                    <th className="pb-4 px-4 text-center">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50 dark:divide-zinc-800">
                                {stages.map((stage: any) => {
                                    const effectiveOutputs = getEffectiveOutputs(stage)
                                    const stageProduct = effectiveOutputs.filter((o: any) => o.output_type === 'PRODUCT').reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
                                    const stageScrap = effectiveOutputs.filter((o: any) => o.output_type !== 'PRODUCT').reduce((sum: number, o: any) => sum + (o.quantity || 0), 0)
                                    const stageLoss = (stage.input_quantity || 0) - stageProduct
                                    const stageLossRate = stage.input_quantity > 0 ? (stageLoss / stage.input_quantity) * 100 : 0

                                    return (
                                        <tr key={stage.id}>
                                            <td className="py-4 pr-4">
                                                <div className="font-bold text-stone-800 dark:text-white">{stage.stage_name}</div>
                                                <div className="text-[10px] text-stone-400 font-medium">Bắt đầu: {stage.started_at ? new Date(stage.started_at).toLocaleDateString() : '---'}</div>
                                            </td>
                                            <td className="py-4 px-4 text-right font-bold text-stone-600">{stage.input_quantity?.toLocaleString()}</td>
                                            <td className="py-4 px-4 text-right font-black text-emerald-600">{stageProduct.toLocaleString()}</td>
                                            <td className="py-4 px-4 text-right font-bold text-orange-500">{stageLoss.toLocaleString()}</td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className={`text-xs font-black ${stageLossRate > 20 ? 'text-red-500' : 'text-stone-500'}`}>
                                                        {stageLossRate.toFixed(1)}%
                                                    </span>
                                                    <div className="w-12 h-1.5 bg-stone-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${stageLossRate > 20 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                                            style={{ width: `${Math.min(stageLossRate, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {stage.status === 'DONE' ? (
                                                    <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                                                ) : (
                                                    <AlertCircle size={16} className="text-orange-400 mx-auto" />
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50 shrink-0">
                    <div className="text-xs text-stone-400 font-medium italic">
                        * Dữ liệu được tính toán dựa trên sai số thực tế giữa các giai đoạn.
                    </div>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                    >
                        Đóng báo cáo
                    </button>
                </div>
            </div>
        </div>
    )
}
