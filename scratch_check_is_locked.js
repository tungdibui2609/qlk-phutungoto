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

async function main() {
  console.log("=== PHÂN TÍCH QUAN HỆ ZONE & POSITION ===");

  // 1. Lấy thông tin các position
  const { data: positions } = await supabase
    .from('positions')
    .select('*')
    .in('code', ['K2D4A03T101', 'K2D4B03T101']);

  console.log("Positions:", positions);

  if (!positions || positions.length === 0) {
    console.log("Không tìm thấy các position");
    return;
  }

  const posIds = positions.map(p => p.id);

  // 2. Lấy thông tin từ zone_positions
  const { data: zonePositions } = await supabase
    .from('zone_positions')
    .select('*')
    .in('position_id', posIds);

  console.log("\nZone Positions:", zonePositions);

  const zoneIds = zonePositions.map(zp => zp.zone_id);

  // 3. Lấy thông tin các zone thật này
  const { data: zones } = await supabase
    .from('zones')
    .select('*')
    .in('id', zoneIds);

  console.log("\nReal Zones (Tầng 1 thật):", zones);

  // 4. Lấy các zone cha (Ô) của các tầng này
  const parentIds = zones.map(z => z.parent_id).filter(Boolean);
  const { data: parentZones } = await supabase
    .from('zones')
    .select('*')
    .in('id', parentIds);

  console.log("\nParent Zones (Ô thật):", parentZones);

  // 5. Lấy các zone ông nội (Dãy) của các tầng này
  const grandParentIds = parentZones.map(z => z.parent_id).filter(Boolean);
  const { data: grandParentZones } = await supabase
    .from('zones')
    .select('*')
    .in('id', grandParentIds);

  console.log("\nGrandParent Zones (Dãy thật):", grandParentZones);
}

main();
