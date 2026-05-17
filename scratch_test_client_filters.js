const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchAll(table, filter, customSelect = '*', limit = 1000) {
    let allRecs = [];
    let from = 0;
    while (true) {
        let query = supabase.from(table).select(customSelect).range(from, from + limit - 1);
        if (filter) query = filter(query);
        const { data, error } = await query;

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRecs = [...allRecs, ...data];
        if (data.length < limit) break;
        from += limit;
    }
    return allRecs;
}

async function fetchAllZonesPos(limit = 1000) {
    let allRecs = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('zone_positions')
            .select('zone_id, position_id, positions!inner(system_type)')
            .eq('positions.system_type', 'KHO_DONG_LANH')
            .order('zone_id', { ascending: true })
            .order('position_id', { ascending: true })
            .range(from, from + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRecs = [...allRecs, ...data];
        if (data.length < limit) break;
        from += limit;
    }
    return allRecs;
}

function advancedMatchSearch(vals, query) {
    if (!query) return true;
    const parts = query.split('&').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return true;

    return parts.every(part => {
        const orParts = part.split(/[; ]+/).map(p => p.trim()).filter(Boolean);
        if (orParts.length === 0) return true;

        return orParts.some(op => {
            return vals.some(val => String(val).toLowerCase().includes(op));
        });
    });
}

function groupWarehouseData(zones = [], positions = []) {
    try {
        const parentToChildren = new Map()
        zones.forEach(z => {
            if (z && z.parent_id) {
                const list = parentToChildren.get(z.parent_id) || []
                list.push(z)
                parentToChildren.set(z.parent_id, list)
            }
        })

        const finalZones = []
        const zoneIdMap = new Map()
        const processedOldZoneIds = new Set()

        const getChildren = (parentId) => {
            return parentToChildren.get(parentId) || []
        }

        const processZoneRecursively = (zone) => {
            if (!zone || processedOldZoneIds.has(zone.id)) return

            finalZones.push(zone)
            processedOldZoneIds.add(zone.id)

            const children = getChildren(zone.id)
            if (children.length === 0) return

            const zoneName = zone.name || ''
            const isGroupingContainer = /D[ÃãYy]|S[Ảả]nh|K[Ệệ]|KHU|S[Àà]NH|CH[Ũũ]|PH[Òò]NG/i.test(zoneName) || zoneName.toUpperCase().includes('DÃY')

            if (isGroupingContainer) {
                const binGroups = {}
                children.forEach(c => {
                    const cName = c.name || ''
                    const match = cName.match(/\d+$/)
                    const suffix = match ? match[0] : cName
                    binGroups[suffix] = binGroups[suffix] || []
                    binGroups[suffix].push(c)
                })

                Object.entries(binGroups).forEach(([suffix, members]) => {
                    const firstMember = members[0]
                    if (!firstMember) return

                    const firstMemberName = firstMember.name || ''
                    const isBinPattern = firstMemberName.toUpperCase().startsWith('Ô ') || members.length > 1

                    if (isBinPattern) {
                        const safeSuffix = suffix.replace(/[^a-zA-Z0-9]/g, '_')
                        const vBinId = `v-bin-${zone.id}-${safeSuffix}`
                        
                        finalZones.push({
                            ...firstMember,
                            id: vBinId,
                            parent_id: zone.id,
                            name: members.length > 1 || !firstMemberName.startsWith('Ô ') ? `Ô ${suffix}` : firstMemberName,
                            code: `Ô ${suffix}`
                        })

                        const levelGroups = {}
                        members.forEach(m => {
                            const mChildren = getChildren(m.id)
                            mChildren.forEach(lvl => {
                                const lvlName = lvl.name || ''
                                const key = lvlName.trim().toUpperCase()
                                levelGroups[key] = levelGroups[key] || []
                                levelGroups[key].push(lvl)
                            })
                            processedOldZoneIds.add(m.id)
                            zoneIdMap.set(m.id, vBinId)
                        })

                        Object.entries(levelGroups).forEach(([lvlName, lMembers]) => {
                            const firstLvl = lMembers[0]
                            if (!firstLvl) return

                            const safeLvlName = lvlName.replace(/[^a-zA-Z0-9]/g, '_')
                            const vLvlId = `v-lvl-${vBinId}-${safeLvlName}`
                            finalZones.push({
                                ...firstLvl,
                                id: vLvlId,
                                parent_id: vBinId,
                                name: firstLvl.name
                            })

                            lMembers.forEach(lm => {
                                zoneIdMap.set(lm.id, vLvlId)
                                processedOldZoneIds.add(lm.id)
                            })
                        })
                    } else {
                        processZoneRecursively(firstMember)
                    }
                })
            } else {
                children.forEach(c => processZoneRecursively(c))
            }
        }

        const roots = zones.filter(z => z && !z.parent_id)
        roots.forEach(processZoneRecursively)

        zones.forEach(z => {
            if (z && !processedOldZoneIds.has(z.id)) finalZones.push(z)
        })

        const finalPositions = []
        positions.forEach(p => {
            if (!p) return
            const targetZoneId = (p.zone_id && zoneIdMap.get(p.zone_id)) || p.zone_id
            finalPositions.push({
                ...p,
                zone_id: targetZoneId || p.zone_id,
                realIds: [p.id],
                isVirtual: false
            })
        })

        const virtualToRealMap = new Map()
        zoneIdMap.forEach((vId, realId) => {
            const list = virtualToRealMap.get(vId) || []
            list.push(realId)
            virtualToRealMap.set(vId, list)
        })

        return { zones: finalZones, positions: finalPositions, virtualToRealMap }
    } catch (error) {
        console.error(error)
        return { zones, positions }
    }
}

async function main() {
    console.log('--- TEST LOGIC LỌC SELECTEDZONEID VÀ SEARCH TRÊN CLIENT ---');

    try {
        const systemType = 'KHO_DONG_LANH';
        const searchTerm = 'LSX030426 & L034DD260-TN';
        const selectedZoneId = 'aed91a65-860d-478f-9f06-94ff1c4cd5ce'; // KHO 3

        const [posData, zoneData, zpData, lotsData] = await Promise.all([
            fetchAll('positions', q => q.eq('system_type', systemType).order('code').order('id')),
            fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code').order('id')),
            fetchAllZonesPos(),
            fetchAll('lots', q => q.eq('system_code', systemType), '*, productions(code, name, production_lots(id, lot_code, product_id)), suppliers(name), qc_info(name), products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name))), lot_items(id, product_id, quantity, unit, products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name)))), lot_tags(tag, lot_item_id)')
        ]);

        const zpLookup = {};
        zpData.forEach(zp => {
            if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id;
        });

        const posWithZone = posData.map(pos => ({
            ...pos,
            zone_id: zpLookup[pos.id] || null
        }));

        const lotInfoMap = {};
        lotsData.forEach(l => {
            const lotItems = l.lot_items || [];
            const allTags = l.lot_tags || [];
            let items = [];
            let accumulatedTags = [];

            if (lotItems.length > 0) {
                items = lotItems.map(item => {
                    const itemTags = allTags
                        .filter(t => t.lot_item_id === item.id)
                        .map(t => t.tag.replace(/@/g, item.products?.sku || ''))
                        .filter(t => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'));
                    accumulatedTags.push(...itemTags);
                    return {
                        product_name: item.products?.name || '',
                        sku: item.products?.sku || '',
                        internal_code: item.products?.internal_code || '',
                        internal_name: item.products?.internal_name || '',
                        unit: item.unit || item.products?.unit || '',
                        quantity: item.quantity || 0,
                        tags: itemTags
                    };
                });
            } else if (l.products) {
                const itemTags = allTags
                    .map(t => t.tag.replace(/@/g, l.products?.sku || ''))
                    .filter(t => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'));
                accumulatedTags.push(...itemTags);
                items = [{
                    product_name: l.products.name || '',
                    sku: l.products.sku || '',
                    internal_code: l.products.internal_code || '',
                    internal_name: l.products.internal_name || '',
                    unit: l.products.unit || '',
                    quantity: l.quantity || 0,
                    tags: itemTags
                }];
            }

            const prodData = Array.isArray(l.productions) ? l.productions[0] : l.productions;
            const lotProdLotId = l.production_lot_id;
            const allProdLots = (prodData?.production_lots || [])
                .filter(pl => pl.id === lotProdLotId)
                .map(pl => pl.lot_code)
                .filter(Boolean);

            lotInfoMap[l.id] = {
                ...l,
                items,
                tags: accumulatedTags,
                qc_name: l.qc_info?.name,
                supplier_name: l.suppliers?.name,
                productions: prodData,
                production_lot_codes: allProdLots
            };
        });

        // 1. Áp dụng filter selectedZoneId TRƯỚC
        let filteredByZone = posWithZone;
        if (selectedZoneId) {
            const { virtualToRealMap } = groupWarehouseData(zoneData, posWithZone);
            
            const resolveRealIds = (id) => {
                const mapped = virtualToRealMap?.get(id)
                return mapped ? mapped : [id]
            }

            const baseRealIds = resolveRealIds(selectedZoneId)
            
            const getDescendantIds = (parentId) => {
                const children = zoneData.filter(z => z.parent_id === parentId)
                const descendantIds = children.map(c => c.id)
                children.forEach(child => {
                    descendantIds.push(...getDescendantIds(child.id))
                })
                return descendantIds
            }

            const allRealIds = new Set()
            baseRealIds.forEach(id => {
                allRealIds.add(id)
                getDescendantIds(id).forEach(dId => allRealIds.add(dId))
            })

            filteredByZone = filteredByZone.filter(p => p.zone_id && allRealIds.has(p.zone_id));
        }

        console.log(`Số positions sau khi lọc SelectedZoneId (Kho 3): ${filteredByZone.length}`);

        // 2. Áp dụng filter SearchTerm
        let filteredBySearch = filteredByZone;
        if (searchTerm) {
            filteredBySearch = filteredBySearch.filter(p => {
                const lot = p.lot_id ? lotInfoMap[p.lot_id] : null;
                if (!lot) return false;

                const res = [p.code];
                if (lot.code) res.push(lot.code);
                lot.items?.forEach(it => {
                    if (it.product_name) res.push(it.product_name);
                    if (it.internal_name) res.push(it.internal_name);
                    if (it.sku) res.push(it.sku);
                    if (it.internal_code) res.push(it.internal_code);
                });
                lot.tags?.forEach(t => res.push(t));
                if (lot.production_code) res.push(lot.production_code);
                if (lot.productions?.code) res.push(lot.productions.code);
                if (lot.productions?.name) res.push(lot.productions.name);
                lot.production_lot_codes?.forEach(code => res.push(code));
                if (lot.daily_seq) res.push(String(lot.daily_seq));
                if (lot.supplier_name) res.push(lot.supplier_name);
                if (lot.qc_name) res.push(lot.qc_name);

                return advancedMatchSearch(res, searchTerm);
            });
        }

        console.log(`Số positions sau khi lọc Search: ${filteredBySearch.length}`);

        // 3. Áp dụng groupWarehouseData một lần nữa cho kết quả (giống page.tsx render)
        const finalGrouped = groupWarehouseData(zoneData, filteredBySearch);
        console.log(`Số positions sau gom nhóm groupWarehouseData cuối: ${finalGrouped.positions.length}`);

    } catch (e) {
        console.error(e);
    }
}

main();
