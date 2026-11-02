import { describe, it, expect, vi, afterEach } from 'vitest'
import { chartHeightFor, renderChartPng, type ChartSpec } from '../chartImage'

/**
 * Vitest chạy bằng node nên không có canvas thật.
 * Stub này vừa cho phép chạy hết luồng vẽ, vừa bắt được lỗi tính toán toạ độ
 * (NaN/Infinity lọt vào fillRect/arc là dấu hiệu spec dữ liệu bị lệch).
 */

type Call = { fn: string; args: unknown[] }

function installFakeCanvas() {
    const calls: Call[] = []
    const numericOps = new Set(['fillRect', 'arc', 'moveTo', 'lineTo', 'fillText', 'clearRect'])
    const ctx: Record<string, unknown> = new Proxy({}, {
        get(_target, prop: string) {
            if (prop === 'measureText') {
                return (text: string) => ({ width: String(text).length * 6 })
            }
            if (prop === 'scale') return () => undefined
            return (...args: unknown[]) => {
                calls.push({ fn: prop, args })
                return undefined
            }
        },
        set() {
            return true
        }
    })
    const canvas = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toDataURL: () => 'data:image/png;base64,AAAA'
    }
    vi.stubGlobal('document', { createElement: () => canvas })
    return calls
}

const finiteNumbers = (calls: Call[], ops: Set<string>) =>
    calls
        .filter(c => ops.has(c.fn))
        .flatMap(c => c.args.filter(a => typeof a === 'number'))

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('renderChartPng', () => {
    it('vẽ hbar trục % mà không sinh toạ độ NaN/Infinity', () => {
        const calls = installFakeCanvas()
        const spec: ChartSpec = {
            kind: 'hbar',
            title: 'Tỉ lệ lấp đầy Lô kệ',
            labels: ['KHO 1', 'KHO 2', 'SANH A'],
            series: [{ name: 'Tỉ lệ lấp đầy', color: '#10b981', values: [40, 100, 0] }],
            barColors: ['#10b981', '#f43f5e', '#d6d3d1'],
            percentAxis: true,
            unit: '%'
        }
        const out = renderChartPng(spec)
        expect(out.base64).toBe('AAAA')
        expect(out.height).toBe(chartHeightFor(3, 1))

        const numbers = finiteNumbers(calls, new Set(['fillRect', 'moveTo', 'lineTo']))
        expect(numbers.length).toBeGreaterThan(0)
        expect(numbers.every(n => Number.isFinite(n))).toBe(true)
    })

    it('vẽ donut gộp đuôi thành "Khác" và không chia cho 0 khi tổng = 0', () => {
        installFakeCanvas()
        const out = renderChartPng({
            kind: 'donut',
            title: 'Phân bố KG',
            labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
            series: [{ name: 'KG', color: '#0ea5e9', values: [5, 4, 3, 2, 1, 1, 1] }],
            unit: 'KG',
            decimals: 1,
            legendLimit: 4
        })
        expect(out.width).toBeGreaterThan(0)
        expect(out.height).toBe(300)

        installFakeCanvas()
        const empty = renderChartPng({
            kind: 'donut',
            title: 'Trống',
            labels: ['A'],
            series: [{ name: 'KG', color: '#0ea5e9', values: [0] }],
            unit: 'KG'
        })
        expect(empty.base64).toBe('AAAA')
    })

    it('chịu được dữ liệu rỗng và chuỗi values ngắn hơn labels', () => {
        const calls = installFakeCanvas()
        const out = renderChartPng({
            kind: 'hbar',
            title: 'Rỗng',
            labels: ['Chỉ một dòng', 'Hai dòng'],
            series: [{ name: 'Ô', color: '#6366f1', values: [7] }],
            unit: 'ô',
            decimals: 0
        })
        expect(out.height).toBe(chartHeightFor(2, 1))
        const numbers = finiteNumbers(calls, new Set(['fillRect']))
        expect(numbers.every(n => Number.isFinite(n))).toBe(true)
    })

    it('từ chối vẽ khi không có môi trường trình duyệt', () => {
        vi.stubGlobal('document', undefined)
        expect(() => renderChartPng({
            kind: 'hbar',
            title: 'x',
            labels: ['a'],
            series: [{ name: 'v', color: '#000', values: [1] }]
        })).toThrow(/trình duyệt/)
    })
})
