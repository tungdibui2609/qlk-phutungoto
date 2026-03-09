
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupOrphanLots() {
    console.log('Starting thorough cleanup of orphan lot_ids in positions...');

    let totalOrphans = 0;
    let from = 0;
    const limit = 1000;

    while (true) {
        console.log(`Fetching positions from ${from}...`);
        const { data: positions, error: pError } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .not('lot_id', 'is', null)
            .range(from, from + limit - 1);

        if (pError) {
            console.error('Error fetching positions:', pError);
            break;
        }

        if (!positions || positions.length === 0) {
            console.log('No more positions with lot_id found.');
            break;
        }

        console.log(`Processing ${positions.length} positions...`);

        const lotIdsInPositions = Array.from(new Set(positions.map(p => p.lot_id)));
        const existingLotIds = new Set();

        // Fetch existing lots in chunks
        const CHUNK_SIZE = 500;
        for (let i = 0; i < lotIdsInPositions.length; i += CHUNK_SIZE) {
            const chunk = lotIdsInPositions.slice(i, i + CHUNK_SIZE);
            const { data: lots, error: lError } = await supabase
                .from('lots')
                .select('id')
                .in('id', chunk);

            if (lError) {
                console.error('Error fetching lots:', lError);
                continue;
            }

            lots.forEach(l => existingLotIds.add(l.id));
        }

        const orphanPositionIds = [];
        for (const pos of positions) {
            if (!existingLotIds.has(pos.lot_id)) {
                orphanPositionIds.push(pos.id);
            }
        }

        if (orphanPositionIds.length > 0) {
            console.log(`Cleaning ${orphanPositionIds.length} orphans in this batch...`);
            for (let i = 0; i < orphanPositionIds.length; i += CHUNK_SIZE) {
                const chunk = orphanPositionIds.slice(i, i + CHUNK_SIZE);
                await supabase.from('positions').update({ lot_id: null }).in('id', chunk);
            }
            totalOrphans += orphanPositionIds.length;
        }

        if (positions.length < limit) break;
        // Don't increment 'from' if we are deleting/removing lot_ids because the indices shift?
        // Actually, '.not("lot_id", "is", null)' means if we set lot_id to null, they won't appear in the next fetch if we kept same offset.
        // But range works by absolute index. So we SHOULD NOT increment 'from' if we removed items from the matching set.
        // Wait, Supabase range is fixed. If we remove 1000 items, the NEXT 1000 items are now at index 0.
        // So we keep 'from = 0' until we find no more.
        from = 0;
    }

    console.log(`Cleanup finished. Total orphans cleared: ${totalOrphans}`);
}

cleanupOrphanLots();
