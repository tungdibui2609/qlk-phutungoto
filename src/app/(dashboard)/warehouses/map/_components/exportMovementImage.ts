import { format } from 'date-fns'

export interface ExportActionTag {
    label: string
    tone: 'emerald' | 'rose' | 'amber' | 'sky' | 'purple' | 'slate'
}

export interface ExportMovementSummaryRow {
    name: string
    sku: string | null
    actionTags: ExportActionTag[]
    decreasedText: string
    increasedText: string
    netText: string
    count: number
}

export interface ExportMovementDetailRow {
    timeText: string
    positionText: string
    actionText: string
    qtyText: string
    isDecrease: boolean
    isIncrease: boolean
    noteText: string
    userText: string
}

export interface ExportMovementImageParams {
    title: string
    subtitle: string
    dateLabel: string
    decreasedTotal: string
    decreaseCount: number
    increasedTotal: string
    increaseCount: number
    netTotal: string
    totalActions: number
    moveCount: number
    assignCount: number
    mode: 'summary' | 'detail'
    summaryRows: ExportMovementSummaryRow[]
    detailRows: ExportMovementDetailRow[]
}

function wrapTextLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines = 2
): string[] {
    if (!text) return ['']
    const words = text.split(/\s+/)
    const lines: string[] = []
    let current = ''

    for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (ctx.measureText(test).width <= maxWidth) {
            current = test
        } else {
            if (current) lines.push(current)
            current = word
            if (lines.length >= maxLines - 1) break
        }
    }
    if (current && lines.length < maxLines) {
        lines.push(current)
    }

    // Ellipsis nếu dòng cuối vẫn vượt quá maxWidth
    const lastIdx = lines.length - 1
    if (lastIdx >= 0 && ctx.measureText(lines[lastIdx]).width > maxWidth) {
        let s = lines[lastIdx]
        while (s.length > 3 && ctx.measureText(`${s}...`).width > maxWidth) {
            s = s.slice(0, -1)
        }
        lines[lastIdx] = `${s}...`
    }
    return lines
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

export async function renderMovementReportToBlob(
    params: ExportMovementImageParams
): Promise<Blob> {
    const scale = 2
    const width = 1120
    const padX = 28
    const contentW = width - padX * 2
    const fontFamily = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

    // Tạo canvas tạm để đo chiều cao từng dòng
    const measureCanvas = document.createElement('canvas')
    const mCtx = measureCanvas.getContext('2d')!

    const headerH = 92
    const kpiH = 84
    const tableHeaderH = 40
    const footerH = 38

    const TAG_COLORS: Record<
        ExportActionTag['tone'],
        { bg: string; border: string; text: string }
    > = {
        emerald: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
        rose: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' },
        amber: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
        sky: { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
        purple: { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' },
        slate: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' }
    }

    const measureTagRows = (tags: ExportActionTag[], maxW: number): number => {
        if (!tags || tags.length === 0) return 0
        mCtx.font = `700 10.5px ${fontFamily}`
        let rows = 1
        let curW = 0
        for (const tag of tags) {
            const tw = mCtx.measureText(tag.label).width + 14
            if (curW > 0 && curW + tw + 6 > maxW) {
                rows++
                curW = tw
            } else {
                curW = curW > 0 ? curW + tw + 6 : tw
            }
        }
        return rows
    }

    // Đo chiều cao các dòng bảng
    const rowHeights: number[] = []
    if (params.mode === 'summary') {
        for (const r of params.summaryRows) {
            mCtx.font = `700 13.5px ${fontFamily}`
            const nameLines = wrapTextLines(mCtx, r.name, 450, 2)
            const tagRows = measureTagRows(r.actionTags, 460)
            const h = 16 + nameLines.length * 19 + (tagRows > 0 ? tagRows * 22 + 4 : 0) + 12
            rowHeights.push(Math.max(54, h))
        }
    } else {
        mCtx.font = `600 13px ${fontFamily}`
        for (const r of params.detailRows) {
            const noteLines = r.noteText ? wrapTextLines(mCtx, `Ghi chú: ${r.noteText}`, 300, 2) : []
            const h = 16 + 20 + (r.userText ? 16 : 0) + noteLines.length * 16 + 12
            rowHeights.push(Math.max(52, h))
        }
    }

    const totalRowsH =
        rowHeights.length > 0 ? rowHeights.reduce((s, h) => s + h, 0) : 72
    const totalHeight = headerH + 20 + kpiH + 20 + tableHeaderH + totalRowsH + footerH + 20

    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = totalHeight * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)

    // 1. Nền tổng thể (sáng sạch, tương phản cao để gửi Zalo cực dễ đọc)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, width, totalHeight)

    // 2. Header Banner
    const grad = ctx.createLinearGradient(0, 0, width, headerH)
    grad.addColorStop(0, '#0f172a')
    grad.addColorStop(1, '#1e293b')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, headerH)

    ctx.fillStyle = '#fbbf24'
    ctx.font = `700 11px ${fontFamily}`
    ctx.fillText('BÁO CÁO BIẾN ĐỘNG ĐIỀU CHỈNH VỊ TRÍ KHO (PHIẾU ĐÃ DUYỆT)', padX, 28)

    ctx.fillStyle = '#ffffff'
    ctx.font = `800 20px ${fontFamily}`
    const titleLines = wrapTextLines(ctx, params.title, contentW - 220, 1)
    ctx.fillText(titleLines[0], padX, 55)

    ctx.fillStyle = '#94a3b8'
    ctx.font = `500 12.5px ${fontFamily}`
    ctx.fillText(params.subtitle, padX, 76)

    // Badge ngày bên phải header
    const nowLabel = `Xuất lúc: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fde68a'
    ctx.font = `700 14px ${fontFamily}`
    ctx.fillText(params.dateLabel, width - padX, 46)
    ctx.fillStyle = '#94a3b8'
    ctx.font = `500 11.5px ${fontFamily}`
    ctx.fillText(nowLabel, width - padX, 68)
    ctx.textAlign = 'left'

    // 3. 4 Thẻ KPI
    const kpiY = headerH + 18
    const gap = 14
    const cardW = (contentW - gap * 3) / 4
    const kpis = [
        {
            label: 'XUẤT / XÓA / GIẢM SL',
            value: params.decreasedTotal,
            sub: `${params.decreaseCount} lượt giảm đã duyệt`,
            bg: '#fff1f2',
            border: '#fecdd3',
            labelColor: '#be123c',
            valueColor: '#e11d48'
        },
        {
            label: 'TẠO MỚI / NHẬP / TĂNG SL',
            value: params.increasedTotal,
            sub: `${params.increaseCount} lượt tăng đã duyệt`,
            bg: '#ecfdf5',
            border: '#a7f3d0',
            labelColor: '#047857',
            valueColor: '#059669'
        },
        {
            label: 'BIẾN ĐỘNG RÒNG (TĂNG − GIẢM)',
            value: params.netTotal,
            sub: 'Chênh lệch tồn ròng',
            bg: '#eff6ff',
            border: '#bfdbfe',
            labelColor: '#1d4ed8',
            valueColor: '#0369a1'
        },
        {
            label: 'TỔNG LƯỢT TÁC ĐỘNG',
            value: `${params.totalActions} lượt`,
            sub: `Chuyển ô: ${params.moveCount} · Gắn STT: ${params.assignCount}`,
            bg: '#fffbeb',
            border: '#fde68a',
            labelColor: '#b45309',
            valueColor: '#d97706'
        }
    ]

    kpis.forEach((k, idx) => {
        const cx = padX + idx * (cardW + gap)
        drawRoundedRect(ctx, cx, kpiY, cardW, kpiH, 12)
        ctx.fillStyle = k.bg
        ctx.fill()
        ctx.strokeStyle = k.border
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.fillStyle = k.labelColor
        ctx.font = `700 10.5px ${fontFamily}`
        ctx.fillText(k.label, cx + 14, kpiY + 23)

        ctx.fillStyle = k.valueColor
        ctx.font = `800 17px ${fontFamily}`
        const valText = wrapTextLines(ctx, k.value, cardW - 28, 1)[0]
        ctx.fillText(valText, cx + 14, kpiY + 50)

        ctx.fillStyle = '#64748b'
        ctx.font = `500 11px ${fontFamily}`
        ctx.fillText(k.sub, cx + 14, kpiY + 70)
    })

    // 4. Khung Bảng dữ liệu
    const tableY = kpiY + kpiH + 18
    const tableH = tableHeaderH + totalRowsH
    drawRoundedRect(ctx, padX, tableY, contentW, tableH, 12)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Header bảng
    ctx.save()
    drawRoundedRect(ctx, padX, tableY, contentW, tableHeaderH, 12)
    ctx.clip()
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(padX, tableY, contentW, tableHeaderH)
    ctx.restore()
    // Che 2 góc dưới header bảng để phẳng
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(padX, tableY + tableHeaderH - 10, contentW, 10)

    ctx.font = `700 12px ${fontFamily}`
    if (params.mode === 'summary') {
        const colStt = padX + 14
        const colProd = padX + 54
        const colDec = padX + 670
        const colInc = padX + 835
        const colNet = padX + 995
        const colCnt = padX + contentW - 18

        ctx.fillStyle = '#e2e8f0'
        ctx.fillText('#', colStt, tableY + 25)
        ctx.fillText(`SẢN PHẨM (${params.summaryRows.length} SP)`, colProd, tableY + 25)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#fda4af'
        ctx.fillText('XUẤT / XÓA / GIẢM', colDec, tableY + 25)
        ctx.fillStyle = '#6ee7b7'
        ctx.fillText('TẠO MỚI / TĂNG', colInc, tableY + 25)
        ctx.fillStyle = '#7dd3fc'
        ctx.fillText('BIẾN ĐỘNG RÒNG', colNet, tableY + 25)
        ctx.fillStyle = '#e2e8f0'
        ctx.fillText('LƯỢT', colCnt, tableY + 25)
        ctx.textAlign = 'left'

        let curY = tableY + tableHeaderH
        if (params.summaryRows.length === 0) {
            ctx.fillStyle = '#64748b'
            ctx.font = `500 13px ${fontFamily}`
            ctx.textAlign = 'center'
            ctx.fillText('Không có dữ liệu biến động đã duyệt trong ngày này', width / 2, curY + 40)
            ctx.textAlign = 'left'
        } else {
            params.summaryRows.forEach((row, i) => {
                const rh = rowHeights[i]
                if (i % 2 === 1) {
                    ctx.fillStyle = '#f8fafc'
                    ctx.fillRect(padX + 1, curY, contentW - 2, rh)
                }
                if (i > 0) {
                    ctx.strokeStyle = '#e2e8f0'
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(padX, curY)
                    ctx.lineTo(padX + contentW, curY)
                    ctx.stroke()
                }

                // STT
                ctx.fillStyle = '#64748b'
                ctx.font = `700 12.5px ${fontFamily}`
                ctx.fillText(String(i + 1), colStt, curY + 26)

                // Tên SP + các nhãn hành động (Tạo Lot mới, Xuất rỗng, Điều chỉnh...)
                ctx.fillStyle = '#0f172a'
                ctx.font = `700 13.5px ${fontFamily}`
                const nameLines = wrapTextLines(ctx, row.name, 450, 2)
                nameLines.forEach((ln, lIdx) => {
                    ctx.fillText(ln, colProd, curY + 24 + lIdx * 19)
                })
                if (row.actionTags && row.actionTags.length > 0) {
                    ctx.font = `700 10.5px ${fontFamily}`
                    let tagX = colProd
                    let tagY = curY + 24 + nameLines.length * 19 - 8
                    const maxTagX = colProd + 460
                    for (const tag of row.actionTags) {
                        const tw = ctx.measureText(tag.label).width + 14
                        if (tagX > colProd && tagX + tw > maxTagX) {
                            tagX = colProd
                            tagY += 22
                        }
                        const palette = TAG_COLORS[tag.tone] || TAG_COLORS.slate
                        drawRoundedRect(ctx, tagX, tagY, tw, 18, 5)
                        ctx.fillStyle = palette.bg
                        ctx.fill()
                        ctx.strokeStyle = palette.border
                        ctx.lineWidth = 1
                        ctx.stroke()

                        ctx.fillStyle = palette.text
                        ctx.fillText(tag.label, tagX + 7, tagY + 12.5)
                        tagX += tw + 6
                    }
                }

                // Các cột số liệu
                const midY = curY + rh / 2 + 5
                ctx.textAlign = 'right'
                ctx.font = `700 13px Consolas, monospace`

                ctx.fillStyle = row.decreasedText === '0' ? '#94a3b8' : '#e11d48'
                ctx.fillText(row.decreasedText, colDec, midY)

                ctx.fillStyle = row.increasedText === '0' ? '#94a3b8' : '#059669'
                ctx.fillText(row.increasedText, colInc, midY)

                ctx.fillStyle = row.netText.startsWith('-')
                    ? '#e11d48'
                    : row.netText.startsWith('+')
                    ? '#0284c7'
                    : '#64748b'
                ctx.fillText(row.netText, colNet, midY)

                ctx.fillStyle = '#334155'
                ctx.fillText(String(row.count), colCnt, midY)
                ctx.textAlign = 'left'

                curY += rh
            })
        }
    } else {
        // Bảng chi tiết từng lần biến động của 1 sản phẩm
        const colTime = padX + 14
        const colPos = padX + 145
        const colAct = padX + 315
        const colQty = padX + 615
        const colNote = padX + 760

        ctx.fillStyle = '#e2e8f0'
        ctx.fillText('THỜI GIAN', colTime, tableY + 25)
        ctx.fillText('VỊ TRÍ', colPos, tableY + 25)
        ctx.fillText('BIẾN ĐỘNG / THAO TÁC', colAct, tableY + 25)
        ctx.fillText('TRƯỚC ➔ SAU', colQty, tableY + 25)
        ctx.fillText('GHI CHÚ & NGƯỜI THỰC HIỆN', colNote, tableY + 25)

        let curY = tableY + tableHeaderH
        if (params.detailRows.length === 0) {
            ctx.fillStyle = '#64748b'
            ctx.font = `500 13px ${fontFamily}`
            ctx.textAlign = 'center'
            ctx.fillText('Không có lượt biến động nào phù hợp', width / 2, curY + 40)
            ctx.textAlign = 'left'
        } else {
            params.detailRows.forEach((row, i) => {
                const rh = rowHeights[i]
                if (i % 2 === 1) {
                    ctx.fillStyle = '#f8fafc'
                    ctx.fillRect(padX + 1, curY, contentW - 2, rh)
                }
                if (i > 0) {
                    ctx.strokeStyle = '#e2e8f0'
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(padX, curY)
                    ctx.lineTo(padX + contentW, curY)
                    ctx.stroke()
                }

                ctx.fillStyle = '#475569'
                ctx.font = `600 12px Consolas, monospace`
                ctx.fillText(row.timeText, colTime, curY + 25)

                ctx.fillStyle = '#0f172a'
                ctx.font = `700 13px Consolas, monospace`
                ctx.fillText(wrapTextLines(ctx, row.positionText, 160, 1)[0], colPos, curY + 25)

                ctx.fillStyle = row.isDecrease ? '#e11d48' : row.isIncrease ? '#059669' : '#0284c7'
                ctx.font = `700 13px ${fontFamily}`
                ctx.fillText(wrapTextLines(ctx, row.actionText, 290, 1)[0], colAct, curY + 25)

                ctx.fillStyle = '#1e293b'
                ctx.font = `700 12.5px Consolas, monospace`
                ctx.fillText(row.qtyText || '---', colQty, curY + 25)

                let noteY = curY + 22
                if (row.userText) {
                    ctx.fillStyle = '#64748b'
                    ctx.font = `500 11px ${fontFamily}`
                    ctx.fillText(wrapTextLines(ctx, row.userText, 300, 1)[0], colNote, noteY)
                    noteY += 16
                }
                if (row.noteText) {
                    ctx.fillStyle = '#b45309'
                    ctx.font = `600 11.5px ${fontFamily}`
                    const nLines = wrapTextLines(ctx, `Ghi chú: ${row.noteText}`, 300, 2)
                    nLines.forEach((nl, nlIdx) => {
                        ctx.fillText(nl, colNote, noteY + nlIdx * 16)
                    })
                }

                curY += rh
            })
        }
    }

    // 5. Footer
    ctx.fillStyle = '#94a3b8'
    ctx.font = `500 11px ${fontFamily}`
    ctx.fillText('Hệ thống Quản lý Kho (Modular WMS) · Ảnh tổng hợp từ phiếu điều chỉnh vị trí đã duyệt', padX, totalHeight - 14)

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob)
            else reject(new Error('Không thể tạo ảnh PNG'))
        }, 'image/png')
    })
}
