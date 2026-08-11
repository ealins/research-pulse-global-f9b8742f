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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          institution_id: string
          is_demo: boolean
          last_verified_at: string | null
          name: string
          slug: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          institution_id: string
          is_demo?: boolean
          last_verified_at?: string | null
          name: string
          slug: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          name?: string
          slug?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          abbreviation: string | null
          active: boolean
          careers_url: string | null
          city: string | null
          continent: string | null
          country: string | null
          country_code: string | null
          created_at: string
          description: string | null
          id: string
          institution_identifier: string | null
          institution_type: Database["public"]["Enums"]["institution_type"]
          is_demo: boolean
          last_verified_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          official_url: string | null
          openalex_id: string | null
          research_url: string | null
          slug: string
          updated_at: string
          updated_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          abbreviation?: string | null
          active?: boolean
          careers_url?: string | null
          city?: string | null
          continent?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          institution_identifier?: string | null
          institution_type?: Database["public"]["Enums"]["institution_type"]
          is_demo?: boolean
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          official_url?: string | null
          openalex_id?: string | null
          research_url?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          abbreviation?: string | null
          active?: boolean
          careers_url?: string | null
          city?: string | null
          continent?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          institution_identifier?: string | null
          institution_type?: Database["public"]["Enums"]["institution_type"]
          is_demo?: boolean
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          official_url?: string | null
          openalex_id?: string | null
          research_url?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      organizations: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          org_type?: Database["public"]["Enums"]["org_type"]
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      research_groups: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          institution_id: string
          is_demo: boolean
          last_verified_at: string | null
          name: string
          slug: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          website: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          institution_id: string
          is_demo?: boolean
          last_verified_at?: string | null
          name: string
          slug: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          institution_id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          name?: string
          slug?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_groups_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_groups_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_topics: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_roles: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          institution_id: string | null
          is_demo: boolean
          is_leadership: boolean
          last_verified_at: string | null
          researcher_id: string
          role: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          is_leadership?: boolean
          last_verified_at?: string | null
          researcher_id: string
          role: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          is_leadership?: boolean
          last_verified_at?: string | null
          researcher_id?: string
          role?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "researcher_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_roles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_roles_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      researchers: {
        Row: {
          academic_title: string | null
          active: boolean
          created_at: string
          current_position: string | null
          department_id: string | null
          full_name: string
          google_scholar_url: string | null
          id: string
          institution_id: string | null
          is_demo: boolean
          last_verified_at: string | null
          normalized_name: string | null
          official_profile_url: string | null
          openalex_author_id: string | null
          orcid: string | null
          research_group_id: string | null
          research_summary: string | null
          semantic_scholar_id: string | null
          slug: string
          updated_at: string
          updated_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          academic_title?: string | null
          active?: boolean
          created_at?: string
          current_position?: string | null
          department_id?: string | null
          full_name: string
          google_scholar_url?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          last_verified_at?: string | null
          normalized_name?: string | null
          official_profile_url?: string | null
          openalex_author_id?: string | null
          orcid?: string | null
          research_group_id?: string | null
          research_summary?: string | null
          semantic_scholar_id?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          academic_title?: string | null
          active?: boolean
          created_at?: string
          current_position?: string | null
          department_id?: string | null
          full_name?: string
          google_scholar_url?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          last_verified_at?: string | null
          normalized_name?: string | null
          official_profile_url?: string | null
          openalex_author_id?: string | null
          orcid?: string | null
          research_group_id?: string | null
          research_summary?: string | null
          semantic_scholar_id?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "researchers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researchers_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researchers_research_group_id_fkey"
            columns: ["research_group_id"]
            isOneToOne: false
            referencedRelation: "research_groups"
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
          role: Database["public"]["Enums"]["app_role"]
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
      is_admin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
      confidence_level: "high" | "medium" | "low"
      institution_type:
        | "university"
        | "research_institute"
        | "university_lab"
        | "government_agency"
        | "company"
        | "consortium"
        | "other"
      opportunity_status:
        | "open"
        | "closing_soon"
        | "rolling"
        | "possibly_open"
        | "closed"
        | "archived"
      opportunity_type:
        | "phd"
        | "doctoral_researcher"
        | "research_assistant"
        | "postdoc"
        | "other"
      org_type:
        | "funder"
        | "industry"
        | "society"
        | "government"
        | "ngo"
        | "other"
      project_status:
        | "planned"
        | "active"
        | "recently_completed"
        | "completed"
        | "unknown"
      pulse_category:
        | "PHD"
        | "PROJECT"
        | "PAPER"
        | "DATASET"
        | "DISSERTATION"
        | "EVENT"
        | "PEOPLE"
        | "STANDARD"
        | "FUNDING"
      source_type:
        | "institution"
        | "careers_page"
        | "research_group"
        | "api"
        | "rss"
        | "conference"
        | "society"
        | "project"
        | "publication_database"
        | "other"
      verification_status:
        | "verified"
        | "auto_discovered"
        | "needs_review"
        | "possibly_outdated"
        | "closed"
        | "archived"
        | "unverified"
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
      app_role: ["admin", "user"],
      confidence_level: ["high", "medium", "low"],
      institution_type: [
        "university",
        "research_institute",
        "university_lab",
        "government_agency",
        "company",
        "consortium",
        "other",
      ],
      opportunity_status: [
        "open",
        "closing_soon",
        "rolling",
        "possibly_open",
        "closed",
        "archived",
      ],
      opportunity_type: [
        "phd",
        "doctoral_researcher",
        "research_assistant",
        "postdoc",
        "other",
      ],
      org_type: ["funder", "industry", "society", "government", "ngo", "other"],
      project_status: [
        "planned",
        "active",
        "recently_completed",
        "completed",
        "unknown",
      ],
      pulse_category: [
        "PHD",
        "PROJECT",
        "PAPER",
        "DATASET",
        "DISSERTATION",
        "EVENT",
        "PEOPLE",
        "STANDARD",
        "FUNDING",
      ],
      source_type: [
        "institution",
        "careers_page",
        "research_group",
        "api",
        "rss",
        "conference",
        "society",
        "project",
        "publication_database",
        "other",
      ],
      verification_status: [
        "verified",
        "auto_discovered",
        "needs_review",
        "possibly_outdated",
        "closed",
        "archived",
        "unverified",
      ],
    },
  },
} as const
