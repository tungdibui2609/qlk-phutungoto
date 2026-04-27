import { supabase } from '@/lib/supabaseClient';
import { WarehouseLayout, LayoutInput } from '@/components/warehouse/layout-manager/types';

export const layoutService = {
    async getLayouts(systemType: string): Promise<WarehouseLayout[]> {
        const { data, error } = await (supabase as any)
            .from('warehouse_layouts')
            .select('*')
            .eq('system_type', systemType)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching layouts:', error);
            // Ignore error if table doesn't exist yet for smooth UI during development
            return [];
        }
        return data as WarehouseLayout[];
    },

    async getLayoutById(id: string): Promise<WarehouseLayout | null> {
        const { data, error } = await (supabase as any)
            .from('warehouse_layouts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching layout:', error);
            return null;
        }
        return data as WarehouseLayout;
    },

    async saveLayout(layout: WarehouseLayout | LayoutInput): Promise<WarehouseLayout | null> {
        const { data, error } = await (supabase as any)
            .from('warehouse_layouts')
            .upsert(layout)
            .select()
            .single();

        if (error) {
            console.error('Error saving layout:', error);
            throw error;
        }

        try {
            await this.syncPositionsFromLayout(data as WarehouseLayout);
        } catch (syncError) {
            console.error('Error syncing layout positions:', syncError);
        }

        return data as WarehouseLayout;
    },

    async syncPositionsFromLayout(layout: WarehouseLayout) {
        const items = (layout.grid_data || []) as any[];
        const codeSet = new Set<string>();
        items.forEach((item: any) => {
            if (item.type === 'ZONE' && item.label) codeSet.add(item.label);
            if (item.type === 'RACK' && item.positions) {
                (item.positions as string[]).forEach(c => codeSet.add(c));
            }
        });
        const codes = Array.from(codeSet);

        // 1. Ensure a parent zone exists for this layout (Always create it so it shows in filters)
        const zoneCode = `LAYOUT-${layout.id.substring(0, 8).toUpperCase()}`;
        const { data: existingZone, error: findZoneErr } = await (supabase as any)
            .from('zones')
            .select('id')
            .eq('code', zoneCode)
            .eq('system_type', layout.system_type)
            .maybeSingle();

        if (findZoneErr) {
            console.error('Error finding zone:', findZoneErr);
            throw findZoneErr;
        }

        let zoneId = existingZone?.id;
        if (!zoneId) {
            const newId = crypto.randomUUID();
            const { error: zoneErr } = await (supabase as any)
                .from('zones')
                .insert([{
                    id: newId,
                    code: zoneCode,
                    name: layout.name, // Display directly as layout name
                    system_type: layout.system_type,
                    level: 0
                }]);
            if (zoneErr) {
                console.error('Error creating zone:', zoneErr);
                throw zoneErr;
            }
            zoneId = newId;
        } else {
            // Update name in case layout was renamed
            await (supabase as any).from('zones').update({ name: layout.name }).eq('id', zoneId);
        }

        if (codes.length === 0) return;

        // 2. Fetch existing positions
        const { data: existingPos } = await (supabase as any)
            .from('positions')
            .select('id, code')
            .eq('system_type', layout.system_type)
            .in('code', codes);

        const existingMap = new Map((existingPos || []).map((p: any) => [p.code, p.id]));
        const missingCodes = codes.filter(code => !existingMap.has(code));

        // 3. Create missing positions
        if (missingCodes.length > 0) {
            const newPosRecords = missingCodes.map(code => ({
                id: crypto.randomUUID(),
                code,
                system_type: layout.system_type,
                status: 'active'
            }));

            const { error: posErr } = await (supabase as any).from('positions').insert(newPosRecords);
            if (posErr) throw posErr;

            newPosRecords.forEach((p: any) => existingMap.set(p.code, p.id));
        }

        // 4. Link to zone
        const posIds = Array.from(existingMap.values());
        const zpRecords = posIds.map(posId => ({
            zone_id: zoneId,
            position_id: posId
        }));

        await (supabase as any).from('zone_positions').upsert(zpRecords, { onConflict: 'zone_id,position_id' });
    },

    async deleteLayout(id: string): Promise<boolean> {
        const { error } = await (supabase as any)
            .from('warehouse_layouts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting layout:', error);
            return false;
        }
        return true;
    }
};
