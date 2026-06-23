import { ChangeDetectorRef, Component, OnDestroy, OnInit, Inject, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule,FormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AuthService } from '../../../core/supabase/auth';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PlanNutricionalService } from '../../../core/services/plan-nutricional/plan-nutricional.service';
import { EntrenamientoService } from '../../../core/services/entrenamiento/entrenamiento.service';
import { BlogService } from '../../../core/services/blog';
import { BlogPost } from '../../../core/models/blog-post.model';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private planNutricionalService = inject(PlanNutricionalService);
  private entrenamientoService = inject(EntrenamientoService);
  private blogService = inject(BlogService);
  private cdr = inject(ChangeDetectorRef);

  vistaActual: 'lista' | 'editor' = 'lista';
  adminSection: 'patients' | 'blog' = 'patients';
  seccionEditor: 'evaluacion' | 'nutrition' | 'training' | 'tecnica' = 'evaluacion';
  activeTrainingEditorDay = 0;
  pacienteSeleccionado: any = null;
  pacientes: any[] = [];
  planForm!: FormGroup;
  blogForm!: FormGroup;
  isLoadingPacientes = false;
  isLoadingExpediente = false;
  isSavingPlan = false;
  isLoadingBlog = false;
  isSavingBlog = false;
  pacientesError = '';
  expedienteError = '';
  planEditorError = '';
  blogError = '';
  blogMessage = '';

  expedienteClinico: any = null;
  blogPosts: BlogPost[] = [];
  selectedBlogPost: BlogPost | null = null;
  private pacientesChannel: RealtimeChannel | null = null;
  
  // Variables para Revisión de Técnica
  videosTecnica: any[] = [];
  isSavingFeedback = false;

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

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  get totalPacientes() { return this.pacientes.length; }
  get pacientesActivos() { return this.pacientes.filter(p => p.estado_aprobacion === 'aprobado').length; }
  get pendientesRevision() { return this.pacientes.filter(p => p.estado_aprobacion !== 'aprobado').length; }

  ngOnInit() {
    this.initForm();
    this.initBlogForm();
    if (!isPlatformBrowser(this.platformId)) return;

    window.setTimeout(() => {
      this.cargarPacientes();
    }, 0);
    
    this.pacientesChannel = this.authService.subscribePacientes(() => {
      if (this.vistaActual === 'lista') this.cargarPacientes();
    });
  }

  ngOnDestroy() {
    if (this.pacientesChannel) this.authService.unsubscribeChannel(this.pacientesChannel);
  }

  private initForm() {
    this.planForm = this.fb.group({
      calorias_totales: [''],
      suplementacion: [''],
      medicacion: [''],
      comidas: this.fb.array([]),
      notas_entrenamiento: [''],
      dias_entrenamiento: this.fb.array([])
    });
  }

  private initBlogForm(post?: BlogPost) {
    const current = post ?? this.blogService.createEmptyPost();
    this.selectedBlogPost = post ?? null;
    this.blogForm = this.fb.group({
      id: [current.id],
      title: [current.title, Validators.required],
      excerpt: [current.excerpt, Validators.required],
      content: [current.content, Validators.required],
      coverImage: [current.coverImage],
      category: [current.category, Validators.required],
      readTime: [current.readTime, Validators.required],
      author: [current.author || 'Pablo Herrera'],
      published: [current.published ?? false],
      featured: [current.featured ?? false],
      date: [current.date],
    });
  }

  setAdminSection(section: 'patients' | 'blog') {
    this.adminSection = section;
    if (section === 'blog' && this.blogPosts.length === 0) {
      this.cargarBlogPosts();
    }
    this.cdr.detectChanges();
  }

  setSeccionEditor(seccion: 'evaluacion' | 'nutrition' | 'training' | 'tecnica') {
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
      this.pacientesError = this.getErrorMessage(error, 'No se pudieron cargar los pacientes.');
    } finally {
      this.isLoadingPacientes = false;
      this.cdr.detectChanges();
    }
  }

  async cargarBlogPosts() {
    this.isLoadingBlog = true;
    this.blogError = '';
    this.blogMessage = '';
    this.cdr.detectChanges();

    try {
      this.blogPosts = await this.blogService.getAdminPosts();
    } catch (error) {
      this.blogError = this.getErrorMessage(error, 'No se pudieron cargar los articulos.');
    } finally {
      this.isLoadingBlog = false;
      this.cdr.detectChanges();
    }
  }

  nuevoBlogPost() {
    this.blogMessage = '';
    this.blogError = '';
    this.initBlogForm();
    this.cdr.detectChanges();
  }

  editarBlogPost(post: BlogPost) {
    this.blogMessage = '';
    this.blogError = '';
    this.initBlogForm(post);
    this.cdr.detectChanges();
  }

  async guardarBlogPost(publicar?: boolean) {
    if (this.blogForm.invalid) {
      this.blogForm.markAllAsTouched();
      this.blogError = 'Completa titulo, resumen, contenido, categoria y tiempo de lectura.';
      return;
    }

    this.isSavingBlog = true;
    this.blogError = '';
    this.blogMessage = '';
    this.cdr.detectChanges();

    try {
      const payload = {
        ...this.blogForm.value,
        published: typeof publicar === 'boolean' ? publicar : this.blogForm.value.published,
      };
      const saved = await this.blogService.savePost(payload);
      this.blogMessage = saved.published ? 'Articulo publicado y visible en el blog.' : 'Borrador guardado.';
      this.initBlogForm(saved);
      await this.cargarBlogPosts();
    } catch (error) {
      this.blogError = this.getErrorMessage(error, 'No se pudo guardar el articulo.');
    } finally {
      this.isSavingBlog = false;
      this.cdr.detectChanges();
    }
  }

  async toggleBlogPublication(post: BlogPost) {
    await this.blogService.savePost({ ...post, published: !post.published });
    await this.cargarBlogPosts();
  }

  async eliminarBlogPost(post: BlogPost) {
    const confirmed = globalThis.confirm?.(`Eliminar "${post.title}" del blog?`);
    if (!confirmed) return;

    await this.blogService.deletePost(post.id);
    if (this.blogForm?.value?.id === post.id) {
      this.nuevoBlogPost();
    }
    await this.cargarBlogPosts();
  }

  async abrirExpediente(paciente: any) {
    this.pacienteSeleccionado = paciente;
    this.vistaActual = 'editor';
    this.seccionEditor = 'evaluacion'; 
    this.activeTrainingEditorDay = 0;
    this.isLoadingExpediente = true;
    this.expedienteClinico = null;
    this.videosTecnica = [];
    this.expedienteError = '';
    this.planEditorError = '';
    this.initForm();
    this.cdr.detectChanges();

    try {
      const [planRes, rutinaRes, expRes, videosRes] = await Promise.allSettled([
        this.withTimeout(this.planNutricionalService.getPlanPaciente(paciente.id), 'La carga del plan de alimentacion tardo demasiado.'),
        this.withTimeout(this.entrenamientoService.getRutinaPaciente(paciente.id), 'La carga de rutina tardo demasiado.'),
        this.withTimeout(this.authService.getExpedienteClinico(paciente.id), 'La carga del expediente tardo demasiado.'),
        this.withTimeout(this.entrenamientoService.getRevisionesTecnica(paciente.id), 'La carga de videos tardó demasiado.')
      ]);

      if (expRes.status === 'fulfilled' && expRes.value) {
        this.expedienteClinico = expRes.value;
      } else {
        this.expedienteError = 'No se encontró entrevista de Onboarding.';
      }

      if (planRes.status === 'fulfilled' && planRes.value) {
        const planExistente = planRes.value;
        this.planForm.patchValue({
          calorias_totales: planExistente.calorias_totales || '',
          suplementacion: planExistente.suplementacion || '',
          medicacion: planExistente.medicacion || '',
        });

        const comidasDb = planExistente.comidas || [];
        comidasDb.forEach((c: any) => {
          const comidaGroup = this.fb.group({
            nombre: [c.nombre || '', Validators.required],
            nota_comida: [c.nota_comida || ''],
            alimentos_comida: this.fb.array(
              (c.alimentos_comida || []).map((a: any) =>
                this.fb.group({
                  descripcion: [a.descripcion || '', Validators.required],
                  calorias: [a.calorias || 0],
                  proteinas: [a.proteinas || 0],
                  carbos: [a.carbos || 0],
                  grasas: [a.grasas || 0],
                })
              )
            ),
          });
          this.comidas.push(comidaGroup);
        });
      } else if (planRes.status === 'rejected') {
        this.planEditorError = this.getErrorMessage(planRes.reason, 'No se pudo cargar el plan anterior.');
      }

      if (rutinaRes.status === 'fulfilled' && rutinaRes.value) {
        const rutinaExistente = rutinaRes.value;
        this.planForm.patchValue({
          notas_entrenamiento: rutinaExistente.notas_entrenamiento || ''
        });

        const diasDb = rutinaExistente.dias_entrenamiento || [];
        diasDb.forEach((d: any) => {
          const diaGroup = this.fb.group({
            titulo: [d.titulo || '', Validators.required],
            ejercicios: this.fb.array(
              (d.ejercicios || []).map((e: any) =>
                this.fb.group({
                  ejercicio: [e.ejercicio || '', Validators.required],
                  series: [e.series || 4, [Validators.required, Validators.min(1)]],
                  reps: [e.reps || '10-12', Validators.required]
                })
              )
            )
          });
          this.diasEntrenamiento.push(diaGroup);
        });
      } else if (rutinaRes.status === 'rejected') {
        this.planEditorError = this.getErrorMessage(rutinaRes.reason, 'No se pudo cargar la rutina anterior.');
      }

      if (videosRes.status === 'fulfilled' && videosRes.value) {
        this.videosTecnica = videosRes.value;
      } else {
        this.videosTecnica = [];
      }

    } catch (error) {
      console.error('Error general abriendo expediente:', error);
      this.planEditorError = 'Error al construir el formulario del paciente.';
    } finally {
      this.isLoadingExpediente = false;
      this.cdr.detectChanges();
    }
  }

  async guardarPlan() {
    if (this.planForm.invalid || !this.pacienteSeleccionado?.id) {
      this.planForm.markAllAsTouched();
      alert('Revisa los formularios: hay campos obligatorios pendientes.');
      return;
    }

    this.isSavingPlan = true;
    this.cdr.detectChanges();

    try {
      const tareas: Promise<void>[] = [];

      if (this.tieneComidasConAlimentos()) {
        tareas.push(this.planNutricionalService.guardarPlanCompleto(this.pacienteSeleccionado.id, this.planForm.value));
      }

      if (this.tieneRutinaConEjercicios()) {
        tareas.push(this.entrenamientoService.guardarRutinaCompleta(this.pacienteSeleccionado.id, this.planForm.value));
      }

      if (tareas.length === 0) {
        alert('Agrega al menos una comida con alimento o un dia de entrenamiento con ejercicios.');
        return;
      }

      await Promise.all(tareas);
      alert('¡Plan de Nutrición y Entrenamiento guardados con éxito!');
      await this.volverAlPanel();
    } catch (error: any) {
      alert(`Error al guardar: ${error.message || 'Error desconocido'}`);
    } finally {
      this.isSavingPlan = false;
      this.cdr.detectChanges();
    }
  }

  async enviarFeedback(video: any) {
    if (!video.feedback_coach?.trim()) {
      alert('Por favor, escribe un comentario antes de enviar el feedback.');
      return;
    }

    this.isSavingFeedback = true;
    this.cdr.detectChanges();

    try {
      await this.entrenamientoService.actualizarFeedbackTecnica(video.id, video.feedback_coach);
      video.estado = 'Revisado';
      alert('Feedback guardado y notificado al paciente.');
    } catch (error) {
      alert('Error al guardar el feedback. Intenta de nuevo.');
    } finally {
      this.isSavingFeedback = false;
      this.cdr.detectChanges();
    }
  }

  // Getters y helpers de Nutrición
  get comidas() { return this.planForm.get('comidas') as FormArray; }
  alimentosDeComida(idx: number) { return this.comidas.at(idx).get('alimentos_comida') as FormArray; }

  agregarComida() {
    this.comidas.push(this.fb.group({ nombre: ['', Validators.required], nota_comida: [''], alimentos_comida: this.fb.array([]) }));
    this.cdr.detectChanges();
  }

  agregarAlimento(idx: number) {
    this.alimentosDeComida(idx).push(this.fb.group({ descripcion: ['', Validators.required], calorias: [0], proteinas: [0], carbos: [0], grasas: [0] }));
    this.cdr.detectChanges();
  }

  // Getters y helpers de Entrenamiento
  get diasEntrenamiento() { return this.planForm.get('dias_entrenamiento') as FormArray; }
  ejerciciosDeDia(idx: number) { return this.diasEntrenamiento.at(idx).get('ejercicios') as FormArray; }

  selectTrainingEditorDay(index: number) {
    this.activeTrainingEditorDay = index;
    this.cdr.detectChanges();
  }

  agregarDia() {
    this.diasEntrenamiento.push(this.fb.group({ titulo: ['', Validators.required], ejercicios: this.fb.array([]) }));
    this.activeTrainingEditorDay = this.diasEntrenamiento.length - 1;
    this.cdr.detectChanges();
  }

  agregarEjercicio(idx: number) {
    this.ejerciciosDeDia(idx).push(this.fb.group({ ejercicio: ['', Validators.required], series: [4, [Validators.required, Validators.min(1)]], reps: ['10-12', Validators.required] }));
    this.cdr.detectChanges();
  }

  eliminarDia(i: number) {
    this.diasEntrenamiento.removeAt(i);
    this.activeTrainingEditorDay = Math.max(0, Math.min(this.activeTrainingEditorDay, this.diasEntrenamiento.length - 1));
    this.cdr.detectChanges();
  }
  eliminarEjercicio(i: number, j: number) { this.ejerciciosDeDia(i).removeAt(j); this.cdr.detectChanges(); }

  async toggleEstado(paciente: any, event: Event) {
    event.stopPropagation();
    const original = paciente.estado_aprobacion;
    paciente.estado_aprobacion = original === 'aprobado' ? 'pendiente' : 'aprobado';
    try {
      await this.authService.actualizarEstadoPaciente(paciente.id, paciente.estado_aprobacion);
    } catch {
      paciente.estado_aprobacion = original;
    }
    this.cdr.detectChanges();
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
    return this.comidas.controls.some((c, i) => c.get('nombre')?.value && this.alimentosDeComida(i).length > 0);
  }

  tieneRutinaConEjercicios(): boolean {
    return this.diasEntrenamiento.controls.some((dia, i) => {
      const titulo = String(dia.get('titulo')?.value ?? '').trim();
      const tieneEjercicios = this.ejerciciosDeDia(i).controls.some((ej) => String(ej.get('ejercicio')?.value ?? '').trim().length > 0);
      return titulo.length > 0 || tieneEjercicios;
    });
  }

  calcularCaloriasBase(paciente: any): number | string {
    if (!paciente?.peso_kg || !paciente?.altura_cm || !paciente?.edad || !paciente?.genero) return 'Datos pendientes';
    const peso = parseFloat(paciente.peso_kg);
    const altura = parseFloat(paciente.altura_cm);
    const edad = parseInt(paciente.edad, 10);
    let tmb = (paciente.genero === 'Hombre') 
      ? (10 * peso + 6.25 * altura - 5 * edad + 5)
      : (10 * peso + 6.25 * altura - 5 * edad - 161);
    return Math.round(tmb);
  }

  getPacienteIniciales(p: any): string {
    const n = p?.nombre_completo || p?.email || 'P';
    return n.split(' ').filter(Boolean).slice(0, 2).map((x: any) => x[0]).join('').toUpperCase();
  }

  getPacienteObjetivo(p: any) { return p?.peso_objetivo || p?.objetivo || 'Pendiente'; }

  formatRespuesta(val: any): string {
    if (!val) return 'Sin respuesta';
    if (typeof val === 'object') {
      const e = Object.entries(val).filter(([, v]) => v === true || (typeof v === 'string' && v.trim().length > 0))
        .map(([k, v]) => v === true ? this.getRespuestaLabel(k) : `${this.getRespuestaLabel(k)}: ${v}`);
      return e.length > 0 ? e.join(', ') : 'Sin datos';
    }
    return String(val);
  }

  getRespuestaLabel(key: any): string {
    return this.formLabels[String(key)] ?? String(key).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getErrorMessage(e: any, f: string) { return e?.message ? `${f} ${e.message}` : f; }

  private withTimeout<T>(request: Promise<T>, message: string, timeoutMs = 10000): Promise<T> {
    return Promise.race([
      request,
      new Promise<T>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }
}