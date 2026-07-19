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
      admin_user_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at: string
          details: string | null
          id: string
          target_user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["admin_action_type"]
          admin_id: string
          created_at?: string
          details?: string | null
          id?: string
          target_user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["admin_action_type"]
          admin_id?: string
          created_at?: string
          details?: string | null
          id?: string
          target_user_id?: string
        }
        Relationships: []
      }
      admin_user_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note: string
          target_user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note: string
          target_user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note?: string
          target_user_id?: string
        }
        Relationships: []
      }
      ai_training_datasets: {
        Row: {
          content_hash: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          row_count: number
          source_tables: string[] | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          row_count?: number
          source_tables?: string[] | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          row_count?: number
          source_tables?: string[] | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          owner_id: string
          renter_id: string
          reservation_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id: string
          renter_id: string
          reservation_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          owner_id?: string
          renter_id?: string
          reservation_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: []
      }
      demand_signals: {
        Row: {
          created_at: string
          hour_bucket: string
          id: string
          occupancy_rate: number | null
          reservations_completed: number | null
          reservations_created: number | null
          searches: number | null
          zone: string
        }
        Insert: {
          created_at?: string
          hour_bucket: string
          id?: string
          occupancy_rate?: number | null
          reservations_completed?: number | null
          reservations_created?: number | null
          searches?: number | null
          zone: string
        }
        Update: {
          created_at?: string
          hour_bucket?: string
          id?: string
          occupancy_rate?: number | null
          reservations_completed?: number | null
          reservations_created?: number | null
          searches?: number | null
          zone?: string
        }
        Relationships: []
      }
      fraud_signals: {
        Row: {
          created_at: string
          details: Json | null
          device_fingerprint_hash: string | null
          geo_country: string | null
          id: string
          ip_hash: string | null
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          risk_score: number
          signal_type: Database["public"]["Enums"]["fraud_signal_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          device_fingerprint_hash?: string | null
          geo_country?: string | null
          id?: string
          ip_hash?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number
          signal_type: Database["public"]["Enums"]["fraud_signal_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          device_fingerprint_hash?: string | null
          geo_country?: string | null
          id?: string
          ip_hash?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number
          signal_type?: Database["public"]["Enums"]["fraud_signal_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          bank_reference_url: string | null
          birth_date: string | null
          cedula: string
          cedula_doc_url: string | null
          city: string | null
          created_at: string
          driving_license_doc_url: string | null
          driving_license_expiry: string | null
          driving_license_number: string | null
          fuel_type: string | null
          has_medical_condition: boolean
          id: string
          insurance_doc_url: string | null
          medical_certificate_url: string | null
          mileage: number | null
          own_social_declared_age_months: number | null
          own_social_provider: string | null
          own_social_provider_user_id: string | null
          own_social_verified_at: string | null
          own_social_verified_email: string | null
          own_social_verified_name: string | null
          own_social_verified_picture: string | null
          personal_reference_email: string | null
          phone: string
          selfie_url: string | null
          status: Database["public"]["Enums"]["application_status"]
          suggested_price_per_day: number
          title_doc_url: string | null
          transmission: string | null
          updated_at: string
          user_id: string
          utility_bill_url: string | null
          vehicle_address_detail: string | null
          vehicle_brand: string
          vehicle_color: string | null
          vehicle_model: string
          vehicle_photos: string[] | null
          vehicle_plate: string
          vehicle_year: number
          vehicle_zone: string | null
        }
        Insert: {
          accepted_terms?: boolean
          address: string
          admin_notes?: string | null
          availability_notes?: string | null
          bank_reference_url?: string | null
          birth_date?: string | null
          cedula: string
          cedula_doc_url?: string | null
          city?: string | null
          created_at?: string
          driving_license_doc_url?: string | null
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          fuel_type?: string | null
          has_medical_condition?: boolean
          id?: string
          insurance_doc_url?: string | null
          medical_certificate_url?: string | null
          mileage?: number | null
          own_social_declared_age_months?: number | null
          own_social_provider?: string | null
          own_social_provider_user_id?: string | null
          own_social_verified_at?: string | null
          own_social_verified_email?: string | null
          own_social_verified_name?: string | null
          own_social_verified_picture?: string | null
          personal_reference_email?: string | null
          phone: string
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          suggested_price_per_day: number
          title_doc_url?: string | null
          transmission?: string | null
          updated_at?: string
          user_id: string
          utility_bill_url?: string | null
          vehicle_address_detail?: string | null
          vehicle_brand: string
          vehicle_color?: string | null
          vehicle_model: string
          vehicle_photos?: string[] | null
          vehicle_plate: string
          vehicle_year: number
          vehicle_zone?: string | null
        }
        Update: {
          accepted_terms?: boolean
          address?: string
          admin_notes?: string | null
          availability_notes?: string | null
          bank_reference_url?: string | null
          birth_date?: string | null
          cedula?: string
          cedula_doc_url?: string | null
          city?: string | null
          created_at?: string
          driving_license_doc_url?: string | null
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          fuel_type?: string | null
          has_medical_condition?: boolean
          id?: string
          insurance_doc_url?: string | null
          medical_certificate_url?: string | null
          mileage?: number | null
          own_social_declared_age_months?: number | null
          own_social_provider?: string | null
          own_social_provider_user_id?: string | null
          own_social_verified_at?: string | null
          own_social_verified_email?: string | null
          own_social_verified_name?: string | null
          own_social_verified_picture?: string | null
          personal_reference_email?: string | null
          phone?: string
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          suggested_price_per_day?: number
          title_doc_url?: string | null
          transmission?: string | null
          updated_at?: string
          user_id?: string
          utility_bill_url?: string | null
          vehicle_address_detail?: string | null
          vehicle_brand?: string
          vehicle_color?: string | null
          vehicle_model?: string
          vehicle_photos?: string[] | null
          vehicle_plate?: string
          vehicle_year?: number
          vehicle_zone?: string | null
        }
        Relationships: []
      }
      owner_payout_methods: {
        Row: {
          account_holder: string | null
          account_number: string | null
          account_type: string | null
          bank_name: string | null
          created_at: string
          currency: string
          email: string | null
          holder_document: string | null
          id: string
          is_primary: boolean
          method_type: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          holder_document?: string | null
          id?: string
          is_primary?: boolean
          method_type: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          holder_document?: string | null
          id?: string
          is_primary?: boolean
          method_type?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      owner_payouts: {
        Row: {
          commission: number
          created_at: string
          gross: number
          id: string
          net: number
          notes: string | null
          owner_id: string
          paid_at: string | null
          paid_by: string | null
          period: string
          proof_url: string | null
          refunds: number
          status: string
          updated_at: string
        }
        Insert: {
          commission?: number
          created_at?: string
          gross?: number
          id?: string
          net?: number
          notes?: string | null
          owner_id: string
          paid_at?: string | null
          paid_by?: string | null
          period: string
          proof_url?: string | null
          refunds?: number
          status?: string
          updated_at?: string
        }
        Update: {
          commission?: number
          created_at?: string
          gross?: number
          id?: string
          net?: number
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          paid_by?: string | null
          period?: string
          proof_url?: string | null
          refunds?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payer_name: string | null
          payer_phone: string | null
          payment_method: string
          receipt_url: string | null
          reference_number: string | null
          rejection_reason: string | null
          reservation_id: string
          status: Database["public"]["Enums"]["payment_status"]
          submitted_at: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string
          receipt_url?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          reservation_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          payment_method?: string
          receipt_url?: string | null
          reference_number?: string | null
          rejection_reason?: string | null
          reservation_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
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
          account_status: Database["public"]["Enums"]["account_status"]
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          cedula: string | null
          created_at: string
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cedula?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cedula?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      renter_reference_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          referent_email: string
          referent_user_id: string
          requester_user_id: string
          responded_at: string | null
          status: string
          updated_at: string
          verification_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          referent_email: string
          referent_user_id: string
          requester_user_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
          verification_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          referent_email?: string
          referent_user_id?: string
          requester_user_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renter_reference_requests_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "renter_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      renter_verifications: {
        Row: {
          accepted_terms: boolean
          address: string
          admin_notes: string | null
          bank_reference_url: string | null
          birth_date: string
          city: string
          contact_email: string | null
          country: string
          created_at: string
          document_number: string
          document_type: string
          driving_license_doc_url: string
          driving_license_expiry: string | null
          driving_license_number: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relationship: string
          employer: string | null
          full_name: string
          gender: string | null
          has_medical_condition: boolean
          id: string
          identity_doc_url: string
          medical_certificate_url: string | null
          nationality: string | null
          occupation: string | null
          own_social_age_months: number | null
          own_social_declared_age_months: number | null
          own_social_platform: string | null
          own_social_provider: string | null
          own_social_provider_user_id: string | null
          own_social_url: string | null
          own_social_verified_at: string | null
          own_social_verified_email: string | null
          own_social_verified_name: string | null
          own_social_verified_picture: string | null
          personal_reference_confirmed_at: string | null
          personal_reference_user_id: string | null
          phone: string
          phone_secondary: string | null
          reference_name: string | null
          reference_phone: string | null
          reference_relationship: string | null
          reference_social_age_months: number | null
          reference_social_platform: string | null
          reference_social_url: string | null
          selfie_url: string
          state: string | null
          status: Database["public"]["Enums"]["renter_verification_status"]
          updated_at: string
          user_id: string
          utility_bill_url: string | null
        }
        Insert: {
          accepted_terms?: boolean
          address: string
          admin_notes?: string | null
          bank_reference_url?: string | null
          birth_date: string
          city: string
          contact_email?: string | null
          country?: string
          created_at?: string
          document_number: string
          document_type: string
          driving_license_doc_url: string
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relationship: string
          employer?: string | null
          full_name: string
          gender?: string | null
          has_medical_condition?: boolean
          id?: string
          identity_doc_url: string
          medical_certificate_url?: string | null
          nationality?: string | null
          occupation?: string | null
          own_social_age_months?: number | null
          own_social_declared_age_months?: number | null
          own_social_platform?: string | null
          own_social_provider?: string | null
          own_social_provider_user_id?: string | null
          own_social_url?: string | null
          own_social_verified_at?: string | null
          own_social_verified_email?: string | null
          own_social_verified_name?: string | null
          own_social_verified_picture?: string | null
          personal_reference_confirmed_at?: string | null
          personal_reference_user_id?: string | null
          phone: string
          phone_secondary?: string | null
          reference_name?: string | null
          reference_phone?: string | null
          reference_relationship?: string | null
          reference_social_age_months?: number | null
          reference_social_platform?: string | null
          reference_social_url?: string | null
          selfie_url: string
          state?: string | null
          status?: Database["public"]["Enums"]["renter_verification_status"]
          updated_at?: string
          user_id: string
          utility_bill_url?: string | null
        }
        Update: {
          accepted_terms?: boolean
          address?: string
          admin_notes?: string | null
          bank_reference_url?: string | null
          birth_date?: string
          city?: string
          contact_email?: string | null
          country?: string
          created_at?: string
          document_number?: string
          document_type?: string
          driving_license_doc_url?: string
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          emergency_contact_name?: string
          emergency_contact_phone?: string
          emergency_contact_relationship?: string
          employer?: string | null
          full_name?: string
          gender?: string | null
          has_medical_condition?: boolean
          id?: string
          identity_doc_url?: string
          medical_certificate_url?: string | null
          nationality?: string | null
          occupation?: string | null
          own_social_age_months?: number | null
          own_social_declared_age_months?: number | null
          own_social_platform?: string | null
          own_social_provider?: string | null
          own_social_provider_user_id?: string | null
          own_social_url?: string | null
          own_social_verified_at?: string | null
          own_social_verified_email?: string | null
          own_social_verified_name?: string | null
          own_social_verified_picture?: string | null
          personal_reference_confirmed_at?: string | null
          personal_reference_user_id?: string | null
          phone?: string
          phone_secondary?: string | null
          reference_name?: string | null
          reference_phone?: string | null
          reference_relationship?: string | null
          reference_social_age_months?: number | null
          reference_social_platform?: string | null
          reference_social_url?: string | null
          selfie_url?: string
          state?: string | null
          status?: Database["public"]["Enums"]["renter_verification_status"]
          updated_at?: string
          user_id?: string
          utility_bill_url?: string | null
        }
        Relationships: []
      }
      reservation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          reservation_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          reservation_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          reservation_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          end_date: string
          end_mileage: number | null
          id: string
          payment_deadline: string | null
          refund_amount: number | null
          refund_percent: number | null
          renter_id: string
          start_date: string
          start_mileage: number | null
          status: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          end_date: string
          end_mileage?: number | null
          id?: string
          payment_deadline?: string | null
          refund_amount?: number | null
          refund_percent?: number | null
          renter_id: string
          start_date: string
          start_mileage?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          end_date?: string
          end_mileage?: number | null
          id?: string
          payment_deadline?: string | null
          refund_amount?: number | null
          refund_percent?: number | null
          renter_id?: string
          start_date?: string
          start_mileage?: number | null
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
          car_condition: number | null
          comment: string | null
          created_at: string
          id: string
          listing_accuracy: number | null
          owner_communication: number | null
          punctuality: number | null
          rating: number
          renter_responsibility: number | null
          reservation_id: string
          reviewer_type: string
          subject_user_id: string | null
          updated_at: string
          vehicle_id: string | null
          vehicle_returned_condition: number | null
        }
        Insert: {
          author_id: string
          car_condition?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          listing_accuracy?: number | null
          owner_communication?: number | null
          punctuality?: number | null
          rating: number
          renter_responsibility?: number | null
          reservation_id: string
          reviewer_type?: string
          subject_user_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_returned_condition?: number | null
        }
        Update: {
          author_id?: string
          car_condition?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          listing_accuracy?: number | null
          owner_communication?: number | null
          punctuality?: number | null
          rating?: number
          renter_responsibility?: number | null
          reservation_id?: string
          reviewer_type?: string
          subject_user_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
          vehicle_returned_condition?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          email: string
          id: string
          message: string
          name: string
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      telemetry_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["telemetry_event_type"]
          id: string
          lat: number | null
          lng: number | null
          recorded_at: string
          reservation_id: string
          speed_kmh: number | null
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["telemetry_event_type"]
          id?: string
          lat?: number | null
          lng?: number | null
          recorded_at?: string
          reservation_id: string
          speed_kmh?: number | null
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["telemetry_event_type"]
          id?: string
          lat?: number | null
          lng?: number | null
          recorded_at?: string
          reservation_id?: string
          speed_kmh?: number | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_summaries: {
        Row: {
          avg_speed_kmh: number | null
          created_at: string
          distance_km: number | null
          harsh_accel_count: number | null
          harsh_brake_count: number | null
          id: string
          max_speed_kmh: number | null
          night_minutes: number | null
          phone_use_count: number | null
          reservation_id: string
          risk_score: number | null
          speeding_count: number | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          avg_speed_kmh?: number | null
          created_at?: string
          distance_km?: number | null
          harsh_accel_count?: number | null
          harsh_brake_count?: number | null
          id?: string
          max_speed_kmh?: number | null
          night_minutes?: number | null
          phone_use_count?: number | null
          reservation_id: string
          risk_score?: number | null
          speeding_count?: number | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          avg_speed_kmh?: number | null
          created_at?: string
          distance_km?: number | null
          harsh_accel_count?: number | null
          harsh_brake_count?: number | null
          id?: string
          max_speed_kmh?: number | null
          night_minutes?: number | null
          phone_use_count?: number | null
          reservation_id?: string
          risk_score?: number | null
          speeding_count?: number | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_summaries_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_summaries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_data_consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          ip_hash: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_hash?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_hash?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      vehicle_inspections: {
        Row: {
          accepted_terms: boolean
          checklist: Json
          created_at: string
          damage_notes: string | null
          fuel_level: string | null
          id: string
          inspector_id: string
          inspector_role: string
          ip: string | null
          mileage: number | null
          notes: string | null
          photos: string[]
          reservation_id: string
          signature_name: string | null
          signed_at: string | null
          type: Database["public"]["Enums"]["inspection_type"]
          updated_at: string
          user_agent: string | null
          vehicle_id: string
        }
        Insert: {
          accepted_terms?: boolean
          checklist?: Json
          created_at?: string
          damage_notes?: string | null
          fuel_level?: string | null
          id?: string
          inspector_id: string
          inspector_role: string
          ip?: string | null
          mileage?: number | null
          notes?: string | null
          photos?: string[]
          reservation_id: string
          signature_name?: string | null
          signed_at?: string | null
          type: Database["public"]["Enums"]["inspection_type"]
          updated_at?: string
          user_agent?: string | null
          vehicle_id: string
        }
        Update: {
          accepted_terms?: boolean
          checklist?: Json
          created_at?: string
          damage_notes?: string | null
          fuel_level?: string | null
          id?: string
          inspector_id?: string
          inspector_role?: string
          ip?: string | null
          mileage?: number | null
          notes?: string | null
          photos?: string[]
          reservation_id?: string
          signature_name?: string | null
          signed_at?: string | null
          type?: Database["public"]["Enums"]["inspection_type"]
          updated_at?: string
          user_agent?: string | null
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_maintenance: {
        Row: {
          category: string
          checklist: Json
          completed_at: string | null
          cost: number | null
          created_at: string
          id: string
          inspection_type: string | null
          inspector_name: string | null
          mileage: number | null
          next_date: string | null
          notes: string | null
          photos: string[]
          problems: string | null
          result: string | null
          scheduled_date: string
          severity: string | null
          signature: string | null
          status: string
          type: string
          updated_at: string
          vehicle_id: string
          workshop: string | null
        }
        Insert: {
          category?: string
          checklist?: Json
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          inspection_type?: string | null
          inspector_name?: string | null
          mileage?: number | null
          next_date?: string | null
          notes?: string | null
          photos?: string[]
          problems?: string | null
          result?: string | null
          scheduled_date: string
          severity?: string | null
          signature?: string | null
          status?: string
          type: string
          updated_at?: string
          vehicle_id: string
          workshop?: string | null
        }
        Update: {
          category?: string
          checklist?: Json
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          id?: string
          inspection_type?: string | null
          inspector_name?: string | null
          mileage?: number | null
          next_date?: string | null
          notes?: string | null
          photos?: string[]
          problems?: string | null
          result?: string | null
          scheduled_date?: string
          severity?: string | null
          signature?: string | null
          status?: string
          type?: string
          updated_at?: string
          vehicle_id?: string
          workshop?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          available: boolean
          brand: string
          circulation_doc_url: string | null
          circulation_expiry: string | null
          color: string | null
          created_at: string
          custom_features: string[]
          description: string | null
          features: string[]
          fuel_type: string | null
          gps_lat: number | null
          gps_lng: number | null
          house_rules: Json
          id: string
          insurance_doc_url: string | null
          insurance_expiry: string | null
          internal_notes: string | null
          location: string
          model: string
          monthly_price: number | null
          owner_id: string
          photos: string[] | null
          plate: string | null
          price_per_day: number
          seats: number | null
          soat_doc_url: string | null
          soat_expiry: string | null
          transmission: string | null
          updated_at: string
          vin: string | null
          weekend_price: number | null
          weekly_price: number | null
          year: number
          zone: string | null
        }
        Insert: {
          active?: boolean
          available?: boolean
          brand: string
          circulation_doc_url?: string | null
          circulation_expiry?: string | null
          color?: string | null
          created_at?: string
          custom_features?: string[]
          description?: string | null
          features?: string[]
          fuel_type?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          house_rules?: Json
          id?: string
          insurance_doc_url?: string | null
          insurance_expiry?: string | null
          internal_notes?: string | null
          location: string
          model: string
          monthly_price?: number | null
          owner_id: string
          photos?: string[] | null
          plate?: string | null
          price_per_day: number
          seats?: number | null
          soat_doc_url?: string | null
          soat_expiry?: string | null
          transmission?: string | null
          updated_at?: string
          vin?: string | null
          weekend_price?: number | null
          weekly_price?: number | null
          year: number
          zone?: string | null
        }
        Update: {
          active?: boolean
          available?: boolean
          brand?: string
          circulation_doc_url?: string | null
          circulation_expiry?: string | null
          color?: string | null
          created_at?: string
          custom_features?: string[]
          description?: string | null
          features?: string[]
          fuel_type?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          house_rules?: Json
          id?: string
          insurance_doc_url?: string | null
          insurance_expiry?: string | null
          internal_notes?: string | null
          location?: string
          model?: string
          monthly_price?: number | null
          owner_id?: string
          photos?: string[] | null
          plate?: string | null
          price_per_day?: number
          seats?: number | null
          soat_doc_url?: string | null
          soat_expiry?: string | null
          transmission?: string | null
          updated_at?: string
          vin?: string | null
          weekend_price?: number | null
          weekly_price?: number | null
          year?: number
          zone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          user_id: string | null
          verified: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      _safe_public_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          user_id: string
          verified: boolean
        }[]
      }
      admin_overview_metrics: {
        Args: { _from: string; _to: string }
        Returns: Json
      }
      auto_cancel_unpaid_reservations: { Args: never; Returns: number }
      compute_trip_risk_score: {
        Args: { _reservation_id: string }
        Returns: {
          avg_speed_kmh: number | null
          created_at: string
          distance_km: number | null
          harsh_accel_count: number | null
          harsh_brake_count: number | null
          id: string
          max_speed_kmh: number | null
          night_minutes: number | null
          phone_use_count: number | null
          reservation_id: string
          risk_score: number | null
          speeding_count: number | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "trip_summaries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_personal_reference: {
        Args: { _accept: boolean; _request_id: string }
        Returns: {
          created_at: string
          id: string
          message: string | null
          referent_email: string
          referent_user_id: string
          requester_user_id: string
          responded_at: string | null
          status: string
          updated_at: string
          verification_id: string
        }
        SetofOptions: {
          from: "*"
          to: "renter_reference_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_reservation_status: {
        Args: { _reservation_id: string }
        Returns: Database["public"]["Enums"]["reservation_status"]
      }
      get_pricing_config: {
        Args: never
        Returns: {
          commission_pct: number
          insurance_per_day: number
        }[]
      }
      get_renter_profile_for_owner: {
        Args: { _renter_id: string }
        Returns: Json
      }
      get_reservation_renter_info: {
        Args: { _reservation_id: string }
        Returns: {
          address: string
          birth_date: string
          city: string
          country: string
          document_number: string
          document_type: string
          driving_license_expiry: string
          driving_license_number: string
          full_name: string
          nationality: string
          phone: string
          state: string
        }[]
      }
      get_vehicle_private_fields: {
        Args: { _vehicle_id: string }
        Returns: {
          circulation_doc_url: string
          insurance_doc_url: string
          internal_notes: string
          plate: string
          soat_doc_url: string
          vin: string
        }[]
      }
      has_consent: {
        Args: {
          _consent: Database["public"]["Enums"]["consent_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_review_public: { Args: { _reservation_id: string }; Returns: boolean }
      record_consent: {
        Args: {
          _consent_type: Database["public"]["Enums"]["consent_type"]
          _granted: boolean
          _ip_hash?: string
          _user_agent?: string
        }
        Returns: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          ip_hash: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_data_consents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_personal_reference: {
        Args: { _email: string; _message?: string; _verification_id: string }
        Returns: {
          created_at: string
          id: string
          message: string | null
          referent_email: string
          referent_user_id: string
          requester_user_id: string
          responded_at: string | null
          status: string
          updated_at: string
          verification_id: string
        }
        SetofOptions: {
          from: "*"
          to: "renter_reference_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reservation_has_completed_payment: {
        Args: { _reservation_id: string }
        Returns: boolean
      }
      user_rating_summary: {
        Args: { _user_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
      vehicle_rating_summary: {
        Args: { _vehicle_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "banned"
      admin_action_type:
        | "warning_sent"
        | "suspended"
        | "banned"
        | "unsuspended"
        | "unbanned"
        | "verified"
        | "unverified"
        | "role_added"
        | "role_removed"
        | "deleted"
        | "note"
      app_role: "renter" | "owner" | "admin"
      application_status: "pending" | "approved" | "rejected"
      consent_type:
        | "telemetry"
        | "dynamic_pricing"
        | "fraud_prevention"
        | "ai_training"
      fraud_signal_type:
        | "multi_account"
        | "cancel_pattern"
        | "identity_mismatch"
        | "dispute"
        | "device_reuse"
        | "ip_burst"
      inspection_type: "pickup" | "return"
      payment_status:
        | "pending"
        | "submitted"
        | "completed"
        | "failed"
        | "refunded"
      renter_verification_status: "pending" | "approved" | "rejected"
      reservation_status:
        | "pending"
        | "awaiting_payment"
        | "approved"
        | "active"
        | "rejected"
        | "completed"
        | "cancelled"
      telemetry_event_type:
        | "harsh_brake"
        | "harsh_accel"
        | "speeding"
        | "night_drive"
        | "phone_use"
        | "trip_segment"
      ticket_category:
        | "reservas"
        | "pagos"
        | "aliados"
        | "cuenta"
        | "seguridad"
        | "otro"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      account_status: ["active", "suspended", "banned"],
      admin_action_type: [
        "warning_sent",
        "suspended",
        "banned",
        "unsuspended",
        "unbanned",
        "verified",
        "unverified",
        "role_added",
        "role_removed",
        "deleted",
        "note",
      ],
      app_role: ["renter", "owner", "admin"],
      application_status: ["pending", "approved", "rejected"],
      consent_type: [
        "telemetry",
        "dynamic_pricing",
        "fraud_prevention",
        "ai_training",
      ],
      fraud_signal_type: [
        "multi_account",
        "cancel_pattern",
        "identity_mismatch",
        "dispute",
        "device_reuse",
        "ip_burst",
      ],
      inspection_type: ["pickup", "return"],
      payment_status: [
        "pending",
        "submitted",
        "completed",
        "failed",
        "refunded",
      ],
      renter_verification_status: ["pending", "approved", "rejected"],
      reservation_status: [
        "pending",
        "awaiting_payment",
        "approved",
        "active",
        "rejected",
        "completed",
        "cancelled",
      ],
      telemetry_event_type: [
        "harsh_brake",
        "harsh_accel",
        "speeding",
        "night_drive",
        "phone_use",
        "trip_segment",
      ],
      ticket_category: [
        "reservas",
        "pagos",
        "aliados",
        "cuenta",
        "seguridad",
        "otro",
      ],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
