import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo';
import { ProductWithCategory } from '@/components/inventory/types';

interface ProductExportParams {
    products: ProductWithCategory[];
    unitsMap: Record<string, string>;
    companyInfo: CompanyInfo | null;
    systemType: string; // 'sanxuat' | 'dashboard' | string
}

export async function exportProductsToExcel({
    products,
    unitsMap,
    companyInfo,
    systemType
}: ProductExportParams) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sach San Pham');

    const isSanxuat = systemType === 'sanxuat';
    // Theme color: Emerald for sanxuat, Orange/Amber for dashboard
    const themeColor = isSanxuat ? '059669' : 'F97316'; // Emerald-600 vs Orange-500

    let currentRow = 1;

    // 1. Company Info Header
    if (companyInfo) {
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const nameCell = worksheet.getCell(`A${currentRow}`);
        nameCell.value = companyInfo.name?.toUpperCase();
        nameCell.font = { bold: true, size: 10, name: 'Times New Roman' };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const addrCell = worksheet.getCell(`A${currentRow}`);
        addrCell.value = `Địa chỉ: ${companyInfo.address || ''}`;
        addrCell.font = { size: 9, name: 'Times New Roman' };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const contactCell = worksheet.getCell(`A${currentRow}`);
        contactCell.value = `${companyInfo.email ? `Email: ${companyInfo.email} | ` : ''}ĐT: ${companyInfo.phone || ''}`;
        contactCell.font = { size: 9, name: 'Times New Roman' };
        currentRow++;
    }

    currentRow++; // Spacer

    // 2. Report Title
    const totalCols = 9; // STT, Tên sản phẩm, SKU, Mã phụ tùng, Danh mục, ĐVT cơ bản, Đơn vị quy đổi, Nhà sản xuất, Ngày tạo
    const lastColLetter = String.fromCharCode(65 + totalCols - 1);

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = isSanxuat ? 'DANH SÁCH SẢN PHẨM DÙNG CHUNG' : 'DANH SÁCH SẢN PHẨM LINH KIỆN, PHỤ TÙNG';
    titleCell.font = { bold: true, size: 16, name: 'Times New Roman' };
    titleCell.alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `Ngày xuất báo cáo: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true, name: 'Times New Roman', size: 10 };
    currentRow++;

    currentRow += 2; // Spacer before table

    // 3. Table Header
    const headerRow = worksheet.getRow(currentRow);
    const headers = [
        'STT',
        'TÊN SẢN PHẨM',
        'MÃ SKU',
        'MÃ PHỤ TÙNG',
        'DANH MỤC',
        'ĐVT CƠ BẢN',
        'ĐƠN VỊ QUY ĐỔI',
        'NHÀ SẢN XUẤT',
        'NGÀY TẠO'
    ];

    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10, name: 'Times New Roman', color: { argb: 'FFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: themeColor }
        };
    });

    // Set Column Widths
    worksheet.getColumn(1).width = 6;   // STT
    worksheet.getColumn(2).width = 40;  // Tên sản phẩm
    worksheet.getColumn(3).width = 18;  // SKU
    worksheet.getColumn(4).width = 18;  // Mã phụ tùng
    worksheet.getColumn(5).width = 25;  // Danh mục
    worksheet.getColumn(6).width = 15;  // ĐVT cơ bản
    worksheet.getColumn(7).width = 28;  // Đơn vị quy đổi
    worksheet.getColumn(8).width = 20;  // Nhà sản xuất
    worksheet.getColumn(9).width = 15;  // Ngày tạo

    currentRow++;

    // 4. Fill Data
    products.forEach((product, idx) => {
        // Format categories
        let categoryStr = 'Chưa phân loại';
        if (product.product_category_rel && product.product_category_rel.length > 0) {
            const sortedRels = [...product.product_category_rel].sort(
                (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
            );
            categoryStr = sortedRels
                .map(rel => rel.categories?.name || '')
                .filter(name => name !== '')
                .join(', ');
        } else if (product.categories?.name) {
            categoryStr = product.categories.name;
        }

        // Format conversion units
        let unitConversionStr = '---';
        if (product.product_units && product.product_units.length > 0) {
            unitConversionStr = product.product_units
                .map(pu => {
                    const subUnitName = unitsMap[pu.unit_id] || '---';
                    const rate = parseFloat(Number(pu.conversion_rate).toFixed(3));
                    return `1 ${subUnitName} = ${rate} ${product.unit || ''}`;
                })
                .join('; ');
        }

        const createdAtStr = product.created_at
            ? format(new Date(product.created_at), 'dd/MM/yyyy')
            : '---';

        const rowData = [
            idx + 1,
            product.name,
            product.sku,
            product.part_number || '---',
            categoryStr,
            product.unit || '---',
            unitConversionStr,
            product.manufacturer || '---',
            createdAtStr
        ];

        const row = worksheet.addRow(rowData);
        row.eachCell((cell, colNumber) => {
            cell.font = { size: 10, name: 'Times New Roman' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            // Alignment
            if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 6 || colNumber === 9) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            }
        });
    });

    // 5. Signatures (Footer)
    currentRow = worksheet.lastRow ? worksheet.lastRow.number + 3 : currentRow + 3;
    const signRow = worksheet.getRow(currentRow);
    // Align date to the right side (col 7-9)
    signRow.getCell(7).value = `Ngày ...... tháng ...... năm ......`;
    signRow.getCell(7).font = { italic: true, name: 'Times New Roman', size: 10 };
    signRow.getCell(7).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 7, currentRow, 9);
    currentRow++;

    const signTitleRow = worksheet.getRow(currentRow);
    signTitleRow.getCell(2).value = 'NGƯỜI LẬP BIỂU';
    signTitleRow.getCell(5).value = 'THỦ KHO';
    signTitleRow.getCell(7).value = 'GIÁM ĐỐC';
    worksheet.mergeCells(currentRow, 7, currentRow, 9);

    signTitleRow.eachCell(cell => {
        cell.font = { bold: true, name: 'Times New Roman', size: 10 };
        cell.alignment = { horizontal: 'center' };
    });

    // 6. Generate buffer and download file
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Danh_sach_san_pham_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
