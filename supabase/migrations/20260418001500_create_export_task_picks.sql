-- Migration: Create export_task_picks table for permanent picking history
-- Created at: 2026-04-18 00:15:00

CREATE TABLE IF NOT EXISTS "public"."export_task_picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_item_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "note" "text",
    "picker_id" "uuid" NOT NULL REFERENCES "auth"."users"("id"),
    "session_id" "uuid",
    "system_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    
    CONSTRAINT "export_task_picks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "export_task_picks_task_item_id_fkey" FOREIGN KEY ("task_item_id") REFERENCES "public"."export_task_items"("id") ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE "public"."export_task_picks" ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own system's picks" 
ON "public"."export_task_picks" 
FOR SELECT 
USING (
    "system_code" IN (
        SELECT "code" FROM "public"."systems"
    )
);

CREATE POLICY "Users can insert picks" 
ON "public"."export_task_picks" 
FOR INSERT 
WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."export_task_picks";
