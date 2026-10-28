import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from '../../supabase/auth';
import { FilaCarga, FilaCumplimiento, FilaNota } from '../../../features/panel/progreso/progreso.utils';

/**
 * Resultado de una consulta de progreso.
 * - disponible=false: la tabla aún no existe o el usuario no tiene permiso
 *   (migraciones sin ejecutar). La pantalla lo muestra como "aún no disponible",
 *   nunca como "0 registros".
 * - error: fallo real (red, tiempo agotado...). La pantalla ofrece reintentar.
 */
export interface ResultadoProgreso<T> {
  datos: T[];
  disponible: boolean;
  error: string | null;
}

/** Códigos que significan "esta tabla todavía no está lista para este usuario". */
const CODIGOS_NO_DISPONIBLE = new Set(['PGRST205', '42P01', '42501']);
const TAMANO_PAGINA = 1000; // máximo de filas que devuelve PostgREST por consulta
const MAX_PAGINAS = 20; // tope de seguridad (20 000 filas)

@Injectable({ providedIn: 'root' })
export class ProgresoService {
  private readonly supabase: SupabaseClient;
  private readonly tiempoLimiteMs = 10000;

  constructor(authService: AuthService) {
    this.supabase = authService.supabase;
  }

  /** Comidas marcadas como cumplidas desde `desde` (YYYY-MM-DD). */
  getCumplimiento(pacienteId: string, desde: string): Promise<ResultadoProgreso<FilaCumplimiento>> {
    return this.leerPaginado<FilaCumplimiento>((desdeFila, hastaFila) =>
      this.supabase
        .from('cumplimiento_comidas')
        .select('fecha, comida_index, cumplida')
        .eq('paciente_id', pacienteId)
        .gte('fecha', desde)
        .order('fecha', { ascending: true })
        .order('comida_index', { ascending: true })
        .range(desdeFila, hastaFila),
    );
  }

  /** Pesos registrados por ejercicio desde `desde`. Siempre en kg. */
  getCargas(pacienteId: string, desde: string): Promise<ResultadoProgreso<FilaCarga>> {
    return this.leerPaginado<FilaCarga>((desdeFila, hastaFila) =>
      this.supabase
        .from('registros_carga')
        .select('ejercicio, ejercicio_clave, fecha, peso_kg, unidad_captura')
        .eq('id_perfil', pacienteId)
        .gte('fecha', desde)
        .order('fecha', { ascending: true })
        .order('ejercicio_clave', { ascending: true })
        .range(desdeFila, hastaFila),
    );
  }

  /** Notas de entrenamiento (una por día) desde `desde`. */
  getNotas(pacienteId: string, desde: string): Promise<ResultadoProgreso<FilaNota>> {
    return this.leerPaginado<FilaNota>((desdeFila, hastaFila) =>
      this.supabase
        .from('notas_entrenamiento')
        .select('fecha, nota')
        .eq('id_perfil', pacienteId)
        .gte('fecha', desde)
        .order('fecha', { ascending: true })
        .range(desdeFila, hastaFila),
    );
  }

  /**
   * Lee todas las páginas de una consulta. El filtro por paciente es una
   * comodidad: quien realmente limita lo que se ve es RLS en la base de datos.
   */
  private async leerPaginado<T>(
    pagina: (desdeFila: number, hastaFila: number) => PromiseLike<{ data: unknown; error: any }>,
  ): Promise<ResultadoProgreso<T>> {
    const acumulado: T[] = [];

    try {
      for (let i = 0; i < MAX_PAGINAS; i++) {
        const desdeFila = i * TAMANO_PAGINA;
        const { data, error } = await this.conTiempoLimite(
          pagina(desdeFila, desdeFila + TAMANO_PAGINA - 1),
        );

        if (error) {
          if (this.esNoDisponible(error)) {
            return { datos: [], disponible: false, error: null };
          }
          console.error('[Progreso] Error al consultar:', error);
          return { datos: [], disponible: true, error: 'No se pudo cargar esta información.' };
        }

        const filas = (data ?? []) as T[];
        acumulado.push(...filas);
        if (filas.length < TAMANO_PAGINA) break;
      }
    } catch (error) {
      console.error('[Progreso] Error al consultar:', error);
      return {
        datos: [],
        disponible: true,
        error: 'La consulta tardó demasiado o falló. Intenta de nuevo.',
      };
    }

    return { datos: acumulado, disponible: true, error: null };
  }

  private esNoDisponible(error: { code?: string; status?: number }): boolean {
    return CODIGOS_NO_DISPONIBLE.has(String(error.code ?? '')) || error.status === 404;
  }

  private conTiempoLimite<T>(solicitud: PromiseLike<T>): Promise<T> {
    let temporizador: ReturnType<typeof globalThis.setTimeout> | undefined;
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = globalThis.setTimeout(
        () => rechazar(new Error('Tiempo de espera agotado')),
        this.tiempoLimiteMs,
      );
    });
    return Promise.race([Promise.resolve(solicitud), limite]).finally(() =>
      globalThis.clearTimeout(temporizador),
    );
  }
}
