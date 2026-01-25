export interface LevelData {
    id: string;
    levelNumber: number;
    total: number;
    used: number;
    product?: string; // Dominant product
    isMixed?: boolean; // True if contains mixed products
    items: {
        position: number;
        code: string;
        name: string;
        quantity: string;
        unit: string;
        tags?: string[]
    }[]; // Per-slot products
}

export interface RackData {
    id: string;
    name: string;
    levels: LevelData[];
}

export interface ZoneData {
    id: string;
    name: string;
    level: number;
    parent_id?: string | null;
    children?: ZoneData[];
    positions?: {
        id: string;
        code: string;
        lot_id?: string | null;
        items: LevelData['items'];
    }[];
    // Legacy support for qlk components if needed, though we will refactor them
    racks?: RackData[];
    hall?: {
        total: number;
        used: number;
        items: LevelData['items'];
    };
}

export interface ZoneStats {
    id: string;
    name: string;
    total: number;
    used: number;
    free: number;
    percent: number;
    color: string;
}
