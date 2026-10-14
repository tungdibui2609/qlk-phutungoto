export type TileType = 'EMPTY' | 'ENTRANCE' | 'PATH' | 'WALL' | 'ZONE';

// Legacy grid-based format
export interface GridCell {
    x: number;
    y: number;
    type: TileType;
    label?: string;
    zone_id?: string;
}

// New AutoCAD-style shapes format - Extended with Industrial & Warehouse elements
export type ShapeType = 
    | 'ZONE'          // Khu vực / Bãi chứa hàng (hỗ trợ Đa Lô)
    | 'RACK'          // Kệ hàng (chia ô)
    | 'ROOM'          // Phòng / Văn phòng / Kho lạnh nhỏ
    | 'WALL'          // Tường chịu lực / tường bao
    | 'PARTITION'     // Vách ngăn nhẹ / Tấm panel
    | 'FENCE'         // Hàng rào / Lan can bảo vệ
    | 'PATH'          // Hành lang / Lối đi xe nâng
    | 'DOOR'          // Cửa ra vào / Cửa cuốn
    | 'DOCK'          // Cửa xuất nhập hàng (Loading Dock)
    | 'PILLAR'        // Cột trụ
    | 'DESK'          // Bàn làm việc / Bàn kiểm đếm thủ kho
    | 'PACK_STATION'  // Trạm đóng gói / Bàn dập nhiệt
    | 'SCALE'         // Trạm cân điện tử
    | 'STAGING'       // Khu tập kết hàng / Đệm hàng chờ xuất nhập
    | 'QC_AREA'       // Khu kiểm tra chất lượng (KCS)
    | 'SCRAP'         // Khu hàng hỏng / Phế phẩm bao bì
    | 'FORKLIFT_PARK' // Bãi đỗ xe nâng / Trạm sạc pin
    | 'STAIRS'        // Cầu thang bộ
    | 'FIRE_EXT'      // Bình PCCC / Trạm an toàn
    | 'FIRST_AID'     // Tủ thuốc y tế / Trạm sơ cứu
    | 'LOCKER'        // Tủ chứa đồ / Tủ locker / Tủ dụng cụ
    | 'ARROW'         // Mũi tên chỉ hướng di chuyển / Luồng xe
    | 'LINE'          // Đường thẳng / Vạch kẻ liền
    | 'DASHED_LINE'   // Đường nét đứt / Vạch kẻ đứt
    | 'TEXT_NOTE';    // Nhãn chữ / Chú thích bản vẽ

export interface LayoutShape {
    id: string;
    type: ShapeType;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    code?: string;
    rotation?: number;
    rx?: number; // border radius chung
    customRadii?: [number, number, number, number]; // [TL, TR, BR, BL] bo góc tuỳ chỉnh
    
    // Customization & Appearance
    color?: string;         // Màu nền tùy chỉnh (HEX)
    strokeColor?: string;   // Màu viền tùy chỉnh (HEX)
    strokeWidth?: number;   // Độ dày nét vẽ
    strokeDasharray?: string; // Tùy biến nét đứt (ví dụ "8 6", "12 6", "4 4")
    lineOrientation?: 'horizontal' | 'vertical' | 'diagonal-down' | 'diagonal-up'; // Hướng đường vẽ
    opacity?: number;       // Độ trong suốt (0.1 -> 1)
    isLocked?: boolean;     // Khóa vị trí (không cho kéo nhầm)
    
    // Multi-Lot & Warehouse Capacity
    isStorage?: boolean;    // Đánh dấu cho phép lưu trữ hàng hóa
    isMultiLot?: boolean;   // Bãi chứa đa Lô (nhiều LOT trong 1 Zone)
    capacity?: number;      // Sức chứa tối đa
    capacityUnit?: string;  // Đơn vị sức chứa (Pallet, Thùng, Kiện...)

    // For RACK type: grid of positions inside
    rows?: number;
    cols?: number;
    positions?: string[];   // generated position codes
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
