import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from '../../supabase/auth';
import {
  FilaCarga,
  Unidad,
  claveEjercicio,
  hoyISO,
} from '../../../features/panel/progreso/progreso.utils';

@Injectable({
  providedIn: 'root'
})
export class EntrenamientoService {
  private supabase: SupabaseClient;
  private readonly requestTimeoutMs = 10000;

  constructor() {
    this.supabase = inject(AuthService).supabase;
  }

  // ==========================================
  // RUTINAS DE ENTRENAMIENTO
  // ==========================================
  async getRutinaPaciente(pacienteId: string): Promise<any> {
    const { data, error } = await this.withTimeout(
      this.supabase
        .from('rutinas')
        .select(`
          *,
          dias_entrenamiento (
            id,
            titulo,
            orden,
            ejercicios (*)
          )
        `)
        .eq('id_perfil', pacienteId)
        .maybeSingle(),
      'La consulta de rutina tardo demasiado.'
    );

    if (error) throw error;

    if (!data) return null;

    return {
      ...data,
      dias_entrenamiento: (data.dias_entrenamiento ?? [])
        .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
        .map((dia: any) => ({
          ...dia,
          ejercicios: (dia.ejercicios ?? []).sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
        }))
    };
  }

  async guardarRutinaCompleta(pacienteId: string, formValue: any): Promise<void> {
    const dias = (formValue.dias_entrenamiento || [])
      .map((dia: any) => ({
        ...dia,
        titulo: String(dia?.titulo ?? '').trim(),
        ejercicios: (dia?.ejercicios || []).filter((ej: any) => String(ej?.ejercicio ?? '').trim().length > 0)
      }))
      .filter((dia: any) => dia.titulo.length > 0 || dia.ejercicios.length > 0);

    await this.withTimeout(
      this.supabase.from('rutinas').delete().eq('id_perfil', pacienteId),
      'La limpieza de la rutina anterior tardo demasiado.'
    );

    const { data: nuevaRutina, error: errorRutina } = await this.withTimeout(
      this.supabase
        .from('rutinas')
        .insert({
          id_perfil: pacienteId,
          notas_entrenamiento: formValue.notas_entrenamiento
        })
        .select()
        .single(),
      'El guardado de la rutina tardo demasiado.'
    );

    if (errorRutina) throw errorRutina;

    for (let i = 0; i < dias.length; i++) {
      const { data: nuevoDia, error: errorDia } = await this.withTimeout(
        this.supabase
          .from('dias_entrenamiento')
          .insert({
            id_rutina: nuevaRutina.id,
            titulo: dias[i].titulo || `Dia ${i + 1}`,
            orden: i
          })
          .select()
          .single(),
        'El guardado de un dia de entrenamiento tardo demasiado.'
      );

      if (errorDia) throw errorDia;

      const ejercicios = dias[i].ejercicios || [];
      if (ejercicios.length > 0) {
        const ejerciciosPayload = ejercicios.map((ej: any, idx: number) => ({
          id_dia: nuevoDia.id,
          ejercicio: ej.ejercicio,
          series: Number(ej.series) || 1,
          reps: ej.reps,
          ...(String(ej.carga_objetivo ?? '').trim() ? { carga_objetivo: String(ej.carga_objetivo).trim() } : {}),
          ...(String(ej.video_url ?? '').trim() ? { video_url: String(ej.video_url).trim() } : {}),
          orden: idx
        }));

        const { error: errorEjs } = await this.withTimeout(
          this.supabase
            .from('ejercicios')
            .insert(ejerciciosPayload),
          'El guardado de ejercicios tardo demasiado.'
        );

        if (errorEjs) throw errorEjs;
      }
    }
  }

  // ==========================================
  // REGISTRO DE CARGAS DEL PACIENTE
  // ==========================================
  /** Historial reciente de pesos del paciente, del más nuevo al más viejo. */
  async getHistorialCargas(pacienteId: string): Promise<FilaCarga[]> {
    const { data, error } = await this.withTimeout(
      this.supabase
        .from('registros_carga')
        .select('ejercicio, ejercicio_clave, fecha, peso_kg, unidad_captura')
        .eq('id_perfil', pacienteId)
        .order('fecha', { ascending: false })
        .limit(1000),
      'La consulta de tus cargas tardo demasiado.'
    );

    if (error) throw error;
    return (data ?? []) as FilaCarga[];
  }

  /** Guarda (o corrige) el peso de hoy para un ejercicio. */
  async guardarCarga(pacienteId: string, ejercicio: string, pesoKg: number, unidad: Unidad): Promise<void> {
    const { error } = await this.withTimeout(
      this.supabase.from('registros_carga').upsert(
        {
          id_perfil: pacienteId,
          // ejercicio_clave no se envía: es una columna generada en la base de datos.
          ejercicio: ejercicio.trim(),
          fecha: hoyISO(),
          peso_kg: Math.round(pesoKg * 1000) / 1000,
          unidad_captura: unidad,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id_perfil,ejercicio_clave,fecha' }
      ),
      'El guardado de la carga tardo demasiado.'
    );

    if (error) throw error;
  }

  /** Borra el peso de hoy de un ejercicio (cuando el paciente vacía el campo). */
  async borrarCargaDeHoy(pacienteId: string, ejercicio: string): Promise<void> {
    const { error } = await this.withTimeout(
      this.supabase
        .from('registros_carga')
        .delete()
        .eq('id_perfil', pacienteId)
        .eq('ejercicio_clave', claveEjercicio(ejercicio))
        .eq('fecha', hoyISO()),
      'El borrado de la carga tardo demasiado.'
    );

    if (error) throw error;
  }

  // ==========================================
  // REVISIÓN DE TÉCNICA (NUEVO)
  // ==========================================
  async getRevisionesTecnica(pacienteId: string): Promise<any[]> {
    const { data, error } = await this.withTimeout(
      this.supabase
        .from('revisiones_tecnica')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }),
      'La consulta de los videos de técnica tardo demasiado.'
    );

    if (error) throw error;
    return data || [];
  }

  async actualizarFeedbackTecnica(videoId: string, feedback: string): Promise<any> {
    const { data, error } = await this.withTimeout(
      this.supabase
        .from('revisiones_tecnica')
        .update({ 
          feedback_coach: feedback, 
          estado: 'Revisado',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoId)
        .select(),
      'El guardado del feedback tardo demasiado.'
    );

    if (error) throw error;
    return data;
  }

  // ==========================================
  // UTILIDADES
  // ==========================================
  private withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
    return Promise.race([
      Promise.resolve(request),
      new Promise<T>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error(message)), this.requestTimeoutMs);
      }),
    ]);
  }
}
