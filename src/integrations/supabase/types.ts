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
      academic_changes: {
        Row: {
          change_type: string
          created_at: string
          details: Json
          detected_at: string
          entity_id: string | null
          entity_type: string
          id: string
          source_id: string | null
          summary: string | null
          title: string
        }
        Insert: {
          change_type: string
          created_at?: string
          details?: Json
          detected_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          source_id?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          change_type?: string
          created_at?: string
          details?: Json
          detected_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          source_id?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_changes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "public_source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_changes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_matches: {
        Row: {
          alert_rule_id: string
          entity_id: string
          entity_type: string
          fingerprint: string
          id: string
          matched_at: string
          seen: boolean
          user_id: string
        }
        Insert: {
          alert_rule_id: string
          entity_id: string
          entity_type: string
          fingerprint: string
          id?: string
          matched_at?: string
          seen?: boolean
          user_id: string
        }
        Update: {
          alert_rule_id?: string
          entity_id?: string
          entity_type?: string
          fingerprint?: string
          id?: string
          matched_at?: string
          seen?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_matches_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          active: boolean
          countries: string[]
          created_at: string
          id: string
          institution_ids: string[]
          keywords: string[]
          last_run_at: string | null
          name: string
          opportunity_types: Database["public"]["Enums"]["opportunity_type"][]
          researcher_ids: string[]
          topic_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          countries?: string[]
          created_at?: string
          id?: string
          institution_ids?: string[]
          keywords?: string[]
          last_run_at?: string | null
          name: string
          opportunity_types?: Database["public"]["Enums"]["opportunity_type"][]
          researcher_ids?: string[]
          topic_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          countries?: string[]
          created_at?: string
          id?: string
          institution_ids?: string[]
          keywords?: string[]
          last_run_at?: string | null
          name?: string
          opportunity_types?: Database["public"]["Enums"]["opportunity_type"][]
          researcher_ids?: string[]
          topic_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      collaboration_edges: {
        Row: {
          created_at: string
          edge_type: string
          evidence_url: string
          id: string
          is_demo: boolean
          source_entity_id: string
          source_entity_type: string
          target_entity_id: string
          target_entity_type: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          weight: number
        }
        Insert: {
          created_at?: string
          edge_type: string
          evidence_url: string
          id?: string
          is_demo?: boolean
          source_entity_id: string
          source_entity_type: string
          target_entity_id: string
          target_entity_type: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          weight?: number
        }
        Update: {
          created_at?: string
          edge_type?: string
          evidence_url?: string
          id?: string
          is_demo?: boolean
          source_entity_id?: string
          source_entity_type?: string
          target_entity_id?: string
          target_entity_type?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          weight?: number
        }
        Relationships: []
      }
      course_researchers: {
        Row: {
          course_id: string
          researcher_id: string
        }
        Insert: {
          course_id: string
          researcher_id: string
        }
        Update: {
          course_id?: string
          researcher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_researchers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_researchers_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      course_topics: {
        Row: {
          course_id: string
          topic_id: string
        }
        Insert: {
          course_id: string
          topic_id: string
        }
        Update: {
          course_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          degree_type: string | null
          department_id: string | null
          duration: string | null
          id: string
          institution_id: string | null
          is_demo: boolean
          language: string | null
          last_verified_at: string | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          website: string | null
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          degree_type?: string | null
          department_id?: string | null
          duration?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          language?: string | null
          last_verified_at?: string | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          degree_type?: string | null
          department_id?: string | null
          duration?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          language?: string | null
          last_verified_at?: string | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
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
      duplicate_candidates: {
        Row: {
          created_at: string
          duplicate_id: string
          entity_type: string
          id: string
          match_reason: string | null
          primary_id: string
          resolution: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          score: number | null
        }
        Insert: {
          created_at?: string
          duplicate_id: string
          entity_type: string
          id?: string
          match_reason?: string | null
          primary_id: string
          resolution?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number | null
        }
        Update: {
          created_at?: string
          duplicate_id?: string
          entity_type?: string
          id?: string
          match_reason?: string | null
          primary_id?: string
          resolution?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          score?: number | null
        }
        Relationships: []
      }
      entity_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          source_url: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          source_url?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      entity_metrics: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          metric: string
          metric_source: string
          retrieved_at: string
          value: number | null
          value_text: string | null
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          metric: string
          metric_source: string
          retrieved_at?: string
          value?: number | null
          value_text?: string | null
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          metric?: string
          metric_source?: string
          retrieved_at?: string
          value?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      event_institutions: {
        Row: {
          event_id: string
          institution_id: string
        }
        Insert: {
          event_id: string
          institution_id: string
        }
        Update: {
          event_id?: string
          institution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_institutions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_institutions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_topics: {
        Row: {
          event_id: string
          topic_id: string
        }
        Insert: {
          event_id: string
          topic_id: string
        }
        Update: {
          event_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_topics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          abstract_deadline: string | null
          confidence: Database["public"]["Enums"]["confidence_level"]
          country: string | null
          created_at: string
          end_date: string | null
          event_kind: string
          id: string
          is_demo: boolean
          last_verified_at: string | null
          location: string | null
          organization: string | null
          paper_deadline: string | null
          recurrence: string | null
          registration_deadline: string | null
          slug: string
          source: string | null
          start_date: string | null
          summary: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          website: string | null
        }
        Insert: {
          abstract_deadline?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          country?: string | null
          created_at?: string
          end_date?: string | null
          event_kind?: string
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          location?: string | null
          organization?: string | null
          paper_deadline?: string | null
          recurrence?: string | null
          registration_deadline?: string | null
          slug: string
          source?: string | null
          start_date?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Update: {
          abstract_deadline?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          country?: string | null
          created_at?: string
          end_date?: string | null
          event_kind?: string
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          location?: string | null
          organization?: string | null
          paper_deadline?: string | null
          recurrence?: string | null
          registration_deadline?: string | null
          slug?: string
          source?: string | null
          start_date?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Relationships: []
      }
      ingestion_tasks: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          institution_id: string | null
          last_error: string | null
          max_attempts: number
          payload: Json
          run_after: string
          source_id: string | null
          started_at: string | null
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          source_id?: string | null
          started_at?: string | null
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          source_id?: string | null
          started_at?: string | null
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_tasks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_tasks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "public_source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_tasks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_topics: {
        Row: {
          institution_id: string
          topic_id: string
          weight: number
        }
        Insert: {
          institution_id: string
          topic_id: string
          weight?: number
        }
        Update: {
          institution_id?: string
          topic_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "institution_topics_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
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
      llm_processing_runs: {
        Row: {
          attempt: number
          cached: boolean
          completed_at: string | null
          content_hash: string | null
          content_reduced: boolean
          created_at: string
          error_code: string | null
          error_message: string | null
          http_status: number | null
          id: string
          input_characters: number
          latency_ms: number | null
          model: string
          operation: string
          output_characters: number
          provider: string
          raw_page_id: string | null
          result: Json | null
          source_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          attempt?: number
          cached?: boolean
          completed_at?: string | null
          content_hash?: string | null
          content_reduced?: boolean
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          input_characters?: number
          latency_ms?: number | null
          model: string
          operation: string
          output_characters?: number
          provider?: string
          raw_page_id?: string | null
          result?: Json | null
          source_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          attempt?: number
          cached?: boolean
          completed_at?: string | null
          content_hash?: string | null
          content_reduced?: boolean
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          input_characters?: number
          latency_ms?: number | null
          model?: string
          operation?: string
          output_characters?: number
          provider?: string
          raw_page_id?: string | null
          result?: Json | null
          source_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_processing_runs_raw_page_id_fkey"
            columns: ["raw_page_id"]
            isOneToOne: false
            referencedRelation: "raw_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_processing_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "public_source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_processing_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          application_deadline: string | null
          application_url: string | null
          city: string | null
          confidence: Database["public"]["Enums"]["confidence_level"]
          country: string | null
          created_at: string
          dedupe_key: string | null
          department_id: string | null
          description: string | null
          employer_name: string | null
          extracted_by: string
          extraction_confidence: number | null
          extraction_model: string | null
          extraction_timestamp: string | null
          first_discovered_at: string
          funding_type: string | null
          id: string
          institution_id: string | null
          is_demo: boolean
          last_checked_at: string | null
          last_verified_at: string | null
          normalized_title: string | null
          official_source_url: string | null
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          project_id: string | null
          requirements: string | null
          research_group_id: string | null
          salary_text: string | null
          sector: string
          seniority: string | null
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          supervisor_id: string | null
          supervisor_name: string | null
          title: string
          updated_at: string
          updated_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          application_deadline?: string | null
          application_url?: string | null
          city?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          country?: string | null
          created_at?: string
          dedupe_key?: string | null
          department_id?: string | null
          description?: string | null
          employer_name?: string | null
          extracted_by?: string
          extraction_confidence?: number | null
          extraction_model?: string | null
          extraction_timestamp?: string | null
          first_discovered_at?: string
          funding_type?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          last_checked_at?: string | null
          last_verified_at?: string | null
          normalized_title?: string | null
          official_source_url?: string | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          project_id?: string | null
          requirements?: string | null
          research_group_id?: string | null
          salary_text?: string | null
          sector?: string
          seniority?: string | null
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          supervisor_id?: string | null
          supervisor_name?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          application_deadline?: string | null
          application_url?: string | null
          city?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          country?: string | null
          created_at?: string
          dedupe_key?: string | null
          department_id?: string | null
          description?: string | null
          employer_name?: string | null
          extracted_by?: string
          extraction_confidence?: number | null
          extraction_model?: string | null
          extraction_timestamp?: string | null
          first_discovered_at?: string
          funding_type?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          last_checked_at?: string | null
          last_verified_at?: string | null
          normalized_title?: string | null
          official_source_url?: string | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          project_id?: string | null
          requirements?: string | null
          research_group_id?: string | null
          salary_text?: string | null
          sector?: string
          seniority?: string | null
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          supervisor_id?: string | null
          supervisor_name?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_research_group_id_fkey"
            columns: ["research_group_id"]
            isOneToOne: false
            referencedRelation: "research_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_topics: {
        Row: {
          opportunity_id: string
          topic_id: string
        }
        Insert: {
          opportunity_id: string
          topic_id: string
        }
        Update: {
          opportunity_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_topics_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
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
      pipeline_runs: {
        Row: {
          created_at: string
          details: Json
          duration_ms: number | null
          error_message: string | null
          errors: number
          fetch_enqueued: number
          finished_at: string | null
          id: string
          nvidia_cached: number
          nvidia_calls: number
          records_created: number
          records_updated: number
          started_at: string
          tasks_dead: number
          tasks_failed: number
          tasks_ok: number
          tasks_processed: number
          trigger: string
        }
        Insert: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          errors?: number
          fetch_enqueued?: number
          finished_at?: string | null
          id?: string
          nvidia_cached?: number
          nvidia_calls?: number
          records_created?: number
          records_updated?: number
          started_at?: string
          tasks_dead?: number
          tasks_failed?: number
          tasks_ok?: number
          tasks_processed?: number
          trigger?: string
        }
        Update: {
          created_at?: string
          details?: Json
          duration_ms?: number | null
          error_message?: string | null
          errors?: number
          fetch_enqueued?: number
          finished_at?: string | null
          id?: string
          nvidia_cached?: number
          nvidia_calls?: number
          records_created?: number
          records_updated?: number
          started_at?: string
          tasks_dead?: number
          tasks_failed?: number
          tasks_ok?: number
          tasks_processed?: number
          trigger?: string
        }
        Relationships: []
      }
      pipeline_settings: {
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
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          career_stage: string | null
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          career_stage?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          career_stage?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      project_institutions: {
        Row: {
          institution_id: string
          project_id: string
          role: string | null
        }
        Insert: {
          institution_id: string
          project_id: string
          role?: string | null
        }
        Update: {
          institution_id?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_institutions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_institutions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_organizations: {
        Row: {
          organization_id: string
          project_id: string
          role: string | null
        }
        Insert: {
          organization_id: string
          project_id: string
          role?: string | null
        }
        Update: {
          organization_id?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_organizations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_researchers: {
        Row: {
          project_id: string
          researcher_id: string
          role: string | null
        }
        Insert: {
          project_id: string
          researcher_id: string
          role?: string | null
        }
        Update: {
          project_id?: string
          researcher_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_researchers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_researchers_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_topics: {
        Row: {
          project_id: string
          topic_id: string
        }
        Insert: {
          project_id: string
          topic_id: string
        }
        Update: {
          project_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_topics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          acronym: string | null
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          department_id: string | null
          end_date: string | null
          funder_id: string | null
          funding_amount: number | null
          funding_currency: string | null
          funding_organization: string | null
          id: string
          institution_id: string | null
          is_demo: boolean
          last_verified_at: string | null
          name: string
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          summary: string | null
          updated_at: string
          updated_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          website: string | null
        }
        Insert: {
          acronym?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          department_id?: string | null
          end_date?: string | null
          funder_id?: string | null
          funding_amount?: number | null
          funding_currency?: string | null
          funding_organization?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          last_verified_at?: string | null
          name: string
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Update: {
          acronym?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          department_id?: string | null
          end_date?: string | null
          funder_id?: string | null
          funding_amount?: number | null
          funding_currency?: string | null
          funding_organization?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          last_verified_at?: string | null
          name?: string
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_funder_id_fkey"
            columns: ["funder_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_institutions: {
        Row: {
          institution_id: string
          publication_id: string
        }
        Insert: {
          institution_id: string
          publication_id: string
        }
        Update: {
          institution_id?: string
          publication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_institutions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_institutions_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_researchers: {
        Row: {
          author_position: number | null
          publication_id: string
          researcher_id: string
        }
        Insert: {
          author_position?: number | null
          publication_id: string
          researcher_id: string
        }
        Update: {
          author_position?: number | null
          publication_id?: string
          researcher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_researchers_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_researchers_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_topics: {
        Row: {
          publication_id: string
          topic_id: string
        }
        Insert: {
          publication_id: string
          topic_id: string
        }
        Update: {
          publication_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_topics_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          abstract: string | null
          authors_text: string | null
          citation_count: number | null
          citation_source: string | null
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          doi: string | null
          external_id: string | null
          id: string
          institution_id: string | null
          is_demo: boolean
          is_open_access: boolean | null
          landing_url: string | null
          last_verified_at: string | null
          normalized_title: string | null
          publication_date: string | null
          source: string | null
          title: string
          updated_at: string
          venue: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors_text?: string | null
          citation_count?: number | null
          citation_source?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          doi?: string | null
          external_id?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          is_open_access?: boolean | null
          landing_url?: string | null
          last_verified_at?: string | null
          normalized_title?: string | null
          publication_date?: string | null
          source?: string | null
          title: string
          updated_at?: string
          venue?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors_text?: string | null
          citation_count?: number | null
          citation_source?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          doi?: string | null
          external_id?: string | null
          id?: string
          institution_id?: string | null
          is_demo?: boolean
          is_open_access?: boolean | null
          landing_url?: string | null
          last_verified_at?: string | null
          normalized_title?: string | null
          publication_date?: string | null
          source?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "publications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_event_topics: {
        Row: {
          pulse_event_id: string
          topic_id: string
        }
        Insert: {
          pulse_event_id: string
          topic_id: string
        }
        Update: {
          pulse_event_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_event_topics_pulse_event_id_fkey"
            columns: ["pulse_event_id"]
            isOneToOne: false
            referencedRelation: "pulse_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_event_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_events: {
        Row: {
          category: Database["public"]["Enums"]["pulse_category"]
          confidence: Database["public"]["Enums"]["confidence_level"]
          country: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_date: string
          id: string
          importance: number
          institution_id: string | null
          is_demo: boolean
          link_url: string | null
          researcher_id: string | null
          source_url: string | null
          summary: string | null
          title: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          category: Database["public"]["Enums"]["pulse_category"]
          confidence?: Database["public"]["Enums"]["confidence_level"]
          country?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_date?: string
          id?: string
          importance?: number
          institution_id?: string | null
          is_demo?: boolean
          link_url?: string | null
          researcher_id?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          category?: Database["public"]["Enums"]["pulse_category"]
          confidence?: Database["public"]["Enums"]["confidence_level"]
          country?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_date?: string
          id?: string
          importance?: number
          institution_id?: string | null
          is_demo?: boolean
          link_url?: string | null
          researcher_id?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pulse_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_events_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_records: {
        Row: {
          adapter_key: string
          canonical_entity_id: string | null
          canonical_entity_type: string | null
          classification: string | null
          classification_confidence: number | null
          content_hash: string | null
          external_id: string | null
          fetched_at: string
          final_url: string | null
          http_status: number | null
          id: string
          institution_id: string | null
          normalization_error: string | null
          normalization_status: string | null
          page_title: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          source_id: string | null
          source_url: string | null
          text_content: string | null
        }
        Insert: {
          adapter_key: string
          canonical_entity_id?: string | null
          canonical_entity_type?: string | null
          classification?: string | null
          classification_confidence?: number | null
          content_hash?: string | null
          external_id?: string | null
          fetched_at?: string
          final_url?: string | null
          http_status?: number | null
          id?: string
          institution_id?: string | null
          normalization_error?: string | null
          normalization_status?: string | null
          page_title?: string | null
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          source_id?: string | null
          source_url?: string | null
          text_content?: string | null
        }
        Update: {
          adapter_key?: string
          canonical_entity_id?: string | null
          canonical_entity_type?: string | null
          classification?: string | null
          classification_confidence?: number | null
          content_hash?: string | null
          external_id?: string | null
          fetched_at?: string
          final_url?: string | null
          http_status?: number | null
          id?: string
          institution_id?: string | null
          normalization_error?: string | null
          normalization_status?: string | null
          page_title?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          source_id?: string | null
          source_url?: string | null
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_records_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "public_source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      record_sources: {
        Row: {
          claim: string | null
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          discovered_at: string
          entity_id: string
          entity_type: string
          id: string
          is_primary: boolean
          last_checked_at: string | null
          last_verified_at: string | null
          original_title: string | null
          source_id: string | null
          source_organization: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          source_url: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          claim?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          discovered_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_verified_at?: string | null
          original_title?: string | null
          source_id?: string | null
          source_organization?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          claim?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          discovered_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_verified_at?: string | null
          original_title?: string | null
          source_id?: string | null
          source_organization?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "record_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "public_source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
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
      researcher_topics: {
        Row: {
          researcher_id: string
          topic_id: string
          weight: number
        }
        Insert: {
          researcher_id: string
          topic_id: string
          weight?: number
        }
        Update: {
          researcher_id?: string
          topic_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "researcher_topics_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
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
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          target: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          target?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          target?: string
          user_id?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          active: boolean
          adapter_key: string | null
          canonical_url: string | null
          category: string | null
          created_at: string
          discovered_from: string | null
          id: string
          institution_id: string | null
          last_error: string | null
          last_failure_at: string | null
          last_http_status: number | null
          last_success_at: string | null
          name: string
          notes: string | null
          organization: string | null
          priority: number
          refresh_frequency_hours: number
          source_type: Database["public"]["Enums"]["source_type"]
          status: string
          trust_level: number
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          adapter_key?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string
          discovered_from?: string | null
          id?: string
          institution_id?: string | null
          last_error?: string | null
          last_failure_at?: string | null
          last_http_status?: number | null
          last_success_at?: string | null
          name: string
          notes?: string | null
          organization?: string | null
          priority?: number
          refresh_frequency_hours?: number
          source_type?: Database["public"]["Enums"]["source_type"]
          status?: string
          trust_level?: number
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          adapter_key?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string
          discovered_from?: string | null
          id?: string
          institution_id?: string | null
          last_error?: string | null
          last_failure_at?: string | null
          last_http_status?: number | null
          last_success_at?: string | null
          name?: string
          notes?: string | null
          organization?: string | null
          priority?: number
          refresh_frequency_hours?: number
          source_type?: Database["public"]["Enums"]["source_type"]
          status?: string
          trust_level?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          adapter_key: string
          duplicates_detected: number
          error_message: string | null
          errors: number
          finished_at: string | null
          id: string
          records_changed: number
          records_closed: number
          records_discovered: number
          response_time_ms: number | null
          source_id: string | null
          started_at: string
          success: boolean | null
        }
        Insert: {
          adapter_key: string
          duplicates_detected?: number
          error_message?: string | null
          errors?: number
          finished_at?: string | null
          id?: string
          records_changed?: number
          records_closed?: number
          records_discovered?: number
          response_time_ms?: number | null
          source_id?: string | null
          started_at?: string
          success?: boolean | null
        }
        Update: {
          adapter_key?: string
          duplicates_detected?: number
          error_message?: string | null
          errors?: number
          finished_at?: string | null
          id?: string
          records_changed?: number
          records_closed?: number
          records_discovered?: number
          response_time_ms?: number | null
          source_id?: string | null
          started_at?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "public_source_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_momentum: {
        Row: {
          active_projects: number
          computed_at: string
          growth_ratio: number | null
          id: string
          institutions_active: number
          open_opportunities: number
          pubs_last_12m: number
          pubs_last_36m: number
          pubs_prev_12m: number
          topic_id: string
          trend_signal: number | null
        }
        Insert: {
          active_projects?: number
          computed_at?: string
          growth_ratio?: number | null
          id?: string
          institutions_active?: number
          open_opportunities?: number
          pubs_last_12m?: number
          pubs_last_36m?: number
          pubs_prev_12m?: number
          topic_id: string
          trend_signal?: number | null
        }
        Update: {
          active_projects?: number
          computed_at?: string
          growth_ratio?: number | null
          id?: string
          institutions_active?: number
          open_opportunities?: number
          pubs_last_12m?: number
          pubs_last_36m?: number
          pubs_prev_12m?: number
          topic_id?: string
          trend_signal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_momentum_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: true
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string
          topic_id: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          topic_id: string
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          topic_id?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          countries: string[]
          created_at: string
          desired_start_year: number | null
          funding_preference: string | null
          method_vs_application: number
          region_scope: string
          salaried_preferred: boolean
          updated_at: string
          user_id: string
          weight_ecosystem: number
          weight_opportunity: number
          weight_projects: number
          weight_publications: number
          weight_supervisor: number
          weight_topic_fit: number
        }
        Insert: {
          countries?: string[]
          created_at?: string
          desired_start_year?: number | null
          funding_preference?: string | null
          method_vs_application?: number
          region_scope?: string
          salaried_preferred?: boolean
          updated_at?: string
          user_id: string
          weight_ecosystem?: number
          weight_opportunity?: number
          weight_projects?: number
          weight_publications?: number
          weight_supervisor?: number
          weight_topic_fit?: number
        }
        Update: {
          countries?: string[]
          created_at?: string
          desired_start_year?: number | null
          funding_preference?: string | null
          method_vs_application?: number
          region_scope?: string
          salaried_preferred?: boolean
          updated_at?: string
          user_id?: string
          weight_ecosystem?: number
          weight_opportunity?: number
          weight_projects?: number
          weight_publications?: number
          weight_supervisor?: number
          weight_topic_fit?: number
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
      watchlist_items: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          label: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          label?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          label?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_record_sources: {
        Row: {
          claim: string | null
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          discovered_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          is_primary: boolean | null
          last_checked_at: string | null
          last_verified_at: string | null
          original_title: string | null
          source_organization: string | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          source_url: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          claim?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          discovered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          is_primary?: boolean | null
          last_checked_at?: string | null
          last_verified_at?: string | null
          original_title?: string | null
          source_organization?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          claim?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          discovered_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
          is_primary?: boolean | null
          last_checked_at?: string | null
          last_verified_at?: string | null
          original_title?: string | null
          source_organization?: string | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          source_url?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
      public_source_registry: {
        Row: {
          active: boolean | null
          id: string | null
          name: string | null
          organization: string | null
          refresh_frequency_hours: number | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          trust_level: number | null
          url: string | null
        }
        Insert: {
          active?: boolean | null
          id?: string | null
          name?: string | null
          organization?: string | null
          refresh_frequency_hours?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          trust_level?: number | null
          url?: string | null
        }
        Update: {
          active?: boolean | null
          id?: string | null
          name?: string | null
          organization?: string | null
          refresh_frequency_hours?: number | null
          source_type?: Database["public"]["Enums"]["source_type"] | null
          trust_level?: number | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_admin_if_unclaimed:
        | { Args: never; Returns: boolean }
        | { Args: { target_user_id: string }; Returns: boolean }
      global_search: {
        Args: { max_results?: number; q: string }
        Returns: {
          entity_id: string
          entity_type: string
          score: number
          slug: string
          subtitle: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      public_surface_counts: { Args: never; Returns: Json }
      refresh_collaboration_edges: { Args: never; Returns: Json }
      refresh_public_insights: { Args: never; Returns: Json }
      refresh_topic_momentum: { Args: never; Returns: number }
      scheduler_status: { Args: never; Returns: Json }
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
