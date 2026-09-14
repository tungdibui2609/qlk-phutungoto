-- Optimization indexes for lots, positions, and warehouse map queries
CREATE INDEX IF NOT EXISTS idx_lots_system_code_status ON lots (system_code, status);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots (status);
CREATE INDEX IF NOT EXISTS idx_lots_system_code ON lots (system_code);
CREATE INDEX IF NOT EXISTS idx_positions_system_type_lot_id ON positions (system_type, lot_id);
