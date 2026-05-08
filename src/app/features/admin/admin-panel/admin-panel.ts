import { ChangeDetectorRef, Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AuthService } from '../../../core/supabase/auth';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  vistaActual: 'lista' | 'editor' = 'lista';
  pacienteSeleccionado: any = null;
  pacientes: any[] = [];
  planForm!: FormGroup;
  isLoadingPacientes = false;
  isLoadingExpediente = false;
  isSavingPlan = false;

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

  get totalPacientes() {
    return this.pacientes.length;
  }

  get pacientesActivos() {
    return this.pacientes.filter((paciente) => paciente.estado_aprobacion === 'aprobado').length;
  }

  get pendientesRevision() {
    return this.pacientes.filter((paciente) => paciente.estado_aprobacion !== 'aprobado').length;
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.initForm();
    this.cargarPacientes();
    
    // 🟢 Protección SSR: Evita que el servidor se trabe "procesando"
    if (isPlatformBrowser(this.platformId)) {
      this.pacientesChannel = this.authService.subscribePacientes(() => {
        if (this.vistaActual === 'lista') {
          this.cargarPacientes();
        }
      });
    }
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
    });
  }

  async cargarPacientes() {
    this.isLoadingPacientes = true;
    try {
      this.pacientes = await this.authService.getPacientes();
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
    } finally {
      this.isLoadingPacientes = false;
      this.cdr.detectChanges();
    }
  }

  async abrirExpediente(paciente: any) {
    this.pacienteSeleccionado = paciente;
    this.isLoadingExpediente = true;
    this.expedienteClinico = null;

    try {
      const planExistente = await this.authService.getPlanPaciente(paciente.id);
      this.expedienteClinico = await this.authService.getExpedienteClinico(paciente.id);

      this.initForm();

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
            alimentos: this.fb.array(
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
      this.vistaActual = 'editor';
    } catch (error) {
      console.error('Error al cargar expediente:', error);
    } finally {
      this.isLoadingExpediente = false;
      this.cdr.detectChanges();
    }
  }

  async guardarPlan() {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      alert('Revisa el plan: hay comidas o alimentos con campos obligatorios incompletos.');
      return;
    }

    if (!this.pacienteSeleccionado?.id) {
      alert('Selecciona un paciente antes de guardar el plan.');
      return;
    }

    this.isSavingPlan = true;
    try {
      await this.authService.guardarPlanCompleto(this.pacienteSeleccionado.id, this.planForm.value);
      alert('¡Plan actualizado correctamente en Supabase!');
      await this.volverAlPanel();
    } catch (error) {
      alert('Error al guardar el plan.');
      console.error(error);
    } finally {
      this.isSavingPlan = false;
      this.cdr.detectChanges();
    }
  }

  get comidas() {
    return this.planForm.get('comidas') as FormArray;
  }
  alimentosDeComida(comidaIndex: number) {
    return this.comidas.at(comidaIndex).get('alimentos') as FormArray;
  }

  agregarComida() {
    this.comidas.push(
      this.fb.group({
        nombre: ['', Validators.required],
        nota_comida: [''],
        alimentos: this.fb.array([]),
      }),
    );
  }

  agregarAlimento(comidaIndex: number) {
    this.alimentosDeComida(comidaIndex).push(
      this.fb.group({
        descripcion: ['', Validators.required],
        calorias: [0],
        proteinas: [0],
        carbos: [0],
        grasas: [0],
      }),
    );
  }

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
      console.error('Error al actualizar estado del paciente:', error);
    }
  }

  async volverAlPanel() {
    this.vistaActual = 'lista';
    this.pacienteSeleccionado = null;
    await this.cargarPacientes();
  }

  eliminarComida(i: number) {
    this.comidas.removeAt(i);
  }
  eliminarAlimento(i: number, j: number) {
    this.alimentosDeComida(i).removeAt(j);
  }

  calcularCaloriasBase(paciente: any): number | string {
    if (
      !paciente ||
      !paciente.peso_kg ||
      !paciente.altura_cm ||
      !paciente.edad ||
      !paciente.genero
    ) {
      return 'Datos clinicos pendientes';
    }

    const peso = parseFloat(paciente.peso_kg);
    const altura = parseFloat(paciente.altura_cm);
    const edad = parseInt(paciente.edad, 10);
    let tmb = 0;

    if (paciente.genero === 'Hombre') {
      tmb = 10 * peso + 6.25 * altura - 5 * edad + 5;
    } else if (paciente.genero === 'Mujer') {
      tmb = 10 * peso + 6.25 * altura - 5 * edad - 161;
    }

    return Math.round(tmb);
  }

  getPacienteIniciales(paciente: any): string {
    const nombre = paciente?.nombre_completo || paciente?.email || 'Paciente';
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte: string) => parte[0])
      .join('')
      .toUpperCase();
  }

  getPacienteObjetivo(paciente: any): string {
    return paciente?.peso_objetivo || paciente?.objetivo || 'Objetivo pendiente';
  }

  formatRespuesta(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return 'Sin respuesta';
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue === true || (typeof entryValue === 'string' && entryValue.trim().length > 0))
        .map(([key, entryValue]) => {
          const label = this.formLabels[key] ?? this.humanizeKey(key);
          return entryValue === true ? label : `${label}: ${entryValue}`;
        });

      return entries.length > 0 ? entries.join(', ') : 'Sin datos marcados';
    }

    return String(value);
  }

  getRespuestaLabel(key: unknown): string {
    const normalizedKey = String(key);
    return this.formLabels[normalizedKey] ?? this.humanizeKey(normalizedKey);
  }

  private humanizeKey(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}