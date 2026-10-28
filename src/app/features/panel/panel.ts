import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/supabase/auth';
import { PlanNutricionalService } from '../../core/services/plan-nutricional/plan-nutricional.service';
import { EntrenamientoService } from '../../core/services/entrenamiento/entrenamiento.service';
import { DiaEntrenamiento, Ejercicio } from '../../core/models/entrenamiento.models';
import { ProgresoSemanalComponent } from './progreso/progreso-semanal';
import {
  FilaCarga,
  Unidad,
  claveEjercicio,
  etiquetaDia,
  formatoCambio,
  formatoPeso,
  guardarUnidadPreferida,
  hoyISO,
  leerPeso,
  leerUnidadPreferida,
  resumenCarga,
  unidadAKg,
} from './progreso/progreso.utils';

/** Lo que muestra la columna Carga para un ejercicio. */
type VistaCarga = {
  valorHoy: string;
  placeholder: string;
  ultima: string | null;
  cambio: string | null;
  sube: boolean;
  baja: boolean;
};

type EstadoCarga = 'guardado' | 'error';

/** Códigos de Supabase cuando la tabla aún no existe o no hay permiso. */
const CODIGOS_TABLA_NO_LISTA = new Set(['PGRST205', '42P01', '42501']);

type ExerciseVideoView = {
  title: string;
  /** Reproductor incrustado (YouTube). */
  embedUrl?: SafeResourceUrl;
  /** Archivo de video directo (.mp4, .webm, Supabase Storage...). */
  directUrl?: string;
  /** Enlace original, siempre disponible para abrirlo en otra pestaña. */
  watchUrl?: string;
  isExternal?: boolean;
  invalid?: boolean;
  isVertical?: boolean;
  playbackFailed?: boolean;
  message?: string;
};

type PanelSection = 'nutrition' | 'training' | 'measurements' | 'photos' | 'testimonio' | 'progreso';
type PhotoKind = 'frente' | 'perfil' | 'espalda';
type MeasurementDefinition = {
  key: string;
  label: string;
  hint: string;
};

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ProgresoSemanalComponent],
  templateUrl: './panel.html',
  styleUrls: ['./panel.scss'],
})
export class PanelComponent implements OnInit, OnDestroy {
  // ==========================================
  // VARIABLES DE ESTADO Y USUARIO
  // ==========================================
  userName = 'Paciente';
  pacienteId: string | null = null;
  activeSection: PanelSection = 'nutrition';
  private planChannels: RealtimeChannel[] = [];

  // ==========================================
  // VARIABLES DE LA DIETA
  // ==========================================
  isLoadingPlan = false;
  planError = '';
  planPaciente: any = null;

  // Controla qué opción intercambiable se está viendo en cada comida.
  activeOptions: Record<number, number> = {};

  // VARIABLES DE COMIDAS CUMPLIDAS
  // Array para saber qué comidas (por su índice) ya marcó como cumplidas HOY
  comidasCumplidasHoy: number[] = [];
  isSavingCompliance = false; // Para evitar doble clic

  // ==========================================
  // VARIABLES DE ENTRENAMIENTO
  // ==========================================
  activeTrainingDay = 0;
  fechaHoy = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  entrenamientoSemanal: DiaEntrenamiento[] = [];
  isLoadingTraining = false;
  trainingError = '';

  // VARIABLE CORREGIDA PARA EL MODAL DE VIDEO
  selectedExerciseVideo: ExerciseVideoView | null = null;

  trainingDiaryNote = '';
  trainingDiaryMessage = '';

  // REGISTRO DE CARGAS (peso usado por ejercicio)
  unidadCarga: Unidad = leerUnidadPreferida();
  /** false mientras no exista la tabla registros_carga en Supabase. */
  cargasDisponibles = true;
  vistaCargas: Record<string, VistaCarga> = {};
  estadoCargas: Record<string, EstadoCarga> = {};
  /** Lo que el paciente escribió y aún no registra, por ejercicio. */
  borradoresCarga: Record<string, string> = {};
  guardandoSesion = false;
  sesionMensaje = '';
  cargaMensaje = '';
  private historialCargas: FilaCarga[] = [];

  cardioGuidelines = [
    'Realiza 5 sesiones por semana de 30 minutos.',
    'Mantén una intensidad que te permita sostener el ritmo.',
    'Registra tus sesiones al terminar para dar seguimiento al plan.',
  ];

  trainingGuidelines = [
    'Toma de 2 a 4 litros de agua al día.',
    'Escucha a tu cuerpo y cuida la técnica antes de subir cargas.',
    'Si una molestia persiste, repórtala antes de continuar.',
  ];

  // ==========================================
  // VARIABLES DE MEDIDAS Y FOTOS
  // ==========================================
  measurementDefinitions: MeasurementDefinition[] = [
    { key: 'BIR', label: 'Brazo izq. relajado', hint: 'Punto medio entre acromion y radio.' },
    { key: 'BDR', label: 'Brazo der. relajado', hint: 'Misma altura que el brazo izquierdo.' },
    {
      key: 'BIC',
      label: 'Brazo izq. contraído',
      hint: 'Brazo flexionado, cinta alrededor del bíceps.',
    },
    { key: 'BDC', label: 'Brazo der. contraído', hint: 'Repite el mismo punto de medición.' },
    { key: 'Torax', label: 'Tórax', hint: 'Cinta a la altura promedio del pecho.' },
    { key: 'Cintura', label: 'Cintura', hint: 'Punto más estrecho del abdomen.' },
    { key: 'Gluteo', label: 'Glúteo', hint: 'Mayor circunferencia de la cadera.' },
    { key: 'Muslo', label: 'Muslo medio', hint: 'A mitad entre pliegue glúteo y rodilla.' },
    { key: 'PI', label: 'Pantorrilla izq.', hint: 'Máximo perímetro de pantorrilla.' },
    { key: 'PD', label: 'Pantorrilla der.', hint: 'Mismo punto que la pantorrilla izquierda.' },
  ];
  measurements = this.measurementDefinitions.map((item) => item.key);
  measurementValues: Record<string, number | null> = {};
  measurementMessage = '';
  isSavingMeasurements = false;
  measurementProcedure = [
    'Usa cinta métrica suave y mide siempre en el mismo horario.',
    'Mantén la cinta firme, sin apretar la piel.',
    'Si puedes, pide ayuda para mantener la postura y repetir el mismo punto.',
  ];

  photoFiles: Partial<Record<PhotoKind, File>> = {};
  photoMessage = '';
  isSavingPhotos = false;

  // ==========================================
  // VARIABLES DE TESTIMONIOS
  // ==========================================
  testimonioTexto = '';
  testimonioFileAntes: File | null = null;
  testimonioFileDespues: File | null = null;
  isSavingTestimonio = false;
  testimonioMessage = '';

  constructor(
    public authService: AuthService,
    public planNutricionalService: PlanNutricionalService,
    private entrenamientoService: EntrenamientoService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const session = await this.authService.getSession();

        if (!session?.user) {
          this.router.navigate(['/auth']);
          return;
        }

        const userId = session.user.id;
        const perfil = await this.authService.getUserProfileForAuth(userId, session.user.email);

        const pacienteId = perfil?.id ?? userId;
        this.pacienteId = pacienteId;
        this.userName = perfil?.nombre_completo?.split(' ')[0] || 'Paciente';

        this.cargarPlanPaciente();
        this.cargarRutinaPaciente();
        this.activarRealtime(pacienteId);
      } catch (error) {
        console.error('Error inicializando el panel:', error);
      }
    }
  }

  ngOnDestroy() {
    this.planChannels.forEach((channel) => this.planNutricionalService.unsubscribeChannel(channel));
     this.lockScroll(false);
  }

  // ==========================================
  // MÉTODOS DE NAVEGACIÓN Y SESIÓN
  // ==========================================
  setSection(section: PanelSection) {
    this.activeSection = section;
  }

  selectTrainingDay(index: number) {
    this.activeTrainingDay = index;
  }

  previousTrainingDay() {
    if (this.activeTrainingDay > 0) {
      this.activeTrainingDay -= 1;
    }
  }

  nextTrainingDay() {
    if (this.activeTrainingDay < this.entrenamientoSemanal.length - 1) {
      this.activeTrainingDay += 1;
    }
  }

  getTrainingShortTitle(title: string): string {
    return title.replace(/^Dia\s+\d+:\s*/i, '');
  }

  guardarNotaEntrenamiento() {
    this.trainingDiaryMessage = this.trainingDiaryNote.trim()
      ? 'Nota guardada para tu seguimiento.'
      : 'Agrega una nota antes de guardar.';
  }

  async logout() {
    try {
      this.planChannels.forEach((c) => this.planNutricionalService.unsubscribeChannel(c));
      await this.authService.signOut();
    } finally {
      this.router.navigate(['/auth'], { queryParams: { signedOut: '1' } });
    }
  }

  // ==========================================
  // MÉTODOS DE LA DIETA Y CUMPLIMIENTO
  // ==========================================
  async cargarPlanPaciente() {
    if (!this.pacienteId) {
      console.error('❌ ERROR: No hay pacienteId definido en el panel.');
      return;
    }

    this.isLoadingPlan = true;

    try {
      // Cargamos el plan Y el cumplimiento de hoy en paralelo
      const [plan, cumplimiento] = await Promise.all([
        this.planNutricionalService.getPlanPaciente(this.pacienteId),
        this.planNutricionalService.obtenerCumplimientoDeHoy(this.pacienteId),
      ]);

      this.planPaciente = plan;
      this.comidasCumplidasHoy = cumplimiento || [];
    } catch (error) {
      console.error('❌ ERROR AL CARGAR PLAN O CUMPLIMIENTO:', error);
    } finally {
      this.isLoadingPlan = false;
      this.cdr.detectChanges();
    }
  }

  async marcarComidaCumplida(comidaIndex: number) {
    if (
      this.comidasCumplidasHoy.includes(comidaIndex) ||
      this.isSavingCompliance ||
      !this.pacienteId
    ) {
      return;
    }

    this.isSavingCompliance = true;

    // UI Optimista: Actualizamos la pantalla instantáneamente
    this.comidasCumplidasHoy.push(comidaIndex);
    this.cdr.detectChanges();

    try {
      // Guardamos en Supabase
      await this.planNutricionalService.registrarCumplimientoComida(this.pacienteId, comidaIndex);
    } catch (error) {
      // Si falla, revertimos
      this.comidasCumplidasHoy = this.comidasCumplidasHoy.filter((i) => i !== comidaIndex);
      console.error('Fallo al guardar el cumplimiento', error);
    } finally {
      this.isSavingCompliance = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // LÓGICA DE INTERCAMBIOS DE ALIMENTOS
  // ==========================================

  procesarAlimentosDeComida(alimentos: any[]) {
    if (!Array.isArray(alimentos)) {
      return { opciones: [], fijos: [] };
    }

    const opciones: any[] = [];
    const fijos: any[] = [];

    // Reconoce [Opcion], [Opción] y espacios o dos puntos opcionales.
    const optionMarker = /^\s*\[opci[oó]n\]\s*:?\s*/i;

    for (const alimento of alimentos) {
      const descripcionOriginal = String(alimento?.descripcion ?? '');
      const esOpcion = optionMarker.test(descripcionOriginal);

      const current = {
        ...alimento,
        descripcion: descripcionOriginal.replace(optionMarker, '').trim(),
        calorias: Number(alimento?.calorias) || 0,
        proteinas: Number(alimento?.proteinas) || 0,
        carbos: Number(alimento?.carbos) || 0,
        grasas: Number(alimento?.grasas) || 0,
      };

      if (esOpcion) {
        opciones.push(current);
      } else {
        fijos.push(current);
      }
    }

    return { opciones, fijos };
  }

  // Limpia el nombre por si el marcador todavía existe
  // en los datos que se muestran en el HTML.
  limpiarNombreAlimento(descripcion: string | null | undefined): string {
    return String(descripcion ?? '')
      .replace(/^\s*\[opci[oó]n\]\s*:?\s*/i, '')
      .trim();
  }

  nextOption(mealIndex: number, totalOpciones: number) {
    const actual = this.activeOptions[mealIndex] || 0;
    if (actual < totalOpciones - 1) {
      this.activeOptions[mealIndex] = actual + 1;
      this.cdr.detectChanges();
    }
  }

  prevOption(mealIndex: number) {
    const actual = this.activeOptions[mealIndex] || 0;
    if (actual > 0) {
      this.activeOptions[mealIndex] = actual - 1;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // MÉTODOS DE ENTRENAMIENTO
  // ==========================================
  async cargarRutinaPaciente() {
    if (!this.pacienteId) return;

    this.isLoadingTraining = true;
    this.trainingError = '';

    try {
      const rutina = await this.entrenamientoService.getRutinaPaciente(this.pacienteId);
      this.entrenamientoSemanal = rutina?.dias_entrenamiento ?? [];
      this.activeTrainingDay = 0;
      this.recalcularVistaCargas();
      await this.cargarHistorialCargas();
    } catch (error) {
      console.error('Error al cargar la rutina:', error);
      this.entrenamientoSemanal = [];
      this.trainingError = 'No fue posible cargar tu rutina. Intenta actualizar la página.';
    } finally {
      this.isLoadingTraining = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // MÉTODOS DE REGISTRO DE CARGAS
  // ==========================================
  private async cargarHistorialCargas() {
    if (!this.pacienteId) return;

    try {
      this.historialCargas = await this.entrenamientoService.getHistorialCargas(this.pacienteId);
      this.cargasDisponibles = true;
    } catch (error) {
      this.historialCargas = [];
      if (this.esTablaNoLista(error)) {
        this.cargasDisponibles = false;
      } else {
        console.error('Error al cargar el historial de cargas:', error);
        this.cargaMensaje = 'No pudimos cargar tus pesos anteriores. Actualiza la página.';
      }
    }
    this.recalcularVistaCargas();
  }

  claveDe(ejercicio: Ejercicio): string {
    return claveEjercicio(ejercicio.ejercicio);
  }

  cambiarUnidadCarga(unidad: Unidad) {
    if (unidad === this.unidadCarga) return;
    // Lo que ya se escribió se convierte a la nueva unidad para no perderlo.
    for (const [clave, texto] of Object.entries(this.borradoresCarga)) {
      const valor = leerPeso(texto);
      if (valor !== null) {
        this.borradoresCarga[clave] = formatoPeso(unidadAKg(valor, this.unidadCarga), unidad);
      }
    }
    this.unidadCarga = unidad;
    guardarUnidadPreferida(unidad);
    this.recalcularVistaCargas();
  }

  /** Valor que se ve en el campo: lo que se está escribiendo o, si no, lo registrado hoy. */
  valorCampoCarga(ejercicio: Ejercicio): string {
    const clave = this.claveDe(ejercicio);
    return this.borradoresCarga[clave] ?? this.vistaCargas[clave]?.valorHoy ?? '';
  }

  actualizarBorradorCarga(ejercicio: Ejercicio, event: Event) {
    const clave = this.claveDe(ejercicio);
    this.borradoresCarga[clave] = (event.target as HTMLInputElement).value;
    delete this.estadoCargas[clave];
    this.sesionMensaje = '';
  }

  /** El campo tiene un valor distinto al que ya está guardado hoy. */
  cargaPendiente(ejercicio: Ejercicio): boolean {
    const clave = this.claveDe(ejercicio);
    const borrador = this.borradoresCarga[clave];
    return borrador !== undefined && borrador.trim() !== (this.vistaCargas[clave]?.valorHoy ?? '');
  }

  hayCargasPendientes(dia: DiaEntrenamiento): boolean {
    return dia.ejercicios.some((ejercicio) => this.cargaPendiente(ejercicio));
  }

  sesionRegistradaHoy(dia: DiaEntrenamiento): boolean {
    return dia.ejercicios.some((ejercicio) => !!this.vistaCargas[this.claveDe(ejercicio)]?.valorHoy);
  }

  /**
   * Guarda de una vez los pesos que cambiaron en la sesión.
   * Un campo vaciado borra el peso de hoy de ese ejercicio.
   */
  async registrarSesion(dia: DiaEntrenamiento) {
    if (!this.pacienteId || this.guardandoSesion) return;

    const cambios: { ejercicio: Ejercicio; clave: string; pesoKg: number | null }[] = [];
    let hayErrores = false;

    for (const ejercicio of dia.ejercicios) {
      if (!this.cargaPendiente(ejercicio)) continue;
      const clave = this.claveDe(ejercicio);
      const texto = this.borradoresCarga[clave].trim();

      if (texto === '') {
        cambios.push({ ejercicio, clave, pesoKg: null });
        continue;
      }

      const valor = leerPeso(texto);
      const pesoKg = valor === null ? null : unidadAKg(valor, this.unidadCarga);
      if (pesoKg === null || pesoKg >= 1000) {
        this.estadoCargas[clave] = 'error';
        hayErrores = true;
      } else {
        cambios.push({ ejercicio, clave, pesoKg });
      }
    }

    if (hayErrores) {
      this.sesionMensaje = 'Revisa los campos en rojo: escribe solo el número del peso, por ejemplo 42.5';
      return;
    }
    if (cambios.length === 0) return;

    this.guardandoSesion = true;
    this.sesionMensaje = '';
    this.cdr.detectChanges();

    const resultados = await Promise.allSettled(
      cambios.map(({ ejercicio, pesoKg }) =>
        pesoKg === null
          ? this.entrenamientoService.borrarCargaDeHoy(this.pacienteId!, ejercicio.ejercicio)
          : this.entrenamientoService.guardarCarga(
              this.pacienteId!,
              ejercicio.ejercicio,
              pesoKg,
              this.unidadCarga,
            ),
      ),
    );

    let fallidos = 0;
    resultados.forEach((resultado, i) => {
      const { clave } = cambios[i];
      if (resultado.status === 'fulfilled') {
        delete this.borradoresCarga[clave];
        this.estadoCargas[clave] = 'guardado';
      } else {
        console.error('Error al guardar la carga:', resultado.reason);
        this.estadoCargas[clave] = 'error';
        fallidos++;
        if (this.esTablaNoLista(resultado.reason)) this.cargasDisponibles = false;
      }
    });

    // Se vuelve a leer lo guardado para que "Última" y el cambio reflejen la base de datos.
    await this.cargarHistorialCargas();

    this.sesionMensaje =
      fallidos === 0
        ? `Sesión registrada ✓ (${cambios.length} ${cambios.length === 1 ? 'ejercicio' : 'ejercicios'})`
        : `No se pudieron guardar ${fallidos} de ${cambios.length} pesos. Revisa tu conexión e intenta de nuevo.`;
    this.guardandoSesion = false;
    this.cdr.detectChanges();
  }

  private recalcularVistaCargas() {
    const hoy = hoyISO();
    const unidad = this.unidadCarga;
    const porClave = new Map<string, FilaCarga[]>();
    for (const fila of this.historialCargas) {
      const filas = porClave.get(fila.ejercicio_clave) ?? [];
      filas.push(fila);
      porClave.set(fila.ejercicio_clave, filas);
    }

    const vistas: Record<string, VistaCarga> = {};
    for (const dia of this.entrenamientoSemanal) {
      for (const ejercicio of dia.ejercicios) {
        const clave = this.claveDe(ejercicio);
        const r = resumenCarga(porClave.get(clave) ?? [], hoy);
        vistas[clave] = {
          valorHoy: r.hoyKg === null ? '' : formatoPeso(r.hoyKg, unidad),
          placeholder: r.previaKg === null ? 'Peso' : formatoPeso(r.previaKg, unidad),
          ultima:
            r.previaKg === null || r.previaFecha === null
              ? null
              : `Última: ${formatoPeso(r.previaKg, unidad)} ${unidad} · ${etiquetaDia(r.previaFecha)}`,
          cambio: r.deltaKg === null ? null : formatoCambio(r.deltaKg, unidad),
          sube: r.deltaKg !== null && r.deltaKg > 0.001,
          baja: r.deltaKg !== null && r.deltaKg < -0.001,
        };
      }
    }
    this.vistaCargas = vistas;
  }

  private esTablaNoLista(error: unknown): boolean {
    const codigo = String((error as { code?: string } | null)?.code ?? '');
    return CODIGOS_TABLA_NO_LISTA.has(codigo);
  }

  openExerciseVideo(exercise: Ejercicio) {
    const title = exercise.ejercicio;
    const source = this.resolveExerciseVideo(exercise.video_url);

    if (!source) {
      this.selectedExerciseVideo = {
        title,
        invalid: true,
        message: 'El enlace de este video no es válido. Avísale a tu coach para que lo corrija.',
      };
      return;
    }

    this.selectedExerciseVideo = {
      title,
      watchUrl: source.watchUrl,
      directUrl: source.directUrl,
      isExternal: source.isExternal,
      isVertical: source.isVertical,
      message: source.isExternal
        ? 'Este video está en una plataforma externa (Instagram, TikTok, etc.) y se abre en otra pestaña.'
        : undefined,
      embedUrl: source.embedUrl
        ? this.sanitizer.bypassSecurityTrustResourceUrl(source.embedUrl)
        : undefined,
    };
  }

  closeExerciseVideo() {
    this.selectedExerciseVideo = null;
    this.lockScroll(false); // ← nuevo
  }

  private lockScroll(lock: boolean) {
    // ← nuevo
    if (!isPlatformBrowser(this.platformId)) return;
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.selectedExerciseVideo) this.closeExerciseVideo();
  }

  /** El navegador no pudo reproducir el archivo: se ofrece abrirlo aparte. */
  onExerciseVideoError() {
    if (!this.selectedExerciseVideo) return;

    this.selectedExerciseVideo = {
      ...this.selectedExerciseVideo,
      playbackFailed: true,
      message: 'Tu navegador no pudo reproducir este archivo aquí. Ábrelo en una pestaña nueva.',
    };
    this.cdr.detectChanges();
  }

  /**
   * Convierte el enlace que guardó el coach en algo reproducible.
   *  - YouTube (watch, youtu.be, shorts, live, embed) -> reproductor incrustado.
   *  - Archivo de video directo o Supabase Storage     -> etiqueta <video>.
   *  - Cualquier otro sitio (Instagram, TikTok...)     -> enlace externo.
   * Devuelve null solo si el texto no es una URL http(s) válida.
   */
  private resolveExerciseVideo(
    value?: string | null,
  ): { embedUrl?: string; directUrl?: string; watchUrl?: string; isExternal?: boolean; isVertical?: boolean } | null {
    let input = String(value ?? '').trim();
    if (!input) return null;

    // Enlaces pegados sin protocolo, p. ej. "www.youtube.com/watch?v=..."
    if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = `https://${input}`;

    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return null;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const watchUrl = url.toString();

    const hostsYoutube = [
      'youtu.be',
      'youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtube-nocookie.com',
    ];
       if (hostsYoutube.includes(host)) {
      const id = this.extraerIdYoutube(url, host);
      if (!id) return { watchUrl, isExternal: true };

      const inicio = this.segundosDeTiempoYoutube(url.searchParams.get('t') ?? url.searchParams.get('start'));
      const start = inicio > 0 ? `&start=${inicio}` : '';

      const esShort = url.pathname.startsWith('/shorts/');
      return {
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1${start}`,
        watchUrl: `https://www.youtube.com/watch?v=${id}`,
        isVertical: esShort,
      };
    }

    // Un archivo http:// no se puede incrustar en una página https:// (contenido mixto).
    const esArchivo = /\.(mp4|webm|ogg|mov|m4v)$/i.test(url.pathname) || host.includes('supabase');
    if (esArchivo && url.protocol === 'https:') {
      return { directUrl: watchUrl, watchUrl };
    }

    return { watchUrl, isExternal: true };
  }

  /** Los IDs de YouTube miden exactamente 11 caracteres [A-Za-z0-9_-]. */
  private extraerIdYoutube(url: URL, host: string): string {
    const partes = url.pathname.split('/').filter(Boolean);
    let id = '';

    if (host === 'youtu.be') {
      id = partes[0] ?? '';
    } else if (['embed', 'shorts', 'live', 'v'].includes(partes[0])) {
      id = partes[1] ?? '';
    } else {
      id = url.searchParams.get('v') ?? '';
    }

    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  }

  /** Acepta "90", "1m30s" o "1h2m3s". */
  private segundosDeTiempoYoutube(valor: string | null): number {
    if (!valor) return 0;
    if (/^\d+$/.test(valor)) return Number(valor);

    const m = valor.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!m) return 0;

    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  }

  private activarRealtime(id: string) {
    const channel = this.planNutricionalService.subscribePlanPaciente(id, () => {
      this.cargarPlanPaciente();
    });
    this.planChannels.push(channel as unknown as RealtimeChannel);
  }

  // ==========================================
  // MÉTODOS DE MEDIDAS Y FOTOS
  // ==========================================
  onMeasurementInput(item: string, event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.measurementValues[item] = val ? Number(val) : null;
  }

  async guardarMedidas() {
    if (!this.pacienteId) return;
    this.isSavingMeasurements = true;

    const medidasLimpas = Object.entries(this.measurementValues).reduce(
      (acc, [key, value]) => {
        if (value !== null && !Number.isNaN(value)) acc[key] = value;
        return acc;
      },
      {} as Record<string, number>,
    );

    if (Object.keys(medidasLimpas).length === 0) {
      this.measurementMessage = 'Agrega al menos una medida válida.';
      this.isSavingMeasurements = false;
      return;
    }

    try {
      await this.authService.guardarCircunferencias(this.pacienteId, medidasLimpas);
      this.measurementMessage = 'Medidas guardadas correctamente.';
    } catch (e) {
      this.measurementMessage = 'Error al guardar medidas.';
    } finally {
      this.isSavingMeasurements = false;
      this.cdr.detectChanges();
    }
  }

  onPhotoSelected(kind: PhotoKind, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.photoFiles[kind] = file;
      this.photoMessage = '';
    }
  }

  async guardarFotos() {
    if (!this.pacienteId) return;

    const fotos = Object.entries(this.photoFiles).reduce(
      (acc, [key, file]) => {
        if (file) acc[key] = file;
        return acc;
      },
      {} as Record<string, File>,
    );

    if (Object.keys(fotos).length === 0) {
      this.photoMessage = 'Selecciona al menos una fotografía para guardar.';
      return;
    }

    this.isSavingPhotos = true;
    this.photoMessage = '';

    try {
      await this.authService.guardarRegistroFotografico(this.pacienteId, fotos);
      this.photoFiles = {};
      this.photoMessage = 'Fotografías guardadas correctamente.';
    } catch (e) {
      this.photoMessage = 'Error al subir fotos. Intenta de nuevo.';
    } finally {
      this.isSavingPhotos = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // MÉTODOS DE TESTIMONIOS
  // ==========================================
  onTestimonioFileSelected(tipo: 'antes' | 'despues', event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (tipo === 'antes') this.testimonioFileAntes = file || null;
    else this.testimonioFileDespues = file || null;
  }

  async enviarTestimonio() {
    if (!this.pacienteId) return;
    if (!this.testimonioTexto.trim()) {
      this.testimonioMessage =
        'Por favor, escribe unas palabras sobre tu experiencia antes de enviar.';
      return;
    }

    this.isSavingTestimonio = true;
    this.testimonioMessage = '';

    try {
      let urlAntes, urlDespues;
      if (this.testimonioFileAntes) {
        urlAntes = await this.authService.subirFotoTestimonio(
          this.pacienteId,
          'antes',
          this.testimonioFileAntes,
        );
      }
      if (this.testimonioFileDespues) {
        urlDespues = await this.authService.subirFotoTestimonio(
          this.pacienteId,
          'despues',
          this.testimonioFileDespues,
        );
      }

      await this.authService.guardarTestimonio(
        this.pacienteId,
        this.testimonioTexto,
        urlAntes,
        urlDespues,
      );

      this.testimonioMessage =
        '¡Gracias! Tu testimonio ha sido enviado exitosamente. Será visible en la página pronto.';
      this.testimonioTexto = '';
      this.testimonioFileAntes = null;
      this.testimonioFileDespues = null;
    } catch (error) {
      this.testimonioMessage = 'Hubo un error al enviar tu historia. Por favor, intenta de nuevo.';
    } finally {
      this.isSavingTestimonio = false;
      this.cdr.detectChanges();
    }
  }
}
