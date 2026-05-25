import { ChangeDetectorRef, Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/supabase/auth';
// 🟢 1. IMPORTAMOS TU NUEVO SERVICIO DE LUJO
import { PlanNutricionalService } from '../../core/services/plan-nutricional/plan-nutricional.service';

type PanelSection = 'nutrition' | 'training' | 'measurements' | 'photos' | 'testimonio';
type PhotoKind = 'frente' | 'perfil' | 'espalda';

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

  // ==========================================
  // VARIABLES DE MEDIDAS Y FOTOS
  // ==========================================
  measurements = ['BIR', 'BDR', 'BIC', 'BDC', 'Torax', 'Cintura', 'Gluteo', 'Muslo', 'PI', 'PD'];
  measurementValues: Record<string, number | null> = {};
  measurementMessage = '';
  isSavingMeasurements = false;
  
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
    public planNutricionalService: PlanNutricionalService, // 🟢 2. LO INYECTAMOS AQUÍ
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
    // 🟢 3. USAMOS EL NUEVO SERVICIO PARA CERRAR EL CANAL
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

  async logout() {
    try {
      // 🟢 4. USAMOS EL NUEVO SERVICIO PARA CERRAR EL CANAL
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
    
    // ESTO ES LO MÁS IMPORTANTE:
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
    // 🟢 6. USAMOS EL NUEVO SERVICIO PARA ESCUCHAR CAMBIOS
    const channel = this.planNutricionalService.subscribePlanPaciente(id, () => {
      this.cargarPlanPaciente();
    });
    this.planChannels.push(channel as unknown as RealtimeChannel);
  }

  // ==========================================
  // MÉTODOS DE MEDIDAS Y FOTOS (Siguen con authService por ahora)
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
  // MÉTODOS DE TESTIMONIOS (Siguen con authService por ahora)
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
