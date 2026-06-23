import { ChangeDetectorRef, Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/supabase/auth';
import { PlanNutricionalService } from '../../core/services/plan-nutricional/plan-nutricional.service';

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

  entrenamientoSemanal = [
    {
      titulo: 'Dia 1: Dorsales',
      ejercicios: [
        { ejercicio: 'Remo horizontal con barra agarre prono', series: 4, reps: '5' },
        { ejercicio: 'Jalon en polea alta con triangulo', series: 3, reps: '8' },
        { ejercicio: 'Remo horizontal a un solo brazo con mancuerna', series: 3, reps: '8' },
        { ejercicio: 'Jalon en polea alta a dos manos brazos extendidos', series: 3, reps: '12' },
        { ejercicio: 'Elevacion de pantorrilla en prensa horizontal', series: 5, reps: '8' },
      ],
    },
    {
      titulo: 'Dia 2: Pierna',
      ejercicios: [
        { ejercicio: 'Sentadilla hack o prensa', series: 4, reps: '10' },
        { ejercicio: 'Peso muerto rumano', series: 4, reps: '8' },
        { ejercicio: 'Curl femoral acostado', series: 3, reps: '12' },
        { ejercicio: 'Extension de cuadriceps', series: 3, reps: '15' },
        { ejercicio: 'Gemelo de pie', series: 5, reps: '12' },
      ],
    },
    {
      titulo: 'Dia 3: Pecho y hombro',
      ejercicios: [
        { ejercicio: 'Press inclinado con mancuernas', series: 4, reps: '8' },
        { ejercicio: 'Press plano en maquina', series: 3, reps: '10' },
        { ejercicio: 'Aperturas en polea', series: 3, reps: '12' },
        { ejercicio: 'Press militar', series: 3, reps: '8' },
        { ejercicio: 'Elevaciones laterales', series: 4, reps: '15' },
      ],
    },
    {
      titulo: 'Dia 4: Brazos',
      ejercicios: [
        { ejercicio: 'Curl biceps barra Z', series: 4, reps: '10' },
        { ejercicio: 'Extension triceps cuerda', series: 4, reps: '10' },
        { ejercicio: 'Curl martillo', series: 3, reps: '12' },
        { ejercicio: 'Press frances', series: 3, reps: '12' },
        { ejercicio: 'Antebrazo en polea', series: 3, reps: '15' },
      ],
    },
    {
      titulo: 'Dia 5: Gluteo y femoral',
      ejercicios: [
        { ejercicio: 'Hip thrust', series: 4, reps: '8' },
        { ejercicio: 'Peso muerto sumo', series: 4, reps: '8' },
        { ejercicio: 'Abduccion en maquina', series: 4, reps: '15' },
        { ejercicio: 'Curl femoral sentado', series: 3, reps: '12' },
        { ejercicio: 'Desplante caminando', series: 3, reps: '12' },
      ],
    },
    {
      titulo: 'Dia 6: Full body metabolico',
      ejercicios: [
        { ejercicio: 'Dominadas asistidas', series: 3, reps: '8' },
        { ejercicio: 'Press banca', series: 3, reps: '8' },
        { ejercicio: 'Prensa', series: 3, reps: '12' },
        { ejercicio: 'Remo cable', series: 3, reps: '12' },
        { ejercicio: 'Caminadora inclinada', series: 1, reps: '20 min' },
      ],
    },
    {
      titulo: 'Dia 7: Recuperacion',
      ejercicios: [
        { ejercicio: 'Cardio zona 2', series: 1, reps: '30 min' },
        { ejercicio: 'Movilidad cadera', series: 3, reps: '10' },
        { ejercicio: 'Movilidad toracica', series: 3, reps: '10' },
        { ejercicio: 'Estiramiento guiado', series: 1, reps: '15 min' },
      ],
    },
  ];
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
  // VARIABLES DE TÉCNICA (NUEVO)
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
  // MÉTODOS DE LA DIETA
  // ==========================================
  async cargarPlanPaciente() {
    if (!this.pacienteId) {
      console.error('❌ ERROR: No hay pacienteId definido en el panel.');
      return;
    }

    this.isLoadingPlan = true;
    console.log('🔍 BUSCANDO PLAN PARA EL ID:', this.pacienteId);

    try {
      this.planPaciente = await this.planNutricionalService.getPlanPaciente(this.pacienteId);
      
      console.log('✅ RESPUESTA DE SUPABASE:', this.planPaciente);
      
      if (this.planPaciente) {
        console.log('🍴 COMIDAS ENCONTRADAS:', this.planPaciente.comidas?.length || 0);
        if (this.planPaciente.comidas?.length > 0) {
          console.log('🍎 PRIMERA COMIDA:', this.planPaciente.comidas[0]);
          console.log('🥩 ALIMENTOS EN PRIMERA COMIDA:', this.planPaciente.comidas[0].alimentos_comida);
        }
      } else {
        console.warn('⚠️ ADVERTENCIA: Supabase devolvió null para este ID.');
      }

    } catch (error) {
      console.error('❌ ERROR AL CARGAR PLAN:', error);
    } finally {
      this.isLoadingPlan = false;
      this.cdr.detectChanges();
    }
  }

  private activarRealtime(id: string) {
    const channel = this.planNutricionalService.subscribePlanPaciente(id, () => {
      this.cargarPlanPaciente();
    });
    this.planChannels.push(channel as unknown as RealtimeChannel);
  }

  // ==========================================
  // MÉTODOS DE TÉCNICA (NUEVO)
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
      // Llamadas a tu backend / Supabase
      // const videoUrl = await this.authService.subirVideo(this.pacienteId, this.videoFile);
      // await this.authService.guardarRegistroTecnica(this.pacienteId, this.ejercicioTecnica, this.notaTecnica, videoUrl);
      
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