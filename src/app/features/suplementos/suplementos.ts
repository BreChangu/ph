import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';

type Supplement = {
  name: string;
  category: string;
  highlight: string;
  description: string;
  tag: string;
  rating: number;
  quote: string;
  form: 'tub' | 'pouch' | 'bottle';
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
  activeHero = 0;
  activeProduct = 0;
  isAutoPaused = false;

  supplements: Supplement[] = [
    {
      name: 'Creatina Monohidratada',
      category: 'Fuerza',
      highlight: 'Top consulta',
      description: 'Base diaria para rendimiento en sesiones de alta intensidad.',
      tag: '3-5 g diarios',
      rating: 5,
      quote: 'Cotizar ahora',
      form: 'tub',
    },
    {
      name: 'Proteina Whey',
      category: 'Recuperacion',
      highlight: 'Popular',
      description: 'Apoyo practico para completar requerimientos de proteina.',
      tag: 'Post entreno',
      rating: 5,
      quote: 'Cotizar ahora',
      form: 'pouch',
    },
    {
      name: 'Pre Entreno',
      category: 'Energia',
      highlight: 'Alta demanda',
      description: 'Formulas orientadas a enfoque, energia y desempeno.',
      tag: 'Uso puntual',
      rating: 4,
      quote: 'Cotizar ahora',
      form: 'tub',
    },
    {
      name: 'Electrolitos',
      category: 'Hidratacion',
      highlight: 'Esencial',
      description: 'Sales y minerales para sesiones largas o clima caluroso.',
      tag: 'Hidratacion',
      rating: 4,
      quote: 'Cotizar ahora',
      form: 'bottle',
    },
    {
      name: 'Omega 3',
      category: 'Bienestar',
      highlight: 'Consulta',
      description: 'Soporte nutricional cuando el consumo de pescado es bajo.',
      tag: 'Capsulas',
      rating: 4,
      quote: 'Cotizar ahora',
      form: 'bottle',
    },
    {
      name: 'Beta Alanina',
      category: 'Resistencia',
      highlight: 'Performance',
      description: 'Opcion para esfuerzos intensos y repetidos de corta duracion.',
      tag: 'Carga gradual',
      rating: 4,
      quote: 'Cotizar ahora',
      form: 'pouch',
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
      eyebrow: 'Rendimiento y recuperacion',
      title: 'Productos utiles, sin promesas vacias',
      copy: 'Priorizamos formulas simples, sellos de calidad y uso responsable antes que tendencias pasajeras.',
      feature: 'Asesoria antes de cotizar',
      product: this.supplements[1],
    },
    {
      eyebrow: 'Compra inteligente',
      title: 'Compara categorias antes de elegir marca',
      copy: 'Creatina, proteina, electrolitos y pre entrenos pueden tener lugar, pero no todos son necesarios para todos.',
      feature: 'Seleccion por objetivo',
      product: this.supplements[3],
    },
  ];

  private heroTimer?: ReturnType<typeof setInterval>;
  private productTimer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.startAutoScroll();
  }

  ngOnDestroy() {
    this.stopAutoScroll();
  }

  get visibleSupplements(): Supplement[] {
    const ordered = [...this.supplements];
    return ordered.slice(this.activeProduct).concat(ordered.slice(0, this.activeProduct));
  }

  get activeSlide(): HeroSlide {
    return this.heroSlides[this.activeHero];
  }

  setHero(index: number) {
    this.activeHero = this.normalizeIndex(index, this.heroSlides.length);
    this.pauseBriefly();
  }

  nextHero() {
    this.setHero(this.activeHero + 1);
  }

  previousHero() {
    this.setHero(this.activeHero - 1);
  }

  setProduct(index: number) {
    this.activeProduct = this.normalizeIndex(index, this.supplements.length);
    this.pauseBriefly();
  }

  nextProduct() {
    this.setProduct(this.activeProduct + 1);
  }

  previousProduct() {
    this.setProduct(this.activeProduct - 1);
  }

  getStars(rating: number): number[] {
    return Array.from({ length: rating }, (_, index) => index);
  }

  trackByName(_: number, item: Supplement): string {
    return item.name;
  }

  private startAutoScroll() {
    this.heroTimer = setInterval(() => {
      if (!this.isAutoPaused) this.activeHero = this.normalizeIndex(this.activeHero + 1, this.heroSlides.length);
    }, 5200);

    this.productTimer = setInterval(() => {
      if (!this.isAutoPaused) this.activeProduct = this.normalizeIndex(this.activeProduct + 1, this.supplements.length);
    }, 3600);
  }

  private stopAutoScroll() {
    if (this.heroTimer) clearInterval(this.heroTimer);
    if (this.productTimer) clearInterval(this.productTimer);
  }

  private pauseBriefly() {
    this.isAutoPaused = true;
    setTimeout(() => {
      this.isAutoPaused = false;
    }, 6000);
  }

  private normalizeIndex(index: number, length: number): number {
    return ((index % length) + length) % length;
  }
}
