import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  Inject,
  PLATFORM_ID,
  inject,
  HostListener,
} from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';

import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';

import { AuthService } from '../../../core/supabase/auth';

import { RealtimeChannel } from '@supabase/supabase-js';

import { PlanNutricionalService } from '../../../core/services/plan-nutricional/plan-nutricional.service';

import { EntrenamientoService } from '../../../core/services/entrenamiento/entrenamiento.service';

import { BlogService } from '../../../core/services/blog';

import { BlogPost } from '../../../core/models/blog-post.model';

import { ServicePackage } from '../../../core/models/service-package.model';

import { ServicePackagesService } from '../../../core/services/service-packages';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);

  public authService = inject(AuthService);

  private planNutricionalService = inject(PlanNutricionalService);

  private entrenamientoService = inject(EntrenamientoService);

  private blogService = inject(BlogService);

  private servicePackagesService = inject(ServicePackagesService);

  private cdr = inject(ChangeDetectorRef);

  vistaActual: 'lista' | 'editor' = 'lista';

  adminSection:
    | 'patients'
    | 'blog'
    | 'packages'
    | 'catalogs'
    | 'testimonials' = 'patients';

  seccionEditor: 'evaluacion' | 'nutrition' | 'training' | 'tecnica' =
    'evaluacion';

  activeTrainingEditorDay = 0;

  pacienteSeleccionado: any = null;

  pacientes: any[] = [];

  planForm!: FormGroup;

  blogForm!: FormGroup;

  packageForm!: FormGroup;

  isLoadingPacientes = false;

  isLoadingExpediente = false;

  isSavingPlan = false;

  isLoadingBlog = false;

  isSavingBlog = false;

  isLoadingPackages = false;

  isSavingPackage = false;

  pacientesError = '';

  expedienteError = '';

  planEditorError = '';

  blogError = '';

  blogMessage = '';

  packageError = '';

  packageMessage = '';

  // Moderación de testimonios
  testimonios: any[] = [];

  isLoadingTestimonios = false;

  testimoniosError = '';

  testimoniosMessage = '';

  expedienteClinico: any = null;

  blogPosts: BlogPost[] = [];

  selectedBlogPost: BlogPost | null = null;

  servicePackages: ServicePackage[] = [];

  selectedPackage: ServicePackage | null = null;

  private pacientesChannel: RealtimeChannel | null = null;

  videosTecnica: any[] = [];

  isSavingFeedback = false;

  showToast = false;

  toastMessage = '';

  toastType: 'success' | 'error' | 'info' = 'info';

  private toastTimeout: any;

  catalogoEjercicios: any[] = [];

  // Filtros visuales del catálogo de ejercicios.
  busquedaEjercicios = '';

  categoriaEjerciciosSeleccionada = 'Todas';

  /**
   * Obtiene las categorías disponibles en el catálogo de ejercicios.
   * Se eliminan categorías vacías y se ordenan alfabéticamente.
   */
  get categoriasEjercicios(): string[] {
    return [
      ...new Set(
        this.catalogoEjercicios
          .map((ejercicio) => this.grupoEjercicio(ejercicio))
      )
    ].sort((a, b) => a.localeCompare(b, 'es'));
  }

  /**
   * Filtra los ejercicios por texto y categoría,
   * y después los agrupa por categoría.
   */
  get ejerciciosAgrupados(): {
    categoria: string;
    ejercicios: any[];
  }[] {
    const termino = this.busquedaEjercicios
      .trim()
      .toLocaleLowerCase('es');

    const filtrados = this.catalogoEjercicios.filter((ejercicio) => {
      const nombre = String(ejercicio.nombre || '')
        .toLocaleLowerCase('es');

      const categoria = this.grupoEjercicio(ejercicio);

      const coincideTexto =
        !termino ||
        nombre.includes(termino) ||
        categoria.toLocaleLowerCase('es').includes(termino);

      const coincideCategoria =
        this.categoriaEjerciciosSeleccionada === 'Todas' ||
        categoria === this.categoriaEjerciciosSeleccionada;

      return coincideTexto && coincideCategoria;
    });

    const grupos = new Map<string, any[]>();

    filtrados.forEach((ejercicio) => {
      const categoria = this.grupoEjercicio(ejercicio);

      if (!grupos.has(categoria)) {
        grupos.set(categoria, []);
      }

      grupos.get(categoria)!.push(ejercicio);
    });

    return Array.from(grupos.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([categoria, ejercicios]) => ({
        categoria,
        ejercicios: [...ejercicios].sort((a, b) =>
          String(a.nombre || '').localeCompare(
            String(b.nombre || ''),
            'es'
          )
        )
      }));
  }

  // ==========================================
  // CATÁLOGOS: AGRUPACIÓN Y DESPLEGABLES (<details>)
  // ==========================================

  /** La tabla catalogo_ejercicios guarda el grupo en la columna `grupo_muscular`. */
  private grupoEjercicio(ejercicio: any): string {
    return (
      String(ejercicio?.grupo_muscular ?? '').trim() ||
      'Sin grupo muscular'
    );
  }

  /** La tabla catalogo_alimentos guarda el grupo en la columna `categoria`. */
  private categoriaAlimento(alimento: any): string {
    return String(alimento?.categoria ?? '').trim() || 'Sin categoría';
  }

  // Búsqueda del catálogo de alimentos (la de ejercicios ya existe arriba).
  busquedaAlimentos = '';

  /** Alimentos filtrados por texto y agrupados por categoría. */
  get catalogoAlimentosAgrupados(): {
    categoria: string;
    alimentos: any[];
  }[] {
    const termino = this.busquedaAlimentos
      .trim()
      .toLocaleLowerCase('es');

    const grupos = new Map<string, any[]>();

    for (const alimento of this.catalogoAlimentos) {
      const categoria = this.categoriaAlimento(alimento);

      const texto = `${alimento.nombre ?? ''} ${categoria}`
        .toLocaleLowerCase('es');

      if (termino && !texto.includes(termino)) continue;

      if (!grupos.has(categoria)) {
        grupos.set(categoria, []);
      }

      grupos.get(categoria)!.push(alimento);
    }

    return Array.from(grupos.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([categoria, alimentos]) => ({
        categoria,
        alimentos: [...alimentos].sort((a, b) =>
          String(a.nombre || '').localeCompare(
            String(b.nombre || ''),
            'es'
          )
        ),
      }));
  }

  /**
   * trackBy: mantiene el mismo elemento del DOM entre ciclos de detección
   * de cambios. Sin esto, Angular recrearía los <details> y se cerrarían.
   */
  trackByCategoria = (_: number, grupo: { categoria: string }) =>
    grupo.categoria;

  trackById = (_: number, item: { id: string }) => item.id;

  // ==========================================
  // CATÁLOGOS: EDICIÓN EN LA MISMA FILA
  // ==========================================

  /** Vacío o una URL que empieza con http:// o https:// */
  private readonly patronUrlOpcional = /^(https?:\/\/\S+)?$/i;

  catalogoEditando: { tipo: 'alimento' | 'ejercicio'; id: string | number } | null = null;

  catalogoEditForm!: FormGroup;

  isSavingCatalogoEdit = false;

  /** Grupos musculares que ya existen (para sugerir en un datalist). */
  get gruposEjerciciosSugeridos(): string[] {
    return [
      ...new Set(
        this.catalogoEjercicios
          .map((e) => String(e?.grupo_muscular ?? '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));
  }

  /** Categorías de alimentos que ya existen (para sugerir en un datalist). */
  get categoriasAlimentosSugeridas(): string[] {
    return [
      ...new Set(
        this.catalogoAlimentos
          .map((a) => String(a?.categoria ?? '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));
  }

  estaEditandoCatalogo(
    tipo: 'alimento' | 'ejercicio',
    id: string | number
  ): boolean {
    return (
      this.catalogoEditando?.tipo === tipo &&
      this.catalogoEditando?.id === id
    );
  }

  iniciarEdicionCatalogo(tipo: 'alimento' | 'ejercicio', item: any) {
    this.catalogoEditando = { tipo, id: item.id };

    this.catalogoEditForm.reset({
      nombre: item.nombre ?? '',
      categoria:
        tipo === 'ejercicio'
          ? item.grupo_muscular ?? ''
          : item.categoria ?? '',
      macronutriente: item.macronutriente || 'Otro',
      video_url: item.video_url ?? '',
    });

    this.cdr.detectChanges();

    // Enfoca el campo "Nombre" de la fila que se acaba de abrir.
    window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>('.catalog-edit-form input')
        ?.focus();
    }, 0);
  }

  cancelarEdicionCatalogo() {
    this.catalogoEditando = null;

    this.catalogoEditForm.reset({ macronutriente: 'Otro' });

    this.cdr.detectChanges();
  }

  async guardarEdicionCatalogo() {
    const edicion = this.catalogoEditando;

    if (!edicion) return;

    const valores = this.catalogoEditForm.value;

    const nombre = String(valores.nombre ?? '').trim();

    if (!nombre || this.catalogoEditForm.invalid) {
      this.catalogoEditForm.markAllAsTouched();

      this.mostrarToast(
        'Revisa el nombre y que el enlace del video empiece con http:// o https://',
        'error'
      );

      return;
    }

    const categoria = String(valores.categoria ?? '').trim();

    const tabla =
      edicion.tipo === 'alimento'
        ? 'catalogo_alimentos'
        : 'catalogo_ejercicios';

    // Se envía '' (y no null) cuando está vacío: es seguro aunque la
    // columna sea NOT NULL.
    const cambios =
      edicion.tipo === 'alimento'
        ? {
            nombre,
            categoria,
            macronutriente: valores.macronutriente || 'Otro',
          }
        : {
            nombre,
            grupo_muscular: categoria,
            video_url: String(valores.video_url ?? '').trim(),
          };

    const supabase =
      (this.authService as any).supabase ||
      (this.authService as any).supabaseClient;

    this.isSavingCatalogoEdit = true;

    this.cdr.detectChanges();

    try {
      // .select() devuelve las filas modificadas. Con RLS, un UPDATE
      // bloqueado NO da error: devuelve 0 filas. Por eso se comprueba.
      const { data, error } = await supabase
        .from(tabla)
        .update(cambios)
        .eq('id', edicion.id)
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error(
          'No se modificó ningún registro. Revisa tus permisos de administrador.'
        );
      }

      this.mostrarToast('Registro actualizado.', 'success');

      this.catalogoEditando = null;

      await this.cargarCatalogos();
    } catch (error: any) {
      this.mostrarToast(
        'No se pudo guardar: ' + (error?.message ?? 'error desconocido'),
        'error'
      );
    } finally {
      this.isSavingCatalogoEdit = false;

      this.cdr.detectChanges();
    }
  }

  /**
   * Al elegir un ejercicio del catálogo en la rutina del paciente, copia su
   * video de referencia. Solo si la fila aún no tiene uno, para no pisar un
   * enlace que el coach haya puesto a mano.
   */
  autocompletarVideoDesdeCatalogo(idxDia: number, idxEjercicio: number) {
    const fila = this.ejerciciosDeDia(idxDia).at(idxEjercicio);

    const nombre = String(fila.get('ejercicio')?.value ?? '')
      .trim()
      .toLocaleLowerCase('es');

    if (!nombre) return;

    const coincidencia = this.catalogoEjercicios.find(
      (e) =>
        String(e?.nombre ?? '').trim().toLocaleLowerCase('es') === nombre
    );

    const url = String(coincidencia?.video_url ?? '').trim();

    const control = fila.get('video_url');

    if (url && control && !String(control.value ?? '').trim()) {
      control.setValue(url);
    }
  }

  catalogoAlimentos: any[] = [];

  catalogoForm!: FormGroup;

  isSavingCatalogo = false;

  catalogoMessage = '';

  // Visor modal para fotografías de testimonios
  fotoSeleccionada: string | null = null;

  tituloFotoSeleccionada = '';

  // VARIABLES PARA EL AUTOCOMPLETADO Y EDICIÓN INLINE CON CATEGORÍAS

  alimentoSearchTerms: { [key: string]: string } = {};

  activeSearchDropdown: string | null = null;

  inlineEditingFoodId: string | null = null;

  isAddingInlineFood = false;

  inlineFoodForm!: FormGroup;

  expandedCategory: string | null = null;

  // CACHÉ INTELIGENTE PARA EVITAR ERRORES DE RENDERIZADO EN ANGULAR

  filteredCatalogCache: {
    [key: string]: { categoria: string; alimentos: any[] }[];
  } = {};

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

  get totalPacientes() {
    return this.pacientes.length;
  }

  get pacientesActivos() {
    return this.pacientes.filter(
      (p) => p.estado_aprobacion === 'aprobado'
    ).length;
  }

  get pendientesRevision() {
    return this.pacientes.filter(
      (p) => p.estado_aprobacion !== 'aprobado'
    ).length;
  }

  ngOnInit() {
    this.initForm();

    this.initBlogForm();

    this.initPackageForm();

    this.initCatalogoForm();

    this.inlineFoodForm = this.fb.group({
      id: [null],
      nombre: ['', Validators.required],
      categoria: [''],
      macronutriente: ['Proteína', Validators.required],
    });

    if (!isPlatformBrowser(this.platformId)) return;

    this.cargarCatalogos();

    window.setTimeout(() => {
      this.cargarPacientes();
    }, 0);

    this.pacientesChannel = this.authService.subscribePacientes(() => {
      if (this.vistaActual === 'lista') this.cargarPacientes();
    });
  }

  ngOnDestroy() {
    if (this.pacientesChannel) {
      this.authService.unsubscribeChannel(this.pacientesChannel);
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (!target.closest('.autocomplete-container')) {
      this.activeSearchDropdown = null;

      this.expandedCategory = null;

      this.cancelarEdicionInline();

      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // LÓGICA DE AUTOCOMPLETADO Y CRUD INLINE
  // ==========================================

  toggleCategory(
    idxComida: number,
    idxAlimento: number,
    categoria: string
  ) {
    const key = `${idxComida}-${idxAlimento}-${categoria}`;

    if (this.expandedCategory === key) {
      this.expandedCategory = null;
    } else {
      this.expandedCategory = key;
    }

    this.cdr.detectChanges();
  }

  isCategoryExpanded(
    idxComida: number,
    idxAlimento: number,
    categoria: string
  ): boolean {
    return (
      this.expandedCategory ===
      `${idxComida}-${idxAlimento}-${categoria}`
    );
  }

  // CREA Y GUARDA LA LISTA DE CATEGORÍAS PARA QUE ANGULAR NO COLAPSE

  actualizarFiltro(idxComida: number, idxAlimento: number) {
    const key = `${idxComida}-${idxAlimento}`;

    const term = (this.alimentoSearchTerms[key] || '')
      .toLowerCase()
      .trim();

    const filtrados = this.catalogoAlimentos.filter((a) => {
      const nombre = a.nombre ? String(a.nombre).toLowerCase() : '';

      const categoria = a.categoria
        ? String(a.categoria).toLowerCase()
        : '';

      return (
        !term ||
        nombre.includes(term) ||
        categoria.includes(term)
      );
    });

    const grupos: { [key: string]: any[] } = {};

    filtrados.forEach((alimento) => {
      const cat = alimento.categoria || 'Sin categoría';

      if (!grupos[cat]) {
        grupos[cat] = [];
      }

      grupos[cat].push(alimento);
    });

    this.filteredCatalogCache[key] = Object.keys(grupos)
      .sort((a, b) => a.localeCompare(b))
      .map((categoria) => ({
        categoria: categoria,
        alimentos: grupos[categoria],
      }));
  }

  // RETORNA LA LISTA CACHEADA PARA UNA UI SÚPER FLUIDA

  getAlimentosAgrupados(
    idxComida: number,
    idxAlimento: number
  ): { categoria: string; alimentos: any[] }[] {
    const key = `${idxComida}-${idxAlimento}`;

    if (!this.filteredCatalogCache[key]) {
      this.actualizarFiltro(idxComida, idxAlimento);
    }

    return this.filteredCatalogCache[key] || [];
  }

  onAlimentoSearch(
    event: any,
    idxComida: number,
    idxAlimento: number
  ) {
    const key = `${idxComida}-${idxAlimento}`;

    this.alimentoSearchTerms[key] = event.target.value;

    this.activeSearchDropdown = key;

    this.cancelarEdicionInline();

    // Al teclear, actualizamos el caché para reflejar los resultados de inmediato
    this.actualizarFiltro(idxComida, idxAlimento);

    this.cdr.detectChanges();
  }

  seleccionarAlimento(
    alimento: any,
    idxComida: number,
    idxAlimento: number
  ) {
    const control = this.alimentosDeComida(idxComida).at(idxAlimento);

    const esOpcion = control.get('esOpcion')?.value;

    const prefijo = esOpcion ? '[Opcion] ' : '';

    control.patchValue({
      descripcion: prefijo + alimento.nombre,
    });

    this.activeSearchDropdown = null;

    this.expandedCategory = null;

    this.cdr.detectChanges();
  }

  iniciarEdicionAlimento(alimento: any) {
    this.isAddingInlineFood = false;

    this.inlineEditingFoodId = alimento.id;

    this.inlineFoodForm.patchValue({
      id: alimento.id,
      nombre: alimento.nombre,
      categoria: alimento.categoria,
      macronutriente: alimento.macronutriente || 'Otro',
    });
  }

  iniciarNuevoAlimentoInline() {
    this.inlineEditingFoodId = null;

    this.isAddingInlineFood = true;

    this.inlineFoodForm.reset({
      id: null,
      macronutriente: 'Proteína',
    });
  }

  cancelarEdicionInline() {
    this.inlineEditingFoodId = null;

    this.isAddingInlineFood = false;

    this.inlineFoodForm.reset();
  }

  async guardarAlimentoInline() {
    if (this.inlineFoodForm.invalid) {
      this.inlineFoodForm.markAllAsTouched();

      return;
    }

    const {
      id,
      nombre,
      categoria,
      macronutriente,
    } = this.inlineFoodForm.value;

    const supabase =
      (this.authService as any).supabase ||
      (this.authService as any).supabaseClient;

    try {
      if (id) {
        const { error } = await supabase
          .from('catalogo_alimentos')
          .update({ nombre, categoria, macronutriente })
          .eq('id', id);

        if (error) throw error;

        this.mostrarToast('Alimento actualizado', 'success');
      } else {
        const { error } = await supabase
          .from('catalogo_alimentos')
          .insert([{ nombre, categoria, macronutriente }]);

        if (error) throw error;

        this.mostrarToast('Alimento agregado', 'success');
      }

      await this.cargarCatalogos();

      this.cancelarEdicionInline();
    } catch (error: any) {
      this.mostrarToast(
        'Error al guardar: ' + error.message,
        'error'
      );
    }
  }

  // ==========================================
  // INICIALIZACIÓN DE FORMULARIOS
  // ==========================================

  private initForm() {
    this.planForm = this.fb.group({
      calorias_totales: [''],
      suplementacion: [''],
      medicacion: [''],
      comidas: this.fb.array([]),
      notas_entrenamiento: [''],
      dias_entrenamiento: this.fb.array([]),
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

  private initPackageForm(servicePackage?: ServicePackage) {
    const current =
      servicePackage ??
      this.servicePackagesService.createEmptyPackage();

    this.selectedPackage = servicePackage ?? null;

    this.packageForm = this.fb.group({
      id: [current.id],
      title: [current.title, Validators.required],
      subtitle: [current.subtitle, Validators.required],
      description: [current.description, Validators.required],
      imageUrl: [current.imageUrl],
      badge: [current.badge],
      includesText: [
        (current.includes ?? []).join('\n'),
        Validators.required,
      ],
      ctaLabel: [current.ctaLabel || 'Cotizar paquete'],
      featured: [current.featured ?? false],
      published: [current.published ?? false],
      sortOrder: [current.sortOrder || 1],
    });
  }

  private initCatalogoForm() {
    this.catalogoForm = this.fb.group({
      tipo: ['alimento', Validators.required],
      categoria: [''],
      nombre: ['', Validators.required],
      macronutriente: [''],
      video_url: ['', Validators.pattern(this.patronUrlOpcional)],
    });

    // Formulario propio de la edición en fila del catálogo.
    // No se reutiliza inlineFoodForm: lo usa el autocompletado de dietas
    // y onClickOutside() lo cancela con cualquier clic externo.
    this.catalogoEditForm = this.fb.group({
      nombre: ['', Validators.required],
      categoria: [''],
      macronutriente: ['Otro'],
      video_url: ['', Validators.pattern(this.patronUrlOpcional)],
    });
  }

  setAdminSection(
    section:
      | 'patients'
      | 'blog'
      | 'packages'
      | 'catalogs'
      | 'testimonials'
  ) {
    this.adminSection = section;

    if (section === 'blog' && this.blogPosts.length === 0) {
      this.cargarBlogPosts();
    }

    if (
      section === 'packages' &&
      this.servicePackages.length === 0
    ) {
      this.cargarPaquetes();
    }

    if (
      section === 'catalogs' &&
      this.catalogoAlimentos.length === 0
    ) {
      this.cargarCatalogos();
    }

    if (section === 'testimonials') {
      this.cargarTestimonios();
    }

    this.cdr.detectChanges();
  }

  setSeccionEditor(
    seccion: 'evaluacion' | 'nutrition' | 'training' | 'tecnica'
  ) {
    this.seccionEditor = seccion;

    this.cdr.detectChanges();
  }

  // ==========================================
  // CATÁLOGOS
  // ==========================================

  async cargarCatalogos() {
    try {
      const supabase =
        (this.authService as any).supabase ||
        (this.authService as any).supabaseClient;

      if (!supabase) return;

      const [ejerciciosRes, alimentosRes] = await Promise.all([
        supabase
          .from('catalogo_ejercicios')
          .select('*')
          .order('nombre'),

        supabase
          .from('catalogo_alimentos')
          .select('*')
          .order('categoria')
          .order('nombre'),
      ]);

      if (ejerciciosRes.data) {
        this.catalogoEjercicios = ejerciciosRes.data;
      }

      if (alimentosRes.data) {
        this.catalogoAlimentos = alimentosRes.data;

        // Limpiamos el caché para que se recalcule con los nuevos datos.
        this.filteredCatalogCache = {};
      }
    } catch (error) {
      console.error('Error cargando catálogos:', error);
    }
  }

  async guardarItemCatalogo() {
    if (this.catalogoForm.invalid) {
      this.catalogoForm.markAllAsTouched();

      return;
    }

    this.isSavingCatalogo = true;

    this.catalogoMessage = '';

    this.cdr.detectChanges();

    const {
      tipo,
      categoria,
      nombre,
      macronutriente,
      video_url,
    } = this.catalogoForm.value;

    const supabase =
      (this.authService as any).supabase ||
      (this.authService as any).supabaseClient;

    try {
      if (tipo === 'alimento') {
        const { error } = await supabase
          .from('catalogo_alimentos')
          .insert([
            {
              categoria,
              nombre,
              macronutriente: macronutriente || 'Otro',
            },
          ]);

        if (error) throw error;

        this.catalogoMessage = '¡Alimento guardado con éxito!';
      } else if (tipo === 'ejercicio') {
        const { error } = await supabase
          .from('catalogo_ejercicios')
          .insert([
            {
              nombre,
              grupo_muscular: String(categoria ?? '').trim(),
              video_url: String(video_url ?? '').trim(),
            },
          ]);

        if (error) throw error;

        this.catalogoMessage = '¡Ejercicio guardado con éxito!';
      }

      await this.cargarCatalogos();

      this.catalogoForm.get('nombre')?.reset();

      this.catalogoForm.get('video_url')?.reset('');
    } catch (error: any) {
      this.catalogoMessage = `Error al guardar: ${error.message}`;
    } finally {
      this.isSavingCatalogo = false;

      this.cdr.detectChanges();
    }
  }

  async eliminarItemCatalogo(
    id: string,
    nombre: string,
    tipo: 'alimento' | 'ejercicio'
  ) {
    const confirmed = globalThis.confirm(
      `¿Seguro que deseas eliminar "${nombre}" del catálogo?`
    );

    if (!confirmed) return;

    const supabase =
      (this.authService as any).supabase ||
      (this.authService as any).supabaseClient;

    const tabla =
      tipo === 'alimento'
        ? 'catalogo_alimentos'
        : 'catalogo_ejercicios';

    try {
      const { error } = await supabase
        .from(tabla)
        .delete()
        .eq('id', id);

      if (error) throw error;

      this.mostrarToast(
        'Elemento eliminado correctamente.',
        'success'
      );

      await this.cargarCatalogos();
    } catch (error: any) {
      console.error('Error eliminando del catálogo:', error);

      this.mostrarToast(
        'Hubo un error al eliminar el elemento.',
        'error'
      );
    }
  }

  // ==========================================
  // PACIENTES
  // ==========================================

  async cargarPacientes() {
    this.isLoadingPacientes = true;

    this.pacientesError = '';

    this.cdr.detectChanges();

    try {
      this.pacientes = await this.authService.getPacientes();
    } catch (error) {
      this.pacientesError = this.getErrorMessage(
        error,
        'No se pudieron cargar los pacientes.'
      );
    } finally {
      this.isLoadingPacientes = false;

      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // BLOG
  // ==========================================

  async cargarBlogPosts() {
    this.isLoadingBlog = true;

    this.blogError = '';

    this.blogMessage = '';

    this.cdr.detectChanges();

    try {
      this.blogPosts = await this.blogService.getAdminPosts();
    } catch (error) {
      this.blogError = this.getErrorMessage(
        error,
        'No se pudieron cargar los artículos.'
      );
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

      this.blogError =
        'Completa título, resumen, contenido, categoría y tiempo de lectura.';

      return;
    }

    this.isSavingBlog = true;

    this.blogError = '';

    this.blogMessage = '';

    this.cdr.detectChanges();

    try {
      const payload = {
        ...this.blogForm.value,
        published:
          typeof publicar === 'boolean'
            ? publicar
            : this.blogForm.value.published,
      };

      const saved = await this.blogService.savePost(payload);

      this.blogMessage = saved.published
        ? 'Artículo publicado y visible en el blog.'
        : 'Borrador guardado.';

      this.initBlogForm(saved);

      await this.cargarBlogPosts();
    } catch (error) {
      this.blogError = this.getErrorMessage(
        error,
        'No se pudo guardar el artículo.'
      );
    } finally {
      this.isSavingBlog = false;

      this.cdr.detectChanges();
    }
  }

  async toggleBlogPublication(post: BlogPost) {
    await this.blogService.savePost({
      ...post,
      published: !post.published,
    });

    await this.cargarBlogPosts();
  }

  async eliminarBlogPost(post: BlogPost) {
    const confirmed = globalThis.confirm(
      `Eliminar "${post.title}" del blog?`
    );

    if (!confirmed) return;

    await this.blogService.deletePost(post.id);

    if (this.blogForm?.value?.id === post.id) {
      this.nuevoBlogPost();
    }

    await this.cargarBlogPosts();
  }

  // ==========================================
  // PAQUETES DE SERVICIOS
  // ==========================================

  async cargarPaquetes() {
    this.isLoadingPackages = true;

    this.packageError = '';

    this.packageMessage = '';

    this.cdr.detectChanges();

    try {
      this.servicePackages =
        await this.servicePackagesService.getAdminPackages();
    } catch (error) {
      this.packageError = this.getErrorMessage(
        error,
        'No se pudieron cargar los paquetes.'
      );
    } finally {
      this.isLoadingPackages = false;

      this.cdr.detectChanges();
    }
  }

  nuevoPaquete() {
    this.packageMessage = '';

    this.packageError = '';

    this.initPackageForm();

    this.cdr.detectChanges();
  }

  editarPaquete(servicePackage: ServicePackage) {
    this.packageMessage = '';

    this.packageError = '';

    this.initPackageForm(servicePackage);

    this.cdr.detectChanges();
  }

  async guardarPaquete(publicar?: boolean) {
    if (this.packageForm.invalid) {
      this.packageForm.markAllAsTouched();

      this.packageError =
        'Completa título, subtítulo, descripción y lo que incluye el paquete.';

      return;
    }

    this.isSavingPackage = true;

    this.packageError = '';

    this.packageMessage = '';

    this.cdr.detectChanges();

    try {
      const value = this.packageForm.value;

      const saved = await this.servicePackagesService.savePackage({
        id: value.id,
        title: value.title,
        subtitle: value.subtitle,
        description: value.description,
        imageUrl: value.imageUrl,
        badge: value.badge,
        includes: value.includesText,
        ctaLabel: value.ctaLabel,
        featured: value.featured,
        published:
          typeof publicar === 'boolean'
            ? publicar
            : value.published,
        sortOrder: value.sortOrder,
      });

      this.packageMessage = saved.published
        ? 'Paquete publicado en servicios.'
        : 'Paquete guardado como borrador.';

      this.initPackageForm(saved);

      await this.cargarPaquetes();
    } catch (error) {
      this.packageError = this.getErrorMessage(
        error,
        'No se pudo guardar el paquete.'
      );
    } finally {
      this.isSavingPackage = false;

      this.cdr.detectChanges();
    }
  }

  async togglePackagePublication(servicePackage: ServicePackage) {
    await this.servicePackagesService.savePackage({
      ...servicePackage,
      published: !servicePackage.published,
    });

    await this.cargarPaquetes();
  }

  async eliminarPaquete(servicePackage: ServicePackage) {
    const confirmed = globalThis.confirm(
      `Eliminar "${servicePackage.title}" de paquetes?`
    );

    if (!confirmed) return;

    await this.servicePackagesService.deletePackage(
      servicePackage.id
    );

    if (this.packageForm?.value?.id === servicePackage.id) {
      this.nuevoPaquete();
    }

    await this.cargarPaquetes();
  }

  // ==========================================
  // EXPEDIENTE CLÍNICO
  // ==========================================

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
      const [
        planRes,
        rutinaRes,
        expRes,
        videosRes,
      ] = await Promise.allSettled([
        this.withTimeout(
          this.planNutricionalService.getPlanPaciente(paciente.id),
          'La carga del plan de alimentación tardó demasiado.'
        ),

        this.withTimeout(
          this.entrenamientoService.getRutinaPaciente(paciente.id),
          'La carga de rutina tardó demasiado.'
        ),

        this.withTimeout(
          this.authService.getExpedienteClinico(paciente.id),
          'La carga del expediente tardó demasiado.'
        ),

        this.withTimeout(
          this.entrenamientoService.getRevisionesTecnica(paciente.id),
          'La carga de videos tardó demasiado.'
        ),
      ]);

      if (expRes.status === 'fulfilled' && expRes.value) {
        this.expedienteClinico = expRes.value;
      } else {
        this.expedienteError =
          'No se encontró entrevista de Onboarding.';
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
              (c.alimentos_comida || []).map((a: any) => {
                const descripcionOriginal = String(
                  a.descripcion || ''
                );

                const esOpcionValue =
                  /^\s*\[?\s*opci[oó]n\s*\]?\s*:?\s*/i.test(
                    descripcionOriginal
                  );

                const descLimpia = esOpcionValue
                  ? descripcionOriginal
                      .replace(
                        /^\s*\[?\s*opci[oó]n\s*\]?\s*:?\s*/i,
                        ''
                      )
                      .trim()
                  : descripcionOriginal;

                return this.fb.group({
                  descripcion: [
                    descLimpia || '',
                    Validators.required,
                  ],
                  calorias: [a.calorias || 0],
                  proteinas: [a.proteinas || 0],
                  carbos: [a.carbos || 0],
                  grasas: [a.grasas || 0],
                  esOpcion: [esOpcionValue],
                });
              })
            ),
          });

          this.comidas.push(comidaGroup);
        });
      } else if (planRes.status === 'rejected') {
        this.planEditorError = this.getErrorMessage(
          planRes.reason,
          'No se pudo cargar el plan anterior.'
        );
      }

      if (rutinaRes.status === 'fulfilled' && rutinaRes.value) {
        const rutinaExistente = rutinaRes.value;

        this.planForm.patchValue({
          notas_entrenamiento:
            rutinaExistente.notas_entrenamiento || '',
        });

        const diasDb = rutinaExistente.dias_entrenamiento || [];

        diasDb.forEach((d: any) => {
          const diaGroup = this.fb.group({
            titulo: [d.titulo || '', Validators.required],

            ejercicios: this.fb.array(
              (d.ejercicios || []).map((e: any) =>
                this.fb.group({
                  ejercicio: [
                    e.ejercicio || '',
                    Validators.required,
                  ],
                  series: [
                    e.series || 4,
                    [Validators.required, Validators.min(1)],
                  ],
                  reps: [e.reps || '10-12', Validators.required],
                  carga_objetivo: [e.carga_objetivo || ''],
                  video_url: [e.video_url || ''],
                })
              )
            ),
          });

          this.diasEntrenamiento.push(diaGroup);
        });
      } else if (rutinaRes.status === 'rejected') {
        this.planEditorError = this.getErrorMessage(
          rutinaRes.reason,
          'No se pudo cargar la rutina anterior.'
        );
      }

      if (videosRes.status === 'fulfilled' && videosRes.value) {
        this.videosTecnica = videosRes.value;
      } else {
        this.videosTecnica = [];
      }
    } catch (error) {
      console.error('Error general abriendo expediente:', error);

      this.planEditorError =
        'Error al construir el formulario del paciente.';
    } finally {
      this.isLoadingExpediente = false;

      this.cdr.detectChanges();
    }
  }

  async guardarPlan() {
    if (this.planForm.invalid || !this.pacienteSeleccionado?.id) {
      this.planForm.markAllAsTouched();

      this.mostrarToast(
        'Revisa los formularios: hay campos obligatorios pendientes.',
        'error'
      );

      return;
    }

    this.isSavingPlan = true;

    this.planEditorError = '';

    this.cdr.detectChanges();

    try {
      const tareas: Promise<void>[] = [];

      if (this.tieneComidasConAlimentos()) {
        const planDataRaw = JSON.parse(
          JSON.stringify(this.planForm.value)
        );

        if (planDataRaw.comidas) {
          planDataRaw.comidas.forEach((comida: any) => {
            if (comida.alimentos_comida) {
              comida.alimentos_comida.forEach((alimento: any) => {
                if (alimento.esOpcion) {
                  alimento.descripcion =
                    `[Opcion] ${alimento.descripcion}`;
                }
              });
            }
          });
        }

        tareas.push(
          this.planNutricionalService.guardarPlanCompleto(
            this.pacienteSeleccionado.id,
            planDataRaw
          )
        );
      }

      if (this.tieneRutinaConEjercicios()) {
        tareas.push(
          this.entrenamientoService.guardarRutinaCompleta(
            this.pacienteSeleccionado.id,
            this.planForm.value
          )
        );
      }

      if (tareas.length === 0) {
        this.mostrarToast(
          'Agrega al menos una comida con alimento o un día de entrenamiento con ejercicios.',
          'error'
        );

        return;
      }

      await Promise.all(tareas);

      this.mostrarToast('Plan guardado correctamente.', 'success');

      void this.volverAlPanel().catch((error) => {
        console.error('Error actualizando el directorio:', error);

        this.pacientesError = this.getErrorMessage(
          error,
          'El plan se guardó, pero no se pudo actualizar el directorio.'
        );

        this.cdr.detectChanges();
      });
    } catch (error: any) {
      const message =
        `Error al guardar: ${error.message || 'Error desconocido'}`;

      this.planEditorError = message;

      this.mostrarToast(message, 'error');
    } finally {
      this.isSavingPlan = false;

      this.cdr.detectChanges();
    }
  }

  async enviarFeedback(video: any) {
    if (!video.feedback_coach?.trim()) {
      this.mostrarToast(
        'Por favor, escribe un comentario antes de enviar el feedback.'
      );

      return;
    }

    this.isSavingFeedback = true;

    this.cdr.detectChanges();

    try {
      await this.entrenamientoService.actualizarFeedbackTecnica(
        video.id,
        video.feedback_coach
      );

      video.estado = 'Revisado';

      this.mostrarToast(
        'Feedback guardado y notificado al paciente.'
      );
    } catch (error) {
      this.mostrarToast(
        'Error al guardar el feedback. Intenta de nuevo.'
      );
    } finally {
      this.isSavingFeedback = false;

      this.cdr.detectChanges();
    }
  }

  get comidas() {
    return this.planForm.get('comidas') as FormArray;
  }

  alimentosDeComida(idx: number) {
    return this.comidas.at(idx).get('alimentos_comida') as FormArray;
  }

  agregarComida() {
    this.comidas.push(
      this.fb.group({
        nombre: ['', Validators.required],
        nota_comida: [''],
        alimentos_comida: this.fb.array([]),
      })
    );

    this.cdr.detectChanges();
  }

  agregarAlimentoFijo(idx: number) {
    this.alimentosDeComida(idx).push(
      this.fb.group({
        descripcion: ['', Validators.required],
        calorias: [0],
        proteinas: [0],
        carbos: [0],
        grasas: [0],
        esOpcion: [false],
      })
    );

    this.cdr.detectChanges();
  }

  agregarOpcionIntercambiable(idx: number) {
    this.alimentosDeComida(idx).push(
      this.fb.group({
        descripcion: ['', Validators.required],
        calorias: [0],
        proteinas: [0],
        carbos: [0],
        grasas: [0],
        esOpcion: [true],
      })
    );

    this.cdr.detectChanges();
  }

  get diasEntrenamiento() {
    return this.planForm.get('dias_entrenamiento') as FormArray;
  }

  ejerciciosDeDia(idx: number) {
    return this.diasEntrenamiento.at(idx).get('ejercicios') as FormArray;
  }

  selectTrainingEditorDay(index: number) {
    this.activeTrainingEditorDay = index;

    this.cdr.detectChanges();
  }

  agregarDia() {
    this.diasEntrenamiento.push(
      this.fb.group({
        titulo: ['', Validators.required],
        ejercicios: this.fb.array([]),
      })
    );

    this.activeTrainingEditorDay =
      this.diasEntrenamiento.length - 1;

    this.cdr.detectChanges();
  }

  agregarEjercicio(idx: number) {
    this.ejerciciosDeDia(idx).push(
      this.fb.group({
        ejercicio: ['', Validators.required],
        series: [
          4,
          [Validators.required, Validators.min(1)],
        ],
        reps: ['10-12', Validators.required],
        carga_objetivo: [''],
        video_url: [''],
      })
    );

    this.cdr.detectChanges();
  }

  eliminarDia(i: number) {
    this.diasEntrenamiento.removeAt(i);

    this.activeTrainingEditorDay = Math.max(
      0,
      Math.min(
        this.activeTrainingEditorDay,
        this.diasEntrenamiento.length - 1
      )
    );

    this.cdr.detectChanges();
  }

  eliminarEjercicio(i: number, j: number) {
    this.ejerciciosDeDia(i).removeAt(j);

    this.cdr.detectChanges();
  }

  async toggleEstado(paciente: any, event: Event) {
    event.stopPropagation();

    const original = paciente.estado_aprobacion;

    paciente.estado_aprobacion =
      original === 'aprobado' ? 'pendiente' : 'aprobado';

    try {
      await this.authService.actualizarEstadoPaciente(
        paciente.id,
        paciente.estado_aprobacion
      );
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

  eliminarComida(i: number) {
    this.comidas.removeAt(i);

    this.cdr.detectChanges();
  }

  eliminarAlimento(i: number, j: number) {
    this.alimentosDeComida(i).removeAt(j);

    this.cdr.detectChanges();
  }

  tieneComidasConAlimentos(): boolean {
    return this.comidas.controls.some(
      (c, i) =>
        c.get('nombre')?.value &&
        this.alimentosDeComida(i).length > 0
    );
  }

  tieneRutinaConEjercicios(): boolean {
    return this.diasEntrenamiento.controls.some((dia, i) => {
      const titulo = String(
        dia.get('titulo')?.value ?? ''
      ).trim();

      const tieneEjercicios =
        this.ejerciciosDeDia(i).controls.some(
          (ej) =>
            String(ej.get('ejercicio')?.value ?? '').trim()
              .length > 0
        );

      return titulo.length > 0 || tieneEjercicios;
    });
  }

  calcularCaloriasBase(paciente: any): number | string {
    if (
      !paciente?.peso_kg ||
      !paciente?.altura_cm ||
      !paciente?.edad ||
      !paciente?.genero
    ) {
      return 'Datos pendientes';
    }

    const peso = parseFloat(paciente.peso_kg);

    const altura = parseFloat(paciente.altura_cm);

    const edad = parseInt(paciente.edad, 10);

    const tmb =
      paciente.genero === 'Hombre'
        ? 10 * peso + 6.25 * altura - 5 * edad + 5
        : 10 * peso + 6.25 * altura - 5 * edad - 161;

    return Math.round(tmb);
  }

  getPacienteIniciales(p: any): string {
    const n = p?.nombre_completo || p?.email || 'P';

    return n
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((x: any) => x[0])
      .join('')
      .toUpperCase();
  }

  getPacienteObjetivo(p: any) {
    return p?.peso_objetivo || p?.objetivo || 'Pendiente';
  }

  formatRespuesta(val: any): string {
    if (!val) return 'Sin respuesta';

    if (typeof val === 'object') {
      const e = Object.entries(val)
        .filter(
          ([, v]) =>
            v === true ||
            (typeof v === 'string' && v.trim().length > 0)
        )
        .map(([k, v]) =>
          v === true
            ? this.getRespuestaLabel(k)
            : `${this.getRespuestaLabel(k)}: ${v}`
        );

      return e.length > 0 ? e.join(', ') : 'Sin datos';
    }

    return String(val);
  }

  getRespuestaLabel(key: any): string {
    return (
      this.formLabels[String(key)] ??
      String(key)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  private getErrorMessage(e: any, f: string) {
    return e?.message ? `${f} ${e.message}` : f;
  }

  private withTimeout<T>(
    request: Promise<T>,
    message: string,
    timeoutMs = 10000
  ): Promise<T> {
    return Promise.race([
      request,

      new Promise<T>((_, reject) => {
        globalThis.setTimeout(
          () => reject(new Error(message)),
          timeoutMs
        );
      }),
    ]);
  }

  mostrarToast(
    mensaje: string,
    tipo: 'success' | 'error' | 'info' = 'info'
  ) {
    this.toastMessage = mensaje;

    this.toastType = tipo;

    this.showToast = true;

    this.cdr.detectChanges();

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = setTimeout(() => {
      this.showToast = false;

      this.cdr.detectChanges();
    }, 3500);
  }

  cerrarToast() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.showToast = false;

    this.cdr.detectChanges();
  }

  // ==========================================
  // MODERACIÓN DE TESTIMONIOS
  // ==========================================

  async cargarTestimonios(): Promise<void> {
    this.isLoadingTestimonios = true;

    this.testimoniosError = '';

    this.testimoniosMessage = '';

    this.cdr.detectChanges();

    try {
      const diagnostico = await this.authService.diagnosticarAdmin();

      console.log('[Diagnóstico admin]', diagnostico);

      this.testimonios =
        await this.authService.getTestimoniosModeracion();

      console.log(
        '[Diagnóstico testimonios] Cantidad recibida:',
        this.testimonios.length
      );

      console.log(
        '[Diagnóstico testimonios] Datos:',
        this.testimonios
      );
    } catch (error: any) {
      console.error('[Diagnóstico testimonios] Error:', error);

      this.testimoniosError = this.getErrorMessage(
        error,
        'No se pudieron cargar los testimonios.'
      );
    } finally {
      this.isLoadingTestimonios = false;

      this.cdr.detectChanges();
    }
  }

  async moderarTestimonio(
    testimonio: any,
    estado: 'aprobado' | 'rechazado'
  ): Promise<void> {
    if (!testimonio?.id) {
      this.testimoniosError =
        'El testimonio no tiene un identificador válido.';

      return;
    }

    const accion = estado === 'aprobado' ? 'aprobar' : 'rechazar';

    const confirmado = globalThis.confirm(
      `¿Seguro que deseas ${accion} este testimonio?`
    );

    if (!confirmado) return;

    this.testimoniosError = '';

    this.testimoniosMessage = '';

    this.cdr.detectChanges();

    try {
      await this.authService.moderarTestimonio(
        testimonio.id,
        estado
      );

      this.testimoniosMessage =
        estado === 'aprobado'
          ? 'El testimonio fue aprobado.'
          : 'El testimonio fue rechazado.';

      await this.cargarTestimonios();
    } catch (error: any) {
      this.testimoniosError = this.getErrorMessage(
        error,
        'No se pudo actualizar el estado del testimonio.'
      );
    } finally {
      this.cdr.detectChanges();
    }
  }
}