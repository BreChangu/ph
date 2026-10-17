import { ChangeDetectorRef, Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/supabase/auth';
import { PlanNutricionalService } from '../../core/services/plan-nutricional/plan-nutricional.service';
import { EntrenamientoService } from '../../core/services/entrenamiento/entrenamiento.service';
import { DiaEntrenamiento, Ejercicio } from '../../core/models/entrenamiento.models';

type PanelSection = 'nutrition' | 'training' | 'measurements' | 'photos' | 'testimonio' | 'tecnica';
type PhotoKind = 'frente' | 'perfil' | 'espalda';
type MeasurementDefinition = {
  key: string;
  label: string;
  hint: string;
};

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
  selectedExerciseVideo: { title: string; embedUrl?: SafeResourceUrl; directUrl?: string; isExternal?: boolean } | null = null;
  
  trainingDiaryNote = '';
  trainingDiaryMessage = '';

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
  // VARIABLES DE TÉCNICA
  // ==========================================
  videoFile: File | null = null;
  ejercicioTecnica = '';
  notaTecnica = '';
  isUploadingVideo = false;
  tecnicaMessage = '';
  
  historialVideos = [
    { ejercicio: 'Sentadilla Libre', fecha: '12/06/2026', estado: 'Revisado', feedback: 'Mejora la profundidad, el peso está bien controlado.' },
    { ejercicio: 'Peso Muerto', fecha: '14/06/2026', estado: 'Pendiente', feedback: null }
  ];

  // ==========================================
  // VARIABLES DE MEDIDAS Y FOTOS
  // ==========================================
  measurementDefinitions: MeasurementDefinition[] = [
    { key: 'BIR', label: 'Brazo izq. relajado', hint: 'Punto medio entre acromion y radio.' },
    { key: 'BDR', label: 'Brazo der. relajado', hint: 'Misma altura que el brazo izquierdo.' },
    { key: 'BIC', label: 'Brazo izq. contraído', hint: 'Brazo flexionado, cinta alrededor del bíceps.' },
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
    @Inject(PLATFORM_ID) private platformId: Object
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
        this.planNutricionalService.obtenerCumplimientoDeHoy(this.pacienteId)
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
    if (this.comidasCumplidasHoy.includes(comidaIndex) || this.isSavingCompliance || !this.pacienteId) {
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
      this.comidasCumplidasHoy = this.comidasCumplidasHoy.filter(i => i !== comidaIndex);
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
    if (!alimentos || !Array.isArray(alimentos)) return { opciones: [], fijos: [] };

    const opciones: any[] = [];
    const fijos: any[] = [];

    alimentos.forEach(alimento => {
      // Normalizamos el objeto para asegurar que todo sea válido
      const current = {
        descripcion: String(alimento.descripcion || ''),
        calorias: parseFloat(alimento.calorias) || 0,
        proteinas: parseFloat(alimento.proteinas) || 0,
        carbos: parseFloat(alimento.carbos) || 0,
        grasas: parseFloat(alimento.grasas) || 0
      };

      const optionMarker = /^\s*\[?\s*opci[oó]n\s*\]?\s*:?\s*/i;
      
      // Las alternativas heredadas se guardan con el marcador [Opcion].
      // Lo usamos sólo como metadato y nunca lo mostramos al paciente.
      if (optionMarker.test(current.descripcion)) {
        current.descripcion = current.descripcion.replace(optionMarker, '').trim();
        opciones.push(current);
      } else {
        fijos.push(current);
      }
    });

    return { opciones, fijos };
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
    } catch (error) {
      console.error('Error al cargar la rutina:', error);
      this.entrenamientoSemanal = [];
      this.trainingError = 'No fue posible cargar tu rutina. Intenta actualizar la página.';
    } finally {
      this.isLoadingTraining = false;
      this.cdr.detectChanges();
    }
  }

  openExerciseVideo(exercise: Ejercicio) {
    const source = this.resolveExerciseVideo(exercise.video_url);
    if (!source) return;

    this.selectedExerciseVideo = {
      title: exercise.ejercicio,
      isExternal: source.isExternal, 
      directUrl: source.directUrl,   
      embedUrl: source.embedUrl      
        ? this.sanitizer.bypassSecurityTrustResourceUrl(source.embedUrl) 
        : undefined
    };
  }
  
  closeExerciseVideo() {
    this.selectedExerciseVideo = null;
  }

  private resolveExerciseVideo(value?: string | null): { embedUrl?: string; directUrl?: string; isExternal?: boolean } | null {
    const input = String(value ?? '').trim();
    if (!input) return null;

    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return null;
    }

    if (url.protocol !== 'https:') return null;

    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    
    // YOUTUBE
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com') {
      let id = '';
      if (host === 'youtu.be') {
        id = url.pathname.split('/').filter(Boolean)[0];
      } else {
        id = url.pathname.match(/^\/embed\/([^/]+)/)?.[1] || url.searchParams.get('v') || '';
      }
      return id ? { embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` } : null;
    }

    // ARCHIVOS DIRECTOS O SUPABASE
    if (/\.(mp4|webm|ogg)$/i.test(url.pathname) || host.includes('supabase')) {
      return { directUrl: url.toString() };
    }

    // INSTAGRAM, FB, TIKTOK
    return { directUrl: url.toString(), isExternal: true };
  }

  private activarRealtime(id: string) {
    const channel = this.planNutricionalService.subscribePlanPaciente(id, () => {
      this.cargarPlanPaciente();
    });
    this.planChannels.push(channel as unknown as RealtimeChannel);
  }

  // ==========================================
  // MÉTODOS DE TÉCNICA
  // ==========================================
  onVideoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        this.tecnicaMessage = 'El video excede el límite de 50MB. Por favor comprime o recorta tu clip.';
        this.videoFile = null;
        return;
      }
      if (!file.type.startsWith('video/')) {
        this.tecnicaMessage = 'Formato inválido. Sube un archivo de video (MP4, MOV).';
        this.videoFile = null;
        return;
      }
      this.videoFile = file;
      this.tecnicaMessage = '';
    }
  }

  async subirVideoTecnica() {
    if (!this.pacienteId || !this.videoFile || !this.ejercicioTecnica.trim()) {
      this.tecnicaMessage = 'Selecciona un video y especifica el ejercicio.';
      return;
    }

    this.isUploadingVideo = true;
    this.tecnicaMessage = '';

    try {
      this.tecnicaMessage = 'Video subido correctamente. Tu coach lo revisará pronto.';
      this.videoFile = null;
      this.ejercicioTecnica = '';
      this.notaTecnica = '';
    } catch (error) {
      this.tecnicaMessage = 'Error al subir el video. Intenta nuevamente.';
    } finally {
      this.isUploadingVideo = false;
      this.cdr.detectChanges();
    }
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
    
    const medidasLimpas = Object.entries(this.measurementValues).reduce((acc, [key, value]) => {
      if (value !== null && !Number.isNaN(value)) acc[key] = value;
      return acc;
    }, {} as Record<string, number>);

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

    const fotos = Object.entries(this.photoFiles).reduce((acc, [key, file]) => {
      if (file) acc[key] = file;
      return acc;
    }, {} as Record<string, File>);

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
      this.testimonioMessage = 'Por favor, escribe unas palabras sobre tu experiencia antes de enviar.';
      return;
    }

    this.isSavingTestimonio = true;
    this.testimonioMessage = '';

    try {
      let urlAntes, urlDespues;
      if (this.testimonioFileAntes) {
        urlAntes = await this.authService.subirFotoTestimonio(this.pacienteId, 'antes', this.testimonioFileAntes);
      }
      if (this.testimonioFileDespues) {
        urlDespues = await this.authService.subirFotoTestimonio(this.pacienteId, 'despues', this.testimonioFileDespues);
      }

      await this.authService.guardarTestimonio(this.pacienteId, this.testimonioTexto, urlAntes, urlDespues);
      
      this.testimonioMessage = '¡Gracias! Tu testimonio ha sido enviado exitosamente. Será visible en la página pronto.';
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
