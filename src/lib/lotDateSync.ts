import { supabase } from './supabaseClient'
import { parseDateToISO } from './dateUtils'

/**
 * Tự động đồng bộ Ngày sản xuất (từ tem nhãn), Ngày nguyên liệu (từ dấu mực)
 * và Vùng nguyên liệu / Vùng trồng từ danh sách các thùng (box_labels) vào bảng lots:
 * - Tem nhãn: Bổ sung không trùng lặp các ngày sản xuất vào metadata.peeling_dates (và peeling_date chính nếu chưa có).
 * - Dấu mực: Cập nhật Ngày nhập nguyên liệu vào trường raw_material_date của Lot.
 * - Vùng nguyên liệu: Bổ sung các vùng trồng từ tem vào metadata.material_zones & metadata.material_zone.
 */
export async function syncDatesFromBoxesToLot(targetLotId: string, boxes: any[]): Promise<{
    addedPeelingDatesCount: number
    rawMaterialDate: string | null
    materialZones?: string[]
}> {
    if (!targetLotId || !boxes || boxes.length === 0) {
        return { addedPeelingDatesCount: 0, rawMaterialDate: null }
    }

    try {
        const { data: rawLotData, error } = await (supabase
            .from('lots') as any)
            .select('id, peeling_date, raw_material_date, metadata')
            .eq('id', targetLotId)
            .single()

        const lotData = rawLotData as any
        if (error || !lotData) return { addedPeelingDatesCount: 0, rawMaterialDate: null }

        const newPeelingDates = new Set<string>()
        const newMaterialZones = new Set<string>()
        let detectedRawMaterialDate: string | null = null

        boxes.forEach(b => {
            const meta = b.metadata || {}
            const isStamp = meta.scan_type === 'stamp' || !!meta.stamp_line1 || !!meta.stamp_line2 || b.code?.startsWith('STAMP-')
            if (isStamp) {
                // Với dấu mực: Dòng 2 chứa Ngày nhập nguyên liệu (DDMMYY)
                let rawDateStr = meta.production_date || meta.raw_material_date || meta.inbound_date
                if (!rawDateStr && meta.stamp_line2) {
                    const cleanL2 = String(meta.stamp_line2).replace(/[^0-9]/g, '')
                    if (cleanL2.length >= 11) {
                        const dd = cleanL2.substring(5, 7)
                        const mm = cleanL2.substring(7, 9)
                        const yy = cleanL2.substring(9, 11)
                        rawDateStr = `${dd}/${mm}/20${yy}`
                    }
                }
                const iso = parseDateToISO(rawDateStr)
                if (iso && !detectedRawMaterialDate) {
                    detectedRawMaterialDate = iso
                }
            } else {
                // Với tem nhãn: b.metadata.production_date là Ngày sản xuất
                const iso = parseDateToISO(meta.production_date)
                if (iso) {
                    newPeelingDates.add(iso)
                }
            }

            // Vùng nguyên liệu (vùng trồng)
            const rawZone = meta.region || meta.province || meta.material_zone || b.region || ''
            if (rawZone && rawZone !== '---') {
                newMaterialZones.add(rawZone.trim())
            }
        })

        const lotUpdates: any = {}
        const lotMeta = (lotData.metadata && typeof lotData.metadata === 'object') ? { ...lotData.metadata } : {}
        let addedPeelingDatesCount = 0

        // 1. Xử lý Ngày sản xuất: Hợp nhất vào metadata.peeling_dates
        if (newPeelingDates.size > 0) {
            const currentMetaDates: string[] = Array.isArray(lotMeta.peeling_dates)
                ? lotMeta.peeling_dates
                : (Array.isArray(lotMeta.production_dates) ? lotMeta.production_dates : [])

            const mergedSet = new Set<string>(
                currentMetaDates.map((d: any) => parseDateToISO(String(d))).filter(Boolean) as string[]
            )
            if (lotData.peeling_date) {
                const isoExisting = parseDateToISO(lotData.peeling_date)
                if (isoExisting) mergedSet.add(isoExisting)
            }

            const beforeSize = mergedSet.size
            newPeelingDates.forEach(d => mergedSet.add(d))
            addedPeelingDatesCount = mergedSet.size - beforeSize

            const sorted = Array.from(mergedSet).sort()
            lotMeta.peeling_dates = sorted
            lotUpdates.metadata = lotMeta

            if (!lotData.peeling_date && sorted.length > 0) {
                lotUpdates.peeling_date = sorted[0]
            }
        }

        // 2. Xử lý Ngày nguyên liệu: Cập nhật raw_material_date
        if (detectedRawMaterialDate) {
            lotUpdates.raw_material_date = detectedRawMaterialDate
        }

        // 3. Xử lý Vùng nguyên liệu (vùng trồng): Hợp nhất vào metadata.material_zones
        if (newMaterialZones.size > 0) {
            let materialZonesList: any[] = []
            try {
                const { data: zones } = await (supabase.from('material_zones' as any) as any)
                    .select('code, name, province')
                    .eq('is_active', true)
                if (zones) materialZonesList = zones
            } catch {}

            const currentZones: string[] = Array.isArray(lotMeta.material_zones)
                ? lotMeta.material_zones
                : (lotMeta.material_zone ? String(lotMeta.material_zone).split(',').map((s: string) => s.trim()).filter(Boolean) : [])

            const mergedZoneSet = new Set<string>(currentZones)

            newMaterialZones.forEach(z => {
                const matched = materialZonesList.find(m => 
                    (m.province && m.province.toLowerCase().includes(z.toLowerCase())) ||
                    (m.name && m.name.toLowerCase().includes(z.toLowerCase())) ||
                    (m.code && m.code.toLowerCase() === z.toLowerCase()) ||
                    z.toLowerCase().includes(m.province?.toLowerCase() || '') ||
                    z.toLowerCase().includes(m.name?.toLowerCase() || '')
                )
                const standardized = matched ? (matched.code ? `${matched.code} - ${matched.name}` : matched.name) : z
                mergedZoneSet.add(standardized)
            })

            const finalZones = Array.from(mergedZoneSet).sort()
            lotMeta.material_zones = finalZones
            lotMeta.material_zone = finalZones.join(', ')
            lotUpdates.metadata = lotMeta
        }

        if (Object.keys(lotUpdates).length > 0) {
            await (supabase.from('lots') as any).update(lotUpdates).eq('id', targetLotId)
        }

        return {
            addedPeelingDatesCount,
            rawMaterialDate: detectedRawMaterialDate,
            materialZones: lotMeta.material_zones
        }
    } catch (err) {
        console.warn('Lỗi khi đồng bộ ngày và vùng trồng từ thùng vào Lô:', err)
        return { addedPeelingDatesCount: 0, rawMaterialDate: null }
    }
}
