import { ChangeDetectorRef, Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/supabase/auth';

type PanelSection = 'nutrition' | 'training' | 'measurements' | 'photos';
type PhotoKind = 'frente' | 'perfil' | 'espalda';

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './panel.html',
  styleUrls: ['./panel.scss'],
})
export class PanelComponent implements OnInit, OnDestroy {
  userName = 'Paciente';
  isLoadingPlan = false;
  planError = '';
  expedienteCompleto = true;
  planPaciente: any = null;
  activeSection: PanelSection = 'nutrition';
  activeTrainingDay = 0;
  isSavingMeasurements = false;
  isSavingPhotos = false;
  measurementMessage = '';
  photoMessage = '';
  measurementValues: Record<string, number | null> = {};
  photoFiles: Partial<Record<PhotoKind, File>> = {};

  private pacienteId: string | null = null;
  private planChannels: RealtimeChannel[] = [];
  private planRequestId = 0;

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

  measurements = ['BIR', 'BDR', 'BIC', 'BDC', 'Torax', 'Cintura', 'Gluteo', 'Muslo', 'PI', 'PD'];

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    // 🟢 FIX: Usamos isPlatformBrowser para proteger el SSR y omitimos getCachedAuthUser
    if (isPlatformBrowser(this.platformId)) {
      try {
        const session = await this.authService.getSession();
        
        if (!session?.user?.id) {
          await this.router.navigate(['/auth']);
          return;
        }

        const perfil = await this.authService.getUserProfileForAuth(session.user.id, session.user.email);
        const pacienteId = perfil?.id ?? session.user.id;

        this.userName = perfil?.nombre_completo?.split(' ')[0] || session.user.email || 'Paciente';
        this.bootstrapPaciente(pacienteId);
        this.cargarDatosSecundarios(pacienteId, session.user.email, perfil);
      } catch (error) {
        console.error('Error al cargar panel de paciente:', error);
        await this.router.navigate(['/auth']);
      }
    }
  }

  ngOnDestroy() {
    this.planChannels.forEach((channel) => this.authService.unsubscribeChannel(channel));
  }

  setSection(section: PanelSection) {
    this.activeSection = section;
  }

  selectTrainingDay(index: number) {
    this.activeTrainingDay = index;
  }

  onMeasurementInput(item: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.measurementValues[item] = input.value === '' ? null : Number(input.value);
  }

  onPhotoSelected(kind: PhotoKind, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.photoFiles[kind] = file;
      this.photoMessage = '';
    }
  }

  async cargarPlanPaciente() {
    if (!this.pacienteId) return;

    const requestId = ++this.planRequestId;
    this.isLoadingPlan = true;
    this.planError = '';
    this.cdr.detectChanges();

    try {
      const plan = await this.authService.getPlanPaciente(this.pacienteId);

      if (requestId === this.planRequestId) {
        this.planPaciente = plan;
      }
    } catch (error) {
      console.error('Error al cargar plan:', error);
      if (requestId === this.planRequestId) {
        this.planError = 'Error al cargar la dieta.';
      }
    } finally {
      if (requestId === this.planRequestId) {
        this.isLoadingPlan = false;
        this.cdr.detectChanges();
      }
    }
  }

  async logout() {
    try {
      this.planChannels.forEach((channel) => this.authService.unsubscribeChannel(channel));
      this.planChannels = [];
      // 🟢 FIX: El nuevo servicio reactivo se encarga de todo con signOut
      await this.authService.signOut();
    } catch (error) {
      console.error('Error al limpiar sesión:', error);
    } finally {
      await this.router.navigate(['/auth'], { queryParams: { signedOut: '1' } });
    }
  }

  async guardarMedidas() {
    if (!this.pacienteId) return;

    const medidas = Object.entries(this.measurementValues).reduce(
      (acc, [key, value]) => {
        if (typeof value === 'number' && !Number.isNaN(value)) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    if (Object.keys(medidas).length === 0) {
      this.measurementMessage = 'Agrega al menos una medida antes de guardar.';
      return;
    }

    this.isSavingMeasurements = true;
    this.measurementMessage = '';

    try {
      await this.authService.guardarCircunferencias(this.pacienteId, medidas);
      this.measurementMessage = 'Medidas guardadas correctamente.';
    } catch (error) {
      console.error('Error al guardar medidas:', error);
      this.measurementMessage = 'No pudimos guardar las medidas. Intenta de nuevo.';
    } finally {
      this.isSavingMeasurements = false;
      this.cdr.detectChanges();
    }
  }

  async guardarFotos() {
    if (!this.pacienteId) return;

    const fotos = Object.entries(this.photoFiles).reduce(
      (acc, [key, file]) => {
        if (file) {
          acc[key] = file;
        }
        return acc;
      },
      {} as Record<string, File>
    );

    if (Object.keys(fotos).length === 0) {
      this.photoMessage = 'Selecciona al menos una fotografia para guardar.';
      return;
    }

    this.isSavingPhotos = true;
    this.photoMessage = '';

    try {
      await this.authService.guardarRegistroFotografico(this.pacienteId, fotos);
      this.photoFiles = {};
      this.photoMessage = 'Registro fotografico guardado correctamente.';
    } catch (error) {
      console.error('Error al guardar fotografias:', error);
      this.photoMessage = 'No pudimos guardar las fotografias. Intenta de nuevo.';
    } finally {
      this.isSavingPhotos = false;
      this.cdr.detectChanges();
    }
  }

  private bootstrapPaciente(id: string) {
    this.pacienteId = id;
    this.activarActualizacionPlan(id);
    this.cargarPlanPaciente();
  }

  private async cargarDatosSecundarios(id: string, email?: string, perfilInicial?: any) {
    const expedienteResult = await Promise.resolve(
      this.authService.getExpedienteClinico(id)
    ).then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason })
    );

    const perfil = perfilInicial ?? null;
    const expediente = expedienteResult.status === 'fulfilled' ? expedienteResult.value : null;

    this.userName = perfil?.nombre_completo?.split(' ')[0] || email || 'Paciente';
    this.expedienteCompleto = expedienteResult.status === 'rejected' ? true : Boolean(expediente);

    if (!this.expedienteCompleto) {
      await this.router.navigate(['/onboarding']);
      return;
    }

    const ultimaMedicion = expediente?.respuestas_completas?.seguimiento?.circunferencias?.[0]?.medidas ?? {};
    this.measurementValues = this.measurements.reduce(
      (acc, item) => ({
        ...acc,
        [item]: typeof ultimaMedicion[item] === 'number' ? ultimaMedicion[item] : null,
      }),
      {} as Record<string, number | null>
    );

    this.cdr.detectChanges();
  }

  private activarActualizacionPlan(pacienteId: string) {
    if (this.planChannels.length > 0) return;

    const channel = this.authService.subscribePlanPaciente(pacienteId, () => {
      this.cargarPlanPaciente();
    });
    
    this.planChannels = [channel as unknown as RealtimeChannel];
  }
}