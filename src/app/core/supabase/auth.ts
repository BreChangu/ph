import { Injectable, Inject, PLATFORM_ID, NgZone, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, User, Session, RealtimeChannel } from '@supabase/supabase-js';
import { environment } from '../../../enviroments/enviroments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public supabase: SupabaseClient;

  // 🟢 1. ESTADO REACTIVO (SIGNALS) - ¡La magia moderna de Angular!
  currentUser = signal<User | null>(null);
  userProfile = signal<any | null>(null);

  // 🟢 2. ESTADOS COMPUTADOS (Se actualizan solos)
  isLoggedIn = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.userProfile()?.rol === 'admin');

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone
  ) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    this.initAuthState();
  }

  // 🟢 3. ESCUCHA GLOBAL DE SUPABASE
  private initAuthState() {
    if (isPlatformBrowser(this.platformId)) {
      // Pedimos la sesión inicial
      this.supabase.auth.getSession().then(({ data }) => {
        this.updateState(data.session?.user || null);
      });

      // Escuchamos cualquier cambio (login, logout, token refresh)
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.ngZone.run(() => {
          this.updateState(session?.user || null);
        });
      });
    }
  }

  // 🟢 4. ACTUALIZADOR CENTRAL DE ESTADO
  private async updateState(user: User | null) {
    this.currentUser.set(user);
    if (user) {
      const profile = await this.getUserProfile(user.id);
      this.userProfile.set(profile);
    } else {
      this.userProfile.set(null);
    }
  }

  // ==========================================
  // AUTENTICACIÓN
  // ==========================================

  async getSession(): Promise<Session | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  async signInWithEmail(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUpWithEmail(email: string, password: string) {
    return await this.supabase.auth.signUp({ email, password });
  }

  async signInWithGoogle() {
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://ph-hazel-omega.vercel.app/' }
    });
  }

  async resetPassword(email: string) {
    return await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:4200/actualizar-password',
    });
  }

  async updatePassword(newPassword: string) {
    return await this.supabase.auth.updateUser({ password: newPassword });
  }

  // 🟢 FIX: Un solo método de salida seguro. Sin tocar el localStorage de Angular.
  async signOut() {
    try {
      await this.supabase.auth.signOut();
      this.currentUser.set(null);
      this.userProfile.set(null);
    } catch (error) {
      console.error('Error en signOut:', error);
    }
  }

  // ==========================================
  // PERFILES Y ROLES
  // ==========================================

  async getUserProfile(userId: string) {
    const { data, error } = await this.supabase.from('perfiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      console.error('Error obteniendo perfil:', error);
      return null;
    }
    return data;
  }

  async getUserProfileForAuth(userId: string, email?: string) {
    const profileById = await this.getUserProfile(userId);
    if (profileById) return profileById;

    if (!email) return null;

    try {
      const { data, error } = await this.supabase
        .from('perfiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.warn('No se pudo buscar perfil por email:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('Busqueda de perfil por email no disponible:', error);
      return null;
    }
  }

  async getPacientes() {
    const { data, error } = await this.supabase.from('perfiles').select('*').eq('rol', 'paciente').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async actualizarEstadoPaciente(pacienteId: string, nuevoEstado: string) {
    return await this.supabase.from('perfiles').update({ estado_aprobacion: nuevoEstado }).eq('id', pacienteId);
  }

  // ==========================================
  // REALTIME (General)
  // ==========================================

  subscribePacientes(callback: () => void): RealtimeChannel {
    return this.supabase.channel('public:perfiles').on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => callback()).subscribe();
  }

  unsubscribeChannel(channel: any) {
    if (channel) this.supabase.removeChannel(channel);
  }

  // ==========================================
  // ONBOARDING Y EXPEDIENTES
  // ==========================================

  async subirFoto(pacienteId: string, tipo: string, archivo: File) {
    const filePath = `${pacienteId}/${tipo}_${Date.now()}`;
    await this.supabase.storage.from('fotos-pacientes').upload(filePath, archivo);
    const { data } = this.supabase.storage.from('fotos-pacientes').getPublicUrl(filePath);
    return data.publicUrl;
  }

  async guardarExpedienteInicial(pacienteId: string, respuestas: any, linksFotos: any) {
    await this.supabase.from('perfiles').update({ nombre_completo: respuestas.nombre_completo, peso_kg: respuestas.peso_kg, altura_cm: respuestas.altura_cm, edad: respuestas.edad, genero: respuestas.genero }).eq('id', pacienteId);
    return await this.supabase.from('expedientes_clinicos').upsert({ id_perfil: pacienteId, respuestas_completas: respuestas, fotos_progreso: linksFotos });
  }

  async getExpedienteClinico(pacienteId: string) {
    const { data } = await this.supabase.from('expedientes_clinicos').select('*').eq('id_perfil', pacienteId).maybeSingle();
    return data;
  }

  async guardarCircunferencias(pacienteId: string, medidas: any) {
    return await this.supabase.from('perfiles').update(medidas).eq('id', pacienteId);
  }

  async guardarRegistroFotografico(pacienteId: string, links: any) {
    return await this.supabase.from('expedientes_clinicos').upsert({ id_perfil: pacienteId, fotos_progreso: links, fecha_actualizacion: new Date().toISOString() });
  }

  // ==========================================
  // TESTIMONIOS
  // ==========================================

  async subirFotoTestimonio(pacienteId: string, tipo: 'antes' | 'despues', archivo: File) {
    const filePath = `testimonios/${pacienteId}_${tipo}_${Date.now()}`;
    await this.supabase.storage.from('fotos-pacientes').upload(filePath, archivo);
    const { data } = this.supabase.storage.from('fotos-pacientes').getPublicUrl(filePath);
    return data.publicUrl;
  }

  async guardarTestimonio(pacienteId: string, texto: string, fotoAntesUrl?: string, fotoDespuesUrl?: string) {
    const { error } = await this.supabase.from('testimonios').insert({
      id_perfil: pacienteId,
      texto: texto,
      foto_antes: fotoAntesUrl,
      foto_despues: fotoDespuesUrl,
      aprobado: false // Siempre entra en revisión
    });
    if (error) throw error;
  }

  async getTestimoniosPublicos() {
    const { data, error } = await this.supabase
      .from('testimonios')
      .select('*, perfiles(nombre_completo)')
      .eq('aprobado', true)
      .order('created_at', { ascending: false });
    return error ? [] : data;
  }
}
