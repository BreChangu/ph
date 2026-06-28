export interface ServicePackage {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  badge: string;
  includes: string[];
  ctaLabel: string;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  updatedAt: string;
}
