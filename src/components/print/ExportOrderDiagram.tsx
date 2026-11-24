'use client'

import React, { useMemo } from 'react'
import { Database } from '@/lib/database.types'
import { sortPositionsByBinPriority } from '@/lib/warehouseUtils'
import { decodeSTT, formatQuantityFull } from '@/lib/numberUtils'
import { format } from 'date-fns'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface ExportLotItem {
    product_name?: string
    sku?: string
    internal_code?: string
    internal_name?: string
    unit?: string | null
    quantity?: number
    tags?: string[]
}

interface ExportLotDetail {
    id: string
    code: string
    daily_seq?: number | string | null
    inbound_date?: string | null
    peeling_date?: string | null
    notes?: string | null
    tags?: string[]
    items?: ExportLotItem[]
}

interface ZoneNode extends Zone {
    children: ZoneNode[]
    positions: PositionWithZone[]
    exportCount: number
}

interface LevelFrame {
    id: string
    rowGroupKey: string
    binPathTitle: string
    levelTitle: string
    positions: PositionWithZone[]
    exportCount: number
}

interface ExportOrderDiagramProps {
    zones: Zone[]
    positions: PositionWithZone[]
    occupiedIds: Set<string>
    lotInfo: Record<string, ExportLotDetail>
    displayInternalCode?: boolean
    binsPerPage?: 2 | 3
    orderCode?: string
    dateText?: string
    isCapturing?: boolean
    skipFirstPageBreak?: boolean
}

function formatShortDate(dateStr?: string | null): string {
    if (!dateStr) return ''
    try {
        return format(new Date(dateStr), 'dd/MM/yy')
    } catch {
        return String(dateStr).slice(0, 10)
    }
}

function cleanShortZoneName(name: string, parentNames: string[]): string {
    let result = (name || '').trim()
    for (const pName of parentNames) {
        if (!pName) continue
        const prefix = `${pName.trim()} - `
        if (result.toUpperCase().startsWith(prefix.toUpperCase())) {
            result = result.slice(prefix.length).trim()
        }
    }
    if (result.includes('|')) {
        result = result.split('|')[0].trim()
    }
    return result || name
}

const MAX_POSITIONS_PER_HALL_FRAME = 6

export function ExportOrderDiagram({
    zones,
    positions,
    occupiedIds,
    lotInfo,
    displayInternalCode = false,
    binsPerPage = 2,
    orderCode = '',
    dateText = '',
    isCapturing = false,
    skipFirstPageBreak = false
}: ExportOrderDiagramProps) {
    // Quy chuẩn:
    // - Mỗi "Khung" (LevelFrame) tương ứng 1 Tầng của 1 Ô (tối đa 6 vị trí 3x2).
    // - Sắp xếp tuần tự: hết tất cả các tầng của Ô 1 -> tiếp tục hết các tầng của Ô 2 -> Ô 3...
    // - Mỗi trang A4 ngang luôn xếp đầy đủ 4 khung (lưới 2 cột x 2 hàng) đồng đều nhau.
    const colsPerPage = binsPerPage // mặc định 2 cột -> 2x2 = 4 khung / trang (nếu 3 cột -> 3x2 = 6 khung / trang)
    const framesPerPage = colsPerPage * 2

    const { pages, totalExportPositions } = useMemo(() => {
        const nodeMap = new Map<string, ZoneNode>()
        zones.forEach(z => {
            nodeMap.set(z.id, { ...z, children: [], positions: [], exportCount: 0 })
        })

        positions.forEach(p => {
            if (p.zone_id && nodeMap.has(p.zone_id)) {
                nodeMap.get(p.zone_id)!.positions.push(p)
            }
        })

        zones.forEach(z => {
            if (z.parent_id && nodeMap.has(z.parent_id)) {
                nodeMap.get(z.parent_id)!.children.push(nodeMap.get(z.id)!)
            }
        })

        const computeNode = (node: ZoneNode): number => {
            node.positions = sortPositionsByBinPriority(node.positions)
            node.children.sort((a, b) => {
                const oa = (a as any).display_order ?? 0
                const ob = (b as any).display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, { numeric: true })
            })

            let count = node.positions.filter(p => occupiedIds.has(p.id) || Boolean(p.lot_id)).length
            node.children.forEach(child => {
                count += computeNode(child)
            })
            node.exportCount = count
            return count
        }

        const roots = zones
            .filter(z => !z.parent_id || !nodeMap.has(z.parent_id))
            .map(z => nodeMap.get(z.id)!)
            .sort((a, b) => {
                const oa = (a as any).display_order ?? 0
                const ob = (b as any).display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.name || a.code || '').localeCompare(b.name || b.code || '', undefined, { numeric: true })
            })

        roots.forEach(computeNode)
        const activeRoots = roots.filter(r => r.exportCount > 0)
        const totalExport = activeRoots.reduce((s, r) => s + r.exportCount, 0)

        const allFrames: LevelFrame[] = []

        const pushDirectPositionsAsFrames = (
            node: ZoneNode,
            pathParts: string[],
            isHall: boolean
        ) => {
            const rawList = isHall
                ? node.positions.filter(p => occupiedIds.has(p.id) || Boolean(p.lot_id))
                : node.positions
            const posList = rawList.length > 0 ? rawList : node.positions
            if (posList.length === 0) return

            const totalChunks = Math.ceil(posList.length / MAX_POSITIONS_PER_HALL_FRAME)
            for (let i = 0; i < posList.length; i += MAX_POSITIONS_PER_HALL_FRAME) {
                const chunk = posList.slice(i, i + MAX_POSITIONS_PER_HALL_FRAME)
                const chunkExportCount = chunk.filter(p => occupiedIds.has(p.id) || Boolean(p.lot_id)).length
                const partIdx = Math.floor(i / MAX_POSITIONS_PER_HALL_FRAME) + 1

                allFrames.push({
                    id: `${node.id}-direct-${partIdx}`,
                    rowGroupKey: pathParts.slice(0, 2).join(' • '),
                    binPathTitle: pathParts.join(' • '),
                    levelTitle: totalChunks > 1
                        ? `${isHall ? 'SẢNH' : 'VỊ TRÍ'} (${partIdx}/${totalChunks})`
                        : (isHall ? 'SẢNH' : 'VỊ TRÍ'),
                    positions: chunk,
                    exportCount: chunkExportCount
                })
            }
        }

        const isLevelNode = (n: ZoneNode) =>
            n.children.length === 0 &&
            (n.id.startsWith('v-lvl-') || /^TẦNG\b/i.test((n.name || '').trim()))

        const walkNode = (node: ZoneNode, ancestorRawNames: string[], cleanPathParts: string[]) => {
            if (node.exportCount <= 0) return

            const shortName = cleanShortZoneName(node.name, ancestorRawNames)
            const nextRaw = [...ancestorRawNames, node.name, shortName]
            const nextCleanPath = [...cleanPathParts, shortName]
            const isHall = /SẢNH|SÀNH|SANH|LOBBY/i.test(node.name)

            if (node.children.length === 0) {
                if (node.positions.length > 0) {
                    pushDirectPositionsAsFrames(node, nextCleanPath, isHall)
                }
                return
            }

            const levelChildren = node.children.filter(c => c.exportCount > 0 && isLevelNode(c))
            const otherChildren = node.children.filter(c => c.exportCount > 0 && !isLevelNode(c))

            if (node.positions.length > 0) {
                pushDirectPositionsAsFrames(node, nextCleanPath, isHall)
            }

            // Đi hết lần lượt tất cả các tầng của Ô hiện tại rồi mới sang Ô tiếp theo
            const currentRowGroupKey = nextCleanPath.slice(0, 2).join(' • ')
            levelChildren.forEach(lvl => {
                allFrames.push({
                    id: lvl.id,
                    rowGroupKey: currentRowGroupKey,
                    binPathTitle: nextCleanPath.join(' • '),
                    levelTitle: cleanShortZoneName(lvl.name, nextRaw),
                    positions: lvl.positions,
                    exportCount: lvl.exportCount
                })
            })

            otherChildren.forEach(child => walkNode(child, nextRaw, nextCleanPath))
        }

        activeRoots.forEach(root => walkNode(root, [], []))

        // Trong cùng 1 Dãy (cùng rowGroupKey): xếp nối tiếp tối đa 4 khung (hoặc 6 khung) trên 1 trang.
        // Khi sang Zone Dãy mới (khác rowGroupKey): bắt buộc ngắt sang trang mới.
        const groupedPages: LevelFrame[][] = []
        let currentPage: LevelFrame[] = []
        let activeRowKey: string | null = null

        for (const frame of allFrames) {
            if (activeRowKey !== null && frame.rowGroupKey !== activeRowKey) {
                if (currentPage.length > 0) {
                    groupedPages.push(currentPage)
                    currentPage = []
                }
            }
            activeRowKey = frame.rowGroupKey
            currentPage.push(frame)

            if (currentPage.length >= framesPerPage) {
                groupedPages.push(currentPage)
                currentPage = []
            }
        }

        if (currentPage.length > 0) {
            groupedPages.push(currentPage)
        }

        return { pages: groupedPages, totalExportPositions: totalExport }
    }, [zones, positions, occupiedIds, framesPerPage])

    const renderPositionCard = (pos: PositionWithZone) => {
        const isExporting = occupiedIds.has(pos.id) || Boolean(pos.lot_id)
        const detail = pos.lot_id ? lotInfo[pos.lot_id] : null

        if (!isExporting || !detail) {
            return (
                <div
                    key={pos.id}
                    className="relative rounded border border-slate-300 bg-slate-50/80 px-1.5 py-1.5 flex flex-col justify-between min-h-[126px] h-full overflow-hidden"
                >
                    {/* Hai đường gạch chéo chữ X xuyên tâm thể hiện KHÔNG LẤY */}
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute inset-0 w-full h-full text-slate-300 pointer-events-none"
                        aria-hidden="true"
                    >
                        <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    </svg>

                    <div className="relative z-10 flex items-center justify-between border-b border-slate-200/80 pb-0.5 bg-slate-50/90">
                        <span className="text-[10px] font-bold font-mono text-slate-500 tracking-tighter whitespace-nowrap">
                            {pos.code}
                        </span>
                    </div>

                    <div className="relative z-10 my-auto flex items-center justify-center">
                        <span className="px-1.5 py-0.5 rounded bg-white/95 border border-slate-300 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            Không lấy
                        </span>
                    </div>

                    <div className="h-3" aria-hidden="true" />
                </div>
            )
        }

        const stt = detail.daily_seq ? decodeSTT(Number(detail.daily_seq)) : ''
        const sxDate = formatShortDate(detail.peeling_date)
        const inDate = formatShortDate(detail.inbound_date)
        const items = detail.items || []

        return (
            <div
                key={pos.id}
                className="rounded border-[1.5px] border-amber-500 bg-amber-50/65 px-1.5 py-1.5 flex flex-col justify-between gap-1 min-h-[126px] h-full"
            >
                <div className="flex items-center justify-between gap-1 border-b border-amber-200/80 pb-0.5">
                    <span className="text-[10px] font-extrabold font-mono text-slate-900 tracking-tighter whitespace-nowrap">
                        {pos.code}
                    </span>
                    {stt ? (
                        <span className="shrink-0 px-1 py-0.5 rounded-xs bg-orange-600 text-white text-[9px] font-extrabold leading-none">
                            #{stt}
                        </span>
                    ) : null}
                </div>

                <div className="flex flex-col gap-0.5 my-auto">
                    <div className="text-[9.5px] font-mono font-bold text-slate-700 truncate leading-tight">
                        {detail.code}
                    </div>

                    {items.map((it, idx) => {
                        const pName = displayInternalCode && it.internal_name ? it.internal_name : it.product_name
                        const pSku = displayInternalCode && it.internal_code ? it.internal_code : it.sku
                        return (
                            <div key={idx} className="flex flex-col gap-0.5">
                                <div className="text-[10px] font-semibold text-slate-800 leading-tight line-clamp-2">
                                    {pName}
                                </div>
                                {pSku && (
                                    <div className="text-[8.5px] font-mono text-slate-500 leading-none truncate">
                                        {pSku}
                                    </div>
                                )}
                                <div className="mt-0.5 px-1 py-0.5 rounded-xs bg-blue-600/10 border border-blue-300 text-blue-800 text-[10px] font-extrabold text-center leading-none">
                                    {formatQuantityFull(it.quantity || 0)} {it.unit || ''}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {(sxDate || inDate) && (
                    <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-amber-200/70 text-[8.5px] font-medium text-slate-600 leading-none">
                        <span>{sxDate ? `SX:${sxDate}` : ''}</span>
                        <span>{inDate ? `N:${inDate}` : ''}</span>
                    </div>
                )}
            </div>
        )
    }

    const renderFrame = (frame: LevelFrame) => {
        const posCount = frame.positions.length
        const colsClass = posCount === 1
            ? 'grid-cols-1'
            : posCount === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'

        return (
            <div
                key={frame.id}
                className="rounded-lg border-[1.5px] border-slate-400 bg-white overflow-hidden flex flex-col"
            >
                {/* Header Khung đồng nhất: KHO • DÃY • Ô + Badge TẦNG + Số lượng lấy */}
                <div className="px-3 py-1.5 bg-slate-800 text-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-extrabold uppercase tracking-wide truncate">
                            {frame.binPathTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10.5px] font-extrabold uppercase shrink-0">
                            {frame.levelTitle}
                        </span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-300 shrink-0">
                        Lấy {frame.exportCount}/{posCount} vị trí
                    </span>
                </div>

                <div className={`p-2 grid ${colsClass} auto-rows-fr gap-1.5 flex-1`}>
                    {frame.positions.map(pos => renderPositionCard(pos))}
                </div>
            </div>
        )
    }

    if (pages.length === 0) {
        return null
    }

    const pageGridCols = colsPerPage === 3
        ? 'grid-cols-1 md:grid-cols-3 print:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2 print:grid-cols-2'

    return (
        <div
            className="w-full flex flex-col items-center gap-6 print:block print:gap-0 font-sans text-slate-900"
            style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
        >
            {pages.map((pageFrames, pageIdx) => (
                <div
                    key={`diagram-page-${pageIdx}`}
                    style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                    className={`landscape-section ${skipFirstPageBreak && pageIdx === 0 ? '' : 'page-break'} w-full max-w-[297mm] print:max-w-none bg-white shadow-md rounded-lg print:rounded-none print:shadow-none px-6 py-5 print:p-0 ${isCapturing ? 'w-[297mm]' : ''}`}
                >
                    {/* PHẦN HEAD LẶP LẠI ĐỒNG ĐỀU TRÊN MỌI TRANG A4 NGANG */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b-2 border-slate-800 pb-2 mb-3">
                        {/* Trái: Thông tin phiếu */}
                        <div className="min-w-0">
                            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 leading-tight">
                                Sơ đồ vị trí xuất kho
                            </div>
                            <div className="text-xs text-slate-700 font-medium truncate mt-0.5">
                                Phiếu: <strong className="text-slate-900">{orderCode}</strong>
                                {dateText ? ` • ${dateText}` : ''}
                                {` • Tổng: ${totalExportPositions} vị trí`}
                            </div>
                        </div>

                        {/* Giữa: Tiêu đề LỚN KHO - DÃY */}
                        {pageFrames[0]?.rowGroupKey ? (
                            <div className="px-6 py-1 rounded-md bg-emerald-800 text-white text-xl font-black uppercase tracking-wider text-center whitespace-nowrap">
                                {pageFrames[0].rowGroupKey.replace(' • ', ' — ')}
                            </div>
                        ) : (
                            <div className="text-xl font-black uppercase tracking-wider text-slate-900">
                                SƠ ĐỒ XUẤT KHO
                            </div>
                        )}

                        {/* Phải: Số trang & Chú thích */}
                        <div className="flex flex-col items-end gap-1">
                            <span className="px-2.5 py-0.5 rounded bg-slate-800 text-white font-extrabold text-xs leading-tight">
                                Trang {pageIdx + 1} / {pages.length}
                            </span>
                            <div className="flex items-center gap-3 text-[10.5px]">
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                    <span className="w-3 h-3 rounded-xs border-[1.5px] border-amber-500 bg-amber-100 inline-block" />
                                    Lấy hàng (#STT)
                                </span>
                                <span className="inline-flex items-center gap-1 text-slate-500">
                                    <span className="relative w-3 h-3 rounded-xs border border-slate-300 bg-slate-50 inline-block overflow-hidden">
                                        <svg viewBox="0 0 10 10" className="w-full h-full text-slate-400">
                                            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
                                            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
                                        </svg>
                                    </span>
                                    Không lấy
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* PHẦN THÂN: ĐÚNG 4 KHUNG (2x2) ĐỒNG ĐỀU TRÊN MỖI TRANG */}
                    <div className={`grid ${pageGridCols} gap-3 items-stretch`}>
                        {pageFrames.map(frame => renderFrame(frame))}
                    </div>
                </div>
            ))}
        </div>
    )
}
