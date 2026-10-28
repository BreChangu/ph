import { Pipe, PipeTransform } from '@angular/core';

/** Número de WhatsApp del coach con clave de país (52 = México). */
export const WHATSAPP_NUMERO = '525585445890';

/** Enlace de WhatsApp con un mensaje ya escrito. */
export function whatsappUrl(mensaje: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Uso en plantillas:
 *   <a [href]="'Hola Pablo, me interesa...' | whatsapp" target="_blank" rel="noopener">
 */
@Pipe({ name: 'whatsapp', standalone: true })
export class WhatsappPipe implements PipeTransform {
  transform(mensaje: string): string {
    return whatsappUrl(mensaje);
  }
}
