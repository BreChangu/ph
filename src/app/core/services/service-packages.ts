import { Injectable, inject } from '@angular/core';
import { concat, from, Observable, of } from 'rxjs';
import { SERVICE_PACKAGES } from '../data/mock-service-packages';
import { ServicePackage } from '../models/service-package.model';
import { AuthService } from '../supabase/auth';

type ServicePackagePayload = Omit<ServicePackage, 'id' | 'updatedAt'> & {
  id?: string;
  updatedAt?: string;
};

@Injectable({
  providedIn: 'root',
})
export class ServicePackagesService {
  private authService = inject(AuthService);
  private readonly tableName = 'service_packages';
  private readonly storageKey = 'ph_service_packages';
  private readonly requestTimeoutMs = 4500;

  getPublishedPackages(): Observable<ServicePackage[]> {
    return concat(of(this.getLocalPackages(false)), from(this.getPackages(false)));
  }

  async getAdminPackages(): Promise<ServicePackage[]> {
    return this.getPackages(true);
  }

  async savePackage(servicePackage: ServicePackagePayload): Promise<ServicePackage> {
    const normalized = this.normalizePackage(servicePackage);
    this.saveLocalPackage(normalized);
    void this.trySaveRemotePackage(normalized);
    return normalized;
  }

  async deletePackage(id: string): Promise<void> {
    const nextPackages = this.readLocalPackages().filter((item) => item.id !== id);
    this.writeLocalPackages(nextPackages);
    void this.tryDeleteRemotePackage(id);
  }

  createEmptyPackage(): ServicePackage {
    const now = new Date().toISOString();
    return {
      id: this.createId(),
      title: '',
      subtitle: '',
      description: '',
      imageUrl: '',
      badge: 'Nuevo',
      includes: [''],
      ctaLabel: 'Cotizar paquete',
      featured: false,
      published: false,
      sortOrder: this.getLocalPackages(true).length + 1,
      updatedAt: now,
    };
  }

  private normalizePackage(servicePackage: ServicePackagePayload): ServicePackage {
    const now = new Date().toISOString();
    return {
      id: servicePackage.id || this.createId(),
      title: String(servicePackage.title ?? '').trim(),
      subtitle: String(servicePackage.subtitle ?? '').trim(),
      description: String(servicePackage.description ?? '').trim(),
      imageUrl: String(servicePackage.imageUrl ?? '').trim() || '/images/entrenamiento.webp',
      badge: String(servicePackage.badge ?? '').trim() || 'Paquete',
      includes: this.normalizeIncludes(servicePackage.includes),
      ctaLabel: String(servicePackage.ctaLabel ?? '').trim() || 'Cotizar paquete',
      featured: servicePackage.featured ?? false,
      published: servicePackage.published ?? false,
      sortOrder: Number(servicePackage.sortOrder) || 1,
      updatedAt: now,
    };
  }

  private normalizeIncludes(includes: string[] | string | undefined): string[] {
    if (Array.isArray(includes)) {
      return includes.map((item) => String(item ?? '').trim()).filter(Boolean);
    }

    return String(includes ?? '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private async getPackages(includeDrafts: boolean): Promise<ServicePackage[]> {
    const remotePackages = await this.tryGetRemotePackages(!includeDrafts);
    if (!remotePackages) return this.getLocalPackages(includeDrafts);

    const merged = this.sortPackages(this.mergePackages([...remotePackages, ...this.readLocalPackages()]));
    return includeDrafts ? merged : merged.filter((item) => item.published !== false);
  }

  private async tryGetRemotePackages(onlyPublished: boolean): Promise<ServicePackage[] | null> {
    try {
      let query = this.authService.supabase
        .from(this.tableName)
        .select('*')
        .order('sort_order', { ascending: true });

      if (onlyPublished) {
        query = query.eq('published', true);
      }

      const { data, error } = await this.withTimeout(query, 'La consulta de paquetes tardo demasiado.');
      if (error) throw error;
      return this.sortPackages((data ?? []).map((item) => this.fromDb(item)));
    } catch (error) {
      console.warn('Paquetes remotos no disponibles, usando respaldo local:', error);
      return null;
    }
  }

  private async trySaveRemotePackage(servicePackage: ServicePackage): Promise<ServicePackage | null> {
    try {
      const { data, error } = await this.withTimeout(
        this.authService.supabase
          .from(this.tableName)
          .upsert(this.toDb(servicePackage), { onConflict: 'id' })
          .select()
          .single(),
        'El guardado remoto del paquete tardo demasiado.'
      );

      if (error) throw error;
      return this.fromDb(data);
    } catch (error) {
      console.warn('No se pudo guardar el paquete remoto, usando respaldo local:', error);
      return null;
    }
  }

  private async tryDeleteRemotePackage(id: string): Promise<void> {
    try {
      await this.withTimeout(
        this.authService.supabase.from(this.tableName).delete().eq('id', id),
        'La eliminacion remota del paquete tardo demasiado.'
      );
    } catch (error) {
      console.warn('No se pudo eliminar el paquete remoto:', error);
    }
  }

  private fromDb(row: any): ServicePackage {
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      imageUrl: row.image_url,
      badge: row.badge,
      includes: row.includes ?? [],
      ctaLabel: row.cta_label,
      featured: row.featured,
      published: row.published,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
    };
  }

  private toDb(servicePackage: ServicePackage) {
    return {
      id: servicePackage.id,
      title: servicePackage.title,
      subtitle: servicePackage.subtitle,
      description: servicePackage.description,
      image_url: servicePackage.imageUrl,
      badge: servicePackage.badge,
      includes: servicePackage.includes,
      cta_label: servicePackage.ctaLabel,
      featured: servicePackage.featured,
      published: servicePackage.published,
      sort_order: servicePackage.sortOrder,
      updated_at: servicePackage.updatedAt,
    };
  }

  private getLocalPackages(includeDrafts: boolean): ServicePackage[] {
    const stored = this.readLocalPackages();
    const merged = this.mergePackages([...stored, ...SERVICE_PACKAGES]);
    const visible = includeDrafts ? merged : merged.filter((item) => item.published !== false);
    return this.sortPackages(visible);
  }

  private readLocalPackages(): ServicePackage[] {
    if (!this.hasLocalStorage()) return [];
    try {
      return JSON.parse(globalThis.localStorage.getItem(this.storageKey) || '[]');
    } catch {
      return [];
    }
  }

  private writeLocalPackages(servicePackages: ServicePackage[]) {
    if (!this.hasLocalStorage()) return;
    globalThis.localStorage.setItem(this.storageKey, JSON.stringify(this.sortPackages(servicePackages)));
  }

  private saveLocalPackage(servicePackage: ServicePackage) {
    const packages = this.readLocalPackages().filter((item) => item.id !== servicePackage.id);
    packages.unshift(servicePackage);
    this.writeLocalPackages(packages);
  }

  private mergePackages(servicePackages: ServicePackage[]): ServicePackage[] {
    const byId = new Map<string, ServicePackage>();
    servicePackages.forEach((item) => byId.set(item.id, item));
    return Array.from(byId.values());
  }

  private sortPackages(servicePackages: ServicePackage[]): ServicePackage[] {
    return [...servicePackages].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }

  private createId(): string {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `package-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
