import { supabase } from './supabaseClient'
import { parseDateToISO, validateAndFormatDate } from './dateUtils'
import { formatMaterialZoneProvince } from './provinces'

/**
 * Tự động đồng bộ Ngày sản xuất (từ tem nhãn), Ngày nguyên liệu (từ dấu mực),
 * Vùng nguyên liệu / Vùng trồng và Nơi sản xuất / Nhà máy từ danh sách các thùng (box_labels) vào bảng lots:
 * - Tem nhãn: Bổ sung không trùng lặp các ngày sản xuất vào metadata.peeling_dates (và peeling_date chính nếu chưa có).
 * - Dấu mực: Cập nhật Ngày nhập nguyên liệu vào trường raw_material_date của Lot.
 * - Vùng nguyên liệu: Bổ sung các vùng trồng từ tem vào metadata.material_zones & metadata.material_zone.
 * - Nơi sản xuất: Bổ sung nhà máy từ tem vào metadata.production_places & metadata.production_place.
 */
export async function syncDatesFromBoxesToLot(targetLotId: string, boxes: any[]): Promise<{
    addedPeelingDatesCount: number
    rawMaterialDate: string | null
    rawMaterialDates?: string[]
    packagingDates?: string[]
    materialZones?: string[]
    productionPlaces?: string[]
}> {
    if (!targetLotId || !boxes || boxes.length === 0) {
        return { addedPeelingDatesCount: 0, rawMaterialDate: null }
    }

    try {
        const { data: rawLotData, error } = await (supabase
            .from('lots') as any)
            .select('id, peeling_date, raw_material_date, packaging_date, metadata')
            .eq('id', targetLotId)
            .single()

        const lotData = rawLotData as any
        if (error || !lotData) return { addedPeelingDatesCount: 0, rawMaterialDate: null }

        const newPeelingDates = new Set<string>()
        const newRawMaterialDates = new Set<string>()
        const newPackagingDates = new Set<string>()
        const newMaterialZones = new Set<string>()
        const newProductionPlaces = new Set<string>()
        let detectedRawMaterialDate: string | null = null

        boxes.forEach(b => {
            const meta = b.metadata || {}
            const isStamp = meta.scan_type === 'stamp' || !!meta.stamp_line1 || !!meta.stamp_line2 || b.code?.startsWith('STAMP-')
            if (isStamp) {
                // Với dấu mực: Dòng 2 chứa Ngày đóng gói (DDMM) và Ngày nhập nguyên liệu (DDMMYY)
                if (meta.stamp_line2) {
                    const cleanL2 = String(meta.stamp_line2).replace(/[^0-9]/g, '')
                    // Packaging date: DDMM từ ký tự 1..5
                    if (cleanL2.length >= 5) {
                        const dd = cleanL2.substring(1, 3)
                        const mm = cleanL2.substring(3, 5)
                        const currentYear = new Date().getFullYear()
                        const isoPack = validateAndFormatDate(currentYear, parseInt(mm, 10), parseInt(dd, 10))
                        if (isoPack) {
                            newPackagingDates.add(isoPack)
                        }
                    }
                    // Raw material date: DDMMYY từ ký tự 5..11 (hoặc 6..12 nếu OCR dư số)
                    if (cleanL2.length >= 11) {
                        const dd = cleanL2.substring(5, 7)
                        const mm = cleanL2.substring(7, 9)
                        const yy = cleanL2.substring(9, 11)
                        let isoRaw = validateAndFormatDate(2000 + parseInt(yy, 10), parseInt(mm, 10), parseInt(dd, 10))
                        if (!isoRaw && cleanL2.length >= 12) {
                            const altDd = cleanL2.substring(6, 8)
                            const altMm = cleanL2.substring(8, 10)
                            const altYy = cleanL2.substring(10, 12)
                            isoRaw = validateAndFormatDate(2000 + parseInt(altYy, 10), parseInt(altMm, 10), parseInt(altDd, 10))
                        }
                        if (isoRaw) {
                            newRawMaterialDates.add(isoRaw)
                            if (!detectedRawMaterialDate) detectedRawMaterialDate = isoRaw
                        }
                    }
                }

                // Explicit fields nếu có
                const explicitRaw = meta.raw_material_date || b.raw_material_date
                if (explicitRaw) {
                    const iso = parseDateToISO(explicitRaw)
                    if (iso) {
                        newRawMaterialDates.add(iso)
                        if (!detectedRawMaterialDate) detectedRawMaterialDate = iso
                    }
                }

                const explicitPack = meta.packaging_date || b.packaging_date
                if (explicitPack) {
                    const iso = parseDateToISO(explicitPack)
                    if (iso) newPackagingDates.add(iso)
                }

                // Với dấu mực: Ký tự 1 của Dòng 2 là Mã nhà máy
                if (meta.stamp_line2) {
                    const cleanL2 = String(meta.stamp_line2).replace(/[^0-9]/g, '')
                    if (cleanL2.length >= 1) {
                        newProductionPlaces.add(cleanL2.substring(0, 1))
                    }
                }
            } else {
                // Với tem nhãn: b.metadata.production_date là Ngày sản xuất
                const iso = parseDateToISO(meta.production_date)
                if (iso) {
                    newPeelingDates.add(iso)
                }
                const packIso = parseDateToISO(meta.packaging_date || b.packaging_date)
                if (packIso) {
                    newPackagingDates.add(packIso)
                }
            }

            // Vùng nguyên liệu (vùng trồng)
            const rawZone = meta.region || meta.province || meta.material_zone || b.region || ''
            if (rawZone && rawZone !== '---') {
                newMaterialZones.add(rawZone.trim())
            }

            // Nơi sản xuất / Nhà máy
            const rawPlace = meta.production_place || meta.factory || meta.shift_group || b.shift_group || b.production_place || ''
            if (rawPlace && rawPlace !== '---' && rawPlace !== 'Nguyên') {
                newProductionPlaces.add(String(rawPlace).trim())
            } else if (isStamp && meta.stamp_line2) {
                // Chỉ lấy ký tự 1 của Dòng 2 làm mã nhà máy nếu chưa có tên nhà máy cụ thể
                const cleanL2 = String(meta.stamp_line2).replace(/[^0-9]/g, '')
                if (cleanL2.length >= 1) {
                    newProductionPlaces.add(cleanL2.substring(0, 1))
                }
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

        // 2. Xử lý Ngày nguyên liệu: Hợp nhất vào metadata.raw_material_dates và cập nhật raw_material_date chính
        if (newRawMaterialDates.size > 0) {
            const currentMetaRawDates: string[] = Array.isArray(lotMeta.raw_material_dates)
                ? lotMeta.raw_material_dates
                : (Array.isArray(lotMeta.manual_raw_material_dates) ? lotMeta.manual_raw_material_dates : [])

            const mergedRawSet = new Set<string>(
                currentMetaRawDates.map((d: any) => parseDateToISO(String(d))).filter(Boolean) as string[]
            )
            if (lotData.raw_material_date) {
                const isoExisting = parseDateToISO(lotData.raw_material_date)
                if (isoExisting) mergedRawSet.add(isoExisting)
            }
            newRawMaterialDates.forEach(d => mergedRawSet.add(d))
            const sortedRaw = Array.from(mergedRawSet).sort()
            lotMeta.raw_material_dates = sortedRaw
            lotUpdates.metadata = lotMeta

            if (!lotData.raw_material_date && sortedRaw.length > 0) {
                lotUpdates.raw_material_date = sortedRaw[0]
            }
        } else if (detectedRawMaterialDate && !lotData.raw_material_date) {
            lotUpdates.raw_material_date = detectedRawMaterialDate
        }

        // 3. Xử lý Ngày đóng bao bì: Hợp nhất vào metadata.packaging_dates và cập nhật packaging_date chính
        if (newPackagingDates.size > 0) {
            const currentMetaPackDates: string[] = Array.isArray(lotMeta.packaging_dates)
                ? lotMeta.packaging_dates
                : (Array.isArray(lotMeta.manual_packaging_dates) ? lotMeta.manual_packaging_dates : [])

            const mergedPackSet = new Set<string>(
                currentMetaPackDates.map((d: any) => parseDateToISO(String(d))).filter(Boolean) as string[]
            )
            if (lotData.packaging_date) {
                const isoExisting = parseDateToISO(lotData.packaging_date)
                if (isoExisting) mergedPackSet.add(isoExisting)
            }
            newPackagingDates.forEach(d => mergedPackSet.add(d))
            const sortedPack = Array.from(mergedPackSet).sort()
            lotMeta.packaging_dates = sortedPack
            lotUpdates.metadata = lotMeta

            if (!lotData.packaging_date && sortedPack.length > 0) {
                lotUpdates.packaging_date = sortedPack[0]
            }
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

            const mergedZoneSet = new Set<string>()
            currentZones.forEach(z => {
                const prov = formatMaterialZoneProvince(z, materialZonesList)
                if (prov) mergedZoneSet.add(prov)
            })

            newMaterialZones.forEach(z => {
                const prov = formatMaterialZoneProvince(z, materialZonesList)
                if (prov) mergedZoneSet.add(prov)
            })

            const finalZones = Array.from(mergedZoneSet).sort()
            lotMeta.material_zones = finalZones
            lotMeta.material_zone = finalZones.join(', ')
            lotUpdates.metadata = lotMeta
        }

        // 4. Xử lý Nơi sản xuất / Nhà máy: Hợp nhất vào metadata.production_places & metadata.production_place
        if (newProductionPlaces.size > 0) {
            let productionPlacesList: any[] = []
            let stampFactoryDict: any[] = []
            try {
                const [pRes, dRes] = await Promise.all([
                    (supabase.from('production_places' as any) as any)
                        .select('code, name')
                        .eq('is_active', true),
                    (supabase.from('stamp_dictionaries' as any) as any)
                        .select('code, name')
                        .eq('category', 'factory')
                        .eq('is_active', true)
                ])
                if (pRes.data) productionPlacesList = pRes.data
                if (dRes.data) stampFactoryDict = dRes.data
            } catch {}

            const resolvePlace = (rawVal: string): string | null => {
                const cleanP = String(rawVal).trim()
                if (!cleanP || cleanP === '---' || cleanP === 'Nguyên') return null
                if (cleanP.toLowerCase().includes("cư m'gar")) return null

                // 1. Kiểm tra theo stamp_dictionaries (mã 1, 2, 3...)
                const dictMatch = stampFactoryDict.find(d => 
                    String(d.code).trim() === cleanP ||
                    String(d.name).trim().toLowerCase() === cleanP.toLowerCase() ||
                    (!isNaN(Number(d.code)) && !isNaN(Number(cleanP)) && Number(d.code) === Number(cleanP))
                )
                if (dictMatch) {
                    const prodMatch = productionPlacesList.find(item => 
                        String(item.name || '').trim().toLowerCase() === String(dictMatch.name || '').trim().toLowerCase()
                    )
                    return prodMatch ? prodMatch.name : dictMatch.name
                }

                // 2. Kiểm tra theo production_places
                const matched = productionPlacesList.find(item => {
                    const itemCode = String(item.code || '').trim()
                    const itemName = String(item.name || '').trim().toLowerCase()
                    const pLower = cleanP.toLowerCase()

                    if (itemCode && (
                        itemCode === cleanP || 
                        itemCode.padStart(2, '0') === cleanP.padStart(2, '0') ||
                        (!isNaN(Number(itemCode)) && !isNaN(Number(cleanP)) && Number(itemCode) === Number(cleanP))
                    )) {
                        return true
                    }
                    return itemName === pLower || itemName.includes(pLower) || pLower.includes(itemName)
                })

                if (matched) return matched.name
                return cleanP
            }

            const currentPlaces: string[] = Array.isArray(lotMeta.production_places)
                ? lotMeta.production_places
                : (lotMeta.production_place ? String(lotMeta.production_place).split(',').map((s: string) => s.trim()).filter(Boolean) : [])

            const mergedPlaceSet = new Set<string>()

            // Chuẩn hóa currentPlaces (nếu có giá trị cũ)
            currentPlaces.forEach(p => {
                const resolved = resolvePlace(p)
                if (resolved) mergedPlaceSet.add(resolved)
            })

            // Chuẩn hóa newProductionPlaces từ các thùng vừa quét
            newProductionPlaces.forEach(p => {
                const resolved = resolvePlace(p)
                if (resolved) mergedPlaceSet.add(resolved)
            })

            const finalPlaces = Array.from(mergedPlaceSet).sort()
            lotMeta.production_places = finalPlaces
            lotMeta.production_place = finalPlaces.join(', ')
            lotUpdates.metadata = lotMeta
        }

        // 5. Đồng bộ ảnh con dấu Google Drive / Supabase Storage từ các thùng vào LOT (hiển thị trên trang Quản lý LOT)
        const newStampImages: any[] = []
        const seenFileIds = new Set<string>()
        let detectedPalletStt = ''
        let hasLocalOnlyStampPhoto = false

        boxes.forEach(b => {
            const meta = b.metadata || {}
            if (!detectedPalletStt && meta.pallet_stt) {
                detectedPalletStt = String(meta.pallet_stt).trim().toUpperCase()
            }
            let fileId = meta.drive_file_id || null
            let link = meta.drive_view_url || meta.stamp_image_url || null

            // Nếu link là đường dẫn local trên điện thoại (file://...) thì bỏ qua và đánh dấu để tìm ảnh fallback trên Storage
            if (link && String(link).startsWith('file://')) {
                hasLocalOnlyStampPhoto = true
                link = null
            }

            // Nếu có link http/https hợp lệ nhưng chưa có drive_file_id (VD: ảnh fallback trên Supabase Storage hoặc link Drive)
            if (!fileId && link && /^https?:\/\//i.test(String(link))) {
                const driveMatch = String(link).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(link).match(/[?&]id=([a-zA-Z0-9_-]+)/)
                if (driveMatch && driveMatch[1]) {
                    fileId = driveMatch[1]
                } else {
                    const tail = String(link).split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '') || `img_${newStampImages.length + 1}`
                    fileId = `storage_${tail}`
                }
            }

            if (fileId && link && !seenFileIds.has(fileId)) {
                seenFileIds.add(fileId)
                newStampImages.push({
                    name: `ConDau_STT_${meta.pallet_stt || 'Pallet'}.jpg`,
                    link: link,
                    fileId: fileId,
                    uploadedAt: new Date().toISOString()
                })
            }
        })

        // Khôi phục tự động từ Supabase Storage (stamp-queue/<STT>_*.jpg) nếu thùng bị đẩy lên khi ảnh chỉ mới có đường dẫn file://
        if ((newStampImages.length === 0 || hasLocalOnlyStampPhoto) && detectedPalletStt) {
            try {
                const { data: storageFiles } = await supabase.storage
                    .from('operation-images')
                    .list('stamp-queue', { search: `${detectedPalletStt}_` })
                if (Array.isArray(storageFiles) && storageFiles.length > 0) {
                    for (const sf of storageFiles) {
                        if (!sf.name || !sf.name.toUpperCase().startsWith(`${detectedPalletStt}_`)) continue
                        const fid = `storage_${sf.name}`
                        if (seenFileIds.has(fid)) continue
                        const { data: pub } = supabase.storage
                            .from('operation-images')
                            .getPublicUrl(`stamp-queue/${sf.name}`)
                        const pubUrl = pub?.publicUrl
                            ? pub.publicUrl.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):64321/, 'https://api.chanhthu.click')
                            : null
                        if (pubUrl) {
                            seenFileIds.add(fid)
                            newStampImages.push({
                                name: `ConDau_STT_${detectedPalletStt}_${newStampImages.length + 1}.jpg`,
                                link: pubUrl,
                                fileId: fid,
                                uploadedAt: sf.created_at || new Date().toISOString()
                            })
                        }
                    }
                }
            } catch {}
        }

        if (newStampImages.length > 1) {
            newStampImages.forEach((img, idx) => {
                img.name = `ConDau_STT_${detectedPalletStt || 'Pallet'}_${idx + 1}.jpg`
            })
        }

        if (newStampImages.length > 0) {
            const currentItemImages = lotMeta.item_images || {}
            const targetProdId = lotData.product_id || 'default'

            // Lấy danh sách item.id trong lot_items để gán ảnh vào từng item
            let lotItemIds: string[] = []
            try {
                const { data: lItems } = await (supabase.from('lot_items' as any) as any)
                    .select('id')
                    .eq('lot_id', targetLotId)
                if (Array.isArray(lItems)) {
                    lotItemIds = lItems.map((it: any) => String(it.id))
                }
            } catch {}

            const updatedItemImages = { ...currentItemImages }
            const keysToSync = Array.from(new Set([targetProdId, 'default', ...lotItemIds]))

            keysToSync.forEach(k => {
                const existing = Array.isArray(updatedItemImages[k]) ? updatedItemImages[k] : []
                const existingIds = new Set(existing.map((img: any) => img.fileId))
                const toAdd = newStampImages.filter(img => !existingIds.has(img.fileId))
                if (toAdd.length > 0) {
                    updatedItemImages[k] = [...existing, ...toAdd]
                }
            })

            lotMeta.item_images = updatedItemImages
            const currentStamp = Array.isArray(lotMeta.stamp_images) ? lotMeta.stamp_images : []
            const currentStampIds = new Set(currentStamp.map((img: any) => img.fileId))
            const newToStamp = newStampImages.filter(img => !currentStampIds.has(img.fileId))
            lotMeta.stamp_images = [...currentStamp, ...newToStamp]
            lotUpdates.metadata = lotMeta
        }

        if (Object.keys(lotUpdates).length > 0) {
            await (supabase.from('lots') as any).update(lotUpdates).eq('id', targetLotId)
        }

        return {
            addedPeelingDatesCount,
            rawMaterialDate: detectedRawMaterialDate,
            rawMaterialDates: lotMeta.raw_material_dates,
            packagingDates: lotMeta.packaging_dates,
            materialZones: lotMeta.material_zones,
            productionPlaces: lotMeta.production_places
        }
    } catch (err) {
        console.warn('Lỗi khi đồng bộ ngày, vùng trồng và nơi sản xuất từ thùng vào Lô:', err)
        return { addedPeelingDatesCount: 0, rawMaterialDate: null }
    }
}
