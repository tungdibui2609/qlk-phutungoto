'use client'

import { saveAs } from 'file-saver'
import { renderChartPng, type ChartSpec } from './chartImage'
import { buildDashboardWorkbook, excelFileName, type DashboardWorkbookSpec } from './dashboardExcelWorkbook'

export interface DashboardExportRequest {
    /** Bảng số + metadata (không kèm ảnh — ảnh sinh từ `chart`). */
    spec: Omit<DashboardWorkbookSpec, 'image'>
    chart?: ChartSpec | null
    /** Phần đầu tên file, vd "TY_LE_LAP_DAY_KHO" */
    filePrefix: string
    fileExtra?: string
}

/** Vẽ biểu đồ từ dữ liệu rồi đóng gói thành file .xlsx tải xuống. */
export async function exportDashboardChart({ spec, chart, filePrefix, fileExtra }: DashboardExportRequest) {
    const image = chart ? renderChartPng(chart) : null
    const workbook = buildDashboardWorkbook({ ...spec, image })
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        excelFileName(filePrefix, fileExtra)
    )
}
