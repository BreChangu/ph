import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators'; // Simulamos un ligero retraso de red
import { BlogPost } from '../models/blog-post.model';
import { BLOG_POSTS } from '../data/mock-blog-posts';

@Injectable({
  providedIn: 'root'
})
export class BlogService {

  constructor() { }

  /**
   * Obtiene todas las notas del blog.
   * Útil para la página principal del blog donde se muestra el grid.
   */
  getPosts(): Observable<BlogPost[]> {
    // Retornamos los datos envueltos en un Observable y agregamos 
    // un pequeño delay de 300ms para simular que vienen de un servidor.
    // Esto es genial para probar estados de carga (loaders) en la UI.
    return of(BLOG_POSTS);
  }

  /**
   * Obtiene una nota específica basándose en su ID.
   * Vital para cuando el usuario hace clic en "Leer Más" y va al detalle de la nota.
   * @param id El identificador único de la nota.
   */
  getPostById(id: string): Observable<BlogPost | undefined> {
    const post = BLOG_POSTS.find(p => p.id === id);
    return of(post).pipe(delay(300));
  }

  /**
   * Obtiene la nota más reciente (asumiendo que el ID 1 es la más nueva, 
   * o basándose en la fecha en un escenario real).
   * Perfecto para mostrarla como la "Nota Destacada" en el Hero del Blog.
   */
  getFeaturedPost(): Observable<BlogPost | undefined> {
    // Por simplicidad en este mock, retornamos la primera nota del arreglo.
    const featured = BLOG_POSTS.length > 0 ? BLOG_POSTS[0] : undefined;
    return of(featured).pipe(delay(300));
  }
}