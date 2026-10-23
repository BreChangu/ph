import { Injectable, Inject, PLATFORM_ID, NgZone, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, User, Session, RealtimeChannel } from '@supabase/supabase-js';
import { environment } from '../../../enviroments/enviroments';

export type AuthDestination = {
  commands: string[];
  queryParams?: Record<string, string>;
};

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
    const isPasswordRecoveryRoute = isPlatformBrowser(this.platformId)
      && window.location.pathname === '/actualizar-password';

    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // OAuth is processed only by /auth/callback so the router can preserve the code.
        // Password-recovery links still need Supabase's automatic hash processing.
        detectSessionInUrl: isPasswordRecoveryRoute,
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
      options: { 
        // Esta ruta concentra la validación del perfil antes de mostrar contenido privado.
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  async waitForOAuthSession(timeoutMs = 8000): Promise<Session | null> {
    const currentSession = await this.getSession();
    if (currentSession) return currentSession;

    return new Promise((resolve) => {
      let resolved = false;
      const { data: { subscription } } = this.supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !resolved) {
          resolved = true;
          globalThis.clearTimeout(timeout);
          subscription.unsubscribe();
          resolve(session);
        }
      });

      const timeout = globalThis.setTimeout(() => {
        if (resolved) return;
        resolved = true;
        subscription.unsubscribe();
        resolve(null);
      }, timeoutMs);
    });
  }

  async completeOAuthCallback(): Promise<Session | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      const { data, error } = await this.supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return data.session;
    }

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      const { data, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return data.session;
    }

    return this.waitForOAuthSession();
  }

  async getAuthenticatedDestination(userId: string, email?: string): Promise<AuthDestination> {
    const perfil = await this.getUserProfileForAuth(userId, email);

    if (!perfil) {
      await this.signOut();
      return { commands: ['/auth'], queryParams: { error: 'perfil_no_encontrado' } };
    }

    if (perfil.rol !== 'admin' && perfil.estado_aprobacion !== 'aprobado') {
      await this.signOut();
      return {
        commands: ['/auth'],
        queryParams: { pendiente: perfil.estado_aprobacion === 'pendiente' ? '1' : 'suspendido' },
      };
    }

    if (perfil.rol === 'admin') return { commands: ['/admin-panel'] };

    const expediente = await this.getExpedienteClinico(perfil.id);
    return { commands: [expediente ? '/panel' : '/onboarding'] };
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


  //CCOMPROBAR ROLES DE ADMOnIN Y PACIENTES 
  
async diagnosticarAdmin() {
  const { data: userData, error: userError } =
    await this.supabase.auth.getUser();

  if (userError || !userData.user) {
    return {
      email: null,
      uid: null,
      rolPerfil: null,
      esAdmin: null,
      error: userError?.message ?? 'No hay sesión activa'
    };
  }

  const user = userData.user;

  const { data: perfil, error: perfilError } =
    await this.supabase
      .from('perfiles')
      .select('id, rol, estado_aprobacion')
      .eq('id', user.id)
      .maybeSingle();

  if (perfilError) {
    return {
      email: user.email,
      uid: user.id,
      rolPerfil: null,
      esAdmin: null,
      error: `Error al consultar perfil: ${perfilError.message}`
    };
  }

  const { data: esAdmin, error: adminError } =
    await this.supabase.rpc('is_admin');

  return {
    email: user.email,
    uid: user.id,
    rolPerfil: perfil?.rol ?? null,
    estado: perfil?.estado_aprobacion ?? null,
    esAdmin: adminError ? null : esAdmin,
    error: adminError?.message ?? null
  };
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
  

  //Administración de usuarios y roles
  
}
