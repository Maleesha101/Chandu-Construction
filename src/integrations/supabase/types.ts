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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          action: string
          approver_user_id: string
          created_at: string | null
          id: string
          note: string | null
          record_id: string
        }
        Insert: {
          action: string
          approver_user_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          record_id: string
        }
        Update: {
          action?: string
          approver_user_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "expense_records"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          active: boolean | null
          balance: number | null
          bank_name: string
          created_at: string | null
          currency: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          active?: boolean | null
          balance?: number | null
          bank_name: string
          created_at?: string | null
          currency?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          active?: boolean | null
          balance?: number | null
          bank_name?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      expense_records: {
        Row: {
          amount: number
          created_at: string | null
          entered_by_user_id: string
          entry_date: string
          from_bank_account_id: string | null
          id: string
          md_id: string | null
          payment_method: string | null
          purpose: string
          qs_notes: string | null
          reference: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["expense_status"] | null
          to_name: string
          updated_at: string | null
          wd_reason: string | null
          week_end: string | null
          week_start: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          entered_by_user_id: string
          entry_date?: string
          from_bank_account_id?: string | null
          id?: string
          md_id?: string | null
          payment_method?: string | null
          purpose: string
          qs_notes?: string | null
          reference?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          to_name: string
          updated_at?: string | null
          wd_reason?: string | null
          week_end?: string | null
          week_start?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          entered_by_user_id?: string
          entry_date?: string
          from_bank_account_id?: string | null
          id?: string
          md_id?: string | null
          payment_method?: string | null
          purpose?: string
          qs_notes?: string | null
          reference?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          to_name?: string
          updated_at?: string | null
          wd_reason?: string | null
          week_end?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_records_from_bank_account_id_fkey"
            columns: ["from_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_records_md_id_fkey"
            columns: ["md_id"]
            isOneToOne: false
            referencedRelation: "managing_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_records_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string | null
          created_by: string | null
          funding_date: string
          id: string
          md_id: string | null
          note: string | null
          week_end: string | null
          week_start: string | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string | null
          created_by?: string | null
          funding_date?: string
          id?: string
          md_id?: string | null
          note?: string | null
          week_end?: string | null
          week_start?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string | null
          created_by?: string | null
          funding_date?: string
          id?: string
          md_id?: string | null
          note?: string | null
          week_end?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_transactions_md_id_fkey"
            columns: ["md_id"]
            isOneToOne: false
            referencedRelation: "managing_directors"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_code: string | null
          balance_after: number | null
          created_at: string | null
          credit: number | null
          debit: number | null
          description: string | null
          funding_id: string | null
          id: string
          record_id: string | null
        }
        Insert: {
          account_code?: string | null
          balance_after?: number | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          funding_id?: string | null
          id?: string
          record_id?: string | null
        }
        Update: {
          account_code?: string | null
          balance_after?: number | null
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          description?: string | null
          funding_id?: string | null
          id?: string
          record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "expense_records"
            referencedColumns: ["id"]
          },
        ]
      }
      managing_directors: {
        Row: {
          active: boolean | null
          contact: string | null
          created_at: string | null
          email: string | null
          float_balance: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          contact?: string | null
          created_at?: string | null
          email?: string | null
          float_balance?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          contact?: string | null
          created_at?: string | null
          email?: string | null
          float_balance?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          payload: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      record_attachments: {
        Row: {
          filename: string
          id: string
          record_id: string
          uploaded_at: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          filename: string
          id?: string
          record_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          filename?: string
          id?: string
          record_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_attachments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "expense_records"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          id: string
          location: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "boss" | "admin" | "qs" | "md" | "viewer"
      expense_status:
        | "pending"
        | "approved"
        | "rejected"
        | "wd_pending"
        | "wd_approved"
        | "wd_rejected"
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
      app_role: ["boss", "admin", "qs", "md", "viewer"],
      expense_status: [
        "pending",
        "approved",
        "rejected",
        "wd_pending",
        "wd_approved",
        "wd_rejected",
      ],
    },
  },
} as const
