// @ts-nocheck
'use client'

import React from 'react'
import { Loader2, LayoutList } from 'lucide-react'
import { formatQuantityFull, decodeSTT } from '@/lib/numberUtils'
import { format } from 'date-fns'

interface LotReportContentProps {
    loading: boolean
    activeTab: 'inward' | 'outward' | 'unassigned'
    startDate: string
    endDate: string
    reportDataInward: any[]
    reportDataOutward: any[]
    reportDataUnassigned: any[]
    groupedInwardData: any[]
    productionLotsMap: Record<string, any>
    summaryInward: any
    summaryOutward: any
    summaryUnassigned: any
    companyInfo: any
}

export function LotReportContent({
    loading,
    activeTab,
    startDate,
    endDate,
    reportDataInward,
    reportDataOutward,
    reportDataUnassigned,
    groupedInwardData,
    productionLotsMap,
    summaryInward,
    summaryOutward,
    summaryUnassigned,
    companyInfo,
}: LotReportContentProps) {
    return (
        <>
            {/* Content */}
            <div id="printable-report-area" className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-3 no-print">
                        <Loader2 size={40} className="animate-spin text-orange-500" />
                        <p className="text-sm font-bold text-slate-500 animate-pulse">Đang nạp dữ liệu...</p>
                    </div>
                ) : (activeTab === 'inward' ? reportDataInward.length === 0 : activeTab === 'outward' ? reportDataOutward.length === 0 : reportDataUnassigned.length === 0) ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400 no-print">
                        <LayoutList size={48} strokeWidth={1} />
                        <p className="font-medium">Không tìm thấy dữ liệu {activeTab === 'inward' ? 'nhập' : activeTab === 'outward' ? 'xuất' : 'chưa gán vị trí'} nào</p>
                    </div>
                ) : (
                    <div className="report-root">
                        {/* Print Version Header */}
                        <div className="print-header hidden print:block" style={{ marginBottom: '30px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', width: '100%' }}>
                                    {companyInfo?.logo_url && (
                                        <img src={companyInfo.logo_url} alt="Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <h1 style={{ fontSize: '12pt', fontWeight: 'bold', margin: '0 0 4px 0', textTransform: 'uppercase', color: '#0f172a', lineHeight: '1.2' }}>
                                            {companyInfo?.name}
                                        </h1>
                                        <div style={{ fontSize: '9pt', color: '#475569', lineHeight: '1.4' }}>
                                            <p style={{ margin: '0', whiteSpace: 'nowrap' }}><strong>Địa chỉ:</strong> {companyInfo?.address}</p>
                                            <p style={{ margin: '0', whiteSpace: 'nowrap' }}><strong>ĐT:</strong> {companyInfo?.phone} {companyInfo?.email ? ` | Email: ${companyInfo?.email}` : ''}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                                <h2 style={{ fontSize: '20pt', fontWeight: '900', margin: '0 0 8px 0', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>
                                    BÁO CÁO {activeTab === 'inward' ? 'DANH SÁCH LOT ĐÃ NHẬP' : activeTab === 'outward' ? 'DANH SÁCH LOT ĐÃ XUẤT' : 'DANH SÁCH LOT CHƯA GÁN VỊ TRÍ'}
                                </h2>
                                <p style={{ fontSize: '11pt', fontStyle: 'italic', color: '#475569', margin: '0' }}>
                                    {activeTab !== 'unassigned' 
                                        ? `Từ ngày: ${format(new Date(startDate), 'dd/MM/yyyy')} đến ngày: ${format(new Date(endDate), 'dd/MM/yyyy')}`
                                        : `Thời điểm xuất báo cáo: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`}
                                </p>
                            </div>
                        </div>

                        {/* Summary Statistics */}
                        {(() => {
                            const stats = activeTab === 'inward' ? summaryInward : activeTab === 'outward' ? summaryOutward : summaryUnassigned;
                            if (stats.length === 0) return null;
                            return (
                                <div className="mb-8 print-avoid-break">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className={`w-1.5 h-4 ${activeTab === 'inward' ? 'bg-orange-500' : 'bg-emerald-500'} rounded-full`}></div>
                                        Tổng hợp sản lượng ({activeTab === 'inward' ? 'Nhập' : activeTab === 'outward' ? 'Xuất' : 'Chưa gán vị trí'})
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {stats.map((stat, sIdx) => (
                                            <div key={sIdx} className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between group transition-all shadow-sm ${activeTab === 'inward' ? 'hover:border-orange-200 dark:hover:border-orange-900/30' : activeTab === 'outward' ? 'hover:border-emerald-200 dark:hover:border-emerald-900/30' : 'hover:border-indigo-200 dark:hover:border-indigo-900/30'}`}>
                                                <div className="flex-1 min-w-0 pr-3">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{stat.productName}</div>
                                                    <div className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-1">
                                                        {formatQuantityFull(stat.totalQty)}
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{stat.unit}</span>
                                                    </div>
                                                    {activeTab === 'inward' && ((stat as any).newInQty > 0 || (stat as any).mergedInQty > 0 || (stat as any).mergedOutQty > 0) && (
                                                        <div className="text-[9px] font-bold text-slate-400 flex flex-wrap gap-x-2 mt-1">
                                                            {(stat as any).newInQty > 0 && <span className="text-emerald-500">Mới: {formatQuantityFull((stat as any).newInQty)}</span>}
                                                            {(stat as any).mergedInQty > 0 && <span className="text-blue-500">Gộp vào: {formatQuantityFull((stat as any).mergedInQty)}</span>}
                                                            {(stat as any).mergedOutQty > 0 && <span className="text-amber-500">Gộp đi: {formatQuantityFull((stat as any).mergedOutQty)}</span>}
                                                        </div>
                                                    )}

                                                    {/* Chi tiết theo Lệnh sản xuất */}
                                                    {stat.productions && Object.keys(stat.productions).length > 0 && (
                                                        <div className="mt-2 flex flex-col gap-0.5 border-t border-slate-100 dark:border-slate-800/50 pt-2">
                                                            {Object.entries(stat.productions).map(([pLabel, pQty]) => {
                                                                const [pCode, pName] = pLabel.split(' | ');
                                                                return (
                                                                    <div key={pLabel} className="flex items-start justify-between gap-2 border-b border-slate-50 dark:border-slate-800/30 last:border-0 py-1.5">
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300" title={pCode}>
                                                                                {pCode === 'NO_CODE' ? 'Không xác định' : pCode}
                                                                            </span>
                                                                            {pName && (
                                                                                <span className="text-[9px] font-bold text-slate-400 leading-tight mt-0.5" title={pName}>
                                                                                    {pName}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className={`text-[10px] font-black shrink-0 ${activeTab === 'inward' ? 'text-orange-600' : activeTab === 'outward' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                                            {formatQuantityFull(pQty as number)}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="shrink-0 flex flex-col items-end">
                                                    <div className={`px-2 py-1 rounded text-[10px] font-black ${activeTab === 'inward' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : activeTab === 'outward' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                                                        {stat.lotCount} dòng
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pb-4 border-b-2 border-dashed border-slate-100 dark:border-slate-800 no-print"></div>
                                </div>
                            )
                        })()}

                        {activeTab === 'inward' ? (
                            <div className="inward-table-wrapper">
                                {groupedInwardData.map((group: any, groupIdx: number) => (
                                    <div key={groupIdx} style={{ marginBottom: '30px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                                            <div className="hidden md:block w-1 h-6 bg-orange-500 rounded-full mr-3"></div>
                                            <span className="text-slate-400 font-bold uppercase text-[10px] mr-2">LSX:</span>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
                                                {group.production_name || group.production_code || 'Không xác định'}
                                            </h3>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800">
                                                    <tr>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[4%]">STT</th>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[8%]">STT LOT</th>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[11%]">Ngày nhập</th>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[20%]">Mã LOT SX</th>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[33%]">Sản phẩm</th>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-[12%]">SL Nhập</th>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[10%]">Đơn vị</th>
                                                        <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[10%]">Vị trí</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.lots.map((lot: any, idx: number) => {
                                                        const items = lot.lot_items || []
                                                        const mergedOut = lot.metadata?.system_history?.merged_out || []
                                                        const itemsIdsInLot = new Set(items.map((i: any) => i.product_id));
                                                        const uniqueMergedProducts = Array.from(new Set(mergedOut.map((mo: any) => mo.product_id || lot.product_id).filter(Boolean)));

                                                        // Những sản phẩm đã gộp hết (không còn trong items)
                                                        const completelyMergedProducts = uniqueMergedProducts.filter(pid => !itemsIdsInLot.has(pid as string));

                                                        const displayItems = [
                                                            ...items,
                                                            ...completelyMergedProducts.map(pid => {
                                                                const sample = mergedOut.find((mo: any) => (mo.product_id || lot.product_id) === pid);
                                                                return {
                                                                    id: `merged_${pid}`,
                                                                    product_id: pid,
                                                                    products: lot.products?.id === pid ? lot.products : (sample ? { name: sample.product_name || 'Sản phẩm đã gộp hết', sku: sample.product_sku || '-', unit: sample.product_unit || sample.unit || '' } : { name: 'Sản phẩm đã gộp hết', sku: '-' }),
                                                                    quantity: 0,
                                                                    unit: sample?.product_unit || sample?.unit || lot.products?.unit || '',
                                                                    is_completely_merged: true
                                                                }
                                                            })
                                                        ]

                                                        const rowSpan = Math.max(displayItems.length, 1)
                                                        return (
                                                            <React.Fragment key={lot.id}>
                                                                {displayItems.length > 0 ? (
                                                                    displayItems.map((item: any, itemIdx: number) => {
                                                                        // Match merged_out records: ưu tiên theo item_id (chính xác), fallback theo product_id
                                                                        const itemMergedOutById = mergedOut.filter((mo: any) => mo.item_id === item.id);
                                                                        // Nếu không match theo item_id (records cũ), fallback theo product_id
                                                                        // Nhưng chỉ tính cho item đầu tiên có product_id đó (tránh nhân bội)
                                                                        const itemMergedOut = itemMergedOutById.length > 0 
                                                                            ? itemMergedOutById 
                                                                            : (item.is_completely_merged 
                                                                                ? mergedOut.filter((mo: any) => (mo.product_id || lot.product_id) === item.product_id)
                                                                                : mergedOut.filter((mo: any) => mo.item_id === item.id));
                                                                        const totalMergedOutQty = itemMergedOut.reduce((acc: number, cur: any) => acc + (Number(cur.quantity) || 0), 0);

                                                                        return (
                                                                            <tr key={item.id} className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm ${item.is_completely_merged ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                                                                {itemIdx === 0 && (
                                                                                    <>
                                                                                        <td className="py-4 px-2 font-mono text-slate-500 font-bold" rowSpan={rowSpan}>{idx + 1}</td>
                                                                                        <td className="py-4 px-2 font-black text-slate-900 dark:text-white" rowSpan={rowSpan}>
                                                                                            <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">
                                                                                                {decodeSTT(lot.daily_seq) || '--'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400" rowSpan={rowSpan}>
                                                                                            {format(new Date(lot.inbound_date || lot.created_at), 'dd/MM/yyyy')}
                                                                                        </td>
                                                                                        <td className="py-4 px-2" rowSpan={rowSpan}>
                                                                                            <div className="flex flex-col gap-1.5">
                                                                                                <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[11px] border border-orange-100 dark:border-orange-800/30 w-fit">
                                                                                                    {productionLotsMap[`${lot.production_id}_${item.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'}
                                                                                                </span>
                                                                                                {lot.code && (
                                                                                                    <span className="text-[10px] text-slate-400 font-mono ml-0.5">
                                                                                                        ID: {lot.code}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                    </>
                                                                                )}
                                                                                <td className="py-2 px-2">
                                                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{item.products?.name}</div>
                                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                                        <span className="text-[10px] text-slate-400 font-mono">{item.products?.sku}</span>
                                                                                        {(() => {
                                                                                            const hist = lot.metadata?.system_history?.item_history?.[item.id];
                                                                                            if (hist?.type === 'merge' || hist?.type === 'split') {
                                                                                                const originalDate = hist.snapshot?.inbound_date || hist.snapshot?.created_at || hist.merge_date;
                                                                                                return (
                                                                                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-black border border-blue-100 dark:border-blue-800/30 flex items-center gap-1">
                                                                                                        {hist.type === 'merge' ? 'GỘP VÀO' : 'TÁCH VÀO'}
                                                                                                        {originalDate && ` (${format(new Date(originalDate), 'dd/MM')})`}
                                                                                                        {hist.source_code && ` từ ${hist.source_code}`}
                                                                                                    </span>
                                                                                                )
                                                                                            }
                                                                                            return null;
                                                                                        })()}

                                                                                        {itemMergedOut.length > 0 && (
                                                                                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[9px] font-black border border-amber-100 dark:border-amber-800/30">
                                                                                                MANG ĐI GỘP SANG: {itemMergedOut.map((mo: any) => {
                                                                                                    const moUnit = mo.product_unit || mo.unit || item.unit || item.products?.unit || '';
                                                                                                    return `${mo.target_lot_code} (${formatQuantityFull(mo.quantity)}${moUnit ? ` ${moUnit}` : ''})`;
                                                                                                }).join(', ')}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2 px-2 text-right">
                                                                                    <div className="font-black text-orange-600">
                                                                                        {formatQuantityFull((Number(item.quantity) || 0) + totalMergedOutQty)}
                                                                                    </div>
                                                                                    {totalMergedOutQty > 0 && (
                                                                                        <div className="text-[9px] text-slate-400 font-bold">
                                                                                            (Hiện có: {formatQuantityFull(item.quantity)})
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2 px-2 font-bold text-[10px] text-slate-400 uppercase">
                                                                                    {(() => {
                                                                                        // Ưu tiên unit từ merged_out records (chính xác nhất cho items đã gộp)
                                                                                        if (itemMergedOut.length > 0) {
                                                                                            const moUnit = itemMergedOut[0]?.product_unit || itemMergedOut[0]?.unit;
                                                                                            if (moUnit) return moUnit;
                                                                                        }
                                                                                        return item.unit || item.products?.unit || '-';
                                                                                    })()}
                                                                                </td>
                                                                                {itemIdx === 0 && (
                                                                                    <td className="py-2 px-2" rowSpan={rowSpan}>
                                                                                        <div className="flex flex-wrap gap-1">
                                                                                            {lot.positions?.map((p: any) => (
                                                                                                <span key={p.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[9px] font-black border border-slate-200 dark:border-slate-700">
                                                                                                    {p.code}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        )
                                                                    })
                                                                ) : lot.products ? (
                                                                    <tr className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                                        <td className="py-4 px-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                                        <td className="py-4 px-2 font-black text-slate-900 dark:text-white">
                                                                            <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">
                                                                                {decodeSTT(lot.daily_seq) || '--'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 px-2 text-slate-600 dark:text-slate-400 font-medium">{format(new Date(lot.inbound_date || lot.created_at), 'dd/MM/yyyy')}</td>
                                                                        <td className="py-4 px-2">
                                                                            <div className="flex flex-col gap-1.5">
                                                                                <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[11px] border border-orange-100 dark:border-orange-800/30 w-fit">
                                                                                    {productionLotsMap[`${lot.production_id}_${lot.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'}
                                                                                </span>
                                                                                {lot.code && (
                                                                                    <span className="text-[10px] text-slate-400 font-mono ml-0.5">
                                                                                        ID: {lot.code}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-2 px-2">
                                                                            <div className="font-bold text-slate-800 dark:text-slate-200">{lot.products.name || '-'}</div>
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <span className="text-[10px] text-slate-400 font-mono">{lot.products.sku || '-'}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right">
                                                                            <div className="font-black text-orange-600">
                                                                                {formatQuantityFull(Number((lot as any).quantity) || 0)}
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-2 px-2 font-bold text-[10px] text-slate-400 uppercase">
                                                                            {(lot as any).unit || lot.products.unit || '-'}
                                                                        </td>
                                                                        <td className="py-2 px-2">
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {lot.positions?.map((p: any) => (
                                                                                    <span key={p.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[9px] font-black border border-slate-200 dark:border-slate-700">
                                                                                        {p.code}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ) : (
                                                                    <tr className="border-b border-slate-100 dark:border-slate-800/50">
                                                                        <td className="py-4 px-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                                        <td className="py-4 px-2 font-black text-slate-900 dark:text-white">
                                                                            <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">
                                                                                {decodeSTT(lot.daily_seq) || '--'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 px-2 text-slate-600 dark:text-slate-400 font-medium">{format(new Date(lot.inbound_date || lot.created_at), 'dd/MM/yyyy')}</td>
                                                                        <td className="py-4 px-2">
                                                                            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 font-bold text-[11px]">
                                                                                {lot.code}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2 px-2 italic text-slate-400 text-xs">Không có dữ liệu hàng hóa</td>
                                                                        <td className="py-2 px-2 text-right">-</td>
                                                                        <td className="py-2 px-2 text-slate-400">-</td>
                                                                        <td className="py-2 px-2">-</td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : activeTab === 'outward' ? (
                            <div className="outward-table-wrapper">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[4%]">STT</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[8%]">STT LOT</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[11%]">Ngày xuất</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[18%]">Mã LOT SX</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[25%]">Sản phẩm</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-[10%]">SL Xuất</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[8%]">Đơn vị</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[14%]">Lệnh sản xuất</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[10%]">Ghi chú</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportDataOutward.map((row, idx) => (
                                                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                    <td className="py-4 px-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                    <td className="py-4 px-2 font-black text-slate-900 dark:text-white">
                                                        <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">
                                                            {decodeSTT(row.daily_seq) || '--'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400">
                                                        {format(new Date(row.date), 'dd/MM/yyyy')}
                                                    </td>
                                                    <td className="py-4 px-2">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] border border-emerald-100 dark:border-emerald-800/30 w-fit">
                                                                {productionLotsMap[`${row.production_id}_${row.product_id}`] || '-'}
                                                            </span>
                                                            {row.lot_code && (
                                                                <span className="text-[10px] text-slate-400 font-mono ml-0.5">
                                                                    ID: {row.lot_code}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{row.product_name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{row.product_sku}</div>
                                                    </td>
                                                    <td className="py-2 px-2 text-right font-black text-emerald-600">
                                                        {formatQuantityFull(row.quantity)}
                                                    </td>
                                                    <td className="py-2 px-2 font-bold text-[10px] text-slate-400 uppercase">
                                                        {row.unit}
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <div className="flex flex-col gap-1">
                                                            {row.export_order_code ? (
                                                                // Data from export_task: show export order code prominently
                                                                <div className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-100 dark:border-blue-800/30 w-fit">
                                                                    {row.export_order_code}
                                                                </div>
                                                            ) : (() => {
                                                                // 1. Ưu tiên Tên lệnh sản xuất (Tên đầy đủ)
                                                                if (row.production_name && row.production_name !== '-') {
                                                                    return (
                                                                        <div className="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-tight">
                                                                            {row.production_name}
                                                                        </div>
                                                                    );
                                                                }

                                                                // 2. Nếu không có tên, tìm mã Lệnh xuất (LXK) trong mô tả
                                                                const desc = row.description || '';
                                                                const lxkMatch = desc.match(/LXK-[A-Z0-9-]+/i);
                                                                if (lxkMatch) {
                                                                    return (
                                                                        <div className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase">
                                                                            {lxkMatch[0]}
                                                                        </div>
                                                                    );
                                                                }

                                                                // 3. Cuối cùng hiện mô tả ngắn hoặc "Xuất lẻ"
                                                                return (
                                                                    <div className="text-[10px] text-slate-400 italic">
                                                                        {desc || 'Xuất lẻ'}
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                {row.location_code && (
                                                                    <div className="text-[9px] text-slate-400 font-bold italic">
                                                                        vị trí xuất: {row.location_code}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        {(() => {
                                                            const desc = row.description || '-';
                                                            if (desc.toLowerCase().includes('lệnh')) {
                                                                const parts = desc.split(/(LXK-[A-Z0-9]+|Lệnh xuất [A-Z0-9-]+)/i);
                                                                return (
                                                                    <div className="text-[10px] text-slate-600 dark:text-slate-400 italic leading-tight">
                                                                        {parts.map((p: string, i: number) => (
                                                                            /LXK-[A-Z0-9]+|Lệnh xuất [A-Z0-9-]+/i.test(p) 
                                                                            ? <strong key={i} className="text-blue-600 dark:text-blue-400 not-italic font-black">{p}</strong>
                                                                            : p
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }
                                                            return <div className="text-[10px] text-slate-500 italic truncate max-w-[120px]">{desc}</div>;
                                                        })()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                                                    </div>
                            </div>
                        ) : (
                            <div className="unassigned-table-wrapper">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[5%]">STT</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[10%]">STT LOT</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[12%]">Ngày tạo</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[18%]">Mã LOT SX</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[30%]">Sản phẩm</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-[12%]">Số lượng</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[8%]">Đơn vị</th>
                                                <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[15%]">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportDataUnassigned.map((lot, idx) => {
                                                const displayItems = lot.lot_items || []
                                                const rowSpan = Math.max(displayItems.length, 1)

                                                return (
                                                    <React.Fragment key={lot.id}>
                                                        {displayItems.length > 0 ? (
                                                            displayItems.map((item, itemIdx) => {
                                                                const sxLotCode = productionLotsMap[`${lot.production_id}_${item.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'
                                                                return (
                                                                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                                        {itemIdx === 0 && (
                                                                            <>
                                                                                <td className="py-4 px-2 font-mono text-slate-500 font-bold" rowSpan={rowSpan}>{idx + 1}</td>
                                                                                <td className="py-4 px-2 font-black text-slate-900 dark:text-white" rowSpan={rowSpan}>
                                                                                    <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">
                                                                                        {decodeSTT(lot.daily_seq) || '--'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400" rowSpan={rowSpan}>
                                                                                    {format(new Date(lot.created_at), 'dd/MM/yyyy')}
                                                                                </td>
                                                                                <td className="py-4 px-2" rowSpan={rowSpan}>
                                                                                    <span className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] border border-indigo-100 dark:border-indigo-800/30 w-fit">
                                                                                        {sxLotCode}
                                                                                    </span>
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                        <td className="py-2 px-2">
                                                                            <div className="font-bold text-slate-800 dark:text-slate-200">{item.products?.name}</div>
                                                                            <span className="text-[10px] text-slate-400 font-mono">{item.products?.sku}</span>
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right font-black text-indigo-600">
                                                                            {formatQuantityFull(Number(item.quantity) || 0)}
                                                                        </td>
                                                                        <td className="py-2 px-2 font-bold text-[10px] text-slate-400 uppercase">
                                                                            {item.unit || item.products?.unit || '-'}
                                                                        </td>
                                                                        {itemIdx === 0 && (
                                                                            <td className="py-2 px-2" rowSpan={rowSpan}>
                                                                                <span className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[10px] font-black border border-rose-100 dark:border-rose-900/30">
                                                                                    Chưa vị trí
                                                                                </span>
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                )
                                                            })
                                                        ) : lot.products ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                                <td className="py-4 px-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                                <td className="py-4 px-2 font-black text-slate-900 dark:text-white">
                                                                    <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">
                                                                        {decodeSTT(lot.daily_seq) || '--'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 px-2 text-slate-600 dark:text-slate-400 font-medium">{format(new Date(lot.created_at), 'dd/MM/yyyy')}</td>
                                                                <td className="py-4 px-2">
                                                                    <span className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] border border-indigo-100 dark:border-indigo-800/30 w-fit">
                                                                        {productionLotsMap[`${lot.production_id}_${lot.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 px-2">
                                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{lot.products.name || '-'}</div>
                                                                    <span className="text-[10px] text-slate-400 font-mono">{lot.products.sku || '-'}</span>
                                                                </td>
                                                                <td className="py-2 px-2 text-right font-black text-indigo-600">
                                                                    {formatQuantityFull(Number(lot.quantity) || 0)}
                                                                </td>
                                                                <td className="py-2 px-2 font-bold text-[10px] text-slate-400 uppercase">
                                                                    {lot.unit || lot.products.unit || '-'}
                                                                </td>
                                                                <td className="py-2 px-2">
                                                                    <span className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[10px] font-black border border-rose-100 dark:border-rose-900/30">
                                                                        Chưa vị trí
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800/50">
                                                                <td className="py-4 px-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                                <td className="py-4 px-2 font-black text-slate-900 dark:text-white">
                                                                    <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[10px] font-bold">
                                                                        {decodeSTT(lot.daily_seq) || '--'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 px-2 text-slate-600 dark:text-slate-400 font-medium">{format(new Date(lot.created_at), 'dd/MM/yyyy')}</td>
                                                                <td className="py-2 px-2">-</td>
                                                                <td className="py-2 px-2 italic text-slate-400 text-xs">Không có dữ liệu hàng hóa</td>
                                                                <td className="py-2 px-2 text-right">-</td>
                                                                <td className="py-2 px-2 text-slate-400">-</td>
                                                                <td className="py-2 px-2">
                                                                    <span className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[10px] font-black border border-rose-100 dark:border-rose-900/30">
                                                                        Chưa vị trí
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Signatures */}
                        <div className="mt-12 grid grid-cols-3 gap-8 text-center print-avoid-break">
                            <div className="flex flex-col items-center">
                                <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Người lập biểu</span>
                                <span className="text-[10px] text-slate-400 mt-1 italic font-medium">(Ký và ghi rõ họ tên)</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Thủ kho</span>
                                <span className="text-[10px] text-slate-400 mt-1 italic font-medium">(Ký và ghi rõ họ tên)</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Giám đốc</span>
                                <span className="text-[10px] text-slate-400 mt-1 italic font-medium">(Ký và đóng dấu)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
