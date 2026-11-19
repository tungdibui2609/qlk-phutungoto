import type { ZoneItem, PositionItem, PositionProductSubItem, ProposalSubItem } from './types'

export const isHallZone = (z: ZoneItem | null | undefined): boolean => {
  if (!z) return false
  if (z.is_hall) return true
  const nameUpper = (z.name || '').trim().toUpperCase()
  return (
    nameUpper.startsWith('SẢNH') ||
    nameUpper.startsWith('SÀNH') ||
    nameUpper.startsWith('SANH') ||
    nameUpper.includes('SẢNH') ||
    nameUpper.includes('SÀNH')
  )
}

export const formatDateVN = (d?: string | null): string => {
  if (!d) return '--/--/----'
  const clean = String(d).split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [y, m, day] = parts
    if (y.length === 4) return `${day.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }
  return d
}

export const formatDateShortVN = (d?: string | null): string => {
  if (!d) return ''
  const clean = String(d).split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [y, m, day] = parts
    const shortYear = y.length === 4 ? y.slice(2) : y
    return `${day.padStart(2, '0')}/${m.padStart(2, '0')}/${shortYear}`
  }
  return d
}

export const getCleanUnitCategory = (rawUnit?: string | null): string => {
  if (!rawUnit) return 'Thùng'
  const u = rawUnit.trim()
  const lower = u.toLowerCase()
  if (lower.startsWith('thùng') || lower.startsWith('thung') || lower === 'th') return 'Thùng'
  if (lower === 'kg' || lower === 'kilogram' || lower === 'ký' || lower === 'ky') return 'Kg'
  if (lower.startsWith('sọt') || lower.startsWith('sot')) return 'Sọt'
  return u
}

export const formatUnitsSummary = (
  unitsMap: Map<string, number> | Record<string, number>,
  options?: { short?: boolean }
): string => {
  const entries = unitsMap instanceof Map ? Array.from(unitsMap.entries()) : Object.entries(unitsMap)
  const nonZero = entries.filter(([_, q]) => q > 0)
  if (nonZero.length === 0) return '0'

  // Ưu tiên hiển thị: Thùng trước, rồi đến Kg, Sọt, và các đơn vị khác
  nonZero.sort(([uA], [uB]) => {
    const priority = (u: string) => (u === 'Thùng' ? 1 : u === 'Kg' ? 2 : u === 'Sọt' ? 3 : 4)
    const pA = priority(uA)
    const pB = priority(uB)
    if (pA !== pB) return pA - pB
    return uA.localeCompare(uB)
  })

  return nonZero
    .map(([u, q]) => {
      const formattedQty = Number.isInteger(q)
        ? q.toLocaleString('vi-VN')
        : Number(q.toFixed(2)).toLocaleString('vi-VN')
      const displayUnit = options?.short && u === 'Thùng' ? 'th' : u
      return `${formattedQty} ${displayUnit}`
    })
    .join(' · ')
}

export const formatPositionQtyUnit = (qty?: number | null, unit?: string | null) => {
  if (qty === null || qty === undefined) return null
  const cleanCat = getCleanUnitCategory(unit)
  const displayUnit = cleanCat === 'Thùng' ? 'th' : cleanCat
  const formattedQty = Number.isInteger(qty)
    ? qty.toLocaleString('vi-VN')
    : Number(qty.toFixed(2)).toLocaleString('vi-VN')
  return `${formattedQty} ${displayUnit}`
}

/**
 * Sắp xếp các vị trí trong cùng 1 Ô / Tầng theo quy chuẩn thực tế kho:
 * 1. 2 số cuối cùng của mã vị trí: Nhóm 02 trước, nhóm 01 sau (xếp giảm dần 02 -> 01)
 * 2. Cùng số cuối: Xếp theo chữ cái kệ A -> B -> C
 * Kết quả: A02, B02, C02 rồi đến A01, B01, C01
 */
export function sortPositionsByDepthAndCol<T extends { code?: string | null }>(list: T[]): T[] {
  return [...list].sort((pa, pb) => {
    const codeA = (pa.code || '').trim().toUpperCase()
    const codeB = (pb.code || '').trim().toUpperCase()

    // 1. Lấy 2 số cuối cùng (ví dụ K1D1A08T502 -> 2, K1D1B08T501 -> 1)
    const matchA = codeA.match(/(\d{2})$/)
    const matchB = codeB.match(/(\d{2})$/)
    const depthA = matchA ? parseInt(matchA[1], 10) : 0
    const depthB = matchB ? parseInt(matchB[1], 10) : 0

    if (depthA !== depthB) {
      return depthB - depthA
    }

    // 2. Nếu cùng số cuối (cùng là 02 hoặc cùng là 01): xếp theo chữ cái kệ A -> B -> C
    const colMatchA = codeA.match(/D\d+([A-Z])/i) || codeA.match(/([A-Z])\d{2}T/i) || codeA.match(/([A-Z])\d+/i)
    const colMatchB = codeB.match(/D\d+([A-Z])/i) || codeB.match(/([A-Z])\d{2}T/i) || codeB.match(/([A-Z])\d+/i)
    const colA = colMatchA ? colMatchA[1].toUpperCase() : ''
    const colB = colMatchB ? colMatchB[1].toUpperCase() : ''

    if (colA && colB && colA !== colB) {
      return colA.localeCompare(colB)
    }

    return codeA.localeCompare(codeB, undefined, { numeric: true })
  })
}

export const getPositionTag = (pos: PositionItem): string | null => {
  if (pos.tags && pos.tags.length > 0) {
    const validTags = pos.tags.filter(t => t && !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
    if (validTags.length > 0) return validTags.join(', ')
  }
  return null
}

/**
 * Trích xuất danh sách từng dòng sản phẩm của một vị trí.
 * - Nếu pallet hỗn hợp (nhiều mặt hàng trong `pos.items`), trả về từng dòng riêng biệt (tên, mã, số lượng, đơn vị).
 * - Nếu pallet 1 mặt hàng hoặc không có `items`, trả về 1 phần tử từ `pos.product_name`.
 */
export const getPositionProductItems = (pos: PositionItem): PositionProductSubItem[] => {
  if (pos.items && Array.isArray(pos.items) && pos.items.length > 0) {
    const valid = pos.items
      .filter(it => it && (it.product_name || it.sku))
      .map(it => ({
        name: (it.product_name || it.sku || '').trim(),
        sku: it.sku || null,
        aliases: pos.aliases || null,
        quantity: typeof it.quantity === 'number' && !isNaN(it.quantity) ? it.quantity : 0,
        unit: getCleanUnitCategory(it.unit || pos.unit),
      }))
    if (valid.length > 0) return valid
  }

  if (!pos.product_name) return []
  return [
    {
      name: pos.product_name.trim(),
      sku: pos.sku || null,
      aliases: pos.aliases || null,
      quantity: typeof pos.quantity === 'number' && !isNaN(pos.quantity) ? pos.quantity : 0,
      unit: getCleanUnitCategory(pos.unit),
    },
  ]
}

export const extractSubItemsFromPosition = (pos: PositionItem | null | undefined): ProposalSubItem[] => {
  if (!pos || !pos.lot_id) return []

  // 1. Nếu có mảng items chi tiết từ lot_items
  if (Array.isArray(pos.items) && pos.items.length > 0) {
    const valid = pos.items.filter(it => it && ((it.product_name || '').trim() || (it.sku || '').trim()))
    if (valid.length > 0) {
      return valid.map(it => ({
        product_id: it.product_id || null,
        product_name: (it.product_name || it.sku || 'Sản phẩm').trim(),
        sku: it.sku || pos.sku || null,
        current_quantity: it.quantity != null ? Number(it.quantity) : 0,
        new_quantity: it.quantity != null ? Number(it.quantity) : 0,
        unit: it.unit || pos.unit || 'Thùng',
      }))
    }
  }

  // 2. Nếu tên có dấu phẩy (ghép nhiều sản phẩm)
  const rawNames = (pos.product_name || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const rawSkus = (pos.sku || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (rawNames.length > 1) {
    const totalQty = pos.quantity ? Number(pos.quantity) : 0
    const eachQty = Number((totalQty / rawNames.length).toFixed(2))
    return rawNames.map((name, i) => ({
      product_id: null,
      product_name: name,
      sku: rawSkus[i] || pos.sku || null,
      current_quantity: eachQty,
      new_quantity: eachQty,
      unit: pos.unit || 'Thùng',
    }))
  }

  // 3. Nếu là sản phẩm đơn
  if (pos.product_name) {
    return [
      {
        product_id: null,
        product_name: pos.product_name.trim(),
        sku: pos.sku || null,
        current_quantity: pos.quantity != null ? Number(pos.quantity) : 0,
        new_quantity: pos.quantity != null ? Number(pos.quantity) : 0,
        unit: pos.unit || 'Thùng',
      },
    ]
  }

  return []
}
