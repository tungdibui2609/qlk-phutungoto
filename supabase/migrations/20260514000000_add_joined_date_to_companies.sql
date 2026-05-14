-- Migration: Add joined_date column to companies table
-- This allows setting a custom "date joined" for the company, separate from created_at

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS joined_date DATE;

COMMENT ON COLUMN public.companies.joined_date IS 'Ngày tham gia/khởi tạo công ty, có thể chỉnh sửa bởi admin';