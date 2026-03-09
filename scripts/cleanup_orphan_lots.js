
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupOrphanLots() {
    console.log('Starting cleanup of orphan lot_ids in positions...');

    // 1. Get all positions with lot_id
    const { data: positions, error: pError } = await supabase
        .from('positions')
        .select('id, code, lot_id')
        .not('lot_id', 'is', null);

    if (pError) {
        console.error('Error fetching positions:', pError);
        return;
    }

    console.log(`Found ${positions.length} positions with lot_id mapping.`);

    const orphanPositionIds = [];

    // 2. Sample or chunk check (for 1000 positions, individual checks are okay but slow)
    // For efficiency, let's get all LOT IDs that actually exist
    const lotIdsInPositions = Array.from(new Set(positions.map(p => p.lot_id)));

    // Fetch existing lots in chunks
    const existingLotIds = new Set();
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

    console.log(`Verified ${existingLotIds.size} valid lots.`);

    // 3. Identify positions with invalid lot_ids
    for (const pos of positions) {
        if (!existingLotIds.has(pos.lot_id)) {
            orphanPositionIds.push(pos.id);
            console.log(`Orphan detected: Position ${pos.code} -> Lot ${pos.lot_id} (Lot not found)`);
        }
    }

    console.log(`Total orphan positions found: ${orphanPositionIds.length}`);

    if (orphanPositionIds.length > 0) {
        console.log(`Proceeding to clear lot_id for ${orphanPositionIds.length} positions...`);

        // Update positions in chunks
        for (let i = 0; i < orphanPositionIds.length; i += CHUNK_SIZE) {
            const chunk = orphanPositionIds.slice(i, i + CHUNK_SIZE);
            const { error: uError } = await supabase
                .from('positions')
                .update({ lot_id: null })
                .in('id', chunk);

            if (uError) {
                console.error(`Error updating positions chunk starting at ${i}:`, uError);
            } else {
                console.log(`Successfully cleared ${chunk.length} positions.`);
            }
        }
    } else {
        console.log('No orphan lot_ids found to clean.');
    }

    console.log('Cleanup finished.');
}

cleanupOrphanLots();
