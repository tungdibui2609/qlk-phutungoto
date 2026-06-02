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

async function main() {
    try {
        const systemCode = 'KHO_DONG_LANH';
        const zones = await fetchAll('zones', q => q.eq('system_type', systemCode));

        const day4Id = '418b0c1a-75ef-401c-9129-3b3a7e7f104a';

        // Xây dựng parentToChildren
        const parentToChildren = new Map()
        zones.forEach(z => {
            if (z && z.parent_id) {
                const list = parentToChildren.get(z.parent_id) || []
                list.push(z)
                parentToChildren.set(z.parent_id, list)
            }
        })

        const getChildren = (parentId) => {
            return parentToChildren.get(parentId) || []
        }

        // Lấy con của Dãy 4
        const children = getChildren(day4Id);
        console.log(`Số con của Dãy 4 Kho 2: ${children.length}`);

        // Gom nhóm các Ô
        const binGroups = {}
        children.forEach(c => {
            const cName = c.name || ''
            const match = cName.match(/\d+$/)
            const suffix = match ? match[0] : cName
            binGroups[suffix] = binGroups[suffix] || []
            binGroups[suffix].push(c)
        })

        console.log(`binGroups['03'] chứa:`, binGroups['03']?.map(z => ({ id: z.id, name: z.name })));

        const suffix = '03';
        const members = binGroups[suffix];

        const firstMember = members[0]
        const firstMemberName = firstMember.name || ''
        const isBinPattern = firstMemberName.toUpperCase().startsWith('Ô ') || members.length > 1

        console.log(`isBinPattern for Ô 03:`, isBinPattern);

        if (isBinPattern) {
            const safeSuffix = suffix.replace(/[^a-zA-Z0-9]/g, '_')
            const vBinId = `v-bin-${day4Id}-${safeSuffix}`
            
            console.log(`Virtual Bin ID: ${vBinId}`);

            const levelGroups = {}
            members.forEach(m => {
                const mChildren = getChildren(m.id)
                console.log(`  Ô thực tế ${m.name} (${m.id}) có ${mChildren.length} con:`, mChildren.map(z => ({ id: z.id, name: z.name })));
                mChildren.forEach(lvl => {
                    const lvlName = lvl.name || ''
                    const key = lvlName.trim().toUpperCase()
                    levelGroups[key] = levelGroups[key] || []
                    levelGroups[key].push(lvl)
                })
            })

            console.log(`\nlevelGroups keys:`, Object.keys(levelGroups));
            
            Object.entries(levelGroups).forEach(([lvlName, lMembers]) => {
                console.log(`\nlevelGroups["${lvlName}"] chứa ${lMembers.length} members:`);
                lMembers.forEach(lm => {
                    console.log(`  - ID: ${lm.id} | Name: ${lm.name} | Parent ID: ${lm.parent_id}`);
                });

                const firstLvl = lMembers[0];
                const vLvlId = `v-lvl-${vBinId}-${lvlName.replace(/[^a-zA-Z0-9]/g, '_')}`;

                console.log(`Virtual Level ID cho ${lvlName}: ${vLvlId}`);

                // In ra các mapping zoneIdMap
                console.log(`Các mapping zoneIdMap:`);
                lMembers.forEach(lm => {
                    console.log(`  Mapping ${lm.id} -> ${vLvlId}`);
                });
            });
        }

    } catch (e) {
        console.error(e);
    }
}

main();
