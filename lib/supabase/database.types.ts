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
      challenge_result_members: {
        Row: {
          challenge_id: string
          score: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          score: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_result_members_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_results"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "challenge_result_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_results: {
        Row: {
          calculation_version: string
          challenge_id: string
          finalized_at: string
          outcome: string
          shared_score: number
          winner_user_id: string | null
        }
        Insert: {
          calculation_version: string
          challenge_id: string
          finalized_at?: string
          outcome: string
          shared_score: number
          winner_user_id?: string | null
        }
        Update: {
          calculation_version?: string
          challenge_id?: string
          finalized_at?: string
          outcome?: string
          shared_score?: number
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_results_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: true
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_results_winner_user_id_fkey"
            columns: ["winner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string
          duo_id: string
          end_date: string
          id: string
          linked_goal_id: string
          metric: string
          mode: string
          name: string
          reward: string | null
          start_date: string
          status: string
          target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          duo_id: string
          end_date: string
          id?: string
          linked_goal_id: string
          metric: string
          mode: string
          name: string
          reward?: string | null
          start_date: string
          status?: string
          target: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duo_id?: string
          end_date?: string
          id?: string
          linked_goal_id?: string
          metric?: string
          mode?: string
          name?: string
          reward?: string | null
          start_date?: string
          status?: string
          target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_duo_id_created_by_fkey"
            columns: ["duo_id", "created_by"]
            isOneToOne: false
            referencedRelation: "duo_members"
            referencedColumns: ["duo_id", "user_id"]
          },
          {
            foreignKeyName: "challenges_duo_id_fkey"
            columns: ["duo_id"]
            isOneToOne: false
            referencedRelation: "duos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_linked_goal_id_duo_id_fkey"
            columns: ["linked_goal_id", "duo_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "duo_id"]
          },
        ]
      }
      duo_members: {
        Row: {
          duo_id: string
          joined_at: string
          slot: number
          user_id: string
        }
        Insert: {
          duo_id: string
          joined_at?: string
          slot: number
          user_id: string
        }
        Update: {
          duo_id?: string
          joined_at?: string
          slot?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duo_members_duo_id_fkey"
            columns: ["duo_id"]
            isOneToOne: false
            referencedRelation: "duos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duo_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duo_pets: {
        Row: {
          created_at: string
          duo_id: string
          equipped_accessory_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duo_id: string
          equipped_accessory_id?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duo_id?: string
          equipped_accessory_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duo_pets_duo_id_fkey"
            columns: ["duo_id"]
            isOneToOne: true
            referencedRelation: "duos"
            referencedColumns: ["id"]
          },
        ]
      }
      duos: {
        Row: {
          created_at: string
          created_by: string
          display_name: string | null
          id: string
          invite_code: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          display_name?: string | null
          id?: string
          invite_code?: string
          timezone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          display_name?: string | null
          id?: string
          invite_code?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_assignments: {
        Row: {
          active_from: string
          active_until: string | null
          canonical_unit: string | null
          created_at: string
          goal_id: string
          id: string
          target_value: number | null
          user_id: string
        }
        Insert: {
          active_from: string
          active_until?: string | null
          canonical_unit?: string | null
          created_at?: string
          goal_id: string
          id?: string
          target_value?: number | null
          user_id: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          canonical_unit?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          target_value?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_assignments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_checkins: {
        Row: {
          assignment_id: string
          completed: boolean | null
          created_at: string
          goal_id: string
          id: string
          local_date: string
          target_snapshot: number | null
          tracking_snapshot: string
          unit_snapshot: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          assignment_id: string
          completed?: boolean | null
          created_at?: string
          goal_id: string
          id?: string
          local_date: string
          target_snapshot?: number | null
          tracking_snapshot: string
          unit_snapshot?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          assignment_id?: string
          completed?: boolean | null
          created_at?: string
          goal_id?: string
          id?: string
          local_date?: string
          target_snapshot?: number | null
          tracking_snapshot?: string
          unit_snapshot?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_checkins_assignment_id_goal_id_user_id_fkey"
            columns: ["assignment_id", "goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goal_assignments"
            referencedColumns: ["id", "goal_id", "user_id"]
          },
          {
            foreignKeyName: "goal_checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          display_unit: string | null
          duo_id: string
          icon_key: string
          id: string
          measurement_kind: string | null
          name: string
          notes: string | null
          owner_user_id: string | null
          scope: string
          status: string
          tracking_type: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          display_unit?: string | null
          duo_id: string
          icon_key?: string
          id?: string
          measurement_kind?: string | null
          name: string
          notes?: string | null
          owner_user_id?: string | null
          scope: string
          status?: string
          tracking_type: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          display_unit?: string | null
          duo_id?: string
          icon_key?: string
          id?: string
          measurement_kind?: string | null
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          scope?: string
          status?: string
          tracking_type?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_duo_id_created_by_fkey"
            columns: ["duo_id", "created_by"]
            isOneToOne: false
            referencedRelation: "duo_members"
            referencedColumns: ["duo_id", "user_id"]
          },
          {
            foreignKeyName: "goals_duo_id_fkey"
            columns: ["duo_id"]
            isOneToOne: false
            referencedRelation: "duos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_duo_id_owner_user_id_fkey"
            columns: ["duo_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "duo_members"
            referencedColumns: ["duo_id", "user_id"]
          },
        ]
      }
      pet_room_items: {
        Row: {
          duo_id: string
          item_id: string
        }
        Insert: {
          duo_id: string
          item_id: string
        }
        Update: {
          duo_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_room_items_duo_id_fkey"
            columns: ["duo_id"]
            isOneToOne: false
            referencedRelation: "duo_pets"
            referencedColumns: ["duo_id"]
          },
        ]
      }
      pet_unlocks: {
        Row: {
          duo_id: string
          item_id: string
          item_kind: string
          unlocked_at: string
        }
        Insert: {
          duo_id: string
          item_id: string
          item_kind: string
          unlocked_at?: string
        }
        Update: {
          duo_id?: string
          item_id?: string
          item_kind?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_unlocks_duo_id_fkey"
            columns: ["duo_id"]
            isOneToOne: false
            referencedRelation: "duo_pets"
            referencedColumns: ["duo_id"]
          },
        ]
      }
      pet_xp_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          duo_id: string
          event_key: string
          id: string
          local_date: string
          reversed_at: string | null
          source_id: string
          source_type: string
          xp_amount: number
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          duo_id: string
          event_key: string
          id?: string
          local_date: string
          reversed_at?: string | null
          source_id: string
          source_type: string
          xp_amount: number
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          duo_id?: string
          event_key?: string
          id?: string
          local_date?: string
          reversed_at?: string | null
          source_id?: string
          source_type?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "pet_xp_events_duo_id_actor_user_id_fkey"
            columns: ["duo_id", "actor_user_id"]
            isOneToOne: false
            referencedRelation: "duo_members"
            referencedColumns: ["duo_id", "user_id"]
          },
          {
            foreignKeyName: "pet_xp_events_duo_id_fkey"
            columns: ["duo_id"]
            isOneToOne: false
            referencedRelation: "duos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          brownie_encouragement: boolean
          created_at: string
          display_name: string
          id: string
          initials: string | null
          nickname: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          brownie_encouragement?: boolean
          created_at?: string
          display_name?: string
          id: string
          initials?: string | null
          nickname?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          brownie_encouragement?: boolean
          created_at?: string
          display_name?: string
          id?: string
          initials?: string | null
          nickname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_duo: {
        Args: {
          p_brownie_name: string
          p_display_name: string
          p_timezone: string
        }
        Returns: string
      }
      create_goal: {
        Args: {
          p_display_unit: string
          p_icon_key: string
          p_measurement_kind: string
          p_name: string
          p_notes: string
          p_scope: string
          p_targets: Json
          p_tracking_type: string
        }
        Returns: string
      }
      get_duo_context: { Args: never; Returns: Json }
      join_duo: { Args: { p_invite_code: string }; Returns: string }
      replace_goal_assignment: {
        Args: {
          p_effective_from: string
          p_goal_id: string
          p_target: number
          p_user_id: string
        }
        Returns: string
      }
      replace_goal_definition: {
        Args: {
          p_display_unit: string
          p_goal_id: string
          p_icon_key: string
          p_measurement_kind: string
          p_name: string
          p_notes: string
          p_scope: string
          p_targets: Json
          p_tracking_type: string
        }
        Returns: string
      }
      seed_default_goals: { Args: never; Returns: boolean }
      set_goal_checkin: {
        Args: { p_goal_id: string; p_local_date: string; p_value: number }
        Returns: {
          assignment_id: string
          completed: boolean | null
          created_at: string
          goal_id: string
          id: string
          local_date: string
          target_snapshot: number | null
          tracking_snapshot: string
          unit_snapshot: string | null
          updated_at: string
          user_id: string
          value: number
        }
        SetofOptions: {
          from: "*"
          to: "goal_checkins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_my_goal_target: {
        Args: { p_effective_from: string; p_goal_id: string; p_target: number }
        Returns: string
      }
      update_goal: {
        Args: {
          p_goal_id: string
          p_icon_key: string
          p_name: string
          p_notes: string
          p_targets: Json
        }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
