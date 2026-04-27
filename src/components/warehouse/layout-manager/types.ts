export type TileType = 'EMPTY' | 'ENTRANCE' | 'PATH' | 'WALL' | 'ZONE';

// Legacy grid-based format
export interface GridCell {
    x: number;
    y: number;
    type: TileType;
    label?: string;
    zone_id?: string;
}

// New AutoCAD-style shapes format
export type ShapeType = 'ZONE' | 'WALL' | 'PATH' | 'DOOR' | 'RACK' | 'ROOM' | 'PILLAR';

export interface LayoutShape {
    id: string;
    type: ShapeType;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    rotation?: number;
    rx?: number; // border radius chung
    customRadii?: [number, number, number, number]; // [TL, TR, BR, BL] bo góc tuỳ chỉnh
    // For RACK type: grid of positions inside
    rows?: number;
    cols?: number;
    positions?: string[]; // generated position codes
}

export interface WarehouseLayout {
    id: string;
    system_type: string;
    company_id?: string;
    name: string;
    width: number;
    height: number;
    grid_data: GridCell[] | LayoutShape[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Minimal interface for creating/updating
export type LayoutInput = Omit<WarehouseLayout, 'id' | 'created_at' | 'updated_at'>;

// Helper to check if data is new shapes format
export function isShapesFormat(data: any[]): data is LayoutShape[] {
    return data.length === 0 || (data[0] && 'id' in data[0] && 'width' in data[0]);
}
