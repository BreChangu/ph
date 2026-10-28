import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ProgresoService, ResultadoProgreso } from '../../../core/services/progreso/progreso.service';
import {
  FilaCarga,
  FilaCumplimiento,
  FilaNota,
  SEMANAS_VISIBLES,
  Unidad,
  cumplimientoPorSemana,
  etiquetaCorta,
  etiquetaDia,
  etiquetaRango,
  formatoCambio,
  formatoPeso,
  guardarUnidadPreferida,
  hoyISO,
  kgAUnidad,
  leerUnidadPreferida,
  notasDeSemana,
  pesoMaximoPorEjercicio,
  progresionSemana,
  semanasRecientes,
  sesionesPorSemana,
  subioDePeso,
  sumarDias,
} from './progreso.utils';

type Metrica = 'comidas' | 'sesiones';

interface Barra {
  semana: string;
  etiqueta: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  valorTexto: string;
  sinDato: boolean;
  seleccionada: boolean;
}

interface Punto {
  x: number;
  y: number;
  semana: string;
  texto: string;
}

/** Medidas internas (viewBox) de las gráficas. */
const ANCHO = 320;
const ALTO_BARRAS = 150;
const ALTO_LINEA = 150;
const MARGEN_IZQ = 8;
const MARGEN_DER = 8;
const MARGEN_SUP = 18;
const MARGEN_INF = 26;

@Component({
  selector: 'app-progreso-semanal',
  standalone: true,
  templateUrl: './progreso-semanal.html',
  styleUrl: './progreso-semanal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgresoSemanalComponent {
  private readonly servicio = inject(ProgresoService);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /** Id del paciente (perfiles.id). */
  readonly pacienteId = input<string | null>(null);
  /** Comidas que tiene el plan por día (0 si aún no se conoce). */
  readonly comidasPorDia = input<number>(0);
  /** Días de entrenamiento de la rutina (meta de sesiones por semana). */
  readonly diasRutina = input<number>(0);

  readonly ancho = ANCHO;
  readonly altoBarras = ALTO_BARRAS;
  readonly altoLinea = ALTO_LINEA;

  // ---------- estado ----------
  readonly cargando = signal(false);
  readonly unidad = signal<Unidad>('kg');
  readonly metrica = signal<Metrica>('comidas');
  /** Índice (0 = más antigua, 7 = actual) de la semana seleccionada. */
  readonly indiceSemana = signal(SEMANAS_VISIBLES - 1);
  readonly claveEjercicio = signal<string | null>(null);

  private readonly hoy = signal(hoyISO());
  private readonly cumplimiento = signal<ResultadoProgreso<FilaCumplimiento>>(this.vacio());
  private readonly cargas = signal<ResultadoProgreso<FilaCarga>>(this.vacio());
  private readonly notas = signal<ResultadoProgreso<FilaNota>>(this.vacio());
  private cargaActual = 0;

  // ---------- derivados ----------
  readonly semanas = computed(() => semanasRecientes(this.hoy()));
  readonly semanaSeleccionada = computed(() => this.semanas()[this.indiceSemana()]);
  readonly rangoSemana = computed(() => etiquetaRango(this.semanaSeleccionada()));
  readonly esSemanaActual = computed(() => this.indiceSemana() === this.semanas().length - 1);
  readonly puedeRetroceder = computed(() => this.indiceSemana() > 0);
  readonly puedeAvanzar = computed(() => !this.esSemanaActual());

  readonly comidasDisponible = computed(() => this.cumplimiento().disponible);
  readonly cargasDisponible = computed(() => this.cargas().disponible);
  readonly notasDisponible = computed(() => this.notas().disponible);
  readonly errorCarga = computed(
    () => this.cumplimiento().error ?? this.cargas().error ?? this.notas().error,
  );

  private readonly cumplimientoSemanal = computed(() =>
    cumplimientoPorSemana(this.cumplimiento().datos, this.semanas(), this.comidasPorDia(), this.hoy()),
  );
  private readonly sesionesSemanales = computed(() =>
    sesionesPorSemana(this.cargas().datos, this.semanas()),
  );
  private readonly ejercicios = computed(() =>
    pesoMaximoPorEjercicio(this.cargas().datos, this.semanas()),
  );

  readonly resumen = computed(() => {
    const i = this.indiceSemana();
    const comidas = this.cumplimientoSemanal()[i];
    const sesiones = this.sesionesSemanales()[i].sesiones;
    const previa = i > 0 ? this.semanas()[i - 1] : null;
    const filas = previa
      ? progresionSemana(this.ejercicios(), this.semanaSeleccionada(), previa)
      : [];
    return {
      comidasTexto: comidas.porcentaje === null ? '—' : `${comidas.porcentaje}%`,
      comidasDetalle:
        comidas.esperadas > 0
          ? `${comidas.cumplidas} de ${comidas.esperadas} comidas`
          : comidas.cumplidas > 0
            ? `${comidas.cumplidas} comidas marcadas`
            : 'Sin comidas marcadas',
      sesiones,
      sesionesMeta: this.diasRutina(),
      ejerciciosConCarga: this.ejercicios().filter(
        (e) => e.porSemana[this.semanaSeleccionada()] !== undefined,
      ).length,
      subieron: filas.filter(subioDePeso).length,
    };
  });

  readonly progresion = computed(() => {
    const i = this.indiceSemana();
    const unidad = this.unidad();
    const previa = i > 0 ? this.semanas()[i - 1] : '';
    return progresionSemana(this.ejercicios(), this.semanaSeleccionada(), previa).map((f) => ({
      clave: f.clave,
      nombre: f.nombre,
      actual: formatoPeso(f.actualKg, unidad),
      anterior: f.anteriorKg === null ? null : formatoPeso(f.anteriorKg, unidad),
      cambio: f.deltaKg === null ? null : formatoCambio(f.deltaKg, unidad),
      sube: subioDePeso(f),
      baja: f.deltaKg !== null && f.deltaKg < -0.001,
    }));
  });

  readonly notasSemana = computed(() =>
    notasDeSemana(this.notas().datos, this.semanaSeleccionada()).map((n) => ({
      dia: etiquetaDia(n.fecha),
      nota: n.nota,
    })),
  );

  // ---------- gráfica de barras ----------
  readonly barras = computed<Barra[]>(() => {
    const semanas = this.semanas();
    const metrica = this.metrica();
    const comidas = this.cumplimientoSemanal();
    const sesiones = this.sesionesSemanales();
    const seleccionada = this.indiceSemana();

    const valores = semanas.map((_, i) =>
      metrica === 'comidas' ? comidas[i].porcentaje : sesiones[i].sesiones,
    );
    const tope =
      metrica === 'comidas'
        ? 100
        : Math.max(this.diasRutina(), ...sesiones.map((s) => s.sesiones), 1);

    const areaAlto = ALTO_BARRAS - MARGEN_SUP - MARGEN_INF;
    const paso = (ANCHO - MARGEN_IZQ - MARGEN_DER) / semanas.length;
    const ancho = paso * 0.62;

    return semanas.map((semana, i) => {
      const valor = valores[i];
      const sinDato = valor === null;
      const alto = sinDato ? 0 : Math.max(valor > 0 ? 3 : 0, (valor / tope) * areaAlto);
      return {
        semana,
        etiqueta: etiquetaCorta(semana),
        x: MARGEN_IZQ + paso * i + (paso - ancho) / 2,
        y: MARGEN_SUP + areaAlto - alto,
        ancho,
        alto,
        valorTexto: sinDato ? '—' : metrica === 'comidas' ? `${valor}%` : String(valor),
        sinDato,
        seleccionada: i === seleccionada,
      };
    });
  });

  readonly baseBarras = ALTO_BARRAS - MARGEN_INF;
  readonly altoUtilBarras = ALTO_BARRAS - MARGEN_SUP - MARGEN_INF;

  /** Hay al menos un dato real en la métrica elegida. */
  readonly barrasConDatos = computed(() =>
    this.metrica() === 'comidas'
      ? this.cumplimientoSemanal().some((c) => c.cumplidas > 0)
      : this.sesionesSemanales().some((s) => s.sesiones > 0),
  );

  readonly metricaDisponible = computed(() =>
    this.metrica() === 'comidas' ? this.comidasDisponible() : this.cargasDisponible(),
  );

  // ---------- gráfica de línea por ejercicio ----------
  readonly listaEjercicios = computed(() =>
    this.ejercicios().map((e) => ({ clave: e.clave, nombre: e.nombre })),
  );

  readonly ejercicioActivo = computed(() => {
    const lista = this.ejercicios();
    if (lista.length === 0) return null;
    return lista.find((e) => e.clave === this.claveEjercicio()) ?? lista[0];
  });

  readonly linea = computed(() => {
    const ejercicio = this.ejercicioActivo();
    if (!ejercicio) return null;

    const unidad = this.unidad();
    const semanas = this.semanas();
    const seleccionada = this.semanaSeleccionada();

    const valores = semanas
      .map((s, i) => ({ s, i, kg: ejercicio.porSemana[s] }))
      .filter((v): v is { s: string; i: number; kg: number } => v.kg !== undefined)
      .map((v) => ({ ...v, valor: kgAUnidad(v.kg, unidad) }));
    if (valores.length === 0) return null;

    let minimo = Math.min(...valores.map((v) => v.valor));
    let maximo = Math.max(...valores.map((v) => v.valor));
    if (maximo - minimo < 1e-9) {
      minimo -= 1;
      maximo += 1;
    } else {
      const holgura = (maximo - minimo) * 0.15;
      minimo -= holgura;
      maximo += holgura;
    }

    const areaAlto = ALTO_LINEA - MARGEN_SUP - MARGEN_INF;
    const paso = (ANCHO - MARGEN_IZQ - MARGEN_DER) / semanas.length;

    const puntos: Punto[] = valores.map((v) => ({
      x: MARGEN_IZQ + paso * v.i + paso / 2,
      y: MARGEN_SUP + areaAlto - ((v.valor - minimo) / (maximo - minimo)) * areaAlto,
      semana: v.s,
      texto: formatoPeso(v.kg, unidad),
    }));

    return {
      nombre: ejercicio.nombre,
      puntos,
      trazo: puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      etiquetas: semanas.map((s, i) => ({
        x: MARGEN_IZQ + paso * i + paso / 2,
        texto: etiquetaCorta(s),
        mostrar: i % 2 === (semanas.length - 1) % 2,
        seleccionada: s === seleccionada,
      })),
      unidad,
    };
  });

  readonly baseLinea = ALTO_LINEA - MARGEN_INF;

  constructor() {
    this.unidad.set(leerUnidadPreferida());

    effect(() => {
      const id = this.pacienteId();
      if (!id || !this.esNavegador) return;
      untracked(() => void this.cargar(id));
    });
  }

  // ---------- acciones ----------
  retroceder(): void {
    if (this.puedeRetroceder()) this.indiceSemana.update((i) => i - 1);
  }

  avanzar(): void {
    if (this.puedeAvanzar()) this.indiceSemana.update((i) => i + 1);
  }

  irASemanaActual(): void {
    this.indiceSemana.set(this.semanas().length - 1);
  }

  elegirSemana(indice: number): void {
    this.indiceSemana.set(indice);
  }

  elegirMetrica(metrica: Metrica): void {
    this.metrica.set(metrica);
  }

  elegirUnidad(unidad: Unidad): void {
    this.unidad.set(unidad);
    guardarUnidadPreferida(unidad);
  }

  elegirEjercicio(evento: Event): void {
    this.claveEjercicio.set((evento.target as HTMLSelectElement).value);
  }

  reintentar(): void {
    const id = this.pacienteId();
    if (id) void this.cargar(id);
  }

  // ---------- carga ----------
  private async cargar(pacienteId: string): Promise<void> {
    const token = ++this.cargaActual;
    this.cargando.set(true);
    this.hoy.set(hoyISO());

    // Desde una semana antes de la primera visible, para comparar la primera semana.
    const desde = sumarDias(this.semanas()[0], -7);

    const [cumplimiento, cargas, notas] = await Promise.all([
      this.servicio.getCumplimiento(pacienteId, desde),
      this.servicio.getCargas(pacienteId, desde),
      this.servicio.getNotas(pacienteId, desde),
    ]);

    // Si llegó una carga más nueva (o cambió de paciente), esta respuesta ya no sirve.
    if (token !== this.cargaActual) return;

    this.cumplimiento.set(cumplimiento);
    this.cargas.set(cargas);
    this.notas.set(notas);
    this.cargando.set(false);
  }

  private vacio<T>(): ResultadoProgreso<T> {
    return { datos: [], disponible: true, error: null };
  }
}
