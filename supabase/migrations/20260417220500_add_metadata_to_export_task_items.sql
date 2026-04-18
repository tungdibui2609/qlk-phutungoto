-- Migration: Add metadata column to export_task_items
-- Created at: 2026-04-17 22:05:00
-- Description: Thêm cột metadata để lưu trữ lịch sử lượt lấy (picks) trước khi chốt ca.

ALTER TABLE "public"."export_task_items" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
