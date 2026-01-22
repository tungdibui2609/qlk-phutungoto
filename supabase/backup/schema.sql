


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."ensure_single_default_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE branches
        SET is_default = false
        WHERE id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_branch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, role, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', 'staff', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_default" boolean DEFAULT false,
    "system_type" "text" DEFAULT 'FROZEN'::"text"
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "system_type" "text" NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "tax_code" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_name" "text"
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "contact_person" character varying(100),
    "phone" character varying(50),
    "email" character varying(100),
    "address" "text",
    "tax_code" character varying(50),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "system_type" "text" DEFAULT 'FROZEN'::"text",
    "system_code" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "product_name" "text",
    "unit" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "price" numeric(15,2) DEFAULT 0,
    "total_amount" numeric(15,2) GENERATED ALWAYS AS ((("quantity")::numeric * "price")) STORED,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "document_quantity" numeric DEFAULT 0,
    "document_unit" "text",
    "conversion_rate" numeric DEFAULT 1
);


ALTER TABLE "public"."inbound_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" DEFAULT 'Purchase'::"text",
    "status" "text" DEFAULT 'Pending'::"text",
    "warehouse_name" "text",
    "supplier_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "description" "text",
    "supplier_address" "text",
    "supplier_phone" "text",
    "image_url" "text",
    "system_type" "text" DEFAULT 'FROZEN'::"text",
    "system_code" "text" DEFAULT 'FROZEN'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "order_type_id" "text",
    "images" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."inbound_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inbound_orders"."image_url" IS 'URL of the uploaded invoice/document image';



COMMENT ON COLUMN "public"."inbound_orders"."images" IS 'List of image URLs (JSONB array)';



CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "warehouse_id" "uuid",
    "code" "text" NOT NULL,
    "type" "text" DEFAULT 'Rack'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid",
    "capacity" integer DEFAULT 0,
    "current_quantity" integer DEFAULT 0,
    "name" character varying(100),
    "notes" "text"
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lot_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "lot_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."lot_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text",
    "product_id" "uuid",
    "supplier_id" "uuid",
    "inbound_date" "date" DEFAULT CURRENT_DATE,
    "batch_code" "text",
    "quantity" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "peeling_date" timestamp with time zone
);


ALTER TABLE "public"."lots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_types" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "description" "text",
    "system_code" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "order_types_scope_check" CHECK (("scope" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."order_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."origins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "description" "text",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."origins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbound_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "product_name" "text",
    "unit" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "price" numeric(15,2) DEFAULT 0,
    "total_amount" numeric(15,2) GENERATED ALWAYS AS ((("quantity")::numeric * "price")) STORED,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "document_quantity" numeric DEFAULT 0,
    "document_unit" "text",
    "conversion_rate" numeric DEFAULT 1
);


ALTER TABLE "public"."outbound_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbound_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" DEFAULT 'Sale'::"text",
    "status" "text" DEFAULT 'Pending'::"text",
    "warehouse_name" "text",
    "customer_name" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "description" "text",
    "customer_address" "text",
    "customer_phone" "text",
    "image_url" "text",
    "system_type" "text" DEFAULT 'FROZEN'::"text",
    "system_code" "text" DEFAULT 'FROZEN'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "order_type_id" "text",
    "images" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."outbound_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."outbound_orders"."image_url" IS 'URL of the uploaded invoice/document image';



COMMENT ON COLUMN "public"."outbound_orders"."images" IS 'List of image URLs (JSONB array)';



CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "module" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(100) NOT NULL,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "batch_name" character varying(100),
    "lot_id" "uuid",
    "system_type" "text" DEFAULT 'FROZEN'::"text"
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "product_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "type" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    CONSTRAINT "product_media_type_check" CHECK (("type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."product_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "conversion_rate" numeric DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ref_unit_id" "uuid"
);


ALTER TABLE "public"."product_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_vehicle_compatibility" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "vehicle_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_vehicle_compatibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category_id" "uuid",
    "manufacturer" "text",
    "part_number" "text",
    "compatible_models" "text"[],
    "unit" "text" DEFAULT 'cái'::"text",
    "min_stock_level" integer DEFAULT 10,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "price" numeric(12,2) DEFAULT 0,
    "oem_number" character varying(100),
    "origin_country" character varying(100),
    "quality_grade" character varying(50),
    "warranty_months" integer DEFAULT 0,
    "weight_kg" numeric(10,3),
    "dimensions" character varying(100),
    "cost_price" numeric(12,2) DEFAULT 0,
    "retail_price" numeric(12,2) DEFAULT 0,
    "wholesale_price" numeric(12,2) DEFAULT 0,
    "supplier_id" "uuid",
    "lead_time_days" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_returnable" boolean DEFAULT true,
    "cross_reference_numbers" "text"[],
    "system_type" "text" DEFAULT 'FROZEN'::"text",
    "specifications" "jsonb" DEFAULT '{}'::"jsonb",
    "packaging_specification" "text",
    "system_code" "text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'staff'::"text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_role" CHECK (("role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qc_info" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "system_code" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."qc_info" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "contact_person" character varying(100),
    "phone" character varying(50),
    "email" character varying(100),
    "address" "text",
    "tax_code" character varying(50),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "system_type" "text" DEFAULT 'FROZEN'::"text",
    "system_code" "text"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_configs" (
    "system_code" "text" NOT NULL,
    "inbound_modules" "jsonb" DEFAULT '[]'::"jsonb",
    "outbound_modules" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."system_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_configs" IS 'Lưu cấu hình bật/tắt module cho từng kho';



COMMENT ON COLUMN "public"."system_configs"."inbound_modules" IS 'Danh sách ID các module nhập kho được kích hoạt';



COMMENT ON COLUMN "public"."system_configs"."outbound_modules" IS 'Danh sách ID các module xuất kho được kích hoạt';



CREATE TABLE IF NOT EXISTS "public"."systems" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "bg_color_class" "text",
    "text_color_class" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "modules" "jsonb" DEFAULT '[]'::"jsonb",
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."systems" OWNER TO "postgres";


COMMENT ON COLUMN "public"."systems"."sort_order" IS 'Order of display for systems (ascending)';



CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "employee_code" character varying(50),
    "full_name" character varying(255) NOT NULL,
    "phone" character varying(50),
    "email" character varying(255),
    "avatar_url" "text",
    "role_id" "uuid",
    "department" character varying(100),
    "is_active" boolean DEFAULT true,
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "username" "text",
    "allowed_systems" "text"[] DEFAULT ARRAY['FROZEN'::"text"],
    "permissions" "text"[] DEFAULT '{}'::"text"[],
    "blocked_routes" "text"[],
    "hidden_menus" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."allowed_systems" IS 'Array of system codes this user can access. Special value "ALL" means all systems.';



COMMENT ON COLUMN "public"."user_profiles"."permissions" IS 'Danh sách mã quyền gán trực tiếp cho user.';



COMMENT ON COLUMN "public"."user_profiles"."blocked_routes" IS 'List of route paths that the user is explicitly blocked from accessing';



COMMENT ON COLUMN "public"."user_profiles"."hidden_menus" IS 'Map of system_code -> [hidden_menu_ids]. Example: {"FROZEN": ["Products"], "CHEMICAL": ["Customers"]}';



CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand" character varying(100) NOT NULL,
    "model" character varying(100) NOT NULL,
    "year_from" integer,
    "year_to" integer,
    "engine_type" character varying(100),
    "body_type" character varying(50),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "system_code" "text"
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."warehouses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zone_layouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zone_id" "uuid",
    "position_columns" integer DEFAULT 8,
    "cell_width" integer DEFAULT 120,
    "cell_height" integer DEFAULT 50,
    "child_layout" "text" DEFAULT 'vertical'::"text",
    "child_columns" integer DEFAULT 0,
    "child_width" integer DEFAULT 0,
    "collapsible" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "display_type" "text" DEFAULT 'auto'::"text"
);


ALTER TABLE "public"."zone_layouts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."zone_layouts"."display_type" IS 'How to render this zone: auto, header, section, grid, hidden';



CREATE TABLE IF NOT EXISTS "public"."zone_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "position_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zone_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zone_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "structure" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zone_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "parent_id" "uuid",
    "level" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "system_type" "text" DEFAULT 'FROZEN'::"text"
);


ALTER TABLE "public"."zones" OWNER TO "postgres";


ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_order_items"
    ADD CONSTRAINT "inbound_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_orders"
    ADD CONSTRAINT "inbound_orders_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."inbound_orders"
    ADD CONSTRAINT "inbound_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_warehouse_id_code_key" UNIQUE ("warehouse_id", "code");



ALTER TABLE ONLY "public"."lot_items"
    ADD CONSTRAINT "lot_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lots"
    ADD CONSTRAINT "lots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_types"
    ADD CONSTRAINT "order_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."origins"
    ADD CONSTRAINT "origins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbound_order_items"
    ADD CONSTRAINT "outbound_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbound_orders"
    ADD CONSTRAINT "outbound_orders_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."outbound_orders"
    ADD CONSTRAINT "outbound_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_media"
    ADD CONSTRAINT "product_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_units"
    ADD CONSTRAINT "product_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_units"
    ADD CONSTRAINT "product_units_product_id_unit_id_key" UNIQUE ("product_id", "unit_id");



ALTER TABLE ONLY "public"."product_vehicle_compatibility"
    ADD CONSTRAINT "product_vehicle_compatibility_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_vehicle_compatibility"
    ADD CONSTRAINT "product_vehicle_compatibility_product_id_vehicle_id_key" UNIQUE ("product_id", "vehicle_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qc_info"
    ADD CONSTRAINT "qc_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_configs"
    ADD CONSTRAINT "system_configs_pkey" PRIMARY KEY ("system_code");



ALTER TABLE ONLY "public"."systems"
    ADD CONSTRAINT "systems_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_employee_code_key" UNIQUE ("employee_code");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_brand_model_year_from_year_to_engine_type_key" UNIQUE ("brand", "model", "year_from", "year_to", "engine_type");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_layouts"
    ADD CONSTRAINT "zone_layouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_layouts"
    ADD CONSTRAINT "zone_layouts_zone_id_key" UNIQUE ("zone_id");



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_position_id_key" UNIQUE ("position_id");



ALTER TABLE ONLY "public"."zone_templates"
    ADD CONSTRAINT "zone_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_branches_system_type" ON "public"."branches" USING "btree" ("system_type");



CREATE INDEX "idx_customers_active" ON "public"."customers" USING "btree" ("is_active");



CREATE INDEX "idx_customers_code" ON "public"."customers" USING "btree" ("code");



CREATE INDEX "idx_customers_name" ON "public"."customers" USING "btree" ("name");



CREATE INDEX "idx_customers_system_code" ON "public"."customers" USING "btree" ("system_code");



CREATE INDEX "idx_customers_system_type" ON "public"."customers" USING "btree" ("system_type");



CREATE INDEX "idx_inbound_orders_system_type" ON "public"."inbound_orders" USING "btree" ("system_type");



CREATE INDEX "idx_inbound_orders_type" ON "public"."inbound_orders" USING "btree" ("order_type_id");



CREATE INDEX "idx_locations_code" ON "public"."locations" USING "btree" ("code");



CREATE INDEX "idx_locations_parent" ON "public"."locations" USING "btree" ("parent_id");



CREATE INDEX "idx_locations_type" ON "public"."locations" USING "btree" ("type");



CREATE INDEX "idx_locations_warehouse" ON "public"."locations" USING "btree" ("warehouse_id");



CREATE INDEX "idx_lot_items_lot_id" ON "public"."lot_items" USING "btree" ("lot_id");



CREATE INDEX "idx_lot_items_product_id" ON "public"."lot_items" USING "btree" ("product_id");



CREATE INDEX "idx_lots_product_id" ON "public"."lots" USING "btree" ("product_id");



CREATE INDEX "idx_lots_supplier_id" ON "public"."lots" USING "btree" ("supplier_id");



CREATE UNIQUE INDEX "idx_order_types_code" ON "public"."order_types" USING "btree" ("code");



CREATE INDEX "idx_outbound_orders_system_type" ON "public"."outbound_orders" USING "btree" ("system_type");



CREATE INDEX "idx_outbound_orders_type" ON "public"."outbound_orders" USING "btree" ("order_type_id");



CREATE INDEX "idx_positions_batch_name" ON "public"."positions" USING "btree" ("batch_name");



CREATE INDEX "idx_positions_code" ON "public"."positions" USING "btree" ("code");



CREATE INDEX "idx_positions_lot_id" ON "public"."positions" USING "btree" ("lot_id");



CREATE INDEX "idx_positions_system_type" ON "public"."positions" USING "btree" ("system_type");



CREATE INDEX "idx_product_vehicle_product" ON "public"."product_vehicle_compatibility" USING "btree" ("product_id");



CREATE INDEX "idx_product_vehicle_vehicle" ON "public"."product_vehicle_compatibility" USING "btree" ("vehicle_id");



CREATE INDEX "idx_products_active" ON "public"."products" USING "btree" ("is_active");



CREATE INDEX "idx_products_supplier" ON "public"."products" USING "btree" ("supplier_id");



CREATE INDEX "idx_products_system_code" ON "public"."products" USING "btree" ("system_code");



CREATE INDEX "idx_products_system_type" ON "public"."products" USING "btree" ("system_type");



CREATE UNIQUE INDEX "idx_qc_info_code" ON "public"."qc_info" USING "btree" ("code");



CREATE INDEX "idx_roles_code" ON "public"."roles" USING "btree" ("code");



CREATE INDEX "idx_suppliers_active" ON "public"."suppliers" USING "btree" ("is_active");



CREATE INDEX "idx_suppliers_code" ON "public"."suppliers" USING "btree" ("code");



CREATE INDEX "idx_suppliers_system_code" ON "public"."suppliers" USING "btree" ("system_code");



CREATE INDEX "idx_suppliers_system_type" ON "public"."suppliers" USING "btree" ("system_type");



CREATE INDEX "idx_user_profiles_active" ON "public"."user_profiles" USING "btree" ("is_active");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role_id");



CREATE INDEX "idx_user_profiles_username" ON "public"."user_profiles" USING "btree" ("username");



CREATE INDEX "idx_vehicles_brand" ON "public"."vehicles" USING "btree" ("brand");



CREATE INDEX "idx_vehicles_brand_model" ON "public"."vehicles" USING "btree" ("brand", "model");



CREATE INDEX "idx_vehicles_system_code" ON "public"."vehicles" USING "btree" ("system_code");



CREATE INDEX "idx_zone_layouts_zone_id" ON "public"."zone_layouts" USING "btree" ("zone_id");



CREATE INDEX "idx_zone_positions_position" ON "public"."zone_positions" USING "btree" ("position_id");



CREATE INDEX "idx_zone_positions_zone" ON "public"."zone_positions" USING "btree" ("zone_id");



CREATE INDEX "idx_zones_parent" ON "public"."zones" USING "btree" ("parent_id");



CREATE INDEX "idx_zones_system_type" ON "public"."zones" USING "btree" ("system_type");



CREATE INDEX "product_media_product_id_idx" ON "public"."product_media" USING "btree" ("product_id");



CREATE OR REPLACE TRIGGER "trigger_ensure_single_default_branch" BEFORE INSERT OR UPDATE OF "is_default" ON "public"."branches" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "public"."ensure_single_default_branch"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_system_type_fkey" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "public"."systems"("code");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "fk_branches_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "fk_customers_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."inbound_orders"
    ADD CONSTRAINT "fk_inbound_orders_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."outbound_orders"
    ADD CONSTRAINT "fk_outbound_orders_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "fk_positions_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "fk_products_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "fk_suppliers_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "fk_zones_system_type" FOREIGN KEY ("system_type") REFERENCES "public"."systems"("code") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."inbound_order_items"
    ADD CONSTRAINT "inbound_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."inbound_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_order_items"
    ADD CONSTRAINT "inbound_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_orders"
    ADD CONSTRAINT "inbound_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_orders"
    ADD CONSTRAINT "inbound_orders_order_type_id_fkey" FOREIGN KEY ("order_type_id") REFERENCES "public"."order_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_orders"
    ADD CONSTRAINT "inbound_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lot_items"
    ADD CONSTRAINT "lot_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lot_items"
    ADD CONSTRAINT "lot_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."lots"
    ADD CONSTRAINT "lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."lots"
    ADD CONSTRAINT "lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."order_types"
    ADD CONSTRAINT "order_types_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "public"."systems"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbound_order_items"
    ADD CONSTRAINT "outbound_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."outbound_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbound_order_items"
    ADD CONSTRAINT "outbound_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_orders"
    ADD CONSTRAINT "outbound_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_orders"
    ADD CONSTRAINT "outbound_orders_order_type_id_fkey" FOREIGN KEY ("order_type_id") REFERENCES "public"."order_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id");



ALTER TABLE ONLY "public"."product_media"
    ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_units"
    ADD CONSTRAINT "product_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_units"
    ADD CONSTRAINT "product_units_ref_unit_id_fkey" FOREIGN KEY ("ref_unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."product_units"
    ADD CONSTRAINT "product_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_vehicle_compatibility"
    ADD CONSTRAINT "product_vehicle_compatibility_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_vehicle_compatibility"
    ADD CONSTRAINT "product_vehicle_compatibility_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "public"."systems"("code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qc_info"
    ADD CONSTRAINT "qc_info_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "public"."systems"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "public"."systems"("code");



ALTER TABLE ONLY "public"."system_configs"
    ADD CONSTRAINT "system_configs_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "public"."systems"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_system_code_fkey" FOREIGN KEY ("system_code") REFERENCES "public"."systems"("code");



ALTER TABLE ONLY "public"."zone_layouts"
    ADD CONSTRAINT "zone_layouts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_positions"
    ADD CONSTRAINT "zone_positions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."zones"("id") ON DELETE SET NULL;



CREATE POLICY "Allow all access to branches for authenticated users" ON "public"."branches" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all access to company_settings for authenticated users" ON "public"."company_settings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for positions" ON "public"."positions" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for zone_layouts" ON "public"."zone_layouts" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for zone_positions" ON "public"."zone_positions" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for zones" ON "public"."zones" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can delete" ON "public"."order_types" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete" ON "public"."qc_info" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert" ON "public"."order_types" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert" ON "public"."qc_info" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update" ON "public"."order_types" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update" ON "public"."qc_info" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable access for all users" ON "public"."categories" USING (true) WITH CHECK (true);



CREATE POLICY "Enable access for all users" ON "public"."locations" USING (true) WITH CHECK (true);



CREATE POLICY "Enable access for all users" ON "public"."products" USING (true) WITH CHECK (true);



CREATE POLICY "Enable access for all users" ON "public"."warehouses" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete access for authenticated users" ON "public"."inbound_order_items" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete access for authenticated users" ON "public"."inbound_orders" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete access for authenticated users" ON "public"."outbound_order_items" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete access for authenticated users" ON "public"."outbound_orders" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete access for authenticated users" ON "public"."product_units" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete for all users" ON "public"."lots" FOR DELETE USING (true);



CREATE POLICY "Enable delete for all users" ON "public"."suppliers" FOR DELETE USING (true);



CREATE POLICY "Enable delete for authenticated users only" ON "public"."origins" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable delete for authenticated users only" ON "public"."product_media" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable delete for authenticated users only" ON "public"."units" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."inbound_order_items" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert access for authenticated users" ON "public"."inbound_orders" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert access for authenticated users" ON "public"."outbound_order_items" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert access for authenticated users" ON "public"."outbound_orders" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert access for authenticated users" ON "public"."product_units" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert for all users" ON "public"."lots" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for all users" ON "public"."suppliers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."origins" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."product_media" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."units" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert/update for authenticated users" ON "public"."company_settings" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable public read access" ON "public"."company_settings" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."company_settings" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."inbound_order_items" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."inbound_orders" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."lots" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."origins" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."outbound_order_items" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."outbound_orders" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."permissions" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."product_media" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."suppliers" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."units" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."product_units" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update access for authenticated users" ON "public"."inbound_order_items" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update access for authenticated users" ON "public"."inbound_orders" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update access for authenticated users" ON "public"."outbound_order_items" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update access for authenticated users" ON "public"."outbound_orders" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update access for authenticated users" ON "public"."product_units" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update for all users" ON "public"."lots" FOR UPDATE USING (true);



CREATE POLICY "Enable update for all users" ON "public"."suppliers" FOR UPDATE USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."origins" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."product_media" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update for authenticated users only" ON "public"."units" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable write access for admins only" ON "public"."permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
           FROM "public"."roles"
          WHERE (("roles"."id" = "user_profiles"."role_id") AND (("roles"."code")::"text" = 'ADMIN'::"text"))))))));



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."order_types" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."qc_info" FOR SELECT USING (true);



CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."origins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbound_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbound_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qc_info" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."warehouses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zone_layouts" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."ensure_single_default_branch"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_branch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_branch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_order_items" TO "anon";
GRANT ALL ON TABLE "public"."inbound_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_orders" TO "anon";
GRANT ALL ON TABLE "public"."inbound_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_orders" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."lot_items" TO "anon";
GRANT ALL ON TABLE "public"."lot_items" TO "authenticated";
GRANT ALL ON TABLE "public"."lot_items" TO "service_role";



GRANT ALL ON TABLE "public"."lots" TO "anon";
GRANT ALL ON TABLE "public"."lots" TO "authenticated";
GRANT ALL ON TABLE "public"."lots" TO "service_role";



GRANT ALL ON TABLE "public"."order_types" TO "anon";
GRANT ALL ON TABLE "public"."order_types" TO "authenticated";
GRANT ALL ON TABLE "public"."order_types" TO "service_role";



GRANT ALL ON TABLE "public"."origins" TO "anon";
GRANT ALL ON TABLE "public"."origins" TO "authenticated";
GRANT ALL ON TABLE "public"."origins" TO "service_role";



GRANT ALL ON TABLE "public"."outbound_order_items" TO "anon";
GRANT ALL ON TABLE "public"."outbound_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."outbound_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."outbound_orders" TO "anon";
GRANT ALL ON TABLE "public"."outbound_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."outbound_orders" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."product_media" TO "anon";
GRANT ALL ON TABLE "public"."product_media" TO "authenticated";
GRANT ALL ON TABLE "public"."product_media" TO "service_role";



GRANT ALL ON TABLE "public"."product_units" TO "anon";
GRANT ALL ON TABLE "public"."product_units" TO "authenticated";
GRANT ALL ON TABLE "public"."product_units" TO "service_role";



GRANT ALL ON TABLE "public"."product_vehicle_compatibility" TO "anon";
GRANT ALL ON TABLE "public"."product_vehicle_compatibility" TO "authenticated";
GRANT ALL ON TABLE "public"."product_vehicle_compatibility" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."qc_info" TO "anon";
GRANT ALL ON TABLE "public"."qc_info" TO "authenticated";
GRANT ALL ON TABLE "public"."qc_info" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."system_configs" TO "anon";
GRANT ALL ON TABLE "public"."system_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_configs" TO "service_role";



GRANT ALL ON TABLE "public"."systems" TO "anon";
GRANT ALL ON TABLE "public"."systems" TO "authenticated";
GRANT ALL ON TABLE "public"."systems" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."warehouses" TO "anon";
GRANT ALL ON TABLE "public"."warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouses" TO "service_role";



GRANT ALL ON TABLE "public"."zone_layouts" TO "anon";
GRANT ALL ON TABLE "public"."zone_layouts" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_layouts" TO "service_role";



GRANT ALL ON TABLE "public"."zone_positions" TO "anon";
GRANT ALL ON TABLE "public"."zone_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_positions" TO "service_role";



GRANT ALL ON TABLE "public"."zone_templates" TO "anon";
GRANT ALL ON TABLE "public"."zone_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_templates" TO "service_role";



GRANT ALL ON TABLE "public"."zones" TO "anon";
GRANT ALL ON TABLE "public"."zones" TO "authenticated";
GRANT ALL ON TABLE "public"."zones" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































