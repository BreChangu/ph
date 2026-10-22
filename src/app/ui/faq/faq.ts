import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnInit, Renderer2 } from '@angular/core';

type FAQ = {
  question: string;
  answer: string;
  isOpen: boolean;
};

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faq.html',
  styleUrl: './faq.scss',
})
export class FaqComponent implements OnInit {
  faqs: FAQ[] = [
    {
      question: '¿Cuentan con envíos a todo México?',
      answer: 'Sí, gestionamos envíos a nivel nacional  dependiendo de la zona. El costo se calcula al momento de confirmar tu cotización.',
      isOpen: false
    },
    {
      question: '¿Cómo sé qué suplemento es el adecuado para mí?',
      answer: 'No creemos en ventas a ciegas. Cada cotización incluye una evaluación breve para asegurar que el stack que elijas se alinee con tu nivel de entrenamiento, tolerancia a estimulantes y objetivos de composición corporal.',
      isOpen: false
    },
    {
      question: '¿Los productos son originales?',
      answer: 'Trabajamos exclusivamente con distribuidores directos y marcas certificadas. Cada producto incluye sus sellos de garantía y códigos de autenticidad de fábrica.',
      isOpen: false
    },
    {
      question: '¿Puedo combinar pre-entrenos con quemadores de grasa?',
      answer: 'Por seguridad cardiovascular, desaconsejamos la combinación de múltiples fuentes altas en estimulantes. Si buscas un efecto termogénico y energía, te recomendaremos la fórmula que cubra ambos aspectos sin saturar tu sistema nervioso.',
      isOpen: false
    }
  ];

  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    this.iniciarSeoEstructural();
  }

  toggleFaq(index: number) {
    this.faqs = this.faqs.map((faq, i) => ({
      ...faq,
      isOpen: i === index ? !faq.isOpen : false
    }));
  }

  private iniciarSeoEstructural() {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': this.faqs.map(faq => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.answer
        }
      }))
    };

    const script = this.renderer.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    this.renderer.appendChild(this.document.head, script);
  }
}