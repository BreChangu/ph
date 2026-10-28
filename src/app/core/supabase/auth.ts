import { Injectable, Inject, PLATFORM_ID, NgZone, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  createClient,
  SupabaseClient,
  User,
  Session,
  RealtimeChannel,
} from '@supabase/supabase-js';
import { environment } from '../../../enviroments/enviroments';

export type AuthDestination = {
  commands: string[];
  queryParams?: Record<string, string>;
};

@Injectable({
  providedIn: 'root',
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
    private ngZone: NgZone,
  ) {
    const isPasswordRecoveryRoute =
      isPlatformBrowser(this.platformId) && window.location.pathname === '/actualizar-password';

    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        // OAuth is processed only by /auth/callback so the router can preserve the code.
        // Password-recovery links still need Supabase's automatic hash processing.
        detectSessionInUrl: isPasswordRecoveryRoute,
      },
    });
    this.initAuthState();
  }

  // 🟢 3. ESCUCHA GLOBAL DE SUPABASE
  private initAuthState(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Supabase emite INITIAL_SESSION y también notifica los cambios posteriores.
    // Diferimos la consulta del perfil para no ejecutar operaciones de Supabase
    // dentro del callback de onAuthStateChange.
    this.supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;

      globalThis.setTimeout(() => {
        this.ngZone.run(() => {
          void this.updateState(user).catch((error) => {
            console.error('[Auth] Error al actualizar el estado:', error);
          });
        });
      }, 0);
    });
  }

  // 🟢 4. ACTUALIZADOR CENTRAL DE ESTADO
  private async updateState(user: User | null): Promise<void> {
    this.currentUser.set(user);

    if (!user) {
      this.userProfile.set(null);
      return;
    }

    // No conservar el perfil anterior mientras se carga el del usuario actual.
    if (this.userProfile()?.id !== user.id) {
      this.userProfile.set(null);
    }

    const profile = await this.getUserProfile(user.id);

    // Evitar que una consulta anterior sobrescriba el estado de otra sesión.
    if (this.currentUser()?.id !== user.id) {
      return;
    }

    this.userProfile.set(profile);
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
    const emailRedirectTo = isPlatformBrowser(this.platformId)
      ? `${window.location.origin}/auth/callback`
      : undefined;

    return await this.supabase.auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
  }

  async signInWithGoogle() {
    return await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Esta ruta concentra la validación del perfil antes de mostrar contenido privado.
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async waitForOAuthSession(timeoutMs = 8000): Promise<Session | null> {
    const currentSession = await this.getSession();
    if (currentSession) return currentSession;

    return new Promise((resolve) => {
      let resolved = false;
      const {
        data: { subscription },
      } = this.supabase.auth.onAuthStateChange((event, session) => {
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
    // The auth session can arrive just before the database trigger creates its profile.
    // Retry briefly so a newly registered patient is not treated as an unknown account.
    let perfil = await this.getUserProfileForAuth(userId, email);
    for (let attempt = 0; !perfil && attempt < 3; attempt += 1) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 250 * (attempt + 1));
      });
      perfil = await this.getUserProfileForAuth(userId, email);
    }

    // 1. Si no existe el perfil, cerrar sesión y regresar a autenticación.
    if (!perfil) {
      await this.signOut();

      return {
        commands: ['/auth'],
        queryParams: { error: 'perfil_no_encontrado' },
      };
    }

    // 2. Los administradores conservan su flujo habitual.
    if (perfil.rol === 'admin') {
      return { commands: ['/admin-panel'] };
    }

    const estado = perfil.estado_aprobacion;

    // 3. Si el paciente está pendiente, primero comprobar su expediente.
    if (estado === 'pendiente') {
      const expediente = await this.getExpedienteClinico(perfil.id);

      console.log('[Auth Destination]', {
        rol: perfil.rol,
        estado: perfil.estado_aprobacion,
        tieneExpediente: Boolean(expediente),
        tieneRespuestas: Boolean(expediente?.respuestas_completas),
        cantidadFotos: Object.keys(expediente?.fotos_progreso ?? {}).length,
      });

      // Usuario nuevo: todavía debe completar su entrevista.
      if (!expediente) {
        return { commands: ['/onboarding'] };
      }

      // Ya envió su entrevista: conservar la pantalla de revisión.
      await this.signOut();

      return {
        commands: ['/auth'],
        queryParams: { pendiente: '1' },
      };
    }

    // 4. Los estados distintos de "aprobado" y "pendiente"
    // conservan el comportamiento de bloqueo anterior.
    if (estado !== 'aprobado') {
      await this.signOut();

      return {
        commands: ['/auth'],
        queryParams: { pendiente: 'suspendido' },
      };
    }

    // 5. Paciente aprobado: conservar el flujo habitual.
    const expediente = await this.getExpedienteClinico(perfil.id);

    return {
      commands: [expediente ? '/panel' : '/onboarding'],
    };
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
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return {
        email: null,
        uid: null,
        rolPerfil: null,
        esAdmin: null,
        error: userError?.message ?? 'No hay sesión activa',
      };
    }

    const user = userData.user;

    const { data: perfil, error: perfilError } = await this.supabase
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
        error: `Error al consultar perfil: ${perfilError.message}`,
      };
    }

    const { data: esAdmin, error: adminError } = await this.supabase.rpc('is_admin');

    return {
      email: user.email,
      uid: user.id,
      rolPerfil: perfil?.rol ?? null,
      estado: perfil?.estado_aprobacion ?? null,
      esAdmin: adminError ? null : esAdmin,
      error: adminError?.message ?? null,
    };
  }

  // ==========================================
  // PERFILES Y ROLES
  // ==========================================

  async getUserProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
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
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('rol', 'paciente')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async actualizarEstadoPaciente(pacienteId: string, nuevoEstado: string) {
    return await this.supabase
      .from('perfiles')
      .update({ estado_aprobacion: nuevoEstado })
      .eq('id', pacienteId);
  }

  // ==========================================
  // REALTIME (General)
  // ==========================================

  subscribePacientes(callback: () => void): RealtimeChannel {
    return this.supabase
      .channel('public:perfiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => callback())
      .subscribe();
  }

  unsubscribeChannel(channel: any) {
    if (channel) this.supabase.removeChannel(channel);
  }

  // ==========================================
  // ONBOARDING Y EXPEDIENTES
  // ==========================================

  async subirFoto(pacienteId: string, tipo: string, archivo: File): Promise<string> {
    const extension = archivo.name.split('.').pop() || 'jpg';
    const filePath = `${pacienteId}/${tipo}_${Date.now()}.${extension}`;
    const { error } = await this.supabase.storage
      .from('fotos-pacientes')
      .upload(filePath, archivo, {
        contentType: archivo.type,
        upsert: false,
      });

    if (error) {
      console.error(`[Storage] Error al subir ${tipo}:`, error);
      throw new Error(`No se pudo subir la foto de ${tipo}: ${error.message}`);
    }

    const { data } = this.supabase.storage.from('fotos-pacientes').getPublicUrl(filePath);
    return data.publicUrl;
  }

  async guardarExpedienteInicial(
    pacienteId: string,
    respuestas: any,
    linksFotos: any,
  ): Promise<void> {
    const { error: perfilError } = await this.supabase
      .from('perfiles')
      .update({
        nombre_completo: respuestas.nombre_completo,
        peso_kg: respuestas.peso_kg,
        altura_cm: respuestas.altura_cm,
        edad: respuestas.edad,
        genero: respuestas.genero,
      })
      .eq('id', pacienteId);

    if (perfilError) {
      console.error('[Onboarding] Error al actualizar el perfil:', perfilError);
      throw new Error(`No se pudo actualizar el perfil: ${perfilError.message}`);
    }

    const { data: expediente, error: expedienteError } = await this.supabase
      .from('expedientes_clinicos')
      .upsert({
        id_perfil: pacienteId,
        respuestas_completas: respuestas,
        fotos_progreso: linksFotos,
      })
      .select('id_perfil, respuestas_completas, fotos_progreso')
      .maybeSingle();

    if (expedienteError) {
      console.error('[Onboarding] Error al guardar el expediente:', expedienteError);
      throw new Error(`No se pudo guardar el expediente: ${expedienteError.message}`);
    }

    if (!expediente?.id_perfil) {
      throw new Error('El expediente no pudo verificarse después de guardarse.');
    }

    console.info('[Onboarding] Expediente guardado y verificado:', {
      tieneRespuestas: Boolean(expediente.respuestas_completas),
      cantidadFotos: Object.keys(expediente.fotos_progreso ?? {}).length,
    });
  }

  async getExpedienteClinico(pacienteId: string) {
    const { data, error } = await this.supabase
      .from('expedientes_clinicos')
      .select('id_perfil, respuestas_completas, fotos_progreso')
      .eq('id_perfil', pacienteId)
      .maybeSingle();

    if (error) {
      console.error('[Expediente] Error al consultar:', {
        code: error.code,
        message: error.message,
      });

      return null;
    }

    return data;
  }
  async guardarCircunferencias(pacienteId: string, medidas: any) {
    return await this.supabase.from('perfiles').update(medidas).eq('id', pacienteId);
  }

  async guardarRegistroFotografico(pacienteId: string, links: any) {
    return await this.supabase.from('expedientes_clinicos').upsert({
      id_perfil: pacienteId,
      fotos_progreso: links,
      fecha_actualizacion: new Date().toISOString(),
    });
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

  async guardarTestimonio(
    pacienteId: string,
    texto: string,
    fotoAntesUrl?: string,
    fotoDespuesUrl?: string,
  ) {
    const { error } = await this.supabase.from('testimonios').insert({
      id_perfil: pacienteId,
      texto: texto,
      foto_antes: fotoAntesUrl,
      foto_despues: fotoDespuesUrl,
      aprobado: false, // Siempre entra en revisión
    });
    if (error) throw error;
  }

  //Testimonios públicos para la sección de testimonios en la página principal
  /**
   * Obtiene los testimonios para el panel de administración.
   * La lectura debe estar protegida por políticas RLS.
   */
  async getTestimoniosModeracion() {
    // 1. Comprobar la sesión actual
    const { data: sessionData, error: sessionError } = await this.supabase.auth.getSession();

    console.log('[Testimonios] Proyecto:', new URL(environment.supabaseUrl).hostname);

    console.log(
      '[Testimonios] Usuario autenticado:',
      sessionData.session?.user?.id ?? 'Sin sesión',
    );

    console.log('[Testimonios] Usuario:', sessionData.session?.user?.email ?? 'Sin correo');

    console.log('[Testimonios] Error de sesión:', sessionError);

    // 2. Consultar los testimonios
    const { data, error } = await this.supabase
      .from('testimonios')
      .select('*')
      .order('created_at', { ascending: false });

    // 3. Mostrar el resultado de la consulta
    console.log('[Testimonios] Error de consulta:', error);
    console.log('[Testimonios] Registros recibidos:', data);
    console.log('[Testimonios] Cantidad:', data?.length ?? 0);

    // 4. Propagar el error si la consulta falla
    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Actualiza el estado de moderación de un testimonio.
   * La autorización debe garantizarse también mediante RLS.
   */
  async moderarTestimonio(testimonioId: string, estado: 'aprobado' | 'rechazado'): Promise<void> {
    const { error } = await this.supabase
      .from('testimonios')
      .update({
        estado_moderacion: estado,
        aprobado: estado === 'aprobado',
      })
      .eq('id', testimonioId);

    if (error) {
      throw error;
    }
  }

   /**
   * Testimonios aprobados para la página pública.
   * Solo columnas públicas: no se expone id_perfil ni el nombre del paciente,
   * y no depende de leer la tabla perfiles (que quedará protegida por RLS).
   */
  async getTestimoniosPublicos() {
    const { data, error } = await this.supabase
      .from('testimonios')
      .select('id, texto, foto_antes, foto_despues, created_at')
      .eq('aprobado', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Testimonios] No se pudieron cargar los testimonios públicos:', error);
      return [];
    }

    return data ?? [];
  }

  //Administración de usuarios y roles
}
