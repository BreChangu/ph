import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { PlanNutricional, Comida } from '../../models/plan.models';
import { AuthService } from '../../supabase/auth';

@Injectable({
  providedIn: 'root'
})
export class PlanNutricionalService {
  private supabase: SupabaseClient;
  private readonly requestTimeoutMs = 10000;

  constructor(private authService: AuthService) {
    this.supabase = this.authService.supabase;
  }

  // ==========================================
  // OBTENER EL PLAN
  // ==========================================
  async getPlanPaciente(pacienteId: string): Promise<PlanNutricional | null> {
    const { data: planes, error } = await this.withTimeout(
      this.supabase
        .from('planes_nutricionales')
        .select('*')
        .eq('id_perfil', pacienteId)
        .limit(1),
      'La consulta del plan nutricional tardó demasiado.'
    );

    if (error) throw error;

    const plan = (planes ?? [])[0] as PlanNutricional | undefined;
    if (!plan?.id) return null;

    const { data: comidas, error: comidasError } = await this.withTimeout(
      this.supabase
        .from('comidas')
        .select('*')
        .eq('id_plan', plan.id),
      'La consulta de comidas tardó demasiado.'
    );

    if (comidasError) throw comidasError;

    const comidaIds = (comidas ?? []).map((comida) => comida.id).filter(Boolean);
    let alimentos: any[] = [];

    if (comidaIds.length > 0) {
      const { data: alimentosData, error: alimentosError } = await this.withTimeout(
        this.supabase
          .from('alimentos_comida')
          .select('*')
          .in('id_comida', comidaIds),
        'La consulta de alimentos tardó demasiado.'
      );

      if (alimentosError) throw alimentosError;
      alimentos = alimentosData ?? [];
    }

    return {
      ...plan,
      comidas: (comidas ?? []).map((comida) => ({
        ...comida,
        alimentos_comida: alimentos.filter((alimento) => alimento.id_comida === comida.id)
      }))
    } as PlanNutricional;
  }

  // ==========================================
  // GUARDAR PLAN (BATCH INSERT DE ALTO RENDIMIENTO)
  // ==========================================
  async guardarPlanCompleto(pacienteId: string, planData: PlanNutricional): Promise<void> {
    const comidasConDetalle = this.getComidasConDetalle(planData);

    if (comidasConDetalle.length === 0) {
      throw new Error('Agrega al menos una comida con un alimento antes de guardar el plan.');
    }

    const { data: plan, error: planError } = await this.withTimeout(
      this.supabase
        .from('planes_nutricionales')
        .upsert({
          id_perfil: pacienteId,
          calorias_totales: planData.calorias_totales,
          suplementacion: planData.suplementacion,
          medicacion: planData.medicacion
        }, { onConflict: 'id_perfil' })
        .select()
        .single(),
      'La actualización del plan tardó demasiado.'
    );

    if (planError) throw planError;

    // Limpiar detalle viejo antes de reinsertar el plan completo
    const { data: comidasViejas, error: comidasViejasError } = await this.withTimeout(
      this.supabase
        .from('comidas')
        .select('id')
        .eq('id_plan', plan.id),
      'La consulta de comidas anteriores tardó demasiado.'
    );

    if (comidasViejasError) throw comidasViejasError;

    const comidaIds = (comidasViejas ?? []).map((comida) => comida.id).filter(Boolean);
    if (comidaIds.length > 0) {
      const { error: alimentosDeleteError } = await this.withTimeout(
        this.supabase
          .from('alimentos_comida')
          .delete()
          .in('id_comida', comidaIds),
        'La limpieza de alimentos anteriores tardó demasiado.'
      );

      if (alimentosDeleteError) throw alimentosDeleteError;
    }

    const { error: comidasDeleteError } = await this.withTimeout(
      this.supabase
        .from('comidas')
        .delete()
        .eq('id_plan', plan.id),
      'La limpieza de comidas anteriores tardó demasiado.'
    );

    if (comidasDeleteError) throw comidasDeleteError;

    // Batch Insert de Comidas
    const comidasToInsert = comidasConDetalle.map((c: Comida) => ({
      id_plan: plan.id,
      nombre: c.nombre,
      nota_comida: c.nota_comida
    }));

    const { data: comidasGuardadas, error: comidasError } = await this.withTimeout(
      this.supabase
        .from('comidas')
        .insert(comidasToInsert)
        .select(),
      'El guardado de comidas tardó demasiado.'
    );

    if (comidasError) throw comidasError;

    // Preparar Alimentos
    const alimentosToInsert: any[] = [];
    comidasConDetalle.forEach((comidaForm: Comida, index: number) => {
      const idComidaInsertada = comidasGuardadas[index].id;
      const alimentosComida = (comidaForm as any).alimentos_comida ?? (comidaForm as any).alimentos ?? [];

      if (alimentosComida.length > 0) {
        alimentosComida.forEach((alimento: any) => {
          alimentosToInsert.push({
            id_comida: idComidaInsertada,
            descripcion: alimento.descripcion,
            calorias: Number(alimento.calorias) || 0,
            proteinas: Number(alimento.proteinas) || 0,
            carbos: Number(alimento.carbos) || 0,
            grasas: Number(alimento.grasas) || 0
          });
        });
      }
    });

    // Batch Insert de Alimentos
    if (alimentosToInsert.length > 0) {
      const { error: alimentosError } = await this.withTimeout(
        this.supabase
          .from('alimentos_comida')
          .insert(alimentosToInsert),
        'El guardado de alimentos tardó demasiado.'
      );
      if (alimentosError) throw alimentosError;
    }
  }

  private getComidasConDetalle(planData: PlanNutricional): Comida[] {
    return (planData.comidas ?? [])
      .map((comida) => {
        const alimentos = ((comida as any).alimentos_comida ?? (comida as any).alimentos ?? [])
          .filter((alimento: any) => String(alimento?.descripcion ?? '').trim().length > 0);

        return {
          ...comida,
          nombre: String(comida.nombre ?? '').trim(),
          alimentos_comida: alimentos,
        };
      })
      .filter((comida) => comida.nombre.length > 0 && (comida.alimentos_comida?.length ?? 0) > 0);
  }

  // ==========================================
  // WEBSOCKETS (REALTIME)
  // ==========================================
  subscribePlanPaciente(pacienteId: string, callback: () => void) {
    return this.supabase
      .channel('plan_nutricional_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planes_nutricionales', filter: `id_perfil=eq.${pacienteId}` },
        callback
      )
      .subscribe();
  }

  unsubscribeChannel(channel: any) {
    this.supabase.removeChannel(channel);
  }

  private withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
    return Promise.race([
      Promise.resolve(request),
      new Promise<T>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error(message)), this.requestTimeoutMs);
      }),
    ]);
  }
}
