import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { BlogPost } from '../models/blog-post.model';
import { BLOG_POSTS } from '../data/mock-blog-posts';
import { AuthService } from '../supabase/auth';

type BlogPostPayload = Omit<BlogPost, 'id' | 'date' | 'updatedAt'> & {
  id?: string;
  date?: string;
};

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private authService = inject(AuthService);
  private readonly tableName = 'blog_posts';
  private readonly storageKey = 'ph_blog_posts';
  private readonly requestTimeoutMs = 4500;

  getPosts(): Observable<BlogPost[]> {
    return of(this.getLocalPosts(false));
  }

  getPostById(id: string): Observable<BlogPost | undefined> {
    return of(this.getLocalPosts(true).find((post) => post.id === id));
  }

  getFeaturedPost(): Observable<BlogPost | undefined> {
    const posts = this.getLocalPosts(false);
    return of(posts.find((post) => post.featured) ?? posts[0]);
  }

  async getAdminPosts(): Promise<BlogPost[]> {
    return this.getLocalPosts(true);
  }

  async savePost(post: BlogPostPayload): Promise<BlogPost> {
    const normalized = this.normalizePost(post);
    this.saveLocalPost(normalized);
    void this.trySaveRemotePost(normalized);
    return normalized;
  }

  async deletePost(id: string): Promise<void> {
    const nextPosts = this.getLocalPosts(true).filter((post) => post.id !== id);
    this.writeLocalPosts(nextPosts);
    void this.tryDeleteRemotePost(id);
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
      category: 'Nutricion',
      readTime: '4 min',
      author: 'Pablo Herrera',
      published: false,
      featured: false,
      updatedAt: now,
    };
  }

  private async tryGetRemotePosts(onlyPublished: boolean): Promise<BlogPost[] | null> {
    try {
      let query = this.authService.supabase
        .from(this.tableName)
        .select('*')
        .order('published_at', { ascending: false });

      if (onlyPublished) {
        query = query.eq('published', true);
      }

      const { data, error } = await this.withTimeout(query, 'La consulta del blog tardo demasiado.');
      if (error) throw error;
      return this.sortPosts((data ?? []).map((post) => this.fromDb(post)));
    } catch (error) {
      console.warn('Blog remoto no disponible, usando respaldo local:', error);
      return null;
    }
  }

  private async trySaveRemotePost(post: BlogPost): Promise<BlogPost | null> {
    try {
      const { data, error } = await this.withTimeout(
        this.authService.supabase
          .from(this.tableName)
          .upsert(this.toDb(post), { onConflict: 'id' })
          .select()
          .single(),
        'El guardado remoto del blog tardo demasiado.'
      );

      if (error) throw error;
      return this.fromDb(data);
    } catch (error) {
      console.warn('No se pudo guardar el blog remoto, usando respaldo local:', error);
      return null;
    }
  }

  private async tryDeleteRemotePost(id: string): Promise<void> {
    try {
      await this.withTimeout(
        this.authService.supabase.from(this.tableName).delete().eq('id', id),
        'La eliminacion remota del blog tardo demasiado.'
      );
    } catch (error) {
      console.warn('No se pudo eliminar el blog remoto:', error);
    }
  }

  private normalizePost(post: BlogPostPayload): BlogPost {
    const now = new Date().toISOString();
    return {
      id: post.id || this.createId(),
      title: String(post.title ?? '').trim(),
      excerpt: String(post.excerpt ?? '').trim(),
      content: this.toReadableHtml(post.content),
      coverImage: String(post.coverImage ?? '').trim() || '/images/blog-inmune.webp',
      date: post.date || now,
      category: String(post.category ?? '').trim() || 'Nutricion',
      readTime: String(post.readTime ?? '').trim() || '4 min',
      author: String(post.author ?? '').trim() || 'Pablo Herrera',
      published: post.published ?? false,
      featured: post.featured ?? false,
      updatedAt: now,
    };
  }

  private toReadableHtml(content: string): string {
    const value = String(content ?? '').trim();
    if (!value) return '';
    if (/<[a-z][\s\S]*>/i.test(value)) return value;

    return value
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${this.escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
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

  private fromDb(row: any): BlogPost {
    return {
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
      coverImage: row.cover_image,
      date: row.published_at || row.created_at,
      category: row.category,
      readTime: row.read_time,
      author: row.author,
      published: row.published,
      featured: row.featured,
      updatedAt: row.updated_at,
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
    const stored = this.readLocalPosts();
    const basePosts = BLOG_POSTS.map((post, index) => ({
      ...post,
      published: true,
      featured: index === 0,
      updatedAt: post.date,
    }));
    const merged = this.mergePosts([...stored, ...basePosts]);
    return includeDrafts ? this.sortPosts(merged) : this.sortPosts(merged.filter((post) => post.published !== false));
  }

  private readLocalPosts(): BlogPost[] {
    if (!this.hasLocalStorage()) return [];
    try {
      return JSON.parse(globalThis.localStorage.getItem(this.storageKey) || '[]');
    } catch {
      return [];
    }
  }

  private writeLocalPosts(posts: BlogPost[]) {
    if (!this.hasLocalStorage()) return;
    globalThis.localStorage.setItem(this.storageKey, JSON.stringify(this.sortPosts(posts)));
  }

  private saveLocalPost(post: BlogPost) {
    const posts = this.readLocalPosts().filter((item) => item.id !== post.id);
    posts.unshift(post);
    this.writeLocalPosts(posts);
  }

  private mergePosts(posts: BlogPost[]): BlogPost[] {
    const byId = new Map<string, BlogPost>();
    posts.forEach((post) => byId.set(post.id, post));
    return Array.from(byId.values());
  }

  private sortPosts(posts: BlogPost[]): BlogPost[] {
    return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private createId(): string {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `post-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private hasLocalStorage(): boolean {
    try {
      return typeof globalThis.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  private withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
    return Promise.race([
      Promise.resolve(request),
      new Promise<T>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error(message)), this.requestTimeoutMs);
      }),
    ]);
  }
}
