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
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          reservation_id: string | null
          title: string
          type: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          reservation_id?: string | null
          title: string
          type: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          reservation_id?: string | null
          title?: string
          type?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: []
      }
      owner_applications: {
        Row: {
          accepted_terms: boolean
          address: string
          admin_notes: string | null
          availability_notes: string | null
          birth_date: string | null
          cedula: string
          cedula_doc_url: string | null
          city: string
          created_at: string
          fuel_type: string | null
          id: string
          insurance_doc_url: string | null
          mileage: number | null
          phone: string
          status: Database["public"]["Enums"]["application_status"]
          suggested_price_per_day: number
          title_doc_url: string | null
          transmission: string | null
          updated_at: string
          user_id: string
          vehicle_brand: string
          vehicle_color: string | null
          vehicle_model: string
          vehicle_photos: string[] | null
          vehicle_plate: string
          vehicle_year: number
        }
        Insert: {
          accepted_terms?: boolean
          address: string
          admin_notes?: string | null
          availability_notes?: string | null
          birth_date?: string | null
          cedula: string
          cedula_doc_url?: string | null
          city: string
          created_at?: string
          fuel_type?: string | null
          id?: string
          insurance_doc_url?: string | null
          mileage?: number | null
          phone: string
          status?: Database["public"]["Enums"]["application_status"]
          suggested_price_per_day: number
          title_doc_url?: string | null
          transmission?: string | null
          updated_at?: string
          user_id: string
          vehicle_brand: string
          vehicle_color?: string | null
          vehicle_model: string
          vehicle_photos?: string[] | null
          vehicle_plate: string
          vehicle_year: number
        }
        Update: {
          accepted_terms?: boolean
          address?: string
          admin_notes?: string | null
          availability_notes?: string | null
          birth_date?: string | null
          cedula?: string
          cedula_doc_url?: string | null
          city?: string
          created_at?: string
          fuel_type?: string | null
          id?: string
          insurance_doc_url?: string | null
          mileage?: number | null
          phone?: string
          status?: Database["public"]["Enums"]["application_status"]
          suggested_price_per_day?: number
          title_doc_url?: string | null
          transmission?: string | null
          updated_at?: string
          user_id?: string
          vehicle_brand?: string
          vehicle_color?: string | null
          vehicle_model?: string
          vehicle_photos?: string[] | null
          vehicle_plate?: string
          vehicle_year?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string
          reservation_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method: string
          reservation_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string
          reservation_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          cedula: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          cedula?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          cedula?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          end_date: string
          id: string
          renter_id: string
          start_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          renter_id: string
          start_date: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          renter_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_price?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          reservation_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reservation_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reservation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          available: boolean
          brand: string
          created_at: string
          description: string | null
          id: string
          location: string
          model: string
          owner_id: string
          photos: string[] | null
          price_per_day: number
          updated_at: string
          year: number
        }
        Insert: {
          active?: boolean
          available?: boolean
          brand: string
          created_at?: string
          description?: string | null
          id?: string
          location: string
          model: string
          owner_id: string
          photos?: string[] | null
          price_per_day: number
          updated_at?: string
          year: number
        }
        Update: {
          active?: boolean
          available?: boolean
          brand?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string
          model?: string
          owner_id?: string
          photos?: string[] | null
          price_per_day?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "renter" | "owner" | "admin"
      application_status: "pending" | "approved" | "rejected"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      reservation_status:
        | "pending"
        | "approved"
        | "active"
        | "rejected"
        | "completed"
        | "cancelled"
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
      app_role: ["renter", "owner", "admin"],
      application_status: ["pending", "approved", "rejected"],
      payment_status: ["pending", "completed", "failed", "refunded"],
      reservation_status: [
        "pending",
        "approved",
        "active",
        "rejected",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
