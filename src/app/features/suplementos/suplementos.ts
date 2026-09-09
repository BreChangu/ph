import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';

type Supplement = {
  name: string;
  category: string;
  segment: string; 
  highlight: string;
  description: string;
  tag: string;
  rating: number;
  quote: string;
  form: 'tub' | 'pouch' | 'bottle';
  image: string;
  longDescription: string;
  ingredients: string[];
};

type HeroSlide = {
  eyebrow: string;
  title: string;
  copy: string;
  feature: string;
  product: Supplement;
};

@Component({
  selector: 'app-suplementos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './suplementos.html',
  styleUrl: './suplementos.scss',
})
export class Suplementos implements OnInit, OnDestroy {
  vistaActual: 'categorias' | 'catalogo' = 'categorias';
  
  // Variables del Hero
  activeHero = 0;
  isAutoPaused = false;
  private heroTimer?: ReturnType<typeof setInterval>;

  // Panel Lateral
  isDrawerOpen = false;
  selectedSupplement: Supplement | null = null;

  // Filtros y Paginación del Catálogo
  activeSegment = 'Todos';
  currentPage = 1;
  itemsPerPage = 8; // Muestra 2 filas de 4 productos

  categoryCovers = [
    { name: 'Proteínas', subtitle: 'Aislados, concentrados y blends', image: '/images/proteinas/pro_bum_pan_muerto.png' },
    { name: 'Pre Entrenos', subtitle: 'Energía, enfoque y bombeo', image: '/images/preentrenos/pre_maniac_watermelon.png' },
    { name: 'Creatinas', subtitle: 'Fuerza y potencia celular', image: '/images/creatinas/crea_dragon_mono.png' },
    { name: 'Bienestar', subtitle: 'Omegas, vitaminas y salud', image: '/images/bienestar/ashwagandha_1.png' }
  ];

  // Catálogo completo de pH Team
  supplements: Supplement[] = [
    {
      name: 'Proteína Best Protein',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: '',
      description: 'Aislado de rápida absorción.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'bottle',
      image: '/images/proteinas/pro_best_protein.png',
      longDescription: 'Formulada por Chris Bumstead, esta proteína aislada ofrece un perfil de aminoácidos excepcional con mínimo contenido de lactosa y grasas. Su digestión ultra-rápida la convierte en la opción ideal para iniciar la recuperación muscular inmediatamente después de una sesión de hipertrofia severa.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop', 'Cero azúcares añadidos']
    },
    {
      name: 'Proteína BUM CHOCOLATE',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_bum_chocolate.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },
       {
      name: 'Proteína BUM PAN DE MUERTO',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_bum_pan_muerto.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína WHEY ELITE',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_elite_whey.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína GHOST LEGEND',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_ghost_legend_all_straw.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína GHOST LEGEND_all',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_ghost_legend_all.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína Whey CBUM 2KG',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_ghost_whey_canela.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína Whey CBUM 2KG',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_ghost_whey.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína Whey CBUM 2KG',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_gold_standard_whey.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína Whey CBUM 2KG',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_isoject_prote.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína Whey CBUM 2KG',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_nitro_tech.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },   {
      name: 'Proteína Whey CBUM 2KG',
      category: 'Recuperación',
      segment: 'Proteínas',
      highlight: 'Ahorro',
      description: 'Formato doble para mayor rendimiento.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'pouch',
      image: '/images/proteinas/pro_bum_pan_muerto.png',
      longDescription: 'El mismo aislado premium de CBUM en formato de 2kg. Ideal para atletas en fase de volumen o preparaciones largas donde el consumo de proteína es alto y constante.',
      ingredients: ['Proteína de Suero Aislada 100%', '25g de Proteína por scoop']
    },
    {
      name: 'Creatina Monohidratada',
      category: 'Fuerza',
      segment: 'Creatinas',
      highlight: 'Esencial',
      description: 'Mayor respaldo científico para fuerza.',
      tag: 'Uso diario',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/creatinas/crea_dragon_mono.png',
      longDescription: 'El estándar de oro en la suplementación. La creatina monohidratada satura los depósitos intramusculares de fosfocreatina, permitiéndote exprimir 1 o 2 repeticiones extra en series de alta intensidad.',
      ingredients: ['Creatina Monohidratada Pura', '5g por porción']
    },
     {
      name: 'Creatina Monohidratada',
      category: 'Fuerza',
      segment: 'Creatinas',
      highlight: 'Esencial',
      description: 'Mayor respaldo científico para fuerza.',
      tag: 'Uso diario',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/creatinas/crea_evo_mono.png',
      longDescription: 'El estándar de oro en la suplementación. La creatina monohidratada satura los depósitos intramusculares de fosfocreatina, permitiéndote exprimir 1 o 2 repeticiones extra en series de alta intensidad.',
      ingredients: ['Creatina Monohidratada Pura', '5g por porción']
    },
     {
      name: 'Creatina Monohidratada',
      category: 'Fuerza',
      segment: 'Creatinas',
      highlight: 'Esencial',
      description: 'Mayor respaldo científico para fuerza.',
      tag: 'Uso diario',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/creatinas/crea_gat_essentials.png',
      longDescription: 'El estándar de oro en la suplementación. La creatina monohidratada satura los depósitos intramusculares de fosfocreatina, permitiéndote exprimir 1 o 2 repeticiones extra en series de alta intensidad.',
      ingredients: ['Creatina Monohidratada Pura', '5g por porción']
    },
     {
      name: 'Creatina Monohidratada',
      category: 'Fuerza',
      segment: 'Creatinas',
      highlight: 'Esencial',
      description: 'Mayor respaldo científico para fuerza.',
      tag: 'Uso diario',
      rating: 5,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/creatinas/crea_gmp_mono.png',
      longDescription: 'El estándar de oro en la suplementación. La creatina monohidratada satura los depósitos intramusculares de fosfocreatina, permitiéndote exprimir 1 o 2 repeticiones extra en series de alta intensidad.',
      ingredients: ['Creatina Monohidratada Pura', '5g por porción']
    },

    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_maniac_apple.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_maniac_watermelon.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_bum_guava.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_bum_jamaica.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_bum_orange.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_bum_red_white.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_bum_tropical_punch.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords de a madres, no venimos a hacer mmdas venimos a ponernos mmdos. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_bum_watermelon.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_super_bump_blood_orange.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
     {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_super_bump_orange_guts.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },

    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_venom__inferno.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_venom__mora.png',
      longDescription: 'Diseñado para los días de hueva alv donde no quieres ir al pinche gym, date un pasón y esto te da la energía necesaria ALV donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },

     {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_venom_fresa_kiwi.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },

       {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_venom_mango.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },

       {
      name: 'Pre Entreno Estimulante',
      category: 'Energía',
      segment: 'Pre Entrenos',
      highlight: 'Alto Impacto',
      description: 'Máxima intensidad y enfoque mental.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Solicitar Cotización',
      form: 'tub',
      image: '/images/preentrenos/pre_work_venom_pinapple.png',
      longDescription: 'Diseñado para los días donde necesitas romper récords. Esta matriz combina dosis clínicas de citrulina para maximizar el flujo sanguíneo con un perfil agresivo de estimulantes.',
      ingredients: ['Citrulina Malato (6g)', 'Cafeína Anhidra (300mg)', 'Beta Alanina']
    },
    
    
  ];

  heroSlides: HeroSlide[] = [
    {
      eyebrow: 'Suplementacion deportiva',
      title: 'El stack correcto depende de tu objetivo',
      copy: 'Curamos opciones populares del mercado y las aterrizamos a tu entrenamiento, tolerancia y disponibilidad.',
      feature: 'Cotizacion segun disponibilidad',
      product: this.supplements[0],
    },
    {
      eyebrow: 'Compra inteligente',
      title: 'Compara categorias antes de elegir marca',
      copy: 'Creatina, proteina, electrolitos y pre entrenos pueden tener lugar, pero no todos son necesarios para todos.',
      feature: 'Seleccion por objetivo',
      product: this.supplements[2],
    },
  ];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.startAutoScroll();
  }

  ngOnDestroy() {
    this.stopAutoScroll();
  }

  // ==========================================
  // NAVEGACIÓN Y PAGINACIÓN
  // ==========================================
  
  get filteredSupplements(): Supplement[] {
    return this.supplements.filter(s => s.segment === this.activeSegment);
  }

  // Nuevo: Array recortado para la página actual
  get paginatedSupplements(): Supplement[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredSupplements.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredSupplements.length / this.itemsPerPage);
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  abrirCategoria(categoria: string) {
    this.activeSegment = categoria;
    this.vistaActual = 'catalogo';
    this.currentPage = 1; // Reinicia a la página 1 al cambiar de categoría
    this.cdr.markForCheck();
  }

  volverCategorias() {
    this.vistaActual = 'categorias';
    this.activeSegment = 'Todos';
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.scrollToTopCatalog();
    this.cdr.markForCheck();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.scrollToTopCatalog();
      this.cdr.markForCheck();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.scrollToTopCatalog();
      this.cdr.markForCheck();
    }
  }

  // Suaviza la experiencia subiendo al inicio del grid al cambiar de página
  private scrollToTopCatalog() {
    const section = document.querySelector('.catalog-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ==========================================
  // LÓGICA DEL HERO Y PANEL LATERAL
  // ==========================================
  
  get activeSlide(): HeroSlide { return this.heroSlides[this.activeHero]; }

  setHero(index: number) {
    this.activeHero = this.normalizeIndex(index, this.heroSlides.length);
    this.pauseBriefly();
  }

  nextHero() { this.setHero(this.activeHero + 1); }
  previousHero() { this.setHero(this.activeHero - 1); }

  private startAutoScroll() {
    this.heroTimer = setInterval(() => {
      if (!this.isDrawerOpen && !this.isAutoPaused) {
        this.activeHero = this.normalizeIndex(this.activeHero + 1, this.heroSlides.length);
        this.cdr.markForCheck(); 
      }
    }, 5000); 
  }

  private stopAutoScroll() { if (this.heroTimer) clearInterval(this.heroTimer); }
  private pauseBriefly() { this.isAutoPaused = true; setTimeout(() => { this.isAutoPaused = false; }, 6000); }
  private normalizeIndex(index: number, length: number): number { return ((index % length) + length) % length; }

  openDrawer(supplement: Supplement) {
    this.selectedSupplement = supplement;
    this.isDrawerOpen = true;
    document.body.style.overflow = 'hidden';
    this.cdr.markForCheck();
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    document.body.style.overflow = '';
    setTimeout(() => {
      this.selectedSupplement = null;
      this.cdr.markForCheck();
    }, 400);
  }

  @HostListener('document:keydown.escape')
  onKeydownHandler() {
    if (this.isDrawerOpen) this.closeDrawer();
  }

  getStars(rating: number): number[] {
    return Array.from({ length: rating }, (_, index) => index);
  }
}