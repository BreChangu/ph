export interface BlogPost {

  id: string;
  title: string;
  excerpt: string;         // Un resumen corto para la tarjeta de vista previa
  content: string;         // El cuerpo completo del artículo (HTML o texto)
  coverImage: string;      // La foto principal de la nota
  date: string;            // Fecha de publicación
  category: string;        // Ej: 'Biomecánica', 'Nutrición', 'Mindset'
  readTime: string;        // Ej: '5 min' (Un toque muy premium para el lector)
  author?: string;         // Opcional (?) por si después invitan a otros coaches a escribir
}


