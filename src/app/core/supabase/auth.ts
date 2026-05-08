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
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
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
    const { data } = await this.supabase.from('perfiles').select('*').eq('id', userId).single();
    return data;
  }

  async getUserProfileForAuth(userId: string, email?: string) {
    return await this.getUserProfile(userId);
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
  // PLANES Y REALTIME
  // ==========================================

  async getPlanPaciente(pacienteId: string) {
    const { data } = await this.supabase.from('planes_nutricionales').select('*, comidas(*, alimentos_comida(*))').eq('id_perfil', pacienteId).maybeSingle();
    return data;
  }

  async guardarPlanCompleto(pacienteId: string, planData: any) {
    await this.supabase.from('planes_nutricionales').delete().eq('id_perfil', pacienteId);
    
    const { data: plan, error: pError } = await this.supabase.from('planes_nutricionales').insert({
        id_perfil: pacienteId,
        calorias_totales: planData.calorias_totales,
        suplementacion: planData.suplementacion,
        medicacion: planData.medicacion
      }).select().single();

    if (pError) throw pError;

    if (planData.comidas && planData.comidas.length > 0) {
      for (const c of planData.comidas) {
        const { data: comida, error: cError } = await this.supabase.from('comidas').insert({ id_plan: plan.id, nombre: c.nombre, nota_comida: c.nota_comida }).select().single();
        if (cError) throw cError;

        if (c.alimentos && c.alimentos.length > 0) {
          const alimentosInsert = c.alimentos.map((a: any) => ({
            id_comida: comida.id, descripcion: a.descripcion, calorias: a.calorias, proteinas: a.proteinas, carbos: a.carbos, grasas: a.grasas
          }));
          await this.supabase.from('alimentos_comida').insert(alimentosInsert);
        }
      }
    }
  }

  subscribePacientes(callback: () => void): RealtimeChannel {
    return this.supabase.channel('public:perfiles').on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => callback()).subscribe();
  }

  subscribePlanPaciente(pacienteId: string, callback: (payload: any) => void) {
    return this.supabase.channel(`plan-${pacienteId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'planes_nutricionales', filter: `id_perfil=eq.${pacienteId}` }, callback).subscribe();
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
}