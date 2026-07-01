const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

// Giả lập hàm normalizeSearchString và encodeSTT từ code
function normalizeSearchString(str, removeAccents = false) {
  if (!str) return '';
  let s = str.toLowerCase().trim();
  if (removeAccents) {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return s;
}

function encodeSTT(stt) {
  if (!stt) return null;
  const match = stt.match(/^[a-zA-Z]*(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

async function simulateFetch(searchTerm, positionFilter, searchMode = 'all') {
  const currentSystem = { code: 'KHO_DONG_LANH' };
  console.log(`\n=== MÔ PHỎNG FETCH LOTS với searchTerm='${searchTerm}', positionFilter='${positionFilter}', searchMode='${searchMode}' ===`);

  let selectQuery = `id, code, status, system_code, positions!positions_lot_id_fkey(id, code)`;
  let query;

  if (positionFilter === 'unassigned' && !searchTerm) {
    query = supabase.rpc('get_unassigned_lots', { p_system_code: currentSystem.code })
      .select(selectQuery);
  } else {
    if (positionFilter === 'assigned') {
      selectQuery += `, positions!positions_lot_id_fkey!inner(id, code)`;
    }
    query = supabase.from('lots').select(selectQuery);
    query = query.eq('system_code', currentSystem.code);
    query = query.neq('status', 'hidden').neq('status', 'exported');
  }

  if (searchTerm) {
    const escapeLike = (s) => s.replace(/[%_]/g, '\\$&');
    const normalizedTerm = normalizeSearchString(searchTerm);
    const escapedTerm = escapeLike(normalizedTerm);
    const term = `%${escapedTerm}%`;

    const orQueries = searchTerm.split(';').map(q => q.trim()).filter(Boolean);
    let finalOrConditions = [];

    for (const orQuery of orQueries) {
      const andParts = orQuery.split('&').map(q => q.trim()).filter(Boolean);
      if (andParts.length === 0) continue;

      let groupLotIds = null;

      for (const rawPart of andParts) {
        let isExact = false;
        let part = rawPart;
        if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
          isExact = true;
          part = part.substring(1, part.length - 1).trim();
        }
        const partTerm = isExact ? part : `%${part}%`;

        let currentMatchIds = [];

        if (searchMode === 'all') {
          // 1. Direct lot matches
          const { data: lotsDirect } = await supabase.from('lots')
            .select('id')
            .or(`code.ilike.${partTerm},notes.ilike.${partTerm}`)
            .eq('system_code', currentSystem.code)
            .neq('status', 'hidden')
            .neq('status', 'exported');
          const directIds = lotsDirect?.map(l => l.id) || [];
          console.log(`[all] directIds matching '${part}':`, directIds);

          currentMatchIds = Array.from(new Set([...directIds]));
        }

        if (groupLotIds === null) groupLotIds = currentMatchIds;
        else groupLotIds = groupLotIds.filter(id => currentMatchIds.includes(id));
      }

      console.log(`Trước khi lọc positionFilter, groupLotIds =`, groupLotIds);

      if (positionFilter === 'unassigned' && groupLotIds && groupLotIds.length > 0) {
        const { data: assigned } = await supabase
          .from('positions')
          .select('lot_id')
          .in('lot_id', groupLotIds)
          .not('lot_id', 'is', null);
        const assignedIds = (assigned || []).map(p => p.lot_id).filter(Boolean);
        console.log(`assignedIds (đã gán vị trí) trong nhóm:`, assignedIds);
        groupLotIds = groupLotIds.filter(id => !assignedIds.includes(id));
      }

      console.log(`Sau khi lọc positionFilter, groupLotIds =`, groupLotIds);

      if (groupLotIds && groupLotIds.length > 0) {
        finalOrConditions.push(`id.in.(${groupLotIds.slice(0, 150).join(',')})`);
      } else if (andParts.length > 0) {
        finalOrConditions.push(`id.eq.00000000-0000-0000-0000-000000000000`);
      }
    }

    if (finalOrConditions.length > 0) {
      query = query.or(finalOrConditions.join(','));
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  }

  const { data: finalLots, error } = await query;
  if (error) {
    console.error("Lỗi query:", error);
  } else {
    console.log("KẾT QUẢ LOTS TRẢ VỀ:", JSON.stringify(finalLots, null, 2));
  }
}

async function run() {
  // Test 1: Không có searchTerm, positionFilter = 'unassigned'
  await simulateFetch('', 'unassigned');

  // Test 2: Có searchTerm = '290626', positionFilter = 'unassigned'
  await simulateFetch('290626', 'unassigned');
}

run();
