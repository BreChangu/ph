// =====================================================================
// Funciones puras para la "Revisión de progreso" (sin Angular ni Supabase).
// Todas las fechas son cadenas 'YYYY-MM-DD' en hora de Ciudad de México.
// La semana va de lunes a domingo.
// =====================================================================

export const ZONA_HORARIA = 'America/Mexico_City';
export const KG_POR_LB = 0.45359237;
/** Semanas que se cargan y se grafican (la actual + 7 anteriores). */
export const SEMANAS_VISIBLES = 8;

export type Unidad = 'kg' | 'lb';

export interface FilaCumplimiento {
  fecha: string;
  comida_index: number | null;
  cumplida: boolean | null;
}

export interface FilaCarga {
  ejercicio: string;
  ejercicio_clave: string;
  fecha: string;
  peso_kg: number | string;
  unidad_captura?: string | null;
}

export interface FilaNota {
  fecha: string;
  nota: string;
}

export interface CumplimientoSemana {
  semana: string;
  cumplidas: number;
  esperadas: number;
  /** null cuando no se conoce el plan (no hay denominador) */
  porcentaje: number | null;
}

export interface SesionesSemana {
  semana: string;
  sesiones: number;
}

export interface PesosEjercicio {
  clave: string;
  nombre: string;
  /** peso máximo registrado en kg, por inicio de semana */
  porSemana: Record<string, number>;
}

export interface FilaProgresion {
  clave: string;
  nombre: string;
  anteriorKg: number | null;
  actualKg: number;
  deltaKg: number | null;
}

// ---------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MS_DIA = 86_400_000;

function aUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function deUTC(ms: number): string {
  const f = new Date(ms);
  const mes = String(f.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(f.getUTCDate()).padStart(2, '0');
  return `${f.getUTCFullYear()}-${mes}-${dia}`;
}

/** Fecha de hoy en Ciudad de México (no en UTC). */
export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export function sumarDias(iso: string, dias: number): string {
  return deUTC(aUTC(iso) + dias * MS_DIA);
}

/** Días de a a b (positivo si b es posterior). */
export function diferenciaDias(a: string, b: string): number {
  return Math.round((aUTC(b) - aUTC(a)) / MS_DIA);
}

/** Lunes de la semana a la que pertenece la fecha. */
export function inicioSemanaISO(iso: string): string {
  const diaSemana = new Date(aUTC(iso)).getUTCDay(); // 0 = domingo
  return sumarDias(iso, -((diaSemana + 6) % 7));
}

/** Inicios de las últimas `cantidad` semanas, de la más antigua a la actual. */
export function semanasRecientes(hoy: string, cantidad: number = SEMANAS_VISIBLES): string[] {
  const actual = inicioSemanaISO(hoy);
  return Array.from({ length: cantidad }, (_, i) => sumarDias(actual, -7 * (cantidad - 1 - i)));
}

function partes(iso: string): { d: number; m: number } {
  const [, m, d] = iso.split('-').map(Number);
  return { d, m };
}

/** "20–26 oct" o "28 sep – 4 oct" */
export function etiquetaRango(inicio: string): string {
  const a = partes(inicio);
  const b = partes(sumarDias(inicio, 6));
  return a.m === b.m
    ? `${a.d}–${b.d} ${MESES[b.m - 1]}`
    : `${a.d} ${MESES[a.m - 1]} – ${b.d} ${MESES[b.m - 1]}`;
}

/** "20 oct" (lunes de la semana), para el eje de las gráficas. */
export function etiquetaCorta(inicio: string): string {
  const { d, m } = partes(inicio);
  return `${d} ${MESES[m - 1]}`;
}

/** "27 oct" para mostrar el día de una nota. */
export function etiquetaDia(iso: string): string {
  return etiquetaCorta(iso);
}

// ---------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------
export function kgAUnidad(kg: number, unidad: Unidad): number {
  return unidad === 'lb' ? kg / KG_POR_LB : kg;
}

export function unidadAKg(valor: number, unidad: Unidad): number {
  return unidad === 'lb' ? valor * KG_POR_LB : valor;
}

/** Lee lo que escribe el usuario ("102.5", "102,5"). null si no es un peso válido. */
export function leerPeso(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const valor = Number(limpio);
  return valor > 0 ? valor : null;
}

function redondear1(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** "100", "45.4" (sin ceros sobrantes). */
export function formatoPeso(kg: number, unidad: Unidad): string {
  return String(redondear1(kgAUnidad(kg, unidad)));
}

/** "+5", "-2.5" o "=" cuando el cambio redondeado es cero. */
export function formatoCambio(deltaKg: number, unidad: Unidad): string {
  const v = redondear1(kgAUnidad(deltaKg, unidad));
  if (v === 0) return '=';
  return v > 0 ? `+${v}` : String(v);
}

const CLAVE_UNIDAD = 'ph_unidad_peso';

/** Preferencia de unidad guardada en este navegador (kg por defecto). */
export function leerUnidadPreferida(): Unidad {
  try {
    return globalThis.localStorage?.getItem(CLAVE_UNIDAD) === 'lb' ? 'lb' : 'kg';
  } catch {
    return 'kg';
  }
}

export function guardarUnidadPreferida(unidad: Unidad): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_UNIDAD, unidad);
  } catch {
    /* sin almacenamiento: la preferencia solo dura la sesión */
  }
}

// ---------------------------------------------------------------------
// Captura de carga en Entrenamiento
// ---------------------------------------------------------------------

/**
 * Clave con la que se agrupa un ejercicio aunque cambien mayúsculas o espacios en las orillas.
 * Debe dar lo mismo que la columna generada en Supabase: lower(btrim(ejercicio)).
 */
export function claveEjercicio(nombre: string): string {
  return nombre.replace(/^ +| +$/g, '').toLowerCase();
}

export interface ResumenCarga {
  /** Peso registrado hoy, si existe. */
  hoyKg: number | null;
  /** Último peso registrado antes de hoy. */
  previaKg: number | null;
  previaFecha: string | null;
  /**
   * Cambio a mostrar: hoy contra la vez anterior, o, si hoy no hay registro,
   * la última vez contra la penúltima.
   */
  deltaKg: number | null;
}

/** Resume el historial de un ejercicio (cualquier orden) respecto a `hoy`. */
export function resumenCarga(filas: Pick<FilaCarga, 'fecha' | 'peso_kg'>[], hoy: string): ResumenCarga {
  const ordenadas = filas
    .map((f) => ({ fecha: f.fecha, kg: Number(f.peso_kg) }))
    .filter((f) => Number.isFinite(f.kg) && f.kg > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const deHoy = ordenadas.find((f) => f.fecha === hoy) ?? null;
  const anteriores = ordenadas.filter((f) => f.fecha < hoy);
  const previa = anteriores[0] ?? null;
  const antesDePrevia = anteriores[1] ?? null;

  let deltaKg: number | null = null;
  if (deHoy && previa) deltaKg = deHoy.kg - previa.kg;
  else if (!deHoy && previa && antesDePrevia) deltaKg = previa.kg - antesDePrevia.kg;

  return {
    hoyKg: deHoy?.kg ?? null,
    previaKg: previa?.kg ?? null,
    previaFecha: previa?.fecha ?? null,
    deltaKg,
  };
}

// ---------------------------------------------------------------------
// Agregaciones semanales
// ---------------------------------------------------------------------
function dentroDeSemana(fecha: string, inicio: string): boolean {
  const d = diferenciaDias(inicio, fecha);
  return d >= 0 && d <= 6;
}

/**
 * Comidas cumplidas por semana. Una comida cuenta una vez por día.
 * Para la semana en curso, el denominador solo incluye los días ya transcurridos.
 */
export function cumplimientoPorSemana(
  filas: FilaCumplimiento[],
  semanas: string[],
  comidasPorDia: number,
  hoy: string,
): CumplimientoSemana[] {
  return semanas.map((semana) => {
    const unicas = new Set<string>();
    for (const f of filas) {
      if (f.cumplida === false || !dentroDeSemana(f.fecha, semana)) continue;
      unicas.add(`${f.fecha}|${f.comida_index}`);
    }
    const cumplidas = unicas.size;
    const transcurridos = Math.max(0, Math.min(7, diferenciaDias(semana, hoy) + 1));
    const esperadas = comidasPorDia > 0 ? comidasPorDia * transcurridos : 0;
    const porcentaje =
      esperadas > 0 ? Math.min(100, Math.round((cumplidas / esperadas) * 100)) : null;
    return { semana, cumplidas, esperadas, porcentaje };
  });
}

/** Días distintos con al menos una carga registrada, por semana. */
export function sesionesPorSemana(cargas: FilaCarga[], semanas: string[]): SesionesSemana[] {
  return semanas.map((semana) => {
    const dias = new Set<string>();
    for (const c of cargas) {
      if (dentroDeSemana(c.fecha, semana)) dias.add(c.fecha);
    }
    return { semana, sesiones: dias.size };
  });
}

/** Peso máximo por ejercicio y semana. El nombre mostrado es el del registro más reciente. */
export function pesoMaximoPorEjercicio(cargas: FilaCarga[], semanas: string[]): PesosEjercicio[] {
  const porClave = new Map<string, PesosEjercicio & { ultimaFecha: string }>();

  for (const c of cargas) {
    const peso = Number(c.peso_kg);
    if (!Number.isFinite(peso) || peso <= 0) continue;
    const semana = semanas.find((s) => dentroDeSemana(c.fecha, s));
    if (!semana) continue;

    let entrada = porClave.get(c.ejercicio_clave);
    if (!entrada) {
      entrada = { clave: c.ejercicio_clave, nombre: c.ejercicio, porSemana: {}, ultimaFecha: c.fecha };
      porClave.set(c.ejercicio_clave, entrada);
    }
    if (c.fecha >= entrada.ultimaFecha) {
      entrada.ultimaFecha = c.fecha;
      entrada.nombre = c.ejercicio;
    }
    entrada.porSemana[semana] = Math.max(entrada.porSemana[semana] ?? 0, peso);
  }

  return [...porClave.values()]
    .map(({ ultimaFecha: _ultima, ...resto }) => resto)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Ejercicios con carga en la semana seleccionada, comparados con la semana previa. */
export function progresionSemana(
  ejercicios: PesosEjercicio[],
  semana: string,
  semanaPrevia: string,
): FilaProgresion[] {
  const filas: FilaProgresion[] = [];
  for (const e of ejercicios) {
    const actualKg = e.porSemana[semana];
    if (actualKg === undefined) continue;
    const anteriorKg = e.porSemana[semanaPrevia] ?? null;
    filas.push({
      clave: e.clave,
      nombre: e.nombre,
      anteriorKg,
      actualKg,
      deltaKg: anteriorKg === null ? null : actualKg - anteriorKg,
    });
  }
  return filas;
}

/** Tolerancia: una diferencia menor a 1 gramo se considera "igual". */
export function subioDePeso(fila: FilaProgresion): boolean {
  return fila.deltaKg !== null && fila.deltaKg > 0.001;
}

export function notasDeSemana(notas: FilaNota[], semana: string): FilaNota[] {
  return notas
    .filter((n) => dentroDeSemana(n.fecha, semana))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
