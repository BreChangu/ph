import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { BlogPost } from '../models/blog-post.model';
import { AuthService } from '../supabase/auth';

type BlogPostPayload = Omit<BlogPost, 'id' | 'date' | 'updatedAt'> & {
  id?: string;
  date?: string;
};

@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly authService = inject(AuthService);
  private readonly tableName = 'blog_posts';
  private readonly storageKey = 'ph_blog_posts';
  private readonly bucketName = 'blog-images';
  private readonly maxImageSize = 7 * 1024 * 1024;
  private readonly allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  /**
   * Listado público: solo artículos publicados.
   * La protección principal sigue siendo RLS en Supabase.
   */
  getPosts(): Observable<BlogPost[]> {
    return from(this.loadPosts(true));
  }

  /**
   * Detalle público: solo devuelve el artículo si está publicado.
   */
  getPostById(id: string): Observable<BlogPost | undefined> {
    return from(this.loadPublishedPostById(id));
  }

  getFeaturedPost(): Observable<BlogPost | undefined> {
    return from(this.loadFeaturedPost());
  }

  /**
   * Listado del panel administrativo, incluidos borradores.
   */
  async getAdminPosts(): Promise<BlogPost[]> {
    try {
      const { data, error } = await this.authService.supabase
        .from(this.tableName)
        .select('*')
        .order('published_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => this.fromDb(row));
    } catch (error) {
      console.error('No se pudieron recuperar los artículos de Supabase.', error);
      throw new Error(
        'No se pudieron cargar los artículos desde Supabase. Revisa tu sesión y las políticas RLS.'
      );
    }
  }

  /**
   * Guarda el artículo en Supabase. No informa éxito si el servidor falla.
   */
  async savePost(post: BlogPostPayload): Promise<BlogPost> {
    const normalized = this.normalizePost(post);

    const { data, error } = await this.authService.supabase
      .from(this.tableName)
      .upsert(this.toDb(normalized), { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Falló el guardado remoto del artículo:', error);
      throw new Error(
        `No se pudo guardar el artículo en Supabase: ${error.message}. Revisa tu sesión y las políticas RLS.`
      );
    }

    const savedPost = this.fromDb(data);
    this.saveLocalPost(savedPost);
    return savedPost;
  }

  async deletePost(id: string): Promise<void> {
    const { data, error } = await this.authService.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('No se pudo eliminar el artículo en Supabase:', error);
      throw new Error(
        `No se pudo eliminar el artículo en Supabase: ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      throw new Error(
        'Supabase no eliminó ningún artículo. Comprueba que exista y que tu cuenta tenga permisos de administrador.'
      );
    }

    this.removeLocalPost(id);
  }

  /**
   * Sube una imagen al bucket público blog-images y devuelve su URL.
   * El bucket puede ser público para lectura, pero las escrituras deben
   * estar protegidas por políticas de Storage para administradores.
   */
  async uploadCoverImage(file: File): Promise<string> {
    if (!this.allowedImageTypes.includes(file.type)) {
      throw new Error('Formato no permitido. Utiliza JPG, PNG o WebP.');
    }

    if (file.size <= 0) {
      throw new Error('El archivo de imagen está vacío.');
    }

    if (file.size > this.maxImageSize) {
      throw new Error('La imagen supera el límite de 7 MB.');
    }

    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    const extension = extensionByType[file.type];

    // Evita depender de que crypto.randomUUID esté disponible en todos
    // los contextos de desarrollo. Se genera un nombre único para el archivo.
    const uniqueName =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `covers/${uniqueName}.${extension}`;

    const { error: uploadError } = await this.authService.supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error al subir la portada:', uploadError);
      throw new Error(
        `No se pudo subir la imagen a Supabase Storage: ${uploadError.message}. Revisa la sesión y las políticas del bucket.`
      );
    }

    const { data } = this.authService.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error('Supabase no devolvió la URL pública de la imagen.');
    }

    return data.publicUrl;
  }

  createEmptyPost(): BlogPost {
    const now = new Date().toISOString();

    return {
      id: this.createId(),
      title: '',
      excerpt: '',
      content: '',
      coverImage: '',
      date: now,
      category: 'Nutrición',
      readTime: '4 min',
      author: 'Pablo Herrera',
      published: false,
      featured: false,
      updatedAt: now,
    };
  }

  private async loadPosts(onlyPublished: boolean): Promise<BlogPost[]> {
    try {
      let query = this.authService.supabase
        .from(this.tableName)
        .select('*')
        .order('published_at', { ascending: false });

      if (onlyPublished) {
        query = query.eq('published', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      const posts = (data ?? []).map((row: any) => this.fromDb(row));

      // Filtrado defensivo adicional para el blog público.
      return onlyPublished
        ? posts.filter((post) => post.published === true)
        : posts;
    } catch (error) {
      console.error('No se pudieron cargar los artículos remotos:', error);

      // En el sitio público no mostramos borradores guardados localmente.
      return this.getLocalPosts(onlyPublished);
    }
  }

  private async loadPublishedPostById(
    id: string
  ): Promise<BlogPost | undefined> {
    try {
      const { data, error } = await this.authService.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .eq('published', true)
        .maybeSingle();

      if (error) throw error;

      return data ? this.fromDb(data) : undefined;
    } catch (error) {
      console.error('Error al consultar el artículo publicado:', error);

      return this.getLocalPosts(true).find((post) => post.id === id);
    }
  }

  private async loadFeaturedPost(): Promise<BlogPost | undefined> {
    const posts = await this.loadPosts(true);
    return posts.find((post) => post.featured) ?? posts[0];
  }

  private normalizePost(post: BlogPostPayload): BlogPost {
    const now = new Date().toISOString();

    return {
      id: post.id || this.createId(),
      title: String(post.title ?? '').trim(),
      excerpt: String(post.excerpt ?? '').trim(),
      content: this.toReadableHtml(post.content),
      coverImage: String(post.coverImage ?? '').trim(),
      date: post.date || now,
      category: String(post.category ?? '').trim() || 'Nutrición',
      readTime: String(post.readTime ?? '').trim() || '4 min',
      author: String(post.author ?? '').trim() || 'Pablo Herrera',
      published: post.published ?? false,
      featured: post.featured ?? false,
      updatedAt: now,
    };
  }

  private fromDb(row: any): BlogPost {
    return {
      id: String(row.id),
      title: row.title ?? '',
      excerpt: row.excerpt ?? '',
      content: row.content ?? '',
      coverImage: row.cover_image ?? '',
      date: row.published_at || row.created_at || new Date().toISOString(),
      category: row.category ?? 'Nutrición',
      readTime: row.read_time ?? '4 min',
      author: row.author ?? 'Pablo Herrera',
      published: row.published === true,
      featured: row.featured === true,
      updatedAt: row.updated_at ?? row.created_at,
    };
  }

  private toDb(post: BlogPost) {
    return {
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      cover_image: post.coverImage,
      published_at: post.date,
      category: post.category,
      read_time: post.readTime,
      author: post.author,
      published: post.published,
      featured: post.featured,
      updated_at: post.updatedAt,
    };
  }

  private getLocalPosts(includeDrafts: boolean): BlogPost[] {
    return this.readLocalPosts()
      .filter((post) => includeDrafts || post.published === true)
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  }

  private readLocalPosts(): BlogPost[] {
    try {
      if (typeof localStorage === 'undefined') return [];

      const value = localStorage.getItem(this.storageKey);
      if (!value) return [];

      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as BlogPost[]) : [];
    } catch {
      return [];
    }
  }

  private writeLocalPosts(posts: BlogPost[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(posts));
      }
    } catch (error) {
      console.warn('No se pudo actualizar el respaldo local del blog:', error);
    }
  }

  private saveLocalPost(post: BlogPost): void {
    const posts = this.readLocalPosts().filter((item) => item.id !== post.id);
    posts.unshift(post);
    this.writeLocalPosts(posts);
  }

  private removeLocalPost(id: string): void {
    this.writeLocalPosts(
      this.readLocalPosts().filter((post) => post.id !== id)
    );
  }

  private createId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private toReadableHtml(content: string): string {
    const value = String(content ?? '').trim();

    if (!value) return '';

    // Conserva HTML cuando el contenido ya viene en formato enriquecido.
    if (/<[a-z][\s\S]*>/i.test(value)) return value;

    return value
      .split(/\n{2,}/)
      .map(
        (paragraph) =>
          `<p>${this.escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`
      )
      .join('');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
