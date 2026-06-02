const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Nhúng trực tiếp hàm groupWarehouseData dạng JS thuần để chạy độc lập
function groupWarehouseData(zones = [], positions = []) {
    try {
        if (!zones) zones = []
        if (!positions) positions = []
        const parentToChildren = new Map()
        zones.forEach(z => {
            if (z && z.parent_id && z.parent_id !== '') {
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

        const roots = zones.filter(z => z && (!z.parent_id || z.parent_id === ''))
        roots.forEach(processZoneRecursively)

        zones.forEach(z => {
            if (z && !processedOldZoneIds.has(z.id)) finalZones.push(z)
        })

        const virtualToRealMap = new Map()
        zoneIdMap.forEach((vId, realId) => {
            const list = virtualToRealMap.get(vId) || []
            list.push(realId)
            virtualToRealMap.set(vId, list)
        })

        return { 
            zones: finalZones, 
            virtualToRealMap 
        }
    } catch (error) {
        console.error('Error in groupWarehouseData:', error)
        return { zones }
    }
}

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== MÔ PHỎNG LOGIC LỌC LOT THEO ZONE CỦA HỆ THỐNG ===");

  // 1. Tải tất cả zones (vượt qua giới hạn 1000 bằng vòng lặp)
  let rawZones = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .eq('system_type', 'KHO_DONG_LANH')
      .range(from, from + pageSize - 1);
    
    if (error) {
      console.error("Lỗi:", error);
      break;
    }
    if (!data || data.length === 0) break;
    rawZones = [...rawZones, ...data];
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Tải về đầy đủ ${rawZones.length} zones.`);

  // 2. Chạy groupWarehouseData để xây dựng cây zone ảo
  const { zones: groupedZones, virtualToRealMap } = groupWarehouseData(rawZones, []);

  // Tìm Virtual Zone "TẦNG 1" thuộc virtual bin "Ô 03" thuộc Dãy 4 thuộc Kho 2
  // Dãy 4 ID: 418b0c1a-75ef-401c-9129-3b3a7e7f104a
  const vBin = groupedZones.find(z => z.parent_id === '418b0c1a-75ef-401c-9129-3b3a7e7f104a' && z.name === 'Ô 03');
  console.log("\nVirtual Bin (Ô 03):", vBin);

  if (!vBin) {
    console.log("Không tìm thấy virtual bin Ô 03");
    return;
  }

  const vLvl = groupedZones.find(z => z.parent_id === vBin.id && z.name.toUpperCase() === 'TẦNG 1');
  console.log("Virtual Level (Tầng 1):", vLvl);

  if (!vLvl) {
    console.log("Không tìm thấy virtual level Tầng 1 dưới Ô 03");
    return;
  }

  // 3. Lấy realZoneIds từ virtualToRealMap
  const realZoneIds = virtualToRealMap.get(vLvl.id) || [];
  console.log("\nCác realZoneIds tương ứng:", realZoneIds);

  // 4. Chạy RPC get_lot_ids_in_zone
  console.log(`\nChạy RPC get_lot_ids_in_zone với realZoneIds:`, realZoneIds);
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'get_lot_ids_in_zone',
    { p_system_code: 'KHO_DONG_LANH', p_zone_ids: realZoneIds }
  );

  if (rpcError) {
    console.error("Lỗi chạy RPC:", rpcError);
    return;
  }

  console.log("Kết quả từ RPC:", rpcData);

  const zoneLotIds = (rpcData || []).map(r => r.lot_id).filter(Boolean);
  console.log("Mảng zoneLotIds thu được:", zoneLotIds);

  // 5. Chạy query SELECT lots giống hệt useLotManagement.ts
  console.log(`\nChạy SELECT lots query với zoneLotIds:`);
  const { data: lots, error: lotsError } = await supabase
    .from('lots')
    .select('id, code, status, system_code, daily_seq, lot_items(id, product_id, quantity, products(name))')
    .eq('system_code', 'KHO_DONG_LANH')
    .neq('status', 'hidden')
    .neq('status', 'exported')
    .in('id', zoneLotIds);

  if (lotsError) {
    console.error("Lỗi select lots:", lotsError);
    return;
  }

  console.log(`Query lots trả về ${lots.length} records:`);
  lots.forEach(l => {
    console.log(`- Lot ID: ${l.id} | Code: ${l.code} | Status: ${l.status} | Daily Seq: ${l.daily_seq}`);
    console.log(`  Items:`, l.lot_items?.map(item => `${item.products?.name} - ${item.quantity}`));
  });
}

main();
