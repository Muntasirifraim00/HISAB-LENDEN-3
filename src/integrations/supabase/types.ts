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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      advance_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["hb_payment_method"]
          note: string | null
          paid_on: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["hb_payment_method"]
          note?: string | null
          paid_on: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["hb_payment_method"]
          note?: string | null
          paid_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          bank_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      bank_statements: {
        Row: {
          amount: number
          balance: number | null
          bank_account_id: string
          created_at: string
          created_by: string | null
          created_by_name: string
          description: string | null
          id: string
          is_reconciled: boolean
          matched_invoice_id: string | null
          statement_date: string
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          balance?: number | null
          bank_account_id: string
          created_at?: string
          created_by?: string | null
          created_by_name: string
          description?: string | null
          id?: string
          is_reconciled?: boolean
          matched_invoice_id?: string | null
          statement_date: string
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          balance?: number | null
          bank_account_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          description?: string | null
          id?: string
          is_reconciled?: boolean
          matched_invoice_id?: string | null
          statement_date?: string
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "vw_bank_account_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      business_capital: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          current_balance: number
          id: string
          opening_balance: number
          total_investment: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name: string
          current_balance?: number
          id?: string
          opening_balance?: number
          total_investment?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          current_balance?: number
          id?: string
          opening_balance?: number
          total_investment?: number
          updated_at?: string
        }
        Relationships: []
      }
      capital_injections: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          injected_on: string
          note: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          injected_on: string
          note?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          injected_on?: string
          note?: string | null
        }
        Relationships: []
      }
      customer_alerts: {
        Row: {
          alert_type: string
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string
          days_overdue: number
          email_notify: boolean
          id: string
          is_active: boolean
          sms_notify: boolean
        }
        Insert: {
          alert_type?: string
          created_at?: string
          created_by?: string | null
          created_by_name: string
          customer_id: string
          days_overdue?: number
          email_notify?: boolean
          id?: string
          is_active?: boolean
          sms_notify?: boolean
        }
        Update: {
          alert_type?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          customer_id?: string
          days_overdue?: number
          email_notify?: boolean
          id?: string
          is_active?: boolean
          sms_notify?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_sales_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_deposits: {
        Row: {
          amount: number
          balance: number
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string
          deposit_date: string
          description: string | null
          id: string
          payment_method: string
        }
        Insert: {
          amount: number
          balance?: number
          created_at?: string
          created_by?: string | null
          created_by_name: string
          customer_id: string
          deposit_date: string
          description?: string | null
          id?: string
          payment_method?: string
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          customer_id?: string
          deposit_date?: string
          description?: string | null
          id?: string
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_sales_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          credit_limit: number
          customer_type: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name: string
          credit_limit?: number
          customer_type?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          credit_limit?: number
          customer_type?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deposit_usage: {
        Row: {
          amount_used: number
          created_at: string
          created_by: string | null
          created_by_name: string
          deposit_id: string
          id: string
          invoice_id: string
          used_date: string
        }
        Insert: {
          amount_used: number
          created_at?: string
          created_by?: string | null
          created_by_name: string
          deposit_id: string
          id?: string
          invoice_id: string
          used_date: string
        }
        Update: {
          amount_used?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          deposit_id?: string
          id?: string
          invoice_id?: string
          used_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_usage_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "customer_deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_usage_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_usage_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_usage_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_usage_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_detail_edits: {
        Row: {
          created_at: string
          edited_by: string | null
          edited_by_name: string
          id: string
          invoice_id: string
          new_details: string | null
          old_details: string | null
          revision_no: number
        }
        Insert: {
          created_at?: string
          edited_by?: string | null
          edited_by_name: string
          id?: string
          invoice_id: string
          new_details?: string | null
          old_details?: string | null
          revision_no: number
        }
        Update: {
          created_at?: string
          edited_by?: string | null
          edited_by_name?: string
          id?: string
          invoice_id?: string
          new_details?: string | null
          old_details?: string | null
          revision_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_detail_edits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_detail_edits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_detail_edits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_detail_edits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_expenses: {
        Row: {
          amount: number
          created_at: string
          head: string
          id: string
          invoice_id: string
          note: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          head: string
          id?: string
          invoice_id: string
          note?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          head?: string
          id?: string
          invoice_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          cost_price: number | null
          created_at: string
          id: string
          invoice_id: string
          line_cogs: number
          line_total: number
          product_id: string | null
          product_name: string
          qty: number
          received_qty: number
          unit: string
          unit_price: number
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          id?: string
          invoice_id: string
          line_cogs?: number
          line_total?: number
          product_id?: string | null
          product_name: string
          qty: number
          received_qty?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          id?: string
          invoice_id?: string
          line_cogs?: number
          line_total?: number
          product_id?: string | null
          product_name?: string
          qty?: number
          received_qty?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hb_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_product_sales_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_valuation_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_warehouse_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["hb_payment_method"]
          note: string | null
          paid_on: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["hb_payment_method"]
          note?: string | null
          paid_on: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["hb_payment_method"]
          note?: string | null
          paid_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_receipts: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          invoice_id: string
          lines: Json
          note: string | null
          received_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          invoice_id: string
          lines?: Json
          note?: string | null
          received_on: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          invoice_id?: string
          lines?: Json
          note?: string | null
          received_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cogs: number
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string | null
          detail_revision: number
          details: string | null
          due_amount: number | null
          goods_status: Database["public"]["Enums"]["hb_goods_status"]
          id: string
          image_url: string | null
          invoice_date: string
          is_reversal: boolean
          memo_no: string | null
          no_image_reason: string | null
          paid_amount: number
          party_name: string | null
          payment_method: Database["public"]["Enums"]["hb_payment_method"]
          profit: number
          reversed_at: string | null
          reverses_invoice_id: string | null
          stock_shortfall: boolean
          supplier_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id: string | null
        }
        Insert: {
          cogs?: number
          created_at?: string
          created_by?: string | null
          created_by_name: string
          customer_id?: string | null
          detail_revision?: number
          details?: string | null
          due_amount?: number | null
          goods_status?: Database["public"]["Enums"]["hb_goods_status"]
          id?: string
          image_url?: string | null
          invoice_date: string
          is_reversal?: boolean
          memo_no?: string | null
          no_image_reason?: string | null
          paid_amount?: number
          party_name?: string | null
          payment_method?: Database["public"]["Enums"]["hb_payment_method"]
          profit?: number
          reversed_at?: string | null
          reverses_invoice_id?: string | null
          stock_shortfall?: boolean
          supplier_id?: string | null
          total_amount: number
          type: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id?: string | null
        }
        Update: {
          cogs?: number
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          customer_id?: string | null
          detail_revision?: number
          details?: string | null
          due_amount?: number | null
          goods_status?: Database["public"]["Enums"]["hb_goods_status"]
          id?: string
          image_url?: string | null
          invoice_date?: string
          is_reversal?: boolean
          memo_no?: string | null
          no_image_reason?: string | null
          paid_amount?: number
          party_name?: string | null
          payment_method?: Database["public"]["Enums"]["hb_payment_method"]
          profit?: number
          reversed_at?: string | null
          reverses_invoice_id?: string | null
          stock_shortfall?: boolean
          supplier_id?: string | null
          total_amount?: number
          type?: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_alerts: {
        Row: {
          alert_type: string
          created_at: string
          created_by: string | null
          created_by_name: string
          email_notify: boolean
          id: string
          in_app_notify: boolean
          is_active: boolean
          product_id: string
          sms_notify: boolean
          threshold: number | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          created_by?: string | null
          created_by_name: string
          email_notify?: boolean
          id?: string
          in_app_notify?: boolean
          is_active?: boolean
          product_id: string
          sms_notify?: boolean
          threshold?: number | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          email_notify?: boolean
          id?: string
          in_app_notify?: boolean
          is_active?: boolean
          product_id?: string
          sms_notify?: boolean
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hb_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_product_sales_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_valuation_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_warehouse_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_discounts: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          is_active: boolean
          min_quantity: number | null
          notes: string | null
          product_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name: string
          discount_type?: string
          discount_value: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number | null
          notes?: string | null
          product_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number | null
          notes?: string | null
          product_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hb_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_product_sales_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_valuation_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_discounts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_warehouse_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_serials: {
        Row: {
          batch_number: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          invoice_item_id: string
          manufacturer: string | null
          notes: string | null
          product_id: string
          serial_number: string
          status: string
          updated_at: string
          warranty_date: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          invoice_item_id: string
          manufacturer?: string | null
          notes?: string | null
          product_id: string
          serial_number: string
          status?: string
          updated_at?: string
          warranty_date?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          invoice_item_id?: string
          manufacturer?: string | null
          notes?: string | null
          product_id?: string
          serial_number?: string
          status?: string
          updated_at?: string
          warranty_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_serials_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hb_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_product_sales_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_valuation_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_warehouse_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          sale_price: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          sale_price?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          sale_price?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_search_filters: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          filter_config: Json
          id: string
          is_favorite: boolean
          last_used_at: string | null
          name: string
          search_type: string
          updated_at: string
          use_count: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name: string
          filter_config: Json
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          name: string
          search_type: string
          updated_at?: string
          use_count?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          filter_config?: Json
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          name?: string
          search_type?: string
          updated_at?: string
          use_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      search_history: {
        Row: {
          executed_at: string
          id: string
          result_count: number | null
          search_filters: Json | null
          search_query: string
          search_type: string
          user_id: string | null
        }
        Insert: {
          executed_at?: string
          id?: string
          result_count?: number | null
          search_filters?: Json | null
          search_query: string
          search_type: string
          user_id?: string | null
        }
        Update: {
          executed_at?: string
          id?: string
          result_count?: number | null
          search_filters?: Json | null
          search_query?: string
          search_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      stock_lots: {
        Row: {
          created_at: string
          id: string
          invoice_id: string | null
          lot_date: string
          product_id: string
          qty_in: number
          qty_remaining: number
          reason: Database["public"]["Enums"]["hb_stock_reason"]
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          lot_date: string
          product_id: string
          qty_in: number
          qty_remaining: number
          reason: Database["public"]["Enums"]["hb_stock_reason"]
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          lot_date?: string
          product_id?: string
          qty_in?: number
          qty_remaining?: number
          reason?: Database["public"]["Enums"]["hb_stock_reason"]
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_lots_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hb_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_product_sales_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_valuation_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_warehouse_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      stock_moves: {
        Row: {
          created_at: string
          created_by_name: string
          id: string
          invoice_id: string | null
          moved_on: string
          note: string | null
          product_id: string
          qty: number
          reason: Database["public"]["Enums"]["hb_stock_reason"]
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by_name: string
          id?: string
          invoice_id?: string | null
          moved_on: string
          note?: string | null
          product_id: string
          qty: number
          reason: Database["public"]["Enums"]["hb_stock_reason"]
          unit_cost?: number
        }
        Update: {
          created_at?: string
          created_by_name?: string
          id?: string
          invoice_id?: string | null
          moved_on?: string
          note?: string | null
          product_id?: string
          qty?: number
          reason?: Database["public"]["Enums"]["hb_stock_reason"]
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_moves_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "hb_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_product_sales_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_valuation_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_warehouse_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_account: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          payment_terms: string | null
          phone: string | null
          supplier_type: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          payment_terms?: string | null
          phone?: string | null
          supplier_type?: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          payment_terms?: string | null
          phone?: string | null
          supplier_type?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      hb_live_invoices: {
        Row: {
          cogs: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          detail_revision: number | null
          details: string | null
          due_amount: number | null
          goods_status: Database["public"]["Enums"]["hb_goods_status"] | null
          id: string | null
          image_url: string | null
          invoice_date: string | null
          is_reversal: boolean | null
          memo_no: string | null
          no_image_reason: string | null
          paid_amount: number | null
          party_name: string | null
          payment_method:
            | Database["public"]["Enums"]["hb_payment_method"]
            | null
          profit: number | null
          reversed_at: string | null
          reverses_invoice_id: string | null
          stock_shortfall: boolean | null
          total_amount: number | null
          type: Database["public"]["Enums"]["hb_invoice_type"] | null
        }
        Insert: {
          cogs?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          detail_revision?: number | null
          details?: string | null
          due_amount?: number | null
          goods_status?: Database["public"]["Enums"]["hb_goods_status"] | null
          id?: string | null
          image_url?: string | null
          invoice_date?: string | null
          is_reversal?: boolean | null
          memo_no?: string | null
          no_image_reason?: string | null
          paid_amount?: number | null
          party_name?: string | null
          payment_method?:
            | Database["public"]["Enums"]["hb_payment_method"]
            | null
          profit?: number | null
          reversed_at?: string | null
          reverses_invoice_id?: string | null
          stock_shortfall?: boolean | null
          total_amount?: number | null
          type?: Database["public"]["Enums"]["hb_invoice_type"] | null
        }
        Update: {
          cogs?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          detail_revision?: number | null
          details?: string | null
          due_amount?: number | null
          goods_status?: Database["public"]["Enums"]["hb_goods_status"] | null
          id?: string | null
          image_url?: string | null
          invoice_date?: string | null
          is_reversal?: boolean | null
          memo_no?: string | null
          no_image_reason?: string | null
          paid_amount?: number | null
          party_name?: string | null
          payment_method?:
            | Database["public"]["Enums"]["hb_payment_method"]
            | null
          profit?: number | null
          reversed_at?: string | null
          reverses_invoice_id?: string | null
          stock_shortfall?: boolean | null
          total_amount?: number | null
          type?: Database["public"]["Enums"]["hb_invoice_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "hb_live_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_statement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reverses_invoice_id_fkey"
            columns: ["reverses_invoice_id"]
            isOneToOne: false
            referencedRelation: "vw_supplier_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      hb_party_summary: {
        Row: {
          entry_count: number | null
          last_entry_date: string | null
          party_name: string | null
          payable: number | null
          receivable: number | null
          total_purchases: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      hb_stock_summary: {
        Row: {
          category_name: string | null
          cost_price: number | null
          is_active: boolean | null
          low_stock_threshold: number | null
          product_id: string | null
          product_name: string | null
          qty_on_hand: number | null
          stock_state: string | null
          stock_value: number | null
          unit: string | null
        }
        Relationships: []
      }
      vw_bank_account_balance: {
        Row: {
          account_type: string | null
          current_balance: number | null
          id: string | null
          last_statement_date: string | null
          name: string | null
          opening_balance: number | null
          total_transactions: number | null
          unreconciled_count: number | null
        }
        Relationships: []
      }
      vw_business_overview: {
        Row: {
          net_profit: number | null
          total_cogs: number | null
          total_expense_amount: number | null
          total_expense_count: number | null
          total_profit: number | null
          total_purchase_amount: number | null
          total_purchase_count: number | null
          total_purchase_due: number | null
          total_purchase_paid: number | null
          total_sales_amount: number | null
          total_sales_count: number | null
          total_sales_due: number | null
          total_sales_paid: number | null
          unique_customers: number | null
          unique_suppliers: number | null
        }
        Relationships: []
      }
      vw_business_summary: {
        Row: {
          current_balance: number | null
          opening_balance: number | null
          pending_invoices: number | null
          total_due: number | null
          total_expenses: number | null
          total_investment: number | null
          total_profit: number | null
          total_purchases: number | null
          total_sales: number | null
        }
        Insert: {
          current_balance?: number | null
          opening_balance?: number | null
          pending_invoices?: never
          total_due?: never
          total_expenses?: never
          total_investment?: number | null
          total_profit?: never
          total_purchases?: never
          total_sales?: never
        }
        Update: {
          current_balance?: number | null
          opening_balance?: number | null
          pending_invoices?: never
          total_due?: never
          total_expenses?: never
          total_investment?: number | null
          total_profit?: never
          total_purchases?: never
          total_sales?: never
        }
        Relationships: []
      }
      vw_customer_deposit_summary: {
        Row: {
          current_balance: number | null
          customer_id: string | null
          customer_name: string | null
          total_deposited: number | null
          total_used: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_sales_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "vw_customer_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_customer_sales_analysis: {
        Row: {
          avg_transaction_amount: number | null
          credit_limit: number | null
          current_due: number | null
          customer_name: string | null
          customer_type: string | null
          days_since_last_purchase: number | null
          id: string | null
          last_purchase_date: string | null
          total_paid_amount: number | null
          total_purchase_amount: number | null
          total_transactions: number | null
        }
        Relationships: []
      }
      vw_customer_statement: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          details: string | null
          due_amount: number | null
          id: string | null
          invoice_date: string | null
          memo_no: string | null
          paid_amount: number | null
          payment_method:
            | Database["public"]["Enums"]["hb_payment_method"]
            | null
          total_amount: number | null
          type: Database["public"]["Enums"]["hb_invoice_type"] | null
        }
        Relationships: []
      }
      vw_customer_summary: {
        Row: {
          credit_limit: number | null
          current_due: number | null
          customer_type: string | null
          id: string | null
          last_transaction_date: string | null
          name: string | null
          phone: string | null
          total_paid: number | null
          total_purchase: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      vw_daily_cash_flow: {
        Row: {
          date: string | null
          inflow: number | null
          outflow: number | null
          transaction_type: string | null
        }
        Relationships: []
      }
      vw_daily_sales_report: {
        Row: {
          date: string | null
          profit_margin_percent: number | null
          total_cogs: number | null
          total_due: number | null
          total_paid: number | null
          total_profit: number | null
          total_sales: number | null
          transaction_count: number | null
          unique_customers: number | null
        }
        Relationships: []
      }
      vw_global_search: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          creator: string | null
          description: string | null
          due_amount: number | null
          id: string | null
          invoice_date: string | null
          reference: string | null
          result_type: string | null
          title: string | null
        }
        Relationships: []
      }
      vw_monthly_sales_summary: {
        Row: {
          month: string | null
          month_num: number | null
          profit_margin_percent: number | null
          total_cogs: number | null
          total_due: number | null
          total_paid: number | null
          total_profit: number | null
          total_sales: number | null
          transaction_count: number | null
          unique_customers: number | null
          year: number | null
        }
        Relationships: []
      }
      vw_payable_summary: {
        Row: {
          days_overdue: number | null
          id: string | null
          name: string | null
          oldest_invoice_date: string | null
          payable_amount: number | null
          payment_terms: string | null
          phone: string | null
        }
        Relationships: []
      }
      vw_product_sales_report: {
        Row: {
          cost_price: number | null
          id: string | null
          last_sold_date: string | null
          product_name: string | null
          profit_margin_percent: number | null
          sale_price: number | null
          total_cost: number | null
          total_profit: number | null
          total_qty_sold: number | null
          total_sales_amount: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      vw_quick_filters: {
        Row: {
          filter_config: Json | null
          filter_id: string | null
          label: string | null
          search_type: string | null
        }
        Relationships: []
      }
      vw_search_suggestions: {
        Row: {
          frequency: number | null
          suggestion: string | null
          type: string | null
        }
        Relationships: []
      }
      vw_stock_valuation_report: {
        Row: {
          cost_price: number | null
          id: string | null
          latest_purchase_date: string | null
          number_of_lots: number | null
          product_name: string | null
          total_qty_in_stock: number | null
          total_stock_value: number | null
        }
        Relationships: []
      }
      vw_supplier_statement: {
        Row: {
          details: string | null
          due_amount: number | null
          id: string | null
          invoice_date: string | null
          memo_no: string | null
          paid_amount: number | null
          payment_method:
            | Database["public"]["Enums"]["hb_payment_method"]
            | null
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number | null
          type: Database["public"]["Enums"]["hb_invoice_type"] | null
        }
        Relationships: []
      }
      vw_supplier_summary: {
        Row: {
          current_payable: number | null
          id: string | null
          last_transaction_date: string | null
          name: string | null
          payment_terms: string | null
          phone: string | null
          supplier_type: string | null
          total_paid: number | null
          total_purchase: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      vw_warehouse_stock: {
        Row: {
          product_id: string | null
          product_name: string | null
          qty_in_stock: number | null
          sale_price: number | null
          stock_value: number | null
          unit: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      hb_actor_name: { Args: never; Returns: string }
      hb_add_advance_payment: {
        Args: { p: Json }
        Returns: {
          amount: number
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["hb_payment_method"]
          note: string | null
          paid_on: string
        }
        SetofOptions: {
          from: "*"
          to: "advance_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_add_payment: {
        Args: { p: Json }
        Returns: {
          cogs: number
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string | null
          detail_revision: number
          details: string | null
          due_amount: number | null
          goods_status: Database["public"]["Enums"]["hb_goods_status"]
          id: string
          image_url: string | null
          invoice_date: string
          is_reversal: boolean
          memo_no: string | null
          no_image_reason: string | null
          paid_amount: number
          party_name: string | null
          payment_method: Database["public"]["Enums"]["hb_payment_method"]
          profit: number
          reversed_at: string | null
          reverses_invoice_id: string | null
          stock_shortfall: boolean
          supplier_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_bootstrap_exec: { Args: { p_sql: string }; Returns: string }
      hb_consume_fifo: {
        Args: { p_fallback: number; p_product_id: string; p_qty: number }
        Returns: number[]
      }
      hb_create_invoice: {
        Args: { p: Json }
        Returns: {
          cogs: number
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string | null
          detail_revision: number
          details: string | null
          due_amount: number | null
          goods_status: Database["public"]["Enums"]["hb_goods_status"]
          id: string
          image_url: string | null
          invoice_date: string
          is_reversal: boolean
          memo_no: string | null
          no_image_reason: string | null
          paid_amount: number
          party_name: string | null
          payment_method: Database["public"]["Enums"]["hb_payment_method"]
          profit: number
          reversed_at: string | null
          reverses_invoice_id: string | null
          stock_shortfall: boolean
          supplier_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_edit_details: {
        Args: { p: Json }
        Returns: {
          cogs: number
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string | null
          detail_revision: number
          details: string | null
          due_amount: number | null
          goods_status: Database["public"]["Enums"]["hb_goods_status"]
          id: string
          image_url: string | null
          invoice_date: string
          is_reversal: boolean
          memo_no: string | null
          no_image_reason: string | null
          paid_amount: number
          party_name: string | null
          payment_method: Database["public"]["Enums"]["hb_payment_method"]
          profit: number
          reversed_at: string | null
          reverses_invoice_id: string | null
          stock_shortfall: boolean
          supplier_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_get_business_summary: {
        Args: never
        Returns: {
          current_capital: number
          opening_balance: number
          pending_invoices: number
          total_due: number
          total_expenses: number
          total_investment: number
          total_profit: number
          total_purchases: number
          total_sales: number
        }[]
      }
      hb_get_customer_summary: {
        Args: { p_customer_id: string }
        Returns: {
          credit_limit: number | null
          current_due: number | null
          customer_type: string | null
          id: string | null
          last_transaction_date: string | null
          name: string | null
          phone: string | null
          total_paid: number | null
          total_purchase: number | null
          transaction_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_customer_summary"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hb_get_supplier_summary: {
        Args: { p_supplier_id: string }
        Returns: {
          current_payable: number | null
          id: string | null
          last_transaction_date: string | null
          name: string | null
          payment_terms: string | null
          phone: string | null
          supplier_type: string | null
          total_paid: number | null
          total_purchase: number | null
          transaction_count: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_supplier_summary"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hb_init_capital: {
        Args: { p_amount: number }
        Returns: {
          created_at: string
          created_by: string | null
          created_by_name: string
          current_balance: number
          id: string
          opening_balance: number
          total_investment: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "business_capital"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_inject_capital: {
        Args: { p_amount: number; p_note?: string }
        Returns: {
          created_at: string
          created_by: string | null
          created_by_name: string
          current_balance: number
          id: string
          opening_balance: number
          total_investment: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "business_capital"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_receive_goods: {
        Args: { p: Json }
        Returns: {
          cogs: number
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string | null
          detail_revision: number
          details: string | null
          due_amount: number | null
          goods_status: Database["public"]["Enums"]["hb_goods_status"]
          id: string
          image_url: string | null
          invoice_date: string
          is_reversal: boolean
          memo_no: string | null
          no_image_reason: string | null
          paid_amount: number
          party_name: string | null
          payment_method: Database["public"]["Enums"]["hb_payment_method"]
          profit: number
          reversed_at: string | null
          reverses_invoice_id: string | null
          stock_shortfall: boolean
          supplier_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_return_purchase: {
        Args: {
          p_fallback: number
          p_invoice_id: string
          p_product_id: string
          p_qty: number
        }
        Returns: number
      }
      hb_reverse_invoice: {
        Args: { p: Json }
        Returns: {
          cogs: number
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string | null
          detail_revision: number
          details: string | null
          due_amount: number | null
          goods_status: Database["public"]["Enums"]["hb_goods_status"]
          id: string
          image_url: string | null
          invoice_date: string
          is_reversal: boolean
          memo_no: string | null
          no_image_reason: string | null
          paid_amount: number
          party_name: string | null
          payment_method: Database["public"]["Enums"]["hb_payment_method"]
          profit: number
          reversed_at: string | null
          reverses_invoice_id: string | null
          stock_shortfall: boolean
          supplier_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["hb_invoice_type"]
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_save_category: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "product_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_save_customer: {
        Args: { p: Json }
        Returns: {
          address: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          credit_limit: number
          customer_type: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_save_product: {
        Args: { p: Json }
        Returns: {
          category_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          sale_price: number | null
          unit: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_save_supplier: {
        Args: { p: Json }
        Returns: {
          address: string | null
          bank_account: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          payment_terms: string | null
          phone: string | null
          supplier_type: string
          tax_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "suppliers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_save_warehouse: {
        Args: { p: Json }
        Returns: {
          created_at: string
          created_by: string | null
          created_by_name: string
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "warehouses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hb_update_capital_after_transaction: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      hb_goods_status: "n_a" | "pending" | "partial" | "received"
      hb_invoice_type: "expense" | "purchase" | "sale"
      hb_payment_method: "cash" | "mobile" | "bank" | "cheque" | "other"
      hb_stock_reason: "purchase" | "sale" | "opening" | "receipt" | "reversal"
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
    Enums: {
      hb_goods_status: ["n_a", "pending", "partial", "received"],
      hb_invoice_type: ["expense", "purchase", "sale"],
      hb_payment_method: ["cash", "mobile", "bank", "cheque", "other"],
      hb_stock_reason: ["purchase", "sale", "opening", "receipt", "reversal"],
    },
  },
} as const
