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
      approved_documents: {
        Row: {
          approved_by: string
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          organization_id: string
          summary: string
          tags: string[] | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          approved_by: string
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          organization_id: string
          summary: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          approved_by?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          organization_id?: string
          summary?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "approved_documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_sources: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          selected_channels: string[] | null
          selected_folders: string[] | null
          selected_team_channels: Json | null
          type: Database["public"]["Enums"]["source_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          selected_channels?: string[] | null
          selected_folders?: string[] | null
          selected_team_channels?: Json | null
          type: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          selected_channels?: string[] | null
          selected_folders?: string[] | null
          selected_team_channels?: Json | null
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          organization_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          organization_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approved_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          approved_at: string
          approved_by: string
          changes: string
          content: string
          created_at: string | null
          document_id: string
          id: string
          version: number
        }
        Insert: {
          approved_at: string
          approved_by: string
          changes: string
          content: string
          created_at?: string | null
          document_id: string
          id?: string
          version: number
        }
        Update: {
          approved_at?: string
          approved_by?: string
          changes?: string
          content?: string
          created_at?: string | null
          document_id?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approved_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_documents: {
        Row: {
          confidence_reasoning: string | null
          confidence_score: number
          content: string
          created_at: string | null
          id: string
          organization_id: string
          pii_entities_found: number | null
          processing_metadata: Json | null
          source_references: Json | null
          status: Database["public"]["Enums"]["document_status"] | null
          summary: string | null
          title: string
          topics: string[] | null
          triage_level: Database["public"]["Enums"]["triage_level"]
          updated_at: string | null
        }
        Insert: {
          confidence_reasoning?: string | null
          confidence_score: number
          content: string
          created_at?: string | null
          id?: string
          organization_id: string
          pii_entities_found?: number | null
          processing_metadata?: Json | null
          source_references?: Json | null
          status?: Database["public"]["Enums"]["document_status"] | null
          summary?: string | null
          title: string
          topics?: string[] | null
          triage_level: Database["public"]["Enums"]["triage_level"]
          updated_at?: string | null
        }
        Update: {
          confidence_reasoning?: string | null
          confidence_score?: number
          content?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          pii_entities_found?: number | null
          processing_metadata?: Json | null
          source_references?: Json | null
          status?: Database["public"]["Enums"]["document_status"] | null
          summary?: string | null
          title?: string
          topics?: string[] | null
          triage_level?: Database["public"]["Enums"]["triage_level"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      qa_interactions: {
        Row: {
          answer: string
          confidence: number
          created_at: string | null
          id: string
          organization_id: string
          question: string
          sources: Json | null
          user_id: string
        }
        Insert: {
          answer: string
          confidence: number
          created_at?: string | null
          id?: string
          organization_id: string
          question: string
          sources?: Json | null
          user_id: string
        }
        Update: {
          answer?: string
          confidence?: number
          created_at?: string | null
          id?: string
          organization_id?: string
          question?: string
          sources?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          created_at: string | null
          draft_document_id: string
          id: string
          metadata: Json | null
          original_content: string
          redacted_content: string
          source_id: string
          source_type: Database["public"]["Enums"]["source_type"]
        }
        Insert: {
          created_at?: string | null
          draft_document_id: string
          id?: string
          metadata?: Json | null
          original_content: string
          redacted_content: string
          source_id: string
          source_type: Database["public"]["Enums"]["source_type"]
        }
        Update: {
          created_at?: string | null
          draft_document_id?: string
          id?: string
          metadata?: Json | null
          original_content?: string
          redacted_content?: string
          source_id?: string
          source_type?: Database["public"]["Enums"]["source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_draft_document_id_fkey"
            columns: ["draft_document_id"]
            isOneToOne: false
            referencedRelation: "draft_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          organization_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_document_chunks: {
        Args: { chunks_data: Json; doc_id: string }
        Returns: undefined
      }
      get_document_stats: {
        Args: { org_id?: string }
        Returns: {
          avg_confidence_score: number
          pending_approvals: number
          total_approved_documents: number
          total_draft_documents: number
          total_qa_interactions: number
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      hybrid_search: {
        Args: {
          match_count?: number
          match_threshold?: number
          organization_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          source_type: string
          title: string
        }[]
      }
      is_manager: { Args: never; Returns: boolean }
      match_document_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          organization_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          document_title: string
          id: string
          similarity: number
        }[]
      }
      match_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          organization_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      update_document_embedding: {
        Args: { doc_id: string; new_embedding: string }
        Returns: undefined
      }
    }
    Enums: {
      document_status: "pending" | "approved" | "rejected"
      source_type: "teams" | "google_drive"
      triage_level: "green" | "yellow" | "red"
      user_role: "manager" | "employee"
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
      document_status: ["pending", "approved", "rejected"],
      source_type: ["teams", "google_drive"],
      triage_level: ["green", "yellow", "red"],
      user_role: ["manager", "employee"],
    },
  },
} as const