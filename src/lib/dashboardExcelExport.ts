'use client'

import { saveAs } from 'file-saver'
import type ExcelJS from 'exceljs'
import { renderChartPng, type ChartSpec } from './chartImage'
import {
    buildDashboardWorkbook,
    buildWorkbookFromSheets,
    excelFileName,
    type DashboardChartImage,
    type DashboardWorkbookSpec
} from './dashboardExcelWorkbook'
import type { DashboardSheetPlan } from './dashboardExcelSpecs'

export interface DashboardExportRequest {
    /** Bảng số + metadata (không kèm ảnh — ảnh sinh từ `chart`). */
    spec: Omit<DashboardWorkbookSpec, 'image'>
    chart?: ChartSpec | null
    /** Phần đầu tên file, vd "TY_LE_LAP_DAY_KHO" */
    filePrefix: string
    fileExtra?: string
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function chartImage(chart: ChartSpec): DashboardChartImage {
    const { base64, width, height } = renderChartPng(chart)
    return { base64, width, height }
}

async function saveWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer], { type: XLSX_MIME }), fileName)
}

/** Vẽ biểu đồ từ dữ liệu rồi đóng gói thành file .xlsx tải xuống. */
export async function exportDashboardChart({ spec, chart, filePrefix, fileExtra }: DashboardExportRequest) {
    await saveWorkbook(
        buildDashboardWorkbook({ ...spec, image: chart ? chartImage(chart) : null }),
        excelFileName(filePrefix, fileExtra)
    )
}

export interface DashboardSheetsExportRequest {
    /** Mỗi sheet tự kèm biểu đồ riêng; ảnh được vẽ ngay trước khi ghi file. */
    sheets: DashboardSheetPlan[]
    filePrefix: string
    fileExtra?: string
}

export async function exportDashboardSheets({ sheets, filePrefix, fileExtra }: DashboardSheetsExportRequest) {
    await saveWorkbook(
        buildWorkbookFromSheets(
            sheets.map(({ chart, ...sheet }) => ({
                ...sheet,
                image: sheet.image || (chart ? chartImage(chart) : null)
            }))
        ),
        excelFileName(filePrefix, fileExtra)
    )
}
