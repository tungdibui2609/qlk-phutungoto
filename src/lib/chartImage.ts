'use client'

/**
 * Vẽ PNG biểu đồ bằng canvas 2D thuần (không thêm dependency).
 * Lý do không chụp SVG của recharts: card "Tỉ lệ lấp đầy" và tab "Theo danh mục (vị trí)"
 * không có SVG nào — chúng là lưới KPI + thanh HTML — nên phải vẽ từ dữ liệu.
 * Một đường code duy nhất cho cả 4 view, màu lấy theo palette của dashboard.
 */

export const CHART_PALETTE = [
    '#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#ef4444',
    '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
    '#14b8a6', '#a855f7'
]

const SCALE = 2

export interface ChartSeries {
    name: string
    color: string
    values: number[]
}

export interface ChartSpec {
    kind: 'donut' | 'hbar'
    title: string
    labels: string[]
    /** donut: chỉ dùng series[0].values. hbar: mỗi series một cột con. */
    series: ChartSeries[]
    /** Màu riêng cho từng thanh (vd: tô theo mức lấp đầy). Bỏ qua với donut. */
    barColors?: string[]
    /** true → trục tung cố định 0..100 và nhãn dạng % */
    percentAxis?: boolean
    unit?: string
    decimals?: number
    width?: number
    /** donut: gộp phần đuôi của legend thành "Khác" khi quá nhiều mục */
    legendLimit?: number
}

const fmt = (n: number, decimals: number) =>
    n.toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

function createCanvas(width: number, height: number) {
    if (typeof document === 'undefined') {
        throw new Error('renderChartPng chỉ chạy được trên trình duyệt.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = width * SCALE
    canvas.height = height * SCALE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas 2D.')
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    return { canvas, ctx }
}

function drawTitle(ctx: CanvasRenderingContext2D, width: number, title: string) {
    ctx.fillStyle = '#1c1917'
    ctx.font = 'bold 15px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, 16, 24, width - 32)
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (ctx.measureText(text).width <= maxWidth) return text
    let out = text
    while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1)
    return out + '…'
}

function niceMax(value: number) {
    if (!isFinite(value) || value <= 0) return 1
    const pow = Math.pow(10, Math.floor(Math.log10(value)))
    return Math.ceil(value / pow) * pow
}

function axisLabel(n: number, spec: ChartSpec) {
    return spec.percentAxis ? `${fmt(n, 0)}%` : fmt(n, spec.decimals ?? 0)
}

function drawDonut(ctx: CanvasRenderingContext2D, spec: ChartSpec, width: number, height: number) {
    const values = spec.series[0]?.values ?? []
    const labels = spec.labels
    const total = values.reduce((a, b) => a + (b > 0 ? b : 0), 0)
    const legendLimit = spec.legendLimit ?? 12

    type Slice = { label: string; value: number; color: string }
    const pairs = labels
        .map((label, i) => ({ label, value: values[i] || 0, color: CHART_PALETTE[i % CHART_PALETTE.length] }))
        .filter(p => p.value > 0)
        .sort((a, b) => b.value - a.value)

    const head = pairs.length > legendLimit ? pairs.slice(0, legendLimit - 1) : pairs
    const tail = pairs.length > legendLimit ? pairs.slice(legendLimit - 1) : []
    const slices: Slice[] = tail.length
        ? [...head, { label: `Khác (${tail.length} mục)`, value: tail.reduce((a, b) => a + b.value, 0), color: '#a8a29e' }]
        : head

    drawTitle(ctx, width, spec.title)

    if (total <= 0) {
        ctx.fillStyle = '#a8a29e'
        ctx.font = '12px Arial, sans-serif'
        ctx.fillText('Không có dữ liệu để vẽ', 16, 56)
        return
    }

    const centerY = (height + 40) / 2
    const radius = Math.min((height - 70) / 2, 110)
    const inner = radius * 0.55
    const centerX = radius + 40

    let angle = -Math.PI / 2
    slices.forEach(s => {
        const sweep = (s.value / total) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, radius, angle, angle + sweep)
        ctx.closePath()
        ctx.fillStyle = s.color
        ctx.fill()
        angle += sweep
    })

    ctx.beginPath()
    ctx.arc(centerX, centerY, inner, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.fillStyle = '#57534e'
    ctx.font = 'bold 11px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`TỔNG ${fmt(total, spec.decimals ?? 1)}`, centerX, centerY - 6)
    ctx.fillText(spec.unit || '', centerX, centerY + 10)

    const legendX = centerX + radius + 28
    const legendWidth = width - legendX - 16
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    slices.forEach((s, i) => {
        const y = 48 + i * 20
        if (y > height - 16) return
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(legendX + 5, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#44403c'
        ctx.font = '11px Arial, sans-serif'
        const pct = (s.value / total) * 100
        const text = `${truncate(ctx, s.label, legendWidth - 110)}  ·  ${fmt(s.value, spec.decimals ?? 1)} ${spec.unit || ''} (${fmt(pct, 1)}%)`
        ctx.fillText(text, legendX + 16, y)
    })
}

function drawHBar(ctx: CanvasRenderingContext2D, spec: ChartSpec, width: number, height: number) {
    drawTitle(ctx, width, spec.title)
    const labels = spec.labels
    const series = spec.series
    const barHeight = 16
    const groupGap = 14
    const top = 44
    const bottomAxis = 26

    ctx.font = '11px Arial, sans-serif'
    const labelWidth = Math.min(
        220,
        Math.max(70, ...labels.map(l => ctx.measureText(l).width)) + 8
    )
    const plotX = 16 + labelWidth + 10
    const plotWidth = width - plotX - 64
    const allValues = series.flatMap(s => s.values).filter(v => isFinite(v))
    const maxValue = spec.percentAxis ? 100 : niceMax(Math.max(0, ...allValues))
    const safeMax = maxValue > 0 ? maxValue : 1

    const groupHeight = series.length * barHeight + (series.length > 1 ? 2 * (series.length - 1) : 0)

    // lưới trục hoành
    ctx.strokeStyle = '#e7e5e4'
    ctx.fillStyle = '#a8a29e'
    ctx.font = '10px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i <= 4; i++) {
        const x = plotX + (plotWidth * i) / 4
        ctx.beginPath()
        ctx.moveTo(x, top - 6)
        ctx.lineTo(x, height - bottomAxis)
        ctx.strokeStyle = '#f5f5f4'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillText(axisLabel((safeMax * i) / 4, spec), x, height - bottomAxis + 6)
    }

    labels.forEach((label, rowIdx) => {
        const groupY = top + rowIdx * (groupHeight + groupGap)
        ctx.fillStyle = '#44403c'
        ctx.font = '11px Arial, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(truncate(ctx, label, labelWidth), 16 + labelWidth, groupY + groupHeight / 2)

        series.forEach((s, si) => {
            const value = s.values[rowIdx] || 0
            const y = groupY + si * (barHeight + 2)
            const w = Math.max(0, Math.min(1, value / safeMax)) * plotWidth
            const color = spec.percentAxis
                ? (spec.barColors?.[rowIdx] || s.color)
                : s.color
            ctx.fillStyle = '#f5f5f4'
            ctx.fillRect(plotX, y, plotWidth, barHeight)
            ctx.fillStyle = color
            ctx.fillRect(plotX, y, w, barHeight)

            ctx.fillStyle = '#292524'
            ctx.font = 'bold 10px Arial, sans-serif'
            ctx.textAlign = 'left'
            const text = axisLabel(value, spec)
            if (w > plotWidth - 60) {
                ctx.fillStyle = '#ffffff'
                ctx.textAlign = 'right'
                ctx.fillText(text, plotX + Math.max(w - 4, 0), y + barHeight / 2)
            } else {
                ctx.fillText(text, plotX + w + 4, y + barHeight / 2)
            }
        })
    })

    if (series.length > 1) {
        let x = plotX
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        series.forEach(s => {
            ctx.fillStyle = s.color
            ctx.fillRect(x, 24, 10, 10)
            ctx.fillStyle = '#57534e'
            ctx.font = '11px Arial, sans-serif'
            ctx.fillText(s.name, x + 14, 29)
            x += 24 + ctx.measureText(s.name).width
        })
    }
}

/** Chiều cao gợi ý để label không bị dồn khi vẽ hbar. */
export function chartHeightFor(labels: number, seriesCount = 1) {
    const groupHeight = seriesCount * 16 + (seriesCount > 1 ? 2 * (seriesCount - 1) : 0)
    return 44 + Math.max(labels, 1) * (groupHeight + 14) + 26
}

export function renderChartPng(spec: ChartSpec): { base64: string; width: number; height: number } {
    const width = spec.width ?? 720
    const height = spec.kind === 'donut' ? 300 : chartHeightFor(spec.labels.length, spec.series.length)
    const { canvas, ctx } = createCanvas(width, height)
    if (spec.kind === 'donut') drawDonut(ctx, spec, width, height)
    else drawHBar(ctx, spec, width, height)
    const url: string = canvas.toDataURL('image/png')
    return { base64: url.split(',')[1] || '', width, height }
}
