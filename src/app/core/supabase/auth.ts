import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../enviroments/enviroments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // ==========================================
  // MÉTODOS DE AUTENTICACIÓN
  // ==========================================

  async signUpWithEmail(email: string, password: string) {
    return await this.supabase.auth.signUp({
      email,
      password,
    });
  }

  async signInWithEmail(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
  }

  async signInWithGoogle() {
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: 'https://ph-hazel-omega.vercel.app/' 
      } 
    });
  }

  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  // ==========================================
  // MÉTODOS DE RECUPERACIÓN (Nuevos)
  // ==========================================

  // 1. Envía el correo con el enlace mágico
  async resetPassword(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
      // Importante: Esta ruta debe existir en tus rutas de Angular
      redirectTo: 'http://localhost:4200/actualizar-password', 
    });
    if (error) throw error;
    return data;
  }


  // ==========================================
  // MÉTODOS DE PERFIL Y ROLES
  // ==========================================
 // ==========================================
  // MÉTODOS DE PERFIL, ROLES Y APROBACIÓN
  // ==========================================
  async getUserProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single(); 
      
    if (error) {
      console.error("Error obteniendo el perfil:", error);
      return null;
    }
    return data;
  }

  // 🟢 NUEVO: Función para que el Admin apruebe o suspenda pacientes
  async actualizarEstadoPaciente(pacienteId: string, nuevoEstado: string) {
    const { data, error } = await this.supabase
      .from('perfiles')
      .update({ estado_aprobacion: nuevoEstado })
      .eq('id', pacienteId);
      
    if (error) throw error;
    return data;
  }

  // 2. Establece la nueva contraseña
  // Este método solo funciona si el usuario hizo clic en el enlace del correo
  async updatePassword(newPassword: string) {
    const { data, error } = await this.supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return data;
  }
}