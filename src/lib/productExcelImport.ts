import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { supabase } from '@/lib/supabaseClient'

export interface ParsedProductRow {
    rowNumber: number
    name: string
    sku: string
    part_number: string
    category_name: string
    unit: string
    cost_price: number
    retail_price: number
    wholesale_price: number
    manufacturer: string
    description: string
    packaging_specification: string
    quantity_per_pallet: number
    // Validation flags
    isValid: boolean
    errorReason?: string
    isDuplicateInFile?: boolean
    isExistingInDb?: boolean
    existingProductId?: string
}

export interface ParseResult {
    rows: ParsedProductRow[]
    validRows: ParsedProductRow[]
    invalidRows: ParsedProductRow[]
    existingInDbCount: number
    newInDbCount: number
    duplicateInFileCount: number
    detectedColumns: Record<string, string>
}

// Normalized header keywords dictionary for auto-detection
const COLUMN_ALIASES: Record<string, string[]> = {
    name: ['tên sản phẩm', 'tên hàng', 'tên hàng hóa', 'tên sp', 'tên linh kiện', 'product name', 'name', 'tên'],
    sku: ['mã sku', 'sku', 'mã sp', 'mã sản phẩm', 'mã hàng', 'mã hàng hóa', 'item code', 'code'],
    part_number: ['mã phụ tùng', 'mã oem', 'part number', 'part no', 'part_number', 'mã phụ tùng/oem', 'oem'],
    category_name: ['danh mục', 'nhóm hàng', 'loại hàng', 'nhóm sản phẩm', 'ngành hàng', 'category', 'category name'],
    unit: ['đơn vị tính cơ bản', 'đơn vị tính', 'đvt cơ bản', 'đvt', 'đơn vị', 'unit', 'uom'],
    cost_price: ['giá vốn', 'giá nhập', 'giá mua', 'cost price', 'cost', 'giá gốc'],
    retail_price: ['giá bán lẻ', 'giá bán', 'giá niêm yết', 'giá lẻ', 'retail price', 'price', 'đơn giá'],
    wholesale_price: ['giá bán sỉ', 'giá sỉ', 'giá buôn', 'wholesale price'],
    manufacturer: ['nhà sản xuất', 'hãng sản xuất', 'hãng', 'thương hiệu', 'manufacturer', 'brand', 'nsx'],
    description: ['mô tả', 'ghi chú', 'thông tin chi tiết', 'description', 'note', 'ghi chú sản phẩm'],
    packaging_specification: ['quy cách đóng gói', 'quy cách', 'đóng gói', 'packaging', 'specification'],
    quantity_per_pallet: ['số lượng / pallet', 'số lượng/pallet', 'sl/pallet', 'pallet qty', 'sl pallet']
}

function normalizeHeader(str: string): string {
    return str
        .toLowerCase()
        .replace(/\(\*\)/g, '')
        .replace(/[*_#]/g, '')
        .trim()
}

function findMatchingField(headerText: string): string | null {
    const normalized = normalizeHeader(headerText)
    if (!normalized) return null

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.some(alias => normalized === alias || normalized.includes(alias))) {
            return field
        }
    }
    return null
}

function getCellValue(cell: ExcelJS.Cell): string {
    const val = cell.value
    if (val === null || val === undefined) return ''
    if (typeof val === 'object') {
        if ('result' in val) return String(val.result ?? '').trim()
        if ('text' in val) return String(val.text ?? '').trim()
        if ('richText' in val && Array.isArray((val as any).richText)) {
            return (val as any).richText.map((t: any) => t.text).join('').trim()
        }
    }
    return String(val).trim()
}

function getCellNumber(cell: ExcelJS.Cell): number {
    const str = getCellValue(cell).replace(/[^0-9.-]/g, '')
    const n = parseFloat(str)
    return isNaN(n) ? 0 : n
}

/**
 * Generate and trigger download of a modern Excel import template
 */
export async function downloadProductImportTemplate(systemType: string = 'dashboard') {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Danh Sách Sản Phẩm')

    const isSanxuat = systemType === 'sanxuat'
    const themeColor = isSanxuat ? '059669' : 'F97316'

    // Title Row
    worksheet.mergeCells('A1:L1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = 'MẪU NẠP SẢN PHẨM TỪ FILE EXCEL'
    titleCell.font = { bold: true, size: 14, name: 'Times New Roman', color: { argb: 'FFFFFF' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: themeColor }
    }
    worksheet.getRow(1).height = 36

    // Guide Row
    worksheet.mergeCells('A2:L2')
    const guideCell = worksheet.getCell('A2')
    guideCell.value = 'Lưu ý: Các cột có dấu (*) là bắt buộc. Nếu Đơn vị tính (VD: m², Cuộn, Cái...) hoặc Danh mục chưa có, hệ thống sẽ TỰ ĐỘNG TẠO MỚI.'
    guideCell.font = { italic: true, size: 10, name: 'Times New Roman', color: { argb: '4A5568' } }
    guideCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(2).height = 22

    // Header definition
    const headers = [
        { label: 'Tên sản phẩm (*)', width: 35, required: true },
        { label: 'Mã SKU (*)', width: 18, required: true },
        { label: 'Mã phụ tùng', width: 18, required: false },
        { label: 'Danh mục', width: 22, required: false },
        { label: 'Đơn vị tính cơ bản (*)', width: 20, required: true },
        { label: 'Giá vốn', width: 15, required: false },
        { label: 'Giá bán lẻ', width: 15, required: false },
        { label: 'Giá bán sỉ', width: 15, required: false },
        { label: 'Nhà sản xuất', width: 20, required: false },
        { label: 'Quy cách đóng gói', width: 22, required: false },
        { label: 'Số lượng / Pallet', width: 18, required: false },
        { label: 'Mô tả', width: 30, required: false },
    ]

    const headerRow = worksheet.getRow(3)
    headerRow.height = 28

    headers.forEach((h, idx) => {
        const colNumber = idx + 1
        const cell = headerRow.getCell(colNumber)
        cell.value = h.label
        cell.font = { bold: true, size: 10, name: 'Times New Roman', color: { argb: 'FFFFFF' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: h.required ? (isSanxuat ? '047857' : 'EA580C') : '475569' }
        }
        worksheet.getColumn(colNumber).width = h.width
    })

    // Sample Data Rows
    const sampleRows = [
        [
            'Lọc dầu động cơ Toyota Vios',
            'LOC-TOY-01',
            '04152-YZZA6',
            'Lọc Dầu',
            'Cái',
            85000,
            120000,
            105000,
            'Toyota',
            'Hộp 1 cái',
            200,
            'Dùng cho các dòng xe Toyota Vios 2014-2023'
        ],
        [
            'Má phanh trước Mazda 3',
            'PHANH-MAZ-02',
            'B4Y0-33-28Z',
            'Hệ Thống Phanh',
            'Bộ',
            350000,
            550000,
            480000,
            'Akebono',
            'Hộp 1 bộ 4 miếng',
            50,
            'Chất liệu gốm cao cấp, êm ái, giảm bụi'
        ],
        [
            'Bugi Iridium Denso IK20',
            'BUGI-DEN-IK20',
            'IK20',
            'Hệ Thống Đánh Lửa',
            'Cái',
            125000,
            180000,
            155000,
            'Denso',
            'Hộp 4 cái',
            500,
            'Đầu cực Iridium 0.4mm siêu bền'
        ]
    ]

    sampleRows.forEach(rowData => {
        const row = worksheet.addRow(rowData)
        row.height = 22
        row.eachCell((cell, colNumber) => {
            cell.font = { size: 10, name: 'Times New Roman' }
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            }
            if (colNumber === 2 || colNumber === 3) {
                cell.font = { size: 10, name: 'Consolas', bold: true }
            }
            if (colNumber >= 6 && colNumber <= 8) {
                cell.numFmt = '#,##0'
                cell.alignment = { horizontal: 'right' }
            }
            if (colNumber === 5 || colNumber === 11) {
                cell.alignment = { horizontal: 'center' }
            }
        })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    saveAs(blob, 'Mau_Nhap_San_Pham.xlsx')
}

/**
 * Parse and validate an Excel file uploaded by user
 */
export async function parseProductsFromExcel(
    file: File,
    systemType: string
): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = await file.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
        throw new Error('File Excel không có trang tính (worksheet) nào!')
    }

    // 1. Fetch all existing SKUs in the system to detect existing products
    const { data: dbProducts } = await supabase
        .from('products')
        .select('id, sku')
        .eq('system_type', systemType)

    const existingSkuMap = new Map<string, string>() // sku (uppercase) -> id
    if (dbProducts) {
        (dbProducts as any[]).forEach(p => {
            if (p.sku) existingSkuMap.set(p.sku.trim().toUpperCase(), p.id)
        })
    }

    // 2. Detect Header Row and Column Indexes
    let headerRowNumber = -1
    const fieldColMap: Record<string, number> = {} // fieldName -> colNumber
    const detectedColumns: Record<string, string> = {}

    // Scan the first 10 rows to find header
    for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
        const row = worksheet.getRow(r)
        let matchesCount = 0
        const tempMap: Record<string, number> = {}

        row.eachCell((cell, colNumber) => {
            const text = getCellValue(cell)
            const matchedField = findMatchingField(text)
            if (matchedField && !tempMap[matchedField]) {
                tempMap[matchedField] = colNumber
                matchesCount++
            }
        })

        // If at least both "name" and "sku" are found, or >= 3 recognized columns
        if ((tempMap.name && tempMap.sku) || matchesCount >= 3) {
            headerRowNumber = r
            Object.assign(fieldColMap, tempMap)
            row.eachCell((cell, colNumber) => {
                const text = getCellValue(cell)
                const field = findMatchingField(text)
                if (field) detectedColumns[field] = text
            })
            break
        }
    }

    if (headerRowNumber === -1 || !fieldColMap.name || !fieldColMap.sku) {
        throw new Error(
            'Không tìm thấy dòng tiêu đề hợp lệ trong file Excel. Vui lòng đảm bảo file có ít nhất 2 cột: "Tên sản phẩm" và "Mã SKU".'
        )
    }

    // 3. Parse Data Rows
    const rows: ParsedProductRow[] = []
    const skusInFile = new Set<string>()

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r)

        const name = fieldColMap.name ? getCellValue(row.getCell(fieldColMap.name)) : ''
        const sku = fieldColMap.sku ? getCellValue(row.getCell(fieldColMap.sku)).toUpperCase() : ''
        const part_number = fieldColMap.part_number ? getCellValue(row.getCell(fieldColMap.part_number)) : ''
        const category_name = fieldColMap.category_name ? getCellValue(row.getCell(fieldColMap.category_name)) : ''
        const unit = fieldColMap.unit ? getCellValue(row.getCell(fieldColMap.unit)) : ''
        const cost_price = fieldColMap.cost_price ? getCellNumber(row.getCell(fieldColMap.cost_price)) : 0
        const retail_price = fieldColMap.retail_price ? getCellNumber(row.getCell(fieldColMap.retail_price)) : 0
        const wholesale_price = fieldColMap.wholesale_price ? getCellNumber(row.getCell(fieldColMap.wholesale_price)) : 0
        const manufacturer = fieldColMap.manufacturer ? getCellValue(row.getCell(fieldColMap.manufacturer)) : ''
        const description = fieldColMap.description ? getCellValue(row.getCell(fieldColMap.description)) : ''
        const packaging_specification = fieldColMap.packaging_specification ? getCellValue(row.getCell(fieldColMap.packaging_specification)) : ''
        const quantity_per_pallet = fieldColMap.quantity_per_pallet ? getCellNumber(row.getCell(fieldColMap.quantity_per_pallet)) : 0

        // If entire row is blank, skip
        if (!name && !sku && !part_number && !category_name) {
            continue
        }

        // Validation
        let isValid = true
        let errorReason = ''

        if (!name) {
            isValid = false
            errorReason = 'Thiếu tên sản phẩm'
        } else if (!sku) {
            isValid = false
            errorReason = 'Thiếu mã SKU'
        }

        const isDuplicateInFile = skusInFile.has(sku)
        if (sku) skusInFile.add(sku)

        if (isDuplicateInFile) {
            isValid = false
            errorReason = 'Trùng mã SKU trong cùng file'
        }

        const existingProductId = existingSkuMap.get(sku)
        const isExistingInDb = !!existingProductId

        rows.push({
            rowNumber: r,
            name,
            sku,
            part_number,
            category_name,
            unit: unit || 'Cái',
            cost_price,
            retail_price,
            wholesale_price,
            manufacturer,
            description,
            packaging_specification,
            quantity_per_pallet,
            isValid,
            errorReason,
            isDuplicateInFile,
            isExistingInDb,
            existingProductId
        })
    }

    const validRows = rows.filter(r => r.isValid)
    const invalidRows = rows.filter(r => !r.isValid)
    const existingInDbCount = rows.filter(r => r.isExistingInDb).length
    const newInDbCount = rows.filter(r => r.isValid && !r.isExistingInDb).length
    const duplicateInFileCount = rows.filter(r => r.isDuplicateInFile).length

    return {
        rows,
        validRows,
        invalidRows,
        existingInDbCount,
        newInDbCount,
        duplicateInFileCount,
        detectedColumns
    }
}

export interface ImportOptions {
    conflictMode: 'update' | 'skip'
    systemType: string
    companyId?: string | null
    onProgress?: (processed: number, total: number) => void
}

export interface ImportSummary {
    inserted: number
    updated: number
    skipped: number
    errors: string[]
}

/**
 * Execute product import into Supabase with category and unit auto-linking
 */
export async function importProductsToSupabase(
    rows: ParsedProductRow[],
    options: ImportOptions
): Promise<ImportSummary> {
    const { conflictMode, systemType, companyId, onProgress } = options
    const validRows = rows.filter(r => r.isValid)

    if (validRows.length === 0) {
        return { inserted: 0, updated: 0, skipped: 0, errors: ['Không có dòng nào hợp lệ để nạp!'] }
    }

    // 1. Fetch or create Categories
    const { data: existingCategories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('system_type', systemType)

    const categoryMap = new Map<string, string>() // lowercase name -> id
    if (existingCategories) {
        (existingCategories as any[]).forEach(c => categoryMap.set(c.name.trim().toLowerCase(), c.id))
    }

    // Identify unique categories that need creation
    const neededCatNames = Array.from(
        new Set(
            validRows
                .map(r => r.category_name.trim())
                .filter(name => name.length > 0 && !categoryMap.has(name.toLowerCase()))
        )
    )

    if (neededCatNames.length > 0) {
        const catPayloads = neededCatNames.map(name => ({
            name,
            system_type: systemType,
            company_id: companyId || null
        }))
        const { data: createdCats } = await (supabase.from('categories') as any)
            .insert(catPayloads)
            .select('id, name')

        if (createdCats) {
            createdCats.forEach((c: any) => categoryMap.set(c.name.trim().toLowerCase(), c.id))
        }
    }

    // 2. Fetch or create Units
    const { data: existingUnits } = await supabase.from('units').select('id, name')
    const unitMap = new Map<string, string>()
    if (existingUnits) {
        (existingUnits as any[]).forEach(u => unitMap.set(u.name.trim().toLowerCase(), u.name))
    }

    const neededUnits = Array.from(
        new Set(
            validRows
                .map(r => (r.unit || 'Cái').trim())
                .filter(name => name.length > 0 && !unitMap.has(name.toLowerCase()))
        )
    )

    if (neededUnits.length > 0) {
        const unitPayloads = neededUnits.map(name => ({
            name,
            is_active: true,
            system_code: systemType,
            company_id: companyId || null
        }))
        const { data: createdUnits } = await (supabase.from('units') as any)
            .insert(unitPayloads)
            .select('id, name')

        if (createdUnits) {
            (createdUnits as any[]).forEach(u => unitMap.set(u.name.trim().toLowerCase(), u.name))
        }
    }

    // 3. Process Products in Chunks
    const CHUNK_SIZE = 50
    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE)

        for (const item of chunk) {
            const categoryId = item.category_name
                ? categoryMap.get(item.category_name.trim().toLowerCase()) || null
                : null

            const productPayload = {
                name: item.name,
                sku: item.sku,
                part_number: item.part_number || null,
                unit: item.unit || 'Cái',
                cost_price: item.cost_price,
                retail_price: item.retail_price,
                wholesale_price: item.wholesale_price,
                manufacturer: item.manufacturer || null,
                description: item.description || null,
                packaging_specification: item.packaging_specification || null,
                quantity_per_pallet: item.quantity_per_pallet || 0,
                category_id: categoryId,
                system_type: systemType,
                company_id: companyId || null,
                is_active: true
            }

            try {
                if (item.isExistingInDb) {
                    if (conflictMode === 'skip') {
                        skipped++
                    } else {
                        // Update existing product
                        const { error: updErr } = await (supabase.from('products') as any)
                            .update(productPayload)
                            .eq('id', item.existingProductId!)

                        if (updErr) throw updErr

                        // Update category relation
                        if (categoryId) {
                            await supabase.from('product_category_rel').delete().eq('product_id', item.existingProductId!)
                            await (supabase.from('product_category_rel') as any).insert([{
                                product_id: item.existingProductId!,
                                category_id: categoryId,
                                is_primary: true,
                                system_type: systemType,
                                company_id: companyId || null
                            }])
                        }
                        updated++
                    }
                } else {
                    // Insert new product
                    const { data: newProd, error: insErr } = await (supabase.from('products') as any)
                        .insert([productPayload])
                        .select('id')
                        .single()

                    if (insErr) throw insErr

                    if (newProd && categoryId) {
                        await (supabase.from('product_category_rel') as any).insert([{
                            product_id: newProd.id,
                            category_id: categoryId,
                            is_primary: true,
                            system_type: systemType,
                            company_id: companyId || null
                        }])
                    }
                    inserted++
                }
            } catch (err: any) {
                console.error(`Error processing product ${item.sku}:`, err)
                errors.push(`SKU ${item.sku}: ${err.message}`)
            }
        }

        onProgress?.(Math.min(i + CHUNK_SIZE, validRows.length), validRows.length)
    }

    return { inserted, updated, skipped, errors }
}
