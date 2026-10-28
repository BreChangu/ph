import { CommonModule } from '@angular/common';
import { afterNextRender, Component, OnDestroy, signal } from '@angular/core';
import { WhatsappPipe } from '../../ui/whatsapp/whatsapp.pipe';

type TestimonialSlide = {
  imageUrl: string;
  label: string;
  alt: string;
};

@Component({
  selector: 'app-home',
  imports: [CommonModule, WhatsappPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnDestroy {
  readonly testimonials: TestimonialSlide[] = [
    { imageUrl: '/images/testimonios/transformacion-1.jpeg', label: 'Caso 01', alt: 'Transformacion de paciente 1' },
    { imageUrl: '/images/testimonios/transformacion-2.jpeg', label: 'Caso 02', alt: 'Transformacion de paciente 2' },
    { imageUrl: '/images/testimonios/transformacion-3.jpeg', label: 'Caso 03', alt: 'Transformacion de paciente 3' },
    { imageUrl: '/images/testimonios/transformacion-4.jpeg', label: 'Caso 04', alt: 'Transformacion de paciente 4' },
    { imageUrl: '/images/testimonios/transformacion-5.jpeg', label: 'Caso 05', alt: 'Transformacion de paciente 5' },
    { imageUrl: '/images/testimonios/transformacion-6.jpeg', label: 'Caso 06', alt: 'Transformacion de paciente 6' },
    { imageUrl: '/images/testimonios/transformacion-7.jpeg', label: 'Caso 07', alt: 'Transformacion de paciente 7' },
    { imageUrl: '/images/testimonios/transformacion-8.jpeg', label: 'Caso 08', alt: 'Transformacion de paciente 8' },
  ];

  readonly activeTestimonial = signal(0);
  private autoplayId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    afterNextRender(() => this.startAutoplay());
  }

  ngOnDestroy() {
    this.stopAutoplay();
  }

  nextTestimonial() {
    this.activeTestimonial.update((current) => (current + 1) % this.testimonials.length);
  }

  previousTestimonial() {
    this.activeTestimonial.update((current) => (current - 1 + this.testimonials.length) % this.testimonials.length);
  }

  selectTestimonial(index: number) {
    this.activeTestimonial.set(index);
    this.startAutoplay();
  }

  private startAutoplay() {
    this.stopAutoplay();
    this.autoplayId = globalThis.setInterval(() => this.nextTestimonial(), 2500);
  }

  private stopAutoplay() {
    if (this.autoplayId === null) return;
    globalThis.clearInterval(this.autoplayId);
    this.autoplayId = null;
  }

}
