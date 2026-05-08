import { Injectable } from '@angular/core';

import {
  createClient,
  SupabaseClient,
  Session,
  User,
  RealtimeChannel
} from '@supabase/supabase-js';

import { environment } from '../../../enviroments/enviroments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public supabase: SupabaseClient;

  constructor() {

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  // ==========================================
  // AUTH
  // ==========================================

  async getSession(): Promise<Session | null> {

    const { data, error } =
      await this.supabase.auth.getSession();

    if (error || !data.session) {
      return null;
    }

    return data.session;
  }

  getCachedAuthUser(): User | null {

    const possibleSession =
      localStorage.getItem('supabase.auth.token');

    if (!possibleSession) {
      return null;
    }

    return null;
  }

  async signInWithGoogle() {

    return await this.supabase.auth.signInWithOAuth({
      provider: 'google'
    });
  }

  async signInWithEmail(
    email: string,
    password: string
  ) {

    return await this.supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  async signUpWithEmail(
    email: string,
    password: string,
    metadata?: any
  ) {

    return await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {}
      }
    });
  }

  async signOut() {

    return await this.supabase.auth.signOut();
  }

  async clearLocalSession() {

    localStorage.clear();

    return await this.signOut();
  }

  async resetPassword(email: string) {

    return await this.supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          `${window.location.origin}/update-password`
      }
    );
  }

  async updatePassword(password: string) {

    return await this.supabase.auth.updateUser({
      password
    });
  }

  // ==========================================
  // PERFILES
  // ==========================================

  async getUserProfile(userId: string) {

    const { data, error } =
      await this.supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
      return null;
    }

    return data;
  }

  async getUserProfileForAuth(
    userId: string,
    email?: string
  ) {

    return await this.getUserProfile(userId);
  }

  async getPacientes() {

    const { data, error } =
      await this.supabase
        .from('perfiles')
        .select('*')
        .eq('rol', 'paciente')
        .order('created_at', {
          ascending: false
        });

    if (error) {
      throw error;
    }

    return data;
  }

  async actualizarEstadoPaciente(
    pacienteId: string,
    estado: string
  ) {

    const { data, error } =
      await this.supabase
        .from('perfiles')
        .update({
          estado_aprobacion: estado
        })
        .eq('id', pacienteId);

    if (error) {
      throw error;
    }

    return data;
  }

  // ==========================================
  // PLANES NUTRICIONALES
  // ==========================================

  async getPlanPaciente(
    pacienteId: string
  ) {

    const { data, error } =
      await this.supabase
        .from('planes_nutricionales')
        .select(`
          *,
          comidas (
            *,
            alimentos_comida (*)
          )
        `)
        .eq('id_perfil', pacienteId)
        .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async guardarPlanCompleto(
    pacienteId: string,
    planData: any
  ) {

    const { data: existingPlan } =
      await this.supabase
        .from('planes_nutricionales')
        .select('*')
        .eq('id_perfil', pacienteId)
        .maybeSingle();

    let planId = existingPlan?.id;

    // ======================================
    // CREAR PLAN
    // ======================================

    if (!planId) {

      const { data, error } =
        await this.supabase
          .from('planes_nutricionales')
          .insert({
            id_perfil: pacienteId,
            calorias_totales:
              planData.calorias_totales,

            suplementacion:
              planData.suplementacion,

            medicacion:
              planData.medicacion
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      planId = data.id;

    } else {

      // ======================================
      // ACTUALIZAR PLAN
      // ======================================

      const { error } =
        await this.supabase
          .from('planes_nutricionales')
          .update({
            calorias_totales:
              planData.calorias_totales,

            suplementacion:
              planData.suplementacion,

            medicacion:
              planData.medicacion
          })
          .eq('id', planId);

      if (error) {
        throw error;
      }

      // ======================================
      // ELIMINAR COMIDAS VIEJAS
      // ======================================

      await this.supabase
        .from('comidas')
        .delete()
        .eq('id_plan', planId);
    }

    // ======================================
    // INSERTAR COMIDAS
    // ======================================

    for (const comida of planData.comidas) {

      const { data: comidaData, error } =
        await this.supabase
          .from('comidas')
          .insert({
            id_plan: planId,
            nombre: comida.nombre,
            nota_comida: comida.nota_comida
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      // ======================================
      // INSERTAR ALIMENTOS
      // ======================================

      if (comida.alimentos?.length) {

        const alimentos =
          comida.alimentos.map((a: any) => ({
            id_comida: comidaData.id,
            descripcion: a.descripcion,
            calorias: a.calorias,
            proteinas: a.proteinas,
            carbos: a.carbos,
            grasas: a.grasas
          }));

        const { error } =
          await this.supabase
            .from('alimentos_comida')
            .insert(alimentos);

        if (error) {
          throw error;
        }
      }
    }

    return true;
  }

  // ==========================================
  // REALTIME
  // ==========================================

  subscribePlanPaciente(
    pacienteId: string,
    callback: () => void
  ): RealtimeChannel[] {

    const channel =
      this.supabase
        .channel(`plan-${pacienteId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'planes_nutricionales',
            filter:
              `id_perfil=eq.${pacienteId}`
          },
          () => callback()
        )
        .subscribe();

    return [channel];
  }

  subscribePacientes(
    callback: () => void
  ): RealtimeChannel {

    return this.supabase
      .channel('public:perfiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'perfiles'
        },
        () => callback()
      )
      .subscribe();
  }

  unsubscribeChannel(
    channel: RealtimeChannel
  ) {

    if (channel) {
      this.supabase.removeChannel(channel);
    }
  }

  // ==========================================
  // FOTOS
  // ==========================================

  async subirFoto(
    pacienteId: string,
    tipo: string,
    archivo: File
  ) {

    const filePath =
      `${pacienteId}/${tipo}_${Date.now()}`;

    const { error } =
      await this.supabase
        .storage
        .from('fotos-pacientes')
        .upload(filePath, archivo);

    if (error) {
      throw error;
    }

    const { data } =
      this.supabase
        .storage
        .from('fotos-pacientes')
        .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async guardarRegistroFotografico(
    pacienteId: string,
    fotos: Record<string, File>
  ) {

    const links: any = {};

    for (const [key, file]
      of Object.entries(fotos)) {

      links[key] =
        await this.subirFoto(
          pacienteId,
          key,
          file
        );
    }

    const { data, error } =
      await this.supabase
        .from('expedientes_clinicos')
        .upsert({
          id_perfil: pacienteId,
          fotos_progreso: links,
          fecha_actualizacion:
            new Date().toISOString()
        });

    if (error) {
      throw error;
    }

    return data;
  }

  // ==========================================
  // EXPEDIENTES
  // ==========================================

  async guardarExpedienteInicial(
    pacienteId: string,
    respuestas: any,
    fotos: any
  ) {

    const payload = {

      id_perfil: pacienteId,

      respuestas_completas:
        respuestas,

      fotos_progreso:
        fotos,

      fecha_actualizacion:
        new Date().toISOString()
    };

    const { data, error } =
      await this.supabase
        .from('expedientes_clinicos')
        .upsert(payload);

    if (error) {
      throw error;
    }

    return data;
  }

  async guardarCircunferencias(
    pacienteId: string,
    medidas: any
  ) {

    const { data, error } =
      await this.supabase
        .from('perfiles')
        .update(medidas)
        .eq('id', pacienteId);

    if (error) {
      throw error;
    }

    return data;
  }

  async getExpedienteClinico(
    pacienteId: string
  ) {

    const { data, error } =
      await this.supabase
        .from('expedientes_clinicos')
        .select('*')
        .eq('id_perfil', pacienteId)
        .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

}