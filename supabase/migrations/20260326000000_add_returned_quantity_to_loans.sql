-- Add returned_quantity column to production_loans table
-- This allows tracking how much of the issued quantity was actually returned to stock.

ALTER TABLE production_loans
ADD COLUMN IF NOT EXISTS returned_quantity NUMERIC;

-- Comment for clarity
COMMENT ON COLUMN production_loans.returned_quantity IS 'Số lượng thực tế được trả về kho';
