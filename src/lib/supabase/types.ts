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
      ajuste: {
        Row: {
          clave: string
          valor: Json
        }
        Insert: {
          clave: string
          valor: Json
        }
        Update: {
          clave?: string
          valor?: Json
        }
        Relationships: []
      }
      ausencia: {
        Row: {
          comentario: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_ausencia"]
          fecha_fin: string
          fecha_inicio: string
          id: string
          motivo_rechazo: string | null
          perfil_id: string
          resuelta_at: string | null
          resuelta_por: string | null
          tipo: Database["public"]["Enums"]["tipo_ausencia"]
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_ausencia"]
          fecha_fin: string
          fecha_inicio: string
          id?: string
          motivo_rechazo?: string | null
          perfil_id: string
          resuelta_at?: string | null
          resuelta_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_ausencia"]
        }
        Update: {
          comentario?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_ausencia"]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          motivo_rechazo?: string | null
          perfil_id?: string
          resuelta_at?: string | null
          resuelta_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ausencia"]
        }
        Relationships: [
          {
            foreignKeyName: "ausencia_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ausencia_resuelta_por_fkey"
            columns: ["resuelta_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria: {
        Row: {
          activa: boolean
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      departamento: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          responsable_id: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          responsable_id?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          responsable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departamento_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      empleado_proyecto: {
        Row: {
          desde: string
          empleado_id: string
          hasta: string | null
          proyecto_id: string
        }
        Insert: {
          desde?: string
          empleado_id: string
          hasta?: string | null
          proyecto_id: string
        }
        Update: {
          desde?: string
          empleado_id?: string
          hasta?: string | null
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleado_proyecto_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleado_proyecto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          activa: boolean
          cif: string | null
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          cif?: string | null
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          cif?: string | null
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      festivo: {
        Row: {
          empresa_id: string | null
          fecha: string
          id: string
          nombre: string
        }
        Insert: {
          empresa_id?: string | null
          fecha: string
          id?: string
          nombre: string
        }
        Update: {
          empresa_id?: string | null
          fecha?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "festivo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      imputacion: {
        Row: {
          aprobado_en: string | null
          aprobado_por: string | null
          created_at: string
          descripcion: string | null
          empleado_id: string
          estado: Database["public"]["Enums"]["estado_imputacion"]
          fecha: string
          horas: number
          id: string
          motivo_rechazo: string | null
          proyecto_id: string
          subcategoria_id: string
          updated_at: string
        }
        Insert: {
          aprobado_en?: string | null
          aprobado_por?: string | null
          created_at?: string
          descripcion?: string | null
          empleado_id: string
          estado?: Database["public"]["Enums"]["estado_imputacion"]
          fecha: string
          horas: number
          id?: string
          motivo_rechazo?: string | null
          proyecto_id: string
          subcategoria_id: string
          updated_at?: string
        }
        Update: {
          aprobado_en?: string | null
          aprobado_por?: string | null
          created_at?: string
          descripcion?: string | null
          empleado_id?: string
          estado?: Database["public"]["Enums"]["estado_imputacion"]
          fecha?: string
          horas?: number
          id?: string
          motivo_rechazo?: string | null
          proyecto_id?: string
          subcategoria_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imputacion_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputacion_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputacion_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputacion_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputacion_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "v_imputacion_valorada"
            referencedColumns: ["subcategoria_id"]
          },
        ]
      }
      perfil: {
        Row: {
          activo: boolean
          categoria_id: string | null
          created_at: string
          departamento_id: string | null
          email: string
          empresa_id: string
          id: string
          max_horas_dia: number
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          departamento_id?: string | null
          email: string
          empresa_id: string
          id: string
          max_horas_dia?: number
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          departamento_id?: string | null
          email?: string
          empresa_id?: string
          id?: string
          max_horas_dia?: number
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "perfil_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_imputacion_valorada"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "perfil_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_refacturacion_mensual"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "perfil_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      periodo: {
        Row: {
          anio: number
          cerrado_en: string | null
          cerrado_por: string | null
          empresa_id: string
          estado: Database["public"]["Enums"]["estado_periodo"]
          id: string
          mes: number
        }
        Insert: {
          anio: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          empresa_id: string
          estado?: Database["public"]["Enums"]["estado_periodo"]
          id?: string
          mes: number
        }
        Update: {
          anio?: number
          cerrado_en?: string | null
          cerrado_por?: string | null
          empresa_id?: string
          estado?: Database["public"]["Enums"]["estado_periodo"]
          id?: string
          mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "periodo_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          empresa_id: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          empresa_id: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          empresa_id?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_responsable: {
        Row: {
          perfil_id: string
          proyecto_id: string
        }
        Insert: {
          perfil_id: string
          proyecto_id: string
        }
        Update: {
          perfil_id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_responsable_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_responsable_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategoria: {
        Row: {
          activa: boolean
          categoria_id: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          categoria_id: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          categoria_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategoria_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategoria_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_imputacion_valorada"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "subcategoria_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_refacturacion_mensual"
            referencedColumns: ["categoria_id"]
          },
        ]
      }
      tarifa: {
        Row: {
          categoria_id: string | null
          coste_hora: number
          empleado_id: string | null
          empresa_origen_id: string | null
          id: string
          moneda: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          categoria_id?: string | null
          coste_hora: number
          empleado_id?: string | null
          empresa_origen_id?: string | null
          id?: string
          moneda?: string
          vigente_desde: string
          vigente_hasta?: string | null
        }
        Update: {
          categoria_id?: string | null
          coste_hora?: number
          empleado_id?: string | null
          empresa_origen_id?: string | null
          id?: string
          moneda?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifa_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifa_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_imputacion_valorada"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "tarifa_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_refacturacion_mensual"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "tarifa_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifa_empresa_origen_id_fkey"
            columns: ["empresa_origen_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_ausencia_dias: {
        Row: {
          comentario: string | null
          created_at: string | null
          dias_laborables: number | null
          estado: Database["public"]["Enums"]["estado_ausencia"] | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string | null
          motivo_rechazo: string | null
          perfil_id: string | null
          resuelta_at: string | null
          resuelta_por: string | null
          tipo: Database["public"]["Enums"]["tipo_ausencia"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ausencia_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ausencia_resuelta_por_fkey"
            columns: ["resuelta_por"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      v_imputacion_valorada: {
        Row: {
          anio: number | null
          categoria: string | null
          categoria_id: string | null
          coste_hora: number | null
          descripcion: string | null
          empleado: string | null
          empleado_id: string | null
          empresa_destino: string | null
          empresa_destino_id: string | null
          empresa_origen: string | null
          empresa_origen_id: string | null
          es_intragrupo: boolean | null
          estado: Database["public"]["Enums"]["estado_imputacion"] | null
          fecha: string | null
          horas: number | null
          id: string | null
          importe: number | null
          mes: number | null
          proyecto: string | null
          proyecto_codigo: string | null
          proyecto_id: string | null
          subcategoria: string | null
          subcategoria_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imputacion_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imputacion_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_empresa_id_fkey"
            columns: ["empresa_origen_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_empresa_id_fkey"
            columns: ["empresa_destino_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      v_refacturacion_mensual: {
        Row: {
          anio: number | null
          categoria: string | null
          categoria_id: string | null
          empresa_destino: string | null
          empresa_destino_id: string | null
          empresa_origen: string | null
          empresa_origen_id: string | null
          horas: number | null
          importe: number | null
          lineas: number | null
          mes: number | null
          proyecto: string | null
          proyecto_codigo: string | null
          proyecto_id: string | null
          tarifa_completa: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "imputacion_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_empresa_id_fkey"
            columns: ["empresa_origen_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_empresa_id_fkey"
            columns: ["empresa_destino_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aprobar_ausencia: { Args: { p_id: string }; Returns: undefined }
      aprobar_imputaciones: { Args: { p_ids: string[] }; Returns: number }
      auth_empresa: { Args: never; Returns: string }
      auth_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      balance_mes: {
        Args: { p_anio: number; p_mes: number }
        Returns: {
          dias_baja: number
          dias_permiso: number
          dias_vacaciones: number
          horas_imputadas: number
          horas_requeridas: number
        }[]
      }
      cancelar_ausencia: { Args: { p_id: string }; Returns: undefined }
      cerrar_periodo: {
        Args: { p_anio: number; p_empresa: string; p_mes: number }
        Returns: undefined
      }
      empresa_de_proyecto: { Args: { p_proyecto: string }; Returns: string }
      enviar_imputaciones: { Args: { p_ids: string[] }; Returns: number }
      es_admin_grupo: { Args: never; Returns: boolean }
      es_festivo: {
        Args: { p_empresa: string; p_fecha: string }
        Returns: boolean
      }
      es_laborable: {
        Args: { p_empresa: string; p_fecha: string }
        Returns: boolean
      }
      es_responsable_de: { Args: { p_perfil: string }; Returns: boolean }
      faltantes: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          email: string
          falta: number
          fecha: string
          imputado: number
          nombre: string
          perfil_id: string
          requerido: number
        }[]
      }
      fte_mes: {
        Args: { p_anio: number; p_mes: number }
        Returns: {
          dias_baja: number
          dias_permiso: number
          dias_vacaciones: number
          email: string
          empleado: string
          empresa_empleado: string
          empresa_proyecto: string
          horas_imputadas_total: number
          horas_proyecto: number
          horas_requeridas: number
          proyecto: string
        }[]
      }
      horas_requeridas: {
        Args: { p_desde: string; p_empresa: string; p_hasta: string }
        Returns: number
      }
      horas_requeridas_mes: {
        Args: { p_anio: number; p_empresa: string; p_mes: number }
        Returns: number
      }
      jornada_horas: { Args: never; Returns: number }
      periodo_cerrado: {
        Args: { p_empresa: string; p_fecha: string }
        Returns: boolean
      }
      puede_resolver_ausencia: {
        Args: { p_ausencia: string }
        Returns: boolean
      }
      rechazar_ausencia: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      rechazar_imputaciones: {
        Args: { p_ids: string[]; p_motivo: string }
        Returns: number
      }
      resolver_tarifa: {
        Args: {
          p_categoria: string
          p_empleado: string
          p_empresa_origen: string
          p_fecha: string
        }
        Returns: number
      }
      solicitar_ausencia: {
        Args: {
          p_comentario?: string
          p_fin: string
          p_inicio: string
          p_tipo: Database["public"]["Enums"]["tipo_ausencia"]
        }
        Returns: string
      }
      tiene_ausencia_aprobada: {
        Args: { p_fecha: string; p_perfil: string }
        Returns: boolean
      }
    }
    Enums: {
      estado_ausencia: "pendiente" | "aprobada" | "rechazada" | "cancelada"
      estado_imputacion:
        | "borrador"
        | "enviada"
        | "aprobada"
        | "rechazada"
        | "cerrada"
      estado_periodo: "abierto" | "cerrado"
      rol_usuario:
        | "admin_grupo"
        | "admin_empresa"
        | "responsable_proyecto"
        | "empleado"
      tipo_ausencia: "vacaciones" | "baja_medica" | "otro_permiso"
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
    Enums: {
      estado_ausencia: ["pendiente", "aprobada", "rechazada", "cancelada"],
      estado_imputacion: [
        "borrador",
        "enviada",
        "aprobada",
        "rechazada",
        "cerrada",
      ],
      estado_periodo: ["abierto", "cerrado"],
      rol_usuario: [
        "admin_grupo",
        "admin_empresa",
        "responsable_proyecto",
        "empleado",
      ],
      tipo_ausencia: ["vacaciones", "baja_medica", "otro_permiso"],
    },
  },
} as const
