import { Injectable } from '@angular/core';
import {
  AuthChangeEvent,
  createClient,
  RealtimeChannel,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { environment } from '../../../enviroments/enviroments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  // ==========================================
  // 1. MÉTODOS DE AUTENTICACIÓN
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

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.withTimeout(
      this.supabase.auth.getSession(),
      'Tiempo agotado al obtener la sesión.',
    );
    if (error) throw error;
    return data.session;
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  async signOut() {
    this.clearLocalSession();
    const { error } = await this.withTimeout(
      this.supabase.auth.signOut({ scope: 'local' }),
      'Tiempo agotado al cerrar sesión.',
      1500,
      { error: null },
    );
    this.clearLocalSession();
    if (error) throw error;
  }

  clearLocalSession() {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') {
      return;
    }

    const clearStorage = (storage: Storage) => {
      Object.keys(storage)
        .filter((key) => key.startsWith('sb-') || key.includes('supabase'))
        .forEach((key) => storage.removeItem(key));
    };

    clearStorage(localStorage);
    clearStorage(sessionStorage);
  }

  getCachedAuthUser(): { id: string; email?: string } | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) {
        continue;
      }

      try {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) continue;

        const parsed = JSON.parse(rawValue);
        const user = parsed?.user;

        if (user?.id) {
          return {
            id: user.id,
            email: user.email,
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  // ==========================================
  // 2. MÉTODOS DE RECUPERACIÓN
  // ==========================================

  async resetPassword(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:4200/actualizar-password', 
    });
    if (error) throw error;
    return data;
  }

  async updatePassword(newPassword: string) {
    const { data, error } = await this.supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return data;
  }

  // ==========================================
  // 3. MÉTODOS DE PERFIL Y ADMINISTRACIÓN
  // ==========================================

  async getUserProfile(userId: string) {
    const { data, error } = await this.withTimeout(this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single(), 'Tiempo agotado al obtener el perfil.');

    if (error) {
      console.error("Error obteniendo el perfil:", error);
      return null;
    }
    return data;
  }

  async getUserProfileForAuth(userId: string, email?: string) {
    const profileById = await this.getUserProfile(userId);
    if (profileById) return profileById;

    if (!email) return null;

    try {
      const { data, error } = await this.withTimeout(this.supabase
        .from('perfiles')
        .select('*')
        .eq('email', email)
        .maybeSingle(), 'Tiempo agotado al buscar el perfil por correo.');

      if (error) {
        console.warn('No se pudo buscar perfil por correo:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('Busqueda de perfil por correo no disponible:', error);
      return null;
    }
  }

  async getPacientes() {
    const { data, error } = await this.withTimeout(this.supabase
      .from('perfiles')
      .select('*')
      .eq('rol', 'paciente')
      .order('created_at', { ascending: false }), 'Tiempo agotado al cargar pacientes.');

    if (error) throw error;
    return data;
  }

  subscribePacientes(callback: () => void): RealtimeChannel {
    return this.supabase
      .channel('perfiles-admin-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, () => {
        callback();
      })
      .subscribe();
  }

  subscribePlanPaciente(pacienteId: string, callback: () => void): RealtimeChannel[] {
    return [
      this.supabase
        .channel(`plan-paciente-${pacienteId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'planes_nutricionales',
            filter: `id_perfil=eq.${pacienteId}`,
          },
          () => callback(),
        )
        .subscribe(),
      this.supabase
        .channel(`comidas-paciente-${pacienteId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comidas' }, () => callback())
        .subscribe(),
      this.supabase
        .channel(`alimentos-paciente-${pacienteId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alimentos_comida' }, () => callback())
        .subscribe(),
    ];
  }

  unsubscribeChannel(channel: RealtimeChannel) {
    return this.supabase.removeChannel(channel);
  }

  async actualizarEstadoPaciente(pacienteId: string, nuevoEstado: string) {
    const { data, error } = await this.supabase
      .from('perfiles')
      .update({ estado_aprobacion: nuevoEstado })
      .eq('id', pacienteId);
      
    if (error) throw error;
    return data;
  }

  async getPlanPaciente(pacienteId: string) {
    const { data: planes, error } = await this.withTimeout(this.supabase
      .from('planes_nutricionales')
      .select('*')
      .eq('id_perfil', pacienteId)
      .limit(1), 'Tiempo agotado al cargar el plan.');

    if (error) throw error;

    const plan = (planes ?? [])[0] ?? null;
    if (!plan) return null;

    const { data: comidas, error: comidasError } = await this.withTimeout(this.supabase
      .from('comidas')
      .select('*')
      .eq('id_plan', plan.id), 'Tiempo agotado al cargar las comidas.');

    if (comidasError) throw comidasError;

    const comidaIds = (comidas ?? []).map((comida: any) => comida.id).filter(Boolean);
    let alimentos: any[] = [];

    if (comidaIds.length > 0) {
      const { data: alimentosData, error: alimentosError } = await this.withTimeout(this.supabase
        .from('alimentos_comida')
        .select('*')
        .in('id_comida', comidaIds), 'Tiempo agotado al cargar los alimentos.');

      if (alimentosError) throw alimentosError;
      alimentos = alimentosData ?? [];
    }

    return {
      ...plan,
      comidas: (comidas ?? []).map((comida: any) => ({
        ...comida,
        alimentos_comida: alimentos.filter((alimento) => alimento.id_comida === comida.id),
      })),
    };
  }

  async guardarPlanCompleto(pacienteId: string, planData: any) {
    await this.eliminarPlanesPaciente(pacienteId);

    const { data: plan, error: pError } = await this.supabase
      .from('planes_nutricionales')
      .insert({
        id_perfil: pacienteId,
        calorias_totales: planData.calorias_totales,
        suplementacion: planData.suplementacion,
        medicacion: planData.medicacion
      })
      .select()
      .single();

    if (pError) throw pError;

    for (const c of planData.comidas ?? []) {
      const { data: comida, error: cError } = await this.supabase
        .from('comidas')
        .insert({ id_plan: plan.id, nombre: c.nombre, nota_comida: c.nota_comida })
        .select().single();

      if (cError) throw cError;

      if ((c.alimentos ?? []).length > 0) {
        const alimentosInsert = c.alimentos.map((a: any) => ({
          id_comida: comida.id,
          descripcion: a.descripcion,
          calorias: a.calorias,
          proteinas: a.proteinas,
          carbos: a.carbos,
          grasas: a.grasas
        }));
        const { error: alimentosError } = await this.supabase.from('alimentos_comida').insert(alimentosInsert);
        if (alimentosError) throw alimentosError;
      }
    }
  }

  private async eliminarPlanesPaciente(pacienteId: string) {
    const { data: planes, error: planesError } = await this.supabase
      .from('planes_nutricionales')
      .select('id')
      .eq('id_perfil', pacienteId);

    if (planesError) throw planesError;

    const planIds = (planes ?? []).map((plan: any) => plan.id).filter(Boolean);
    if (planIds.length === 0) return;

    const { data: deletedPlans, error: directDeleteError } = await this.supabase
      .from('planes_nutricionales')
      .delete()
      .in('id', planIds)
      .select('id');

    if (!directDeleteError && (deletedPlans?.length ?? 0) >= planIds.length) return;
    if (directDeleteError) {
      console.warn('No se pudo eliminar el plan directo; intentando limpiar detalle.', directDeleteError);
    }

    const { data: comidas, error: comidasError } = await this.supabase
      .from('comidas')
      .select('id')
      .in('id_plan', planIds);

    if (comidasError) throw comidasError;

    const comidaIds = (comidas ?? []).map((comida: any) => comida.id).filter(Boolean);
    if (comidaIds.length > 0) {
      const { error: alimentosError } = await this.supabase
        .from('alimentos_comida')
        .delete()
        .in('id_comida', comidaIds);

      if (alimentosError) throw alimentosError;
    }

    const { error: comidasDeleteError } = await this.supabase
      .from('comidas')
      .delete()
      .in('id_plan', planIds);

    if (comidasDeleteError) throw comidasDeleteError;

    const { error: planesDeleteError } = await this.supabase
      .from('planes_nutricionales')
      .delete()
      .in('id', planIds);

    if (planesDeleteError) throw planesDeleteError;
  }

  // ==========================================
  // 4. MÉTODOS DE ONBOARDING Y FOTOGRAFÍAS
  // ==========================================

  // 🟢 SUBIR FOTOS AL STORAGE
  async subirFoto(pacienteId: string, tipo: string, archivo: File) {
    const filePath = `${pacienteId}/${tipo}_${Date.now()}`;

    const { data, error } = await this.supabase.storage
      .from('fotos-pacientes')
      .upload(filePath, archivo);

    if (error) throw error;

    // Obtenemos la URL pública para guardarla en el expediente
    const { data: urlData } = this.supabase.storage
      .from('fotos-pacientes')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  // 🟢 GUARDAR EL EXPEDIENTE COMPLETO (TEXTOS + LINKS DE FOTOS)
// 🟢 GUARDAR EL EXPEDIENTE COMPLETO (TEXTOS + LINKS DE FOTOS)
  async guardarExpedienteInicial(pacienteId: string, respuestas: any, linksFotos: any) {

    // PASO 1: Actualizar los datos vitales en la tabla 'perfiles' (Para la calculadora)
    const { error: perfilError } = await this.supabase
      .from('perfiles')
      .update({
        nombre_completo: respuestas.nombre_completo,
        peso_kg: respuestas.peso_kg,
        altura_cm: respuestas.altura_cm,
        edad: respuestas.edad,
        genero: respuestas.genero
      })
      .eq('id', pacienteId);

    if (perfilError) throw perfilError;

    const expedienteActual = await this.getExpedienteClinico(pacienteId);
    const respuestasPrevias = expedienteActual?.respuestas_completas ?? {};
    const fotosPrevias = expedienteActual?.fotos_progreso ?? {};
    const respuestasCompletas = {
      ...respuestasPrevias,
      ...respuestas,
    };

    if (respuestasPrevias.seguimiento) {
      respuestasCompletas.seguimiento = respuestasPrevias.seguimiento;
    }

    const expedientePayload = {
      id_perfil: pacienteId,
      respuestas_completas: respuestasCompletas,
      fotos_progreso: {
        ...fotosPrevias,
        ...linksFotos,
      },
    };

    const expedienteQuery = expedienteActual
      ? this.supabase.from('expedientes_clinicos').update(expedientePayload).eq('id_perfil', pacienteId)
      : this.supabase.from('expedientes_clinicos').insert(expedientePayload);

    const { error: expedienteError } = await expedienteQuery;

    if (expedienteError) throw expedienteError;
  }

  // 🟢 TRAER EL EXPEDIENTE CLÍNICO (Cuestionario y Fotos)
  async getExpedienteClinico(pacienteId: string) {
    const { data, error } = await this.withTimeout(this.supabase
      .from('expedientes_clinicos')
      .select('*')
      .eq('id_perfil', pacienteId)
      .maybeSingle(), 'Tiempo agotado al cargar el expediente.');

    if (error) throw error;
    return data;
  }

  async guardarCircunferencias(pacienteId: string, medidas: Record<string, number>) {
    const expedienteActual = await this.getExpedienteClinico(pacienteId);
    const respuestas = expedienteActual?.respuestas_completas ?? {};
    const seguimiento = respuestas.seguimiento ?? {};
    const registrosActuales = Array.isArray(seguimiento.circunferencias)
      ? seguimiento.circunferencias
      : [];

    const respuestasCompletas = {
      ...respuestas,
      seguimiento: {
        ...seguimiento,
        circunferencias: [
          {
            fecha: new Date().toISOString(),
            medidas,
          },
          ...registrosActuales,
        ],
      },
    };

    await this.guardarExpedienteParcial(pacienteId, {
      respuestas_completas: respuestasCompletas,
    });
  }

  async guardarRegistroFotografico(pacienteId: string, fotos: Record<string, File>) {
    const linksFotos: Record<string, string> = {};

    for (const [tipo, archivo] of Object.entries(fotos)) {
      if (archivo) {
        linksFotos[tipo] = await this.subirFoto(pacienteId, `progreso_${tipo}`, archivo);
      }
    }

    const expedienteActual = await this.getExpedienteClinico(pacienteId);
    const fotosPrevias = expedienteActual?.fotos_progreso ?? {};
    const historialActual = Array.isArray(fotosPrevias.historial)
      ? fotosPrevias.historial
      : [];

    await this.guardarExpedienteParcial(pacienteId, {
      fotos_progreso: {
        ...fotosPrevias,
        historial: [
          {
            fecha: new Date().toISOString(),
            fotos: linksFotos,
          },
          ...historialActual,
        ],
      },
    });
  }

  private async guardarExpedienteParcial(pacienteId: string, payload: Record<string, unknown>) {
    const expedienteActual = await this.getExpedienteClinico(pacienteId);
    const query = expedienteActual
      ? this.supabase.from('expedientes_clinicos').update(payload).eq('id_perfil', pacienteId)
      : this.supabase.from('expedientes_clinicos').insert({ id_perfil: pacienteId, ...payload });

    const { error } = await query;
    if (error) throw error;
  }

  private withTimeout<T>(
    promise: PromiseLike<T>,
    message: string,
    timeoutMs = 8000,
    fallback?: T,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (fallback !== undefined) {
          resolve(fallback);
        } else {
          reject(new Error(message));
        }
      }, timeoutMs);

      Promise.resolve(promise)
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

}
