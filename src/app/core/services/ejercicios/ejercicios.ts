import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../../enviroments/enviroments';
export interface EjercicioCatalogo {
  id?: string;
  nombre: string;
  grupo_muscular: string;
  descripcion?: string;
  video_url?: string;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // Para el Autocompletado del Coach
  async buscarEjercicios(termino: string) {
    const { data, error } = await this.supabase
      .from('catalogo_ejercicios')
      .select('*')
      .eq('activo', true)
      .ilike('nombre', `%${termino}%`)
      .limit(10);
      
    if (error) throw error;
    return data as EjercicioCatalogo[];
  }

  // Para el Panel de Administración
  async obtenerTodosLosEjercicios() {
    const { data, error } = await this.supabase
      .from('catalogo_ejercicios')
      .select('*')
      .order('grupo_muscular', { ascending: true });
      
    if (error) throw error;
    return data as EjercicioCatalogo[];
  }

  async guardarEjercicio(ejercicio: EjercicioCatalogo) {
    const { data, error } = await this.supabase
      .from('catalogo_ejercicios')
      .upsert(ejercicio) // Upsert inserta si no hay ID, o actualiza si ya existe
      .select();
      
    if (error) throw error;
    return data;
  }
}