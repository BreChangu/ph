export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  date: string;
  category: string;
  readTime: string;
  author?: string;
  published?: boolean;
  featured?: boolean;
  updatedAt?: string;
}
