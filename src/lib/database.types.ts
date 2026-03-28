export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      lots: {
        Row: {
          id: string
          code: string
          notes: string | null
          status: string | null
          product_id: string | null
          supplier_id: string | null
          inbound_date: string | null
          batch_code: string | null
          quantity: number | null
          created_at: string
          peeling_date: string | null
          daily_seq: number | null
          system_code: string | null
        }
        Insert: {
          id?: string
          code: string
          notes?: string | null
          status?: string | null
          product_id?: string | null
          supplier_id?: string | null
          inbound_date?: string | null
          batch_code?: string | null
          quantity?: number | null
          created_at?: string
          peeling_date?: string | null
          daily_seq?: number | null
          system_code?: string | null
        }
        Update: {
          id?: string
          code?: string
          notes?: string | null
          status?: string | null
          product_id?: string | null
          supplier_id?: string | null
          inbound_date?: string | null
          batch_code?: string | null
          quantity?: number | null
          created_at?: string
          peeling_date?: string | null
          daily_seq?: number | null
          system_code?: string | null
        }
      }
      positions: {
        Row: {
          id: string
          code: string
          display_order: number | null
          created_at: string | null
          batch_name: string | null
          lot_id: string | null
          system_type: string | null
          company_id: string | null
        }
        Insert: {
          id?: string
          code: string
          display_order?: number | null
          created_at?: string | null
          batch_name?: string | null
          lot_id?: string | null
          system_type?: string | null
          company_id?: string | null
        }
        Update: {
          id?: string
          code?: string
          display_order?: number | null
          created_at?: string | null
          batch_name?: string | null
          lot_id?: string | null
          system_type?: string | null
          company_id?: string | null
        }
      }
      zones: {
        Row: {
          id: string
          code: string
          name: string
          parent_id: string | null
          level: number | null
          created_at: string | null
          system_type: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          parent_id?: string | null
          level?: number | null
          created_at?: string | null
          system_type?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          parent_id?: string | null
          level?: number | null
          created_at?: string | null
          system_type?: string | null
        }
      }
      zone_positions: {
        Row: {
          id: string
          position_id: string
          zone_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          position_id: string
          zone_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          position_id?: string
          zone_id?: string
          created_at?: string | null
        }
      }
      pending_assignments: {
        Row: {
          id: string
          position_id: string | null
          lot_stt: number | null
          production_date: string | null
          system_code: string | null
          status: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          position_id?: string | null
          lot_stt?: number | null
          production_date?: string | null
          system_code?: string | null
          status?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          position_id?: string | null
          lot_stt?: number | null
          production_date?: string | null
          system_code?: string | null
          status?: string | null
          created_at?: string
          created_by?: string | null
        }
      }
      lot_items: {
        Row: {
          id: string
          created_at: string
          lot_id: string
          product_id: string
          quantity: number
          unit: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          lot_id: string
          product_id: string
          quantity?: number
          unit?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          lot_id?: string
          product_id?: string
          quantity?: number
          unit?: string | null
        }
      }
      products: {
        Row: {
          id: string
          sku: string
          name: string
          category_id: string | null
          unit: string | null
          image_url: string | null
          created_at: string | null
          system_code: string | null
        }
        Insert: {
          id?: string
          sku: string
          name: string
          category_id?: string | null
          unit?: string | null
          image_url?: string | null
          created_at?: string | null
          system_code?: string | null
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          category_id?: string | null
          unit?: string | null
          image_url?: string | null
          created_at?: string | null
          system_code?: string | null
        }
      }
      // Add other tables as needed to satisfy imports
      user_profiles: { Row: { id: string; email: string | null; full_name: string; role_id: string | null; company_id: string | null } }
      companies: { Row: { id: string; code: string; name: string } }
      branches: { Row: { id: string; code: string; name: string; system_type: string } }
      audit_logs: { Row: { id: string; created_at: string; action: string; table_name: string; record_id: string } }
    }
    Views: {
      [_ in string]: {
        Row: Record<string, unknown>
      }
    }
    Functions: {
      [_ in string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: {
      [_ in string]: string
    }
    CompositeTypes: {
      [_ in string]: unknown
    }
  }
}
