'use client'

import { saveAs } from 'file-saver'
import { toPng } from 'html-to-image'
import type ExcelJS from 'exceljs'
import { renderChartPng, type ChartSpec } from './chartImage'
import {
    buildWorkbookFromSheets,
    excelFileName,
    sheetsFromWorkbookSpec,
    type DashboardChartImage,
    type DashboardWorkbookSpec
} from './dashboardExcelWorkbook'
import {
    keepInScreenshot,
    screenshotSheetPlan,
    CAPTURE_ACTIVE_ATTR,
    type DashboardSheetPlan,
    type DashboardScreenshot
} from './dashboardExcelSpecs'

export interface DashboardExportRequest {
    /** Bảng số + metadata (không kèm ảnh — ảnh sinh từ `chart`). */
    spec: Omit<DashboardWorkbookSpec, 'image'>
    chart?: ChartSpec | null
    /** Ảnh chụp card trên màn hình — thành sheet "Anh dashboard" đứng đầu file. */
    screenshot?: DashboardScreenshot | null
    /** Phần đầu tên file, vd "TY_LE_LAP_DAY_KHO" */
    filePrefix: string
    fileExtra?: string
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Vẽ 2 lần số điểm ảnh so với kích thước hiển thị để chữ trong ảnh vẫn sắc khi phóng to trong Excel. */
const SCREENSHOT_PIXEL_RATIO = 2

/** Ảnh nhúng vào Excel thu còn 80% kích thước card trên màn hình (user chốt bằng mắt). */
const SCREENSHOT_SCALE = 0.8

function chartImage(chart: ChartSpec): DashboardChartImage {
    const { base64, width, height } = renderChartPng(chart)
    return { base64, width, height }
}

/**
 * Chụp đúng card dashboard người dùng đang thấy (bao gồm cả tab/bộ lọc đang chọn).
 * Trả `null` khi không chụp được để việc xuất Excel vẫn chạy, chỉ mất sheet ảnh.
 */
export async function captureDashboardScreenshot(
    node: HTMLElement | null,
    info: { cardTitle: string; systemName: string; filterLabel?: string }
): Promise<DashboardScreenshot | null> {
    if (!node) return null
    // Ẩn các phần tử data-excel-shot="skip" ngay trên bản live trong lúc đo + clone,
    // để computed size html-to-image khóa lại đã là layout không nút bấm.
    node.setAttribute(CAPTURE_ACTIVE_ATTR, 'true')
    try {
        const rect = node.getBoundingClientRect()
        if (rect.width < 40 || rect.height < 40) return null
        const scale = SCREENSHOT_SCALE
        const dataUrl = await toPng(node, {
            // pixelRatio = 2 × scale để ảnh luôn gấp 2 lần số điểm ảnh hiển thị trong Excel.
            pixelRatio: Math.max(1, SCREENSHOT_PIXEL_RATIO * scale),
            backgroundColor: '#ffffff',
            cacheBust: true,
            filter: keepInScreenshot
        })
        const base64 = dataUrl.split(',')[1] || ''
        if (!base64) return null
        return {
            base64,
            width: Math.round(rect.width * scale),
            height: Math.round(rect.height * scale),
            ...info
        }
    } catch (err) {
        console.error('Lỗi chụp ảnh dashboard:', err)
        return null
    } finally {
        node.removeAttribute(CAPTURE_ACTIVE_ATTR)
    }
}

function withScreenshotSheet(sheets: DashboardSheetPlan[], screenshot?: DashboardScreenshot | null) {
    return screenshot ? [screenshotSheetPlan(screenshot), ...sheets] : sheets
}

async function saveWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer], { type: XLSX_MIME }), fileName)
}

/** Vẽ biểu đồ từ dữ liệu rồi đóng gói thành file .xlsx tải xuống. */
export async function exportDashboardChart({ spec, chart, screenshot, filePrefix, fileExtra }: DashboardExportRequest) {
    await saveWorkbook(
        buildWorkbookFromSheets(
            withScreenshotSheet(sheetsFromWorkbookSpec({ ...spec, image: chart ? chartImage(chart) : null }), screenshot)
        ),
        excelFileName(filePrefix, fileExtra)
    )
}

export interface DashboardSheetsExportRequest {
    /** Mỗi sheet tự kèm biểu đồ riêng; ảnh được vẽ ngay trước khi ghi file. */
    sheets: DashboardSheetPlan[]
    /** Ảnh chụp card — thêm sheet "Anh dashboard" đứng đầu file. */
    screenshot?: DashboardScreenshot | null
    filePrefix: string
    fileExtra?: string
}

export async function exportDashboardSheets({ sheets, screenshot, filePrefix, fileExtra }: DashboardSheetsExportRequest) {
    await saveWorkbook(
        buildWorkbookFromSheets(
            withScreenshotSheet(
                sheets.map(({ chart, ...sheet }) => ({
                    ...sheet,
                    image: sheet.image || (chart ? chartImage(chart) : null)
                })),
                screenshot
            )
        ),
        excelFileName(filePrefix, fileExtra)
    )
}
