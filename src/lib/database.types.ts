export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          phone: string | null
          system_type: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          phone?: string | null
          system_type?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          phone?: string | null
          system_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_branches_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          system_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          system_type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          system_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_system_type_fkey"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          short_name: string | null
          tax_code: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          short_name?: string | null
          tax_code?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          short_name?: string | null
          tax_code?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          code: string
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          system_code: string | null
          system_type: string | null
          tax_code: string | null
        }
        Insert: {
          address?: string | null
          code: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          system_code?: string | null
          system_type?: string | null
          tax_code?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          system_code?: string | null
          system_type?: string | null
          tax_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_customers_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      inbound_order_items: {
        Row: {
          created_at: string
          document_quantity: number | null
          id: string
          note: string | null
          order_id: string | null
          price: number | null
          product_id: string | null
          product_name: string | null
          quantity: number
          total_amount: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          document_quantity?: number | null
          id?: string
          note?: string | null
          order_id?: string | null
          price?: number | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total_amount?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          document_quantity?: number | null
          id?: string
          note?: string | null
          order_id?: string | null
          price?: number | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total_amount?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "inbound_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_orders: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          images: Json | null
          metadata: Json | null
          order_type_id: string | null
          status: string | null
          supplier_address: string | null
          supplier_id: string | null
          supplier_phone: string | null
          system_code: string | null
          system_type: string | null
          type: string | null
          updated_at: string
          warehouse_name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          metadata?: Json | null
          order_type_id?: string | null
          status?: string | null
          supplier_address?: string | null
          supplier_id?: string | null
          supplier_phone?: string | null
          system_code?: string | null
          system_type?: string | null
          type?: string | null
          updated_at?: string
          warehouse_name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          metadata?: Json | null
          order_type_id?: string | null
          status?: string | null
          supplier_address?: string | null
          supplier_id?: string | null
          supplier_phone?: string | null
          system_code?: string | null
          system_type?: string | null
          type?: string | null
          updated_at?: string
          warehouse_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inbound_orders_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "inbound_orders_order_type_id_fkey"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "order_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          capacity: number | null
          code: string
          created_at: string | null
          current_quantity: number | null
          id: string
          name: string | null
          notes: string | null
          parent_id: string | null
          type: string | null
          warehouse_id: string | null
        }
        Insert: {
          capacity?: number | null
          code: string
          created_at?: string | null
          current_quantity?: number | null
          id?: string
          name?: string | null
          notes?: string | null
          parent_id?: string | null
          type?: string | null
          warehouse_id?: string | null
        }
        Update: {
          capacity?: number | null
          code?: string
          created_at?: string | null
          current_quantity?: number | null
          id?: string
          name?: string | null
          notes?: string | null
          parent_id?: string | null
          type?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_items: {
        Row: {
          created_at: string
          id: string
          lot_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "lot_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          batch_code: string | null
          code: string
          created_at: string
          id: string
          inbound_date: string | null
          notes: string | null
          packaging_date: string | null
          peeling_date: string | null
          product_id: string | null
          qc_id: string | null
          quantity: number | null
          status: string | null
          supplier_id: string | null
          warehouse_name: string | null
        }
        Insert: {
          batch_code?: string | null
          code: string
          created_at?: string
          id?: string
          inbound_date?: string | null
          notes?: string | null
          packaging_date?: string | null
          peeling_date?: string | null
          product_id?: string | null
          qc_id?: string | null
          quantity?: number | null
          status?: string | null
          supplier_id?: string | null
          warehouse_name?: string | null
        }
        Update: {
          batch_code?: string | null
          code?: string
          created_at?: string
          id?: string
          inbound_date?: string | null
          notes?: string | null
          packaging_date?: string | null
          product_id?: string | null
          qc_id?: string | null
          quantity?: number | null
          status?: string | null
          supplier_id?: string | null
          warehouse_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_qc_id_fkey"
            columns: ["qc_id"]
            isOneToOne: false
            referencedRelation: "qc_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          scope: string
          system_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          scope: string
          system_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          scope?: string
          system_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_types_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      origins: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      outbound_order_items: {
        Row: {
          created_at: string
          document_quantity: number | null
          id: string
          note: string | null
          order_id: string | null
          price: number | null
          product_id: string | null
          product_name: string | null
          quantity: number
          total_amount: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          document_quantity?: number | null
          id?: string
          note?: string | null
          order_id?: string | null
          price?: number | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total_amount?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          document_quantity?: number | null
          id?: string
          note?: string | null
          order_id?: string | null
          price?: number | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total_amount?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "outbound_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_orders: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          id: string
          image_url: string | null
          images: Json | null
          metadata: Json | null
          order_type_id: string | null
          status: string | null
          system_code: string | null
          system_type: string | null
          type: string | null
          updated_at: string
          warehouse_name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          metadata?: Json | null
          order_type_id?: string | null
          status?: string | null
          system_code?: string | null
          system_type?: string | null
          type?: string | null
          updated_at?: string
          warehouse_name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          metadata?: Json | null
          order_type_id?: string | null
          status?: string | null
          system_code?: string | null
          system_type?: string | null
          type?: string | null
          updated_at?: string
          warehouse_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_outbound_orders_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "outbound_orders_order_type_id_fkey"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "order_types"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          batch_name: string | null
          code: string
          created_at: string | null
          display_order: number | null
          id: string
          lot_id: string | null
          system_type: string | null
        }
        Insert: {
          batch_name?: string | null
          code: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          lot_id?: string | null
          system_type?: string | null
        }
        Update: {
          batch_name?: string | null
          code?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          lot_id?: string | null
          system_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_positions_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "positions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          product_id: string
          sort_order: number | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number | null
          type: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          conversion_rate: number
          created_at: string
          id: string
          product_id: string
          ref_unit_id: string | null
          unit_id: string
        }
        Insert: {
          conversion_rate?: number
          created_at?: string
          id?: string
          product_id: string
          ref_unit_id?: string | null
          unit_id: string
        }
        Update: {
          conversion_rate?: number
          created_at?: string
          id?: string
          product_id?: string
          ref_unit_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_ref_unit_id_fkey"
            columns: ["ref_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      product_vehicle_compatibility: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          product_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_vehicle_compatibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_vehicle_compatibility_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          compatible_models: string[] | null
          cost_price: number | null
          created_at: string | null
          cross_reference_numbers: string[] | null
          description: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_returnable: boolean | null
          lead_time_days: number | null
          manufacturer: string | null
          min_stock_level: number | null
          name: string
          oem_number: string | null
          origin_country: string | null
          packaging_specification: string | null
          part_number: string | null
          price: number | null
          quality_grade: string | null
          retail_price: number | null
          sku: string
          specifications: Json | null
          supplier_id: string | null
          system_code: string | null
          system_type: string | null
          unit: string | null
          updated_at: string | null
          warranty_months: number | null
          weight_kg: number | null
          wholesale_price: number | null
        }
        Insert: {
          category_id?: string | null
          compatible_models?: string[] | null
          cost_price?: number | null
          created_at?: string | null
          cross_reference_numbers?: string[] | null
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_returnable?: boolean | null
          lead_time_days?: number | null
          manufacturer?: string | null
          min_stock_level?: number | null
          name: string
          oem_number?: string | null
          origin_country?: string | null
          packaging_specification?: string | null
          part_number?: string | null
          price?: number | null
          quality_grade?: string | null
          retail_price?: number | null
          sku: string
          specifications?: Json | null
          supplier_id?: string | null
          system_code?: string | null
          system_type?: string | null
          unit?: string | null
          updated_at?: string | null
          warranty_months?: number | null
          weight_kg?: number | null
          wholesale_price?: number | null
        }
        Update: {
          category_id?: string | null
          compatible_models?: string[] | null
          cost_price?: number | null
          created_at?: string | null
          cross_reference_numbers?: string[] | null
          description?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_returnable?: boolean | null
          lead_time_days?: number | null
          manufacturer?: string | null
          min_stock_level?: number | null
          name?: string
          oem_number?: string | null
          origin_country?: string | null
          packaging_specification?: string | null
          part_number?: string | null
          price?: number | null
          quality_grade?: string | null
          retail_price?: number | null
          sku?: string
          specifications?: Json | null
          supplier_id?: string | null
          system_code?: string | null
          system_type?: string | null
          unit?: string | null
          updated_at?: string | null
          warranty_months?: number | null
          weight_kg?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      qc_info: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          system_code: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          system_code?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          system_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_info_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          permissions: Json | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          code: string
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          system_code: string | null
          system_type: string | null
          tax_code: string | null
        }
        Insert: {
          address?: string | null
          code: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          system_code?: string | null
          system_type?: string | null
          tax_code?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          system_code?: string | null
          system_type?: string | null
          tax_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_suppliers_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "suppliers_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }

      systems: {
        Row: {
          bg_color_class: string | null
          code: string
          created_at: string | null
          description: string | null
          icon: string | null
          is_active: boolean | null
          modules: Json | null
          name: string
          sort_order: number | null
          text_color_class: string | null
        }
        Insert: {
          bg_color_class?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          is_active?: boolean | null
          modules?: Json | null
          name: string
          sort_order?: number | null
          text_color_class?: string | null
        }
        Update: {
          bg_color_class?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          is_active?: boolean | null
          modules?: Json | null
          name?: string
          sort_order?: number | null
          text_color_class?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          allowed_systems: string[] | null
          avatar_url: string | null
          blocked_routes: string[] | null
          created_at: string | null
          department: string | null
          email: string | null
          employee_code: string | null
          full_name: string
          hidden_menus: Json | null
          id: string
          is_active: boolean | null
          last_login: string | null
          permissions: string[] | null
          phone: string | null
          role_id: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          allowed_systems?: string[] | null
          avatar_url?: string | null
          blocked_routes?: string[] | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          full_name: string
          hidden_menus?: Json | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          permissions?: string[] | null
          phone?: string | null
          role_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          allowed_systems?: string[] | null
          avatar_url?: string | null
          blocked_routes?: string[] | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string
          hidden_menus?: Json | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          permissions?: string[] | null
          phone?: string | null
          role_id?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configs: {
        Row: {
          created_at: string | null
          id: string
          inbound_modules: string[] | null // or Json
          lot_modules: string[] | null // or Json
          outbound_modules: string[] | null // or Json
          system_code: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inbound_modules?: string[] | null
          lot_modules?: string[] | null
          outbound_modules?: string[] | null
          system_code: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inbound_modules?: string[] | null
          lot_modules?: string[] | null
          outbound_modules?: string[] | null
          system_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_configs_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: true // Likely 1-1
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      vehicles: {
        Row: {
          body_type: string | null
          brand: string
          created_at: string | null
          engine_type: string | null
          id: string
          model: string
          notes: string | null
          system_code: string | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          body_type?: string | null
          brand: string
          created_at?: string | null
          engine_type?: string | null
          id?: string
          model: string
          notes?: string | null
          system_code?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          body_type?: string | null
          brand?: string
          created_at?: string | null
          engine_type?: string | null
          id?: string
          model?: string
          notes?: string | null
          system_code?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_system_code_fkey"
            columns: ["system_code"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          code: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      zone_layouts: {
        Row: {
          cell_height: number | null
          cell_width: number | null
          child_columns: number | null
          child_layout: string | null
          child_width: number | null
          collapsible: boolean | null
          created_at: string | null
          display_type: string | null
          id: string
          position_columns: number | null
          updated_at: string | null
          zone_id: string | null
        }
        Insert: {
          cell_height?: number | null
          cell_width?: number | null
          child_columns?: number | null
          child_layout?: string | null
          child_width?: number | null
          collapsible?: boolean | null
          created_at?: string | null
          display_type?: string | null
          id?: string
          position_columns?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Update: {
          cell_height?: number | null
          cell_width?: number | null
          child_columns?: number | null
          child_layout?: string | null
          child_width?: number | null
          collapsible?: boolean | null
          created_at?: string | null
          display_type?: string | null
          id?: string
          position_columns?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_layouts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: true
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_positions: {
        Row: {
          created_at: string | null
          id: string
          position_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          position_id: string
          zone_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          position_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: true
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_positions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_templates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          structure: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          structure: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          structure?: Json
        }
        Relationships: []
      }
      zones: {
        Row: {
          code: string
          created_at: string | null
          id: string
          level: number | null
          name: string
          parent_id: string | null
          system_type: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          level?: number | null
          name: string
          parent_id?: string | null
          system_type?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          level?: number | null
          name?: string
          parent_id?: string | null
          system_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_zones_system_type"
            columns: ["system_type"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "zones_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_tags: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          lot_id: string
          tag: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          lot_id: string
          tag: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          lot_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_tags_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      master_tags: {
        Row: {
          created_at: string
          created_by: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
