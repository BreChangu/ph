import { ChangeDetectorRef, Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AuthService } from '../../../core/supabase/auth';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PlanNutricionalService } from '../../../core/services/plan-nutricional/plan-nutricional.service';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  vistaActual: 'lista' | 'editor' = 'lista';
  seccionEditor: 'evaluacion' | 'nutrition' | 'training' = 'evaluacion'; // 🟢 Control de las sub-pestañas del admin
  pacienteSeleccionado: any = null;
  pacientes: any[] = [];
  planForm!: FormGroup;
  isLoadingPacientes = false;
  isLoadingExpediente = false;
  isSavingPlan = false;
  pacientesError = '';
  expedienteError = '';
  planEditorError = '';

  expedienteClinico: any = null;
  private pacientesChannel: RealtimeChannel | null = null;

  formLabels: Record<string, string> = {
    nombre_completo: 'Nombre completo',
    edad: 'Edad',
    peso_kg: 'Peso actual',
    altura_cm: 'Altura',
    genero: 'Género biológico',
    porcentaje_grasa: 'Porcentaje de grasa',
    cintura_cm: 'Cintura',
    peso_objetivo: 'Meta',
    objetivo: 'Objetivo principal',
    dieta_previa: 'Dieta previa',
    creador_dieta: 'Diseñó dieta previa',
    motivo_abandono: 'Motivo de abandono',
    ocupacion: 'Ocupación',
    gym_actual: 'Gym actual',
    dias_entreno: 'Días de entrenamiento',
    lesiones: 'Lesiones',
    tiempo_entrenando: 'Tiempo entrenando',
    horario_entreno: 'Horario de entrenamiento',
    enfoque_entrenamiento: 'Enfoque de entrenamiento',
    enfermedades: 'Enfermedades',
    medicamentos: 'Medicamentos',
    antecedentes_familiares: 'Antecedentes familiares',
    comidas_al_dia: 'Comidas al día',
    ejemplo_dia: 'Ejemplo de un día',
    alimentos_favoritos: 'Alimentos favoritos',
    alimentos_odiados: 'Alimentos no tolerados',
    ansiedad_comer: 'Ansiedad por comer',
    conflicto_alimentacion: 'Mayor conflicto alimentario',
    comidas_mas_hambre: 'Comidas con más hambre',
    colaciones: 'Colaciones',
    suplementos: 'Suplementos',
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private planNutricionalService: PlanNutricionalService, 
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  get totalPacientes() { return this.pacientes.length; }
  get pacientesActivos() { return this.pacientes.filter(p => p.estado_aprobacion === 'aprobado').length; }
  get pendientesRevision() { return this.pacientes.filter(p => p.estado_aprobacion !== 'aprobado').length; }

  ngOnInit() {
    this.initForm();
    if (!isPlatformBrowser(this.platformId)) return;

    window.setTimeout(() => {
      this.cargarPacientes();
    }, 0);
    
    this.pacientesChannel = this.authService.subscribePacientes(() => {
      if (this.vistaActual === 'lista') {
        window.setTimeout(() => {
          this.cargarPacientes();
        }, 0);
      }
    });
  }

  ngOnDestroy() {
    if (this.pacientesChannel) {
      this.authService.unsubscribeChannel(this.pacientesChannel);
    }
  }

  private initForm() {
    this.planForm = this.fb.group({
      calorias_totales: [''],
      suplementacion: [''],
      medicacion: [''],
      comidas: this.fb.array([]),
      // 🟢 NUEVO: Soporte reactivo para el módulo de entrenamiento unificado
      notas_entrenamiento: [''],
      dias_entrenamiento: this.fb.array([])
    });
  }

  setSeccionEditor(seccion: 'evaluacion' | 'nutrition' | 'training') {
    this.seccionEditor = seccion;
    this.cdr.detectChanges();
  }

  async cargarPacientes() {
    this.isLoadingPacientes = true;
    this.pacientesError = '';
    this.cdr.detectChanges();

    try {
      this.pacientes = await this.authService.getPacientes();
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
      this.pacientes = [];
      this.pacientesError = this.getErrorMessage(error, 'No se pudieron cargar los pacientes.');
    } finally {
      this.isLoadingPacientes = false;
      this.cdr.detectChanges();
    }
  }

 async abrirExpediente(paciente: any) {
    this.pacienteSeleccionado = paciente;
    this.vistaActual = 'editor';
    this.seccionEditor = 'evaluacion'; 
    this.isLoadingExpediente = true;
    this.expedienteClinico = null;
    this.expedienteError = '';
    this.planEditorError = '';
    this.initForm();
    this.cdr.detectChanges(); // Pintamos el cargador de inmediato

    try {
      const planExistente = await this.withTimeout(
        this.planNutricionalService.getPlanPaciente(paciente.id),
        'No se pudo cargar el plan anterior.'
      );
      
      this.expedienteClinico = await this.withTimeout(
        this.authService.getExpedienteClinico(paciente.id),
        'Error cargando el expediente.'
      ).catch(() => null);

      if (planExistente) {
        this.planForm.patchValue({
          calorias_totales: planExistente.calorias_totales,
          suplementacion: planExistente.suplementacion,
          medicacion: planExistente.medicacion,
        });

        (planExistente.comidas ?? []).forEach((c: any) => {
          const comidaGroup = this.fb.group({
            nombre: [c.nombre, Validators.required],
            nota_comida: [c.nota_comida],
            alimentos_comida: this.fb.array(
              (c.alimentos_comida ?? []).map((a: any) =>
                this.fb.group({
                  descripcion: [a.descripcion, Validators.required],
                  calorias: [a.calorias],
                  proteinas: [a.proteinas],
                  carbos: [a.carbos],
                  grasas: [a.grasas],
                }),
              ),
            ),
          });
          this.comidas.push(comidaGroup);
        });
      }
    } catch (error) {
      this.planEditorError = this.getErrorMessage(error, 'Falla al abrir expediente.');
    } finally {
      // 🟢 CORRECCIÓN DE LACH: Usamos macro-task pura para pintar al instante sin esperar clics
      window.setTimeout(() => {
        this.isLoadingExpediente = false;
        this.cdr.detectChanges();
      }, 0);
    }
  }

  async guardarPlan() {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      alert('Revisa el plan: hay campos obligatorios incompletos en los formularios.');
      return;
    }

    if (this.seccionEditor === 'nutrition' && !this.tieneComidasConAlimentos()) {
      alert('Agrega al menos una comida con un alimento antes de guardar el plan nutricional.');
      return;
    }

    if (!this.pacienteSeleccionado?.id) {
      alert('Selecciona un paciente antes de procesar el guardado.');
      return;
    }

    this.isSavingPlan = true;
    this.cdr.detectChanges();

    try {
      await this.planNutricionalService.guardarPlanCompleto(this.pacienteSeleccionado.id, this.planForm.value);
      alert('¡Información actualizada correctamente en Supabase!');
      await this.volverAlPanel();
    } catch (error: any) {
      console.error('❌ ERROR DETALLADO DE SUPABASE:', error);
      alert(`Error al guardar: ${error?.message || 'Error desconocido'}`);
    } finally {
      this.isSavingPlan = false;
      this.cdr.detectChanges();
    }
  }

  // Getters para Nutrición
  get comidas() { return this.planForm.get('comidas') as FormArray; }
  alimentosDeComida(comidaIndex: number) { return this.comidas.at(comidaIndex).get('alimentos_comida') as FormArray; }

  agregarComida() {
    this.comidas.push(this.fb.group({ nombre: ['', Validators.required], nota_comida: [''], alimentos_comida: this.fb.array([]) }));
    this.cdr.detectChanges();
  }

  agregarAlimento(comidaIndex: number) {
    this.alimentosDeComida(comidaIndex).push(this.fb.group({ descripcion: ['', Validators.required], calorias: [0], proteinas: [0], carbos: [0], grasas: [0] }));
    this.cdr.detectChanges();
  }

  // 🟢 GETTERS Y MÉTODOS PARA EL MÓDULO DE ENTRENAMIENTO REACtIVO
  get diasEntrenamiento() { return this.planForm.get('dias_entrenamiento') as FormArray; }
  ejerciciosDeDia(diaIndex: number) { return this.diasEntrenamiento.at(diaIndex).get('dias_ejercicios') as FormArray; }

  agregarDia() {
    this.diasEntrenamiento.push(this.fb.group({
      titulo: ['', Validators.required],
      dias_ejercicios: this.fb.array([])
    }));
    this.cdr.detectChanges();
  }

  agregarEjercicio(diaIndex: number) {
    this.ejerciciosDeDia(diaIndex).push(this.fb.group({
      ejercicio: ['', Validators.required],
      series: [4, [Validators.required, Validators.min(1)]],
      reps: ['10-12', Validators.required]
    }));
    this.cdr.detectChanges();
  }

  eliminarDia(i: number) { this.diasEntrenamiento.removeAt(i); this.cdr.detectChanges(); }
  eliminarEjercicio(i: number, j: number) { this.ejerciciosDeDia(i).removeAt(j); this.cdr.detectChanges(); }

  async toggleEstado(paciente: any, event: Event) {
    event.stopPropagation();
    const estadoAnterior = paciente.estado_aprobacion;
    const nuevoEstado = paciente.estado_aprobacion === 'aprobado' ? 'pendiente' : 'aprobado';
    paciente.estado_aprobacion = nuevoEstado;
    this.cdr.detectChanges();

    try {
      await this.authService.actualizarEstadoPaciente(paciente.id, nuevoEstado);
    } catch (error) {
      paciente.estado_aprobacion = estadoAnterior;
      this.cdr.detectChanges();
      console.error('Error al actualizar estado:', error);
    }
  }

  async volverAlPanel() {
    this.vistaActual = 'lista';
    this.pacienteSeleccionado = null;
    this.cdr.detectChanges();
    await this.cargarPacientes();
  }

  eliminarComida(i: number) { this.comidas.removeAt(i); this.cdr.detectChanges(); }
  eliminarAlimento(i: number, j: number) { this.alimentosDeComida(i).removeAt(j); this.cdr.detectChanges(); }

  tieneComidasConAlimentos(): boolean {
    return this.comidas.controls.some((comidaControl, index) => {
      const nombre = String(comidaControl.get('nombre')?.value ?? '').trim();
      const alimentos = this.alimentosDeComida(index);
      return nombre.length > 0 && alimentos.length > 0;
    });
  }

  calcularCaloriasBase(paciente: any): number | string {
    if (!paciente?.peso_kg || !paciente?.altura_cm || !paciente?.edad || !paciente?.genero) {
      return 'Datos clinicos pendientes';
    }
    const peso = parseFloat(paciente.peso_kg);
    const altura = parseFloat(paciente.altura_cm);
    const edad = parseInt(paciente.edad, 10);
    let tmb = (paciente.genero === 'Hombre')
      ? (10 * peso + 6.25 * altura - 5 * edad + 5)
      : (10 * peso + 6.25 * altura - 5 * edad - 161);
    return Math.round(tmb);
  }

  getPacienteIniciales(paciente: any): string {
    const nombre = paciente?.nombre_completo || paciente?.email || 'Paciente';
    return nombre.split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]).join('').toUpperCase();
  }

  getPacienteObjetivo(paciente: any): string {
    return paciente?.peso_objetivo || paciente?.objetivo || 'Objetivo pendiente';
  }

  formatRespuesta(value: any): string {
    if (!value) return 'Sin respuesta';
    if (typeof value === 'object') {
      const entries = Object.entries(value)
        .filter(([, val]) => val === true || (typeof val === 'string' && val.trim().length > 0))
        .map(([key, val]) => val === true ? this.getRespuestaLabel(key) : `${this.getRespuestaLabel(key)}: ${val}`);
      return entries.length > 0 ? entries.join(', ') : 'Sin datos';
    }
    return String(value);
  }

  getRespuestaLabel(key: any): string {
    const normalizedKey = String(key);
    return this.formLabels[normalizedKey] ?? this.humanizeKey(normalizedKey);
  }

  private humanizeKey(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private getErrorMessage(error: any, fallback: string): string {
    return error?.message ? `${fallback} ${error.message}` : fallback;
  }

  private withTimeout<T>(request: Promise<T>, message: string, timeoutMs = 10000): Promise<T> {
    return Promise.race([
      request,
      new Promise<T>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }
}